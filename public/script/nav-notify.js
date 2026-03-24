// ── Notification bell ────────────────────────────────────────
(function () {
  const token = localStorage.getItem('token');
  if (!token) return;

  const slot = document.getElementById('nav-notify');
  if (!slot) return;

  slot.innerHTML = `
    <div class="notify-wrap" id="notify-wrap">
      <button class="notify-bell" id="notify-bell" title="消息通知" onclick="notifyToggle()">
        🔔
        <span class="notify-badge" id="notify-badge" style="display:none"></span>
      </button>
      <div class="notify-dropdown" id="notify-dropdown" style="display:none">
        <div class="notify-header">
          <span class="notify-header-title">消 息</span>
          <div style="display:flex;gap:8px">
            <button class="notify-read-all" id="notify-read-all-btn" onclick="notifyReadAll()" style="display:none">全部已读</button>
            <button class="notify-read-all" id="notify-clear-read-btn" onclick="notifyClearRead()" style="display:none">清除已读</button>
          </div>
        </div>
        <div class="notify-list" id="notify-list">
          <div class="notify-empty">加载中…</div>
        </div>
      </div>
    </div>
  `;

  let _open = false;
  let _cache = [];

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function timeAgo(str) {
    const d = new Date((str + 'Z').replace(' ','T'));
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 2592000) return Math.floor(diff / 86400) + ' 天前';
    return d.toLocaleDateString('zh-CN');
  }

  function updateBadge() {
    const unreadCount = _cache.filter(n => !n.is_read).length;
    const badge = document.getElementById('notify-badge');
    if (!badge) return;
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
    const hasUnread = unreadCount > 0;
    const hasRead   = _cache.some(n => n.is_read);
    const btn = document.getElementById('notify-read-all-btn');
    if (btn) btn.style.display = hasUnread ? '' : 'none';
    const clearBtn = document.getElementById('notify-clear-read-btn');
    if (clearBtn) clearBtn.style.display = hasRead ? '' : 'none';
  }

  function renderList() {
    const list = document.getElementById('notify-list');
    if (!list) return;
    if (!_cache.length) {
      list.innerHTML = '<div class="notify-empty">暂无消息</div>';
      return;
    }
    list.innerHTML = _cache.map(n => {
      const av = n.from_avatar && n.from_avatar.startsWith('/')
        ? `<img src="${esc(n.from_avatar)}" alt="">`
        : `<span>${(n.from_name || '?')[0].toUpperCase()}</span>`;
      const isUnread = !n.is_read;
      return `
        <div class="notify-item${isUnread ? ' unread' : ''}" data-id="${n.id}" data-link="${esc(n.link)}"
             onclick="notifyClick(this)" style="cursor:pointer">
          <div class="notify-avatar">${av}</div>
          <div class="notify-body">
            <div class="notify-msg">${esc(n.message)}</div>
            <div class="notify-time">${timeAgo(n.created_at)}</div>
          </div>
          ${isUnread
            ? '<div class="notify-dot"></div>'
            : `<button class="notify-del-btn" title="清除" onclick="event.stopPropagation();notifyDelete(${n.id})">×</button>`
          }
        </div>`;
    }).join('');
  }

  async function fetchCount() {
    try {
      const res = await fetch('/api/notifications/unread-count', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return;
      const { count } = await res.json();
      const badge = document.getElementById('notify-badge');
      if (!badge) return;
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    } catch(e) {}
  }

  async function fetchList() {
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return;
      _cache = await res.json();
      renderList();
      updateBadge();
    } catch(e) {
      const list = document.getElementById('notify-list');
      if (list) list.innerHTML = '<div class="notify-empty">加载失败</div>';
    }
  }

  window.notifyToggle = function () {
    const dropdown = document.getElementById('notify-dropdown');
    if (!dropdown) return;
    _open = !_open;
    dropdown.style.display = _open ? '' : 'none';
    if (_open) fetchList();
  };

  // Click unread → mark as read in DB + navigate; click read → just navigate
  window.notifyClick = async function (el) {
    const id   = parseInt(el.dataset.id);
    const link = el.dataset.link;
    const item = _cache.find(n => n.id === id);

    if (item && !item.is_read) {
      // Optimistic UI update
      item.is_read = 1;
      renderList();
      updateBadge();
      // Persist to backend
      fetch(`/api/notifications/read/${id}`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      }).catch(() => {});
    }

    // Close dropdown
    const dropdown = document.getElementById('notify-dropdown');
    if (dropdown) dropdown.style.display = 'none';
    _open = false;

    // Navigate
    if (window.navigate) window.navigate(link);
    else window.location.href = link;
  };

  // Delete a read notification
  window.notifyDelete = async function (id) {
    // Optimistic UI update
    _cache = _cache.filter(n => n.id !== id);
    renderList();
    updateBadge();
    // Persist to backend
    fetch(`/api/notifications/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    }).catch(() => {});
  };

  // Clear all read notifications
  window.notifyClearRead = function () {
    _cache = _cache.filter(n => !n.is_read);
    renderList();
    updateBadge();
    fetch('/api/notifications/clear-read', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    }).catch(() => {});
  };

  // Mark all unread as read
  window.notifyReadAll = function () {
    _cache.forEach(n => { n.is_read = 1; });
    renderList();
    updateBadge();
    fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    }).catch(() => {});
  };

  // Close on outside click
  document.addEventListener('click', function (e) {
    const wrap = document.getElementById('notify-wrap');
    if (wrap && !wrap.contains(e.target)) {
      const dropdown = document.getElementById('notify-dropdown');
      if (dropdown) dropdown.style.display = 'none';
      _open = false;
    }
  });

  // Init
  fetchCount();
  setInterval(fetchCount, 60000);
})();
