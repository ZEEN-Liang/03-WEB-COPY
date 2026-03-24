(function () {
  var SUBTITLES = [
    ['一个个瞬间积累起来', '就是一辈子'],
    ['组一辈子乐队！'],
    ['一身素轻纱', '草柄当头花']
  ];
  var TYPE_SPEED  = 90;
  var PAUSE_AFTER = 2200;
  var PAUSE_NEXT  = 500;

  var el = document.getElementById('subtitle');
  if (!el) return;

  var cursor = document.createElement('span');
  cursor.className = 'tw-cursor';
  el.appendChild(cursor);

  var used = [];
  var lastIdx = -1;

  function pickNext() {
    if (used.length >= SUBTITLES.length) used = [];
    var idx;
    do { idx = Math.floor(Math.random() * SUBTITLES.length); }
    while (used.indexOf(idx) !== -1 || idx === lastIdx);
    used.push(idx);
    lastIdx = idx;
    return SUBTITLES[idx];
  }

  function setText(lines, charCount) {
    while (el.firstChild && el.firstChild !== cursor) {
      el.removeChild(el.firstChild);
    }
    var total = 0;
    var done = false;
    for (var li = 0; li < lines.length && !done; li++) {
      var line = lines[li];
      if (total + line.length >= charCount) {
        var part = line.slice(0, charCount - total);
        el.insertBefore(document.createTextNode(part), cursor);
        done = true;
      } else {
        el.insertBefore(document.createTextNode(line), cursor);
        total += line.length;
        if (li < lines.length - 1 && total < charCount) {
          el.insertBefore(document.createElement('br'), cursor);
        }
      }
    }
  }

  function totalChars(lines) {
    var n = 0;
    for (var i = 0; i < lines.length; i++) n += lines[i].length;
    return n;
  }

  function typePhase(lines) {
    var max = totalChars(lines);
    var ci = 0;
    setText(lines, 0);
    function nextChar() {
      ci++;
      setText(lines, ci);
      if (ci < max) {
        setTimeout(nextChar, TYPE_SPEED);
      } else {
        setTimeout(function () { clearPhase(lines); }, PAUSE_AFTER);
      }
    }
    setTimeout(nextChar, TYPE_SPEED);
  }

  function clearPhase(lines) {
    var wrapper = document.createElement('span');
    wrapper.className = 'tw-clearing';
    while (el.firstChild && el.firstChild !== cursor) {
      wrapper.appendChild(el.firstChild);
    }
    el.insertBefore(wrapper, cursor);
    wrapper.addEventListener('animationend', function () {
      while (el.firstChild && el.firstChild !== cursor) {
        el.removeChild(el.firstChild);
      }
      setTimeout(function () { typePhase(pickNext()); }, PAUSE_NEXT);
    });
  }

  setTimeout(function () { typePhase(pickNext()); }, 1200);
})();
