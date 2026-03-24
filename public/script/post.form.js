// ── Auth guard ──────────────────────────────────────────────
const token    = localStorage.getItem('token');
const username = localStorage.getItem('username');

if (!token || !username) {
  // Not logged in → redirect to login
  window.top ? (window.top.location.href='/') : (window.location.href='/');
}

document.getElementById('nav-username').textContent = username;

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  window.top ? (window.top.location.href='/') : (window.location.href='/');
}

// ── Character counter ───────────────────────────────────────
function updateCount() {
  const len = document.getElementById('post-title').value.length;
  document.getElementById('title-count').textContent = len;
}

// ── Tag color (same palette as forum.html) ───────────────────
const TAG_PALETTE = [
  { bg:'rgba(46,122,181,0.08)',  border:'rgba(46,122,181,0.28)',  text:'#25679c' },
  { bg:'rgba(41,128,185,0.08)', border:'rgba(41,128,185,0.28)', text:'#1a6fa5' },
  { bg:'rgba(39,174,96,0.08)',  border:'rgba(39,174,96,0.28)',  text:'#1e8449' },
  { bg:'rgba(142,68,173,0.08)', border:'rgba(142,68,173,0.28)', text:'#7d3c98' },
  { bg:'rgba(46,122,181,0.08)', border:'rgba(46,122,181,0.28)', text:'#ca6f1e' },
  { bg:'rgba(22,160,133,0.08)', border:'rgba(22,160,133,0.28)', text:'#148a72' },
  { bg:'rgba(74,159,212,0.08)', border:'rgba(74,159,212,0.28)', text:'#2e7ab5' },
  { bg:'rgba(231,76,60,0.08)',  border:'rgba(231,76,60,0.28)',  text:'#2e7ab5' },
  { bg:'rgba(52,152,219,0.08)', border:'rgba(52,152,219,0.28)', text:'#1a7ab5' },
  { bg:'rgba(26,188,156,0.08)', border:'rgba(26,188,156,0.28)', text:'#17a589' },
  { bg:'rgba(243,156,18,0.08)', border:'rgba(243,156,18,0.28)', text:'#b7770d' },
  { bg:'rgba(155,89,182,0.08)', border:'rgba(155,89,182,0.28)', text:'#8e44ad' },
];
function tagHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return Math.abs(h) % TAG_PALETTE.length;
}
function tagColor(tag) { return TAG_PALETTE[tagHash(tag)]; }

// ── Tag suggestions from backend ──────────────────────────────
let tagSuggestCache = null;  // { tag: count }

async function fetchTagSuggestions() {
  if (tagSuggestCache) return tagSuggestCache;
  try {
    const res   = await fetch('/api/posts');
    const posts = await res.json();
    const count = {};
    posts.forEach(p => {
      if (!p.tags) return;
      p.tags.split(',').map(t => t.trim()).filter(Boolean)
        .forEach(t => { count[t] = (count[t] || 0) + 1; });
    });
    tagSuggestCache = count;
  } catch(e) { tagSuggestCache = {}; }
  return tagSuggestCache;
}

