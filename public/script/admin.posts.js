// ── Auth guard ──────────────────────────────────────────────
const token    = localStorage.getItem('token');
const username = localStorage.getItem('username');
const isAdmin  = localStorage.getItem('isAdmin') === 'true';

if (!token || !isAdmin) {
  alert('请用管理员账号登录');
  window.location.href = '/';
}

document.getElementById('nav-admin-name').textContent = username;

function logout() {
  localStorage.clear();
  window.location.href = '/';
}

const authHeaders = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + token
};

// ── State ───────────────────────────────────────────────────
let allPosts = [];
let currentFilter = 'all';
let drawerPostId = null;

// ── Helpers ─────────────────────────────────────────────────
function formatDate(str) {
  const d = new Date(str.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
    + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatSize(b) {
  if (b < 1024) return b + 'B';
  if (b < 1048576) return (b/1024).toFixed(1) + 'KB';
  return (b/1048576).toFixed(1) + 'MB';
}

function isImage(mime) { return mime && mime.startsWith('image/'); }

function statusBadge(status) {
  const map = { pending: '待审核', published: '已发布', hidden: '已隐藏' };
  return `<span class="badge ${status}"><span class="badge-dot"></span>${map[status] || status}</span>`;
}

// ── Load data ───────────────────────────────────────────────
async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats', { headers: authHeaders });
    const s = await res.json();
    document.getElementById('s-total').textContent     = s.total;
    document.getElementById('s-pending').textContent   = s.pending;
    document.getElementById('s-published').textContent = s.published;
    document.getElementById('s-hidden').textContent    = s.hidden;
    document.getElementById('s-users').textContent     = s.users;
  } catch(e) {}
}

async function loadAll() {
  try {
    const res = await fetch('/api/admin/posts', { headers: authHeaders });
    allPosts = await res.json();
    renderTable();
    loadStats();
  } catch(e) {
    showToast('加载失败，请确认服务器运行中', 'error');
  }
}

function setFilter(f, el) {
  currentFilter = f;
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderTable();
}

function renderTable() {
  const filtered = currentFilter === 'all'
    ? allPosts
    : allPosts.filter(p => p.status === currentFilter);

  document.getElementById('list-count').textContent = `${filtered.length} 篇`;

  const tbody = document.getElementById('post-tbody');

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">暂无投稿</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.style.animationDelay = (i * 0.03) + 's';
    tr.innerHTML = `
      <td style="color:var(--ink-faint);font-size:12px">${p.id}</td>
      <td class="td-title">
        <span class="post-title-text" onclick="openDrawer(${p.id})" title="${p.title}">${p.title}</span>
        <div class="post-meta-text">${p.nickname || p.username} · ${formatDate(p.created_at)}</div>
      </td>
      <td>
        <span class="attach-count ${p.attachment_count > 0 ? 'has-files' : ''}">
          ${p.attachment_count > 0 ? '📎 ' + p.attachment_count : '—'}
        </span>
      </td>
      <td>${statusBadge(p.status)}</td>
      <td style="font-size:12px;color:var(--ink-faint)">${formatDate(p.created_at)}</td>
      <td>
        <div class="actions">
          <button class="act-btn act-publish" onclick="updateStatus(${p.id},'published')" ${p.status==='published'?'disabled':''}>发布</button>
          <button class="act-btn act-hide"    onclick="updateStatus(${p.id},'hidden')"    ${p.status==='hidden'?'disabled':''}>隐藏</button>
          <button class="act-btn act-delete"  onclick="confirmDelete(${p.id}, '${p.title.replace(/'/g,"\\'")}')">删除</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Status update ───────────────────────────────────────────
async function updateStatus(id, status) {
  try {
    const res = await fetch(`/api/admin/posts/${id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error, 'error'); return; }
    const map = { published: '已发布 ✓', hidden: '已隐藏', pending: '已设为待审核' };
    showToast(map[status] || '已更新', 'success');
    // Update local state without full reload
    const post = allPosts.find(p => p.id === id);
    if (post) post.status = status;
    renderTable();
    loadStats();
    // Update drawer if open
    if (drawerPostId === id) updateDrawerStatus(status);
  } catch(e) {
    showToast('操作失败', 'error');
  }
}

