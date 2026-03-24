// ── Auth ──────────────────────────────────────────────────────
const token    = localStorage.getItem('token');
const username = localStorage.getItem('username');
let currentUser = null;
if (token) {
  try {
    currentUser = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  } catch(e) {}
}

// ── Nav right ──────────────────────────────────────────────────
const navRight = document.getElementById('nav-right');
if (token && username) {
  navRight.innerHTML = `
    <div class="nav-user">你好，<span>${username}</span></div>
    <a href="/profile.html" class="nav-btn">我的主页</a>
    <button class="nav-btn nav-btn-outline" onclick="logout()">退出</button>
  `;
} else {
  navRight.innerHTML = `
    <a href="/login" class="nav-btn nav-btn-outline">登录</a>
    <a href="/login" class="nav-btn nav-btn-primary">注册</a>
  `;
}
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  window.top ? (window.top.location.href='/') : (window.location.href='/');
}

// ── Helpers ───────────────────────────────────────────────────
// escHtml, avatarEl, relTime, buildReplyToTag come from thread-utils.js
const esc = escHtml; // local alias used throughout this file
function tagColor(tag) {
  let h = 0;
  for (const c of tag) h = (h * 31 + c.charCodeAt(0)) & 0xfffff;
  const hues = [210,180,150,120,270,30,0,300];
  const hue = hues[h % hues.length];
  return { bg:`hsl(${hue},45%,93%)`, text:`hsl(${hue},45%,38%)`, border:`hsl(${hue},35%,80%)` };
}
function renderTags(tagsStr) {
  if (!tagsStr) return '';
  return tagsStr.split(',').map(t=>t.trim()).filter(Boolean).map(t => {
    const c = tagColor(t);
    return `<span class="q-tag" style="background:${c.bg};color:${c.text};border:1px solid ${c.border}">#${esc(t)}</span>`;
  }).join('');
}
function navTo(url) {
  if (typeof window.navigate === 'function') window.navigate(url);
  else window.location.href = url;
}

// ── Tab state ─────────────────────────────────────────────────
let currentTab = 'open';
let allOpen = [], allSolved = [];

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tab-open').classList.toggle('q-tab-active', tab === 'open');
  document.getElementById('tab-solved').classList.toggle('q-tab-active', tab === 'solved');
  renderPanel();
}

function renderPanel() {
  const questions = currentTab === 'open' ? allOpen : allSolved;
  const emptyMsg  = currentTab === 'open' ? '暂无待解决的问题' : '暂无已解决的问题';
  const el = document.getElementById('q-list-panel');
  if (!el) return;
  if (!questions.length) {
    el.innerHTML = `<div class="state-msg"><div class="icon">✦</div><p>${emptyMsg}</p></div>`;
    return;
  }
  el.innerHTML = questions.map((q, i) => renderCard(q, i)).join('');
}

// ── Load questions ─────────────────────────────────────────────
async function loadQuestions() {
  try {
    const headers = token ? { Authorization: 'Bearer ' + token } : {};
    const data = await fetch('/api/qa/questions', { headers }).then(r => r.json());
    allOpen   = data.filter(q => q.status === 'open');
    allSolved = data.filter(q => q.status === 'solved');
    document.getElementById('q-count').textContent      = `共 ${data.length} 个问题`;
    document.getElementById('stat-open').textContent    = allOpen.length;
    document.getElementById('stat-solved').textContent  = allSolved.length;
    document.getElementById('open-count').textContent   = allOpen.length;
    document.getElementById('solved-count').textContent = allSolved.length;
    renderPanel();
  } catch(e) {
    console.error('loadQuestions:', e);
  }
}

function renderCard(q, idx) {
  const excerpt = q.content ? q.content.slice(0,140) + (q.content.length>140 ? '…' : '') : '';
  const votedCls = q.already_voted ? ' voted' : '';
  return `
    <div class="q-card" style="animation-delay:${idx*0.04}s" onclick="openDetail(${q.id})">
      <div class="q-card-head">
        <div class="q-card-title">${esc(q.title)}</div>
      </div>
      ${excerpt ? `<div class="q-card-excerpt">${esc(excerpt)}</div>` : ''}
      <div class="q-card-foot">
        <div class="q-card-foot-left">
          <button class="btn-vote-card${votedCls}" id="vbtn-${q.id}"
            onclick="event.stopPropagation();voteQuestion(${q.id})">
            👆 我也有！<span id="vcount-${q.id}">${q.vote_count||0}</span>
          </button>
          <span class="q-card-meta">${esc(q.display_name||q.username)} · ${relTime(q.created_at)}</span>
        </div>
        <div class="q-card-foot-right">
          ${renderTags(q.tags)}
          <span class="q-answer-count">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            ${q.answer_count}
          </span>
        </div>
      </div>
    </div>`;
}

