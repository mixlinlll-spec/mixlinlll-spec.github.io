// 庫存操作（D1）。所有修改：
//   - 用條件式 UPDATE 一次完成（資料庫 CHECK 也禁止負數、保留量大於實際庫存）
//   - 「修改為」與「盤點確認」需要畫面載入時的版本號（樂觀鎖），期間有人改過就拒絕、請重新整理
//   - 修改與紀錄在同一個 batch（D1 交易）內完成；op_id 唯一，重複送出不會重複扣庫存

export const KINDS = {
  transfer: '移轉',
  receive: '入庫',
  issue: '出庫／扣庫',
  set: '修改為',
  count: '盤點確認',
};
export const AVAILABILITY = { in_stock: '現貨', preorder: '預購', made_to_order: '接單製作', out_of_stock: '缺貨', unknown: '請洽詢' };

export class InventoryError extends Error {
  constructor(message, status = 400, extra = {}) { super(message); this.status = status; Object.assign(this, extra); }
}

const nowIso = () => new Date().toISOString();

// 庫存為 0（可售 ≤ 0）時的提醒：官網顯示「現貨」才警告；預購／接單製作屬正常
export function stockAlert(row) {
  if (!row.counted_at) return null; // 尚未盤點：數量未知，不提醒（列表會標示「尚未盤點」）
  const available = row.stock_on_hand - row.stock_reserved;
  if (available > 0) return null;
  const a = row.site_availability || row.product_availability;
  if (a === 'in_stock') return { level: 'warning', message: '可售數量為 0，但官網顯示「現貨」。請到商品後台把供貨狀態改為「缺貨」或「預購」。' };
  if (a === 'preorder' || a === 'made_to_order') return { level: 'info', message: `可售數量為 0，官網顯示「${AVAILABILITY[a]}」，可繼續接單。` };
  return null;
}

const SELECT_SKU = `
  SELECT s.sku, s.product_id, s.variant_ref, s.active, p.active AS product_active, s.variant_name, s.position, s.shopee_item_id, s.shopee_variation_id, s.site_availability,
         s.stock_on_hand, s.stock_reserved, (s.stock_on_hand - s.stock_reserved) AS available, s.version,
         s.snapshot_qty, s.snapshot_at, s.counted_at, s.counted_by, s.updated_at,
         p.name AS product_name, p.brand, p.slug, p.availability AS product_availability, p.published
  FROM skus s JOIN products p ON p.id = s.product_id`;

function decorate(row) {
  if (!row) return row;
  return { ...row, alert: stockAlert(row) };
}

export const PAGE_SIZE = 100;

// 搜尋與篩選都在資料庫完成（涵蓋全部規格），再分頁回傳：{ items, total, offset, next_offset }
export async function listSkus(db, { q = '', filter = 'all', offset = 0, limit = PAGE_SIZE, product = '' } = {}) {
  const where = [];
  const binds = [];
  if (filter === 'inactive') where.push('(s.active = 0 OR p.active = 0)', '(s.stock_on_hand > 0 OR s.stock_reserved > 0)');
  else where.push('s.active = 1', 'p.active = 1');
  if (product) { where.push('s.product_id = ?'); binds.push(String(product)); }
  const words = String(q).trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  for (const w of words) {
    where.push(`(lower(p.name) LIKE ? ESCAPE '\\' OR lower(coalesce(s.variant_name,'')) LIKE ? ESCAPE '\\' OR lower(s.sku) LIKE ? ESCAPE '\\' OR lower(coalesce(p.brand,'')) LIKE ? ESCAPE '\\' OR p.id LIKE ? ESCAPE '\\' OR coalesce(s.shopee_item_id,'') LIKE ? ESCAPE '\\')`);
    const like = `%${w.replace(/[\\%_]/g, m => '\\' + m)}%`;
    binds.push(like, like, like, like, like, like);
  }
  if (filter === 'uncounted') where.push('s.counted_at IS NULL');
  if (filter === 'zero') where.push('s.counted_at IS NOT NULL AND (s.stock_on_hand - s.stock_reserved) <= 0');
  if (filter === 'alert') where.push(`s.counted_at IS NOT NULL AND (s.stock_on_hand - s.stock_reserved) <= 0 AND coalesce(s.site_availability, p.availability) = 'in_stock'`);
  const lim = Math.max(1, Math.min(Number(limit) || PAGE_SIZE, 200));
  const off = Math.max(0, Math.floor(Number(offset) || 0));
  const cond = where.join(' AND ');
  const total = (await db.prepare(`SELECT count(*) AS n FROM skus s JOIN products p ON p.id = s.product_id WHERE ${cond}`).bind(...binds).first()).n;
  const { results } = await db.prepare(`${SELECT_SKU} WHERE ${cond} ORDER BY p.name, s.product_id, s.position, s.sku LIMIT ? OFFSET ?`).bind(...binds, lim, off).all();
  const items = results.map(decorate);
  return { items, total, offset: off, next_offset: off + items.length < total ? off + items.length : null };
}

