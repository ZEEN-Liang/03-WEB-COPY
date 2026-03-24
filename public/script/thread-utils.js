// ── Shared thread / comment utilities ────────────────────────
// Loaded by article.html and qa.html before their respective
// comment/answer scripts. Provides the four primitives that both
// systems share so that each file stays focused on its own logic.

// HTML-escape for safe interpolation into templates
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Avatar element — photo if available, initial letter otherwise.
//   name   : display name (used for the fallback letter)
//   url    : avatar URL (must start with '/' to be trusted)
//   size   : px dimension (square)
//   inline : true  → display:inline-flex + vertical-align (for flex header rows)
//            false → display:flex + flex-shrink:0 (for block layouts, default)
function avatarEl(name, url, size, inline = false) {
  const letter   = (name || '?')[0].toUpperCase();
  const display  = inline
    ? 'inline-flex;vertical-align:middle;margin-right:5px'
    : 'flex;flex-shrink:0';
  const style    = `width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;` +
                   `display:${display};align-items:center;justify-content:center;` +
                   `background:var(--ink);color:#f5f2ec;font-size:${Math.round(size * 0.42)}px;font-weight:500;`;
  const validUrl = url && url !== '0' && url !== 0 && String(url).startsWith('/') ? url : null;
  if (validUrl) {
    return `<div style="${style}padding:0">` +
             `<img src="${escHtml(validUrl)}" style="width:100%;height:100%;object-fit:cover" ` +
             `onerror="this.parentElement.innerHTML='${letter}';this.parentElement.style.padding=''" alt="${letter}">` +
           `</div>`;
  }
  return `<div style="${style}">${letter}</div>`;
}

// Relative time string ("刚刚", "3 分钟前", "2 天前", …)
function relTime(str) {
  const s = str ? String(str) : '';
  const d = new Date((s.indexOf('T') === -1 ? s + 'Z' : s).replace(' ', 'T'));
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)     return '刚刚';
  if (diff < 3600)   return Math.floor(diff / 60)    + ' 分钟前';
  if (diff < 86400)  return Math.floor(diff / 3600)  + ' 小时前';
  if (diff < 604800) return Math.floor(diff / 86400) + ' 天前';
  return d.toLocaleDateString('zh-CN');
}

// "↩ 回复 xxx" inline tag shown on reply items in both comment systems
function buildReplyToTag(name) {
  if (!name) return '';
  return `<span class="reply-to-tag">↩ 回复 ${escHtml(name)}</span>`;
}
