// 故障排除中心：搜尋、解鎖原因查詢、類比畫面三選一、「怎樣算修好」打勾。
// 沒有 JavaScript 時，所有內容（表格、全部分支）照樣顯示。
(() => {
  // ---- 總覽頁：全文搜尋（標題、摘要、關鍵字、內文），不分大小寫、忽略空白與標點，多個詞要同時符合 ----
  const q = document.querySelector('[data-help-search]');
  if (q) {
    const norm = t => t.toLowerCase().normalize('NFKC').replace(/[\s\u3000.,，。、:：;；!！?？()（）「」『』〈〉《》\-_/／|｜'"`~]+/g, '');
    const items = [...document.querySelectorAll('[data-help-item]')].map(li => ({ li, text: norm(li.dataset.text), title: norm(li.querySelector('strong').textContent) }));
    const results = document.querySelector('[data-help-results]'), out = document.querySelector('[data-help-result-list]');
    const browse = [document.querySelector('[data-help-symptoms]'), document.querySelector('[data-help-all]')];
    const empty = document.querySelector('[data-help-empty]');
    const run = () => {
      const terms = q.value.split(/[\s\u3000]+/).map(norm).filter(Boolean);
      const on = terms.length > 0;
      browse.forEach(el => { if (el) el.hidden = on; });
      results.hidden = !on;
      if (!on) { empty.hidden = true; return; }
      const hits = items.filter(it => terms.every(t => it.text.includes(t)))
        .sort((x, y) => terms.filter(t => y.title.includes(t)).length - terms.filter(t => x.title.includes(t)).length);
      out.replaceChildren(...hits.map(it => { const c = it.li.cloneNode(true); c.removeAttribute('data-help-item'); return c; }));
      empty.hidden = hits.length > 0;
    };
    q.addEventListener('input', run);
    const pre = new URLSearchParams(location.search).get('q');
    if (pre) { q.value = pre; run(); }
  }

  // ---- 解鎖原因查詢：名稱逐一對照 Betaflight 官方原始碼 runtime_config.c（4.4、4.5、2025.12、2026.6） ----
  const VERS = ['4.4', '4.5', '2025.12', '2026.6'];
  // [各版本名稱（依 VERS 順序；null＝該版本沒有）, 代表什麼, 下一步, 類型]；類型：ok 可自行處理、adv 交給專業、stop 先停手
  const all = n => [n, n, n, n];
  const FLAGS = [
    [all('MSP'), 'Betaflight App（或舊版 Configurator）正連著飛控，連線時會主動禁止解鎖。這是正常保護，不是故障。', '先處理其他原因。最後在 App 按 Disconnect（中斷連線）就會清除；沒按就直接拔 USB、飛控又同時接著電池時，這個原因會留著，要拔掉電池重新上電。', 'ok'],
    [all('CLI'), '飛控進過命令列（CLI），離開前都不讓解鎖', '在命令列輸入 exit，飛控會重新開機並清除這個原因（沒有 save 的修改會丟掉；要保留就改輸入 save，同樣會重新開機）。exit noreboot 不會清除；直接拔 USB 而電池還接著，也要拔掉電池重新上電。', 'ok'],
    [all('RXLOSS'), '飛控沒有收到有效的遙控訊號', '先看接收機的燈：還沒連上遙控器，或燈恆亮但飛控的連接埠、接收機協定、接線沒設好，都會出現這個字。', 'ok', ['/help/receiver-no-control/', '依接收機燈號排除']],
    [all('THROTTLE'), '油門沒有在最低', '油門拉到底。拉到底仍出現：「接收機」頁的油門數值應低於 1050（預設門檻），不是的話要調整遙控器的油門行程。', 'ok'],
    [all('ANGLE'), '機身太斜', '放平再試（預設傾斜超過 25° 就不讓解鎖）。放平了還是出現：飛機放在平面上做加速度計校正（Betaflight App 2026.6 在 Sensors（感測器）頁按 Calibrate，舊版 Configurator 在 Setup（設定）頁）。', 'ok'],
    [['ARMSWITCH', 'ARMSWITCH', 'ARM_SWITCH', 'ARM_SWITCH'], '不能解鎖的時候，解鎖開關已經在「開」', '先處理其他原因，再把開關撥回「關」、再撥「開」。', 'ok', null, ['ARM_SWITCH']],
    [['BADRX', 'NOT_DISARMED', 'NOT_DISARMED', 'NOT_DISARMED'], '遙控訊號斷掉又恢復時，解鎖開關是開著的', '把解鎖開關撥回「關」。', 'ok', null, ['BAD_RX_RECOVERY']],
    [all('NOPREARM'), '有設定「預解鎖」開關，但沒有先打開', '先打開預解鎖、再解鎖。這是保護功能，不要為了省事取消。', 'ok'],
    [all('CALIB'), '感測器正在校正', '插上電池後不要動飛機，等幾秒。', 'ok'],
    [all('NO_ACC_CAL'), '加速度計需要校正', '飛機放在平面上做加速度計校正（Betaflight App 2026.6 在 Sensors（感測器）頁按 Calibrate，舊版 Configurator 在 Setup（設定）頁）。', 'ok'],
    [all('BOXFAILSAFE'), '「失聯保護」開關是開著的', '把失聯保護開關撥回「關」。', 'ok'],
    [all('BOOTGRACE'), '剛插上電池，還在開機保護時間內', '等幾秒再解鎖。', 'ok'],
    [all('FAILSAFE'), '飛控正處於失聯保護狀態', '先讓遙控器恢復連線；反覆出現請看文末「還是不行？」。', 'ok'],
    [[null, null, 'FLIP_SWITCH', 'FLIP_SWITCH'], '用過翻正（Turtle）功能後，需要先手動上鎖一次', '把解鎖開關撥回「關」，再重新解鎖。', 'ok'],
    [[null, null, 'ALT_HOLD_SW', 'ALT_HOLD_SW'], '「定高」模式開關是開著的', '把定高開關撥回「關」再解鎖。', 'ok'],
    [[null, null, 'POS_HOLD_SW', 'POS_HOLD_SW'], '「定點」模式開關是開著的', '把定點開關撥回「關」再解鎖。', 'ok'],
    [[null, null, null, 'AUTOPILOT_SW'], '「自動駕駛」模式開關是開著的', '把自動駕駛開關撥回「關」再解鎖。', 'ok'],
    [all('RUNAWAY'), '上次解鎖時偵測到「失控衝飛」', '常見原因是馬達順序、旋轉方向或槳裝錯。很危險，先不要再試。', 'stop'],
    [all('CRASH'), '觸發了墜機保護', '上鎖後檢查機身與馬達，再看文末「還是不行？」。', 'stop'],
    [all('NOGYRO'), '飛控偵測不到陀螺儀', '可能是硬體損壞或韌體不符，請看文末「還是不行？」。', 'stop'],
    [['RPMFILTER', 'DSHOT_TELEM', 'DSHOT_TELEM', 'DSHOT_TELEM'], '轉速濾波開著，但電調沒有回傳轉速', '牽涉電調韌體與通訊設定，不屬於新手自行處理的範圍。', 'adv'],
    [all('MOTOR_PROTO'), '沒有設定電調通訊協定', '牽涉電調設定，不屬於新手自行處理的範圍。', 'adv'],
    [all('LOAD'), '飛控運算負載過高', '牽涉進階設定，不屬於新手自行處理的範圍。', 'adv'],
    [all('GPS'), '開了 GPS 返航，但衛星數不夠', '到戶外空曠處等待定位；GPS 返航設定不屬於新手自行處理的範圍。', 'adv'],
    [all('RESCUE_SW'), 'GPS 返航開關是開著的', '把返航開關撥回「關」。', 'adv'],
  ];
  const TAG = { ok: ['可自行處理', 'is-ok'], adv: ['交給專業處理', 'is-adv'], stop: ['先停手', 'is-stop'] };
  const tool = document.querySelector('[data-tool="arming-flags"]');
  if (tool) {
    const list = tool.querySelector('[data-flag-list]'), ans = tool.querySelector('[data-flag-answer]'), input = tool.querySelector('#flag-q');
    const vers = [...tool.querySelectorAll('[data-ver]')];
    let vi = VERS.indexOf(tool.querySelector('[data-ver][aria-pressed="true"]')?.dataset.ver || '4.5'), current = null;
    const nameOf = f => f[0][vi];
    // Betaflight App 2026.6 畫面上有幾個字和韌體名稱不同（App 原始碼 SetupTab.vue：最後一位一律顯示 ARM_SWITCH、NOT_DISARMED 顯示為 BAD_RX_RECOVERY）
    const appNames = f => (f[5] || []).filter(n => n !== nameOf(f));
    const labelOf = f => [nameOf(f), ...appNames(f)].join('／');
    const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const history = f => {
      const parts = [];
      VERS.forEach((v, i) => { const n = f[0][i]; if (!n) return; const last = parts[parts.length - 1]; if (last && last.n === n) last.to = v; else parts.push({ n, from: v, to: v }); });
      if (parts.length === 1 && f[0][0]) return '';
      return parts.map(p => `${p.from === p.to ? p.from : `${p.from}～${p.to}`} 叫 <code>${esc(p.n)}</code>`).join('；') + (f[0][0] ? '' : `（${parts[0].from} 以前沒有）`);
    };
    const renderAnswer = () => {
      if (!current || !nameOf(current)) { ans.innerHTML = '<p class="muted">先選 Betaflight 版本，再點你在畫面上實際看到的字（或直接輸入），這裡會顯示它代表什麼、下一步怎麼做。</p>'; return; }
      const f = current, [label, cls] = TAG[f[3]], h = history(f);
      ans.innerHTML = `<p class="flag-name">${esc(nameOf(f))}<span class="flag-tag ${cls}">${label}</span></p>
        <dl><dt>代表什麼</dt><dd>${esc(f[1])}</dd><dt>下一步</dt><dd${f[3] === 'stop' ? ' class="is-stop"' : ''}>${esc(f[2])}${f[4] ? ` <a href="${f[4][0]}">${esc(f[4][1])} →</a>` : ''}</dd>
        ${appNames(f).length ? `<dt>畫面上的寫法</dt><dd class="muted">Betaflight App 2026.6 的「設定」頁顯示為 <code>${esc(appNames(f).join('、'))}</code>；命令列 status 與 OSD 用的是韌體名稱 <code>${esc(nameOf(f))}</code>。</dd>` : ''}
        ${h ? `<dt>版本差異</dt><dd class="muted">${h}</dd>` : ''}</dl>`;
    };
    const renderList = () => {
      const s = input.value.trim().toUpperCase();
      const hits = FLAGS.filter(f => nameOf(f) && (!s || [...f[0], ...(f[5] || [])].some(n => n && n.includes(s))));
      list.replaceChildren(...hits.map(f => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = labelOf(f);
        b.className = f[3] === 'ok' ? '' : 'is-muted';
        b.setAttribute('aria-pressed', String(f === current));
        b.addEventListener('click', () => { current = f; renderList(); renderAnswer(); });
        return b;
      }));
      if (!hits.length) list.innerHTML = '<p class="muted">這個版本沒有這個字。請檢查拼法或切換版本，也可以在命令列輸入 status 看完整清單。</p>';
      if (s && hits.length === 1 && current !== hits[0]) { current = hits[0]; renderList(); renderAnswer(); }
    };
    vers.forEach(b => b.addEventListener('click', () => {
      vi = VERS.indexOf(b.dataset.ver);
      vers.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      renderList(); renderAnswer();
    }));
    input.addEventListener('input', renderList);
    renderList(); renderAnswer();
  }

  // ---- 類比畫面三選一：選了之後只顯示對應的分支（可再按「顯示全部」） ----
  const screens = document.querySelector('[data-tool="analog-screens"], [data-tool="case-picker"]');
  if (screens) {
    const cases = [...document.querySelectorAll('.help-case')];
    const picks = [...screens.querySelectorAll('[data-pick]')];
    const showAll = document.createElement('button');
    showAll.type = 'button'; showAll.className = 'help-showall'; showAll.textContent = `顯示全部 ${cases.length} 種狀況`; showAll.hidden = true;
    cases[0]?.before(showAll);
    const pick = k => {
      picks.forEach(p => p.setAttribute('aria-pressed', String(p.dataset.pick === k)));
      cases.forEach(c => { c.hidden = k && c.dataset.case !== k; });
      showAll.hidden = !k;
    };
    picks.forEach(p => p.addEventListener('click', e => {
      e.preventDefault();
      pick(p.dataset.pick);
      document.getElementById('case-' + p.dataset.pick.toLowerCase())?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }));
    showAll.addEventListener('click', () => pick(null));
    const h = location.hash.match(/^#case-([a-z])$/);
    if (h) pick(h[1].toUpperCase());
    // 雪花示意
    const cv = screens.querySelector('canvas');
    if (cv) {
      const ctx = cv.getContext('2d');
      const noise = () => {
        const img = ctx.createImageData(cv.width, cv.height);
        for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255 | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
        ctx.putImageData(img, 0, 0);
      };
      noise();
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(noise, 140);
    }
  }

  // ---- 怎樣算修好：全部打勾後顯示完成訊息 ----
  document.querySelectorAll('[data-checks]').forEach(sec => {
    const boxes = [...sec.querySelectorAll('input[type=checkbox]')], done = sec.querySelector('[data-done]');
    boxes.forEach(b => b.addEventListener('change', () => { done.hidden = !boxes.every(x => x.checked); }));
  });
})();
