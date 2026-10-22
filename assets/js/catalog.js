// 商品列表：關鍵字搜尋、分類／品牌／尺寸／圖傳／電壓／供貨／價格篩選、排序、載入更多。
// 商品卡由建置程式輸出（單一來源），這裡只做顯示／隱藏與排序；篩選狀態同步到網址參數。
(function () {
  'use strict';
  var root = document.getElementById('catalog');
  if (!root) return;
  var PAGE = 24;
  var grid = root.querySelector('.catalog-grid');
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.pcard'));
  var form = document.getElementById('catalog-form');
  var q = document.getElementById('catalog-q');
  var sortSel = document.getElementById('f-sort');
  var countEl = document.getElementById('results-count');
  var emptyEl = document.getElementById('catalog-empty');
  var moreBtn = document.getElementById('load-more');
  var chips = Array.prototype.slice.call(root.querySelectorAll('[data-sub-chip]'));
  var facetSelects = Array.prototype.slice.call(form.querySelectorAll('select[data-facet]'));
  var staticSelects = Array.prototype.slice.call(form.querySelectorAll('select[data-static]'));
  var pmin = document.getElementById('f-pmin');
  var pmax = document.getElementById('f-pmax');
  var crumbs = document.querySelector('.crumbs ol');
  var crumbBase = crumbs ? crumbs.innerHTML : '';
  var shown = PAGE;

  var FACET_ATTR = { brand: 'brand', size: 'sizes', video: 'video', cells: 'cells' };
  var norm = function (s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/寸/g, '吋'); };
  // 只讀取一次 data-* 屬性，之後的篩選與計數都在 JS 物件上進行（減少主執行緒負擔）
  cards.forEach(function (c, i) {
    var d = c.dataset;
    c._d = {
      i: i, cat: d.cat, sub: d.sub, avail: d.avail, price: parseFloat(d.price), updated: d.updated, name: d.name,
      f: { brand: d.brand ? [d.brand] : [], size: d.sizes ? d.sizes.split('|') : [], video: d.video ? [d.video] : [], cells: d.cells ? d.cells.split('|') : [] },
      search: null, raw: (d.search || '') + ' ' + (d.name || '')
    };
  });
  var list = function (card, key) { return card._d.f[key]; };
  var searchOf = function (c) { if (c._d.search === null) c._d.search = norm(c._d.raw); return c._d.search; };

  var state = { q: '', cat: '', sub: '', brand: '', size: '', video: '', cells: '', avail: '', pmin: '', pmax: '', sort: '' };
  var params = new URLSearchParams(location.search);
  Object.keys(state).forEach(function (k) { state[k] = params.get(k) || ''; });
  shown = Math.max(1, parseInt(params.get('page') || '1', 10)) * PAGE;

  function matches(card, ignore) {
    var d = card._d;
    if (state.cat && ignore !== 'cat' && d.cat !== state.cat) return false;
    if (state.sub && d.sub !== state.sub) return false;
    for (var k in FACET_ATTR) { if (k !== ignore && state[k] && d.f[k].indexOf(state[k]) < 0) return false; }
    if (state.avail && ignore !== 'avail' && d.avail !== state.avail) return false;
    if (state.pmin || state.pmax) {
      var p = d.price;
      if (isNaN(p)) return false;
      if (state.pmin && p < parseFloat(state.pmin)) return false;
      if (state.pmax && p > parseFloat(state.pmax)) return false;
    }
    if (state.q) {
      var terms = norm(state.q).split(/\s+/).filter(Boolean);
      var hay = searchOf(card);
      for (var i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) < 0) return false;
    }
    return true;
  }

  // 依「其他條件」計算每個篩選器的可選值，避免出現選了就沒有結果的選項
  function buildFacets() {
    facetSelects.forEach(function (sel) {
      var key = sel.getAttribute('data-facet');
      var counts = {};
      cards.forEach(function (c) { if (matches(c, key)) list(c, key).forEach(function (v) { counts[v] = (counts[v] || 0) + 1; }); });
      if (state[key] && !counts[state[key]]) counts[state[key]] = 0;
      var keys = Object.keys(counts).sort(function (a, b) {
        var na = parseFloat(a), nb = parseFloat(b);
        return (!isNaN(na) && !isNaN(nb) && na !== nb) ? na - nb : a.localeCompare(b, 'zh-Hant');
      });
      sel.innerHTML = '<option value="">全部</option>' + keys.map(function (v) {
        return '<option value="' + v.replace(/"/g, '&quot;') + '">' + v.replace(/</g, '&lt;') + '（' + counts[v] + '）</option>';
      }).join('');
      sel.value = state[key];
      var field = sel.closest('.field');
      var hasAny = cards.some(function (c) { return list(c, key).length; });
      if (field) field.hidden = !hasAny;
    });
    staticSelects.forEach(function (sel) {
      var key = sel.name;
      var counts = {};
      cards.forEach(function (c) { if (matches(c, key)) { var v = c._d[key]; counts[v] = (counts[v] || 0) + 1; } });
      Array.prototype.forEach.call(sel.options, function (o) {
        if (!o.value) return;
        var n = counts[o.value] || 0;
        o.textContent = o.textContent.replace(/（\d+）$/, '') + '（' + n + '）';
        o.disabled = n === 0 && state[key] !== o.value;
      });
      sel.value = state[key];
    });
  }

  function sorter(a, b) {
    var pa = a._d.price, pb = b._d.price;
    switch (state.sort) {
      case 'new': return b._d.updated.localeCompare(a._d.updated) || a._d.i - b._d.i;
      case 'price-asc': return (isNaN(pa) ? Infinity : pa) - (isNaN(pb) ? Infinity : pb) || a._d.i - b._d.i;
      case 'price-desc': return (isNaN(pb) ? -Infinity : pb) - (isNaN(pa) ? -Infinity : pa) || a._d.i - b._d.i;
      case 'name': return a._d.name.localeCompare(b._d.name, 'zh-Hant');
      default: return a._d.i - b._d.i;
    }
  }

  function syncUrl() {
    var p = new URLSearchParams();
    Object.keys(state).forEach(function (k) { if (state[k]) p.set(k, state[k]); });
    if (shown > PAGE) p.set('page', String(Math.ceil(shown / PAGE)));
    var qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  function updateCrumbs() {
    if (!crumbs || !root.getAttribute('data-scope')) return;
    crumbs.innerHTML = crumbBase;
    var chip = chips.filter(function (c) { return c.getAttribute('data-sub-chip') === state.sub; })[0];
    if (!state.sub || !chip) return;
    var last = crumbs.lastElementChild;
    last.removeAttribute('aria-current');
    last.innerHTML = '<a href="' + location.pathname + '">' + last.textContent + '</a>';
    var li = document.createElement('li');
    li.setAttribute('aria-current', 'page');
    li.textContent = chip.textContent;
    crumbs.appendChild(li);
  }

  var domOrder = cards.slice();
  function render(deferFacets) {
    var matched = cards.filter(function (c) { return matches(c); }).sort(sorter);
    // 只有順序真的改變時才搬移 DOM 節點
    var order = matched.concat(domOrder.filter(function (c) { return matched.indexOf(c) < 0; }));
    if (order.some(function (c, i) { return c !== domOrder[i]; })) { order.forEach(function (c) { grid.appendChild(c); }); domOrder = order; }
    var show = new Set(matched.slice(0, shown));
    cards.forEach(function (c) { var h = !show.has(c); if (c.hidden !== h) c.hidden = h; });
    countEl.textContent = cards.length ? '共 ' + matched.length + ' 件商品' : '目前沒有公開商品';
    emptyEl.hidden = matched.length > 0;
    moreBtn.hidden = matched.length <= shown;
    if (!moreBtn.hidden) moreBtn.textContent = '載入更多（還有 ' + (matched.length - shown) + ' 件）';
    chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-sub-chip') === state.sub)); });
    var subInput = document.getElementById('f-sub'); if (subInput) subInput.value = state.sub;
    // 首次載入時把篩選器選項計算延後到瀏覽器空閒時，避免阻塞首屏
    if (deferFacets) (window.requestIdleCallback || function (f) { return setTimeout(f, 200); })(buildFacets); else buildFacets();
    updateCrumbs();
    syncUrl();
  }

  function fromForm() {
    state.q = q.value.trim();
    facetSelects.concat(staticSelects).forEach(function (s) { state[s.name] = s.value; });
    state.pmin = pmin.value; state.pmax = pmax.value; state.sort = sortSel.value;
    shown = PAGE;
    render();
  }

  // 初始值
  q.value = state.q; pmin.value = state.pmin; pmax.value = state.pmax; sortSel.value = state.sort;

  var t;
  q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(fromForm, 150); });
  form.addEventListener('change', fromForm);
  sortSel.addEventListener('change', fromForm);
  chips.forEach(function (c) { c.addEventListener('click', function () { state.sub = c.getAttribute('data-sub-chip'); shown = PAGE; render(); }); });
  moreBtn.addEventListener('click', function () {
    var firstNew = shown;
    shown += PAGE; render();
    var next = cards.filter(function (c) { return !c.hidden; })[firstNew];
    if (next) { var a = next.querySelector('a'); if (a) a.focus({ preventScroll: false }); }
  });
  root.querySelectorAll('[data-reset]').forEach(function (b) {
    b.addEventListener('click', function () {
      Object.keys(state).forEach(function (k) { state[k] = ''; });
      q.value = ''; pmin.value = ''; pmax.value = ''; sortSel.value = ''; shown = PAGE;
      render(); q.focus();
    });
  });
  // 手機版篩選面板：預設由 CSS 收合（不靠 JS 隱藏，避免版面位移），按鈕切換；有篩選條件時自動展開
  var box = document.getElementById('filters-box');
  var toggle = root.querySelector('.filters-toggle');
  function setBox(open) {
    box.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('span').textContent = open ? '－' : '＋';
  }
  if (toggle) toggle.addEventListener('click', function () { setBox(!box.classList.contains('open')); });
  var hasFilter = ['q', 'brand', 'size', 'video', 'cells', 'avail', 'pmin', 'pmax', 'cat'].some(function (k) { return state[k]; });

  render(!hasFilter);
  if (hasFilter) setBox(true);
  if (location.hash === '#catalog-q') { setBox(true); q.focus(); }
})();