// ── Detail modal ───────────────────────────────────────────────
let detailQuestionId = null;

async function openDetail(id) {
  detailQuestionId = id;
  const overlay = document.getElementById('detail-overlay');
  const inner   = document.getElementById('detail-inner');
  inner.innerHTML = '<div class="state-msg"><div class="icon">◌</div><p>加载中...</p></div>';
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  try {
    const data = await fetch(`/api/qa/questions/${id}`, {
      headers: token ? { Authorization: 'Bearer '+token } : {}
    }).then(r => r.json());
    inner.innerHTML = renderDetail(data);
    inner.scrollTop = 0;
  } catch(e) {
    inner.innerHTML = '<div class="state-msg"><p>加载失败，请重试</p></div>';
  }
}

function renderDetail(q) {
  const isQAuthor  = currentUser && currentUser.id === q.user_id;
  const canAnswer  = token && !currentUser.isAdmin && q.status === 'open';
  const canDelQ    = currentUser && (currentUser.id === q.user_id || currentUser.isAdmin);
  const badge = q.status === 'solved'
    ? '<span class="q-badge q-badge-solved">已解决</span>'
    : '<span class="q-badge q-badge-open">悬挂中</span>';
  const delQBtn = canDelQ
    ? `<button class="btn-del-q" onclick="deleteQuestion(${q.id})">删除问题</button>` : '';
  const tagsHtml = q.tags ? `<span class="detail-dot">·</span><span class="detail-tags">${renderTags(q.tags)}</span>` : '';

  const answersHtml = q.answers.length
    ? q.answers.map(a => renderAnswerItem(a, q)).join('')
    : '<div class="no-answers">还没有人回答，来成为第一个解答者吧 ✨</div>';

  const answerFormHtml = canAnswer ? `
    <div class="answer-form-wrap">
      <div class="answer-form-title">✍ 写下你的回答</div>
      <textarea class="answer-textarea" id="answer-input" placeholder="尽量详细说明解决思路…" rows="5"></textarea>
      <div class="answer-form-foot">
        <div class="form-error" id="answer-error"></div>
        <button class="btn-submit" onclick="submitAnswer(${q.id})">提交回答</button>
      </div>
    </div>`
    : (!token ? `<div class="login-hint"><a href="/login" onclick="navTo('/login');return false">登录</a>后参与回答</div>` : '');

  const votedCls = q.already_voted ? ' voted' : '';
  return `
    <div class="detail-q-head">
      <div class="detail-q-title-row">
        ${badge}
        <h2 class="detail-q-title">${esc(q.title)}</h2>
        ${delQBtn}
      </div>
      <div class="detail-q-meta">
        ${avatarEl(q.display_name||q.username, q.avatar, 22, true)}
        <a class="detail-q-author" href="/profile.html?u=${esc(q.username)}" onclick="navTo(this.href);return false">${esc(q.display_name||q.username)}</a>
        <span class="detail-dot">·</span>
        <span>${relTime(q.created_at)}</span>
        ${tagsHtml}
      </div>
      <button class="btn-vote-detail${votedCls}" id="vbtn-d-${q.id}" onclick="voteQuestion(${q.id})">
        👆 我也有相同问题！<span id="vcount-d-${q.id}">${q.vote_count||0}</span> 人
      </button>
    </div>
    <div class="detail-q-body">${esc(q.content)}</div>
    <div class="detail-answers-head">${q.answers.length} 个回答</div>
    <div id="detail-answers-list">${answersHtml}</div>
    ${answerFormHtml}`;
}

