// ── Music management ─────────────────────────────────────────
// Panel switching handled by admin.danmaku.js (_switchPanel)

async function loadMusicList() {
  var el = document.getElementById('m-track-list');
  try {
    var res    = await fetch('/api/music');
    var tracks = await res.json();
    if (!tracks.length) { el.innerHTML = '<div class="music-empty">暂无曲目，请上传音频文件</div>'; return; }
    el.innerHTML = tracks.map(function(t, i) {
      return '<div class="music-track-item">' +
        '<span class="music-track-num">' + (i+1) + '</span>' +
        '<div class="music-track-info">' +
          '<div class="music-track-title">' + escHtml(t.title) + '</div>' +
          (t.artist ? '<div class="music-track-artist">' + escHtml(t.artist) + '</div>' : '') +
        '</div>' +
        '<button class="music-track-del" onclick="deleteTrack(' + t.id + ')">删除</button>' +
      '</div>';
    }).join('');
  } catch(e) { el.innerHTML = '<div class="music-empty">加载失败</div>'; }
}

async function uploadTrack() {
  var title  = document.getElementById('m-title').value.trim();
  var artist = document.getElementById('m-artist').value.trim();
  var file   = document.getElementById('m-file').files[0];
  if (!title) { showMToast('请填写曲目名称', '#c0392b'); return; }
  if (!file)  { showMToast('请选择音频文件', '#c0392b'); return; }
  var fd = new FormData();
  fd.append('file', file); fd.append('title', title);
  if (artist) fd.append('artist', artist);
  showMToast('上传中…', 'var(--ink-muted)');
  try {
    var res  = await fetch('/api/music', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
      body: fd
    });
    var data = await res.json();
    if (!res.ok) { showMToast(data.error || '上传失败', '#c0392b'); return; }
    showMToast('✓ 上传成功：' + data.title, '#27ae60');
    document.getElementById('m-title').value  = '';
    document.getElementById('m-artist').value = '';
    document.getElementById('m-file').value   = '';
    loadMusicList();
  } catch(e) { showMToast('上传失败', '#c0392b'); }
}

async function deleteTrack(id) {
  if (!confirm('确认删除该曲目？删除后无法恢复。')) return;
  await fetch('/api/music/' + id, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
  });
  loadMusicList();
}

function showMToast(msg, color) {
  var t = document.getElementById('m-toast');
  t.textContent = msg; t.style.color = color; t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.style.display = 'none'; }, 3500);
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Init ─────────────────────────────────────────────────────
loadAll();
