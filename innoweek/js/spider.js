/* ATOMLAB · InnoWeek — «паук»: вся ценность ATOMLAB на одном экране, ничего не нужно нажимать.
 * Ядро-атом в центре, 10 лап-веток (слева — людям, справа — государству и почему мы лучше), по 3 пункта на ветке.
 * Наведение мышью только подсвечивает ветку; клик по ядру — заново «прорастить» схему. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  // слева — что получают люди, справа — государству и почему мы лучше
  var BR = [
    { id: 'why', side: -1, row: 0, c: '#fbbf24', icon: 'i-spark' },
    { id: 'student', side: -1, row: 1, c: '#2dd4bf', icon: 'i-users' },
    { id: 'teacher', side: -1, row: 2, c: '#60a5fa', icon: 'i-plan' },
    { id: 'school', side: -1, row: 3, c: '#a78bfa', icon: 'i-flask' },
    { id: 'quality', side: -1, row: 4, c: '#34d399', icon: 'i-book' },
    { id: 'save', side: 1, row: 0, c: '#4ade80', icon: 'i-calc' },
    { id: 'state', side: 1, row: 1, c: '#38bdf8', icon: 'i-globe' },
    { id: 'better', side: 1, row: 2, c: '#ec4899', icon: 'i-check' },
    { id: 'tech', side: 1, row: 3, c: '#c084fc', icon: 'i-cpu' },
    { id: 'safety', side: 1, row: 4, c: '#fb7185', icon: 'i-shield' },
  ];
  var HUB = { x: 960, y: 529, r: 160 };
  var ROWS = [205, 367, 529, 691, 853];
  var NODE = { w: 340, h: 86, xl: 400, xr: 1180 };
  var LEAF = { w: 345, h: 42, gap: 9, xl: 16, xr: 1559 };

  var map = document.getElementById('map');
  var stage = document.getElementById('mapStage');
  if (!map || !stage) return;

  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function sv(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function box(n, b) { n.style.left = b.x + 'px'; n.style.top = b.y + 'px'; n.style.width = b.w + 'px'; n.style.height = b.h + 'px'; }
  function nodeBox(b) { return { x: b.side < 0 ? NODE.xl : NODE.xr, y: ROWS[b.row] - NODE.h / 2, w: NODE.w, h: NODE.h }; }
  function leafBox(b, k) {
    var total = 3 * LEAF.h + 2 * LEAF.gap;
    return { x: b.side < 0 ? LEAF.xl : LEAF.xr, y: ROWS[b.row] - total / 2 + k * (LEAF.h + LEAF.gap), w: LEAF.w, h: LEAF.h };
  }
  function f(n) { return Math.round(n * 10) / 10; }

  /* ---------------------------------------------------------------- SVG: паутина, лапы, ядро-атом */
  var svg = sv('svg', { class: 'sp-svg', viewBox: '0 0 1920 1080', 'aria-hidden': 'true' });
  var defs = sv('defs');
  svg.appendChild(defs);
  var glow = sv('radialGradient', { id: 'spHubGlow' });
  glow.appendChild(sv('stop', { offset: '0', 'stop-color': '#8b5cf6', 'stop-opacity': '0.45' }));
  glow.appendChild(sv('stop', { offset: '1', 'stop-color': '#8b5cf6', 'stop-opacity': '0' }));
  defs.appendChild(glow);

  // паутина: кольца-эллипсы и лучи
  var web = sv('g', { class: 'sp-web' });
  [250, 420, 600, 790, 990].forEach(function (rx) { web.appendChild(sv('ellipse', { cx: HUB.x, cy: HUB.y, rx: rx, ry: f(rx * 0.56) })); });
  for (var i = 0; i < 16; i++) {
    var a = (i / 16) * Math.PI * 2;
    web.appendChild(sv('line', { x1: f(HUB.x + Math.cos(a) * 180), y1: f(HUB.y + Math.sin(a) * 110), x2: f(HUB.x + Math.cos(a) * 1150), y2: f(HUB.y + Math.sin(a) * 650) }));
  }
  svg.appendChild(web);

  var legs = sv('g', { class: 'sp-legs' });
  var links = sv('g', { class: 'sp-links' });
  svg.appendChild(links);
  svg.appendChild(legs);

  BR.forEach(function (b, idx) {
    var nb = nodeBox(b), y = ROWS[b.row];
    var ex = b.side < 0 ? nb.x + nb.w : nb.x;
    var dx = ex - HUB.x, dy = y - HUB.y, L = Math.sqrt(dx * dx + dy * dy);
    var ux = dx / L, uy = dy / L;
    var sx = HUB.x + ux * HUB.r, sy = HUB.y + uy * HUB.r;
    var d = 'M' + f(sx) + ' ' + f(sy) + ' C' + f(sx + ux * 70) + ' ' + f(sy + uy * 70) + ' ' + f(ex - b.side * 80) + ' ' + y + ' ' + ex + ' ' + y;
    var g = sv('linearGradient', { id: 'spg-' + b.id, gradientUnits: 'userSpaceOnUse', x1: f(sx), y1: f(sy), x2: ex, y2: y });
    g.appendChild(sv('stop', { offset: '0', 'stop-color': '#8b5cf6' }));
    g.appendChild(sv('stop', { offset: '1', 'stop-color': b.c }));
    defs.appendChild(g);
    var leg = sv('path', { d: d, class: 'sp-leg', 'data-b': b.id, stroke: 'url(#spg-' + b.id + ')' });
    var flow = sv('path', { d: d, class: 'sp-flow', 'data-b': b.id, stroke: b.c });
    leg.style.setProperty('--d', (0.35 + idx * 0.07).toFixed(2) + 's');
    flow.style.setProperty('--d', (1.6 + idx * 0.07).toFixed(2) + 's');
    legs.appendChild(leg);
    legs.appendChild(flow);
    // ноги-сустав: от карточки к трём фактам
    var ox = b.side < 0 ? nb.x : nb.x + nb.w;
    for (var k = 0; k < 3; k++) {
      var lb = leafBox(b, k), ly = lb.y + lb.h / 2;
      var lx = b.side < 0 ? lb.x + lb.w : lb.x;
      var mx = (ox + lx) / 2;
      var p = sv('path', { d: 'M' + ox + ' ' + y + ' C' + mx + ' ' + y + ' ' + mx + ' ' + f(ly) + ' ' + lx + ' ' + f(ly), class: 'sp-link', 'data-b': b.id, stroke: b.c });
      p.style.setProperty('--d', (0.9 + idx * 0.07 + k * 0.06).toFixed(2) + 's');
      links.appendChild(p);
    }
  });

  // ядро-атом: свечение и три орбиты с электронами
  var core = sv('g', { class: 'sp-core' });
  core.appendChild(sv('circle', { cx: HUB.x, cy: HUB.y, r: HUB.r + 90, fill: 'url(#spHubGlow)' }));
  [0, 60, 120].forEach(function (deg, j) {
    var og = sv('g', { transform: 'rotate(' + deg + ' ' + HUB.x + ' ' + HUB.y + ')' });
    var rx = 238, ry = 74;
    var path = 'M' + (HUB.x - rx) + ' ' + HUB.y + ' a' + rx + ' ' + ry + ' 0 1 0 ' + 2 * rx + ' 0 a' + rx + ' ' + ry + ' 0 1 0 ' + -2 * rx + ' 0';
    og.appendChild(sv('path', { d: path, class: 'sp-orbit' }));
    var e = sv('circle', { r: 7, class: 'sp-electron' });
    var am = sv('animateMotion', { dur: 5 + j * 1.3 + 's', repeatCount: 'indefinite', path: path, begin: -j * 1.7 + 's' });
    e.appendChild(am);
    og.appendChild(e);
    core.appendChild(og);
  });
  svg.appendChild(core);
  stage.appendChild(svg);

  /* ---------------------------------------------------------------- лапы: карточки-ветки и факты */
  BR.forEach(function (b, idx) {
    var n = el('div', 'sp-node' + (b.side < 0 ? ' l' : ' r'), { 'data-b': b.id });
    box(n, nodeBox(b));
    n.style.setProperty('--c', b.c);
    n.style.setProperty('--d', (0.75 + idx * 0.07).toFixed(2) + 's');
    n.style.setProperty('--fx', b.side * -60 + 'px');
    n.innerHTML = '<span class="ico-wrap" style="--c:' + b.c + '"><svg class="ic"><use href="#' + b.icon + '"/></svg></span>' +
      '<span class="sp-nt"><b data-t="sp.' + b.id + '.t"></b><small data-t="sp.' + b.id + '.m"></small></span>' +
      '';
    stage.appendChild(n);
    for (var k = 0; k < 3; k++) {
      var lf = el('div', 'sp-leaf' + (b.side < 0 ? ' l' : ' r'), { 'data-b': b.id });
      box(lf, leafBox(b, k));
      lf.style.setProperty('--c', b.c);
      lf.style.setProperty('--d', (1.05 + idx * 0.07 + k * 0.06).toFixed(2) + 's');
      lf.style.setProperty('--fx', b.side * -30 + 'px');
      lf.innerHTML = '<i></i><span data-t="sp.' + b.id + '.' + (k + 1) + '"></span>';
      stage.appendChild(lf);
    }
  });

  /* ---------------------------------------------------------------- ядро, шапка, проблема, дорожная карта, QR */
  var hub = el('button', 'sp-hub', { type: 'button' });
  box(hub, { x: HUB.x - HUB.r, y: HUB.y - HUB.r, w: HUB.r * 2, h: HUB.r * 2 });
  hub.innerHTML = '<span class="logo"><span>ATOM</span><span class="grad">LAB</span></span><span class="sp-tag" data-t="sp.hubTag"></span><small data-t="sp.hubSub"></small>';
  stage.appendChild(hub);

  var head = el('header', 'sp-head');
  head.innerHTML = '<div class="kicker" data-t="sp.kicker"></div><h1 data-t="sp.sub"></h1>';
  stage.appendChild(head);

  var prob = el('div', 'sp-prob');
  prob.innerHTML = '<span class="sp-lab" data-t="sp.prob"></span>' + [1, 2, 3, 4].map(function (k) {
    return '<span class="sp-pchip"><i></i><span data-t="sp.p' + k + '"></span></span>';
  }).join('');
  stage.appendChild(prob);

  var road = el('div', 'sp-road');
  road.innerHTML = '<span class="sp-lab" data-t="sp.road"></span>' + [0, 1, 2, 3].map(function (k) {
    return (k ? '<svg class="ic sp-arrow"><use href="#i-chev-r"/></svg>' : '') +
      '<span class="sp-rchip' + (k === 0 ? ' done' : '') + '">' + (k === 0 ? '<svg class="ic"><use href="#i-check"/></svg>' : '') + '<span data-t="sp.r' + k + '"></span></span>';
  }).join('');
  stage.appendChild(road);

  var foot = el('div', 'sp-hint');
  foot.innerHTML = '<span data-t="sp.foot"></span>';
  stage.appendChild(foot);


  /* ---------------------------------------------------------------- подсветка при наведении (вся информация и так на экране) */
  var clearT = 0, locked = null;
  var parts = Array.prototype.slice.call(stage.querySelectorAll('[data-b]'));
  function hot(id) {
    clearTimeout(clearT);
    map.classList.toggle('focus', !!id);
    parts.forEach(function (p) { p.classList.toggle('hot', p.getAttribute('data-b') === id); });
  }
  function emit(name, arg) { var fn = window.SPIDER && window.SPIDER[name]; if (typeof fn === 'function') fn(arg); }

  stage.addEventListener('mouseover', function (e) {
    if (locked) return;
    var t = e.target.closest && e.target.closest('.sp-node, .sp-leaf');
    if (t) hot(t.getAttribute('data-b'));
  });
  stage.addEventListener('mouseout', function (e) {
    if (locked) return;
    var t = e.target.closest && e.target.closest('.sp-node, .sp-leaf');
    if (!t) return;
    var to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.sp-node, .sp-leaf');
    if (to && to.getAttribute('data-b') === t.getAttribute('data-b')) return;
    clearT = setTimeout(function () { hot(null); }, 250);
  });
  hub.addEventListener('click', function () { emit('onHub'); });

  window.SPIDER = {
    BR: BR,
    side: function (id) { var b = byId(id); return b ? b.side : 1; },
    byId: byId,
    hot: hot,
    lock: function (id) { locked = id || null; hot(locked); },
    enter: function () {
      // длина каждой лапы — для анимации «прорастания» (считаем, когда схема видна)
      Array.prototype.forEach.call(svg.querySelectorAll('.sp-leg, .sp-link'), function (p) {
        if (!p.style.getPropertyValue('--len')) {
          var len = 0;
          try { len = p.getTotalLength(); } catch (e) { len = 0; }
          if (len > 0) p.style.setProperty('--len', Math.ceil(len) + 'px');
        }
      });
      map.classList.remove('shown');
      void map.offsetWidth; // перезапуск анимации «прорастания»
      map.classList.add('shown');
    },
    leave: function () { locked = null; hot(null); },
  };
  function byId(id) { for (var i = 0; i < BR.length; i++) if (BR[i].id === id) return BR[i]; return null; }
})();
