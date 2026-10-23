// 測試用：以 Node 內建 SQLite 模擬 Cloudflare D1 的 API（prepare／bind／first／all／run／batch）。
// batch 與 D1 相同：在單一交易內執行，任一語句失敗就整批回復。
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

class Stmt {
  constructor(db, sql, params = []) { this.db = db; this.sql = sql; this.params = params; }
  bind(...params) { return new Stmt(this.db, this.sql, params); }
  _run() {
    const st = this.db.prepare(this.sql);
    if (/^\s*(SELECT|WITH)\b/i.test(this.sql) || /\bRETURNING\b/i.test(this.sql)) return { results: st.all(...this.params), meta: { changes: 0 } };
    const r = st.run(...this.params);
    return { results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  async first(col) { const r = this.db.prepare(this.sql).get(...this.params); return r == null ? null : col ? r[col] : { ...r }; }
  async all() { const r = this._run(); return { results: r.results.map(x => ({ ...x })), success: true, meta: r.meta }; }
  async run() { const r = this._run(); return { success: true, meta: r.meta }; }
}

export function createD1(migrationFiles = []) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of migrationFiles) db.exec(fs.readFileSync(f, 'utf8'));
  let queue = Promise.resolve();
  return {
    raw: db,
    prepare: sql => new Stmt(db, sql),
    exec: async sql => db.exec(sql),
    // D1 同時只有一個寫入者：以佇列模擬，batch 在交易內執行
    batch: stmts => {
      const run = queue.then(() => {
        db.exec('BEGIN');
        try { const out = stmts.map(s => s._run()); db.exec('COMMIT'); return out.map(o => ({ success: true, results: o.results, meta: o.meta })); }
        catch (e) { db.exec('ROLLBACK'); throw e; }
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}
