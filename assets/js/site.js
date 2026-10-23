// 全站導覽：手機選單、商品 mega menu、更多選單。
(function () {
  'use strict';
  var menuBtn = document.querySelector('.menu-btn');
  var drawer = document.getElementById('drawer');
  var megaBtn = document.querySelector('.mega-toggle');
  var mega = document.getElementById('mega-products');
  var hasMega = document.querySelector('.has-mega');
  var moreBtn = document.querySelector('.more-toggle');
  var moreMenu = document.getElementById('more-menu');

  function setDrawer(open) {
    if (!menuBtn || !drawer) return;
    menuBtn.setAttribute('aria-expanded', String(open));
    drawer.hidden = !open;
    menuBtn.querySelector('.menu-label').textContent = open ? '關閉' : '選單';
    document.body.style.overflow = open ? 'hidden' : '';
  }
  function setMega(open) {
    if (!megaBtn || !mega) return;
    megaBtn.setAttribute('aria-expanded', String(open));
    mega.classList.toggle('open', open);
  }
  function setMore(open) {
    if (!moreBtn || !moreMenu) return;
    moreBtn.setAttribute('aria-expanded', String(open));
    moreMenu.hidden = !open;
  }

  if (menuBtn) menuBtn.addEventListener('click', function () { setDrawer(menuBtn.getAttribute('aria-expanded') !== 'true'); });
  var hoverOpenedAt = 0;
  if (megaBtn) megaBtn.addEventListener('click', function (e) {
    e.stopPropagation(); setMore(false);
    // 滑鼠剛移入就點擊時，維持開啟，避免「移入開啟→點擊關閉」閃爍
    if (Date.now() - hoverOpenedAt < 500) { setMega(true); return; }
    setMega(megaBtn.getAttribute('aria-expanded') !== 'true');
  });
  if (moreBtn) moreBtn.addEventListener('click', function (e) { e.stopPropagation(); setMega(false); setMore(moreBtn.getAttribute('aria-expanded') !== 'true'); });

  // 桌機滑鼠移入時開啟 mega menu（鍵盤與觸控使用按鈕）
  var hoverTimer;
  if (hasMega && mega && window.matchMedia('(hover: hover)').matches) {
    [hasMega, mega].forEach(function (el) {
      el.addEventListener('mouseenter', function () { clearTimeout(hoverTimer); if (!mega.classList.contains('open')) hoverOpenedAt = Date.now(); setMega(true); });
      el.addEventListener('mouseleave', function () { hoverTimer = setTimeout(function () { setMega(false); }, 180); });
    });
  }

  document.addEventListener('click', function (e) {
    if (mega && mega.classList.contains('open') && !mega.contains(e.target) && !(hasMega && hasMega.contains(e.target))) setMega(false);
    if (moreMenu && !moreMenu.hidden && !moreMenu.contains(e.target)) setMore(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (mega && mega.classList.contains('open')) { setMega(false); megaBtn.focus(); }
    if (moreMenu && !moreMenu.hidden) { setMore(false); moreBtn.focus(); }
    if (drawer && !drawer.hidden) { setDrawer(false); menuBtn.focus(); }
  });
  window.addEventListener('resize', function () {
    if (window.innerWidth >= 1180 && drawer && !drawer.hidden) setDrawer(false);
  });
})();

// 首頁 YouTube 影片：點擊封面才載入播放器（youtube-nocookie、播完只推薦同頻道），沒有 JavaScript 時是一般 YouTube 連結
(function () {
  'use strict';
  var links = document.querySelectorAll('a.yt-lite[data-yt]');
  Array.prototype.forEach.call(links, function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      var id = a.getAttribute('data-yt');
      if (!/^[\w-]{6,20}$/.test(id)) return;
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&playsinline=1&modestbranding=1';
      f.title = a.getAttribute('data-title') || 'YouTube 影片';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      f.className = 'yt-iframe';
      a.replaceWith(f);
      f.focus();
    });
  });
})();
