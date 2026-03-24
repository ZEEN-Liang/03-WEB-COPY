// ── 风蓝轻音部 · 左下角播放器 ────────────────────────────────
(function () {
  'use strict';

  var STORAGE_KEY = 'flan_player';
  function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch(e) { return {}; } }
  function saveState(p) { var s = loadState(); Object.assign(s, p); localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

  // ── CSS ─────────────────────────────────────────────────────
  var CSS = `
    /* ── 左下角触发标签 ── */
    #fp-tab {
      position: fixed; left: 0; bottom: 32px; z-index: 9999;
      display: flex; align-items: center; gap: 6px;
      padding: 8px 14px 8px 10px;
      background: rgba(8,16,34,0.72);
      border: 1px solid rgba(140,200,255,0.18); border-left: none;
      border-radius: 0 22px 22px 0;
      color: rgba(200,230,255,0.62);
      font-family: 'Noto Sans SC', sans-serif; font-size: 12px; font-weight: 300;
      cursor: pointer; user-select: none;
      backdrop-filter: blur(14px) saturate(1.4);
      box-shadow: 2px 2px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04);
      transition: all 0.25s cubic-bezier(.4,0,.2,1);
    }
    #fp-tab:hover {
      color: rgba(200,235,255,0.9);
      background: rgba(16,32,64,0.82);
      box-shadow: 3px 3px 20px rgba(80,160,255,0.15), inset 0 1px 0 rgba(255,255,255,0.06);
      transform: translateX(2px);
    }
    #fp-tab .fp-tab-note { font-size: 15px; display: inline-block; }
    body:not(.fp-open) #fp-tab .fp-tab-note { animation: fp-float 2.4s ease-in-out infinite; }
    body.fp-open #fp-tab .fp-tab-note { animation: fp-pulse-bright 1.4s ease-in-out infinite; }
    #fp-tab .fp-tab-txt  { font-size: 11px; letter-spacing: 0.12em; }
    #fp-tab .fp-tab-arr  { font-size: 10px; opacity: 0.45; transition: transform 0.3s cubic-bezier(.4,0,.2,1), opacity 0.2s; }
    #fp-tab:hover .fp-tab-arr { opacity: 0.75; }
    body.fp-open #fp-tab .fp-tab-arr { transform: rotate(180deg); opacity: 0.65; }

    @keyframes fp-float {
      0%,100% { transform: translateY(0) rotate(0deg); opacity: .5; }
      50%      { transform: translateY(-2px) rotate(10deg); opacity: .85; }
    }
    @keyframes fp-pulse-bright {
      0%,100% { opacity: .75; transform: scale(1); }
      50%      { opacity: 1;   transform: scale(1.18); }
    }

    /* ── 主播放器浮窗 ── */
    #fp-player {
      position: fixed; left: 12px; bottom: 72px; z-index: 9998;
      width: 300px;
      background: rgba(8,16,34,0.78);
      border: 1px solid rgba(140,200,255,0.13);
      border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.03),
                  inset 0 1px 0 rgba(255,255,255,0.05);
      backdrop-filter: blur(20px) saturate(1.6);
      overflow: visible;
      transform: translateY(20px) scale(0.95);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.34s cubic-bezier(.34,1.26,.64,1),
                  opacity  0.28s cubic-bezier(.4,0,.2,1);
    }
    body.fp-open #fp-player {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: auto;
    }

    /* Player body wrapper */
    .fp-player-body {
      border-radius: 16px;
      overflow: hidden;
      position: relative;
    }
    /* Shimmer line at top */
    .fp-player-body::before {
      content: '';
      position: absolute; top: 0; left: 20px; right: 20px; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(160,215,255,0.18), transparent);
      pointer-events: none;
    }

    /* Now playing */
    .fp-now {
      display: flex; align-items: center; gap: 12px;
      padding: 18px 16px 12px;
    }

    /* Disc */
    .fp-disc {
      width: 46px; height: 46px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, #0d2444, #1a5280, #2e7ab5);
      display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
      box-shadow: 0 0 0 2px rgba(120,190,255,0.1), 0 0 14px rgba(50,130,210,0.18);
      transition: box-shadow 0.5s;
    }
    .fp-disc.playing {
      animation: fp-disc-glow 3s ease-in-out infinite;
    }
    @keyframes fp-disc-glow {
      0%,100% { box-shadow: 0 0 0 2px rgba(120,190,255,0.18), 0 0 14px rgba(60,145,230,0.22); }
      50%      { box-shadow: 0 0 0 3px rgba(130,200,255,0.38), 0 0 22px rgba(80,165,245,0.45); }
    }
    .fp-disc-ico { font-size: 18px; color: rgba(185,220,255,0.65); transition: opacity 0.35s; }
    .fp-disc.playing .fp-disc-ico { opacity: 0; }

    /* Equalizer bars */
    .fp-eq {
      position: absolute; display: flex; align-items: flex-end; gap: 3px;
      height: 18px; opacity: 0; transition: opacity 0.35s;
      pointer-events: none;
    }
    .fp-disc.playing .fp-eq { opacity: 1; }
    .fp-eq i {
      display: block; width: 3px; border-radius: 2px;
      background: linear-gradient(to top, rgba(100,185,255,0.9), rgba(180,225,255,0.7));
    }
    .fp-eq i:nth-child(1) { animation: fp-bar 0.72s ease-in-out infinite alternate; }
    .fp-eq i:nth-child(2) { animation: fp-bar 0.50s ease-in-out infinite alternate; animation-delay: 0.12s; }
    .fp-eq i:nth-child(3) { animation: fp-bar 0.85s ease-in-out infinite alternate; animation-delay: 0.04s; }
    @keyframes fp-bar {
      from { height: 3px;  opacity: 0.45; }
      to   { height: 17px; opacity: 1; }
    }

    .fp-now-info { flex:1; min-width:0; overflow:hidden; }
    .fp-now-title {
      font-size:13px; font-weight:500; color:rgba(238,250,255,0.96);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      transition: color 0.3s;
      display:inline-block; max-width:100%;
    }
    .fp-now-title.fp-scroll { text-overflow:clip; animation: fp-marquee var(--fp-sd,6s) linear infinite; }
    .fp-now-sub {
      font-size:10px; font-weight:400; color:rgba(185,220,248,0.72);
      margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      display:inline-block; max-width:100%;
    }
    .fp-now-sub.fp-scroll { text-overflow:clip; animation: fp-marquee var(--fp-sd,5s) linear infinite; }
    @keyframes fp-marquee {
      0%, 18%   { transform: translateX(0); }
      82%, 100% { transform: translateX(var(--fp-sa, 0px)); }
    }
    .fp-now-empty { color:rgba(180,215,245,0.35); font-style:italic; }

    .fp-upload-mini {
      background:none; border:1px solid rgba(140,200,255,0.2); border-radius:14px;
      color:rgba(180,220,255,0.52); font-size:10px; font-family:inherit;
      padding:3px 8px; cursor:pointer; transition:all 0.2s; white-space:nowrap;
      display:none;
    }
    .fp-upload-mini:hover {
      background:rgba(100,175,255,0.1); color:rgba(205,235,255,0.82);
      border-color:rgba(140,200,255,0.38);
    }
    .fp-upload-mini.show { display:block; }

    /* Progress */
    .fp-seek-row { display:flex; align-items:center; gap:8px; padding:0 16px 8px; }
    .fp-time { font-size:9px; color:rgba(185,220,248,0.58); font-family:monospace; flex-shrink:0; }
    .fp-seek {
      flex:1; -webkit-appearance:none; appearance:none;
      height:3px; border-radius:2px; cursor:pointer; outline:none;
      background: linear-gradient(to right,
        rgba(120,192,245,0.62) 0%,
        rgba(120,192,245,0.62) var(--pct,0%),
        rgba(120,192,245,0.12) var(--pct,0%),
        rgba(120,192,245,0.12) 100%);
      transition: height 0.15s;
    }
    .fp-seek:hover { height: 4px; }
    .fp-seek::-webkit-slider-thumb {
      -webkit-appearance:none; width:12px; height:12px;
      border-radius:50%; background:#8dcef8; cursor:pointer;
      box-shadow: 0 0 0 3px rgba(100,185,255,0.18), 0 0 8px rgba(100,185,255,0.45);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .fp-seek:hover::-webkit-slider-thumb {
      transform: scale(1.25);
      box-shadow: 0 0 0 4px rgba(100,185,255,0.25), 0 0 12px rgba(100,185,255,0.58);
    }

    /* Controls */
    .fp-ctrl-row {
      display:flex; align-items:center; justify-content:center;
      gap:4px; padding:2px 16px 12px;
    }
    .fp-btn {
      background:none; border:none; cursor:pointer;
      width:34px; height:34px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      color:rgba(195,228,252,0.65); font-size:13px;
      transition: color 0.2s, background 0.2s, transform 0.15s;
    }
    .fp-btn:hover {
      color:rgba(205,238,255,0.82);
      background:rgba(100,175,255,0.09);
      transform: scale(1.12);
    }
    .fp-btn:active { transform: scale(0.9); }
    .fp-btn-play {
      width:42px; height:42px; font-size:17px;
      background: rgba(55,125,205,0.18);
      border: 1px solid rgba(120,190,255,0.26);
      color: rgba(205,238,255,0.85);
      transition: color 0.2s, background 0.2s, transform 0.15s, box-shadow 0.25s;
    }
    .fp-btn-play:hover {
      background: rgba(55,125,205,0.32);
      border-color: rgba(140,205,255,0.42);
      box-shadow: 0 0 18px rgba(75,160,240,0.3);
      transform: scale(1.1);
    }
    .fp-btn-play:active { transform: scale(0.93); }
    .fp-btn-list { font-size:12px; }
    .fp-btn-loop { font-size:11px; }

    /* Volume */
    .fp-vol-row { display:flex; align-items:center; gap:8px; padding:0 16px 14px; }
    .fp-vol-icon { font-size:11px; color:rgba(185,220,248,0.48); }
    .fp-volume {
      flex:1; -webkit-appearance:none; appearance:none;
      height:2px; border-radius:2px; cursor:pointer; outline:none;
      background: linear-gradient(to right,
        rgba(175,215,245,0.38) 0%,
        rgba(175,215,245,0.38) var(--pct,80%),
        rgba(140,195,255,0.09) var(--pct,80%),
        rgba(140,195,255,0.09) 100%);
    }
    .fp-volume::-webkit-slider-thumb {
      -webkit-appearance:none; width:10px; height:10px;
      border-radius:50%; background:rgba(195,232,255,0.55); cursor:pointer;
      box-shadow: 0 0 4px rgba(140,195,255,0.28);
      transition: transform 0.15s, background 0.15s;
    }
    .fp-volume:hover::-webkit-slider-thumb {
      transform: scale(1.25);
      background: rgba(200,235,255,0.82);
    }

    /* Playlist drawer */
    .fp-pl-drawer {
      max-height: 0;
      overflow: hidden;
      border-top: 0px solid rgba(140,200,255,0.08);
      transition: max-height 0.38s cubic-bezier(.4,0,.2,1),
                  border-top-width 0s 0.38s;
    }
    .fp-pl-drawer.open {
      max-height: min(240px, calc(100vh - 320px));
      overflow-y: auto;
      border-top-width: 1px;
      transition: max-height 0.38s cubic-bezier(.4,0,.2,1);
    }
    .fp-pl-drawer::-webkit-scrollbar { width:3px; }
    .fp-pl-drawer::-webkit-scrollbar-thumb { background:rgba(140,200,255,0.14); border-radius:2px; }
    .fp-pl-head {
      display:flex; align-items:center; justify-content:space-between;
      padding:10px 16px 6px;
      font-size:9px; font-weight:500; letter-spacing:0.14em; text-transform:uppercase;
      color:rgba(185,220,248,0.50);
      border-bottom: 1px solid rgba(140,200,255,0.06);
    }
    .fp-pl-item {
      display:flex; align-items:center; gap:8px;
      padding:8px 16px; cursor:pointer;
      transition: background 0.15s, border-left-color 0.15s;
      border-bottom: 1px solid rgba(140,200,255,0.04);
      border-left: 2px solid transparent;
    }
    .fp-pl-item:hover {
      background: rgba(75,150,225,0.08);
      border-left-color: rgba(120,190,255,0.22);
    }
    .fp-pl-item.active {
      background: rgba(55,125,205,0.13);
      border-left-color: rgba(140,210,255,0.55);
    }
    .fp-pl-num  { width:16px; font-size:9px; color:rgba(185,220,248,0.40); text-align:center; flex-shrink:0; }
    .fp-pl-num.on { color:#7ec8f5; }
    .fp-pl-info { flex:1; min-width:0; }
    .fp-pl-title {
      font-size:12px; color:rgba(210,235,255,0.78); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      transition: color 0.15s;
    }
    .fp-pl-item:hover .fp-pl-title  { color:rgba(225,245,255,0.92); }
    .fp-pl-item.active .fp-pl-title { color:rgba(225,245,255,0.96); }
    .fp-pl-meta { font-size:9px; color:rgba(185,220,248,0.50); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .fp-pl-del { background:none; border:none; color:rgba(195,228,252,0.18); font-size:12px; cursor:pointer; padding:2px 4px; transition:color 0.15s; flex-shrink:0; }
    .fp-pl-del:hover { color:rgba(215,75,65,0.65); }
    .fp-pl-empty { padding:20px 16px; text-align:center; font-size:11px; color:rgba(185,220,248,0.38); font-style:italic; }

    /* Upload panel */
    .fp-upload-panel {
      max-height: 0;
      overflow: hidden;
      border-top: 0px solid rgba(140,200,255,0.08);
      transition: max-height 0.35s cubic-bezier(.4,0,.2,1);
    }
    .fp-upload-panel.open {
      max-height: 380px;
      overflow-y: auto;
      border-top-width: 1px;
    }
    .fp-upload-inner { padding: 14px 16px; display: flex; flex-direction: column; }
    .fp-upload-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
    .fp-upload-head span { font-size:12px; font-weight:400; color:rgba(210,238,255,0.85); }
    .fp-upload-x {
      background:none; border:none; color:rgba(205,232,255,0.50); font-size:16px; cursor:pointer; line-height:1;
      transition: color 0.15s, transform 0.2s;
    }
    .fp-upload-x:hover { color:rgba(220,245,255,0.85); transform: rotate(90deg); }
    .fp-uf { margin-bottom:10px; }
    .fp-uf label { display:block; font-size:9px; letter-spacing:0.12em; text-transform:uppercase; color:rgba(185,220,248,0.55); margin-bottom:4px; }
    .fp-uf input[type=text] {
      width:100%; padding:6px 10px; box-sizing:border-box;
      background:rgba(255,255,255,0.04); border:1px solid rgba(140,200,255,0.15);
      border-radius:6px; color:rgba(220,240,255,0.86); font-family:inherit; font-size:12px; outline:none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .fp-uf input[type=text]:focus {
      border-color:rgba(140,200,255,0.42);
      box-shadow: 0 0 0 3px rgba(100,175,255,0.07);
    }
    .fp-uf input[type=text]::placeholder { color:rgba(175,212,242,0.15); }
    .fp-file-lbl {
      display:block; padding:8px 12px; text-align:center;
      background:rgba(255,255,255,0.025); border:1px dashed rgba(140,200,255,0.17);
      border-radius:6px; font-size:11px; color:rgba(175,212,242,0.3); cursor:pointer;
      transition: all 0.2s;
    }
    .fp-file-lbl:hover {
      border-color:rgba(140,200,255,0.38); color:rgba(200,232,255,0.56);
      background:rgba(100,175,255,0.05);
    }
    .fp-file-lbl.has { border-color:rgba(120,200,240,0.48); color:rgba(165,220,248,0.82); background:rgba(75,155,220,0.06); }
    .fp-sub-btn {
      width:100%; padding:8px; margin-top:4px;
      background: rgba(65,145,225,0.18); border:1px solid rgba(120,190,255,0.28);
      border-radius:6px; color:rgba(205,238,255,0.82); font-family:inherit; font-size:12px;
      cursor:pointer; transition: all 0.2s;
    }
    .fp-sub-btn:hover { background:rgba(55,125,205,0.36); box-shadow: 0 0 14px rgba(75,160,240,0.2); }
    .fp-sub-btn:disabled { opacity:0.28; cursor:not-allowed; }
    .fp-upload-msg { margin-top:6px; font-size:10px; text-align:center; color:rgba(185,220,248,0.65); min-height:14px; }
  `;

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ── HTML ─────────────────────────────────────────────────────
  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div id="fp-tab" onclick="window._fp.toggle()">' +
      '<span class="fp-tab-note">♪</span>' +
      '<span class="fp-tab-txt">音乐</span>' +
      '<span class="fp-tab-arr">›</span>' +
    '</div>' +

    '<div id="fp-player">' +
      '<div class="fp-player-body">' +
      '<div class="fp-now">' +
        '<div class="fp-disc" id="fp-disc"><span class="fp-disc-ico">♪</span><div class="fp-eq"><i></i><i></i><i></i></div></div>' +
        '<div class="fp-now-info">' +
          '<div class="fp-now-title fp-now-empty" id="fp-title">暂无播放</div>' +
          '<div class="fp-now-sub" id="fp-sub"></div>' +
        '</div>' +
        '<button class="fp-upload-mini" id="fp-upload-mini" onclick="window._fp.openUpload()">＋</button>' +
      '</div>' +

      '<div class="fp-seek-row">' +
        '<span class="fp-time" id="fp-cur">0:00</span>' +
        '<input class="fp-seek" id="fp-seek" type="range" min="0" max="100" value="0" step="0.1">' +
        '<span class="fp-time" id="fp-dur">0:00</span>' +
      '</div>' +

      '<div class="fp-ctrl-row">' +
        '<button class="fp-btn" id="fp-shuffle" title="随机">⇄</button>' +
        '<button class="fp-btn" id="fp-prev">⏮</button>' +
        '<button class="fp-btn fp-btn-play" id="fp-play">▶</button>' +
        '<button class="fp-btn" id="fp-next">⏭</button>' +
        '<button class="fp-btn fp-btn-loop" id="fp-loop" title="顺序">↻</button>' +
        '<button class="fp-btn fp-btn-list" id="fp-list" title="曲目">☰</button>' +
      '</div>' +

      '<div class="fp-vol-row">' +
        '<span class="fp-vol-icon">♪</span>' +
        '<input class="fp-volume" id="fp-vol" type="range" min="0" max="1" step="0.02" value="0.8">' +
      '</div>' +
      '<div class="fp-pl-drawer" id="fp-pl">' +
        '<div class="fp-pl-head"><span>播放列表</span><span id="fp-count">0 首</span></div>' +
        '<div id="fp-pl-body"><div class="fp-pl-empty">加载中…</div></div>' +
      '</div>' +
      '<div class="fp-upload-panel" id="fp-upload-panel">' +
        '<div class="fp-upload-inner">' +
          '<div class="fp-upload-head"><span>投稿音乐</span><button class="fp-upload-x" onclick="window._fp.closeUpload()">×</button></div>' +
          '<div class="fp-uf"><label>曲目名称 *</label><input type="text" id="fp-u-title" placeholder="歌曲名称"></div>' +
          '<div class="fp-uf"><label>艺术家</label><input type="text" id="fp-u-artist" placeholder="艺术家 / 乐队"></div>' +
          '<div class="fp-uf"><label>音频文件 *</label>' +
            '<label class="fp-file-lbl" id="fp-file-lbl" for="fp-u-file">点击选择 MP3 / FLAC / WAV</label>' +
            '<input type="file" id="fp-u-file" style="display:none" accept=".mp3,.flac,.wav,.ogg,.aac,audio/*">' +
          '</div>' +
          '<button class="fp-sub-btn" id="fp-sub-btn" onclick="window._fp.submitUpload()">上 传</button>' +
          '<div class="fp-upload-msg" id="fp-upload-msg"></div>' +
        '</div>' +
      '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);

  // File input: label update + auto-parse tags
  var currentTmpFile = null;
  var currentDuration = 0;
  var currentCover = null;
  var parseAbort = null;

  wrap.querySelector('#fp-u-file').addEventListener('change', function() {
    var f = this.files[0];
    var lbl  = wrap.querySelector('#fp-file-lbl');
    var msg  = wrap.querySelector('#fp-upload-msg');
    var titleEl  = wrap.querySelector('#fp-u-title');
    var artistEl = wrap.querySelector('#fp-u-artist');
    if (!f) {
      lbl.textContent = '点击选择 MP3 / FLAC / WAV';
      lbl.classList.remove('has');
      currentTmpFile = null;
      return;
    }
    lbl.textContent = f.name;
    lbl.classList.add('has');
    currentTmpFile = null;

    // Show parsing indicator
    msg.style.color = 'rgba(200,223,247,0.5)';
    msg.textContent = '正在读取标签…';

    var token = localStorage.getItem('token');
    var fd = new FormData();
    fd.append('file', f);

    fetch('/api/music/parse', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: fd
    }).then(function(r) { return r.json(); }).then(function(data) {
      msg.textContent = '';
      if (data.parseError) {
        msg.style.color = 'rgba(200,223,247,0.35)';
        msg.textContent = '未能读取标签，请手动填写';
        return;
      }
      currentTmpFile = data.tmpFile;
      currentDuration = data.duration || 0;
      currentCover = data.cover || null;
      // Auto-fill if fields are empty
      if (data.title && !titleEl.value.trim()) {
        titleEl.value = data.title;
        titleEl.style.borderColor = 'rgba(74,159,212,0.5)';
        setTimeout(function() { titleEl.style.borderColor = ''; }, 1200);
      }
      if (data.artist && !artistEl.value.trim()) {
        artistEl.value = data.artist;
        artistEl.style.borderColor = 'rgba(74,159,212,0.5)';
        setTimeout(function() { artistEl.style.borderColor = ''; }, 1200);
      }
      if (data.title || data.artist) {
        msg.style.color = '#4a9fd4';
        msg.textContent = '✓ 已自动识别标签';
        setTimeout(function() { msg.textContent = ''; }, 2000);
      } else {
        msg.style.color = 'rgba(200,223,247,0.35)';
        msg.textContent = '未找到标签，请手动填写';
      }
    }).catch(function() {
      msg.style.color = 'rgba(200,223,247,0.35)';
      msg.textContent = '标签读取失败，请手动填写';
      currentTmpFile = null;
    });
  });

  // ── Audio engine ─────────────────────────────────────────────
  var audio = new Audio();
  window._fpAudio = audio;   // expose for rain intensity sync

  // ── Web Audio analyser (initialised on first play gesture) ───
  var _audioCtx = null, _analyserNode = null;
  function initAnalyser() {
    if (_audioCtx) { if (_audioCtx.state === 'suspended') _audioCtx.resume(); return; }
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      _analyserNode = _audioCtx.createAnalyser();
      _analyserNode.fftSize = 256;
      _audioCtx.createMediaElementSource(audio).connect(_analyserNode);
      _analyserNode.connect(_audioCtx.destination);
      window._fpAnalyser = _analyserNode;
    } catch(e) {}
  }
  var playlist = [], curIdx = -1, seeking = false, loopMode = 0, plOpen = false;
  var LOOP_LABELS = ['↻','↻¹','⇄'], LOOP_TIPS = ['顺序','单曲','随机'];

  function fmt(s) { s=Math.floor(s||0); return Math.floor(s/60)+':'+('0'+(s%60)).slice(-2); }
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function applyScroll(el) {
    el.classList.remove('fp-scroll');
    el.style.removeProperty('--fp-sa');
    el.style.removeProperty('--fp-sd');
    requestAnimationFrame(function() {
      var overflow = el.scrollWidth - el.offsetWidth;
      if (overflow > 6) {
        el.style.setProperty('--fp-sa', '-' + overflow + 'px');
        el.style.setProperty('--fp-sd', Math.max(4, overflow / 28).toFixed(1) + 's');
        el.classList.add('fp-scroll');
      }
    });
  }

  function updateNow() {
    var t = playlist[curIdx];
    var ttl = wrap.querySelector('#fp-title');
    var sub = wrap.querySelector('#fp-sub');
    var disc = wrap.querySelector('#fp-disc');
    if (t) {
      ttl.textContent = t.title; ttl.classList.remove('fp-now-empty');
      sub.textContent = (t.artist||'')+(t.uploader?' · '+t.uploader:'');
    } else {
      ttl.textContent = '暂无播放'; ttl.classList.add('fp-now-empty'); sub.textContent = '';
    }
    applyScroll(ttl);
    applyScroll(sub);
    wrap.querySelector('#fp-play').textContent = audio.paused ? '▶' : '⏸';
    disc.classList.toggle('playing', !audio.paused);
    var note = document.querySelector('#fp-tab .fp-tab-note');
    if (note) note.style.animationPlayState = audio.paused ? 'paused' : 'running';
  }

  function updateList() {
    var body = wrap.querySelector('#fp-pl-body');
    var token = localStorage.getItem('token');
    var myName = localStorage.getItem('username');
    var isAdmin = localStorage.getItem('isAdmin') === 'true';
    wrap.querySelector('#fp-count').textContent = playlist.length + ' 首';
    if (!playlist.length) { body.innerHTML = '<div class="fp-pl-empty">暂无曲目，登录后可投稿</div>'; return; }
    body.innerHTML = playlist.map(function(t, i) {
      var active = i === curIdx ? ' active' : '';
      var canDel = token && (isAdmin || t.uploader === myName);
      var del = canDel ? '<button class="fp-pl-del" onclick="event.stopPropagation();window._fp.del('+t.id+')" title="删除">×</button>' : '';
      return '<div class="fp-pl-item'+active+'" onclick="window._fp.play('+i+')">' +
        '<span class="fp-pl-num'+(i===curIdx?' on':'')+'">'+( i+1)+'</span>' +
        '<div class="fp-pl-info"><div class="fp-pl-title">'+esc(t.title)+'</div>' +
        '<div class="fp-pl-meta">'+esc(t.artist||'')+(t.uploader?(t.artist?' · ':'')+t.uploader:'')+'</div></div>' +
        del + '</div>';
    }).join('');
  }

  function playTrack(idx) {
    if (!playlist.length) return;
    initAnalyser();
    idx = ((idx % playlist.length) + playlist.length) % playlist.length;
    curIdx = idx; var t = playlist[idx];
    audio.src = t.url; audio.load(); audio.play().catch(function(){});
    saveState({trackIdx:idx, trackId:t.id, trackUrl:t.url, playing:true, progress:0});
    updateNow(); updateList();
    prefetchNext(idx);
  }

  function nextTrack() {
    if (!playlist.length) return;
    if (loopMode === 2) { playTrack(Math.floor(Math.random()*playlist.length)); return; }
    if (loopMode === 1) { playTrack(curIdx); return; }
    playTrack(curIdx + 1 < playlist.length ? curIdx + 1 : 0);
  }

  function prefetchNext(idx) {
    var ni = (idx+1) % playlist.length;
    var nu = playlist[ni] && playlist[ni].url;
    if (!nu) return;
    try {
      var lk = document.getElementById('fp-prefetch') || document.createElement('link');
      lk.id='fp-prefetch'; lk.rel='prefetch'; lk.as='audio';
      lk.href=nu; document.head.appendChild(lk);
    } catch(e){}
  }

  // Controls
  wrap.querySelector('#fp-play').addEventListener('click', function() {
    if (!playlist.length) return;
    if (curIdx < 0) { playTrack(0); return; }
    if (audio.paused) { initAnalyser(); audio.play().catch(function(){}); saveState({playing:true}); }
    else { audio.pause(); saveState({playing:false}); }
    updateNow();
  });
  wrap.querySelector('#fp-prev').addEventListener('click', function() {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    playTrack(loopMode===2 ? Math.floor(Math.random()*playlist.length) : curIdx-1);
  });
  wrap.querySelector('#fp-next').addEventListener('click', function() { nextTrack(); });
  audio.addEventListener('ended', function() { nextTrack(); });
  audio.addEventListener('play',    updateNow);
  audio.addEventListener('playing', updateNow);
  audio.addEventListener('pause',   updateNow);

  wrap.querySelector('#fp-loop').addEventListener('click', function() {
    loopMode = (loopMode+1)%3;
    this.textContent = LOOP_LABELS[loopMode];
    this.title = LOOP_TIPS[loopMode];
    saveState({loopMode:loopMode});
  });
  wrap.querySelector('#fp-shuffle').addEventListener('click', function() {
    if (playlist.length) playTrack(Math.floor(Math.random()*playlist.length));
  });
  wrap.querySelector('#fp-list').addEventListener('click', function() {
    plOpen = !plOpen;
    wrap.querySelector('#fp-pl').classList.toggle('open', plOpen);
    // Close upload panel if open
    if (plOpen) wrap.querySelector('#fp-upload-panel').classList.remove('open');
  });

  audio.addEventListener('timeupdate', function() {
    if (seeking || !audio.duration) return;
    var pct = (audio.currentTime / audio.duration) * 100;
    var seekEl2 = wrap.querySelector('#fp-seek');
    seekEl2.value = pct;
    seekEl2.style.setProperty('--pct', pct.toFixed(2) + '%');
    wrap.querySelector('#fp-cur').textContent = fmt(audio.currentTime);
    wrap.querySelector('#fp-dur').textContent = fmt(audio.duration);
    if (Math.floor(audio.currentTime) % 4 === 0) saveState({progress: audio.currentTime});
  });

  var seekEl = wrap.querySelector('#fp-seek');
  seekEl.addEventListener('mousedown', function() { seeking = true; });
  seekEl.addEventListener('input', function() {
    if (audio.duration) wrap.querySelector('#fp-cur').textContent = fmt(audio.duration * seekEl.value / 100);
  });
  seekEl.addEventListener('change', function() {
    if (audio.duration) audio.currentTime = audio.duration * seekEl.value / 100;
    seeking = false;
  });

  var volEl = wrap.querySelector('#fp-vol');
  function updateVolBar() { volEl.style.setProperty('--pct', (audio.volume * 100).toFixed(1) + '%'); }
  volEl.addEventListener('input', function() {
    audio.volume = volEl.value;
    updateVolBar();
    saveState({volume: parseFloat(volEl.value)});
  });

  // Upload
  function openUpload() {
    wrap.querySelector('#fp-upload-panel').classList.add('open');
    // Close playlist if open
    plOpen = false;
    wrap.querySelector('#fp-pl').classList.remove('open');
  }
  function closeUpload() { wrap.querySelector('#fp-upload-panel').classList.remove('open'); wrap.querySelector('#fp-upload-msg').textContent = ''; }

  async function submitUpload() {
    var title  = wrap.querySelector('#fp-u-title').value.trim();
    var artist = wrap.querySelector('#fp-u-artist').value.trim();
    var file   = wrap.querySelector('#fp-u-file').files[0];
    var btn    = wrap.querySelector('#fp-sub-btn');
    var msg    = wrap.querySelector('#fp-upload-msg');
    var token  = localStorage.getItem('token');
    if (!token) { msg.textContent = '请先登录'; return; }
    if (!title) { msg.textContent = '请填写曲目名称'; return; }
    if (!file && !currentTmpFile) { msg.textContent = '请选择音频文件'; return; }
    btn.disabled = true;
    msg.style.color = 'rgba(200,223,247,0.5)';
    msg.textContent = '保存中…';
    try {
      var res, data;
      if (currentTmpFile) {
        // File already uploaded during parse — just confirm with metadata
        var fd = new FormData();
        fd.append('title', title);
        if (artist) fd.append('artist', artist);
        fd.append('tmpFile', currentTmpFile);
        if (currentDuration) fd.append('duration', String(currentDuration));
        if (currentCover)    fd.append('cover', currentCover);
        res  = await fetch('/api/music', {method:'POST', headers:{'Authorization':'Bearer '+token}, body:fd});
        data = await res.json();
      } else {
        // Fallback: fresh upload (parse failed or skipped)
        var fd2 = new FormData();
        fd2.append('file', file);
        fd2.append('title', title);
        if (artist) fd2.append('artist', artist);
        res  = await fetch('/api/music', {method:'POST', headers:{'Authorization':'Bearer '+token}, body:fd2});
        data = await res.json();
      }
      if (!res.ok) { msg.textContent = data.error||'上传失败'; btn.disabled=false; return; }
      msg.style.color = '#4a9fd4'; msg.textContent = '✓ ' + data.title;
      wrap.querySelector('#fp-u-title').value = '';
      wrap.querySelector('#fp-u-artist').value = '';
      wrap.querySelector('#fp-u-file').value = '';
      wrap.querySelector('#fp-file-lbl').textContent = '点击选择 MP3 / FLAC / WAV';
      wrap.querySelector('#fp-file-lbl').classList.remove('has');
      currentTmpFile = null; currentDuration = 0; currentCover = null;
      setTimeout(function() { msg.textContent=''; msg.style.color=''; closeUpload(); }, 1500);
      loadPlaylist(false);
    } catch(e) { msg.textContent = '上传失败，请重试'; }
    btn.disabled = false;
  }

  async function delTrack(id) {
    if (!confirm('确认删除？')) return;
    var token = localStorage.getItem('token');
    var res = await fetch('/api/music/'+id, {method:'DELETE', headers:{'Authorization':'Bearer '+token}});
    if (!res.ok) { var d = await res.json(); alert(d.error||'删除失败'); return; }
    loadPlaylist(false);
  }

  function loadPlaylist(restore) {
    if (restore) {
      var st = loadState();
      if (st.trackUrl) {
        audio.src = st.trackUrl;
        audio.volume = st.volume !== undefined ? st.volume : 0.8;
        wrap.querySelector('#fp-vol').value = audio.volume;
        if (st.loopMode) { loopMode=st.loopMode; wrap.querySelector('#fp-loop').textContent=LOOP_LABELS[loopMode]; }
        audio.load();
        var target = st.progress || 0;
        var resumed = false;
        function doResume() {
          if (resumed) return; resumed = true;
          if (target > 0.5) audio.currentTime = target;
          if (st.playing) audio.play().catch(function(){});
        }
        audio.addEventListener('canplay', doResume, {once:true});
        setTimeout(function() { if (!resumed) doResume(); }, 300);
      }
    }
    fetch('/api/music').then(function(r){return r.json();}).then(function(tracks) {
      playlist = tracks || [];
      updateList();
      var token = localStorage.getItem('token');
      if (token) wrap.querySelector('#fp-upload-mini').classList.add('show');
      if (!restore || !playlist.length) return;
      var st = loadState();
      var idx = st.trackIdx || 0; if (idx >= playlist.length) idx = 0;
      curIdx = idx;
      updateNow();
    }).catch(function() {
      wrap.querySelector('#fp-pl-body').innerHTML = '<div class="fp-pl-empty">连接失败</div>';
    });
  }

  // Toggle player open/close
  var isOpen = false;
  function toggle() {
    isOpen = !isOpen;
    document.body.classList.toggle('fp-open', isOpen);
    saveState({playerOpen: isOpen});
  }

  window.addEventListener('beforeunload', function() {
    var url = playlist[curIdx] ? playlist[curIdx].url : null;
    saveState({progress:audio.currentTime, playing:!audio.paused, volume:audio.volume, loopMode:loopMode, playerOpen:isOpen, trackUrl:url});
  });

  window._fp = {toggle:toggle, play:playTrack, del:delTrack, openUpload:openUpload, closeUpload:closeUpload, submitUpload:submitUpload};

  // Init
  var st = loadState();
  if (st.playerOpen) { isOpen=true; document.body.classList.add('fp-open'); }
  if (st.volume !== undefined) { audio.volume=st.volume; wrap.querySelector('#fp-vol').value=st.volume; }
  updateVolBar();
  loadPlaylist(true);
})();
