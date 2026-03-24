// ── 风蓝轻音部 · Shell 导航拦截器 ────────────────────────────
// 只在 iframe 内部运行，把站内链接交给 shell 父页面的 shellNav 处理
// 直接访问内容页时本文件直接退出，不做任何操作
(function () {

  function inShell() {
    try { return window.parent !== window && typeof window.parent.shellNav === 'function'; }
    catch(e) { return false; }
  }

  // 不在 shell 内 → 直接退出，页面正常工作
  if (!inShell()) return;

  // Paths that must load in window.top (not iframe)
  var TOP_LEVEL = ['/', '/cover'];  // /login now loads inside shell iframe
  var SKIP_EXT = ['.pdf','.zip','.mp3','.flac','.wav','.jpg','.png'];

  function getTarget(href) {
    // Returns 'top', 'shell', or null (don't intercept external)
    if (!href || href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto')) return null;
    try {
      var u = new URL(href, location.href);
      if (u.hostname !== location.hostname) return null;
      var p = u.pathname;
      if (SKIP_EXT.some(function(e){ return p.endsWith(e); })) return null;
      if (TOP_LEVEL.includes(p)) return 'top';
      return 'shell';
    } catch(e) { return null; }
  }

  // Intercept all <a> clicks
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a[href]');
    if (!a || a.target === '_blank') return;
    var target = getTarget(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    var u = new URL(a.getAttribute('href'), location.href);
    var url = u.pathname + u.search + u.hash;
    if (target === 'top') {
      window.top.location.href = url;
    } else {
      window.parent.shellNav(url);
    }
  }, true);

  // Expose navigate() for JS-driven navigation in content pages
  window.navigate = function(url) {
    if (!url) return;
    try {
      var u = new URL(url, location.href);
      var target = getTarget(u.href);
      if (!target || target === 'top') {
        window.top.location.href = u.pathname + u.search + u.hash;
      } else {
        window.parent.shellNav(u.pathname + u.search + u.hash);
      }
    } catch(e) { window.parent.shellNav(url); }
  };

  // Update parent title
  var titleEl = document.querySelector('title');
  if (titleEl) {
    try { window.parent.document.title = titleEl.textContent; } catch(e) {}
    new MutationObserver(function() {
      try { window.parent.document.title = titleEl.textContent; } catch(e) {}
    }).observe(titleEl, { childList: true });
  }

})();