function renderTagSuggestions(query) {
  const dropdown = document.getElementById('tag-suggest-dropdown');
  const list     = document.getElementById('tag-suggest-list');
  const head     = document.getElementById('tag-suggest-head');
  if (!dropdown || !list) return;

  const counts = tagSuggestCache || {};
  const q      = query.trim().toLowerCase();

  // Build sorted list: filter by query if present, else show all, max 10
  let entries = Object.entries(counts)
    .filter(([tag]) => !q || tag.toLowerCase().includes(q))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (!entries.length && q) {
    // No match — show the typed tag as a new option
    entries = [[query.trim(), 0]];
  }

  if (!entries.length) { dropdown.classList.remove('open'); return; }

  head.textContent = q ? `搜索「${query.trim()}」` : '推荐标签';
  const atLimit = postTags.length >= 5;

  list.innerHTML = entries.map(([tag, n]) => {
    const col     = tagColor(tag);
    const already = postTags.includes(tag);
    const disabled = already || atLimit;
    return `<button class="tag-suggest-btn ${disabled ? 'already' : ''}"
      style="background:${col.bg};border-color:${col.border};color:${col.text}"
      ${disabled ? 'disabled' : `onclick="addTagSuggestion('${tag.replace(/'/g,"\\'")}')"`}>
      #${tag}${n > 0 ? `<span class="tag-suggest-count">${n}</span>` : ''}
    </button>`;
  }).join('');

  dropdown.classList.add('open');
}

function addTagSuggestion(tag) {
  if (postTags.includes(tag) || postTags.length >= 5) return;
  postTags.push(tag);
  renderPostTags();
  // Re-render suggestions to update "already added" state
  const input = document.getElementById('tag-text-input');
  renderTagSuggestions(input ? input.value : '');
  if (input) input.focus();
}

function closeTagSuggestions() {
  const dd = document.getElementById('tag-suggest-dropdown');
  if (dd) dd.classList.remove('open');
}

// Close when clicking outside
document.addEventListener('click', e => {
  if (!document.getElementById('tag-input-wrap')?.contains(e.target)) {
    closeTagSuggestions();
  }
});

// ── Tag handling ──────────────────────────────────────────────
let postTags = [];

function renderPostTags() {
  const wrap  = document.getElementById('tags-wrap');
  const input = document.getElementById('tag-text-input');
  wrap.querySelectorAll('.post-tag-chip').forEach(el => el.remove());
  postTags.forEach((tag, i) => {
    const col  = tagColor(tag);
    const chip = document.createElement('div');
    chip.className = 'post-tag-chip';
    chip.style.cssText = `background:${col.bg};border-color:${col.border};color:${col.text}`;
    chip.innerHTML = `#${tag}<button class="tag-chip-remove" style="color:${col.text}" data-i="${i}">×</button>`;
    wrap.insertBefore(chip, input);
  });
  wrap.querySelectorAll('.tag-chip-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      postTags.splice(Number(btn.dataset.i), 1);
      renderPostTags();
      renderTagSuggestions(document.getElementById('tag-text-input')?.value || '');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('tag-text-input');
  const wrap  = document.getElementById('tags-wrap');
  if (!input) return;

  // Pre-fetch tag data silently
  fetchTagSuggestions();

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = input.value.trim().replace(/,/g, '');
      if (val && !postTags.includes(val) && postTags.length < 5) {
        postTags.push(val); renderPostTags();
      }
      input.value = '';
      closeTagSuggestions();
    } else if (e.key === 'Backspace' && !input.value && postTags.length) {
      postTags.pop(); renderPostTags();
      renderTagSuggestions('');
    } else if (e.key === 'Escape') {
      closeTagSuggestions();
    }
  });
  input.addEventListener('input', () => {
    renderTagSuggestions(input.value);
  });
  input.addEventListener('focus', async () => {
    wrap.classList.add('focus');
    await fetchTagSuggestions();
    renderTagSuggestions(input.value);
  });
  input.addEventListener('blur', () => {
    // Delay so click on suggestion registers first
    setTimeout(() => {
      const val = input.value.trim().replace(/,/g, '');
      if (val && !postTags.includes(val) && postTags.length < 5) {
        postTags.push(val); renderPostTags(); input.value = '';
      }
      wrap.classList.remove('focus');
    }, 150);
  });
});

// ── File handling ──────────────────────────────────────────────
let selectedFiles = [];

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function isImage(file) {
  return file.type.startsWith('image/');
}

