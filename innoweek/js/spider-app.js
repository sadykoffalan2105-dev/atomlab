/* ATOMLAB · InnoWeek — страница «паука» (spider/): экран просто стоит, вся информация видна, ничего нажимать не нужно.
 * Подсветка сама обходит ветки и ленту экранов. Клавиши (по желанию): F — полный экран, L — язык, B — чёрный экран. */
(function () {
  'use strict';

  var LANGS = ['uz', 'ru', 'en'];
  var SC = window.SCENES || {};
  var SP = window.SPIDER;
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

  /* ---------------------------------------------------------------- языки */
  function applyLang() {
    document.documentElement.lang = DECK.lang;
    document.title = 'ATOMLAB — ' + t('sp.back') + ' · InnoWeek';
    each('[data-t]', function (el) { el.textContent = t(el.getAttribute('data-t')); });
    each('[data-tt]', function (el) { var v = t(el.getAttribute('data-tt')); el.title = v; el.setAttribute('aria-label', v); });
    each('.lang button', function (b) { b.classList.toggle('on', b.getAttribute('data-lang') === DECK.lang); });
    offlineText();
  }
  function setLang(l) {
    if (LANGS.indexOf(l) < 0) return;
    DECK.lang = l;
    store('atomlab-innoweek-lang', l);
    applyLang();
  }
  each('.lang button', function (b) { b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); }); });

  /* ---------------------------------------------------------------- полный экран, чёрный экран, клавиши */
  var black = $('black');
  function fullscreen() {
    var d = document, el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
    var rq = el.requestFullscreen || el.webkitRequestFullscreen;
    if (rq) { try { var p = rq.call(el); if (p && p.catch) p.catch(function () {}); } catch (e) { /* нет поддержки */ } }
  }
  $('bFull').addEventListener('click', fullscreen);
  black.addEventListener('click', function () { black.hidden = true; });
  SP.onHub = function () { SP.enter(); };

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!black.hidden) { black.hidden = true; e.preventDefault(); return; }
    if (e.code === 'KeyF') fullscreen();
    else if (e.code === 'KeyL') setLang(LANGS[(LANGS.indexOf(DECK.lang) + 1) % LANGS.length]);
    else if (e.code === 'KeyB' || e.key === '.') black.hidden = false;
    else if (e.key === 'Home' || e.key === 'r' || e.key === 'к') SP.enter();
  });

  // курсор и кнопки прячутся, когда мышь не двигается
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
  applyLang();
  SP.enter();
  wake();

  /* ---------------------------------------------------------------- «живой» экран: подсветка сама бежит по веткам и по ленте экранов */
  var bi = -1, si = -1, hoverUntil = 0;
  var shots = Array.prototype.slice.call(document.querySelectorAll('.sp-shot'));
  $('mapStage').addEventListener('mousemove', function () { hoverUntil = Date.now() + 6000; });
  setTimeout(function () {
    setInterval(function () {
      if (Date.now() < hoverUntil) return;
      bi = (bi + 1) % SP.BR.length;
      SP.hot(SP.BR[bi].id);
    }, 3500);
    setInterval(function () {
      si = (si + 1) % shots.length;
      shots.forEach(function (x, i) { x.classList.toggle('on', i === si); });
    }, 2800);
  }, 2600);
})();
