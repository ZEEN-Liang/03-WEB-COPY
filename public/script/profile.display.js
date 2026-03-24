const token    = localStorage.getItem('token');
const myName   = localStorage.getItem('username');
const isAdmin  = localStorage.getItem('isAdmin') === 'true';

// Determine whose profile to show: ?user=xxx or own profile
const params      = new URLSearchParams(location.search);
const targetUser  = params.get('user') || myName;
const isOwn       = token && !isAdmin && myName === targetUser;

// ── Nav ─────────────────────────────────────────────────────
const navRight = document.getElementById('nav-right');
if (token && myName) {
  navRight.innerHTML = `
    <div class="nav-user">你好，<span>${myName}</span></div>
    ${isOwn ? '' : `<a href="/profile.html" class="nav-btn">我的主页</a>`}
    ${isAdmin ? `<a href="/admin.html" class="nav-btn nav-btn-primary">管理后台</a>` : ''}
    <button class="nav-btn" onclick="logout()">退出</button>
  `;
} else {
  navRight.innerHTML = `
    <a href="/login" class="nav-btn">登录</a>
    <a href="/login" class="nav-btn nav-btn-primary">注册</a>
  `;
}
function logout() { localStorage.clear(); window.top ? (window.top.location.href='/') : (window.location.href='/'); }

