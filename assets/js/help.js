// 故障排除中心：搜尋、解鎖原因查詢、類比畫面三選一、「怎樣算修好」打勾。
// 沒有 JavaScript 時，所有內容（表格、全部分支）照樣顯示。
(() => {
  // ---- 總覽頁：依症狀搜尋 ----
  const q = document.querySelector('[data-help-search]');
  if (q) {
    const items = [...document.querySelectorAll('[data-help-item]')];
    const groups = [...document.querySelectorAll('[data-help-group]')];
    const empty = document.querySelector('[data-help-empty]');
    q.addEventListener('input', () => {
      const s = q.value.trim().toLowerCase();
      let n = 0;
      for (const li of items) { const hit = !s || li.dataset.text.toLowerCase().includes(s); li.hidden = !hit; if (hit) n++; }
      for (const g of groups) g.hidden = !g.querySelector('[data-help-item]:not([hidden])');
      if (empty) empty.hidden = n > 0;
    });
  }

  // ---- 解鎖原因查詢：名稱對照 Betaflight 4.4／4.5 官方原始碼（runtime_config.c） ----
  // [4.4 名稱, 4.5 名稱, 代表什麼, 下一步, 類型]；類型：ok 可自行處理、adv 交給專業、stop 先停手
  const FLAGS = [
    ['MSP', 'MSP', '電腦的 Configurator 還連著', '斷開連線或拔掉 USB。這是正常保護，不是故障。', 'ok'],
    ['CLI', 'CLI', '飛控停在命令列模式', '離開命令列或拔掉 USB。', 'ok'],
    ['RXLOSS', 'RXLOSS', '飛控收不到遙控器訊號', '到「接收機」頁撥搖桿；數值沒有跟著動，就是遙控器和接收機沒有連上。', 'ok'],
    ['THROTTLE', 'THROTTLE', '油門沒有在最低', '油門拉到底。拉到底仍出現：「接收機」頁的油門數值應低於 1050（預設門檻），不是的話要調整遙控器的油門行程。', 'ok'],
    ['ANGLE', 'ANGLE', '機身太斜', '放平再試（預設傾斜超過 25° 就不讓解鎖）。放平了還是出現：飛機放在平面上，到「設定」頁做加速度計校正。', 'ok'],
    ['ARMSWITCH', 'ARMSWITCH', '不能解鎖的時候，解鎖開關已經在「開」', '先處理其他原因，再把開關撥回「關」、再撥「開」。', 'ok'],
    ['BADRX', 'NOT_DISARMED', '遙控訊號斷掉又恢復時，解鎖開關是開著的', '把解鎖開關撥回「關」。', 'ok'],
    ['NOPREARM', 'NOPREARM', '有設定「預解鎖」開關，但沒有先打開', '先打開預解鎖、再解鎖。這是保護功能，不要為了省事取消。', 'ok'],
    ['CALIB', 'CALIB', '感測器正在校正', '插上電池後不要動飛機，等幾秒。', 'ok'],
    ['NO_ACC_CAL', 'NO_ACC_CAL', '加速度計需要校正', '飛機放在平面上，到「設定」頁按校正。', 'ok'],
    ['BOXFAILSAFE', 'BOXFAILSAFE', '「失聯保護」開關是開著的', '把失聯保護開關撥回「關」。', 'ok'],
    ['BOOTGRACE', 'BOOTGRACE', '剛插上電池，還在開機保護時間內', '等幾秒再解鎖。', 'ok'],
    ['FAILSAFE', 'FAILSAFE', '飛控正處於失聯保護狀態', '先讓遙控器恢復連線；反覆出現請看文末「還是不行？」。', 'ok'],
    ['RUNAWAY', 'RUNAWAY', '上次解鎖時偵測到「失控衝飛」', '常見原因是馬達順序、旋轉方向或槳裝錯。很危險，先不要再試。', 'stop'],
    ['CRASH', 'CRASH', '觸發了墜機保護', '上鎖後檢查機身與馬達，再看文末「還是不行？」。', 'stop'],
    ['NOGYRO', 'NOGYRO', '飛控偵測不到陀螺儀', '可能是硬體損壞或韌體不符，請看文末「還是不行？」。', 'stop'],
    ['RPMFILTER', 'DSHOT_TELEM', '轉速濾波開著，但電調沒有回傳轉速', '牽涉電調韌體與通訊設定，不屬於新手自行處理的範圍。', 'adv'],
    ['MOTOR_PROTO', 'MOTOR_PROTO', '沒有設定電調通訊協定', '牽涉電調設定，不屬於新手自行處理的範圍。', 'adv'],
    ['LOAD', 'LOAD', '飛控運算負載過高', '牽涉進階設定，不屬於新手自行處理的範圍。', 'adv'],
    ['GPS', 'GPS', '開了 GPS 返航，但衛星數不夠', '到戶外空曠處等待定位；GPS 返航設定不屬於新手自行處理的範圍。', 'adv'],
    ['RESCUE_SW', 'RESCUE_SW', 'GPS 返航開關是開著的', '把返航開關撥回「關」。', 'adv'],
  ];
  const TAG = { ok: ['可自行處理', 'is-ok'], adv: ['交給專業處理', 'is-adv'], stop: ['先停手', 'is-stop'] };
  const tool = document.querySelector('[data-tool="arming-flags"]');
  if (tool) {
    const list = tool.querySelector('[data-flag-list]'), ans = tool.querySelector('[data-flag-answer]'), input = tool.querySelector('#flag-q');
    const vers = [...tool.querySelectorAll('[data-ver]')];
    let ver = '4.5', current = FLAGS[2];
    const nameOf = f => (ver === '4.4' ? f[0] : f[1]);
    const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const renderAnswer = () => {
      if (!current) { ans.innerHTML = '<p class="muted">點一個字，這裡會顯示它代表什麼、下一步怎麼做。</p>'; return; }
      const f = current, [label, cls] = TAG[f[4]];
      ans.innerHTML = `<p class="flag-name">${esc(nameOf(f))}<span class="flag-tag ${cls}">${label}</span></p>
        <dl><dt>代表什麼</dt><dd>${esc(f[2])}</dd><dt>下一步</dt><dd${f[4] === 'stop' ? ' class="is-stop"' : ''}>${esc(f[3])}</dd>
        ${f[0] !== f[1] ? `<dt>版本差異</dt><dd class="muted">4.4 叫 <code>${f[0]}</code>，4.5 叫 <code>${f[1]}</code></dd>` : ''}</dl>`;
    };
    const renderList = () => {
      const s = input.value.trim().toUpperCase();
      const hits = FLAGS.filter(f => !s || f[0].includes(s) || f[1].includes(s));
      list.replaceChildren(...hits.map(f => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = nameOf(f);
        b.className = f[4] === 'ok' ? '' : 'is-muted';
        b.setAttribute('aria-pressed', String(f === current));
        b.addEventListener('click', () => { current = f; renderList(); renderAnswer(); });
        return b;
      }));
      if (!hits.length) list.innerHTML = '<p class="muted">找不到這個字。請檢查拼法，或在命令列輸入 status 看完整清單。</p>';
      if (s && hits.length === 1 && current !== hits[0]) { current = hits[0]; renderList(); renderAnswer(); }
    };
    vers.forEach(b => b.addEventListener('click', () => {
      ver = b.dataset.ver;
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
    showAll.type = 'button'; showAll.className = 'help-showall'; showAll.textContent = '顯示全部三種狀況'; showAll.hidden = true;
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
