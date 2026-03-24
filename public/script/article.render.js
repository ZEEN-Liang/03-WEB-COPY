// ── Nav auth state ──────────────────────────────────────────
const token    = localStorage.getItem('token');
const username = localStorage.getItem('username');
const navRight = document.getElementById('nav-right');

if (token && username) {
  navRight.innerHTML = `
    <div class="nav-user">你好，<span>${username}</span></div>
    <a href="/profile.html" class="nav-btn">我的主页</a>
    <a href="/post.html" class="nav-btn nav-btn-primary">写投稿</a>
    <button class="nav-btn" onclick="logout()">退出</button>
  `;
} else {
  navRight.innerHTML = `
    <a href="/login" class="nav-btn">登录</a>
    <a href="/login" class="nav-btn nav-btn-primary">注册</a>
  `;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  window.top ? (window.top.location.href='/') : (window.location.href='/');
}

// ── Helpers ─────────────────────────────────────────────────
function formatDate(str) {
  const d = new Date(str.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function isImage(mime) { return mime && mime.startsWith('image/'); }

function getFileExt(name) {
  return name.split('.').pop().toUpperCase().slice(0, 4) || 'FILE';
}

function getAvatarLetter(name) {
  return (name || '?')[0].toUpperCase();
}

// ── Load article ────────────────────────────────────────────
async function loadArticle() {
  const app = document.getElementById('app');
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  // No id in URL
  if (!id) {
    app.innerHTML = `
      <div class="state-wrap">
        <div class="state-icon">✦</div>
        <div>未指定文章 ID</div>
        <a href="/forum.html" class="state-back">← 返回广场</a>
      </div>`;
    return;
  }

  // Loading state
  app.innerHTML = `
    <div class="state-wrap">
      <div class="state-icon" style="animation: pulse 1.2s ease infinite">◌</div>
      <div>正在加载文章…</div>
    </div>`;

  try {
    const res = await fetch(`/api/posts/${id}`, {
      headers: token ? { 'Authorization': 'Bearer ' + token } : {}
    });

    if (res.status === 404) {
      app.innerHTML = `
        <div class="state-wrap">
          <div class="state-icon">◻</div>
          <div>文章不存在或已被删除</div>
          <a href="/forum.html" class="state-back">← 返回广场</a>
        </div>`;
      return;
    }

    const post = await res.json();

    // Update page title
    document.title = post.title + ' · 论坛广场';

    // Separate images and other files
    const images = (post.attachments || []).filter(a => isImage(a.mimetype));
    const files  = (post.attachments || []).filter(a => !isImage(a.mimetype));

    // Build gallery HTML
    let galleryHtml = '';
    if (images.length > 0) {
      const items = images.map(img => `
        <div class="gallery-item" onclick="openLightbox('/uploads/${img.filename}', '${img.originalname}')">
          <img src="/uploads/${img.filename}" alt="${img.originalname}" loading="lazy">
          <div class="gallery-item-overlay">⊕</div>
        </div>
      `).join('');
      galleryHtml = `
        <div class="gallery">
          <div class="gallery-title">图片 · ${images.length} 张</div>
          <div class="gallery-grid">${items}</div>
        </div>
      `;
    }

    // Build file list HTML
    let filesHtml = '';
    if (files.length > 0) {
      const items = files.map(f => `
        <a class="file-item" href="/uploads/${f.filename}" target="_blank" download="${f.originalname}">
          <div class="file-icon">${getFileExt(f.originalname)}</div>
          <div class="file-info">
            <div class="file-name">${f.originalname}</div>
            <div class="file-size">${formatSize(f.size)}</div>
          </div>
          <span class="file-dl">下载</span>
        </a>
      `).join('');
      filesHtml = `
        <div class="files-section">
          <div class="files-title">文件附件 · ${files.length} 个</div>
          <div class="file-list">${items}</div>
        </div>
      `;
    }

    // Render full article
    app.innerHTML = `
      <div class="article-wrap">

        <div class="breadcrumb">
          <a href="/forum.html">广场</a>
          <span class="breadcrumb-sep">›</span>
          <span>${post.title}</span>
        </div>

        <div class="article-header">
          <div class="article-meta">
            <a href="/profile.html?user=${encodeURIComponent(post.username)}"
               style="display:flex;align-items:center;gap:10px;text-decoration:none;cursor:pointer"
               title="查看主页">
              ${avatarHtml(post.nickname || post.username, post.avatar, 40)}
              <div class="author-info">
                <div class="author-name">${post.nickname || post.username}</div>
              </div>
            </a>
            <div class="article-date" style="margin-left:4px">${formatDate(post.created_at)}</div>
          </div>

          <h1 class="article-title">${post.title}</h1>

          ${post.tags ? `<div class="article-tags">
            ${post.tags.split(',').map(t=>t.trim()).filter(Boolean).map(t =>
              tagPillHtml(t, { tagName: 'a', href: '/forum.html?tag=' + encodeURIComponent(t), extraCls: 'article-tag-pill' })
            ).join('')}
          </div>` : ''}

          <div class="article-rule">
            <div class="article-rule-line"></div>
            <div class="article-rule-mark">✦</div>
            <div class="article-rule-line"></div>
          </div>
        </div>

        <div class="article-body">${post.content ? escapeHtml(post.content) : ''}</div>

        ${galleryHtml}
        ${filesHtml}

        <div class="article-stats">
          <div class="stat-item"><span class="stat-item-icon">👁</span>${post.view_count || 0} 次阅读</div>
          <div class="stat-item"><span class="stat-item-icon">💬</span>${post.comment_count || 0} 条评论</div>
          <div class="stat-item"><span class="stat-item-icon">📅</span>${formatDate(post.created_at)}</div>
          <div style="margin-left:auto">
            <button class="like-btn ${post.already_liked ? 'liked' : ''}"
              id="post-like-btn"
              onclick="toggleLike('post', ${id}, this)"
              ${token ? '' : 'disabled title="登录后才能点赞"'}>
              <span class="like-heart">${post.already_liked ? '♥' : '♡'}</span>
              <span class="like-count" id="post-like-count">${post.like_count || 0}</span>
              <span>赞</span>
            </button>
          </div>
        </div>

        <div class="comments-section" id="comments-section"></div>

        <div class="article-footer">
          <a href="/forum.html" class="footer-back">
            <span class="footer-back-arrow">←</span>
            返回广场
          </a>
          <div class="footer-meta">
            第 ${post.id} 篇投稿<br>
            由 ${post.nickname || post.username} 发布
          </div>
        </div>

      </div>
    `;

    // Build comments section now that DOM is ready
    buildCommentsSection(id);

  } catch (e) {
    app.innerHTML = `
      <div class="state-wrap">
        <div class="state-icon">!</div>
        <div>加载失败，请确认服务器正在运行</div>
        <a href="/forum.html" class="state-back">← 返回广场</a>
      </div>`;
  }
}


// Build avatar HTML — shows photo if available, else initial letter
function avatarHtml(username, avatarUrl, size = 36) {
  const letter = (username || '?')[0].toUpperCase();
  const style  = `width:${size}px;height:${size}px;border-radius:50%;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--ink);color:#f5f2ec;font-family:'DM Serif Display',serif;font-size:${Math.round(size*0.42)}px;font-weight:500;`;
  const url = (avatarUrl && avatarUrl !== '0' && avatarUrl !== 0 && String(avatarUrl).startsWith('/')) ? avatarUrl : null;
  if (url) {
    return `<div style="${style}padding:0"><img src="${url}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='${letter}';this.parentElement.style.padding=''" alt="${letter}"></div>`;
  }
  return `<div style="${style}">${letter}</div>`;
}


// ── Tag color system ─────────────────────────────────────────
// Hash tag string to a stable index, pick from a curated palette
const TAG_PALETTE = [
  { bg: 'rgba(46,122,181,0.08)',  border: 'rgba(46,122,181,0.28)',  text: '#2563a8' },  // blue
  { bg: 'rgba(26,168,180,0.08)',  border: 'rgba(26,168,180,0.28)',  text: '#0e8a96' },  // cyan
  { bg: 'rgba(39,174,96,0.08)',   border: 'rgba(39,174,96,0.28)',   text: '#1e8449' },  // green
  { bg: 'rgba(142,68,173,0.08)',  border: 'rgba(142,68,173,0.28)',  text: '#7d3c98' },  // purple
  { bg: 'rgba(74,159,212,0.08)',  border: 'rgba(74,159,212,0.28)',  text: '#1a7ab5' },  // sky
  { bg: 'rgba(22,160,133,0.08)',  border: 'rgba(22,160,133,0.28)',  text: '#148a72' },  // teal
  { bg: 'rgba(52,100,200,0.08)',  border: 'rgba(52,100,200,0.28)',  text: '#2d5bb5' },  // indigo
  { bg: 'rgba(100,180,230,0.08)', border: 'rgba(100,180,230,0.28)', text: '#1e6fa0' },  // steel
  { bg: 'rgba(130,90,200,0.08)',  border: 'rgba(130,90,200,0.28)',  text: '#6040b0' },  // violet
  { bg: 'rgba(26,188,156,0.08)',  border: 'rgba(26,188,156,0.28)',  text: '#17a589' },  // mint
  { bg: 'rgba(70,130,180,0.08)',  border: 'rgba(70,130,180,0.28)',  text: '#2e6b9e' },  // steel-blue
  { bg: 'rgba(155,89,182,0.08)',  border: 'rgba(155,89,182,0.28)',  text: '#8e44ad' },  // lavender
];

function tagHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h) % TAG_PALETTE.length;
}

