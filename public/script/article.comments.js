// ── Comments ────────────────────────────────────────────────
let currentPostId = null;

function formatDateFull(str) {
  const d = new Date(str.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function buildCommentsSection(postId) {
  currentPostId = postId;
  const section = document.getElementById('comments-section');
  if (!section) return;

  // Avatar — fetch own avatar from server if not cached
  const myAv = window._myAvatar !== undefined ? window._myAvatar : null;
  const myAvatarEl = token && username ? avatarEl(username, myAv, 36)
    : `<div style="width:36px;height:36px;border-radius:50%;background:var(--rule);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--ink-faint);flex-shrink:0">?</div>`;

  // Input area
  const inputHtml = token
    ? `<div class="comment-input-row">
        ${myAvatarEl}
        <div class="comment-input-wrap">
          <textarea class="comment-textarea" id="comment-textarea"
            placeholder="写下你的想法…" maxlength="500"></textarea>
          <div class="comment-form-footer">
            <div class="comment-hint"><span id="char-count">0</span> / 500</div>
            <button class="btn-comment" id="btn-comment"><span>发表评论</span></button>
          </div>
        </div>
      </div>`
    : `<div class="comment-input-row">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--rule);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--ink-faint);flex-shrink:0">?</div>
        <div class="comment-input-wrap">
          <textarea class="comment-textarea" placeholder="登录后才能发表评论" disabled></textarea>
          <div class="comment-form-footer">
            <div class="comment-hint">请 <a href="/login">登录</a> 后发表评论</div>
          </div>
        </div>
      </div>`;

  section.innerHTML = `
    <div class="comments-header">
      <div class="comments-title">评论</div>
      <div class="comments-count" id="comments-count"></div>
    </div>
    <div class="comment-form">${inputHtml}</div>
    <div id="comment-list" class="comment-list"></div>
  `;

  // Bind events after DOM is built
  const ta = document.getElementById('comment-textarea');
  if (ta) {
    ta.addEventListener('input', () => {
      const cc = document.getElementById('char-count');
      if (cc) cc.textContent = ta.value.length;
    });
    // Submit on Ctrl+Enter
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitComment();
    });
  }

  const btn = document.getElementById('btn-comment');
  if (btn) btn.addEventListener('click', submitComment);

  // Load existing comments
  loadComments();
}

