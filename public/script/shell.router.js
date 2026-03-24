(function() {
  var frame   = document.getElementById('content-frame');

  var path   = location.pathname;
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

  // Prefetch forum when starting from index
  if (innerPage === '/index.html') {
    var pf = document.createElement('link');
    pf.rel = 'prefetch'; pf.href = '/forum.html';
    document.head.appendChild(pf);
  }

  frame.src = innerPage;

  frame.addEventListener('load', function() {
    try {
      var loc = frame.contentWindow.location;
      history.replaceState({ innerUrl: loc.pathname + loc.search }, '', '/app' + loc.pathname + loc.search);
      var t = frame.contentDocument && frame.contentDocument.title;
      if (t) document.title = t;
      // Mark page type on body for CSS (rain opacity / z-index)
      var pg = loc.pathname === '/forum.html' ? 'forum' :
               (loc.pathname === '/index.html' || loc.pathname === '/') ? 'index' : 'other';
      document.body.dataset.page = pg;
    } catch(e) {}
    // New page ready — accelerate rain back to full speed
    if (window._rainNavIn) window._rainNavIn();
  });

  window.shellNav = function(url) {
    // Start rain deceleration; if already decelerating (cover exit sent nav_out
    // via postMessage first), _rainNavOut is a no-op so the timer isn't reset.
    if (window._rainNavOut) window._rainNavOut();

    // If rain was already decelerating from a page's own animation, change src
    // immediately; otherwise give a short head-start before loading new content.
    var delay = (window._rainNavOut && frame._navAlreadyOut) ? 0 : 320;
    setTimeout(function() { frame.src = url; }, delay);
    frame._navAlreadyOut = false;
  };

  window.addEventListener('popstate', function(e) {
    if (e.state && e.state.innerUrl) frame.src = e.state.innerUrl;
  });

  // Receive early nav-out signal from iframe (e.g. cover page click before shellNav fires)
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === '_rain_nav_out') {
      if (window._rainNavOut) window._rainNavOut();
      frame._navAlreadyOut = true;
    }
  });
})();
