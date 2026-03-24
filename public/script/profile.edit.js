// ── Avatar crop & upload ──────────────────────────────────────
let cropperInstance = null;

function openCrop(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const overlay = document.getElementById('crop-overlay');
    const img     = document.getElementById('crop-img');
    // Destroy previous cropper
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
    img.src = e.target.result;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Init Cropper after image loads
    img.onload = () => {
      cropperInstance = new Cropper(img, {
        aspectRatio: 1,          // square crop
        viewMode: 1,              // crop box can't exceed canvas
        dragMode: 'move',         // drag the image, not the box
        autoCropArea: 0.85,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: false,    // fixed box, move image instead
        cropBoxResizable: false,
        toggleDragModeOnDblclick: false,
      });
    };
  };
  reader.readAsDataURL(file);
}

function closeCrop() {
  document.getElementById('crop-overlay').classList.remove('open');
  document.body.style.overflow = '';
  if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
  // Reset file input so same file can be re-selected
  const fi = document.getElementById('avatar-file-input');
  if (fi) fi.value = '';
}

async function confirmCrop() {
  if (!cropperInstance) return;
  const btn = document.getElementById('btn-crop-confirm');
  btn.classList.add('loading'); btn.disabled = true;
  try {
    // Get cropped canvas at 400×400
    const canvas = cropperInstance.getCroppedCanvas({ width: 400, height: 400, imageSmoothingQuality: 'high' });
    const blob   = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
    const fd     = new FormData();
    fd.append('avatar', blob, 'avatar.jpg');
    const res  = await fetch('/api/profile/avatar', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: fd
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || '上传失败', 'error'); return; }
    closeCrop();
    const el = document.getElementById('avatar-el');
    if (el) el.innerHTML = `<img src="${data.avatar}?t=${Date.now()}" alt="avatar">`;
    showToast('头像已更新');
  } catch(e) { showToast('上传失败，请重试', 'error'); }
  finally { btn.classList.remove('loading'); btn.disabled = false; }
}

function uploadAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;
  openCrop(file);
}

async function uploadBanner(e) {
  const file = e.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('banner', file);
  try {
    const res  = await fetch('/api/profile/banner', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: fd
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || '上传失败', 'error'); return; }
    // Update banner in DOM
    const el = document.getElementById('banner-el');
    if (el) {
      let bg = el.querySelector('.profile-hero-bg');
      if (!bg) { bg = document.createElement('div'); bg.className = 'profile-hero-bg'; el.insertBefore(bg, el.firstChild); }
      let img = bg.querySelector('img');
      if (!img) { img = document.createElement('img'); bg.appendChild(img); }
      img.src = data.banner + '?t=' + Date.now();
    }
    showToast('背景图已更新');
  } catch(e) { showToast('上传失败', 'error'); }
}

// ── Edit modal ────────────────────────────────────────────────
let tags = [];

function openModal() {
  if (!profileData) return;
  document.getElementById('edit-nickname').value = profileData.nickname || '';
  document.getElementById('edit-bio').value      = profileData.bio || '';
  tags = profileData.instruments ? profileData.instruments.split(',').filter(s => s.trim()) : [];
  renderTags();
  // Init privacy toggle
  const track = document.getElementById('toggle-show-follows');
  if (track) {
    const isOn = profileData.show_follows !== 0;
    track.classList.toggle('on', isOn);
  }
  // Init banner preview
  const prevEl = document.getElementById('modal-banner-preview');
  if (prevEl && profileData.banner && profileData.banner.startsWith('/')) {
    prevEl.style.backgroundImage = 'url(' + profileData.banner + ')';
    prevEl.style.backgroundSize  = 'cover';
    prevEl.style.backgroundPosition = 'center';
  }
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('edit-nickname').focus(), 100);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

// Tag editor
function renderTags() {
  const wrap = document.getElementById('tags-wrap');
  const input = document.getElementById('tag-input');
  wrap.querySelectorAll('.tag-item').forEach(t => t.remove());
  tags.forEach((tag, i) => {
    const el = document.createElement('div');
    el.className = 'tag-item';
    el.innerHTML = `${esc(tag)}<button class="tag-remove" data-i="${i}">×</button>`;
    wrap.insertBefore(el, input);
  });
  wrap.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => { tags.splice(Number(btn.dataset.i), 1); renderTags(); });
  });
}

function focusTagInput() { document.getElementById('tag-input').focus(); }

document.getElementById('tag-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/,/g,'');
    if (val && !tags.includes(val) && tags.length < 10) { tags.push(val); renderTags(); }
    e.target.value = '';
  } else if (e.key === 'Backspace' && !e.target.value && tags.length) {
    tags.pop(); renderTags();
  }
});

document.getElementById('tag-input').addEventListener('focus',  () => document.getElementById('tags-wrap').classList.add('focus'));
document.getElementById('tag-input').addEventListener('blur',   () => {
  // Add pending tag on blur
  const val = document.getElementById('tag-input').value.trim().replace(/,/g,'');
  if (val && !tags.includes(val) && tags.length < 10) { tags.push(val); renderTags(); document.getElementById('tag-input').value = ''; }
  document.getElementById('tags-wrap').classList.remove('focus');
});

function previewModalBanner(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const prev = document.getElementById('modal-banner-preview');
    if (prev) prev.style.backgroundImage = 'url(' + e.target.result + ')';
    if (prev) prev.style.backgroundSize = 'cover';
    if (prev) prev.style.backgroundPosition = 'center';
  };
  reader.readAsDataURL(file);
}

function toggleShowFollows() {
  const track = document.getElementById('toggle-show-follows');
  if (track) track.classList.toggle('on');
}

async function saveProfile() {
  const nickname    = document.getElementById('edit-nickname').value.trim();
  const bio         = document.getElementById('edit-bio').value.trim();
  const instruments = tags.join(',');
  const btn = document.getElementById('btn-save');
  btn.classList.add('loading'); btn.disabled = true;
  try {
    // Upload banner first if a new one was selected
    const bannerFileInput = document.getElementById('modal-banner-input');
    if (bannerFileInput && bannerFileInput.files[0]) {
      const bfd = new FormData();
      bfd.append('banner', bannerFileInput.files[0]);
      const bres  = await fetch('/api/profile/banner', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: bfd
      });
      const bdata = await bres.json();
      if (bres.ok) profileData.banner = bdata.banner;
      else { showToast(bdata.error || '背景图上传失败', 'error'); return; }
    }
    const res  = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ nickname, bio, instruments, show_follows: document.getElementById('toggle-show-follows')?.classList.contains('on') ? 1 : 0 })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || '保存失败', 'error'); return; }
    profileData = { ...profileData, ...data };
    closeModal();
    showToast('资料已保存');
    // Re-render profile card
    const authHeaders = token ? { 'Authorization': 'Bearer ' + token } : {};
    const profRes  = await fetch('/api/profile/' + encodeURIComponent(targetUser), { headers: authHeaders });
    const postsRes = await fetch('/api/profile/' + encodeURIComponent(targetUser) + '/posts');
    profileData = await profRes.json();
    renderPage(profileData, await postsRes.json());
  } catch(e) { showToast('保存失败', 'error'); }
  finally { btn.classList.remove('loading'); btn.disabled = false; }
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

loadProfile();
