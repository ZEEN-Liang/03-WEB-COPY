// Cover page — exit animation only (rain lives in shell.html)
(function() {
  var EXIT_MS = 800;
  var exiting = false;

  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.enter-btn');
    if (!btn || exiting) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    exiting = true;

    // Tell shell to start rain deceleration immediately
    window.parent.postMessage({ type: '_rain_nav_out' }, '*');

    // Fade out title and all stage content
    var stage = document.querySelector('.stage');
    if (stage) {
      stage.style.transition = 'opacity ' + EXIT_MS + 'ms ease-in';
      stage.style.opacity    = '0';
    }

    setTimeout(function() {
      if (typeof window.navigate === 'function') window.navigate(btn.getAttribute('href') || '/forum.html');
      else location.href = btn.getAttribute('href') || '/forum.html';
    }, EXIT_MS);
  }, true);
})();