function renderReplyItem(r, q, topAnswerId) {
  const canDel   = currentUser && (currentUser.id === r.user_id || currentUser.isAdmin);
  const delBtn   = canDel ? `<button class="btn-del-a" onclick="deleteAnswer(${r.id},${q.id})">删除</button>` : '';
  const replyBtn = token ? `<button class="btn-reply" onclick="toggleReplyFormForReply(${topAnswerId},${q.id},'${esc(r.display_name||r.username)}',${r.user_id})">回复</button>` : '';
  const replyToTag = buildReplyToTag(r.reply_to);
  return `
    <div class="reply-item" id="answer-${r.id}">
      <div class="reply-head">
        ${avatarEl(r.display_name||r.username, r.avatar, 20, true)}
        <a class="answer-author" href="/profile.html?u=${esc(r.username)}" onclick="navTo(this.href);return false">${esc(r.display_name||r.username)}</a>
        ${replyToTag}
        <span class="detail-dot">·</span>
        <span class="answer-date">${relTime(r.created_at)}</span>
      </div>
      <div class="reply-body">${esc(r.content)}</div>
      <div class="reply-foot">
        <button class="btn-like${r.already_liked?' liked':''}" id="like-btn-${r.id}" onclick="likeAnswer(${r.id})">♥ <span id="like-count-${r.id}">${r.like_count}</span></button>
        ${replyBtn}
        ${delBtn}
      </div>
    </div>`;
}

function renderAnswerItem(a, q) {
  const isAAuthor = currentUser && currentUser.id === a.user_id;
  const isQAuthor = currentUser && currentUser.id === q.user_id;
  const canAccept = isQAuthor && q.status === 'open' && !a.is_accepted;
  const canDel    = currentUser && (isAAuthor || currentUser.isAdmin);
  const acceptedBadge = a.is_accepted ? '<span class="answer-accepted-badge">✓ 已采纳</span>' : '';
  const acceptBtn     = canAccept ? `<button class="btn-accept" onclick="acceptAnswer(${a.id},${q.id})">采纳此回答</button>` : '';
  const delBtn        = canDel ? `<button class="btn-del-a" onclick="deleteAnswer(${a.id},${q.id})">删除</button>` : '';
  const replyBtn      = token ? `<button class="btn-reply" onclick="toggleReplyForm(${a.id},${q.id},'${esc(a.display_name||a.username)}',${a.user_id})">回复</button>` : '';

  const repliesHtml = (a.replies && a.replies.length)
    ? `<div class="answer-replies">${a.replies.map(r => renderReplyItem(r, q, a.id)).join('')}</div>`
    : '';

  const replyFormHtml = token ? `
    <div class="reply-form-wrap" id="reply-form-${a.id}" style="display:none">
      <textarea class="reply-textarea" id="reply-input-${a.id}" placeholder="回复 ${esc(a.display_name||a.username)}…" rows="2"></textarea>
      <div class="reply-form-foot">
        <div class="form-error" id="reply-error-${a.id}"></div>
        <div style="display:flex;gap:8px">
          <button class="btn-cancel" onclick="cancelReply(${a.id})">取消</button>
          <button class="btn-submit" style="padding:5px 14px;font-size:12px" onclick="submitReply(${a.id},${q.id})">发送</button>
        </div>
      </div>
    </div>` : '';

  return `
    <div class="answer-item${a.is_accepted?' answer-accepted':''}" id="answer-${a.id}">
      <div class="answer-head">
        ${avatarEl(a.display_name||a.username, a.avatar, 26, true)}
        <a class="answer-author" href="/profile.html?u=${esc(a.username)}" onclick="navTo(this.href);return false">${esc(a.display_name||a.username)}</a>
        <span class="detail-dot">·</span>
        <span class="answer-date">${relTime(a.created_at)}</span>
        ${acceptedBadge}
      </div>
      <div class="answer-body">${esc(a.content)}</div>
      <div class="answer-foot">
        <button class="btn-like${a.already_liked?' liked':''}" id="like-btn-${a.id}" onclick="likeAnswer(${a.id})">♥ <span id="like-count-${a.id}">${a.like_count}</span></button>
        ${replyBtn}
        ${acceptBtn}
        ${delBtn}
      </div>
      ${repliesHtml}
      ${replyFormHtml}
    </div>`;
}

