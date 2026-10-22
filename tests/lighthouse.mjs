// 手機版 Lighthouse 測試（CI 執行；需要 lighthouse 套件與 Chrome）。
//   python3 -m http.server 8800 --directory dist &
//   node tests/lighthouse.mjs
// 門檻：Accessibility／Best Practices／SEO ≥ 0.90；Performance ≥ 0.90 為目標，低於 0.80 視為失敗、0.80–0.89 只警告
// （CI 虛擬機效能浮動較大，避免偶發誤判）。報告輸出到 lighthouse-reports/。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.PUB || 'http://localhost:8800';
const PAGES = ['/', '/products/', '/products/complete-drones/', '/builds/huan/', '/services/repair/', '/batteries/', '/contact/'];
const STRICT = { accessibility: 0.9, 'best-practices': 0.9, seo: 0.9 };
const PERF_FAIL = 0.8, PERF_TARGET = 0.9;
const OUT = 'lighthouse-reports';
fs.mkdirSync(OUT, { recursive: true });
const bin = path.join('node_modules', '.bin', process.platform === 'win32' ? 'lighthouse.cmd' : 'lighthouse');

const rows = [];
let failed = false;
for (const p of PAGES) {
  const name = p.replace(/\//g, '_').replace(/^_|_$/g, '') || 'home';
  const file = path.join(OUT, `${name}.json`);
  const r = spawnSync(bin, [BASE + p, '--quiet', '--output=json', '--output=html', `--output-path=${path.join(OUT, name)}`,
    '--only-categories=performance,accessibility,best-practices,seo', '--form-factor=mobile',
    '--chrome-flags=--headless=new --no-sandbox --disable-gpu'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const jsonFile = fs.existsSync(path.join(OUT, `${name}.report.json`)) ? path.join(OUT, `${name}.report.json`) : file;
  if (r.status !== 0 || !fs.existsSync(jsonFile)) { console.error(`✖ ${p} Lighthouse 執行失敗\n${r.stderr}`); failed = true; continue; }
  const lhr = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  const sc = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, v.score]));
  const issues = [];
  for (const [k, min] of Object.entries(STRICT)) if (sc[k] < min) { issues.push(`${k} ${sc[k]} < ${min}`); failed = true; }
  if (sc.performance < PERF_FAIL) { issues.push(`performance ${sc.performance} < ${PERF_FAIL}`); failed = true; }
  else if (sc.performance < PERF_TARGET) issues.push(`⚠ performance ${sc.performance} 低於目標 ${PERF_TARGET}`);
  const failedAudits = Object.values(lhr.audits).filter(a => a.score !== null && a.score < 0.9 && a.scoreDisplayMode === 'binary').map(a => a.id);
  rows.push({ p, ...sc, issues: issues.join('；'), failedAudits });
  console.log(`${issues.some(i => !i.startsWith('⚠')) ? '✖' : '✓'} ${p}  P ${sc.performance}  A ${sc.accessibility}  BP ${sc['best-practices']}  SEO ${sc.seo}${issues.length ? '  ' + issues.join('；') : ''}${failedAudits.length ? '\n    未通過項目：' + failedAudits.join(', ') : ''}`);
}
const md = ['## Lighthouse（手機）', '', '| 頁面 | Performance | Accessibility | Best Practices | SEO | 備註 |', '|---|---|---|---|---|---|',
  ...rows.map(r => `| ${r.p} | ${r.performance} | ${r.accessibility} | ${r['best-practices']} | ${r.seo} | ${r.issues || ''} |`)].join('\n');
fs.writeFileSync(path.join(OUT, 'summary.md'), md + '\n');
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
// 在 PR 的 Checks 畫面以註記顯示各頁分數
if (process.env.GITHUB_ACTIONS) for (const r of rows) console.log(`::notice title=Lighthouse 手機 ${r.p}::Performance ${r.performance}｜Accessibility ${r.accessibility}｜Best Practices ${r['best-practices']}｜SEO ${r.seo}${r.issues ? '｜' + r.issues : ''}`);
process.exit(failed ? 1 : 0);
