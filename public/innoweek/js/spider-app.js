/* ATOMLAB · InnoWeek — страница «паука» (spider/): карточки веток, обход пультом, языки, офлайн.
 * Клик по ветке — карточка с живым визуалом прямо на схеме; → / Пробел / PgDn — следующая ветка;
 * ← / PgUp — предыдущая; Esc или клик по пустому месту — назад к схеме; F — полный экран; L — язык; B — чёрный экран. */
(function () {
  'use strict';

  var LANGS = ['uz', 'ru', 'en'];
  var SC = window.SCENES || {};
  var SP = window.SPIDER;
  var BR = SP.BR;
  // ветка → живая сцена из js/scenes.js (остальные ветки показывают снимок экрана ATOMLAB)
  var LIVE = { form: 'formation', org: 'organic', ai: 'teacher', diff: 'compare' };
  var params = new URLSearchParams(location.search);

  function $(id) { return document.getElementById(id); }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; }

  var DECK = (window.DECK = {
    lang: 'ru',
    scale: 1,
    current: null,
    t: function (k) {
      var d = window.I18N[DECK.lang] || window.I18N.ru;
      var v = d[k];
      if (v == null) v = window.I18N.ru[k];
      return v == null ? '' : v;
    },
  });
  var t = DECK.t;
  var startLang = params.get('lang') || store('atomlab-innoweek-lang') || 'ru';
  DECK.lang = LANGS.indexOf(startLang) >= 0 ? startLang : 'ru';

  /* ---------------------------------------------------------------- масштаб: сцена 1920×1080 целиком на любом экране */
  function rescale() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    DECK.scale = s;
    document.documentElement.style.setProperty('--scale', String(s));
  }
  window.addEventListener('resize', rescale);
  rescale();

  /* ---------------------------------------------------------------- карточка ветки */
  var panel = $('spPanel');
  var openId = null;
  function index(id) { for (var i = 0; i < BR.length; i++) if (BR[i].id === id) return i; return -1; }
  function scene(id, fn) {
    var s = LIVE[id];
    if (s && SC[s] && SC[s][fn]) { try { SC[s][fn](); } catch (e) { console.warn(s, e); } }
  }
  function fill() {
    if (!openId) return;
    var b = SP.byId(openId);
    $('sppTitle').textContent = t('sp.' + b.id + '.t');
    $('sppMetric').textContent = t('sp.' + b.id + '.m');
    $('sppF1').textContent = t('sp.' + b.id + '.1');
    $('sppF2').textContent = t('sp.' + b.id + '.2');
    $('sppF3').textContent = t('sp.' + b.id + '.3');
    $('sppDetail').textContent = t('sp.' + b.id + '.d');
    $('sppIco').querySelector('use').setAttribute('href', '#' + b.icon);
  }
  function open(id) {
    var b = SP.byId(id);
    if (!b) return;
    if (openId === id) return;
    if (openId) scene(openId, 'leave');
    openId = id;
    SP.lock(id);
    panel.style.setProperty('--c', b.c);
    $('sppIco').style.setProperty('--c', b.c);
    panel.classList.toggle('at-left', b.side > 0);
    each('.sp-vis', function (v) { v.classList.toggle('on', v.getAttribute('data-v') === id); });
    fill();
    panel.hidden = false;
    panel.classList.remove('in');
    void panel.offsetWidth;
    panel.classList.add('in');
    DECK.current = LIVE[id] || null;
    scene(id, 'enter');
    counter();
    try { history.replaceState(null, '', location.pathname + location.search + '#' + id); } catch (e) { /* file:// */ }
  }
  function close() {
    if (!openId) return;
    scene(openId, 'leave');
    openId = null;
    DECK.current = null;
    panel.hidden = true;
    each('.sp-vis', function (v) { v.classList.remove('on'); });
    SP.lock(null);
    counter();
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* file:// */ }
  }
  function next() {
    var i = openId ? index(openId) + 1 : 0;
    if (i >= BR.length) close(); else open(BR[i].id);
  }
  function prev() {
    var i = openId ? index(openId) - 1 : BR.length - 1;
    if (i < 0) close(); else open(BR[i].id);
  }
  function counter() { $('counter').textContent = openId ? index(openId) + 1 + ' / ' + BR.length : '— / ' + BR.length; }

  SP.onOpen = open;
  SP.onBackground = close;
  SP.onHub = function () { close(); SP.enter(); };
  $('sppClose').addEventListener('click', close);

  /* ---------------------------------------------------------------- языки */
  function applyLang() {
    document.documentElement.lang = DECK.lang;
    document.title = 'ATOMLAB — ' + t('sp.back') + ' · InnoWeek';
    each('[data-t]', function (el) { el.textContent = t(el.getAttribute('data-t')); });
    each('[data-tt]', function (el) { var v = t(el.getAttribute('data-tt')); el.title = v; el.setAttribute('aria-label', v); });
    each('.lang button', function (b) { b.classList.toggle('on', b.getAttribute('data-lang') === DECK.lang); });
    Object.keys(LIVE).forEach(function (k) {
      var s = SC[LIVE[k]];
      if (s && s.lang) { try { s.lang(); } catch (e) { console.warn(k, e); } }
    });
    fill();
    offlineText();
  }
  function setLang(l) {
    if (LANGS.indexOf(l) < 0) return;
    DECK.lang = l;
    store('atomlab-innoweek-lang', l);
    applyLang();
  }
  each('.lang button', function (b) { b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); }); });

  /* ---------------------------------------------------------------- управление */
  var black = $('black');
  function fullscreen() {
    var d = document, el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
    var rq = el.requestFullscreen || el.webkitRequestFullscreen;
    if (rq) { try { var p = rq.call(el); if (p && p.catch) p.catch(function () {}); } catch (e) { /* нет поддержки */ } }
  }
  $('bPrev').addEventListener('click', prev);
  $('bNext').addEventListener('click', next);
  $('bFull').addEventListener('click', fullscreen);
  black.addEventListener('click', function () { black.hidden = true; });

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!black.hidden) { black.hidden = true; e.preventDefault(); return; }
    var key = e.key, code = e.code;
    if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown' || key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      next();
    } else if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp' || key === 'Backspace') { e.preventDefault(); prev(); }
    else if (key === 'Escape') { close(); }
    else if (key === 'Home') { close(); SP.enter(); }
    else if (code === 'KeyF') { fullscreen(); }
    else if (code === 'KeyL') { setLang(LANGS[(LANGS.indexOf(DECK.lang) + 1) % LANGS.length]); }
    else if (code === 'KeyB' || key === '.') { black.hidden = false; }
    else if (/^Digit[0-9]$/.test(code)) { var n = Number(code.slice(5)); open(BR[(n + 9) % 10].id); }
  });

  // свайп на телефоне: влево — следующая ветка, вправо — предыдущая
  var tx = 0, ty = 0, tOk = false;
  window.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { tOk = false; return; }
    tOk = !(e.target.closest && e.target.closest('canvas, .chat-body'));
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchend', function (e) {
    if (!tOk) return;
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { if (dx < 0) next(); else prev(); }
  }, { passive: true });

  // курсор и панель прячутся, когда мышь не двигается
  var idleT = 0;
  function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleT);
    idleT = setTimeout(function () { document.body.classList.add('idle'); }, 2600);
  }
  window.addEventListener('mousemove', wake);
  window.addEventListener('touchstart', wake, { passive: true });

  /* ---------------------------------------------------------------- офлайн: тот же service worker, что у слайдов */
  var offState = '';
  function offlineText() {
    var b = $('offBadge');
    if (!offState) { b.hidden = true; return; }
    b.hidden = false;
    b.classList.toggle('wait', offState !== 'ready');
    b.querySelector('span').textContent = offState === 'ready' ? t('ui.offline') : t('ui.caching');
  }
  function askSw(reg, tries) {
    var sw = reg.active || reg.waiting || reg.installing;
    if (!sw || typeof MessageChannel === 'undefined') return;
    var mc = new MessageChannel();
    mc.port1.onmessage = function (e) {
      offState = e.data && e.data.ready ? 'ready' : 'caching';
      offlineText();
      if (offState !== 'ready' && tries < 40) setTimeout(function () { askSw(reg, tries + 1); }, 1500);
    };
    try { sw.postMessage({ type: 'status' }, [mc.port2]); } catch (e) { /* старый браузер */ }
  }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('../sw.js', { scope: '../' }).then(function () {
        offState = 'caching'; offlineText();
        return navigator.serviceWorker.ready;
      }).then(function (reg) { askSw(reg, 0); }).catch(function (e) { console.warn('sw', e); });
    });
  }

  /* ---------------------------------------------------------------- старт */
  if (SC._bg) { try { SC._bg.init(); } catch (e) { console.warn('bg', e); } }
  Object.keys(LIVE).forEach(function (k) {
    var s = SC[LIVE[k]];
    if (s && s.init) { try { s.init(); } catch (e) { console.warn(k, e); } }
  });
  applyLang();
  counter();
  SP.enter();
  wake();
  var h = (location.hash || '').slice(1);
  if (h && SP.byId(h)) setTimeout(function () { open(h); }, 1400);
})();
