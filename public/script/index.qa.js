// ── Cover Q&A entry ──────────────────────────────────────────
(function () {
  var strip = document.getElementById('qa-strip');
  if (!strip) return;

  strip.innerHTML =
    '<a class="qa-entry" href="/qa.html" onclick="goQA(event)">' +
    '<span class="qa-entry-icon">❓</span>' +
    '<span class="qa-entry-text">互帮问答</span>' +
    '<span class="qa-entry-arrow">→</span>' +
    '</a>';

  window.goQA = function (e) {
    e.preventDefault();
    if (typeof window.navigate === 'function') window.navigate('/qa.html');
    else window.location.href = '/qa.html';
  };
})();
