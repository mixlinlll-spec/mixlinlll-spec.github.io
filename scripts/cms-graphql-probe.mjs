#!/usr/bin/env node
// 以 Pages CMS 2.1.8 的同一個 GraphQL 查詢讀取商品資料夾，回報成功與否、筆數、容量、耗時（只讀取）。
// 由 .github/workflows/cms-graphql-probe.yml 執行；結果寫入 Actions 摘要。
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const token = process.env.GH_TOKEN;
const [owner, repo] = (process.env.GITHUB_REPOSITORY || 'mixlinlll-spec/mixlinlll-spec.github.io').split('/');
const branch = process.env.GITHUB_REF_NAME || 'feature/product-admin';
let paths = (process.env.PATHS || '').split(/\s+/).filter(Boolean);
if (!paths.length) {
  // 預設：商品資料夾本身＋其下每個子資料夾
  const dirs = execFileSync('git', ['ls-tree', '-d', '--name-only', 'HEAD', 'src/data/products/'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  paths = ['src/data/products', ...dirs];
}
const query = `
  query ($owner: String!, $repo: String!, $expression: String!) {
    repository(owner: $owner, name: $repo) {
      object(expression: $expression) {
        ... on Tree { entries { name path type object { ... on Blob { text oid byteSize } } } }
      }
    }
  }`;
const lines = ['## Pages CMS GraphQL 讀取測試', '', `分支 \`${branch}\``, '', '| 資料夾 | 結果 | 檔案數 | JSON 檔 | 內容總量 | text 為空 | 耗時 |', '|---|---|---|---|---|---|---|'];
let failed = 0;
for (const p of paths) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t0 = Date.now();
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { owner, repo, expression: `${branch}:${p}` } }),
    });
    const ms = Date.now() - t0;
    let body; try { body = await res.json(); } catch { body = { errors: [{ message: `HTTP ${res.status}（非 JSON）` }] }; }
    if (body.errors || !res.ok) {
      lines.push(`| ${p} | ✖ 第 ${attempt} 次：${(body.errors?.[0]?.message || res.status).toString().slice(0, 80)} | | | | | ${ms} ms |`);
      if (attempt === 3) failed++;
      continue;
    }
    const entries = body.data?.repository?.object?.entries || [];
    const blobs = entries.filter(e => e.type === 'blob');
    const json = blobs.filter(e => e.name.endsWith('.json'));
    const bytes = blobs.reduce((a, e) => a + (e.object?.byteSize || 0), 0);
    const nullText = blobs.filter(e => e.object && e.object.text == null).length;
    lines.push(`| ${p} | ✓${attempt > 1 ? `（第 ${attempt} 次）` : ''} | ${entries.length} | ${json.length} | ${(bytes / 1024).toFixed(0)} KB | ${nullText} | ${ms} ms |`);
    break;
  }
}
const md = lines.join('\n') + '\n';
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
// 診斷工具：結果寫在摘要，失敗也以 annotation 提示
if (failed) console.log(`::warning::${failed} 個資料夾無法一次讀取`);
for (const l of lines.slice(4)) console.log(`::notice::${l.replace(/\|/g, ' ').trim()}`);