// ── Helpers ──────────────────────────────────────────────────
function formatDate(str) {
  const d = new Date(str.replace(' ','T')+'Z');
  return d.toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' });
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
let toastTimer;
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast '+type+' show';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Load profile ─────────────────────────────────────────────
let profileData = null;

async function loadProfile() {
  const page = document.getElementById('page');
  if (!targetUser) {
    page.innerHTML = `<div class="state-msg"><div class="icon">?</div><div>请先登录或指定用户</div></div>`;
    return;
  }
  try {
    const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    const [profRes, postsRes, qsRes] = await Promise.all([
      fetch('/api/profile/' + encodeURIComponent(targetUser), { headers }),
      fetch('/api/profile/' + encodeURIComponent(targetUser) + '/posts'),
      fetch('/api/profile/' + encodeURIComponent(targetUser) + '/questions')
    ]);
    if (!profRes.ok) { page.innerHTML = `<div class="state-msg"><div class="icon">◻</div><div>用户不存在</div></div>`; return; }
    profileData = await profRes.json();
    const posts  = await postsRes.json();
    const questions = qsRes.ok ? await qsRes.json() : [];
    renderPage(profileData, posts, questions);
  } catch(e) {
    document.getElementById('page').innerHTML = `<div class="state-msg"><div class="icon">!</div><div>加载失败，请确认服务器运行中</div></div>`;
  }
}

function renderUserCard(u, delay = 0) {
  const av = u.avatar && u.avatar.startsWith('/')
    ? `<img src="${esc(u.avatar)}" alt="">`
    : `<span>${(u.nickname || u.username || '?')[0].toUpperCase()}</span>`;
  return `
    <a class="user-card" href="/profile.html?user=${encodeURIComponent(u.username)}" style="animation-delay:${delay}s">
      <div class="user-card-avatar">${av}</div>
      <div class="user-card-info">
        <div class="user-card-name">${esc(u.nickname || u.username)}</div>
        <div class="user-card-bio">${u.bio ? esc(u.bio.slice(0,60)) : '暂无简介'}</div>
      </div>
      <div class="user-card-meta">${u.post_count || 0} 篇投稿</div>
    </a>`;
}

function renderPage(u, posts, questions = []) {
  document.title = (u.nickname || u.username) + ' · 论坛广场';
  const instruments = u.instruments ? u.instruments.split(',').filter(Boolean) : [];
  const instHtml    = instruments.map(i => `<span class="instrument-tag">${esc(i.trim())}</span>`).join('');
  const avImg       = u.avatar && u.avatar.startsWith('/')
    ? `<img src="${esc(u.avatar)}" alt="avatar">`
    : `<span>${(u.nickname || u.username)[0].toUpperCase()}</span>`;

  const editBtn    = isOwn ? `<button class="edit-profile-btn" onclick="openModal()">编辑资料</button>` : '';
  const editAvatar = isOwn ? `<button class="avatar-edit-btn show" onclick="document.getElementById('avatar-file-input').click()" title="更换头像">✎</button>` : '';
  const followBtn  = (!isOwn && token && !isAdmin)
    ? `<button class="follow-btn ${u.is_following ? 'following' : ''}" id="follow-btn"
         onclick="toggleFollow('${esc(u.username)}')">
         ${u.is_following ? '已关注' : '+ 关注'}
       </button>`
    : '';

  const postListHtml = posts.length === 0
    ? `<div class="empty-tab">${isOwn ? '你还没有发布任何投稿' : '该用户暂无公开投稿'}</div>`
    : posts.map((p, i) => `
      <div class="post-item" style="animation-delay:${i*0.04}s" onclick="window.location.href='/article.html?id=${p.id}'">
        <div class="post-title">${esc(p.title)}</div>
        ${p.content ? `<div class="post-excerpt">${esc(p.content.slice(0,100))}${p.content.length>100?'…':''}</div>` : ''}
        <div class="post-footer-stats">
          <span class="post-stat">📅 ${formatDate(p.created_at)}</span>
          <span class="post-stat">👁 ${p.view_count||0}</span>
          <span class="post-stat">💬 ${p.comment_count||0}</span>
          <span class="post-stat">♥ ${p.like_count||0}</span>
        </div>
      </div>`).join('');

  const qListHtml = questions.length === 0
    ? `<div class="empty-tab">${isOwn ? '你还没有提出任何问题' : '该用户暂无提问'}</div>`
    : questions.map((q, i) => `
      <div class="post-item" style="animation-delay:${i*0.04}s" onclick="window.location.href='/qa.html?open=${q.id}'">
        <div class="post-title" style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;padding:2px 7px;border-radius:3px;font-weight:500;letter-spacing:0.06em;flex-shrink:0;
            ${q.status==='solved'
              ? 'background:rgba(74,180,74,0.12);color:#4ab44a'
              : 'background:rgba(230,160,50,0.12);color:#c8902a'}">
            ${q.status==='solved' ? '已解决' : '悬挂中'}
          </span>
          ${esc(q.title)}
        </div>
        <div class="post-footer-stats">
          <span class="post-stat">📅 ${formatDate(q.created_at)}</span>
          <span class="post-stat">💬 ${q.answer_count||0} 回答</span>
          <span class="post-stat">△ ${q.vote_count||0} 赞同</span>
          ${q.tags ? `<span class="post-stat">${esc(q.tags)}</span>` : ''}
        </div>
      </div>`).join('');

  const heroBg = u.banner && u.banner.startsWith('/')
    ? `<div class="profile-hero-bg"><img src="${esc(u.banner)}" alt="banner"></div>`
    : `<div class="profile-hero-bg"></div>`;
  const bannerEditBtn = isOwn
    ? `<button class="banner-edit-btn show" onclick="document.getElementById('banner-file-input').click()">✎ 更换背景</button>
       <input type="file" id="banner-file-input" class="banner-file-input" accept="image/jpeg,image/png,image/webp">`
    : '';

  document.getElementById('page').innerHTML = `
    <div class="profile-card">
      <!-- Hero: banner bg + overlay + content all in one layer -->
      <div class="profile-hero" id="banner-el">
        ${heroBg}
        <div class="profile-hero-overlay"></div>

        <!-- Top-right action buttons -->
        <div class="profile-hero-actions">
          ${bannerEditBtn}
          ${followBtn}
          ${editBtn}
        </div>

        <!-- Bottom content: avatar + text -->
        <div class="profile-hero-content">
          <div class="avatar-wrap">
            <div class="avatar" id="avatar-el">${avImg}</div>
            ${editAvatar}
            <input type="file" id="avatar-file-input" class="avatar-file-input" accept="image/jpeg,image/png,image/webp">
          </div>
          <div class="profile-hero-info">
            <div class="profile-nickname">${esc(u.nickname || u.username)}</div>
            ${(u.nickname && isOwn) ? `<div class="profile-username">账号：${esc(u.username)}</div>` : ''}
            <div class="profile-bio ${u.bio ? '' : 'empty'}">${u.bio ? esc(u.bio) : (isOwn ? '点击「编辑资料」添加简介' : '该用户还没有填写简介')}</div>
            ${instHtml ? `<div class="profile-instruments">${instHtml}</div>` : ''}
          </div>
        </div>
      </div>

      <!-- Stats bar — pure white -->
      <div class="profile-stats">
        <div class="profile-stat">
          <div class="profile-stat-num">${u.post_count||0}</div>
          <div class="profile-stat-label">投稿</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-num">${u.like_count||0}</div>
          <div class="profile-stat-label">获赞</div>
        </div>
        <div class="profile-stat" id="stat-followers" style="cursor:pointer" onclick="switchTab('followers')">
          <div class="profile-stat-num" id="follower-count">${u.follower_count||0}</div>
          <div class="profile-stat-label">粉丝</div>
        </div>
        <div class="profile-stat" id="stat-following" style="cursor:pointer" onclick="switchTab('following')">
          <div class="profile-stat-num">${u.following_count||0}</div>
          <div class="profile-stat-label">关注</div>
        </div>
      </div>
    </div>

    <!-- Content tabs -->
    <div class="content-tabs">
      <button class="content-tab active" id="tab-posts"     onclick="switchTab('posts')">
        投稿 <span class="tab-count">${posts.length}</span>
      </button>
      <button class="content-tab" id="tab-questions"  onclick="switchTab('questions')">
        问答 <span class="tab-count">${questions.length}</span>
      </button>
      <button class="content-tab" id="tab-following"  onclick="switchTab('following')">
        关注 ${!u.show_follows && !isOwn ? '🔒 ' : ''}<span class="tab-count" id="tc-following">${u.following_count||0}</span>
      </button>
      <button class="content-tab" id="tab-followers"  onclick="switchTab('followers')">
        粉丝 ${!u.show_follows && !isOwn ? '🔒 ' : ''}<span class="tab-count" id="tc-followers">${u.follower_count||0}</span>
      </button>
    </div>

    <div class="tab-panel active" id="panel-posts">
      <div class="post-list">${postListHtml}</div>
    </div>
    <div class="tab-panel" id="panel-questions">
      <div class="post-list">${qListHtml}</div>
    </div>
    <div class="tab-panel" id="panel-following">
      <div class="user-list" id="list-following"><div class="empty-tab">加载中…</div></div>
    </div>
    <div class="tab-panel" id="panel-followers">
      <div class="user-list" id="list-followers"><div class="empty-tab">加载中…</div></div>
    </div>
  `;

  if (isOwn) {
    document.getElementById('avatar-file-input').addEventListener('change', uploadAvatar);
    const bannerInput = document.getElementById('banner-file-input');
    if (bannerInput) bannerInput.addEventListener('change', uploadBanner);
  }
}

// ── Tab switching ────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
  if (name === 'following') loadFollowing();
  if (name === 'followers') loadFollowers();
}

