/* ATOMLAB · InnoWeek — интерактивные сцены слайдов (без библиотек, работает офлайн).
 * Каждая сцена: init() один раз, enter()/leave() при показе слайда, lang() при смене языка. */
(function () {
  'use strict';

  var SCENES = (window.SCENES = {});
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function t(k) { return window.DECK ? window.DECK.t(k) : k; }
  function lang() { return window.DECK ? window.DECK.lang : 'ru'; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  function easeIO(x) { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function seg(time, a, b) { return clamp((time - a) / (b - a), 0, 1); }

  /** Холст внутри масштабируемой сцены: логические размеры = CSS-пиксели сцены, чёткость — по реальному масштабу. */
  function fit(canvas) {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    var k = (window.DECK ? window.DECK.scale : 1) * (window.devicePixelRatio || 1);
    k = clamp(k, 0.5, 3);
    var W = Math.max(1, Math.round(w * k)), H = Math.max(1, Math.round(h * k));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(W / w, 0, 0, H / h, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function loop(fn) {
    var id = 0, on = false, last = 0;
    function frame(ts) {
      if (!on) return;
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
      last = ts;
      fn(dt, ts / 1000);
      id = requestAnimationFrame(frame);
    }
    return {
      start: function () { if (on) return; on = true; last = 0; id = requestAnimationFrame(frame); },
      stop: function () { on = false; cancelAnimationFrame(id); },
      get running() { return on; },
    };
  }

  /* ================================================================ фон: «молекулярная сеть» */
  SCENES._bg = (function () {
    var cv, ctx, pts = [], W = 0, H = 0, dpr = 1;
    var COLORS = ['96,165,250', '139,92,246', '236,72,153', '45,212,191'];
    function size() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = clamp(Math.round((W * H) / 26000), 30, 90);
      pts = [];
      for (var i = 0; i < n; i++) {
        pts.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, r: 1 + Math.random() * 1.8, c: COLORS[i % COLORS.length] });
      }
    }
    function draw(dt) {
      ctx.clearRect(0, 0, W, H);
      var i, j, a, b, dx, dy, d, R = 150;
      for (i = 0; i < pts.length; i++) {
        a = pts[i];
        a.x += a.vx * dt; a.y += a.vy * dt;
        if (a.x < -20) a.x = W + 20; if (a.x > W + 20) a.x = -20;
        if (a.y < -20) a.y = H + 20; if (a.y > H + 20) a.y = -20;
      }
      ctx.lineWidth = 1;
      for (i = 0; i < pts.length; i++) {
        a = pts[i];
        for (j = i + 1; j < pts.length; j++) {
          b = pts[j]; dx = a.x - b.x; dy = a.y - b.y;
          if (dx > R || dx < -R || dy > R || dy < -R) continue;
          d = Math.sqrt(dx * dx + dy * dy);
          if (d < R) {
            ctx.strokeStyle = 'rgba(' + a.c + ',' + ((1 - d / R) * 0.16).toFixed(3) + ')';
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (i = 0; i < pts.length; i++) {
        a = pts[i];
        ctx.fillStyle = 'rgba(' + a.c + ',0.7)';
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    var L = loop(function (dt) { draw(dt); });
    return {
      init: function () {
        cv = document.getElementById('bg'); ctx = cv.getContext('2d');
        size();
        window.addEventListener('resize', size);
        if (reduce) draw(0); else L.start();
        document.addEventListener('visibilitychange', function () { if (document.hidden) L.stop(); else if (!reduce) L.start(); });
      },
    };
  })();

  /* ================================================================ 3D-молекула (шарики и палочки) */
  var CPK = { H: '#e9eef8', C: '#7b8aa8', O: '#ff5d63', N: '#5b8dff', S: '#ffd23f', P: '#ff9f43', Cl: '#3ddc84', F: '#86efac', Br: '#d0643f', I: '#a77bff', Na: '#b388ff' };
  var RAD = { H: 0.27, C: 0.42, O: 0.4, N: 0.41, S: 0.52, P: 0.5, Cl: 0.5, F: 0.36, Br: 0.55, I: 0.6, Na: 0.6 };
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (k > 0) { r = r + (255 - r) * k; g = g + (255 - g) * k; b = b + (255 - b) * k; } else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  }

  function hillFormula(els) {
    var cnt = {}, i;
    for (i = 0; i < els.length; i++) cnt[els[i]] = (cnt[els[i]] || 0) + 1;
    var keys = Object.keys(cnt).sort();
    var order = [];
    if (cnt.C) { order.push('C'); if (cnt.H) order.push('H'); }
    keys.forEach(function (k) { if (order.indexOf(k) < 0) order.push(k); });
    return order.map(function (k) {
      var n = cnt[k];
      if (n === 1) return k;
      return k + String(n).split('').map(function (d) { return String.fromCharCode(0x2080 + Number(d)); }).join('');
    }).join('');
  }

  function MolViewer(canvas, o) {
    o = o || {};
    var self = this;
    var atoms = [], bonds = [], R = 1;
    var yaw = 0.6, pitch = -0.35, vyaw = o.spin || 0.35, vpitch = 0;
    var dragging = false, lx = 0, ly = 0, lastMove = -10, appear = 1, clock = 0;
    this.glow = !!o.glow;
    this.load = function (mol) {
      var n = mol.el.length, i, cx = 0, cy = 0, cz = 0;
      atoms = [];
      for (i = 0; i < n; i++) { cx += mol.p[i * 3]; cy += mol.p[i * 3 + 1]; cz += mol.p[i * 3 + 2]; }
      cx /= n; cy /= n; cz /= n;
      R = 0.5;
      for (i = 0; i < n; i++) {
        var a = { e: mol.el[i], x: mol.p[i * 3] - cx, y: mol.p[i * 3 + 1] - cy, z: mol.p[i * 3 + 2] - cz };
        R = Math.max(R, Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z) + 0.5);
        atoms.push(a);
      }
      bonds = [];
      for (i = 0; i + 2 < mol.b.length; i += 3) bonds.push([mol.b[i], mol.b[i + 1], mol.b[i + 2]]);
      appear = 0;
    };
    function onDown(e) { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); }
    function onMove(e) {
      if (!dragging) return;
      var s = window.DECK ? window.DECK.scale : 1;
      var dx = (e.clientX - lx) / s, dy = (e.clientY - ly) / s;
      lx = e.clientX; ly = e.clientY;
      yaw += dx * 0.008; pitch += dy * 0.008;
      vyaw = dx * 0.5; vpitch = dy * 0.5;
      lastMove = clock;
    }
    function onUp() { dragging = false; }
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    this.frame = function (dt) {
      clock += dt;
      var f = fit(canvas), ctx = f.ctx, w = f.w, h = f.h;
      ctx.clearRect(0, 0, w, h);
      if (!atoms.length) return;
      appear = Math.min(1, appear + dt * 1.6);
      if (!dragging) {
        var idle = clock - lastMove > 1.5;
        var target = o.spin || 0.35;
        vyaw = idle ? lerp(vyaw, target, Math.min(1, dt * 1.5)) : vyaw * Math.pow(0.05, dt);
        vpitch = vpitch * Math.pow(0.05, dt);
        yaw += vyaw * dt; pitch += vpitch * dt;
        if (idle) pitch = lerp(pitch, -0.35 + Math.sin(clock * 0.4) * 0.18, Math.min(1, dt * 0.8));
      }
      var cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      var pop = 1 - Math.pow(1 - appear, 3);
      var scale = (Math.min(w, h) * (o.fill || 0.4)) / R * (0.82 + 0.18 * pop);
      var D = R * 4.2, cx = w / 2, cy = h / 2 + (o.dy || 0);
      var P = atoms.map(function (a) {
        var x = a.x * cyw + a.z * syw, z = -a.x * syw + a.z * cyw;
        var y = a.y * cp - z * sp; z = a.y * sp + z * cp;
        var k = D / (D - z);
        return { x: cx + x * scale * k, y: cy - y * scale * k, z: z, k: k, e: a.e };
      });
      var prim = [];
      bonds.forEach(function (b) { prim.push({ t: 0, z: (P[b[0]].z + P[b[1]].z) / 2 - 0.01, b: b }); });
      P.forEach(function (p, i) { prim.push({ t: 1, z: p.z, i: i }); });
      prim.sort(function (a, b) { return a.z - b.z; });
      ctx.globalAlpha = pop;
      if (self.glow) {
        var g0 = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * scale * 1.15);
        g0.addColorStop(0, 'rgba(139,92,246,0.18)'); g0.addColorStop(1, 'rgba(139,92,246,0)');
        ctx.fillStyle = g0; ctx.fillRect(0, 0, w, h);
      }
      ctx.lineCap = 'round';
      prim.forEach(function (q) {
        if (q.t === 0) {
          var A = P[q.b[0]], B = P[q.b[1]], ord = Math.round(q.b[2] || 1);
          var dx = B.x - A.x, dy = B.y - A.y, L = Math.sqrt(dx * dx + dy * dy) || 1;
          var nx = -dy / L, ny = dx / L, kk = (A.k + B.k) / 2;
          var lw = 0.11 * scale * kk, off = ord > 1 ? 0.085 * scale * kk : 0;
          var depth = clamp(0.55 + q.z / (R * 2), 0.35, 1);
          for (var m = 0; m < ord; m++) {
            var s = ord === 1 ? 0 : (m - (ord - 1) / 2) * off * 1.6;
            var mx = (A.x + B.x) / 2 + nx * s, my = (A.y + B.y) / 2 + ny * s;
            ctx.lineWidth = ord > 1 ? lw * 0.62 : lw;
            ctx.strokeStyle = shade(CPK[A.e] || '#aab', -0.35 + depth * 0.3);
            ctx.beginPath(); ctx.moveTo(A.x + nx * s, A.y + ny * s); ctx.lineTo(mx, my); ctx.stroke();
            ctx.strokeStyle = shade(CPK[B.e] || '#aab', -0.35 + depth * 0.3);
            ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(B.x + nx * s, B.y + ny * s); ctx.stroke();
          }
        } else {
          var p = P[q.i], col = CPK[p.e] || '#c084fc', r = (RAD[p.e] || 0.45) * scale * p.k;
          var g = ctx.createRadialGradient(p.x - r * 0.38, p.y - r * 0.42, r * 0.08, p.x, p.y, r);
          g.addColorStop(0, shade(col, 0.6)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, -0.55));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
    };
  }

  /* ---------------------------------------------------------------- обложка: молекулы сменяют друг друга */
  SCENES.cover = (function () {
    var v, L, idx = 0, timer = 0;
    var LIST = ['sucrose-structure', 'aspirin', 'alpha-glucopyranose', 'glycine'];
    return {
      init: function () {
        v = new MolViewer($('#heroMol'), { fill: 0.42, spin: 0.3, glow: true });
        v.load(window.ATOM_MOLS[LIST[0]]);
        L = loop(function (dt) {
          timer += dt;
          if (timer > 9) { timer = 0; idx = (idx + 1) % LIST.length; v.load(window.ATOM_MOLS[LIST[idx]]); }
          v.frame(dt);
        });
      },
      enter: function () { L.start(); },
      leave: function () { L.stop(); },
    };
  })();

  /* ---------------------------------------------------------------- органика: выбор молекулы */
  SCENES.organic = (function () {
    var v, L, cur = 'alpha-glucopyranose';
    var LIST = ['ethanol', 'acetic-acid', 'benzene', 'alpha-glucopyranose', 'glycine', 'aspirin', 'sucrose-structure'];
    function pick(id) {
      cur = id;
      v.load(window.ATOM_MOLS[id]);
      $$('#molPick button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-id') === id); });
      label();
    }
    function label() {
      $('#molName').textContent = t('mol.' + cur);
      $('#molFormula').textContent = hillFormula(window.ATOM_MOLS[cur].el);
    }
    return {
      init: function () {
        v = new MolViewer($('#molCanvas'), { fill: 0.39, spin: 0.45, dy: 20 });
        var box = $('#molPick');
        LIST.forEach(function (id) {
          var b = document.createElement('button');
          b.type = 'button'; b.setAttribute('data-id', id);
          b.addEventListener('click', function () { pick(id); });
          box.appendChild(b);
        });
        this.lang();
        pick(cur);
        L = loop(function (dt) { v.frame(dt); });
      },
      lang: function () {
        $$('#molPick button').forEach(function (b) { b.textContent = t('mol.' + b.getAttribute('data-id')); });
        if (v) label();
      },
      enter: function () { v.load(window.ATOM_MOLS[cur]); L.start(); },
      leave: function () { L.stop(); },
    };
  })();

  /* ================================================================ «Как образуется»: NaCl и H₂O */
  SCENES.formation = (function () {
    var cv, L, mode = 'nacl', time = 0, trail = [];
    var C = { e: '#7dd3fc', move: '#fbbf24', Na: '#b388ff', Cl: '#3ddc84', O: '#ff5d63', H: '#e9eef8' };
    var STEPS = { nacl: [0, 3, 5.5, 8.6], h2o: [0, 3, 6, 9] };
    var END = 13;

    function dot(ctx, x, y, col, r, glow) {
      r = r || 7;
      if (glow) {
        var g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
        g.addColorStop(0, hexA(col, 0.55)); g.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
    }
    function hexA(hex, a) {
      var n = parseInt(hex.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    function shell(ctx, x, y, r, a) {
      ctx.strokeStyle = 'rgba(160,180,255,' + (0.22 * a).toFixed(3) + ')';
      ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    function cloud(ctx, x, y, r, col, a) {
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, hexA(col, 0.22 * a)); g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    function nucleus(ctx, x, y, r, col, label, sub, a) {
      ctx.globalAlpha = a;
      var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, shade(col, 0.55)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.5));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0b1020'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 ' + Math.round(r * 0.78) + 'px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(label, x, y - (sub ? r * 0.12 : 0));
      if (sub) { ctx.font = '700 ' + Math.round(r * 0.36) + 'px "Segoe UI", system-ui, sans-serif'; ctx.fillText(sub, x, y + r * 0.48); }
      ctx.globalAlpha = 1;
    }
    function badge(ctx, x, y, text, col, a) {
      if (a <= 0) return;
      ctx.globalAlpha = a;
      ctx.font = '800 34px "Segoe UI", system-ui, sans-serif';
      var w = ctx.measureText(text).width + 34;
      ctx.fillStyle = hexA(col, 0.18); ctx.strokeStyle = hexA(col, 0.6); ctx.lineWidth = 2;
      roundRect(ctx, x - w / 2, y - 26, w, 52, 26); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
      ctx.globalAlpha = 1;
    }
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function ring(ctx, x, y, n, r, phase, col, skip) {
      for (var i = 0; i < n; i++) {
        if (skip && skip(i)) continue;
        var an = phase + (i / n) * Math.PI * 2;
        dot(ctx, x + Math.cos(an) * r, y + Math.sin(an) * r, col, 6.5, false);
      }
    }

    function drawNaCl(ctx, w, h, T) {
      var cx = w / 2, cy = h / 2 - 20;
      var fadeIn = ease(T / 0.8);
      var approach = easeIO(seg(T, 8.6, 10.6));
      var naX = cx - lerp(250, 150, approach), clX = cx + lerp(250, 150, approach);
      var moved = T >= 7.6;
      var outerA = 1 - seg(T, 7.6, 8.6);
      // облака
      cloud(ctx, naX, cy, lerp(170, 120, seg(T, 7.6, 8.8)), C.Na, fadeIn);
      cloud(ctx, clX, cy, lerp(150, 170, seg(T, 7.6, 8.8)), C.Cl, fadeIn);
      // притяжение
      var att = seg(T, 9.4, 10.6);
      if (att > 0) {
        for (var k = 0; k < 3; k++) {
          var ph = ((T * 0.8 + k / 3) % 1);
          ctx.strokeStyle = 'rgba(251,191,36,' + (0.5 * att * (1 - ph)).toFixed(3) + ')';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(cx, cy, 60 + ph * 120, 30 + ph * 60, 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
      // оболочки Na: 2, 8, 1
      var rot = T * 0.35;
      shell(ctx, naX, cy, 40, fadeIn); shell(ctx, naX, cy, 70, fadeIn);
      shell(ctx, naX, cy, 102, fadeIn * outerA);
      ring(ctx, naX, cy, 2, 40, rot * 1.6, C.e);
      ring(ctx, naX, cy, 8, 70, -rot, C.e);
      // оболочки Cl: 2, 8, 7 (+1)
      shell(ctx, clX, cy, 38, fadeIn); shell(ctx, clX, cy, 64, fadeIn); shell(ctx, clX, cy, 92, fadeIn);
      ring(ctx, clX, cy, 2, 38, -rot * 1.6, C.e);
      ring(ctx, clX, cy, 8, 64, rot, C.e);
      var clRot = T > 9 ? (T - 9) * 0.3 : 0;
      ring(ctx, clX, cy, 8, 92, Math.PI + clRot, C.e, function (i) { return i === 0; });
      // свободное место у хлора
      if (T > 3 && !moved) {
        var pulse = 0.5 + 0.5 * Math.sin(T * 5);
        var gx = clX - 92, gy = cy;
        ctx.strokeStyle = 'rgba(251,191,36,' + (0.4 + 0.5 * pulse).toFixed(3) + ')'; ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(gx, gy, 11, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      // внешний электрон натрия → хлор
      var ex, ey;
      if (T < 5.5) {
        var an = (T - 5.5) * 1.1;
        ex = naX + Math.cos(an) * 102; ey = cy + Math.sin(an) * 102;
      } else {
        var k2 = easeIO(seg(T, 5.5, 7.6));
        var x0 = naX + 102, x1 = clX - 92, mx = (x0 + x1) / 2, my = cy - 190;
        ex = (1 - k2) * (1 - k2) * x0 + 2 * (1 - k2) * k2 * mx + k2 * k2 * x1;
        ey = (1 - k2) * (1 - k2) * cy + 2 * (1 - k2) * k2 * my + k2 * k2 * cy;
        if (T > 7.6) { var an2 = Math.PI + clRot; ex = clX + Math.cos(an2) * 92; ey = cy + Math.sin(an2) * 92; }
      }
      if (T > 5.4 && T < 7.8) { trail.push([ex, ey]); if (trail.length > 26) trail.shift(); } else if (trail.length) trail.shift();
      for (var q = 0; q < trail.length; q++) {
        ctx.fillStyle = 'rgba(251,191,36,' + (q / trail.length * 0.45).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(trail[q][0], trail[q][1], 3 + q / trail.length * 4, 0, Math.PI * 2); ctx.fill();
      }
      var hl = T < 3 || (T >= 5.5 && T < 8);
      if (T < 3) {
        var p2 = 0.5 + 0.5 * Math.sin(T * 6);
        ctx.strokeStyle = 'rgba(251,191,36,' + (0.35 + 0.5 * p2).toFixed(3) + ')'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(ex, ey, 18 + p2 * 5, 0, Math.PI * 2); ctx.stroke();
      }
      dot(ctx, ex, ey, hl || moved ? C.move : C.e, 8, true);
      // ядра
      var ion = seg(T, 7.6, 8.6);
      nucleus(ctx, naX, cy, lerp(30, 27, ion), C.Na, 'Na', '11+', fadeIn);
      nucleus(ctx, clX, cy, lerp(30, 31, ion), C.Cl, 'Cl', '17+', fadeIn);
      // заряды ионов
      badge(ctx, naX, cy + 150, 'Na⁺', '#c4b5fd', ion);
      badge(ctx, clX, cy + 150, 'Cl⁻', '#86efac', ion);
      // итог
      var fin = seg(T, 10.6, 11.6);
      if (fin > 0) {
        ctx.globalAlpha = fin;
        ctx.font = '800 54px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff'; ctx.fillText('Na⁺Cl⁻  →  NaCl', cx, h - 70);
        ctx.globalAlpha = 1;
        lattice(ctx, w / 2 + 21, 92, fin);
      }
    }
    function lattice(ctx, x, y, a) {
      ctx.globalAlpha = a * 0.9;
      for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) {
        var na = (i + j) % 2 === 0;
        ctx.fillStyle = na ? '#b388ff' : '#3ddc84';
        ctx.beginPath(); ctx.arc(x - 60 + i * 26, y - 40 + j * 26, na ? 6 : 9, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawH2O(ctx, w, h, T) {
      var cx = w / 2, cy = h / 2 - 70;
      var fadeIn = ease(T / 0.8);
      var ang = (52.25 * Math.PI) / 180;
      var come = easeIO(seg(T, 3, 6));
      var dist = lerp(330, 122, come);
      var H1 = { x: cx + Math.sin(ang) * dist, y: cy + Math.cos(ang) * dist };
      var H2 = { x: cx - Math.sin(ang) * dist, y: cy + Math.cos(ang) * dist };
      var share = easeIO(seg(T, 6, 8.2));
      // облака
      cloud(ctx, cx, cy, 165, C.O, fadeIn);
      cloud(ctx, H1.x, H1.y, 80, '#93c5fd', fadeIn); cloud(ctx, H2.x, H2.y, 80, '#93c5fd', fadeIn);
      if (share > 0) {
        [H1, H2].forEach(function (Hh) {
          var mx = (cx + Hh.x) / 2, my = (cy + Hh.y) / 2, an = Math.atan2(Hh.y - cy, Hh.x - cx);
          ctx.save(); ctx.translate(mx, my); ctx.rotate(an);
          var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 90);
          g.addColorStop(0, 'rgba(251,191,36,' + (0.3 * share).toFixed(3) + ')'); g.addColorStop(1, 'rgba(251,191,36,0)');
          ctx.fillStyle = g; ctx.scale(1.5, 0.62); ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        });
      }
      // оболочки
      shell(ctx, cx, cy, 36, fadeIn); shell(ctx, cx, cy, 80, fadeIn);
      shell(ctx, H1.x, H1.y, 46, fadeIn); shell(ctx, H2.x, H2.y, 46, fadeIn);
      ring(ctx, cx, cy, 2, 36, T * 0.6, C.e);
      // неподелённые пары кислорода (вверх)
      [-Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62].forEach(function (a0) {
        [-0.16, 0.16].forEach(function (d) { dot(ctx, cx + Math.cos(a0 + d) * 80, cy + Math.sin(a0 + d) * 80, C.e, 6.5, false); });
      });
      // по одному электрону O и H в сторону каждой связи
      [[H1, Math.PI / 2 - ang], [H2, Math.PI / 2 + ang]].forEach(function (pair) {
        var Hh = pair[0], a0 = pair[1];
        var bx = Math.cos(a0), by = Math.sin(a0), px = -by, py = bx;
        var oR = lerp(80, 72, share);
        var oE = { x: cx + bx * oR, y: cy + by * oR };
        var hE0 = { x: Hh.x - bx * 46, y: Hh.y - by * 46 };
        var mid = { x: cx + bx * 66, y: cy + by * 66 };
        var e1 = { x: lerp(oE.x, mid.x + px * 9, share), y: lerp(oE.y, mid.y + py * 9, share) };
        var e2 = { x: lerp(hE0.x, mid.x - px * 9, share), y: lerp(hE0.y, mid.y - py * 9, share) };
        if (T > 0.8 && T < 3 && !share) {
          var pulse = 0.5 + 0.5 * Math.sin(T * 5);
          var gx = cx + Math.cos(a0 + 0.3) * 80, gy = cy + Math.sin(a0 + 0.3) * 80;
          ctx.strokeStyle = 'rgba(251,191,36,' + (0.4 + 0.5 * pulse).toFixed(3) + ')'; ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(gx, gy, 11, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
        dot(ctx, e1.x, e1.y, share > 0 ? C.move : C.e, 7.5, share > 0);
        dot(ctx, e2.x, e2.y, T > 3 ? C.move : C.e, 7.5, T > 3);
      });
      nucleus(ctx, cx, cy, 34, C.O, 'O', '8+', fadeIn);
      nucleus(ctx, H1.x, H1.y, 22, C.H, 'H', '', fadeIn);
      nucleus(ctx, H2.x, H2.y, 22, C.H, 'H', '', fadeIn);
      // угол 104,5°
      var an = seg(T, 9, 10.2);
      if (an > 0) {
        ctx.globalAlpha = an;
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(H1.x, H1.y); ctx.moveTo(cx, cy); ctx.lineTo(H2.x, H2.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(cx, cy, 150, Math.PI / 2 - ang, Math.PI / 2 + ang); ctx.stroke();
        ctx.font = '800 36px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = '#fbbf24'; ctx.textAlign = 'center';
        ctx.fillText(lang() === 'en' ? '104.5°' : '104,5°', cx, cy + 205);
        ctx.globalAlpha = 1;
      }
      var fin = seg(T, 10.4, 11.4);
      if (fin > 0) {
        ctx.globalAlpha = fin;
        ctx.font = '800 54px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff'; ctx.fillText('2H + O  →  H₂O', cx, h - 60);
        ctx.globalAlpha = 1;
      }
    }

    function stepIndex() {
      var s = STEPS[mode], i = 0;
      for (var k = 0; k < s.length; k++) if (time >= s[k]) i = k;
      return i;
    }
    var lastStep = -1;
    function syncSteps(force) {
      var i = stepIndex();
      if (i === lastStep && !force) return;
      lastStep = i;
      $$('#formSteps li').forEach(function (li, k) {
        li.textContent = t((mode === 'nacl' ? 'f.n' : 'f.w') + (k + 1));
        li.classList.toggle('now', k === i);
        li.classList.toggle('done', k < i);
      });
    }
    function play(m) {
      if (m) mode = m;
      time = 0; trail = []; lastStep = -1;
      $$('.s-formation .seg-btn[data-mode]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === mode); });
      syncSteps(true);
    }
    return {
      init: function () {
        cv = $('#formCanvas');
        $$('.s-formation .seg-btn').forEach(function (b) {
          b.addEventListener('click', function () {
            var m = b.getAttribute('data-mode');
            play(m === 'replay' ? null : m);
          });
        });
        L = loop(function (dt) {
          time = Math.min(END, time + dt);
          var f = fit(cv), ctx = f.ctx;
          ctx.clearRect(0, 0, f.w, f.h);
          // рисуем в «виртуальном» поле и вписываем его в холст — крупно на любом экране
          var VW = mode === 'nacl' ? 800 : 640, VH = mode === 'nacl' ? 600 : 560;
          var Z = Math.min(f.w / VW, f.h / VH);
          ctx.save();
          ctx.translate((f.w - VW * Z) / 2, (f.h - VH * Z) / 2);
          ctx.scale(Z, Z);
          if (mode === 'nacl') drawNaCl(ctx, VW, VH, time); else drawH2O(ctx, VW, VH, time);
          ctx.restore();
          syncSteps(false);
        });
        syncSteps(true);
      },
      lang: function () { syncSteps(true); },
      enter: function () { play('nacl'); if (reduce) time = END; L.start(); },
      leave: function () { L.stop(); },
    };
  })();

  /* ================================================================ таблица Менделеева */
  SCENES.periodic = (function () {
    var box, card, cells = {}, current = 0, auto = 0, idleUntil = 0;
    var TOUR = [1, 6, 29, 47, 16, 8, 17, 2, 19, 54, 50, 5];
    var CATS = ['am', 'ae', 'tm', 'pm', 'md', 'nm', 'hl', 'ng', 'ln', 'ac'];
    var byZ = {};
    function nameOf(e) { var l = lang(); return l === 'uz' ? e[3] : l === 'en' ? e[4] : e[2]; }
    function massStr(m) {
      if (m == null) return '—';
      var s = String(Math.round(m * 1000) / 1000);
      return lang() === 'en' ? s : s.replace('.', ',');
    }
    function confStr(c) {
      return String(c || '').split(' ').map(function (p) {
        return p.replace(/[0-9]+$/, function (d) { return d.split('').map(function (x) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'.charAt(Number(x)); }).join(''); });
      }).join(' ');
    }
    function select(z, user) {
      var e = byZ[z]; if (!e) return;
      if (cells[current]) cells[current].classList.remove('on');
      current = z; cells[z].classList.add('on');
      box.classList.add('dim');
      card.className = 'pcard cat-' + e[6];
      var photo = e[10]
        ? '<div class="pc-photo"><img src="' + e[10][0] + '" alt=""><span>Wikimedia Commons · ' + esc(e[10][1]) + '</span></div>'
        : '<div class="pc-photo none">' + esc(t('t.nophoto')) + '</div>';
      card.innerHTML =
        '<div class="pc-main"><div class="pc-sym"><small>' + e[0] + '</small>' + e[1] + '</div>' +
        '<div class="pc-name">' + esc(nameOf(e)) + '</div>' +
        '<div class="pc-cat">' + esc(t('cat.' + e[6])) + '</div>' +
        '<div class="pc-facts"><span>' + esc(t('t.mass')) + ': <b>' + massStr(e[5]) + '</b></span><span>' + esc(t('t.conf')) + ': <b>' + confStr(e[9]).slice(0, 34) + '</b></span></div></div>' +
        photo;
      if (user) idleUntil = Date.now() + 9000;
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function labels() {
      window.ATOM_ELEMENTS.forEach(function (e) { var c = cells[e[0]]; if (c) { c.querySelector('.nm').textContent = nameOf(e); c.title = nameOf(e); } });
      var lg = $('#plegend'); lg.innerHTML = '';
      CATS.forEach(function (k) { var s = document.createElement('span'); s.className = 'cat-' + k; s.innerHTML = '<i></i>' + esc(t('cat.' + k)); lg.appendChild(s); });
      if (current) select(current, false);
    }
    return {
      init: function () {
        box = $('#ptable'); card = $('#pcard');
        window.ATOM_ELEMENTS.forEach(function (e) {
          byZ[e[0]] = e;
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'el cat-' + e[6] + (e[10] ? ' ph' : '');
          b.style.gridRow = String(e[7]); b.style.gridColumn = String(e[8]);
          b.innerHTML = '<span class="z">' + e[0] + '</span><span class="sym">' + e[1] + '</span><span class="nm"></span>';
          b.addEventListener('mouseenter', function () { select(e[0], true); });
          b.addEventListener('click', function () { select(e[0], true); });
          box.appendChild(b); cells[e[0]] = b;
        });
        labels();
      },
      lang: labels,
      enter: function () {
        var k = 0;
        select(TOUR[0], false);
        clearInterval(auto);
        auto = setInterval(function () {
          if (Date.now() < idleUntil) return;
          k = (k + 1) % TOUR.length; select(TOUR[k], false);
        }, 2800);
      },
      leave: function () { clearInterval(auto); },
    };
  })();

  /* ================================================================ демо-чат ИИ-учителя */
  SCENES.teacher = (function () {
    var body, run = 0;
    function wait(ms, id) { return new Promise(function (res, rej) { setTimeout(function () { id === run ? res() : rej(); }, ms); }); }
    function scroll() { body.scrollTop = body.scrollHeight; }
    function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
    function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
    function isEq(s) { return s.indexOf('→') >= 0 || /^[nVm]\(/.test(s); }
    function play() {
      var id = ++run;
      body.innerHTML = '';
      var script = (window.I18N[lang()] || window.I18N.ru).chat;
      var p = wait(500, id);
      script.forEach(function (st) {
        p = p.then(function () {
          if (st.me) {
            var m = el('div', 'msg me');
            if (st.voice) m.appendChild(el('div', 'voice', '<svg class="ic"><use href="#i-mic"/></svg><i></i><i></i><i></i><i></i><i></i>'));
            m.appendChild(el('div', '', esc(st.me.join(' '))));
            body.appendChild(m); scroll();
            return wait(st.voice ? 1300 : 800, id);
          }
          var ty = el('div', 'typing', '<i></i><i></i><i></i>');
          body.appendChild(ty); scroll();
          return wait(st.img ? 1900 : 1100, id).then(function () {
            ty.remove();
            var a = el('div', 'msg ai');
            st.ai.forEach(function (line) { a.appendChild(el('div', isEq(line) ? 'eq' : '', esc(line))); });
            if (st.img) a.appendChild(el('div', 'pic', '<img src="' + (window.ASSET_BASE || '') + st.img + '" alt="">'));
            if (st.cite) a.appendChild(el('span', 'cite', '<svg class="ic"><use href="#i-book"/></svg>' + esc(st.cite)));
            if (st.badge) { if (st.cite) a.appendChild(document.createElement('br')); a.appendChild(el('span', 'badge', '<svg class="ic"><use href="#i-check"/></svg>' + esc(st.badge))); }
            body.appendChild(a); scroll();
            var img = a.querySelector('img'); if (img) img.addEventListener('load', scroll);
            return wait(1500 + st.ai.join(' ').length * 18, id);
          });
        });
      });
      p.catch(function () {});
    }
    return {
      init: function () {
        body = $('#chatBody');
        $('#chatReplay').addEventListener('click', play);
      },
      lang: function () { if (window.DECK && window.DECK.current === 'teacher') play(); },
      enter: play,
      leave: function () { run++; },
    };
  })();

  /* ================================================================ программа: столбики */
  SCENES.curriculum = {
    init: function () {},
    enter: function () {
      var rows = $$('#gradeBars .bar-row'), max = 0;
      rows.forEach(function (r) { max = Math.max(max, Number(r.getAttribute('data-n'))); });
      rows.forEach(function (r, i) {
        var bar = r.querySelector('.bar i');
        bar.style.transitionDelay = 0.35 + i * 0.12 + 's';
        bar.style.width = (Number(r.getAttribute('data-n')) / max) * 100 + '%';
      });
    },
    leave: function () { $$('#gradeBars .bar i').forEach(function (b) { b.style.transitionDelay = '0s'; b.style.width = '0'; }); },
  };

  /* ================================================================ цифры: счётчики */
  function fmt(n) {
    var s = String(Math.round(n));
    if (s.length < 4) return s;
    var sep = lang() === 'en' ? ',' : ' ';
    return s.replace(/(\d)(?=(\d{3})+$)/g, '$1' + sep);
  }
  SCENES.numbers = (function () {
    var raf = 0;
    function set(done) {
      $$('.s-numbers .count').forEach(function (c) {
        var to = Number(c.getAttribute('data-to')), suf = c.getAttribute('data-suffix') || '';
        c.textContent = fmt(done ? to : 0) + suf;
      });
    }
    return {
      init: function () { set(true); },
      lang: function () { set(true); },
      enter: function () {
        if (reduce) { set(true); return; }
        var t0 = performance.now(), D = 1600, list = $$('.s-numbers .count');
        cancelAnimationFrame(raf);
        (function tick(now) {
          var k = ease((now - t0) / D);
          list.forEach(function (c, i) {
            var kk = ease((now - t0 - i * 60) / D);
            c.textContent = fmt(Number(c.getAttribute('data-to')) * kk) + (c.getAttribute('data-suffix') || '');
          });
          if (k < 1 || now - t0 < D + 800) raf = requestAnimationFrame(tick);
        })(t0);
      },
      leave: function () { cancelAnimationFrame(raf); },
    };
  })();

  /* ================================================================ сравнение: отметки */
  SCENES.compare = {
    init: function () {
      $$('#cmp .cmp-row[data-v]').forEach(function (row, r) {
        row.getAttribute('data-v').split(',').forEach(function (v, c) {
          var cell = document.createElement('span');
          cell.className = 'cell' + (c === 0 ? ' us' : '');
          var icon = v === 'y' ? '<svg class="ic"><use href="#i-check"/></svg>' : v === 'p' ? '~' : '<svg class="ic"><use href="#i-x"/></svg>';
          cell.innerHTML = '<span class="mark ' + v + '" style="--d:' + (0.45 + r * 0.12 + c * 0.05).toFixed(2) + 's">' + icon + '</span>';
          row.appendChild(cell);
        });
      });
    },
  };

  SCENES._util = { fit: fit, fmt: fmt };
})();
