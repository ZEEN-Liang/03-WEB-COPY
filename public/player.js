// ── 风蓝轻音部 · 左侧播放器侧边栏 ──────────────────────────
(function () {
  'use strict';

  var STORAGE_KEY = 'flan_player';

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch(e) { return {}; }
  }
  function saveState(patch) {
    var s = loadState();
    Object.assign(s, patch);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }

  var CSS = `
    #fp-tab {
      position: fixed;
      left: 0;
      top: calc(50vh - 52px);
      z-index: 9999;
      width: 28px;
      padding: 14px 0;
      background: rgba(15,24,40,0.95);
      border: 1px solid rgba(74,159,212,0.35);
      border-left: none;
      border-radius: 0 8px 8px 0;
      color: rgba(200,223,247,0.8);
      font-family: 'Noto Sans SC', sans-serif;
      font-size: 12px; font-weight: 300; letter-spacing: 0.16em;
      cursor: pointer; user-select: none;
      transition: left 0.32s cubic-bezier(.4,0,.2,1), background 0.2s, color 0.2s;
      backdrop-filter: blur(8px);
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      box-shadow: 2px 0 12px rgba(0,0,0,0.3);
    }
    #fp-tab span.fp-note { font-size: 14px; }
    #fp-tab span.fp-text {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      font-size: 11px; letter-spacing: 0.2em;
    }
    #fp-tab span.fp-arrow { font-size: 10px; transition: transform 0.3s; }
    #fp-tab:hover { color: #c8dff7; background: rgba(30,58,95,0.95); }
    body.fp-open #fp-tab { left: 320px; }
    body.fp-open #fp-tab span.fp-arrow { transform: rotate(180deg); }

    #fp-sidebar {
      position: fixed; left: -320px; top: 0; bottom: 0; z-index: 9998;
      width: 320px; display: flex; flex-direction: column;
      background: rgba(10,18,32,0.97);
      border-right: 1px solid rgba(74,159,212,0.2);
      box-shadow: 4px 0 24px rgba(0,0,0,0.4);
      backdrop-filter: blur(12px);
      transition: left 0.32s cubic-bezier(.4,0,.2,1);
      overflow: hidden;
    }
    body.fp-open #fp-sidebar { left: 0; }

    .fp-header { padding: 20px 20px 14px; border-bottom: 1px solid rgba(74,159,212,0.12); flex-shrink: 0; }
    .fp-header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .fp-logo { font-family: 'Noto Serif SC', serif; font-size: 13px; font-weight: 400; letter-spacing: 0.12em; color: rgba(200,223,247,0.6); }
    .fp-logo em { font-style: normal; color: #4a9fd4; }

    .fp-upload-btn {
      padding: 4px 12px; border-radius: 20px;
      background: rgba(46,122,181,0.2); border: 1px solid rgba(74,159,212,0.35);
      color: rgba(200,223,247,0.75); font-size: 11px; font-family: inherit;
      cursor: pointer; transition: all 0.2s; display: none;
    }
    .fp-upload-btn:hover { background: rgba(46,122,181,0.45); color: #c8dff7; }
    .fp-upload-btn.show { display: block; }

    .fp-now { display: flex; align-items: center; gap: 12px; }
    .fp-now-disc {
      width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, #1e3a5f, #4a9fd4);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; color: rgba(200,223,247,0.8);
      box-shadow: 0 0 12px rgba(74,159,212,0.3);
      animation: fp-spin 8s linear infinite; animation-play-state: paused;
    }
    .fp-now-disc.playing { animation-play-state: running; }
    @keyframes fp-spin { to { transform: rotate(360deg); } }
    .fp-now-info { flex: 1; min-width: 0; }
    .fp-now-title { font-size: 14px; font-weight: 400; color: #e8f2ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fp-now-sub { font-size: 11px; font-weight: 300; color: rgba(200,223,247,0.45); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fp-now-empty { color: rgba(200,223,247,0.3); font-style: italic; }

    .fp-controls-wrap { padding: 12px 20px 14px; border-bottom: 1px solid rgba(74,159,212,0.12); flex-shrink: 0; }
    .fp-seek-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .fp-time { font-size: 10px; color: rgba(200,223,247,0.35); font-family: monospace; flex-shrink: 0; }
    .fp-seek { flex: 1; -webkit-appearance: none; appearance: none; height: 3px; border-radius: 2px; cursor: pointer; outline: none; background: rgba(74,159,212,0.2); }
    .fp-seek::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #4a9fd4; cursor: pointer; box-shadow: 0 0 5px rgba(74,159,212,0.7); }
    .fp-btn-row { display: flex; align-items: center; justify-content: center; gap: 8px; }
    .fp-btn { background: none; border: none; cursor: pointer; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: rgba(200,223,247,0.6); font-size: 15px; transition: color 0.15s, background 0.15s; }
    .fp-btn:hover { color: #c8dff7; background: rgba(74,159,212,0.15); }
    .fp-btn-play { width: 44px; height: 44px; font-size: 18px; background: rgba(46,122,181,0.25); border: 1px solid rgba(74,159,212,0.4); color: #c8dff7; }
    .fp-btn-play:hover { background: rgba(46,122,181,0.5); }
    .fp-vol-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
    .fp-vol-icon { font-size: 13px; color: rgba(200,223,247,0.4); }
    .fp-volume { flex: 1; -webkit-appearance: none; appearance: none; height: 3px; border-radius: 2px; cursor: pointer; outline: none; background: rgba(74,159,212,0.2); }
    .fp-volume::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: rgba(200,223,247,0.55); cursor: pointer; }

    .fp-pl-header { padding: 10px 20px 8px; display: flex; align-items: center; justify-content: space-between; font-size: 10px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(200,223,247,0.35); flex-shrink: 0; }
    .fp-pl-list { flex: 1; overflow-y: auto; padding-bottom: 80px; }
    .fp-pl-list::-webkit-scrollbar { width: 3px; }
    .fp-pl-list::-webkit-scrollbar-thumb { background: rgba(74,159,212,0.25); border-radius: 2px; }
    .fp-pl-item { display: flex; align-items: center; gap: 10px; padding: 10px 20px; cursor: pointer; transition: background 0.12s; border-bottom: 1px solid rgba(74,159,212,0.04); }
    .fp-pl-item:hover { background: rgba(46,122,181,0.12); }
    .fp-pl-item.active { background: rgba(46,122,181,0.22); }
    .fp-pl-num { width: 18px; font-size: 10px; text-align: center; flex-shrink: 0; color: rgba(200,223,247,0.25); }
    .fp-pl-num.on { color: #4a9fd4; }
    .fp-pl-info { flex: 1; min-width: 0; }
    .fp-pl-title { font-size: 13px; color: rgba(200,223,247,0.75); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fp-pl-item.active .fp-pl-title { color: #c8dff7; }
    .fp-pl-meta { font-size: 10px; color: rgba(200,223,247,0.3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fp-pl-del { background: none; border: none; color: rgba(200,223,247,0.2); font-size: 14px; cursor: pointer; padding: 4px; transition: color 0.15s; flex-shrink: 0; line-height: 1; }
    .fp-pl-del:hover { color: rgba(192,57,43,0.8); }
    .fp-pl-empty { padding: 32px 20px; text-align: center; font-size: 13px; color: rgba(200,223,247,0.2); font-style: italic; }

    .fp-upload-panel { position: absolute; inset: 0; z-index: 10; background: rgba(10,18,32,0.98); display: none; flex-direction: column; padding: 20px; overflow-y: auto; }
    .fp-upload-panel.open { display: flex; }
    .fp-upload-title { font-size: 13px; font-weight: 500; color: rgba(200,223,247,0.8); margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
    .fp-upload-close { background: none; border: none; color: rgba(200,223,247,0.4); font-size: 18px; cursor: pointer; line-height: 1; }
    .fp-upload-close:hover { color: #c8dff7; }
    .fp-field { margin-bottom: 14px; }
    .fp-field label { display: block; font-size: 10px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(200,223,247,0.4); margin-bottom: 6px; }
    .fp-field input[type=text] { width: 100%; padding: 8px 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(74,159,212,0.25); border-radius: 4px; color: #e8f2ff; font-family: inherit; font-size: 13px; outline: none; transition: border-color 0.2s; }
    .fp-field input[type=text]:focus { border-color: rgba(74,159,212,0.6); }
    .fp-field input[type=text]::placeholder { color: rgba(200,223,247,0.2); }
    .fp-file-label { display: block; padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px dashed rgba(74,159,212,0.25); border-radius: 4px; text-align: center; cursor: pointer; font-size: 12px; color: rgba(200,223,247,0.4); transition: all 0.2s; }
    .fp-file-label:hover { border-color: rgba(74,159,212,0.5); color: rgba(200,223,247,0.7); }
    .fp-file-label.has-file { border-color: rgba(74,159,212,0.5); color: #a8d8ea; }
    .fp-submit-btn { width: 100%; padding: 10px; margin-top: 4px; background: rgba(46,122,181,0.3); border: 1px solid rgba(74,159,212,0.4); border-radius: 4px; color: #c8dff7; font-family: inherit; font-size: 13px; cursor: pointer; transition: all 0.2s; }
    .fp-submit-btn:hover { background: rgba(46,122,181,0.55); }
    .fp-submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .fp-upload-msg { margin-top: 10px; font-size: 12px; text-align: center; color: rgba(200,223,247,0.5); min-height: 18px; }
  `;

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  var wrap = document.createElement('div');
  wrap.innerHTML = '<div id="fp-tab" onclick="window._fp.toggle()"><span class="fp-note">♪</span><span class="fp-text">音乐</span><span class="fp-arrow">›</span></div>' +
    '<div id="fp-sidebar">' +
      '<div class="fp-header">' +
        '<div class="fp-header-top">' +
          '<div class="fp-logo">风<em>蓝</em>轻音部</div>' +
          '<button class="fp-upload-btn" id="fp-upload-btn" onclick="window._fp.openUpload()">＋ 投稿音乐</button>' +
        '</div>' +
        '<div class="fp-now">' +
          '<div class="fp-now-disc" id="fp-disc">♪</div>' +
          '<div class="fp-now-info">' +
            '<div class="fp-now-title fp-now-empty" id="fp-title">暂无播放</div>' +
            '<div class="fp-now-sub" id="fp-sub"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="fp-controls-wrap">' +
        '<div class="fp-seek-row">' +
          '<span class="fp-time" id="fp-cur">0:00</span>' +
          '<input class="fp-seek" id="fp-seek" type="range" min="0" max="100" value="0" step="0.1">' +
          '<span class="fp-time" id="fp-dur">0:00</span>' +
        '</div>' +
        '<div class="fp-btn-row">' +
          '<button class="fp-btn" id="fp-shuffle" title="随机" style="font-size:13px">⇄</button>' +
          '<button class="fp-btn" id="fp-prev" title="上一首">⏮</button>' +
          '<button class="fp-btn fp-btn-play" id="fp-play">▶</button>' +
          '<button class="fp-btn" id="fp-next" title="下一首">⏭</button>' +
          '<button class="fp-btn" id="fp-loop" title="顺序播放" style="font-size:13px">↻</button>' +
        '</div>' +
        '<div class="fp-vol-row">' +
          '<span class="fp-vol-icon">♪</span>' +
          '<input class="fp-volume" id="fp-volume" type="range" min="0" max="1" step="0.02" value="0.8">' +
        '</div>' +
      '</div>' +
      '<div class="fp-pl-header"><span>播放列表</span><span id="fp-count" style="font-weight:300">0 首</span></div>' +
      '<div class="fp-pl-list" id="fp-pl-list"><div class="fp-pl-empty">加载中…</div></div>' +
      '<div class="fp-upload-panel" id="fp-upload-panel">' +
        '<div class="fp-upload-title">投稿音乐<button class="fp-upload-close" onclick="window._fp.closeUpload()">×</button></div>' +
        '<div class="fp-field"><label>曲目名称 *</label><input type="text" id="fp-u-title" placeholder="歌曲名称"></div>' +
        '<div class="fp-field"><label>艺术家</label><input type="text" id="fp-u-artist" placeholder="艺术家 / 乐队"></div>' +
        '<div class="fp-field"><label>音频文件 *</label>' +
          '<label class="fp-file-label" id="fp-file-label" for="fp-u-file">点击选择 MP3 / FLAC / WAV</label>' +
          '<input type="file" id="fp-u-file" style="display:none" accept=".mp3,.flac,.wav,.ogg,.aac,audio/*">' +
        '</div>' +
        '<button class="fp-submit-btn" id="fp-submit-btn" onclick="window._fp.submitUpload()">上 传</button>' +
        '<div class="fp-upload-msg" id="fp-upload-msg"></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);

  // Safe querySelector after append
  var fileInput = wrap.querySelector('#fp-u-file');
  if (fileInput) {
    fileInput.addEventListener('change', function() {
      var f = this.files[0];
      var lbl = wrap.querySelector('#fp-file-label');
      if (f) { lbl.textContent = f.name; lbl.classList.add('has-file'); }
      else   { lbl.textContent = '点击选择 MP3 / FLAC / WAV'; lbl.classList.remove('has-file'); }
    });
  }

  var audio = new Audio();
  var playlist = [], curIdx = -1, seeking = false, loopMode = 0;
  var LOOP_LABELS = ['↻','↻¹','⇄'], LOOP_TIPS = ['顺序播放','单曲循环','随机播放'];

  function fmt(sec) { sec=Math.floor(sec||0); return Math.floor(sec/60)+':'+('0'+(sec%60)).slice(-2); }
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function updateNow() {
    var t=playlist[curIdx];
    var ttl=document.getElementById('fp-title'), sub=document.getElementById('fp-sub'), disc=document.getElementById('fp-disc');
    if(t){ ttl.textContent=t.title; ttl.classList.remove('fp-now-empty'); sub.textContent=(t.artist||'')+(t.uploader?' · 投稿：'+t.uploader:''); }
    else { ttl.textContent='暂无播放'; ttl.classList.add('fp-now-empty'); sub.textContent=''; }
    document.getElementById('fp-play').textContent=audio.paused?'▶':'⏸';
    disc.classList.toggle('playing',!audio.paused);
  }

  function updateList() {
    var el=document.getElementById('fp-pl-list');
    var token=localStorage.getItem('token'), myName=localStorage.getItem('username'), isAdmin=localStorage.getItem('isAdmin')==='true';
    document.getElementById('fp-count').textContent=playlist.length+' 首';
    if(!playlist.length){ el.innerHTML='<div class="fp-pl-empty">暂无曲目，登录后可投稿音乐</div>'; return; }
    el.innerHTML=playlist.map(function(t,i){
      var active=i===curIdx?' active':'';
      var canDel=token&&(isAdmin||t.uploader===myName);
      var delBtn=canDel?'<button class="fp-pl-del" onclick="event.stopPropagation();window._fp.del('+t.id+')" title="删除">×</button>':'';
      return '<div class="fp-pl-item'+active+'" onclick="window._fp.play('+i+')">'+
        '<span class="fp-pl-num'+(i===curIdx?' on':'')+'">'+( i+1)+'</span>'+
        '<div class="fp-pl-info">'+
          '<div class="fp-pl-title">'+esc(t.title)+'</div>'+
          '<div class="fp-pl-meta">'+esc(t.artist||'')+(t.uploader?(t.artist?' · ':'')+t.uploader:'')+'</div>'+
        '</div>'+delBtn+'</div>';
    }).join('');
  }

  function playTrack(idx) {
    if(!playlist.length) return;
    idx=((idx%playlist.length)+playlist.length)%playlist.length;
    curIdx=idx; var t=playlist[idx];
    audio.src=t.url; audio.load(); audio.play().catch(function(){});
    saveState({trackIdx:idx,trackId:t.id,trackUrl:t.url,playing:true,progress:0});
    updateNow(); updateList();
    // Prefetch next track into browser cache
    prefetchNext(idx);
  }

  // Silently fetch next track URL so browser caches it
  function prefetchNext(idx) {
    if(!playlist.length) return;
    var nextIdx = (idx+1) % playlist.length;
    var nextUrl = playlist[nextIdx] && playlist[nextIdx].url;
    if(!nextUrl) return;
    try {
      var link = document.getElementById('fp-prefetch');
      if(!link) {
        link = document.createElement('link');
        link.id  = 'fp-prefetch';
        link.rel = 'prefetch';
        link.as  = 'audio';
        document.head.appendChild(link);
      }
      link.href = nextUrl;
    } catch(e) {}
  }

  function nextTrack() {
    if(!playlist.length) return;
    if(loopMode===2){ playTrack(Math.floor(Math.random()*playlist.length)); return; }
    if(loopMode===1){ playTrack(curIdx); return; }
    playTrack(curIdx+1<playlist.length?curIdx+1:0);
  }

  wrap.querySelector('#fp-play').addEventListener('click',function(){
    if(!playlist.length) return;
    if(curIdx<0){playTrack(0);return;}
    if(audio.paused){audio.play().catch(function(){});saveState({playing:true});}
    else{audio.pause();saveState({playing:false});}
    updateNow();
  });
  wrap.querySelector('#fp-prev').addEventListener('click',function(){
    if(audio.currentTime>3){audio.currentTime=0;return;}
    playTrack(loopMode===2?Math.floor(Math.random()*playlist.length):curIdx-1);
  });
  wrap.querySelector('#fp-next').addEventListener('click',function(){nextTrack();});
  audio.addEventListener('ended',function(){nextTrack();});

  wrap.querySelector('#fp-loop').addEventListener('click',function(){
    loopMode=(loopMode+1)%3;
    this.textContent=LOOP_LABELS[loopMode]; this.title=LOOP_TIPS[loopMode];
    saveState({loopMode:loopMode});
  });
  wrap.querySelector('#fp-shuffle').addEventListener('click',function(){
    if(playlist.length) playTrack(Math.floor(Math.random()*playlist.length));
  });

  audio.addEventListener('timeupdate',function(){
    if(seeking||!audio.duration) return;
    var pct=(audio.currentTime/audio.duration)*100;
    document.getElementById('fp-seek').value=pct;
    document.getElementById('fp-cur').textContent=fmt(audio.currentTime);
    document.getElementById('fp-dur').textContent=fmt(audio.duration);
    if(Math.floor(audio.currentTime)%4===0) saveState({progress:audio.currentTime});
  });

  var seekEl=wrap.querySelector('#fp-seek');
  seekEl.addEventListener('mousedown',function(){seeking=true;});
  seekEl.addEventListener('input',function(){if(audio.duration) document.getElementById('fp-cur').textContent=fmt(audio.duration*seekEl.value/100);});
  seekEl.addEventListener('change',function(){if(audio.duration) audio.currentTime=audio.duration*seekEl.value/100; seeking=false;});

  var volEl=wrap.querySelector('#fp-volume');
  volEl.addEventListener('input',function(){audio.volume=volEl.value;saveState({volume:parseFloat(volEl.value)});});

  function openUpload(){document.getElementById('fp-upload-panel').classList.add('open');}
  function closeUpload(){document.getElementById('fp-upload-panel').classList.remove('open');document.getElementById('fp-upload-msg').textContent='';}

  async function submitUpload(){
    var title=document.getElementById('fp-u-title').value.trim();
    var artist=document.getElementById('fp-u-artist').value.trim();
    var file=document.getElementById('fp-u-file').files[0];
    var btn=document.getElementById('fp-submit-btn'), msg=document.getElementById('fp-upload-msg');
    var token=localStorage.getItem('token');
    if(!token){msg.textContent='请先登录';return;}
    if(!title){msg.textContent='请填写曲目名称';return;}
    if(!file){msg.textContent='请选择音频文件';return;}
    btn.disabled=true; msg.textContent='上传中…'; msg.style.color='rgba(200,223,247,0.5)';
    var fd=new FormData(); fd.append('file',file); fd.append('title',title);
    if(artist) fd.append('artist',artist);
    try{
      var res=await fetch('/api/music',{method:'POST',headers:{'Authorization':'Bearer '+token},body:fd});
      var data=await res.json();
      if(!res.ok){msg.textContent=data.error||'上传失败';btn.disabled=false;return;}
      msg.style.color='#4a9fd4'; msg.textContent='✓ 上传成功：'+data.title;
      document.getElementById('fp-u-title').value='';
      document.getElementById('fp-u-artist').value='';
      document.getElementById('fp-u-file').value='';
      document.getElementById('fp-file-label').textContent='点击选择 MP3 / FLAC / WAV';
      document.getElementById('fp-file-label').classList.remove('has-file');
      setTimeout(function(){msg.textContent='';msg.style.color='';closeUpload();},1500);
      loadPlaylist(false);
    }catch(e){msg.textContent='上传失败，请重试';}
    btn.disabled=false;
  }

  async function delTrack(id){
    if(!confirm('确认删除该曲目？')) return;
    var token=localStorage.getItem('token');
    var res=await fetch('/api/music/'+id,{method:'DELETE',headers:{'Authorization':'Bearer '+token}});
    if(!res.ok){var d=await res.json();alert(d.error||'删除失败');return;}
    loadPlaylist(false);
  }

  function loadPlaylist(restore){
    // If restoring, start audio immediately from cached URL before fetch completes
    if(restore){
      var st=loadState();
      if(st.trackUrl && st.playing){
        audio.src=st.trackUrl;
        audio.volume=(st.volume!==undefined)?st.volume:0.8;
        document.getElementById('fp-volume').value=audio.volume;
        if(st.loopMode){
          loopMode=st.loopMode;
          wrap.querySelector('#fp-loop').textContent=LOOP_LABELS[loopMode];
        }
        // Use canplaythrough for smoother resume, fall back to canplay
        var target=st.progress||0;
        var resumed=false;
        function doResume(){
          if(resumed) return; resumed=true;
          if(target>0.5) audio.currentTime=target;
          audio.play().catch(function(){});
        }
        audio.addEventListener('canplay', doResume, {once:true});
        // Fallback: if canplay fires late, try after 300ms anyway
        setTimeout(function(){ if(!resumed) doResume(); }, 300);
        audio.load();
      }
    }

    fetch('/api/music').then(function(r){return r.json();}).then(function(tracks){
      playlist=tracks||[];
      updateList();
      var token=localStorage.getItem('token');
      if(token) document.getElementById('fp-upload-btn').classList.add('show');
      if(!restore||!playlist.length) return;
      var st=loadState();
      var idx=st.trackIdx||0; if(idx>=playlist.length) idx=0;
      curIdx=idx;
      // Only set src if audio isn't already playing the right track
      var t=playlist[idx];
      if(!st.playing || !st.trackUrl) {
        audio.src=t.url;
        audio.volume=(st.volume!==undefined)?st.volume:0.8;
        document.getElementById('fp-volume').value=audio.volume;
        audio.load();
        var target=st.progress||0;
        audio.addEventListener('canplay',function onR(){
          if(target>0) audio.currentTime=target;
          if(st.playing) audio.play().catch(function(){});
          audio.removeEventListener('canplay',onR);
        },{once:true});
      }
      updateNow();
    }).catch(function(){
      document.getElementById('fp-pl-list').innerHTML='<div class="fp-pl-empty">连接失败</div>';
    });
  }

  var isOpen=false;
  function toggle(){
    isOpen=!isOpen;
    document.body.classList.toggle('fp-open',isOpen);
    saveState({sidebarOpen:isOpen});
  }

  window.addEventListener('beforeunload',function(){
    // Save trackUrl so next page can start audio immediately without waiting for fetch
    var currentUrl = playlist[curIdx] ? playlist[curIdx].url : null;
    saveState({
      progress:   audio.currentTime,
      playing:    !audio.paused,
      volume:     audio.volume,
      loopMode:   loopMode,
      sidebarOpen:isOpen,
      trackUrl:   currentUrl
    });
  });

  window._fp={toggle:toggle,play:playTrack,del:delTrack,openUpload:openUpload,closeUpload:closeUpload,submitUpload:submitUpload};

  var st=loadState();
  if(st.sidebarOpen){isOpen=true;document.body.classList.add('fp-open');}
  if(st.volume!==undefined){audio.volume=st.volume;document.getElementById('fp-volume').value=st.volume;}
  loadPlaylist(true);
})();