async function loadFollowing() {
  const el = document.getElementById('list-following');
  if (!el || el.dataset.loaded) return;
  try {
    const res  = await fetch('/api/profile/' + encodeURIComponent(targetUser) + '/following',
      { headers: token ? { 'Authorization': 'Bearer ' + token } : {} });
    if (res.status === 403) {
      el.dataset.loaded = '1';
      el.innerHTML = '<div class="empty-tab" style="opacity:0.5">🔒 该用户已隐藏关注列表</div>';
      return;
    }
    const list = await res.json();
    el.dataset.loaded = '1';
    el.innerHTML = list.length
      ? list.map((u, i) => renderUserCard(u, i * 0.04)).join('')
      : `<div class="empty-tab">${isOwn ? '你还没有关注任何人' : '该用户暂未关注任何人'}</div>`;
  } catch(e) { el.innerHTML = '<div class="empty-tab">加载失败</div>'; }
}

async function loadFollowers() {
  const el = document.getElementById('list-followers');
  if (!el || el.dataset.loaded) return;
  try {
    const res  = await fetch('/api/profile/' + encodeURIComponent(targetUser) + '/followers',
      { headers: token ? { 'Authorization': 'Bearer ' + token } : {} });
    if (res.status === 403) {
      el.dataset.loaded = '1';
      el.innerHTML = '<div class="empty-tab" style="opacity:0.5">🔒 该用户已隐藏粉丝列表</div>';
      return;
    }
    const list = await res.json();
    el.dataset.loaded = '1';
    el.innerHTML = list.length
      ? list.map((u, i) => renderUserCard(u, i * 0.04)).join('')
      : `<div class="empty-tab">${isOwn ? '还没有人关注你' : '该用户暂无粉丝'}</div>`;
  } catch(e) { el.innerHTML = '<div class="empty-tab">加载失败</div>'; }
}

// ── Follow toggle ────────────────────────────────────────────
async function toggleFollow(username) {
  if (!token) { window.top ? (window.top.location.href='/') : (window.location.href='/'); return; }
  const btn = document.getElementById('follow-btn');
  if (!btn) return;
  btn.disabled = true;
  try {
    const res  = await fetch('/api/follow/' + encodeURIComponent(username), {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || '操作失败', 'error'); return; }
    const isNowFollowing = data.following;
    btn.textContent = isNowFollowing ? '已关注' : '+ 关注';
    btn.className = 'follow-btn' + (isNowFollowing ? ' following' : '');
    // Update follower count
    const fc = document.getElementById('follower-count');
    const tc = document.getElementById('tc-followers');
    if (fc) fc.textContent = data.follower_count;
    if (tc) tc.textContent = data.follower_count;
    // Invalidate followers cache so it reloads
    const el = document.getElementById('list-followers');
    if (el) delete el.dataset.loaded;
    showToast(isNowFollowing ? '已关注' : '已取消关注');
  } catch(e) { showToast('操作失败', 'error'); }
  finally { btn.disabled = false; }
}
