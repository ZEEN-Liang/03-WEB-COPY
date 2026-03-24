(function() {
  const canvas = document.getElementById('rain-canvas');
  const ctx    = canvas.getContext('2d');

  // Drop configuration
  const LAYERS = [
    // [ count, speedMin, speedMax, lengthMin, lengthMax, thicknessMin, thicknessMax, opacityMin, opacityMax, angle ]
    [ 120, 14, 22,  18, 34,  0.5, 1.0,  0.06, 0.18,  -12 ],  // distant — fine, faint
    [  60, 20, 30,  26, 50,  0.7, 1.4,  0.10, 0.25,  -14 ],  // mid
    [  28, 28, 40,  40, 72,  1.0, 1.8,  0.18, 0.38,  -16 ],  // foreground — thick, bright
  ];

  let drops = [];
  let W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    initDrops();
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function initDrops() {
    drops = [];
    LAYERS.forEach(([count, sMin, sMax, lMin, lMax, wMin, wMax, oMin, oMax, ang]) => {
      const rad = ang * Math.PI / 180;
      for (let i = 0; i < count; i++) {
        drops.push({
          x:  rand(-W * 0.1, W * 1.1),
          y:  rand(-H, H),
          speed:   rand(sMin, sMax),
          len:     rand(lMin, lMax),
          width:   rand(wMin, wMax),
          opacity: rand(oMin, oMax),
          rad,
          dx: Math.sin(rad),
          dy: Math.cos(rad),
          // Splash state
          splash: false,
          splashAge: 0,
          splashX: 0,
          splashY: 0,
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

  let last = 0;
  function frame(ts) {
    const dt = Math.min((ts - last) / 16.67, 3);
    last = ts;

    ctx.clearRect(0, 0, W, H);

    drops.forEach(d => {
      if (d.splash) { drawSplash(d); return; }

      // Draw streak with gradient fade
      const x0 = d.x;
      const y0 = d.y;
      const x1 = d.x - d.dx * d.len;
      const y1 = d.y - d.dy * d.len;

      const g = ctx.createLinearGradient(x1, y1, x0, y0);
      g.addColorStop(0, `rgba(200,225,248,0)`);
      g.addColorStop(0.6, `rgba(200,225,248,${d.opacity * 0.5})`);
      g.addColorStop(1,   `rgba(210,232,252,${d.opacity})`);

      ctx.save();
      ctx.strokeStyle = g;
      ctx.lineWidth   = d.width;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x0, y0);
      ctx.stroke();
      ctx.restore();

      // Move
      d.x += d.dx * d.speed * dt;
      d.y += d.dy * d.speed * dt;

      // Hit bottom — splash + reset
      if (d.y > H + d.len) {
        if (Math.random() < 0.3) {
          d.splash   = true;
          d.splashAge = 0;
          d.splashX  = d.x;
          d.splashY  = H - 2;
        }
        d.x = rand(-W * 0.15, W * 1.05);
        d.y = rand(-d.len * 3, -d.len);
        d.speed   = rand(d.speed * 0.85, d.speed * 1.15);
        d.opacity = rand(d.opacity * 0.8, d.opacity * 1.2);
      }
    });

    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
