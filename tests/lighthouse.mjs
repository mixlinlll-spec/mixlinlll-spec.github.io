// 手機版 Lighthouse 測試（CI 執行；需要 lighthouse 套件與 Chrome）。
//   python3 -m http.server 8800 --directory dist &
//   node tests/lighthouse.mjs
// 門檻：Accessibility／Best Practices／SEO ≥ 0.90；Performance ≥ 0.90 為目標，低於 0.80 視為失敗、0.80–0.89 只警告
// （CI 虛擬機效能浮動較大，避免偶發誤判）。任一門檻未過時重跑兩次取中位數。報告輸出到 lighthouse-reports/。
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

// 單次 Lighthouse 分數受 CI 機器負載影響；任一門檻未過時再跑 2 次，取三次中位數（與 Lighthouse CI 的 numberOfRuns 做法相同）
function runOnce(p, name, k) {
  const base = path.join(OUT, `${name}${k ? `-run${k + 1}` : ''}`);
  const r = spawnSync(bin, [BASE + p, '--quiet', '--output=json', '--output=html', `--output-path=${base}`,
    '--only-categories=performance,accessibility,best-practices,seo', '--form-factor=mobile',
    '--chrome-flags=--headless=new --no-sandbox --disable-gpu'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const jsonFile = `${base}.report.json`;
  if (r.status !== 0 || !fs.existsSync(jsonFile)) throw new Error(`${p} Lighthouse 執行失敗\n${r.stderr}`);
  const lhr = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  return { sc: Object.fromEntries(Object.entries(lhr.categories).map(([c, v]) => [c, v.score])), lhr };
}
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const passes = sc => Object.entries(STRICT).every(([k, min]) => sc[k] >= min) && sc.performance >= PERF_FAIL;

const rows = [];
let failed = false;
for (const p of PAGES) {
  const name = p.replace(/\//g, '_').replace(/^_|_$/g, '') || 'home';
  let runs;
  try {
    runs = [runOnce(p, name, 0)];
    if (!passes(runs[0].sc)) runs.push(runOnce(p, name, 1), runOnce(p, name, 2));
  } catch (e) { console.error(`✖ ${e.message}`); failed = true; continue; }
  const sc = Object.fromEntries(Object.keys(runs[0].sc).map(k => [k, median(runs.map(r => r.sc[k]))]));
  const issues = [];
  for (const [k, min] of Object.entries(STRICT)) if (sc[k] < min) { issues.push(`${k} ${sc[k]} < ${min}`); failed = true; }
  if (sc.performance < PERF_FAIL) { issues.push(`performance ${sc.performance} < ${PERF_FAIL}`); failed = true; }
  else if (sc.performance < PERF_TARGET) issues.push(`⚠ performance ${sc.performance} 低於目標 ${PERF_TARGET}`);
  if (runs.length > 1) issues.push(`重跑 3 次取中位數（各次 Performance：${runs.map(r => r.sc.performance).join('、')}）`);
  const lhr = runs[0].lhr;
  const M = k => lhr.audits[k]?.displayValue || '';
  const metrics = `FCP ${M('first-contentful-paint')}、LCP ${M('largest-contentful-paint')}、TBT ${M('total-blocking-time')}、CLS ${M('cumulative-layout-shift')}、SI ${M('speed-index')}`;
  if (sc.performance < PERF_TARGET) issues.push(metrics);
  const failedAudits = Object.values(lhr.audits).filter(a => a.score !== null && a.score < 0.9 && a.scoreDisplayMode === 'binary').map(a => a.id);
  rows.push({ p, ...sc, issues: issues.join('；'), failedAudits });
  console.log(`${issues.some(i => / < /.test(i)) ? '✖' : '✓'} ${p}  P ${sc.performance}  A ${sc.accessibility}  BP ${sc['best-practices']}  SEO ${sc.seo}${issues.length ? '  ' + issues.join('；') : ''}${failedAudits.length ? '\n    未通過項目：' + failedAudits.join(', ') : ''}`);
}
const md = ['## Lighthouse（手機）', '', '| 頁面 | Performance | Accessibility | Best Practices | SEO | 備註 |', '|---|---|---|---|---|---|',
  ...rows.map(r => `| ${r.p} | ${r.performance} | ${r.accessibility} | ${r['best-practices']} | ${r.seo} | ${r.issues || ''} |`)].join('\n');
fs.writeFileSync(path.join(OUT, 'summary.md'), md + '\n');
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
// 在 PR 的 Checks 畫面以註記顯示各頁分數
if (process.env.GITHUB_ACTIONS) for (const r of rows) console.log(`::notice title=Lighthouse 手機 ${r.p}::Performance ${r.performance}｜Accessibility ${r.accessibility}｜Best Practices ${r['best-practices']}｜SEO ${r.seo}${r.issues ? '｜' + r.issues : ''}`);
process.exit(failed ? 1 : 0);