function closeDetailModal(e) {
  if (e.target === document.getElementById('detail-overlay')) closeDetailDirect();
}
function closeDetailDirect() {
  document.getElementById('detail-overlay').classList.remove('open');
  document.body.style.overflow = '';
  detailQuestionId = null;
}

// ── Ask modal ──────────────────────────────────────────────────
function openAskModal() {
  if (!token) { navTo('/login'); return; }
  document.getElementById('ask-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('ask-title').focus(), 100);
}
function closeAskModal(e) {
  if (e.target === document.getElementById('ask-overlay')) closeAskDirect();
}
function closeAskDirect() {
  document.getElementById('ask-overlay').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('ask-form').reset();
  document.getElementById('ask-error').textContent = '';
}

async function submitQuestion(e) {
  e.preventDefault();
  const title   = document.getElementById('ask-title').value.trim();
  const content = document.getElementById('ask-content').value.trim();
  const tags    = document.getElementById('ask-tags').value.trim();
  const errEl   = document.getElementById('ask-error');
  const btn     = document.getElementById('ask-submit');
  errEl.textContent = '';
  btn.disabled = true; btn.textContent = '发布中…';
  try {
    const r = await fetch('/api/qa/questions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization:'Bearer '+token },
      body: JSON.stringify({ title, content, tags })
    });
    const data = await r.json();
    if (!r.ok) { errEl.textContent = data.error || '发布失败'; return; }
    closeAskDirect();
    await loadQuestions();
    openDetail(data.id);
  } catch(err) {
    errEl.textContent = '网络错误，请重试';
  } finally {
    btn.disabled = false; btn.textContent = '发布问题';
  }
}

// ── Actions ───────────────────────────────────────────────────
async function submitAnswer(questionId) {
  const input   = document.getElementById('answer-input');
  const errEl   = document.getElementById('answer-error');
  const content = input ? input.value.trim() : '';
  if (!content) { if(errEl) errEl.textContent = '请填写回答内容'; return; }
  if (errEl) errEl.textContent = '';
  try {
    const r = await fetch(`/api/qa/questions/${questionId}/answers`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization:'Bearer '+token },
      body: JSON.stringify({ content })
    });
    const data = await r.json();
    if (!r.ok) { if(errEl) errEl.textContent = data.error||'提交失败'; return; }
    await openDetail(questionId);
    await loadQuestions();
  } catch(err) {
    if(errEl) errEl.textContent = '网络错误，请重试';
  }
}

async function acceptAnswer(answerId, questionId) {
  if (!confirm('确定采纳此回答？采纳后问题将标记为已解决。')) return;
  try {
    const r = await fetch(`/api/qa/answers/${answerId}/accept`, {
      method: 'POST', headers: { Authorization:'Bearer '+token }
    });
    if (!r.ok) { const d = await r.json(); alert(d.error); return; }
    await openDetail(questionId);
    await loadQuestions();
  } catch(e) { alert('网络错误，请重试'); }
}

async function voteQuestion(qId) {
  if (!token) { navTo('/login'); return; }
  try {
    const r = await fetch(`/api/qa/questions/${qId}/vote`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + token }
    });
    const data = await r.json();
    if (!r.ok) return;
    // Update card button (if visible in list)
    const cardBtn = document.getElementById(`vbtn-${qId}`);
    const cardCnt = document.getElementById(`vcount-${qId}`);
    if (cardBtn) { cardBtn.className = 'btn-vote-card' + (data.voted ? ' voted' : ''); }
    if (cardCnt) cardCnt.textContent = data.vote_count;
    // Update detail button (if modal is open)
    const detBtn = document.getElementById(`vbtn-d-${qId}`);
    const detCnt = document.getElementById(`vcount-d-${qId}`);
    if (detBtn) { detBtn.className = 'btn-vote-detail' + (data.voted ? ' voted' : ''); }
    if (detCnt) detCnt.textContent = data.vote_count;
    // Also sync in-memory cache so re-render is consistent
    [allOpen, allSolved].forEach(arr => {
      const q = arr.find(x => x.id === qId);
      if (q) { q.vote_count = data.vote_count; q.already_voted = data.voted; }
    });
  } catch(e) {}
}