// ── Like handlers ────────────────────────────────────────────
async function toggleLike(target, targetId, btn) {
  if (!token) return;
  btn.disabled = true;
  try {
    const res  = await fetch('/api/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ target, target_id: targetId })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || '操作失败'); return; }
    const heart = btn.querySelector('.like-heart');
    const count = btn.querySelector('.like-count');
    if (data.liked) {
      btn.classList.add('liked');
      heart.textContent = '♥';
    } else {
      btn.classList.remove('liked');
      heart.textContent = '♡';
    }
    count.textContent = data.count;
  } catch(e) {
    alert('操作失败，请重试');
  } finally {
    btn.disabled = false;
  }
}

async function toggleCommentLike(btn) {
  if (!token) return;
  const commentId = Number(btn.dataset.id);
  btn.disabled = true;
  try {
    const res  = await fetch('/api/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ target: 'comment', target_id: commentId })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || '操作失败'); return; }
    const countEl = btn.querySelector('.clc-' + commentId);
    if (data.liked) {
      btn.classList.add('liked');
      btn.querySelector('span').textContent = '♥';
    } else {
      btn.classList.remove('liked');
      btn.querySelector('span').textContent = '♡';
    }
    if (countEl) countEl.textContent = data.count;
  } catch(e) {
    alert('操作失败，请重试');
  } finally {
    btn.disabled = false;
  }
}

async function deleteComment(commentId, btn) {
  if (!confirm('确认删除这条评论？')) return;
  btn.disabled = true;
  btn.textContent = '删除中…';
  try {
    const res  = await fetch(`/api/admin/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || '删除失败'); btn.disabled = false; btn.textContent = '删除'; return; }
    // Animate out then reload
    const item = btn.closest('.comment-item');
    item.style.transition = 'opacity 0.2s, transform 0.2s';
    item.style.opacity = '0';
    item.style.transform = 'translateX(12px)';
    setTimeout(() => loadComments(), 220);
  } catch(e) {
    alert('删除失败，请重试');
    btn.disabled = false;
    btn.textContent = '删除';
  }
}

// Active reply state
let replyTarget = null; // { id, username, userId }

function openReplyBox(commentId, authorName, targetUserId) {
  // Close any open reply box first
  document.querySelectorAll('.reply-box.open').forEach(b => b.classList.remove('open'));
  if (replyTarget && replyTarget.id === commentId && replyTarget.username === authorName) {
    replyTarget = null; return; // toggle off same target
  }
  replyTarget = { id: commentId, username: authorName, userId: targetUserId || null };
  const box = document.getElementById('reply-box-' + commentId);
  if (!box) return;
  // Update header to show current reply target
  const toEl = box.querySelector('.reply-box-to');
  if (toEl) toEl.textContent = authorName;
  // Update submit button target
  const submitBtn = box.querySelector('.btn-reply-submit');
  if (submitBtn) {
    submitBtn.onclick = () => submitReply(commentId, authorName);
  }
  box.classList.add('open');
  const ta = box.querySelector('.reply-textarea');
  if (ta) { ta.value = ''; ta.focus(); box.querySelector('.reply-char-count').textContent = '0 / 500'; }
}

function closeReplyBox(commentId) {
  const box = document.getElementById('reply-box-' + commentId);
  if (box) box.classList.remove('open');
  if (replyTarget && replyTarget.id === commentId) replyTarget = null;
}

async function submitReply(commentId, authorName) {
  if (!token) { window.top ? (window.top.location.href='/') : (window.location.href='/'); return; }
  const box = document.getElementById('reply-box-' + commentId);
  const ta  = box.querySelector('.reply-textarea');
  const btn = box.querySelector('.btn-reply-submit');
  const content = ta.value.trim();
  if (!content) return;
  btn.disabled = true;
  try {
    const res = await fetch(`/api/posts/${currentPostId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ content, parent_id: commentId, reply_to: authorName, reply_to_user_id: replyTarget?.userId || null })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || '回复失败'); return; }
    closeReplyBox(commentId);
    await loadComments();
    // Scroll to new reply
    const newEl = document.querySelector(`[data-comment-id="${data.id}"]`);
    if (newEl) newEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch(e) {
    alert('发送失败，请重试');
  } finally {
    btn.disabled = false;
  }
}

// rootId: the top-level comment id this reply belongs to (for reply box targeting)
function buildCommentEl(cm, adminMode, isReply = false, rootId = null) {
  const div = document.createElement('div');
  div.className = (isReply ? 'comment-item reply-item' : 'comment-item') + (adminMode ? ' is-admin' : '');
  div.dataset.commentId = cm.id;

  const cmDisplayName = cm.display_name || cm.username || '匿名';
  const cmProfileUrl  = cm.username === 'admin' ? null : '/profile.html?user=' + encodeURIComponent(cm.username);

  const likedClass  = cm.already_liked ? ' liked' : '';
  const likedHeart  = cm.already_liked ? '♥' : '♡';
  const canLike     = token ? '' : 'disabled title="登录后才能点赞"';
  const replyToHtml = buildReplyToTag(cm.reply_to);

  const triggerRootId = isReply ? (rootId || cm.parent_id) : cm.id;
  const replyTrigger  = token
    ? `<button class="comment-reply-trigger"
         data-cid="${triggerRootId}"
         data-author="${escHtml(cmDisplayName)}"
         data-username="${escHtml(cm.username)}"
         data-uid="${cm.comment_user_id || ''}">↩ 回复</button>`
    : '';
  const cmAvatarBlock = cmProfileUrl
    ? `<a href="${cmProfileUrl}" style="display:block;flex-shrink:0;text-decoration:none" title="查看主页">${avatarEl(cmDisplayName, cm.avatar, 36)}</a>`
    : avatarEl(cmDisplayName, cm.avatar, 36);

  div.innerHTML = `
    ${cmAvatarBlock}
    <div class="comment-body">
      ${replyToHtml}
      <div class="comment-meta">
        ${cmProfileUrl
          ? `<a href="${cmProfileUrl}" class="comment-author" style="text-decoration:none;color:inherit" title="查看主页">${escHtml(cmDisplayName)}</a>`
          : `<span class="comment-author">${escHtml(cmDisplayName)}</span>`
        }
        <span class="comment-dot"></span>
        <span class="comment-date">${formatDateFull(cm.created_at)}</span>
      </div>
      <div class="comment-text">${escHtml(cm.content)}</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="comment-like-btn${likedClass}" data-id="${cm.id}" ${canLike}>
          <span>${likedHeart}</span>
          <span class="clc-${cm.id}">${cm.like_count || 0}</span>
        </button>
        ${replyTrigger}
      </div>
    </div>
    <button class="comment-delete" data-id="${cm.id}" title="删除此评论">删除</button>
  `;
  return div;
}

async function loadComments() {
  const list    = document.getElementById('comment-list');
  const countEl = document.getElementById('comments-count');
  if (!list) return;

  try {
    const res      = await fetch(`/api/posts/${currentPostId}/comments`, {
      headers: token ? { 'Authorization': 'Bearer ' + token } : {}
    });
    const comments = await res.json();
    const adminMode = localStorage.getItem('isAdmin') === 'true';

    // Total = all comments including replies
    if (countEl) countEl.textContent = comments.length ? `${comments.length} 条` : '';

    if (comments.length === 0) {
      list.innerHTML = '<div class="no-comments">还没有评论，来留下第一条吧</div>';
      return;
    }

    list.innerHTML = '';

    // Separate top-level and replies
    const topLevel = comments.filter(cm => !cm.parent_id);
    const replies  = comments.filter(cm =>  cm.parent_id);

    topLevel.forEach((cm, i) => {
      const wrap = document.createElement('div');
      wrap.style.animationDelay = (i * 0.04) + 's';

      const cmEl = buildCommentEl(cm, adminMode, false);
      wrap.appendChild(cmEl);

      // Reply box (only for logged-in users)
      if (token) {
        const box = document.createElement('div');
        box.className = 'reply-box';
        box.id = 'reply-box-' + cm.id;
        const cmDN = cm.display_name || cm.username || '匿名';
        box.innerHTML = `
          <div class="reply-box-header">
            <span>回复 <span class="reply-box-to">${escHtml(cmDN)}</span></span>
          </div>
          <textarea class="reply-textarea" maxlength="500" placeholder="写下你的回复…"></textarea>
          <div class="reply-box-footer">
            <span class="reply-char-count">0 / 500</span>
            <div class="reply-box-btns">
              <button class="btn-reply-cancel" onclick="closeReplyBox(${cm.id})">取消</button>
              <button class="btn-reply-submit" onclick="submitReply(${cm.id}, '${escHtml(cmDN)}')"><span>发送回复</span></button>
            </div>
          </div>
        `;
        // Char counter
        box.querySelector('.reply-textarea').addEventListener('input', e => {
          box.querySelector('.reply-char-count').textContent = e.target.value.length + ' / 500';
        });
        // Ctrl+Enter submit
        box.querySelector('.reply-textarea').addEventListener('keydown', e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitReply(cm.id, cm.display_name || cm.username || '匿名');
        });
        wrap.appendChild(box);
      }

      // Replies to this comment (all hang under cm.id as root)
      const myReplies = replies.filter(r => r.parent_id == cm.id);
      if (myReplies.length > 0) {
        const indent = document.createElement('div');
        indent.className = 'reply-indent';
        myReplies.forEach(r => indent.appendChild(buildCommentEl(r, adminMode, true, cm.id)));
        wrap.appendChild(indent);
      }

      list.appendChild(wrap);
    });

    // Bind like buttons
    if (token) {
      list.querySelectorAll('.comment-like-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleCommentLike(btn));
      });
    }

    // Bind reply triggers (data-cid = root comment id, data-author = person being replied to)
    list.querySelectorAll('.comment-reply-trigger').forEach(btn => {
      btn.addEventListener('click', () => {
        openReplyBox(Number(btn.dataset.cid), btn.dataset.author, btn.dataset.uid ? Number(btn.dataset.uid) : null);
      });
    });

    // Bind delete buttons
    if (adminMode) {
      list.querySelectorAll('.comment-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteComment(Number(btn.dataset.id), btn));
      });
    }

    // Re-open reply box if was active before reload
    if (replyTarget) {
      const box = document.getElementById('reply-box-' + replyTarget.id);
      if (box) box.classList.add('open');
    }

  } catch(e) { console.error('加载评论失败', e); }
}

async function submitComment() {
  if (!token) { window.top ? (window.top.location.href='/') : (window.location.href='/'); return; }
  const ta  = document.getElementById('comment-textarea');
  const btn = document.getElementById('btn-comment');
  if (!ta || !btn) return;
  const content = ta.value.trim();
  if (!content) return;

  btn.classList.add('loading'); btn.disabled = true;
  try {
    const res  = await fetch(`/api/posts/${currentPostId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '评论失败');
      return;
    }
    // Clear input
    ta.value = '';
    const cc = document.getElementById('char-count');
    if (cc) cc.textContent = '0';
    // Reload comments
    await loadComments();
    // Scroll to bottom of list
    const list = document.getElementById('comment-list');
    if (list && list.lastElementChild) {
      list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } catch(e) {
    alert('发送失败，请重试');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ── Init ─────────────────────────────────────────────────────
window._myAvatar = null;
if (token && username) {
  fetch('/api/profile/' + encodeURIComponent(username))
    .then(r => r.ok ? r.json() : null)
    .then(d => { if (d) window._myAvatar = d.avatar || null; })
    .catch(() => {});
}
loadArticle();
