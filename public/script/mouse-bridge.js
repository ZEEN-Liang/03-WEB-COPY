// Forwards mouse position and title rect from iframe to shell parent for rain interaction.
(function() {
  if (window === window.top) return;

  document.addEventListener('mousemove', function(e) {
    window.parent.postMessage({ type: '_rain_mouse', x: e.clientX, y: e.clientY }, '*');
  });
  document.addEventListener('mouseleave', function() {
    window.parent.postMessage({ type: '_rain_mouse_leave' }, '*');
  });

  // Forward title bounding rect so shell rain-engine can apply time-stop / collision effect.
  // The title has a CSS animation (fade-up: translateY(24px)→0, 0.5s delay + 1s duration).
  // getBoundingClientRect() reflects the current animated position, so we track via rAF for
  // the first 2 s to keep the collision zone live while the title animates into place.
  function postTitleRect() {
    var el = document.querySelector('.main-title');
    if (el) {
      var r = el.getBoundingClientRect();
      window.parent.postMessage({ type: '_rain_title_rect',
        rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom,
                width: r.width, height: r.height } }, '*');
    } else {
      window.parent.postMessage({ type: '_rain_title_clear' }, '*');
    }
  }

  // Track every frame for 2 s so the rect stays accurate during the fade-up animation
  var _trackUntil = performance.now() + 2000;
  function trackTitleRect(now) {
    postTitleRect();
    if (now < _trackUntil) requestAnimationFrame(trackTitleRect);
  }
  requestAnimationFrame(trackTitleRect);
  window.addEventListener('resize', postTitleRect);
})();
