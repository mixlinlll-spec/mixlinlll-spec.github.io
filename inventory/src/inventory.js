// 庫存操作（D1）。所有修改：
//   - 用條件式 UPDATE 一次完成（資料庫 CHECK 也禁止負數、保留量大於實際庫存）
//   - 「修改為」與「盤點確認」需要畫面載入時的版本號（樂觀鎖），期間有人改過就拒絕、請重新整理
//   - 修改與紀錄在同一個 batch（D1 交易）內完成；op_id 唯一，重複送出不會重複扣庫存

export const KINDS = {
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
  SELECT s.sku, s.product_id, s.variant_name, s.position, s.shopee_item_id, s.shopee_variation_id, s.site_availability,
         s.stock_on_hand, s.stock_reserved, (s.stock_on_hand - s.stock_reserved) AS available, s.version,
         s.snapshot_qty, s.snapshot_at, s.counted_at, s.counted_by, s.updated_at,
         p.name AS product_name, p.brand, p.slug, p.availability AS product_availability, p.published
  FROM skus s JOIN products p ON p.id = s.product_id`;

function decorate(row) {
  if (!row) return row;
  return { ...row, alert: stockAlert(row) };
}

export async function listSkus(db, { q = '', filter = 'all', limit = 500 } = {}) {
  const where = ['s.active = 1', 'p.active = 1'];
  const binds = [];
  const words = String(q).trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  for (const w of words) {
    where.push(`(lower(p.name) LIKE ? OR lower(coalesce(s.variant_name,'')) LIKE ? OR lower(s.sku) LIKE ? OR lower(coalesce(p.brand,'')) LIKE ? OR p.id LIKE ? OR coalesce(s.shopee_item_id,'') LIKE ?)`);
    const like = `%${w.replace(/[%_]/g, m => '\\' + m)}%`;
    binds.push(like, like, like, like, like, like);
  }
  if (filter === 'uncounted') where.push('s.counted_at IS NULL');
  if (filter === 'zero') where.push('s.counted_at IS NOT NULL AND (s.stock_on_hand - s.stock_reserved) <= 0');
  if (filter === 'alert') where.push(`s.counted_at IS NOT NULL AND (s.stock_on_hand - s.stock_reserved) <= 0 AND coalesce(s.site_availability, p.availability) = 'in_stock'`);
  const sql = `${SELECT_SKU} WHERE ${where.join(' AND ')} ORDER BY p.name, s.position LIMIT ?`;
  const { results } = await db.prepare(sql.replace(/LIKE \?/g, "LIKE ? ESCAPE '\\'")).bind(...binds, Math.min(Number(limit) || 500, 2000)).all();
  return results.map(decorate);
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
    FROM skus s JOIN products p ON p.id = s.product_id WHERE s.active = 1 AND p.active = 1`).first();
}

function parseQty(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw new InventoryError('數量必須是 0 以上的整數');
  return n;
}

// 執行一次庫存操作。input：{ kind, qty, reason, expected_version, op_id }
export async function adjust(db, sku, input, actor) {
  const kind = input?.kind;
  if (!KINDS[kind]) throw new InventoryError('未知的操作');
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
  const ts = nowIso();
  const needsVersion = kind === 'set' || kind === 'count';
  if (needsVersion && !Number.isInteger(Number(input.expected_version))) throw new InventoryError('缺少版本號（請重新整理頁面）');

  let update;
  if (kind === 'receive') {
    update = db.prepare(`UPDATE skus SET prev_on_hand = stock_on_hand, stock_on_hand = stock_on_hand + ?, version = version + 1, last_op = ?, updated_at = ?
      WHERE sku = ? AND active = 1`).bind(qty, opId, ts, sku);
  } else if (kind === 'issue') {
    update = db.prepare(`UPDATE skus SET prev_on_hand = stock_on_hand, stock_on_hand = stock_on_hand - ?, version = version + 1, last_op = ?, updated_at = ?
      WHERE sku = ? AND active = 1 AND stock_on_hand - ? >= stock_reserved`).bind(qty, opId, ts, sku, qty);
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
