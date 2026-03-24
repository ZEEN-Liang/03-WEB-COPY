(function () {
  var token    = localStorage.getItem('token');
  var username = localStorage.getItem('username');
  var loggedIn = !!(token && username);

  // ── Bottom bar ───────────────────────────────────────────
  var bb = document.getElementById('bottom-bar');
  bb.innerHTML = loggedIn
    ? '<a href="/forum.html" class="bottom-link">广 场</a>' +
      '<span class="bottom-sep">·</span>' +
      '<a href="/post.html" class="bottom-link">投 稿</a>' +
      '<span class="bottom-sep">·</span>' +
      '<a href="/qa.html" class="bottom-link">问 答</a>'
    : '<a href="/forum.html" class="bottom-link">广 场</a>' +
      '<span class="bottom-sep">·</span>' +
      '<a href="/post.html" class="bottom-link">投 稿</a>' +
      '<span class="bottom-sep">·</span>' +
      '<a href="/qa.html" class="bottom-link">问 答</a>' +
      '<span class="bottom-sep">·</span>' +
      '<a href="/login" class="bottom-link">登 录</a>';

  // ── Danmaku area ─────────────────────────────────────────
  var area = document.getElementById('danmaku-area');
  if (loggedIn) {
    area.innerHTML =
      '<div class="danmaku-wrap">' +
        '<input class="danmaku-input" id="danmaku-input" maxlength="40" placeholder="发条弹幕飘过封面…" autocomplete="off">' +
        '<button class="danmaku-send" id="danmaku-btn">发 送</button>' +
      '</div>';
    document.getElementById('danmaku-btn').addEventListener('click', sendDanmaku);
    document.getElementById('danmaku-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') sendDanmaku();
    });
  } else {
    area.innerHTML =
      '<div class="danmaku-hint">登录后可发送弹幕 · <a href="/login">去登录</a></div>';
  }

  // ── Danmaku engine ────────────────────────────────────────
  var LANES = 8;
  var laneY = [];
  for (var i = 0; i < LANES; i++) {
    laneY.push(Math.round((i + 0.5) * (window.innerHeight / LANES)));
  }
  var laneCooldown = new Array(LANES).fill(0);

  function pickLane() {
    var now = Date.now();
    var best = 0, bestTime = Infinity;
    for (var i = 0; i < LANES; i++) {
      if (laneCooldown[i] < bestTime) { bestTime = laneCooldown[i]; best = i; }
    }
    laneCooldown[best] = now + 1600 + Math.random() * 1200;
    return best;
  }

  function fireDanmaku(text, color) {
    var layer = document.getElementById('danmaku-layer');
    var lane  = pickLane();
    var el    = document.createElement('div');
    el.className   = 'danmaku-item';
    el.textContent = text;
    el.style.color = color || '#c8dff7';
    el.style.top   = laneY[lane] + 'px';
    el.style.left  = '100vw';
    var dur = 7 + Math.random() * 4;
    el.style.animationDuration = dur.toFixed(1) + 's';
    layer.appendChild(el);
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, (dur + 0.5) * 1000);
  }

  // ── User color (stable per username) ─────────────────────
  var USER_COLORS = ['#c8dff7','#a8e6cf','#f8d7a8','#f4a8c8','#c8b8f0','#a8d8ea','#f0d9a8'];
  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function userColor(name) {
    return USER_COLORS[hashStr(name) % USER_COLORS.length];
  }

  // ── Send to backend ───────────────────────────────────────
  function sendDanmaku() {
    var inp = document.getElementById('danmaku-input');
    var btn = document.getElementById('danmaku-btn');
    if (!inp || !btn) return;
    var text = inp.value.trim();
    if (!text) return;
    var col = userColor(username || '');
    btn.disabled = true;
    inp.disabled = true;

    fetch('/api/danmaku', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ content: text, color: col })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error) {
        // Show error briefly on placeholder
        inp.placeholder = data.error;
        setTimeout(function() { inp.placeholder = '发条弹幕飘过封面…'; }, 2500);
      } else {
        inp.value = '';
        // Fire locally immediately (don't wait for next poll)
        fireDanmaku((data.display_name || username) + '：' + data.content, col);
      }
    })
    .catch(function() {
      inp.placeholder = '发送失败，请重试';
      setTimeout(function() { inp.placeholder = '发条弹幕飘过封面…'; }, 2000);
    })
    .finally(function() {
      setTimeout(function() {
        btn.disabled = false;
        inp.disabled = false;
        inp.focus();
      }, 2200); // match server-side 5s rate limit (client shows 2.2s)
    });
  }

  // ── Poll backend for danmaku ──────────────────────────────
  var lastId  = 0;   // track highest id seen
  var allRows = [];  // full list loaded on init
  var playIdx = 0;   // playback cursor through allRows
  var PLAY_INTERVAL = 2800; // ms between each item firing

  function loadDanmaku(initial) {
    var url = initial ? '/api/danmaku' : '/api/danmaku?since=' + lastId;
    fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(rows) {
        if (!rows || !rows.length) return;
        if (initial) {
          allRows = rows;
          // Update lastId
          lastId = rows[rows.length - 1].id;
          // Start sequential playback
          scheduleNext();
        } else {
          // New rows since last poll — append and update lastId
          rows.forEach(function(row) {
            if (row.id > lastId) {
              lastId = row.id;
              allRows.push(row);
            }
          });
        }
      })
      .catch(function() {});
  }

  function scheduleNext() {
    if (playIdx >= allRows.length) {
      // Exhausted current list — wait and loop from start
      setTimeout(function() {
        playIdx = 0;
        scheduleNext();
      }, PLAY_INTERVAL * 2);
      return;
    }
    var row = allRows[playIdx++];
    var label = (row.display_name || '匿名') + '：' + row.content;
    fireDanmaku(label, row.color);
    setTimeout(scheduleNext, PLAY_INTERVAL + Math.random() * 1200);
  }

  // Initial load
  setTimeout(function() { loadDanmaku(true); }, 1800);

  // Poll for new danmaku every 15s
  setInterval(function() { loadDanmaku(false); }, 15000);

})();