async function likeAnswer(answerId) {
  if (!token) { navTo('/login'); return; }
  try {
    const r = await fetch(`/api/qa/like/answer/${answerId}`, {
      method: 'POST', headers: { Authorization:'Bearer '+token }
    });
    const data = await r.json();
    if (!r.ok) return;
    const btn = document.getElementById(`like-btn-${answerId}`);
    const cnt = document.getElementById(`like-count-${answerId}`);
    if (btn) btn.className = 'btn-like' + (data.liked ? ' liked' : '');
    if (cnt) cnt.textContent = data.like_count;
  } catch(e) {}
}

async function deleteQuestion(id) {
  if (!confirm('确定删除这个问题？相关回答也会一并删除。')) return;
  try {
    const r = await fetch(`/api/qa/questions/${id}`, {
      method: 'DELETE', headers: { Authorization:'Bearer '+token }
    });
    if (!r.ok) { const d = await r.json(); alert(d.error); return; }
    closeDetailDirect();
    await loadQuestions();
  } catch(e) { alert('网络错误，请重试'); }
}

function toggleReplyForm(answerId, questionId, targetName, targetUserId) {
  const form = document.getElementById(`reply-form-${answerId}`);
  if (!form) return;
  const visible = form.style.display !== 'none';
  form.style.display = visible ? 'none' : '';
  if (!visible) {
    form.dataset.replyToUserId = targetUserId || '';
    form.dataset.replyToName   = targetName   || '';
    const input = document.getElementById(`reply-input-${answerId}`);
    if (input) { input.placeholder = `回复 ${targetName||''}…`; input.focus(); }
  }
}

// Reply-to-reply: reuse the parent answer's form, store target user id for notification
function toggleReplyFormForReply(topAnswerId, questionId, targetName, targetUserId) {
  const form  = document.getElementById(`reply-form-${topAnswerId}`);
  const input = document.getElementById(`reply-input-${topAnswerId}`);
  if (!form) return;
  form.style.display = '';
  form.dataset.replyToUserId = targetUserId || '';
  form.dataset.replyToName   = targetName   || '';
  if (input) {
    input.placeholder = `回复 ${targetName}…`;
    input.focus();
  }
}

function cancelReply(answerId) {
  const form  = document.getElementById(`reply-form-${answerId}`);
  const input = document.getElementById(`reply-input-${answerId}`);
  if (form)  form.style.display = 'none';
  if (input) input.value = '';
}

async function submitReply(parentAnswerId, questionId) {
  const input  = document.getElementById(`reply-input-${parentAnswerId}`);
  const errEl  = document.getElementById(`reply-error-${parentAnswerId}`);
  const form   = document.getElementById(`reply-form-${parentAnswerId}`);
  const content = input ? input.value.trim() : '';
  if (!content) { if (errEl) errEl.textContent = '请填写回复内容'; return; }
  if (errEl) errEl.textContent = '';
  const replyToUserId = form && form.dataset.replyToUserId ? parseInt(form.dataset.replyToUserId) : undefined;
  const replyToName   = form ? (form.dataset.replyToName || '') : '';
  try {
    const r = await fetch(`/api/qa/questions/${questionId}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ content, parent_id: parentAnswerId, reply_to: replyToName || undefined, reply_to_user_id: replyToUserId })
    });
    const data = await r.json();
    if (!r.ok) { if (errEl) errEl.textContent = data.error || '提交失败'; return; }
    await openDetail(questionId);
    await loadQuestions();
  } catch(err) {
    if (errEl) errEl.textContent = '网络错误，请重试';
  }
}

async function deleteAnswer(answerId, questionId) {
  if (!confirm('确定删除这个回答？')) return;
  try {
    const r = await fetch(`/api/qa/answers/${answerId}`, {
      method: 'DELETE', headers: { Authorization:'Bearer '+token }
    });
    if (!r.ok) { const d = await r.json(); alert(d.error); return; }
    await openDetail(questionId);
    await loadQuestions();
  } catch(e) { alert('网络错误，请重试'); }
}

// ── Init ──────────────────────────────────────────────────────
loadQuestions().then(function () {
  // Support ?open=ID from cover page Q&A strip
  var m = location.search.match(/[?&]open=(\d+)/);
  if (m) openDetail(parseInt(m[1], 10));
});
