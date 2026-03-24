// ── Tag filter state (multi-select set) ─────────────────────
let activeTagFilters = new Set();
let allPostsCache    = [];   // cache for hot tag computation

// -- Compute hot tags from cached posts (top 10 by count) ---
function computeHotTags(posts) {
  const count = {};
  posts.forEach(p => {
    if (!p.tags) return;
    p.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => {
      count[t] = (count[t] || 0) + 1;
    });
  });
  return Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

function renderHotTags() {
  const el = document.getElementById('hot-tag-list');
  if (!el) return;
  const hot = computeHotTags(allPostsCache);
  if (!hot.length) { el.innerHTML = '<span style="font-size:12px;color:var(--ink-faint);font-weight:300">暂无标签数据</span>'; return; }
  el.innerHTML = hot.map(([tag, n]) => {
    const col  = tagColor(tag);
    const isOn = activeTagFilters.has(tag);
    const bg   = isOn ? col.text : col.bg;
    const txt  = isOn ? '#fff'   : col.text;
    const bdr  = isOn ? col.text : col.border;
    return `<button style="background:${bg};border:1px solid ${bdr};color:${txt};` +
      `display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:3px 10px;` +
      `border-radius:20px;cursor:pointer;transition:all 0.15s;font-family:inherit;` +
      `letter-spacing:0.04em;"
       onclick="toggleTagFilter('${tag.replace(/'/g,"\\'")}')">
       #${tag}<span style="font-size:10px;opacity:0.65">${n}</span>
    </button>`;
  }).join('');
}

function renderSearchTags(query) {
  const section = document.getElementById('search-tag-section');
  const list    = document.getElementById('search-tag-list');
  if (!query.trim()) { section.style.display = 'none'; return; }
  // Find matching tags from all posts
  const q = query.trim().toLowerCase();
  const count = {};
  allPostsCache.forEach(p => {
    if (!p.tags) return;
    p.tags.split(',').map(t => t.trim()).filter(Boolean)
      .filter(t => t.toLowerCase().includes(q))
      .forEach(t => { count[t] = (count[t] || 0) + 1; });
  });
  const matches = Object.entries(count).sort((a,b) => b[1]-a[1]).slice(0, 10);
  section.style.display = 'block';
  if (!matches.length) {
    // Show "add this tag as filter" option even if not in DB
    const _q = query.trim();
    const _col = tagColor(_q);
    list.innerHTML = `<button style="background:${_col.bg};border:1px solid ${_col.border};color:${_col.text};` +
      `display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:3px 10px;` +
      `border-radius:20px;cursor:pointer;transition:all 0.15s;font-family:inherit;letter-spacing:0.04em;"
       onclick="toggleTagFilter('${_q.replace(/'/g,"\\'")}')">
       #${_q} <span style="font-size:10px;opacity:0.5">搜索</span>
    </button>`;
  } else {
    list.innerHTML = matches.map(([tag, n]) => {
      const col  = tagColor(tag);
      const isOn = activeTagFilters.has(tag);
      const bg   = isOn ? col.text : col.bg;
      const txt  = isOn ? '#fff'   : col.text;
      const bdr  = isOn ? col.text : col.border;
      return `<button style="background:${bg};border:1px solid ${bdr};color:${txt};` +
        `display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:3px 10px;` +
        `border-radius:20px;cursor:pointer;transition:all 0.15s;font-family:inherit;` +
        `letter-spacing:0.04em;"
         onclick="toggleTagFilter('${tag.replace(/'/g,"\\'")}')">
         #${tag}<span style="font-size:10px;opacity:0.65">${n}</span>
      </button>`;
    }).join('');
  }
}

function renderSearchChips() {
  const chips = document.getElementById('tag-search-chips');
  const input = document.getElementById('tag-search-input');
  chips.querySelectorAll('.tag-search-chip').forEach(el => el.remove());
  activeTagFilters.forEach(tag => {
    const chip = document.createElement('div');
    chip.className = 'tag-search-chip';
    chip.innerHTML = `#${tag}<button class="tag-chip-x" onclick="toggleTagFilter('${tag.replace(/'/g,"\\'")}')">×</button>`;
    chips.insertBefore(chip, input);
  });
  const clearBtn = document.getElementById('tag-search-clear');
  if (clearBtn) clearBtn.classList.toggle('show', activeTagFilters.size > 0);
}

