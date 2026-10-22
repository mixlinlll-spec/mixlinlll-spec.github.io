// 商品列表：關鍵字搜尋、分類／品牌／尺寸／圖傳／電壓／供貨／價格篩選、排序、載入更多。
// 商品卡由建置程式輸出（單一來源），這裡只做顯示／隱藏與排序；篩選狀態同步到網址參數。
(function () {
  'use strict';
  var root = document.getElementById('catalog');
  if (!root) return;
  var PAGE = 24;
  var grid = root.querySelector('.catalog-grid');
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.pcard'));
  var original = cards.slice();
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
  var list = function (card, key) { var v = card.getAttribute('data-' + FACET_ATTR[key]) || ''; return v ? v.split('|') : []; };
  cards.forEach(function (c) { c._search = norm(c.getAttribute('data-search') + ' ' + c.getAttribute('data-name')); });

  var state = { q: '', cat: '', sub: '', brand: '', size: '', video: '', cells: '', avail: '', pmin: '', pmax: '', sort: '' };
  var params = new URLSearchParams(location.search);
  Object.keys(state).forEach(function (k) { state[k] = params.get(k) || ''; });
  shown = Math.max(1, parseInt(params.get('page') || '1', 10)) * PAGE;

  function matches(card, ignore) {
    if (state.cat && ignore !== 'cat' && card.getAttribute('data-cat') !== state.cat) return false;
    if (state.sub && card.getAttribute('data-sub') !== state.sub) return false;
    for (var k in FACET_ATTR) { if (k !== ignore && state[k] && list(card, k).indexOf(state[k]) < 0) return false; }
    if (state.avail && ignore !== 'avail' && card.getAttribute('data-avail') !== state.avail) return false;
    if (state.pmin || state.pmax) {
      var p = parseFloat(card.getAttribute('data-price'));
      if (isNaN(p)) return false;
      if (state.pmin && p < parseFloat(state.pmin)) return false;
      if (state.pmax && p > parseFloat(state.pmax)) return false;
    }
    if (state.q) {
      var terms = norm(state.q).split(/\s+/).filter(Boolean);
      for (var i = 0; i < terms.length; i++) if (card._search.indexOf(terms[i]) < 0) return false;
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
      Array.prototype.forEach.call(sel.options, function (o) {
        if (!o.value) return;
        var n = cards.filter(function (c) { return matches(c, key) && c.getAttribute(key === 'cat' ? 'data-cat' : 'data-avail') === o.value; }).length;
        o.textContent = o.textContent.replace(/（\d+）$/, '') + '（' + n + '）';
        o.disabled = n === 0 && state[key] !== o.value;
      });
      sel.value = state[key];
    });
  }

  function sorter(a, b) {
    var pa = parseFloat(a.getAttribute('data-price')), pb = parseFloat(b.getAttribute('data-price'));
    switch (state.sort) {
      case 'new': return b.getAttribute('data-updated').localeCompare(a.getAttribute('data-updated'));
      case 'price-asc': return (isNaN(pa) ? Infinity : pa) - (isNaN(pb) ? Infinity : pb);
      case 'price-desc': return (isNaN(pb) ? -Infinity : pb) - (isNaN(pa) ? -Infinity : pa);
      case 'name': return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'), 'zh-Hant');
      default: return original.indexOf(a) - original.indexOf(b);
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

  function render() {
    var matched = cards.filter(function (c) { return matches(c); }).sort(sorter);
    matched.forEach(function (c) { grid.appendChild(c); });
    cards.forEach(function (c) { c.hidden = true; });
    matched.slice(0, shown).forEach(function (c) { c.hidden = false; });
    countEl.textContent = cards.length ? '共 ' + matched.length + ' 件商品' : '目前沒有公開商品';
    emptyEl.hidden = matched.length > 0;
    moreBtn.hidden = matched.length <= shown;
    if (!moreBtn.hidden) moreBtn.textContent = '載入更多（還有 ' + (matched.length - shown) + ' 件）';
    chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-sub-chip') === state.sub)); });
    var subInput = document.getElementById('f-sub'); if (subInput) subInput.value = state.sub;
    buildFacets();
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
  // 手機版預設收合篩選面板，結果優先
  var box = root.querySelector('.filters-box');
  if (box && window.matchMedia('(max-width: 900px)').matches && !location.search) box.open = false;

  render();
  if (location.hash === '#catalog-q') { if (box) box.open = true; q.focus(); }
})();
