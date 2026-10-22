-- 電翼動力 EWP 線上購物資料庫草案（Cloudflare D1／SQLite 語法）
-- 狀態：規劃稿，尚未建立任何資料庫。金額一律以「新台幣整數元」儲存。
-- 時間一律以 ISO 8601（UTC）文字儲存，顯示時轉台灣時間。

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------
-- 商品與庫存（商品內容仍以 GitHub 的 src/data/products/*.json 為準，
-- 部署時由同步程式寫入；資料庫只存「可交易」所需欄位）
-- ---------------------------------------------------------------
CREATE TABLE products (
  id              TEXT PRIMARY KEY,            -- 與網站相同：sp-<蝦皮商品ID>
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  shopee_item_id  TEXT UNIQUE,                 -- 蝦皮商品 ID（防止重複建立）
  published       INTEGER NOT NULL DEFAULT 0,
  purchasable     INTEGER NOT NULL DEFAULT 1,  -- 0＝只能詢價（例：客製整機）
  updated_at      TEXT NOT NULL
);

CREATE TABLE skus (
  sku                 TEXT PRIMARY KEY,        -- EWP-SP<商品ID>-<規格ID>（見計畫書 §4.2）
  product_id          TEXT NOT NULL REFERENCES products(id),
  shopee_item_id      TEXT,
  shopee_variation_id TEXT,
  variant_name        TEXT,                    -- 單一規格商品為 NULL
  price               INTEGER NOT NULL CHECK (price > 0),
  stock_on_hand       INTEGER NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0),
  stock_reserved      INTEGER NOT NULL DEFAULT 0 CHECK (stock_reserved >= 0),
  active              INTEGER NOT NULL DEFAULT 1,
  updated_at          TEXT NOT NULL,
  UNIQUE (shopee_item_id, shopee_variation_id),
  CHECK (stock_reserved <= stock_on_hand)
);
CREATE INDEX idx_skus_product ON skus(product_id);

-- 每一次庫存變動都留紀錄（對帳、追查超賣）
CREATE TABLE inventory_ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sku         TEXT NOT NULL REFERENCES skus(sku),
  delta_on_hand  INTEGER NOT NULL DEFAULT 0,
  delta_reserved INTEGER NOT NULL DEFAULT 0,
  reason      TEXT NOT NULL CHECK (reason IN ('sync','reserve','release','sale','cancel','refund_restock','manual_adjust')),
  order_id    TEXT REFERENCES orders(id),
  actor       TEXT NOT NULL,                   -- system／admin email
  note        TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_ledger_sku ON inventory_ledger(sku, created_at);

-- ---------------------------------------------------------------
-- 顧客（訪客結帳不需帳號；customer_id 保留給未來會員制度）
-- ---------------------------------------------------------------
CREATE TABLE customers (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE,
  phone       TEXT,
  name        TEXT,
  auth_provider TEXT,                          -- 預留：line／google／email
  created_at  TEXT NOT NULL
);

-- ---------------------------------------------------------------
-- 訂單
-- ---------------------------------------------------------------
CREATE TABLE orders (
  id              TEXT PRIMARY KEY,            -- 內部 UUID
  order_no        TEXT NOT NULL UNIQUE,        -- 顯示給顧客：EWP2610220001
  source          TEXT NOT NULL CHECK (source IN ('cart','quote')),
  quote_id        TEXT REFERENCES quotes(id),
  customer_id     TEXT REFERENCES customers(id),
  status          TEXT NOT NULL CHECK (status IN (
                    'pending_payment',   -- 已建立，等待付款（信用卡）
                    'awaiting_offline',  -- ATM／超商已取號，等待繳費
                    'paid',              -- 後端驗證付款成功
                    'processing',        -- 備貨中
                    'shipped',
                    'completed',
                    'cancelled',         -- 付款前取消
                    'expired',           -- 逾期未付款，自動釋放庫存
                    'payment_failed',
                    'refund_pending',
                    'refunded',
                    'partially_refunded')),
  subtotal        INTEGER NOT NULL,
  shipping_fee    INTEGER NOT NULL DEFAULT 0,
  discount        INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL CHECK (total > 0),
  -- 收件與聯絡（個資：只存出貨必要欄位）
  buyer_name      TEXT NOT NULL,
  buyer_phone     TEXT NOT NULL,
  buyer_email     TEXT NOT NULL,
  ship_method     TEXT NOT NULL,               -- home_delivery／cvs_711／cvs_family／… 由 shipping_methods 定義
  ship_name       TEXT NOT NULL,
  ship_phone      TEXT NOT NULL,
  ship_zip        TEXT,
  ship_address    TEXT,                        -- 宅配用
  ship_store_id   TEXT,                        -- 超商門市（第二階段物流 API）
  ship_store_name TEXT,
  note            TEXT,
  invoice_type    TEXT,                        -- 預留：none／b2c_carrier／b2c_donate／b2b
  invoice_data    TEXT,                        -- 預留：JSON（載具、統編、抬頭）
  lookup_token_hash TEXT NOT NULL,             -- 訂單查詢用 token 的雜湊（明文只寄給顧客）
  reserve_expires_at TEXT,                     -- 庫存保留到期時間
  paid_at         TEXT,
  shipped_at      TEXT,
  tracking_no     TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX idx_orders_status ON orders(status, reserve_expires_at);
CREATE INDEX idx_orders_email ON orders(buyer_email);

CREATE TABLE order_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    TEXT NOT NULL REFERENCES orders(id),
  sku         TEXT REFERENCES skus(sku),       -- 報價單項目可為 NULL
  name        TEXT NOT NULL,                   -- 下單當下的品名快照
  variant_name TEXT,
  unit_price  INTEGER NOT NULL,                -- 下單當下由伺服器決定，不信任前端
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  line_total  INTEGER NOT NULL
);
CREATE INDEX idx_items_order ON order_items(order_id);

-- 狀態變更紀錄（後台稽核）
CREATE TABLE order_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    TEXT NOT NULL REFERENCES orders(id),
  from_status TEXT,
  to_status   TEXT NOT NULL,
  actor       TEXT NOT NULL,                   -- system／ecpay／admin email
  note        TEXT,
  created_at  TEXT NOT NULL
);

-- ---------------------------------------------------------------
-- 付款
-- ---------------------------------------------------------------
-- 每次導向綠界都是一次 attempt（MerchantTradeNo 不可重複，重新付款要新編號）
CREATE TABLE payment_attempts (
  id                TEXT PRIMARY KEY,
  order_id          TEXT NOT NULL REFERENCES orders(id),
  provider          TEXT NOT NULL DEFAULT 'ecpay',
  environment       TEXT NOT NULL CHECK (environment IN ('stage','production')),
  merchant_trade_no TEXT NOT NULL UNIQUE,      -- 綠界：String(20)，英數
  amount            INTEGER NOT NULL,
  choose_payment    TEXT NOT NULL,             -- Credit／ATM／CVS…
  status            TEXT NOT NULL CHECK (status IN ('created','info_issued','paid','failed','expired','cancelled')),
  provider_trade_no TEXT,                      -- 綠界 TradeNo
  payment_type      TEXT,                      -- 綠界回傳 PaymentType
  fee               INTEGER,                   -- PaymentTypeChargeFee
  offline_info      TEXT,                      -- JSON：ATM 帳號／超商代碼與繳費期限
  expires_at        TEXT,
  paid_at           TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX idx_attempts_order ON payment_attempts(order_id);

-- 綠界所有伺服器通知原文（含驗證失敗者），作為稽核與重複通知防護
CREATE TABLE payment_notifications (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  provider          TEXT NOT NULL DEFAULT 'ecpay',
  kind              TEXT NOT NULL CHECK (kind IN ('payment_result','payment_info')),
  merchant_trade_no TEXT,
  provider_trade_no TEXT,
  rtn_code          TEXT,
  simulate_paid     INTEGER,
  mac_valid         INTEGER NOT NULL,
  payload           TEXT NOT NULL,             -- 原始 form 參數 JSON（不含卡號，綠界本來就不回傳卡號）
  dedupe_key        TEXT NOT NULL UNIQUE,      -- kind|MerchantTradeNo|TradeNo|RtnCode|PaymentDate
  processed         INTEGER NOT NULL DEFAULT 0,
  result            TEXT,
  received_at       TEXT NOT NULL
);

CREATE TABLE refunds (
  id                TEXT PRIMARY KEY,
  order_id          TEXT NOT NULL REFERENCES orders(id),
  attempt_id        TEXT NOT NULL REFERENCES payment_attempts(id),
  amount            INTEGER NOT NULL CHECK (amount > 0),
  method            TEXT NOT NULL CHECK (method IN ('ecpay_credit_api','manual_bank_transfer')),
  ecpay_action      TEXT,                      -- C／R／E／N（信用卡請退款 API）
  status            TEXT NOT NULL CHECK (status IN ('requested','succeeded','failed')),
  restock           INTEGER NOT NULL DEFAULT 0,
  reason            TEXT,
  actor             TEXT NOT NULL,
  response          TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- ---------------------------------------------------------------
-- 報價單（客製整機、維修）→ 專屬付款連結
-- ---------------------------------------------------------------
CREATE TABLE quotes (
  id            TEXT PRIMARY KEY,
  quote_no      TEXT NOT NULL UNIQUE,          -- Q2610220001
  title         TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('custom_build','repair','procurement','other')),
  customer_name TEXT NOT NULL,
  customer_contact TEXT NOT NULL,
  total         INTEGER NOT NULL CHECK (total > 0),
  status        TEXT NOT NULL CHECK (status IN ('draft','sent','paid','expired','void')),
  token_hash    TEXT NOT NULL UNIQUE,          -- 付款連結 token 的雜湊
  expires_at    TEXT NOT NULL,
  order_id      TEXT REFERENCES orders(id),
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE TABLE quote_items (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id  TEXT NOT NULL REFERENCES quotes(id),
  sku       TEXT REFERENCES skus(sku),         -- 可引用現有 SKU，也可為自訂項目（工資、零件）
  name      TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  quantity  INTEGER NOT NULL CHECK (quantity > 0),
  reserve_stock INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------
-- 設定與擴充
-- ---------------------------------------------------------------
CREATE TABLE shipping_methods (
  code        TEXT PRIMARY KEY,                -- home_delivery／cvs_711／cvs_family…
  name        TEXT NOT NULL,
  fee         INTEGER NOT NULL,
  free_over   INTEGER,                         -- 滿額免運門檻（NULL＝無）
  provider    TEXT NOT NULL DEFAULT 'manual',  -- manual／ecpay_logistics（第二階段）
  active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE admin_audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor       TEXT NOT NULL,                   -- Cloudflare Access 驗證後的 email
  action      TEXT NOT NULL,
  target      TEXT,
  detail      TEXT,
  ip          TEXT,
  created_at  TEXT NOT NULL
);