function toggleTagFilter(tag) {
  if (activeTagFilters.has(tag)) activeTagFilters.delete(tag);
  else activeTagFilters.add(tag);
  renderSearchChips();
  renderHotTags();
  renderSearchTags(document.getElementById('tag-search-input')?.value || '');
  loadPosts();
}

function clearAllTagFilters(e) {
  if (e) e.stopPropagation();
  activeTagFilters.clear();
  renderSearchChips();
  renderHotTags();
  closeTagDropdown();
  loadPosts();
}

function focusTagSearch() {
  document.getElementById('tag-search-input').focus();
  openTagDropdown();
}

function openTagDropdown() {
  document.getElementById('tag-search-bar').classList.add('open');
  document.getElementById('tag-dropdown').classList.add('open');
}

function closeTagDropdown() {
  document.getElementById('tag-search-bar').classList.remove('open');
  document.getElementById('tag-dropdown').classList.remove('open');
  document.getElementById('search-tag-section').style.display = 'none';
  document.getElementById('tag-search-input').value = '';
}

// Close dropdown when clicking outside
document.addEventListener('click', e => {
  if (!document.getElementById('tag-search-wrap')?.contains(e.target)) {
    closeTagDropdown();
  }
});

// Tag search input events
window.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('tag-search-input');
  if (!input) return;

  input.addEventListener('focus', () => openTagDropdown());
  input.addEventListener('input', () => renderSearchTags(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const val = input.value.trim();
      if (val) { toggleTagFilter(val); input.value = ''; renderSearchTags(''); }
    } else if (e.key === 'Escape') {
      closeTagDropdown();
    } else if (e.key === 'Backspace' && !input.value && activeTagFilters.size) {
      const last = [...activeTagFilters].pop();
      toggleTagFilter(last);
    }
  });

  // Handle ?tag= URL param on load
  const urlTag = new URLSearchParams(location.search).get('tag');
  if (urlTag) { activeTagFilters.add(urlTag); renderSearchChips(); }
});

// Legacy compat for article.html tag links (single tag)
function setTagFilter(tag) { toggleTagFilter(tag); }
function clearTagFilter()  { clearAllTagFilters(); }

// ── Sort state ──────────────────────────────────────────────
let currentSort = 'latest';

