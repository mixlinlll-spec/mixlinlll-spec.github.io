-- EWP 私有庫存資料庫（Cloudflare D1）
-- （本檔在正式環境套用前修訂過：加入 variant_ref 與移轉紀錄；正式 D1 只會從這個版本開始）
-- 商品清單（名稱、規格、官網供貨狀態）由 GitHub 公開商品資料同步而來；
-- 庫存數字只存在這裡，不會出現在 GitHub。

CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY,            -- sp-<蝦皮商品ID>（與 src/data/products 相同）
  name            TEXT NOT NULL,
  slug            TEXT,
  brand           TEXT,
  shopee_item_id  TEXT,
  availability    TEXT,                        -- 官網供貨狀態（同步自商品資料）
  published       INTEGER NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1,  -- 0＝商品資料已不存在（保留庫存紀錄）
  synced_at       TEXT
);

CREATE TABLE IF NOT EXISTS skus (
  sku                 TEXT PRIMARY KEY,        -- 建立後不變：EWP-SP<蝦皮商品ID>-<蝦皮規格ID>／-<規格 key>／單一規格 -0
  product_id          TEXT NOT NULL REFERENCES products(id),
  variant_ref         TEXT,                    -- 規格身分（不因改名、排序改變）：sv:<蝦皮規格ID>／k:<規格 key>／single
  variant_name        TEXT,                    -- 單一規格商品為 NULL
  position            INTEGER NOT NULL DEFAULT 0,
  shopee_item_id      TEXT,
  shopee_variation_id TEXT,
  site_availability   TEXT,                    -- 官網該規格的供貨狀態（同步）
  active              INTEGER NOT NULL DEFAULT 1,
  stock_on_hand       INTEGER NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0),   -- 實際庫存
  stock_reserved      INTEGER NOT NULL DEFAULT 0 CHECK (stock_reserved >= 0),  -- 已保留（未來訂單用）
  version             INTEGER NOT NULL DEFAULT 0,                              -- 樂觀鎖
  prev_on_hand        INTEGER,                                                 -- 最近一次修改前的數量（寫紀錄用）
  last_op             TEXT,                                                    -- 最近一次操作 ID（寫紀錄用）
  snapshot_qty        INTEGER,                 -- 2026-10-22 蝦皮匯出的舊快照（僅供盤點參考，不是庫存）
  snapshot_at         TEXT,
  counted_at          TEXT,                    -- 最近一次盤點確認時間（NULL＝尚未盤點）
  counted_by          TEXT,
  updated_at          TEXT,
  CHECK (stock_reserved <= stock_on_hand)
);
CREATE INDEX IF NOT EXISTS idx_skus_product ON skus(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_skus_ref ON skus(product_id, variant_ref);

-- 每一次庫存變動都留紀錄（操作者、時間、數量變化、原因）
CREATE TABLE IF NOT EXISTS inventory_ledger (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  op_id           TEXT NOT NULL UNIQUE,        -- 防止重複送出（同一操作只記一次）
  sku             TEXT NOT NULL REFERENCES skus(sku),
  kind            TEXT NOT NULL CHECK (kind IN ('receive','issue','set','count','transfer_out','transfer_in','reserve','release','sale','cancel')),
  before_on_hand  INTEGER NOT NULL,
  after_on_hand   INTEGER NOT NULL,
  delta_on_hand   INTEGER NOT NULL,
  delta_reserved  INTEGER NOT NULL DEFAULT 0,
  reason          TEXT NOT NULL,
  actor           TEXT NOT NULL,               -- Cloudflare Access 登入的 Email
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_sku ON inventory_ledger(sku, id);

-- 移轉的完整性檢查：與移轉的四個語句在同一個交易中寫入；transfer_complete 必須為 1，否則整筆回復
CREATE TABLE IF NOT EXISTS transfer_guard (
  op_id             TEXT PRIMARY KEY,
  from_sku          TEXT NOT NULL,
  to_sku            TEXT NOT NULL,
  qty               INTEGER NOT NULL,
  created_at        TEXT NOT NULL,
  transfer_complete INTEGER NOT NULL CHECK (transfer_complete = 1)
);
