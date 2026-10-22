// 商品詳情：圖片縮圖切換。
(function () {
  'use strict';
  var g = document.querySelector('[data-gallery]');
  if (!g) return;
  var main = g.querySelector('.gallery-main img');
  var source = g.querySelector('.gallery-main source');
  g.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-src]');
    if (!b || !main) return;
    if (source) source.remove(), source = null;
    main.removeAttribute('srcset');
    main.src = b.getAttribute('data-src');
    main.alt = b.getAttribute('data-alt');
    g.querySelectorAll('button[data-src]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
  });
})();
