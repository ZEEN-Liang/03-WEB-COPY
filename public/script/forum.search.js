// ── Nav Search ─────────────────────────────────────────────
(function () {
  var input    = document.getElementById('nav-search-input');
  var clearBtn = document.getElementById('nav-search-clear');
  var dropdown = document.getElementById('nav-search-dropdown');
  var wrap     = document.getElementById('nav-search');

  if (!input) return;

  var timer = null;
  var lastQ = '';

  // ── Input events ────────────────────────────────────────
  input.addEventListener('input', function () {
    var q = input.value.trim();
    clearBtn.style.display = q ? '' : 'none';
    clearTimeout(timer);
    if (!q) { close(); return; }
    timer = setTimeout(function () { doSearch(q); }, 260);
  });

  clearBtn.addEventListener('click', function () {
    input.value = '';
    clearBtn.style.display = 'none';
    close();
    input.focus();
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { close(); input.blur(); }
  });

  document.addEventListener('click', function (e) {
    if (!wrap.contains(e.target)) close();
  });

  // ── Search ───────────────────────────────────────────────
  function doSearch(q) {
    if (q === lastQ) return;
    lastQ = q;
    show('<div class="search-loading">搜索中…</div>');

    fetch('/api/search?q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (input.value.trim() !== q) return; // stale
        render(data, q);
      })
      .catch(function () {
        show('<div class="search-empty">搜索失败，请稍后重试</div>');
      });
  }

  // ── Render ───────────────────────────────────────────────
  function render(data, q) {
    var posts = data.posts || [];
    var users = data.users || [];

    if (!posts.length && !users.length) {
      show('<div class="search-empty">没有找到与「' + esc(q) + '」相关的内容</div>');
      return;
    }

    var html = '';

    if (users.length) {
      html += '<div class="search-section-head">用户</div>';
      users.forEach(function (u) {
        var name = u.display_name || u.username;
        var avatarEl = u.avatar
          ? '<img class="search-user-avatar" src="' + esc(u.avatar) + '" onerror="this.src=\'\'">'
          : '<div class="search-user-avatar" style="display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--ink-faint)">👤</div>';
        var bio = u.bio
          ? '<div class="search-user-bio">' + esc(u.bio) + '</div>' : '';
        html += '<a class="search-user-item" href="/profile.html?u=' + esc(u.username) + '" onclick="return _searchNav(event,this)">' +
          avatarEl +
          '<div style="min-width:0"><div class="search-user-name">' + hi(name, q) + '</div>' + bio + '</div>' +
          '</a>';
      });
    }

    if (posts.length) {
      html += '<div class="search-section-head">文章</div>';
      posts.forEach(function (p) {
        var date = p.created_at ? new Date(p.created_at).toLocaleDateString('zh-CN') : '';
        var by   = p.display_name || p.username || '';
        // Show content snippet only when match is NOT in title
        var snippet = '';
        var title = p.title || '';
        if (p.content && title.toLowerCase().indexOf(q.toLowerCase()) < 0) {
          snippet = '<div class="search-post-snippet">' + hiSnippet(p.content, q, 80) + '</div>';
        }
        html += '<a class="search-post-item" href="/article.html?id=' + p.id + '" onclick="return _searchNav(event,this)">' +
          '<span class="search-post-icon">📄</span>' +
          '<div style="min-width:0;flex:1">' +
          '<div class="search-post-title">' + hi(title || '(无标题)', q) + '</div>' +
          snippet +
          '<div class="search-post-meta">' + esc(by) + (date ? ' · ' + date : '') + '</div>' +
          '</div></a>';
      });
    }

    show(html);
  }

  // ── Helpers ──────────────────────────────────────────────
  function show(html) {
    dropdown.innerHTML = html;
    dropdown.style.display = '';
  }

  function close() {
    dropdown.style.display = 'none';
    lastQ = '';
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Extract a short snippet around the first match in body text
  function hiSnippet(text, q, radius) {
    var plain = String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    var idx = plain.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return '';
    var start = Math.max(0, idx - radius);
    var end   = Math.min(plain.length, idx + q.length + radius);
    var chunk = (start > 0 ? '…' : '') + plain.slice(start, end) + (end < plain.length ? '…' : '');
    return hi(chunk, q);
  }

  function hi(text, q) {
    var t = String(text || '');
    var idx = t.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return esc(t);
    return esc(t.slice(0, idx)) +
      '<mark style="background:rgba(46,122,181,0.15);color:var(--accent);border-radius:2px;font-style:normal">' +
      esc(t.slice(idx, idx + q.length)) + '</mark>' +
      esc(t.slice(idx + q.length));
  }

  // Global handler for result clicks (works inside/outside shell)
  window._searchNav = function (e, a) {
    e.preventDefault();
    var url = a.getAttribute('href');
    close();
    input.value = '';
    clearBtn.style.display = 'none';
    if (typeof window.navigate === 'function') {
      window.navigate(url);
    } else {
      window.location.href = url;
    }
    return false;
  };

})();
