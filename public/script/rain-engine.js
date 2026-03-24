// ── Rain Engine ────────────────────────────────────────────────
// Call window.startRain(cfg) to start the rain on any page.
//
// cfg options (all optional):
//   canvasIds   : string[]  — canvas element IDs, 1 or 3
//                             1 id  → single canvas (all layers drawn there)
//                             3 ids → layered depth [bg, mid, fg]
//   opacityMult : number    — global opacity multiplier (default 1.0)
//   timeStop    : bool      — spatial time-stop near titleSelector (default true)
//   mouseEffect : bool      — mouse repulsion + impact splash  (default true)
//   exitAnim    : bool      — decelerate on .enter-btn click   (default true)
//   pauseEffect : bool      — slow rain when audio is paused   (default true)
//   volEffect   : bool      — scale rain by audio volume       (default true)
//   titleSelector: string   — CSS selector for time-stop anchor (default '.main-title')

window.startRain = function(cfg) {
  cfg = cfg || {};
  const canvasIds     = cfg.canvasIds    || ['rain-bg', 'rain-mid', 'rain-fg'];
  const OPACITY_MULT  = cfg.opacityMult  != null ? cfg.opacityMult : 1.0;
  const USE_TIMESTOP  = cfg.timeStop     != null ? cfg.timeStop  : true;
  const USE_MOUSE     = cfg.mouseEffect  != null ? cfg.mouseEffect : true;
  const USE_EXIT      = cfg.exitAnim     != null ? cfg.exitAnim  : true;
  const USE_PAUSE     = cfg.pauseEffect  != null ? cfg.pauseEffect : true;
  const USE_VOL       = cfg.volEffect    != null ? cfg.volEffect  : true;
  const TITLE_SEL     = cfg.titleSelector || '.main-title';
  const MULTILAYER    = canvasIds.length >= 3;

  const canvases = canvasIds.map(id => document.getElementById(id)).filter(Boolean);
  if (!canvases.length) return;
  const ctxs = canvases.map(c => c.getContext('2d'));

  // ── Storm-level layer definitions ──────────────────────────────
  // [count, sMin, sMax, lMin, lMax, wMin, wMax, oMin, oMax]
  const STORM_LAYERS = [
    [ 310, 24, 40, 28,  56, 1.00, 2.00, 0.11, 0.28 ],
    [ 170, 34, 52, 44,  82, 1.60, 2.80, 0.18, 0.40 ],
    [  85, 44, 65, 64, 112, 2.40, 3.80, 0.28, 0.55 ],
  ];

  const QUIET_SPEED_SCALE   = 0.45;
  const QUIET_OPACITY_SCALE = 0.50;
  const QUIET_WIDTH_SCALE   = 0.45;
  const QUIET_DENSITY       = 0.55;

  const ANGLE_QUIET = -4;
  const ANGLE_STORM = -30;
  const _tanStorm   = Math.abs(Math.tan(ANGLE_STORM * Math.PI / 180));

  let _currentAngleRad = ANGLE_STORM * Math.PI / 180;
  let drops = [];
  let W, H;

  // ── Spatial time-distortion ─────────────────────────────────────
  let INFLUENCE_RADIUS = 380;
  let titleX = 0, titleY = 0;
  let titleRect = null;
  let _msgTitleRect = null;  // rect forwarded from iframe via postMessage

  function updateTitlePos() {
    INFLUENCE_RADIUS = Math.sqrt(W * W + H * H) * 0.18;
    const el = document.querySelector(TITLE_SEL);
    const r  = el ? el.getBoundingClientRect() : _msgTitleRect;
    if (r) {
      titleRect = r;
      titleX = r.left + r.width  / 2 + Math.sin(_currentAngleRad) * INFLUENCE_RADIUS * 0.08;
      titleY = r.top  + r.height / 2 + Math.cos(_currentAngleRad) * INFLUENCE_RADIUS * 0.08;
    } else {
      titleRect = null;  // no title visible — disable time-stop
    }
  }

  const _sigmoidK = 9;
  function getDropTimeFactor(x, y) {
    if (!USE_TIMESTOP || !titleRect) return 1.0;
    const titleInfluence = Math.min(_rawVol / 0.4, 1.0);
    if (titleInfluence === 0) return 1.0;
    const dx = x - titleX;
    const dy = y - titleY;
    const t  = Math.sqrt(dx * dx + dy * dy) / INFLUENCE_RADIUS;
    const s  = 1 / (1 + Math.exp(_sigmoidK * (t - 1))) * titleInfluence;
    return timeFactor * s + 1.0 * (1 - s);
  }

  // ── Mouse barrier ───────────────────────────────────────────────
  const MOUSE_RADIUS    = 100;
  const MOUSE_FORCE     = 40;
  const IMPACT_THRESHOLD = 0.50;
  let mouseX = null, mouseY = null;
  let impactParticles = [];

  if (USE_MOUSE) {
    window.addEventListener('mousemove',  e => { mouseX = e.clientX; mouseY = e.clientY; });
    window.addEventListener('mouseleave', () => { mouseX = null;     mouseY = null; });
    // Receive forwarded coords and title rect from iframe child
    window.addEventListener('message', function(e) {
      if (!e.data) return;
      if (e.data.type === '_rain_mouse')       { mouseX = e.data.x; mouseY = e.data.y; }
      if (e.data.type === '_rain_mouse_leave') { mouseX = null;     mouseY = null; }
      if (e.data.type === '_rain_title_rect') {
        _msgTitleRect = e.data.rect;
        // Restart TS cycle if it was dormant
        if (tsPhase === 'running') { tsPhase = 'running'; }
      }
      if (e.data.type === '_rain_title_clear') {
        _msgTitleRect = null;
        tsPhase = 'running';  // reset cycle so it starts fresh when title reappears
      }
    });
  }

  function triggerImpactSplash(x, y, impactSpeed) {
    const speedT    = Math.min((impactSpeed - 16) / 48, 1);
    const scaleMin  = 0.4 + speedT * 0.4;
    const scaleMax  = scaleMin + rand(0, 1.6 * speedT + 0.4);
    const sizeScale = rand(scaleMin, scaleMax);
    const count     = 4 + Math.floor(rand(0, 3 + speedT * 3));
    for (let i = 0; i < count; i++) {
      const angle = rand(-Math.PI, Math.PI);
      const spd   = rand(0.6, 1.8) * (impactSpeed / 44) * sizeScale;
      impactParticles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - rand(0.3, 1.0) * sizeScale,
        maxAge: rand(10, 18) * Math.sqrt(sizeScale),
        age: 0,
        r: rand(0.4, 1.2) * sizeScale,
      });
    }
  }

  function drawImpactParticles() {
    const ctx = ctxs[MULTILAYER ? 2 : 0];
    impactParticles = impactParticles.filter(p => p.age < p.maxAge);
    impactParticles.forEach(p => {
      const t = p.age / p.maxAge;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.7 * OPACITY_MULT;
      ctx.fillStyle   = 'rgb(210,232,252)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 - t * 0.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.18;
      p.age++;
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────
  function rand(a, b) { return a + Math.random() * (b - a); }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvases.forEach(c => { c.width = W; c.height = H; });
    initDrops();
    if (USE_TIMESTOP) updateTitlePos();
  }

  function initDrops() {
    drops = [];
    STORM_LAYERS.forEach(([count, sMin, sMax, lMin, lMax, wMin, wMax, oMin, oMax], layerIdx) => {
      for (let i = 0; i < count; i++) {
        const rad = ANGLE_STORM * Math.PI / 180;
        drops.push({
          x: rand(-W * 0.1, W + _tanStorm * H * 1.1),
          y: rand(-H, H),
          speed:     rand(sMin, sMax),
          len:       rand(lMin, lMax),
          width:     rand(wMin, wMax),
          opacity:   rand(oMin, oMax),
          angleRad:  rad,
          dx: Math.sin(rad),
          dy: Math.cos(rad),
          threshold: Math.random(),
          layerIdx,
          splash: false, splashAge: 0, splashX: 0, splashY: 0,
          inMouseZone: false,
          inTitleZone: false,
        });
      }
    });
  }

  function drawSplash(d, ctx) {
    const age = d.splashAge / 12;
    const r   = age * 8;
    const o   = (1 - age) * 0.25 * OPACITY_MULT;
    ctx.save();
    ctx.strokeStyle = `rgba(200,225,245,${o})`;
    ctx.lineWidth   = 0.6;
    ctx.beginPath();
    ctx.ellipse(d.splashX, d.splashY, r * 1.8, r * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    d.splashAge++;
    if (d.splashAge > 12) d.splash = false;
  }

  // ── Time-stop ───────────────────────────────────────────────────
  const TS_SLOWDOWN = 900, TS_PAUSE = 1200, TS_RESUME = 1400;
  const TS_MIN = 0.04, TS_INTERVAL = 6500;
  let timeFactor = 1.0, tsPhase = 'running', tsPhaseStart = 0;

  function easeInOut(t) {
    t = Math.max(0, Math.min(1, t));
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  }
  function scheduleNextStop() {
    setTimeout(() => { tsPhase = 'slowing'; tsPhaseStart = performance.now(); }, TS_INTERVAL);
  }
  if (USE_TIMESTOP) {
    setTimeout(() => { tsPhase = 'slowing'; tsPhaseStart = performance.now(); }, 3000);
  }
  function updateTimeFactor(now) {
    if (!USE_TIMESTOP || !titleRect) { timeFactor = 1; return; }
    const elapsed = now - tsPhaseStart;
    switch (tsPhase) {
      case 'slowing':
        timeFactor = 1 - (1 - TS_MIN) * easeInOut(elapsed / TS_SLOWDOWN);
        if (elapsed >= TS_SLOWDOWN) { timeFactor = TS_MIN; tsPhase = 'paused'; tsPhaseStart = now; }
        break;
      case 'paused':
        timeFactor = TS_MIN;
        if (elapsed >= TS_PAUSE) { tsPhase = 'resuming'; tsPhaseStart = now; }
        break;
      case 'resuming':
        timeFactor = TS_MIN + (1 - TS_MIN) * easeInOut(elapsed / TS_RESUME);
        if (elapsed >= TS_RESUME) { timeFactor = 1; tsPhase = 'running'; scheduleNextStop(); }
        break;
      default: timeFactor = 1;
    }
  }

  // ── Volume / amplitude ──────────────────────────────────────────
  let volIntensity = 1.0;
  let _rawVol      = 1.0;
  const PAUSE_MIN  = 0.03;
  let pauseFactor  = 1.0;
  let _smoothAmp   = 1.0;

  function getRmsAmplitude() {
    const analyser = window._fpAnalyser ||
                     (window.top !== window && window.top._fpAnalyser) || null;
    if (!analyser) return 1.0;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
    return Math.sqrt(sum / buf.length);
  }

  function updateVolIntensity() {
    const fp  = window._fpAudio || (window.top !== window && window.top._fpAudio) || null;
    const raw = fp ? fp.volume : 1;
    _rawVol   = raw;

    if (USE_PAUSE) {
      const paused   = fp ? fp.paused : false;
      const pfTarget = paused ? PAUSE_MIN : 1.0;
      pauseFactor   += (pfTarget - pauseFactor) * (paused ? 0.015 : 0.04);
    }

    if (!USE_VOL) { volIntensity = 1.0; return; }

    const amp    = getRmsAmplitude();
    _smoothAmp  += (amp - _smoothAmp) * 0.12;
    const ampN   = Math.min(_smoothAmp / 0.25, 1.0);
    const ampFactor = 0.72 + 0.28 * ampN;
    const combined  = Math.min(raw * ampFactor / 0.72, 1.0);

    const k   = 10, mid = 0.32;
    const sig = v => 1 / (1 + Math.exp(-k * (v - mid)));
    const vol = (sig(combined) - sig(0)) / (sig(1) - sig(0));
    volIntensity += (vol - volIntensity) * 0.10;

    const targetRad = (ANGLE_QUIET + (ANGLE_STORM - ANGLE_QUIET) * volIntensity) * Math.PI / 180;
    _currentAngleRad = targetRad;
    drops.forEach(d => {
      d.angleRad += (targetRad - d.angleRad) * 0.015;
      d.dx = Math.sin(d.angleRad);
      d.dy = Math.cos(d.angleRad);
    });
  }

  // ── Navigation speed factor ─────────────────────────────────────
  // navFactor: 1 = normal speed, NAV_MIN = slowest during transition.
  // Decelerates to NAV_MIN on page-out, accelerates back to 1 on page-in.
  const NAV_OUT_MS = 800;
  const NAV_IN_MS  = 600;
  const NAV_MIN    = 0.15;   // never fully stops — rain crawls at 15% speed
  let navFactor = 1.0;
  let _navPhase = 'normal';  // 'out' | 'in' | 'normal'
  let _navStart = 0;

  function updateNavFactor(now) {
    if (_navPhase === 'out') {
      const t = Math.min((now - _navStart) / NAV_OUT_MS, 1);
      navFactor = NAV_MIN + (1 - NAV_MIN) * (1 - t * t);   // 1 → NAV_MIN, ease-in
    } else if (_navPhase === 'in') {
      const t = Math.min((now - _navStart) / NAV_IN_MS, 1);
      navFactor = NAV_MIN + (1 - NAV_MIN) * t * (2 - t);   // NAV_MIN → 1, ease-out
      if (t >= 1) { navFactor = 1; _navPhase = 'normal'; }
    }
  }

  // Exposed controls (called from shell or postMessage)
  window._rainNavOut = function() {
    if (_navPhase === 'out') return;   // already decelerating, don't reset
    _navPhase = 'out';
    _navStart = performance.now();
  };
  window._rainNavIn = function() {
    _navPhase = 'in';
    _navStart = performance.now();
    navFactor = NAV_MIN;
  };

  // ── Main loop ───────────────────────────────────────────────────
  let last = 0;
  function frame(ts) {
    const dt = Math.min((ts - last) / 16.67, 3);
    last = ts;

    updateTimeFactor(ts);
    updateVolIntensity();
    updateNavFactor(ts);
    if (USE_TIMESTOP) updateTitlePos();

    const density      = QUIET_DENSITY       + (1 - QUIET_DENSITY)       * volIntensity;
    const speedScale   = QUIET_SPEED_SCALE   + (1 - QUIET_SPEED_SCALE)   * volIntensity;
    const opacityScale = QUIET_OPACITY_SCALE + (1 - QUIET_OPACITY_SCALE) * volIntensity;
    const widthScale   = QUIET_WIDTH_SCALE   + (1 - QUIET_WIDTH_SCALE)   * volIntensity;

    ctxs.forEach(c => c.clearRect(0, 0, W, H));
    if (USE_MOUSE) drawImpactParticles();

    drops.forEach(d => {
      const ctxIdx = MULTILAYER ? d.layerIdx : 0;
      const ctx    = ctxs[ctxIdx];
      if (d.splash) { drawSplash(d, ctx); return; }
      if (d.threshold > density) return;

      const dtf          = getDropTimeFactor(d.x, d.y);
      const effectiveLen = d.len * speedScale * dtf * pauseFactor * navFactor;
      const x0 = d.x, y0 = d.y;
      const x1 = x0 - d.dx * effectiveLen;
      const y1 = y0 - d.dy * effectiveLen;

      const thickFade = 1 - Math.min(d.width / 3.8, 1) * 0.38;
      const eff = d.opacity * opacityScale * thickFade * OPACITY_MULT;
      const g   = ctx.createLinearGradient(x1, y1, x0, y0);
      g.addColorStop(0,   `rgba(200,225,248,0)`);
      g.addColorStop(0.6, `rgba(200,225,248,${eff * 0.5})`);
      g.addColorStop(1,   `rgba(210,232,252,${eff})`);

      ctx.save();
      ctx.strokeStyle = g;
      ctx.lineWidth   = d.width * widthScale;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x0, y0);
      ctx.stroke();
      ctx.restore();

      d.x += d.dx * d.speed * dt * dtf * speedScale * pauseFactor * navFactor;
      d.y += d.dy * d.speed * dt * dtf * speedScale * pauseFactor * navFactor;

      // Mouse barrier
      if (USE_MOUSE && mouseX !== null) {
        const mdx  = d.x - mouseX;
        const mdy  = d.y - mouseY;
        const dist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (dist < MOUSE_RADIUS && dist > 0.5) {
          if (!d.inMouseZone) {
            const dot = d.dx * (-mdx / dist) + d.dy * (-mdy / dist);
            if (dot > IMPACT_THRESHOLD) {
              triggerImpactSplash(
                mouseX + (mdx / dist) * MOUSE_RADIUS,
                mouseY + (mdy / dist) * MOUSE_RADIUS,
                d.speed * speedScale
              );
              d.x = rand(-W * 0.15, W + _tanStorm * H * 1.05);
              d.y = rand(-d.len * 3, -d.len);
              d.inMouseZone = false;
              return;
            }
          }
          const str = Math.pow(1 - dist / MOUSE_RADIUS, 2);
          d.x += (mdx / dist) * str * MOUSE_FORCE * dt;
          d.y += (mdy / dist) * str * MOUSE_FORCE * dt;
        }
        d.inMouseZone = dist < MOUSE_RADIUS;
      }

      // Title collision — drop hits the top surface of the title characters
      if (USE_TIMESTOP && titleRect) {
        const hitY = titleRect.top + 4;   // slightly inside top edge (character surfaces)
        const inRect = d.x >= titleRect.left - 4 && d.x <= titleRect.right + 4 &&
                       d.y >= hitY - 6 && d.y <= hitY + 8;
        if (inRect && !d.inTitleZone && Math.random() < 0.45) {
          // Pin splash to the character top surface
          triggerImpactSplash(d.x, hitY, d.speed * speedScale);
          d.x = rand(-W * 0.15, W + _tanStorm * H * 1.05);
          d.y = rand(-d.len * 3, -d.len);
          d.inTitleZone = false;
          return;
        }
        d.inTitleZone = inRect;
      }

      // Bottom reset
      if (d.y > H + d.len) {
        if (Math.random() < 0.3) {
          d.splash = true; d.splashAge = 0;
          d.splashX = d.x; d.splashY = H - 2;
        }
        d.x = rand(-W * 0.15, W + _tanStorm * H * 1.05);
        d.y = rand(-d.len * 3, -d.len);
        d.speed   = rand(d.speed   * 0.85, d.speed   * 1.15);
        d.opacity = rand(d.opacity * 0.80, d.opacity * 1.20);
      }
    });

    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
};
