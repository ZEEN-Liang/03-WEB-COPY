(function() {
  var frame   = document.getElementById('content-frame');
  var loading = document.getElementById('frame-loading');
  var loadTimer;

  // Determine initial page from URL
  var path   = location.pathname;  // e.g. /app  or  /app/article.html
  var search = location.search;
  var hash   = location.hash;

  var innerPage;
  if (path === '/' || path === '') {
    innerPage = '/index.html';
  } else if (path === '/login') {
    innerPage = '/login.html' + search + hash;
  } else if (path === '/app' || path === '/app/') {
    innerPage = '/forum.html' + search + hash;
  } else if (path.startsWith('/app/')) {
    innerPage = path.slice(4) + search + hash;
  } else {
    innerPage = '/index.html';
  }

  // Set src once
  frame.src = innerPage;

  // On each iframe load: hide loader, sync URL bar & title
  frame.addEventListener('load', function() {
    clearTimeout(loadTimer);
    loading.classList.remove('show');
    try {
      var loc = frame.contentWindow.location;
      history.replaceState({ innerUrl: loc.pathname + loc.search }, '', '/app' + loc.pathname + loc.search);
      var t = frame.contentDocument && frame.contentDocument.title;
      if (t) document.title = t;
    } catch(e) {}
  });

  // Called by nav-intercept.js inside iframe to navigate
  window.shellNav = function(url) {
    clearTimeout(loadTimer);
    loadTimer = setTimeout(function() { loading.classList.add('show'); }, 60);
    frame.src = url;
  };

  // Sync iframe sidebar push with player open/close state
  // player.js sets body.fp-open; we mirror it to the iframe left offset
  // Player is now a floating widget — no iframe resizing needed

  // Browser back/forward
  window.addEventListener('popstate', function(e) {
    if (e.state && e.state.innerUrl) frame.src = e.state.innerUrl;
  });
})();