// File type groups for icon display
const FILE_ICONS = {
  image:    { types: ['image/jpeg','image/png','image/gif','image/webp'],                           label: 'IMG',  color: '#2e7ab5' },
  pdf:      { types: ['application/pdf'],                                                            label: 'PDF',  color: '#e74c3c' },
  zip:      { types: ['application/zip','application/x-zip-compressed','application/x-rar-compressed','application/vnd.rar'], label: 'ZIP', color: '#8e44ad' },
  word:     { types: ['application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'], label: 'DOC', color: '#2980b9' },
  excel:    { types: ['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], label: 'XLS', color: '#27ae60' },
  ppt:      { types: ['application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'], label: 'PPT', color: '#e67e22' },
  audio:    { types: ['audio/mpeg','audio/wav','audio/ogg','audio/flac','audio/aac'],               label: 'AUD',  color: '#16a085' },
  video:    { types: ['video/mp4','video/webm','video/ogg'],                                        label: 'VID',  color: '#2c3e50' },
  text:     { types: ['text/plain','text/markdown'],                                                 label: 'TXT',  color: '#4a6fa5' },
};

const ALLOWED_TYPES = Object.values(FILE_ICONS).flatMap(g => g.types);

function getFileIcon(file) {
  for (const [, g] of Object.entries(FILE_ICONS)) {
    if (g.types.includes(file.type) || (file.type === '' && file.name.match(/\.(md|zip|rar)$/i))) {
      return g;
    }
  }
  // Fallback: guess from extension
  const ext = file.name.split('.').pop().toLowerCase();
  const extMap = { pdf:'PDF', zip:'ZIP', rar:'RAR', doc:'DOC', docx:'DOC', xls:'XLS', xlsx:'XLS', ppt:'PPT', pptx:'PPT', mp3:'AUD', wav:'AUD', flac:'AUD', aac:'AUD', mp4:'VID', webm:'VID', txt:'TXT', md:'TXT' };
  return { label: extMap[ext] || ext.toUpperCase().slice(0,4) || 'FILE', color: '#888' };
}

function addFiles(newFiles) {
  for (const f of newFiles) {
    if (selectedFiles.length >= 20) { showToast('最多只能上传 20 个文件', 'error'); break; }
    const ext = f.name.split('.').pop().toLowerCase();
    const knownExt = ['jpg','jpeg','png','gif','webp','txt','md','pdf','zip','rar','doc','docx','xls','xlsx','ppt','pptx','mp3','wav','flac','aac','ogg','mp4','webm'].includes(ext);
    if (!ALLOWED_TYPES.includes(f.type) && !knownExt) {
      showToast(`"${f.name}" 格式不支持`, 'error'); continue;
    }
    if (f.size > 50 * 1024 * 1024) {
      showToast(`"${f.name}" 超过 50MB 限制`, 'error'); continue;
    }
    if (selectedFiles.find(x => x.name === f.name && x.size === f.size)) {
      showToast(`"${f.name}" 已添加`, 'error'); continue;
    }
    selectedFiles.push(f);
  }
  renderFileList();
}

function renderFileList() {
  const list = document.getElementById('file-list');
  list.innerHTML = '';

  selectedFiles.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'file-item';

    if (isImage(f)) {
      const reader = new FileReader();
      reader.onload = e => {
        const thumb = document.createElement('img');
        thumb.className = 'file-thumb';
        thumb.src = e.target.result;
        item.insertBefore(thumb, item.firstChild);
      };
      reader.readAsDataURL(f);
    } else {
      const ico = getFileIcon(f);
      const icon = document.createElement('div');
      icon.className = 'file-icon';
      icon.style.cssText = `background:${ico.color}18;color:${ico.color};border-color:${ico.color}40;font-size:10px;font-weight:700;letter-spacing:0.04em`;
      icon.textContent = ico.label;
      item.appendChild(icon);
    }

    item.innerHTML += `
      <div class="file-info">
        <div class="file-name">${f.name}</div>
        <div class="file-size">${formatSize(f.size)}</div>
      </div>
      <button class="file-remove" onclick="removeFile(${i})" title="移除">×</button>
    `;
    list.appendChild(item);
  });
}

function removeFile(i) {
  selectedFiles.splice(i, 1);
  renderFileList();
}

function onFileSelect(e) {
  addFiles(Array.from(e.target.files));
  e.target.value = ''; // reset so same file can be re-added
}

function onDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('dragover');
}

function onDragLeave() {
  document.getElementById('upload-zone').classList.remove('dragover');
}

function onDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('dragover');
  addFiles(Array.from(e.dataTransfer.files));
}

// ── Submit ──────────────────────────────────────────────────
async function submitPost() {
  const title   = document.getElementById('post-title').value.trim();
  const content = document.getElementById('post-content').value.trim();
  const btn     = document.getElementById('btn-submit');

  if (!title) { showToast('请填写标题', 'error'); return; }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('content', content);
  if (postTags.length) formData.append('tags', postTags.join(','));
  selectedFiles.forEach(f => formData.append('files', f));

  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || '投稿失败', 'error');
    } else {
      document.getElementById('form-area').style.display = 'none';
      document.getElementById('success-panel').classList.add('show');
    }
  } catch (e) {
    showToast('无法连接服务器', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

function resetForm() {
  document.getElementById('post-title').value = '';
  document.getElementById('post-content').value = '';
  document.getElementById('title-count').textContent = '0';
  postTags = []; renderPostTags();
  selectedFiles = [];
  renderFileList();
  document.getElementById('form-area').style.display = 'block';
  document.getElementById('success-panel').classList.remove('show');
}

// ── Toast ───────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}
