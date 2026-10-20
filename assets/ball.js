/* Pista. La pelota que acompaña el scroll: sale del punto de la "i" de la portada, bota de
   sección en sección y acaba en la "i" del logo gigante del pie. Canvas 2D con costuras
   calculadas sobre una esfera de verdad, así gira en 3D sin cargar una librería 3D. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var layer = document.querySelector('.ball-layer');
  if (!layer || reduce) return;
  var canvas = layer.querySelector('canvas');
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  document.documentElement.classList.add('has-ball');

  var VB = { x: -9.9, y: -81.3, w: 182.5, h: 102.8 };
  var DOT = { x: 62.8, y: -71.4, r: 8.1 };
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var vw = 0, vh = 0, anchors = [], intro = 0;
  var pos = { x: 0, y: 0, r: 10 };
  var q = [1, 0, 0, 0];           // giro de la pelota (cuaternión)
  var last = null;

  // ---------- Costura de la pelota (curva sobre la esfera unidad) ----------
  var seam = [];
  (function () {
    var a = 1, b = 0.42, c = 2 * Math.sqrt(a * b);
    for (var i = 0; i <= 160; i++) {
      var t = i / 160 * Math.PI * 2;
      var x = a * Math.cos(t) + b * Math.cos(3 * t);
      var y = a * Math.sin(t) - b * Math.sin(3 * t);
      var z = c * Math.sin(2 * t);
      var l = Math.hypot(x, y, z);
      seam.push([x / l, y / l, z / l]);
    }
  })();

  // Fieltro: motas finas que dan textura sin que se note el truco.
  var felt = document.createElement('canvas');
  felt.width = felt.height = 96;
  (function () {
    var f = felt.getContext('2d');
    var img = f.createImageData(96, 96);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = Math.random();
      var on = v > 0.55;
      img.data[i] = on ? 255 : 60; img.data[i + 1] = on ? 255 : 80; img.data[i + 2] = on ? 220 : 20;
      img.data[i + 3] = on ? Math.round((v - 0.55) * 120) : Math.round(v * 40);
    }
    f.putImageData(img, 0, 0);
  })();

  function qmul(a, b) {
    return [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
            a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
            a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
            a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
  }
  function qrot(q, v) {
    var x = v[0], y = v[1], z = v[2], w = q[0], qx = q[1], qy = q[2], qz = q[3];
    var ix = w * x + qy * z - qz * y, iy = w * y + qz * x - qx * z, iz = w * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
    return [ix * w + iw * -qx + iy * -qz - iz * -qy, iy * w + iw * -qy + iz * -qx - ix * -qz, iz * w + iw * -qz + ix * -qy - iy * -qx];
  }
  function roll(dx, dy, r) {
    var d = Math.hypot(dx, dy);
    if (d < 0.01 || r <= 0) return;
    var angle = d / r;
    var ax = dy / d, ay = dx / d;      // eje perpendicular al movimiento, en el plano de la pantalla
    var s = Math.sin(angle / 2);
    q = qmul([Math.cos(angle / 2), ax * s, ay * s, 0], q);
    var n = Math.hypot(q[0], q[1], q[2], q[3]);
    q = [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
  }

  // ---------- Dónde se posa la pelota en cada sección ----------
  function measure() {
    vw = window.innerWidth; vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    var sy = window.scrollY;
    var small = vw < 860 ? 0.72 : 1;
    anchors = [];
    document.querySelectorAll('[data-ball]').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var kind = el.getAttribute('data-ball');
      var a = { kind: kind };
      if (el.tagName.toLowerCase() === 'svg') {
        a.x = r.left + (DOT.x - VB.x) / VB.w * r.width;
        a.y = r.top + sy + (DOT.y - VB.y) / VB.h * r.height;
        a.r = DOT.r / VB.w * r.width;
      } else if (kind === 'manifesto') {
        a.r = 20 * small; a.x = r.right + a.r * 0.4; a.y = r.top + sy - a.r * 0.3;
      } else if (kind === 'phone') {
        a.r = 22; a.x = r.right - r.width * 0.18; a.y = r.top + sy - 22;
      } else if (kind === 'people') {
        a.r = 30 * small; a.x = r.left + r.width / 2; a.y = r.top + sy - a.r * 1.6;
      } else if (kind === 'plans') {
        a.r = 20 * small; a.x = r.right - a.r * 1.6; a.y = r.top + sy - a.r;
      } else if (kind === 'bib') {
        a.r = 24 * small; a.x = r.left + r.width * 0.5; a.y = r.top + sy - a.r;
      } else {
        a.r = 20; a.x = r.left + r.width / 2; a.y = r.top + sy - 20;
      }
      // La pelota llega cuando el sitio donde se posa está a media pantalla (la de la portada, desde el principio).
      a.s = kind === 'hero' ? 0 : Math.max(0, a.y - vh * 0.52);
      if (kind === 'footer') a.s = Math.max(0, document.documentElement.scrollHeight - vh);
      anchors.push(a);
    });
    anchors.sort(function (p, n) { return p.s - n.s; });
  }

  function place(s) {
    if (!anchors.length) return;
    var dwell = vh * 0.12;
    var first = anchors[0];
    if (s <= first.s + dwell) { set(first.x, first.y, first.r, 0); return; }
    for (var i = 0; i < anchors.length - 1; i++) {
      var A = anchors[i], B = anchors[i + 1];
      var start = A.s + dwell, end = B.s - dwell;
      if (end <= start) end = start + 1;
      if (s < start) { set(A.x, A.y, A.r, 0); return; }
      if (s <= end) {
        var t = (s - start) / (end - start);
        var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;    // suave al salir y al llegar
        var arc = Math.min(vh * 0.32, Math.abs(B.y - A.y) * 0.22 + 90);
        // Botes: un arco grande y uno pequeño antes de posarse.
        var hop = t < 0.78 ? Math.sin(Math.PI * t / 0.78) * arc : Math.sin(Math.PI * (t - 0.78) / 0.22) * arc * 0.18;
        var x = A.x + (B.x - A.x) * e;
        var y = A.y + (B.y - A.y) * e - hop;
        var r = A.r + (B.r - A.r) * e;
        set(x, y, r, t);
        return;
      }
    }
    var L = anchors[anchors.length - 1];
    set(L.x, L.y, L.r, 0);
  }

  function set(x, y, r) { pos.x = x; pos.y = y; pos.r = r; }

  // ---------- Dibujo ----------
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    var cx = pos.x, cy = pos.y - window.scrollY - intro, r = pos.r;
    if (cy < -r * 3 || cy > vh + r * 3) return;

    // Sombra suave cuando está posada
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.22 - intro / 900);
    ctx.fillStyle = '#0b0c0a';
    ctx.filter = 'blur(' + Math.max(2, r * 0.35) + 'px)';
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.15, cy + r * 0.98 + intro * 0.02, r * 0.85, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    var g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
    g.addColorStop(0, '#f0ff8f'); g.addColorStop(0.45, '#d7f24b'); g.addColorStop(1, '#9fb92a');
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(felt, cx - r, cy - r, r * 2, r * 2);
    ctx.globalAlpha = 1;

    // Costuras: solo la parte que mira hacia nosotros, más tenue cerca del borde
    var w = Math.max(1, r * 0.1);
    ctx.lineCap = 'round';
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < seam.length - 1; i++) {
        var p1 = qrot(q, seam[i]), p2 = qrot(q, seam[i + 1]);
        var z = (p1[2] + p2[2]) / 2;
        if (z <= 0) continue;
        var fade = Math.min(1, z / 0.35);
        ctx.beginPath();
        ctx.moveTo(cx + p1[0] * r, cy - p1[1] * r);
        ctx.lineTo(cx + p2[0] * r, cy - p2[1] * r);
        if (pass === 0) { ctx.strokeStyle = 'rgba(80,100,10,' + 0.35 * fade + ')'; ctx.lineWidth = w * 1.8; }
        else { ctx.strokeStyle = 'rgba(250,252,236,' + 0.92 * fade + ')'; ctx.lineWidth = w; }
        ctx.stroke();
      }
    }

    // Luz: brillo arriba a la izquierda y sombra abajo a la derecha
    var shade = ctx.createRadialGradient(cx - r * 0.45, cy - r * 0.5, r * 0.2, cx, cy, r * 1.15);
    shade.addColorStop(0, 'rgba(255,255,255,0.28)');
    shade.addColorStop(0.5, 'rgba(255,255,255,0)');
    shade.addColorStop(1, 'rgba(20,40,0,0.38)');
    ctx.fillStyle = shade; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  function frame() {
    var s = window.scrollY;
    place(s);
    if (last) roll(pos.x - last.x, (pos.y - s) - (last.y - last.s), pos.r);
    q = qmul([Math.cos(0.0025), 0, Math.sin(0.0025), 0], q);   // gira un poco aunque esté quieta
    last = { x: pos.x, y: pos.y, s: s };
    draw();
    requestAnimationFrame(frame);
  }

  function start() {
    measure();
    // Entrada: cae desde arriba y bota hasta posarse en la "i".
    var t0 = performance.now(), drop = Math.min(vh * 0.7, 520);
    intro = drop;
    function fall(now) {
      var t = Math.min(1, (now - t0 - 500) / 1300);
      if (t < 0) { requestAnimationFrame(fall); return; }
      var b = 1 - t, bounce;
      // rebote amortiguado
      var n1 = 7.5625, d1 = 2.75, x = t;
      if (x < 1 / d1) bounce = n1 * x * x;
      else if (x < 2 / d1) bounce = n1 * (x -= 1.5 / d1) * x + 0.75;
      else if (x < 2.5 / d1) bounce = n1 * (x -= 2.25 / d1) * x + 0.9375;
      else bounce = n1 * (x -= 2.625 / d1) * x + 0.984375;
      intro = drop * (1 - bounce);
      if (b > 0) requestAnimationFrame(fall); else intro = 0;
    }
    requestAnimationFrame(fall);
    requestAnimationFrame(frame);
  }

  var resizeTimer;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(measure, 150); });
  if ('ResizeObserver' in window) new ResizeObserver(function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(measure, 150); }).observe(document.body);
  window.PistaBall = { measure: measure };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else window.addEventListener('load', start);
})();
