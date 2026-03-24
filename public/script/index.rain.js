(function() {
  const canvas = document.getElementById('rain-canvas');
  const ctx    = canvas.getContext('2d');

  // ── Rain intensity driven by audio volume ─────────────────────
  // No preset locking. volIntensity (smoothed audio.volume, 0–1) drives
  // every parameter continuously:
  //   0 = 毛毛细雨  →  1 = 暴风雨
  //
  // All drops are always present (storm-level count); density is
  // controlled by per-drop thresholds.

  // Storm-level (max) layer defs: [count, sMin, sMax, lMin, lMax, wMin, wMax, oMin, oMax]
  const STORM_LAYERS = [
    [ 310, 24, 40, 28,  56, 1.00, 2.00, 0.11, 0.28 ],
    [ 170, 34, 52, 44,  82, 1.60, 2.80, 0.18, 0.40 ],
    [  85, 44, 65, 64, 112, 2.40, 3.80, 0.28, 0.55 ],
  ];

  // Scale factors at minimum intensity (vol = 0, 毛毛细雨)
  const QUIET_SPEED_SCALE   = 0.45;
  const QUIET_OPACITY_SCALE = 0.50;
  const QUIET_WIDTH_SCALE   = 0.45;
  const QUIET_DENSITY       = 0.55;  // fraction of drops visible at vol = 0

  // Angle range (degrees, negative = leftward tilt)
  const ANGLE_QUIET = -4;
  const ANGLE_STORM = -30;

  // Tan of storm angle for maximum spawn-range coverage (never shrinks)
  const _tanStorm = Math.abs(Math.tan(ANGLE_STORM * Math.PI / 180));

  // Current lerped angle in radians (updated each frame)
  let _currentAngleRad = ANGLE_STORM * Math.PI / 180;

  let drops = [];
  let W, H;

  // ── Spatial time-distortion centre (title position) ───────────
  let INFLUENCE_RADIUS = 380;
  let titleX = 0, titleY = 0;
  let titleRect = null;  // bounding rect for collision

  function updateTitlePos() {
    INFLUENCE_RADIUS = Math.sqrt(W * W + H * H) * 0.18;
    const el = document.querySelector('.main-title');
    if (el) {
      const r  = el.getBoundingClientRect();
      titleRect = r;
      titleX = r.left + r.width  / 2 + Math.sin(_currentAngleRad) * INFLUENCE_RADIUS * 0.08;
      titleY = r.top  + r.height / 2 + Math.cos(_currentAngleRad) * INFLUENCE_RADIUS * 0.08;
    } else {
      titleRect = null;
      titleX = W / 2;
      titleY = H * 0.38;
    }
  }

  // Per-drop effective time factor (sigmoid spatial falloff near title)
  const _sigmoidK = 9;
  function getDropTimeFactor(x, y) {
    // Title influence fades out below vol 40%; zero at vol 0
    const titleInfluence = Math.min(_rawVol / 0.4, 1.0);
    if (titleInfluence === 0) return 1.0;
    const dx = x - titleX;
    const dy = y - titleY;
    const t  = Math.sqrt(dx * dx + dy * dy) / INFLUENCE_RADIUS;
    const s  = 1 / (1 + Math.exp(_sigmoidK * (t - 1))) * titleInfluence;
    return timeFactor * s + 1.0 * (1 - s);
  }

  // ── Mouse barrier ─────────────────────────────────────────────
  const MOUSE_RADIUS = 100;
  const MOUSE_FORCE  = 40;

  let mouseX = null, mouseY = null;
  window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
  window.addEventListener('mouseleave', () => { mouseX = null; mouseY = null; });

  // ── Mouse-impact splash particles ─────────────────────────────
  const IMPACT_THRESHOLD = 0.50;  // cos(60°) — wider impact cone
  let impactParticles = [];

  function triggerImpactSplash(x, y, impactSpeed) {
    const speedT   = Math.min((impactSpeed - 16) / 48, 1);
    const scaleMin = 0.4 + speedT * 0.4;
    const scaleMax = scaleMin + rand(0, 1.6 * speedT + 0.4);
    const sizeScale = rand(scaleMin, scaleMax);
    const count = 4 + Math.floor(rand(0, 3 + speedT * 3));
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
    impactParticles = impactParticles.filter(p => p.age < p.maxAge);
    impactParticles.forEach(p => {
      const t = p.age / p.maxAge;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.7;
      ctx.fillStyle   = `rgb(210,232,252)`;
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

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    initDrops();
    updateTitlePos();
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function initDrops() {
    drops = [];
    STORM_LAYERS.forEach(([count, sMin, sMax, lMin, lMax, wMin, wMax, oMin, oMax]) => {
      for (let i = 0; i < count; i++) {
        const rad = ANGLE_STORM * Math.PI / 180;
        drops.push({
          x:         rand(-W * 0.1, W + _tanStorm * H * 1.1),
          y:         rand(-H, H),
          speed:     rand(sMin, sMax),
          len:       rand(lMin, lMax),
          width:     rand(wMin, wMax),
          opacity:   rand(oMin, oMax),
          angleRad:  rad,
          dx:        Math.sin(rad),
          dy:        Math.cos(rad),
          threshold: Math.random(),  // active when threshold < density
          splash: false, splashAge: 0, splashX: 0, splashY: 0,
          inMouseZone: false,
          inTitleZone: false,
        });
      }
    });
  }

  function drawSplash(d) {
    const age = d.splashAge / 12;
    const r   = age * 8;
    const o   = (1 - age) * 0.25;
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

  // ── Time-stop effect ─────────────────────────────────────────
  const TS_SLOWDOWN = 900;
  const TS_PAUSE    = 1200;
  const TS_RESUME   = 1400;
  const TS_MIN      = 0.04;
  const TS_INTERVAL = 6500;

  let timeFactor   = 1.0;
  let tsPhase      = 'running';
  let tsPhaseStart = 0;

  function easeInOut(t) {
    t = Math.max(0, Math.min(1, t));
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  }

  function scheduleNextStop() {
    setTimeout(() => {
      tsPhase      = 'slowing';
      tsPhaseStart = performance.now();
    }, TS_INTERVAL);
  }

  setTimeout(() => {
    tsPhase      = 'slowing';
    tsPhaseStart = performance.now();
  }, 3000);

  function updateTimeFactor(now) {
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
      default:
        timeFactor = 1;
    }
  }

  // ── Volume-driven intensity ───────────────────────────────────
  // volIntensity smoothly tracks audio.volume (0–1).
  // All rain parameters lerp between quiet (0) and storm (1) levels.
  let volIntensity = 1.0;
  let _rawVol      = 1.0;  // unprocessed audio.volume, used for title-influence gate

  // ── Pause-driven slowdown ─────────────────────────────────────
  // pauseFactor → 1.0 when playing, → PAUSE_MIN when paused
  const PAUSE_MIN = 0.03;
  let pauseFactor = 1.0;

  // Smoothed amplitude from AnalyserNode (0–1), persists between frames
  let _smoothAmp = 1.0;

  function getRmsAmplitude() {
    const analyser = window._fpAnalyser || (window.top !== window && window.top._fpAnalyser) || null;
    if (!analyser) return 1.0;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
    return Math.sqrt(sum / buf.length);  // 0–1
  }

  function updateVolIntensity() {
    const fp  = window._fpAudio || window.top._fpAudio || null;
    const raw = fp ? fp.volume : 1;
    _rawVol   = raw;

    // Blend raw RMS amplitude into effective volume.
    // When music is silent (amp≈0) rain reduces; loud passage → full intensity.
    // amp is normalised: quiet≈0.02, loud≈0.3+. Map to 0.3–1 range so even
    // quiet passages don't kill the rain completely.
    const amp    = getRmsAmplitude();
    _smoothAmp  += (amp - _smoothAmp) * 0.12;
    const ampN   = Math.min(_smoothAmp / 0.25, 1.0);        // 0.25 RMS = full
    const ampFactor = 0.72 + 0.28 * ampN;                   // 0.72–1.0
    const combined = Math.min(raw * ampFactor / 0.72, 1.0); // normalise so vol=1,amp=full→1

    // Smoothly slow down when paused, resume when playing
    const paused  = fp ? fp.paused : false;
    const pfTarget = paused ? PAUSE_MIN : 1.0;
    const pfLerp   = paused ? 0.015 : 0.04;  // slow to stop, quicker to resume
    pauseFactor += (pfTarget - pauseFactor) * pfLerp;
    // Sigmoid centred at 0.45 (middle of 30–60% range) — steepest slope there.
    // Normalised so that sigmoid(0)→0 and sigmoid(1)→1.
    const k    = 10;
    const mid  = 0.32;
    const s    = (v) => 1 / (1 + Math.exp(-k * (v - mid)));
    const vol  = (s(combined) - s(0)) / (s(1) - s(0));
    volIntensity += (vol - volIntensity) * 0.10;

    // Lerp each drop's angle toward the current target
    const targetRad = (ANGLE_QUIET + (ANGLE_STORM - ANGLE_QUIET) * volIntensity) * Math.PI / 180;
    _currentAngleRad = targetRad;
    drops.forEach(d => {
      d.angleRad += (targetRad - d.angleRad) * 0.015;
      d.dx = Math.sin(d.angleRad);
      d.dy = Math.cos(d.angleRad);
    });
  }

  let last = 0;
  function frame(ts) {
    const dt = Math.min((ts - last) / 16.67, 3);
    last = ts;

    updateTimeFactor(ts);
    updateVolIntensity();
    if (exitMode) exitFactor = computeExitFactor(ts - exitStart);

    // Per-frame scale factors derived from volIntensity
    const density      = QUIET_DENSITY       + (1 - QUIET_DENSITY)       * volIntensity;
    const speedScale   = QUIET_SPEED_SCALE   + (1 - QUIET_SPEED_SCALE)   * volIntensity;
    const opacityScale = QUIET_OPACITY_SCALE + (1 - QUIET_OPACITY_SCALE) * volIntensity;
    const widthScale   = QUIET_WIDTH_SCALE   + (1 - QUIET_WIDTH_SCALE)   * volIntensity;

    ctx.clearRect(0, 0, W, H);
    drawImpactParticles();

    drops.forEach(d => {
      if (d.splash) { drawSplash(d); return; }

      // Skip inactive drops (density culling)
      if (d.threshold > density) return;

      const x0  = d.x;
      const y0  = d.y;
      const dtf = getDropTimeFactor(d.x, d.y);
      const effectiveLen = d.len * speedScale * dtf * pauseFactor * exitFactor;
      const x1  = d.x - d.dx * effectiveLen;
      const y1  = d.y - d.dy * effectiveLen;

      // Wider drops get a small extra transparency so they don't look too solid
      const thickFade = 1 - Math.min(d.width / 3.8, 1) * 0.38;
      const eff = d.opacity * opacityScale * thickFade;
      const g = ctx.createLinearGradient(x1, y1, x0, y0);
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

      d.x += d.dx * d.speed * dt * dtf * speedScale * pauseFactor * exitFactor;
      d.y += d.dy * d.speed * dt * dtf * speedScale * pauseFactor * exitFactor;

      // Mouse barrier
      if (mouseX !== null) {
        const mdx  = d.x - mouseX;
        const mdy  = d.y - mouseY;
        const dist = Math.sqrt(mdx * mdx + mdy * mdy);

        if (dist < MOUSE_RADIUS && dist > 0.5) {
          if (!d.inMouseZone) {
            const dot = d.dx * (-mdx / dist) + d.dy * (-mdy / dist);
            if (dot > IMPACT_THRESHOLD) {
              const bx = mouseX + (mdx / dist) * MOUSE_RADIUS;
              const by = mouseY + (mdy / dist) * MOUSE_RADIUS;
              triggerImpactSplash(bx, by, d.speed * speedScale);
              d.x = rand(-W * 0.15, W + _tanStorm * H * 1.05);
              d.y = rand(-d.len * 3, -d.len);
              d.inMouseZone = false;
              return;
            }
          }
          const strength = Math.pow(1 - dist / MOUSE_RADIUS, 2);
          d.x += (mdx / dist) * strength * MOUSE_FORCE * dt;
          d.y += (mdy / dist) * strength * MOUSE_FORCE * dt;
        }
        d.inMouseZone = dist < MOUSE_RADIUS;
      }

      // Title collision — probabilistic shatter on entry
      if (titleRect) {
        // Trigger at the top edge of the title (thin band just above/at the top line)
        const inRect = d.x >= titleRect.left && d.x <= titleRect.right &&
                       d.y >= titleRect.top - 18 && d.y <= titleRect.top - 2;
        if (inRect && !d.inTitleZone && Math.random() < 0.45) {
          triggerImpactSplash(d.x, d.y, d.speed * speedScale);
          d.x = rand(-W * 0.15, W + _tanStorm * H * 1.05);
          d.y = rand(-d.len * 3, -d.len);
          d.inTitleZone = false;
          return;
        }
        d.inTitleZone = inRect;
      }

      // Hit bottom — reset
      if (d.y > H + d.len) {
        if (Math.random() < 0.3) {
          d.splash    = true;
          d.splashAge = 0;
          d.splashX   = d.x;
          d.splashY   = H - 2;
        }
        d.x = rand(-W * 0.15, W + _tanStorm * H * 1.05);
        d.y = rand(-d.len * 3, -d.len);
        d.speed   = rand(d.speed * 0.85, d.speed * 1.15);
        d.opacity = rand(d.opacity * 0.8, d.opacity * 1.2);
      }
    });

    requestAnimationFrame(frame);
  }

  // ── Exit animation — triggered by "进入广场" click ────────────
  // Phase 1 (0–700 ms): decelerate 1 → 0 (easeIn)
  // Phase 2 (700–1700 ms): accelerate in reverse 0 → -2.5 (easeOut)
  // At 1700 ms: navigate to destination
  const EXIT_TOTAL  = 800;  // ms

  let exitMode      = false;
  let exitStart     = 0;
  let exitDestUrl   = '';
  let exitFactor    = 1.0;

  function computeExitFactor(elapsed) {
    // Ease-in deceleration: 1 → 0 over EXIT_TOTAL
    const t = Math.min(elapsed / EXIT_TOTAL, 1);
    return 1 - t * t;
  }

  // Intercept .enter-btn click before nav-intercept.js (capture = true, registered first)
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.enter-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();  // also block nav-intercept.js on same node
    if (exitMode) return;
    exitDestUrl = btn.getAttribute('href') || '/forum.html';
    exitMode    = true;
    exitStart   = performance.now();

    // Fade out the main title over the full animation duration.
    // Two-rAF trick: let the browser register the current opacity first,
    // then apply the transition + target value on the next paint.
    const titleEl = document.querySelector('.main-title');
    if (titleEl) {
      // Freeze current opacity, cancel the CSS animation, then transition to 0
      titleEl.style.opacity    = getComputedStyle(titleEl).opacity;
      titleEl.style.animation  = 'none';
      void titleEl.offsetHeight; // force reflow so browser registers the frozen state
      titleEl.style.transition = `opacity ${EXIT_TOTAL}ms ease-in`;
      titleEl.style.opacity    = '0';
    }
    setTimeout(() => {
      if (typeof window.navigate === 'function') {
        window.navigate(exitDestUrl);
      } else {
        location.href = exitDestUrl;
      }
    }, EXIT_TOTAL);
  }, true);

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