export async function getSku(db, sku) {
  return decorate(await db.prepare(`${SELECT_SKU} WHERE s.sku = ?`).bind(sku).first());
}

export async function getLedger(db, sku, limit = 50) {
  const { results } = await db.prepare('SELECT * FROM inventory_ledger WHERE sku = ? ORDER BY id DESC LIMIT ?').bind(sku, Math.min(Number(limit) || 50, 500)).all();
  return results;
}

export async function stats(db) {
  return db.prepare(`SELECT count(*) AS skus,
      sum(CASE WHEN s.counted_at IS NULL THEN 1 ELSE 0 END) AS uncounted,
      sum(CASE WHEN s.counted_at IS NOT NULL AND (s.stock_on_hand - s.stock_reserved) <= 0 AND coalesce(s.site_availability, p.availability) = 'in_stock' THEN 1 ELSE 0 END) AS alerts
    FROM skus s JOIN products p ON p.id = s.product_id WHERE s.active = 1 AND p.active = 1`).first()
    .then(async r => ({ ...r, inactive_with_stock: (await db.prepare('SELECT count(*) AS n FROM skus s JOIN products p ON p.id = s.product_id WHERE (s.active = 0 OR p.active = 0) AND (s.stock_on_hand > 0 OR s.stock_reserved > 0)').first()).n }));
}

function parseQty(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw new InventoryError('數量必須是 0 以上的整數');
  return n;
}

