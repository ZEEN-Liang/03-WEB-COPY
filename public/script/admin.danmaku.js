// ── Danmaku management ────────────────────────────────────────

// Shared panel switcher — overrides the 2-panel version in admin.music.js
function _switchPanel(active) {
  ['posts', 'music', 'danmaku'].forEach(function (name) {
    var navEl = document.getElementById('nav-' + name);
    if (navEl) navEl.classList.toggle('active', name === active);
  });

  var musicPanel   = document.getElementById('music-panel');
  var danmakuPanel = document.getElementById('danmaku-panel');
  var statsRow     = document.getElementById('stats-row');
  var toolbar      = document.getElementById('posts-toolbar');
  var postsTbl     = document.querySelector('.page > .table-wrap');

  var isPostsPanel = active === 'posts';
  if (musicPanel)   musicPanel.classList.toggle('active',   active === 'music');
  if (danmakuPanel) danmakuPanel.classList.toggle('active', active === 'danmaku');
  if (statsRow)  statsRow.style.display  = isPostsPanel ? '' : 'none';
  if (toolbar)   toolbar.style.display   = isPostsPanel ? '' : 'none';
  if (postsTbl)  postsTbl.style.display  = isPostsPanel ? '' : 'none';
}

// Override previous 2-panel functions
function showMusicPanel()    { _switchPanel('music');    loadMusicList(); }
function showPostsPanel()    { _switchPanel('posts');    loadAll(); }
function showDanmakuPanel()  { _switchPanel('danmaku');  loadDanmakuList(); }

// ── Load & render ─────────────────────────────────────────────
async function loadDanmakuList() {
  var tbody = document.getElementById('dm-tbody');
  var countEl = document.getElementById('dm-count');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#8fa8c4">加载中…</td></tr>';

  try {
    var res  = await fetch('/api/admin/danmaku', { headers: { Authorization: 'Bearer ' + token } });
    var rows = await res.json();

    countEl.textContent = '共 ' + rows.length + ' 条';

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#8fa8c4">暂无弹幕</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(function (d) {
      return '<tr>' +
        '<td style="color:#8fa8c4">' + d.id + '</td>' +
        '<td>' +
          '<span class="dm-bubble" style="background:' + escHtml(d.color) + '22;border-left:3px solid ' + escHtml(d.color) + ';padding:3px 10px;border-radius:3px;font-size:13px">' +
          escHtml(d.content) + '</span>' +
        '</td>' +
        '<td>' +
          '<span style="display:inline-flex;align-items:center;gap:6px">' +
          '<span style="width:14px;height:14px;border-radius:50%;background:' + escHtml(d.color) + ';flex-shrink:0;display:inline-block"></span>' +
          '<span style="font-size:12px;color:#8fa8c4">' + escHtml(d.color) + '</span>' +
          '</span>' +
        '</td>' +
        '<td style="font-size:13px">' + escHtml(d.display_name) + '</td>' +
        '<td style="font-size:12px;color:#8fa8c4">' + formatDate(d.created_at) + '</td>' +
        '<td>' +
          '<button class="act-btn act-delete" style="padding:4px 12px;font-size:12px" onclick="deleteDanmaku(' + d.id + ')">删除</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#e05b73">加载失败</td></tr>';
  }
}

function deleteDanmaku(id) {
  document.getElementById('confirm-icon').textContent  = '🗑';
  document.getElementById('confirm-title').textContent = '删除弹幕';
  document.getElementById('confirm-sub').textContent   = '确定删除这条弹幕？此操作不可撤销。';
  document.getElementById('confirm-ok').onclick = async function () {
    closeConfirm();
    try {
      var res = await fetch('/api/admin/danmaku/' + id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) { var d = await res.json(); showToast(d.error || '删除失败', 'error'); return; }
      showToast('已删除', 'success');
      loadDanmakuList();
    } catch (e) {
      showToast('网络错误', 'error');
    }
  };
  document.getElementById('confirm-overlay').classList.add('open');
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
