// 測試用商品資料：複製目前的商品資料；沒有蝦皮規格 ID 也沒有 key 的規格補上固定 key（與商品後台 PR #4 相同）
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
export function makeFixture(root, mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-products-'));
  let n = 0;
  for (const f of fs.readdirSync(path.join(root, 'src/data/products')).sort()) {
    const p = JSON.parse(fs.readFileSync(path.join(root, 'src/data/products', f), 'utf8'));
    for (const v of p.variants || []) if (!v.shopee_variation_id && !v.key) v.key = 'v-' + (0xa0000000 + ++n).toString(16);
    fs.writeFileSync(path.join(dir, f), JSON.stringify(p, null, 2) + '\n');
  }
  if (mutate) mutate(dir);
  return dir;
}