// 執行一次庫存操作。input：{ kind, qty, reason, expected_version, op_id }
export async function adjust(db, sku, input, actor) {
  const kind = input?.kind;
  if (!KINDS[kind] || kind === 'transfer') throw new InventoryError('未知的操作');
  const qty = parseQty(input.qty);
  const reason = String(input.reason || '').trim().slice(0, 200);
  if (!reason) throw new InventoryError('請填寫原因');
  const opId = String(input.op_id || '').trim();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(opId)) throw new InventoryError('缺少操作編號（請重新整理頁面）');
  if ((kind === 'receive' || kind === 'issue') && qty === 0) throw new InventoryError('數量必須大於 0');

  // 同一操作重複送出：直接回傳當時的結果
  const dup = await db.prepare('SELECT * FROM inventory_ledger WHERE op_id = ?').bind(opId).first();
  if (dup) return { duplicate: true, entry: dup, sku: await getSku(db, sku) };

  const current = await getSku(db, sku);
  if (!current) throw new InventoryError('找不到這個 SKU', 404);
  if ((!current.active || !current.product_active) && kind !== 'issue') throw new InventoryError('此規格已停用，只能移轉到其他規格或出庫');
  const ts = nowIso();
  const needsVersion = kind === 'set' || kind === 'count';
  if (needsVersion && !Number.isInteger(Number(input.expected_version))) throw new InventoryError('缺少版本號（請重新整理頁面）');

  let update;
  if (kind === 'receive') {
    update = db.prepare(`UPDATE skus SET prev_on_hand = stock_on_hand, stock_on_hand = stock_on_hand + ?, version = version + 1, last_op = ?, updated_at = ?
      WHERE sku = ? AND active = 1`).bind(qty, opId, ts, sku);
  } else if (kind === 'issue') {
    update = db.prepare(`UPDATE skus SET prev_on_hand = stock_on_hand, stock_on_hand = stock_on_hand - ?, version = version + 1, last_op = ?, updated_at = ?
      WHERE sku = ? AND stock_on_hand - ? >= stock_reserved`).bind(qty, opId, ts, sku, qty); // 已停用的規格也可以出庫（報廢、清掉剩餘）
  } else {
    const counted = kind === 'count';
    update = db.prepare(`UPDATE skus SET prev_on_hand = stock_on_hand, stock_on_hand = ?, version = version + 1, last_op = ?, updated_at = ?
      ${counted ? ', counted_at = ?, counted_by = ?' : ''}
      WHERE sku = ? AND active = 1 AND version = ? AND ? >= stock_reserved`)
      .bind(...[qty, opId, ts, ...(counted ? [ts, actor] : []), sku, Number(input.expected_version), qty]);
  }
  // 紀錄只在這次 UPDATE 真的成功（last_op 是這次的 op_id）時寫入；兩個語句在同一個交易內
  const ledger = db.prepare(`INSERT INTO inventory_ledger (op_id, sku, kind, before_on_hand, after_on_hand, delta_on_hand, reason, actor, created_at)
    SELECT ?, sku, ?, prev_on_hand, stock_on_hand, stock_on_hand - prev_on_hand, ?, ?, ? FROM skus WHERE sku = ? AND last_op = ?`)
    .bind(opId, kind, reason, actor, ts, sku, opId);

  let results;
  try {
    results = await db.batch([update, ledger]);
  } catch (e) {
    if (/UNIQUE/i.test(String(e.message))) {
      const again = await db.prepare('SELECT * FROM inventory_ledger WHERE op_id = ?').bind(opId).first();
      if (again) return { duplicate: true, entry: again, sku: await getSku(db, sku) };
    }
    if (/CHECK/i.test(String(e.message))) throw new InventoryError('庫存不可為負數，也不可少於已保留數量');
    throw e;
  }
  const changed = results[0]?.meta?.changes ?? 0;
  if (!changed) {
    const latest = await getSku(db, sku);
    if (kind === 'issue') throw new InventoryError(`庫存不足：可扣 ${latest.stock_on_hand - latest.stock_reserved}，要扣 ${qty}`, 409, { sku: latest });
    if (latest.version !== Number(input.expected_version)) throw new InventoryError('這個規格剛被其他人修改過，已重新載入最新數量，請確認後再送出', 409, { sku: latest });
    throw new InventoryError(`數量不可少於已保留數量（${latest.stock_reserved}）`, 409, { sku: latest });
  }
  const entry = await db.prepare('SELECT * FROM inventory_ledger WHERE op_id = ?').bind(opId).first();
  return { entry, sku: await getSku(db, sku) };
}