function tagColor(tag) {
  return TAG_PALETTE[tagHash(tag)];
}

function tagPillHtml(tag, opts = {}) {
  const col      = tagColor(tag);
  const active   = opts.active   || false;
  const onclick  = opts.onclick  ? `onclick="${opts.onclick}"` : '';
  const href     = opts.href     ? `href="${opts.href}"` : '';
  const tagName  = opts.tagName  || 'span';
  const extraCls = opts.extraCls || '';

  const activeBg   = col.text;
  const activeText = '#fff';
  const bg         = active ? activeBg  : col.bg;
  const text       = active ? activeText : col.text;
  const border     = active ? activeBg  : col.border;

  const style = `background:${bg};border:1px solid ${border};color:${text};` +
    `display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:400;` +
    `letter-spacing:0.04em;padding:2px 9px;border-radius:20px;cursor:pointer;transition:all 0.15s;`;

  return `<${tagName} style="${style}" ${href} ${onclick} class="${extraCls}">#${tag}</${tagName}>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Lightbox ─────────────────────────────────────────────────
function openLightbox(src, caption) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox-caption').textContent = caption;
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox(e) {
  if (e.target === document.getElementById('lightbox')) closeLightboxDirect();
}

function closeLightboxDirect() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightboxDirect();
});
