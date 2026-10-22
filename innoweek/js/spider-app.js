/* ATOMLAB · InnoWeek — визитка (spider/): экран просто стоит, вся информация видна, ничего нажимать не нужно.
 * Языки сами сменяются по кругу (oʻzbek → русский → English), диалог ИИ-учителя печатается заново на каждом языке,
 * подсветка сама обходит карточки. Клавиши (по желанию): F или двойной клик — полный экран, L — следующий язык, B — чёрный экран. */
(function () {
  'use strict';

  var LANGS = ['uz', 'ru', 'en'];
  var CYCLE = 32; // секунд на один язык
  var SC = window.SCENES || {};
  var SP = window.SPIDER;
  var params = new URLSearchParams(location.search);

  function $(id) { return document.getElementById(id); }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; }

  var DECK = (window.DECK = {
    lang: 'ru',
    scale: 1,
    current: 'teacher', // демо-чат ИИ-учителя всегда на экране
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

  /* ---------------------------------------------------------------- языки: сами по кругу, плавно */
  var chat = SC.teacher;
  function applyLang() {
    document.documentElement.lang = DECK.lang;
    document.title = 'ATOMLAB — ' + t('sp.back') + ' · InnoWeek';
    each('[data-t]', function (el) { el.textContent = t(el.getAttribute('data-t')); });
    SP.lang(DECK.lang);
    if (chat && chat.enter) { try { chat.enter(); } catch (e) { console.warn('chat', e); } }
    var bar = document.querySelector('.vc-lbar');
    if (bar) { bar.style.setProperty('--cycle', CYCLE + 's'); bar.classList.remove('run'); void bar.offsetWidth; bar.classList.add('run'); }
  }
  var map = $('map'), cycleT = 0;
  function setLang(l, fade) {
    if (LANGS.indexOf(l) < 0) return;
    clearTimeout(cycleT);
    var go = function () {
      DECK.lang = l;
      store('atomlab-innoweek-lang', l);
      applyLang();
      map.classList.remove('swapping');
      cycleT = setTimeout(function () { setLang(LANGS[(LANGS.indexOf(DECK.lang) + 1) % LANGS.length], true); }, CYCLE * 1000);
    };
    if (fade) { map.classList.add('swapping'); setTimeout(go, 380); } else go();
  }

  /* ---------------------------------------------------------------- полный экран, чёрный экран, клавиши */
  var black = $('black');
  function fullscreen() {
    var d = document, el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
    var rq = el.requestFullscreen || el.webkitRequestFullscreen;
    if (rq) { try { var p = rq.call(el); if (p && p.catch) p.catch(function () {}); } catch (e) { /* нет поддержки */ } }
  }
  document.addEventListener('dblclick', fullscreen);
  black.addEventListener('click', function () { black.hidden = true; });
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!black.hidden) { black.hidden = true; e.preventDefault(); return; }
    if (e.code === 'KeyF') fullscreen();
    else if (e.code === 'KeyL') setLang(LANGS[(LANGS.indexOf(DECK.lang) + 1) % LANGS.length], true);
    else if (e.code === 'KeyB' || e.key === '.') black.hidden = false;
  });

  // курсор прячется, когда мышь не двигается
  var idleT = 0;
  function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleT);
    idleT = setTimeout(function () { document.body.classList.add('idle'); }, 2600);
  }
  window.addEventListener('mousemove', wake);

  /* ---------------------------------------------------------------- офлайн: service worker работает молча (без надписей) */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      var hadController = !!navigator.serviceWorker.controller;
      // вышла новая версия визитки — экран сам перезагружается на неё (на стенде никто не жмёт Ctrl+F5)
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (hadController && !window.__vcReloaded) { window.__vcReloaded = true; location.reload(); }
        hadController = true;
      });
      navigator.serviceWorker.register('../sw.js', { scope: '../' }).then(function (reg) {
        // экран может стоять весь день — раз в 15 минут проверяем, нет ли новой версии
        setInterval(function () { reg.update().catch(function () {}); }, 15 * 60 * 1000);
      }).catch(function (e) { console.warn('sw', e); });
    });
  }

  /* ---------------------------------------------------------------- старт */
  if (SC._bg) { try { SC._bg.init(); } catch (e) { console.warn('bg', e); } }
  if (chat && chat.init) { try { chat.init(); } catch (e) { console.warn('chat', e); } }
  SP.enter();
  setLang(DECK.lang, false);
  wake();

  // видео: без звука и по кругу; если браузер не запустил его сам — запускаем ещё раз
  function playVideos() {
    Array.prototype.forEach.call(document.querySelectorAll('video'), function (v) {
      v.muted = true;
      v.loop = true;
      if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    });
  }
  playVideos();
  Array.prototype.forEach.call(document.querySelectorAll('video'), function (v) {
    v.addEventListener('canplay', playVideos);
    v.addEventListener('ended', function () { v.currentTime = 0; playVideos(); });
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) playVideos(); });
  setInterval(playVideos, 5000);

  // подсветка сама обходит карточки (кроме видео)
  var ci = -1;
  setTimeout(function () {
    setInterval(function () {
      ci = (ci + 1) % SP.cards.length;
      SP.hot(ci);
    }, 3200);
  }, 1800);
})();