// ── Delete ──────────────────────────────────────────────────
function confirmDelete(id, title) {
  document.getElementById('confirm-icon').textContent = '🗑';
  document.getElementById('confirm-title').textContent = '确认永久删除';
  document.getElementById('confirm-sub').textContent = `「${title}」将被彻底删除，附件文件也会从服务器移除，此操作无法撤销。`;
  document.getElementById('confirm-ok').onclick = async () => {
    closeConfirm();
    try {
      const res = await fetch(`/api/admin/posts/${id}`, { method: 'DELETE', headers: authHeaders });
      const data = await res.json();
      if (!res.ok) { showToast(data.error, 'error'); return; }
      showToast('已永久删除', 'success');
      allPosts = allPosts.filter(p => p.id !== id);
      renderTable();
      loadStats();
      if (drawerPostId === id) closeDrawerDirect();
    } catch(e) {
      showToast('删除失败', 'error');
    }
  };
  document.getElementById('confirm-overlay').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('open');
}

// ── Drawer ──────────────────────────────────────────────────
async function openDrawer(id) {
  drawerPostId = id;
  document.getElementById('drawer-title').textContent = '加载中…';
  document.getElementById('drawer-content').textContent = '';
  document.getElementById('drawer-attachments').innerHTML = '';
  document.getElementById('drawer-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    const res  = await fetch(`/api/posts/${id}`, { headers: authHeaders });
    const post = await res.json();
    const p    = allPosts.find(x => x.id === id);

    document.getElementById('drawer-meta').textContent =
      `${post.username} · ${formatDate(post.created_at)} · ${statusBadge(p ? p.status : post.status).replace(/<[^>]+>/g,'')}`;
    document.getElementById('drawer-meta').innerHTML =
      `${post.username} · ${formatDate(post.created_at)} · ${statusBadge(p ? p.status : post.status)}`;
    document.getElementById('drawer-title').textContent = post.title;
    document.getElementById('drawer-content').textContent = post.content || '';

    // Attachments
    const attachArea = document.getElementById('drawer-attachments');
    if (post.attachments && post.attachments.length > 0) {
      const items = post.attachments.map(a => {
        const url = `/uploads/${a.filename}`;
        const thumb = isImage(a.mimetype)
          ? `<img class="drawer-attach-thumb" src="${url}" alt="${a.originalname}">`
          : `<div class="drawer-attach-icon">${a.originalname.split('.').pop().toUpperCase().slice(0,4)}</div>`;
        return `
          <a class="drawer-attach-item" href="${url}" target="_blank">
            ${thumb}
            <span class="drawer-attach-name">${a.originalname}</span>
            <span style="font-size:11px;color:var(--ink-faint);flex-shrink:0">${formatSize(a.size)}</span>
          </a>`;
      }).join('');
      attachArea.innerHTML = `
        <div class="drawer-attach-title">附件 · ${post.attachments.length} 个</div>
        <div class="drawer-attach-list">${items}</div>`;
    }

    // Update drawer footer button states
    updateDrawerStatus(p ? p.status : post.status);
  } catch(e) {
    document.getElementById('drawer-title').textContent = '加载失败';
  }
}

function updateDrawerStatus(status) {
  document.getElementById('df-publish').disabled = status === 'published';
  document.getElementById('df-hide').disabled    = status === 'hidden';
}

function drawerAction(action) {
  if (!drawerPostId) return;
  if (action === 'delete') {
    const p = allPosts.find(x => x.id === drawerPostId);
    confirmDelete(drawerPostId, p ? p.title : '此文章');
  } else {
    updateStatus(drawerPostId, action);
  }
}

function closeDrawer(e) {
  if (e.target === document.getElementById('drawer-overlay')) closeDrawerDirect();
}

function closeDrawerDirect() {
  document.getElementById('drawer-overlay').classList.remove('open');
  document.body.style.overflow = '';
  drawerPostId = null;
}

// ── Toast ───────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast ' + type + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Keyboard ────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeDrawerDirect(); closeConfirm(); }
});