// 移轉：把 A 規格的庫存移到 B 規格（同一件商品；用在規格被刪除、舊 SKU 需要轉到新規格時）
// 原子性：來源扣庫、目標入庫、兩筆紀錄、完整性檢查五個語句在同一個 D1 batch（單一交易）內。
// 最後一個語句寫入 transfer_guard，只有「兩邊都更新成功且兩筆紀錄都寫入」時 transfer_complete = 1；
// 否則違反 CHECK (transfer_complete = 1)，整個交易回復 —— 不需要提交後再補償。
export async function transfer(db, fromSku, input, actor) {
  const qty = parseQty(input?.qty);
  if (qty === 0) throw new InventoryError('數量必須大於 0');
  const reason = String(input?.reason || '').trim().slice(0, 200);
  if (!reason) throw new InventoryError('請填寫原因');
  const opId = String(input?.op_id || '').trim();
  if (!/^[A-Za-z0-9-]{8,60}$/.test(opId)) throw new InventoryError('缺少操作編號（請重新整理頁面）');
  const toSku = String(input?.to_sku || '');
  if (toSku === fromSku) throw new InventoryError('不能移轉到同一個規格');
  const outOp = opId + '-out', inOp = opId + '-in';
  const done = async () => ({ duplicate: true, sku: await getSku(db, fromSku), to: await getSku(db, toSku) });
  if (await db.prepare('SELECT 1 AS x FROM transfer_guard WHERE op_id = ?').bind(opId).first()) return done();
  const [a, b] = [await getSku(db, fromSku), await getSku(db, toSku)];
  if (!a || !b) throw new InventoryError('找不到規格', 404);
  if (a.product_id !== b.product_id) throw new InventoryError('只能在同一件商品的規格之間移轉');
  // 目標是否停用、來源是否足夠，由交易內的條件判斷（避免檢查後到寫入前被別人改掉）
  const ts = new Date().toISOString();
  const stmts = [
    db.prepare(`UPDATE skus SET prev_on_hand = stock_on_hand, stock_on_hand = stock_on_hand - ?, version = version + 1, last_op = ?, updated_at = ?
      WHERE sku = ? AND stock_on_hand - ? >= stock_reserved`).bind(qty, outOp, ts, fromSku, qty),
    db.prepare(`UPDATE skus SET prev_on_hand = stock_on_hand, stock_on_hand = stock_on_hand + ?, version = version + 1, last_op = ?, updated_at = ?
      WHERE sku = ? AND active = 1 AND EXISTS (SELECT 1 FROM products p WHERE p.id = skus.product_id AND p.active = 1)`).bind(qty, inOp, ts, toSku),
    db.prepare(`INSERT INTO inventory_ledger (op_id, sku, kind, before_on_hand, after_on_hand, delta_on_hand, reason, actor, created_at)
      SELECT ?, sku, 'transfer_out', prev_on_hand, stock_on_hand, stock_on_hand - prev_on_hand, ?, ?, ? FROM skus WHERE sku = ? AND last_op = ?`).bind(outOp, `${reason}（移到 ${toSku}）`, actor, ts, fromSku, outOp),
    db.prepare(`INSERT INTO inventory_ledger (op_id, sku, kind, before_on_hand, after_on_hand, delta_on_hand, reason, actor, created_at)
      SELECT ?, sku, 'transfer_in', prev_on_hand, stock_on_hand, stock_on_hand - prev_on_hand, ?, ?, ? FROM skus WHERE sku = ? AND last_op = ?`).bind(inOp, `${reason}（來自 ${fromSku}）`, actor, ts, toSku, inOp),
    db.prepare(`INSERT INTO transfer_guard (op_id, from_sku, to_sku, qty, created_at, transfer_complete)
      SELECT ?, ?, ?, ?, ?, CASE WHEN
          EXISTS (SELECT 1 FROM skus WHERE sku = ? AND last_op = ?)
          AND EXISTS (SELECT 1 FROM skus WHERE sku = ? AND last_op = ?)
          AND (SELECT count(*) FROM inventory_ledger WHERE op_id IN (?, ?)) = 2
        THEN 1 ELSE 0 END`).bind(opId, fromSku, toSku, qty, ts, fromSku, outOp, toSku, inOp, outOp, inOp),
  ];
  try {
    await db.batch(stmts);
  } catch (e) {
    const msg = String(e?.message || e);
    if (/UNIQUE/i.test(msg)) return done(); // 同一操作重複送出（並行），另一個已成功
    if (/transfer_complete/i.test(msg)) {
      // 交易已整筆回復：判斷原因
      const [la, lb] = [await getSku(db, fromSku), await getSku(db, toSku)];
      if (!lb?.active || !lb?.product_active) throw new InventoryError('目標規格已停用，未移轉（兩邊數量都沒有變動）', 409, { sku: la });
      throw new InventoryError(`庫存不足：可移轉 ${la.stock_on_hand - la.stock_reserved}，要移 ${qty}（兩邊數量都沒有變動）`, 409, { sku: la });
    }
    if (/CHECK/i.test(msg)) throw new InventoryError('庫存不可為負數，也不可少於已保留數量');
    throw e;
  }
  return { sku: await getSku(db, fromSku), to: await getSku(db, toSku) };
}