function setSort(sort, el) {
  if (sort === currentSort) return;
  currentSort = sort;
  document.querySelectorAll('.sort-tab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  loadPosts();
}

// ── Auth state ──────────────────────────────────────────────
const token    = localStorage.getItem('token');
const username = localStorage.getItem('username');

// Render nav right side
const navRight = document.getElementById('nav-right');
if (token && username) {
  navRight.innerHTML = `
    <div class="nav-user">你好，<span>${username}</span></div>
    <a href="/profile.html" class="nav-btn">我的主页</a>
    <a href="/post.html" class="nav-btn nav-btn-primary">写投稿</a>
    <button class="nav-btn nav-btn-outline" onclick="logout()">退出</button>
  `;
} else {
  navRight.innerHTML = `
    <a href="/login" class="nav-btn nav-btn-outline">登录</a>
    <a href="/login" class="nav-btn nav-btn-primary">注册</a>
  `;
  // Hide post link for guests (optional — they'll be redirected anyway)
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  window.top ? (window.top.location.href='/') : (window.location.href='/');
}

// ── Helpers ─────────────────────────────────────────────────

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

function formatDate(str) {
  const d = new Date(str.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function isImage(mime) { return mime && mime.startsWith('image/'); }

// ── Sidebar ──────────────────────────────────────────────────
function renderSidebarPosts(elId, posts, statKey, statIcon) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!posts.length) {
    el.innerHTML = '<div style="padding:12px 16px;font-size:12px;color:var(--ink-faint);font-weight:300">暂无数据</div>';
    return;
  }
  el.innerHTML = posts.map((p, i) => `
    <div class="sidebar-post-item" onclick="window.location.href='/article.html?id=${p.id}'"
         style="animation-delay:${0.05 + i * 0.04}s">
      <div class="sidebar-post-title">${p.title}</div>
      <div class="sidebar-post-meta">
        <span>${p.nickname || p.username}</span>
        <span>·</span>
        <span class="sidebar-post-stat">${statIcon} ${p[statKey] || 0}</span>
      </div>
    </div>`).join('');
}

function renderSidebarTags(posts) {
  const el = document.getElementById('sidebar-tags');
  if (!el) return;
  const hot = computeHotTags(posts).slice(0, 10);
  if (!hot.length) { el.innerHTML = '<span style="font-size:12px;color:var(--ink-faint);font-weight:300">暂无标签</span>'; return; }
  el.innerHTML = hot.map(([tag]) =>
    tagPillHtml(tag, {
      onclick: "toggleTagFilter('" + tag.replace(/'/g, "\'") + "')",
      extraCls: 'post-tag-pill'
    })
  ).join('');
}

function renderSidebar(posts) {
  // Hot: top 5 by views
  const hot    = [...posts].sort((a,b) => (b.view_count||0) - (a.view_count||0)).slice(0, 5);
  // Latest: top 5 by date
  const latest = [...posts].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  renderSidebarPosts('sidebar-hot',    hot,    'view_count', '👁');
  renderSidebarPosts('sidebar-latest', latest, 'comment_count', '💬');
  renderSidebarTags(posts);
}

// ── Load posts ───────────────────────────────────────────────
async function loadPosts() {
  const area = document.getElementById('list-area');
  area.innerHTML = '<div class="state-msg"><div class="icon" style="opacity:0.3">◌</div><p>加载中…</p></div>';
  try {
    const res = await fetch('/api/posts?sort=' + currentSort);
    const posts = await res.json();

    if (!posts.length && !activeTagFilters.size) {
      area.innerHTML = `
        <div class="state-msg">
          <div class="icon">✦</div>
          <p>还没有任何投稿，成为第一位作者吧</p>
          <a href="/post.html">立即投稿 →</a>
        </div>`;
      return;
    }

    // Cache posts for hot tag computation
    allPostsCache = posts;
    renderHotTags();
    renderSidebar(posts);

    // Filter by active tags (AND logic: post must have ALL selected tags)
    const filtered = activeTagFilters.size
      ? posts.filter(p => {
          if (!p.tags) return false;
          const postTags = p.tags.split(',').map(t => t.trim());
          return [...activeTagFilters].every(ft => postTags.includes(ft));
        })
      : posts;

    const sortLabel = { latest:'最新', views:'最多浏览', likes:'最多点赞', comments:'最多评论' };
    document.getElementById('post-count').textContent = `共 ${filtered.length} 篇`;
    document.getElementById('sort-info').textContent  = filtered.length ? `按${sortLabel[currentSort]}排列` : '';

    if (!filtered.length) {
      const tagList = [...activeTagFilters].map(t=>`#${t}`).join(' + ');
      area.innerHTML = `<div class="state-msg"><div class="icon">✦</div><p>没有找到标签为 ${tagList} 的投稿</p></div>`;
      return;
    }

    const list = document.createElement('div');
    list.className = 'post-list';

    filtered.forEach((p, i) => {
      const item = document.createElement('div');
      item.className = 'post-item';
      item.style.animationDelay = (i * 0.04) + 's';
      item.onclick = () => window.navigate ? window.navigate(`/article.html?id=${p.id}`) : (window.location.href=`/article.html?id=${p.id}`);

      const hasFiles = p.attachment_count > 0;
      const excerpt  = p.content ? p.content.slice(0, 120) + (p.content.length > 120 ? '…' : '') : '';

      item.innerHTML = `
        <div class="post-main">
          <div class="post-meta" style="display:flex;align-items:center;gap:8px">
            <a href="/profile.html?user=${encodeURIComponent(p.username)}"
               onclick="event.stopPropagation()"
               style="display:flex;align-items:center;gap:7px;text-decoration:none"
               title="查看主页">
              ${avatarHtml(p.nickname || p.username, p.avatar, 24)}
              <span class="post-author">${p.nickname || p.username}</span>
            </a>
            <span class="post-dot"></span>
            <span class="post-date">${formatDate(p.created_at)}</span>
          </div>
          <div class="post-title">${p.title}</div>
          ${excerpt ? `<div class="post-excerpt">${excerpt}</div>` : ''}
          ${p.tags ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:10px">
            ${p.tags.split(',').map(t=>t.trim()).filter(Boolean).map(t =>
              tagPillHtml(t, { active: activeTagFilters.has(t), onclick: "event.stopPropagation();toggleTagFilter('" + t.replace(/'/g,"\'") + "')", extraCls: 'post-tag-pill' })
            ).join('')}
          </div>` : ''}
          <div class="post-footer">
            ${hasFiles ? `<span class="post-tag has-files">📎 ${p.attachment_count} 个附件</span>` : ''}
            <span class="post-stat ${currentSort==='views'    ? 'highlight' : ''}"><span class="post-stat-icon">👁</span>${p.view_count    || 0}</span>
            <span class="post-stat ${currentSort==='comments' ? 'highlight' : ''}"><span class="post-stat-icon">💬</span>${p.comment_count || 0}</span>
            <span class="post-stat ${currentSort==='likes'    ? 'highlight' : ''}"><span class="post-stat-icon">♥</span>${p.like_count    || 0}</span>
          </div>
        </div>
        <div class="post-arrow">›</div>
      `;
      list.appendChild(item);
    });

    area.innerHTML = '';
    area.appendChild(list);

  } catch (e) {
    document.getElementById('list-area').innerHTML = `
      <div class="state-msg">
        <div class="icon">!</div>
        <p>加载失败，请确认服务器正在运行</p>
      </div>`;
  }
}

// ── Modal ────────────────────────────────────────────────────
async function openModal(id) {
  try {
    const res  = await fetch(`/api/posts/${id}`);
    const post = await res.json();

    document.getElementById('modal-author').textContent  = post.username;
    document.getElementById('modal-date').textContent    = formatDate(post.created_at);
    document.getElementById('modal-title').textContent   = post.title;
    document.getElementById('modal-content').textContent = post.content || '';

    const attachArea = document.getElementById('modal-attachments');
    const attachList = document.getElementById('attach-list');
    attachList.innerHTML = '';

    if (post.attachments && post.attachments.length > 0) {
      attachArea.style.display = 'block';
      post.attachments.forEach(a => {
        const url  = `/uploads/${a.filename}`;
        const item = document.createElement('a');
        item.className = 'attach-item';
        item.href   = url;
        item.target = '_blank';

        if (isImage(a.mimetype)) {
          item.innerHTML = `
            <img class="attach-preview" src="${url}" alt="${a.originalname}">
            <div class="attach-info">
              <div class="attach-name">${a.originalname}</div>
              <div class="attach-size">${formatSize(a.size)}</div>
            </div>
            <span class="attach-dl">查看</span>
          `;
        } else {
          item.innerHTML = `
            <div class="attach-icon">TXT</div>
            <div class="attach-info">
              <div class="attach-name">${a.originalname}</div>
              <div class="attach-size">${formatSize(a.size)}</div>
            </div>
            <span class="attach-dl">下载</span>
          `;
        }
        attachList.appendChild(item);
      });
    } else {
      attachArea.style.display = 'none';
    }

    document.getElementById('modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  } catch (e) {
    console.error(e);
  }
}

function closeModal(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModalDirect();
}

function closeModalDirect() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModalDirect();
});

// ── Init ─────────────────────────────────────────────────────
loadPosts();
