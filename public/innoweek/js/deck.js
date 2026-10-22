/* ATOMLAB · InnoWeek — движок презентации: листание, языки, обзор, окно докладчика, офлайн. */
(function () {
  'use strict';

  var LANGS = ['uz', 'ru', 'en'];
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var ids = slides.map(function (s) { return s.getAttribute('data-id'); });
  var N = slides.length;
  var cur = -1;
  var params = new URLSearchParams(location.search);
  var isPresenter = params.has('presenter');
  var SC = window.SCENES || {};

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

  /* ---------------------------------------------------------------- масштаб сцены 1920×1080 */
  var stage = document.getElementById('stage');
  function rescale() {
    // окно ещё без размера (фоновая вкладка, восстановление сессии в Edge) — не сжимаем сцену в точку, ждём размер
    var w = window.innerWidth || document.documentElement.clientWidth;
    var h = window.innerHeight || document.documentElement.clientHeight;
    if (!w || !h) { requestAnimationFrame(rescale); return; }
    var s = Math.min(w / 1920, h / 1080);
    DECK.scale = s;
    stage.style.setProperty('--scale', String(s));
  }
  window.addEventListener('resize', rescale);
  window.addEventListener('pageshow', rescale);
  document.addEventListener('visibilitychange', rescale);
  if (typeof ResizeObserver === 'function') new ResizeObserver(rescale).observe(document.documentElement);
  rescale();

  /* ---------------------------------------------------------------- картинки: запасной вариант, если файла нет */
  Array.prototype.forEach.call(document.querySelectorAll('img[data-fallback]'), function (img) {
    function swap() { var f = img.getAttribute('data-fallback'); if (f && img.getAttribute('src') !== f) img.setAttribute('src', f); }
    img.addEventListener('error', swap);
    if (img.complete && img.naturalWidth === 0) swap();
  });

  /* ---------------------------------------------------------------- языки */
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  function applyLang() {
    document.documentElement.lang = DECK.lang;
    document.title = t('doc.title');
    each('[data-t]', function (el) { el.textContent = t(el.getAttribute('data-t')); });
    each('[data-tn]', function (el) { el.textContent = t(el.getAttribute('data-tn')).replace('{n}', el.getAttribute('data-n')); });
    each('[data-tt]', function (el) { var v = t(el.getAttribute('data-tt')); el.title = v; el.setAttribute('aria-label', v); });
    each('.lang button', function (b) { b.classList.toggle('on', b.getAttribute('data-lang') === DECK.lang); });
    Object.keys(SC).forEach(function (k) { if (SC[k] && SC[k].lang) { try { SC[k].lang(); } catch (e) { console.warn(k, e); } } });
    buildOverview();
    offlineText();
    broadcast();
    presenterRender();
  }
  function setLang(l) {
    if (LANGS.indexOf(l) < 0) return;
    DECK.lang = l;
    store('atomlab-innoweek-lang', l);
    applyLang();
  }
  each('.lang button', function (b) { b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); }); });

  /* ---------------------------------------------------------------- переход между слайдами */
  function titleOf(i) {
    var s = slides[i]; if (!s) return '';
    if (ids[i] === 'cover') return 'ATOMLAB — ' + t('tag');
    var h = s.querySelector('.title');
    return h ? h.textContent : ids[i];
  }
  function go(i, force) {
    i = Math.max(0, Math.min(N - 1, i));
    if (i === cur && !force) return;
    var prev = cur;
    cur = i;
    slides.forEach(function (s, k) {
      s.classList.toggle('on', k === i);
      s.classList.toggle('past', k < i);
      s.setAttribute('aria-hidden', k === i ? 'false' : 'true');
    });
    if (prev >= 0 && prev !== i && SC[ids[prev]] && SC[ids[prev]].leave) { try { SC[ids[prev]].leave(); } catch (e) { console.warn(e); } }
    DECK.current = ids[i];
    if (SC[ids[i]] && SC[ids[i]].enter) { try { SC[ids[i]].enter(); } catch (e) { console.warn(e); } }
    try { history.replaceState(null, '', location.pathname + location.search + '#' + (i + 1)); } catch (e) { /* file:// */ }
    document.querySelector('#progress i').style.width = (N > 1 ? (i / (N - 1)) * 100 : 100) + '%';
    document.getElementById('counter').textContent = i + 1 + ' / ' + N;
    each('.ov-item', function (b, k) { b.classList.toggle('on', k === i); });
    broadcast();
  }
  function next() { go(cur + 1); }
  function prev() { go(cur - 1); }
  DECK.go = go;

  function fromHash() {
    var h = decodeURIComponent((location.hash || '').slice(1));
    if (!h) return 0;
    var n = parseInt(h, 10);
    if (!isNaN(n)) return n - 1;
    var k = ids.indexOf(h);
    return k >= 0 ? k : 0;
  }
  window.addEventListener('hashchange', function () { go(fromHash()); });

  /* ---------------------------------------------------------------- обзор, справка, чёрный экран, полный экран */
  var ov = document.getElementById('overview'), help = document.getElementById('help'), black = document.getElementById('black');
  function buildOverview() {
    var g = document.getElementById('ovGrid'); g.innerHTML = '';
    slides.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ov-item' + (i === cur ? ' on' : '');
      var k = s.querySelector('.kicker');
      b.innerHTML = '<small></small><b></b>';
      b.querySelector('small').textContent = i + 1 + (k ? ' · ' + k.textContent : '');
      b.querySelector('b').textContent = titleOf(i);
      b.addEventListener('click', function () { go(i); toggle(ov, false); });
      g.appendChild(b);
    });
  }
  function toggle(el, on) { el.hidden = on === undefined ? !el.hidden : !on; }
  function fullscreen() {
    var d = document, el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
    var rq = el.requestFullscreen || el.webkitRequestFullscreen;
    if (rq) { try { var p = rq.call(el); if (p && p.catch) p.catch(function () {}); } catch (e) { /* нет поддержки */ } }
  }
  document.getElementById('bPrev').addEventListener('click', prev);
  document.getElementById('bNext').addEventListener('click', next);
  document.getElementById('bGrid').addEventListener('click', function () { toggle(ov); });
  document.getElementById('bHelp').addEventListener('click', function () { toggle(help); });
  document.getElementById('bFull').addEventListener('click', fullscreen);
  document.getElementById('bPres').addEventListener('click', openPresenter);
  ov.addEventListener('click', function (e) { if (e.target === ov) toggle(ov, false); });
  help.addEventListener('click', function () { toggle(help, false); });
  black.addEventListener('click', function () { toggle(black, false); });

  /* ---------------------------------------------------------------- клавиатура (и пульт-кликер: PgUp/PgDn/B) */
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isPresenter) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); send({ type: 'go', i: cur + 1 }); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); send({ type: 'go', i: cur - 1 }); }
      return;
    }
    if (!black.hidden) { toggle(black, false); e.preventDefault(); return; }
    var code = e.code, key = e.key;
    if (key === 'ArrowRight' || key === 'PageDown' || key === 'ArrowDown' || key === ' ' || key === 'Spacebar') {
      e.preventDefault(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); next();
    } else if (key === 'ArrowLeft' || key === 'PageUp' || key === 'ArrowUp' || key === 'Backspace') {
      e.preventDefault(); prev();
    } else if (key === 'Home') { go(0); }
    else if (key === 'End') { go(N - 1); }
    else if (code === 'KeyF') { fullscreen(); }
    else if (code === 'KeyO' || key === 'Escape') {
      if (!help.hidden) toggle(help, false); else toggle(ov);
    } else if (code === 'KeyL') { setLang(LANGS[(LANGS.indexOf(DECK.lang) + 1) % LANGS.length]); }
    else if (code === 'KeyB' || key === '.') { toggle(black, true); }
    else if (code === 'KeyP') { openPresenter(); }
    else if (key === '?' || code === 'KeyH') { toggle(help); }
  });

  /* ---------------------------------------------------------------- колесо мыши и свайп */
  function noNav(target) { return target && target.closest && target.closest('.no-nav, .chat-body, #overview, #help'); }
  var wheelLock = 0;
  window.addEventListener('wheel', function (e) {
    if (noNav(e.target) || !ov.hidden) return;
    var now = Date.now();
    if (now < wheelLock || Math.abs(e.deltaY) < 25) return;
    wheelLock = now + 750;
    if (e.deltaY > 0) next(); else prev();
  }, { passive: true });
  var tx = 0, ty = 0, tOk = false;
  window.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { tOk = false; return; }
    tOk = !noNav(e.target); tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchend', function (e) {
    if (!tOk) return;
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { if (dx < 0) next(); else prev(); }
  }, { passive: true });

  /* ---------------------------------------------------------------- курсор и панель прячутся */
  var idleT = 0;
  function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleT);
    idleT = setTimeout(function () { document.body.classList.add('idle'); }, 2600);
  }
  window.addEventListener('mousemove', wake);
  window.addEventListener('touchstart', wake, { passive: true });

  /* ---------------------------------------------------------------- окно докладчика (P) */
  var chan = null;
  try { chan = new BroadcastChannel('atomlab-innoweek'); } catch (e) { chan = null; }
  function send(msg) {
    msg.from = isPresenter ? 'presenter' : 'deck';
    if (chan) { try { chan.postMessage(msg); } catch (e) { /* закрыт */ } }
    else store('atomlab-innoweek-msg', JSON.stringify(msg) + '|' + Date.now());
  }
  function onMsg(m) {
    if (!m || m.from === (isPresenter ? 'presenter' : 'deck')) return;
    if (isPresenter) {
      if (m.type === 'state') {
        if (m.lang && m.lang !== DECK.lang) { DECK.lang = m.lang; applyLang(); }
        cur = m.i; presenterRender();
      }
    } else if (m.type === 'go') { go(m.i); }
    else if (m.type === 'hello') { broadcast(); }
  }
  if (chan) chan.onmessage = function (e) { onMsg(e.data); };
  window.addEventListener('storage', function (e) {
    if (e.key !== 'atomlab-innoweek-msg' || !e.newValue) return;
    try { onMsg(JSON.parse(e.newValue.split('|').slice(0, -1).join('|'))); } catch (err) { /* мусор */ }
  });
  function broadcast() { if (!isPresenter && cur >= 0) send({ type: 'state', i: cur, lang: DECK.lang }); }
  function openPresenter() {
    var url = location.pathname + '?presenter' + (location.hash || '');
    var w = window.open(url, 'atomlab-presenter', 'width=1100,height=760');
    if (w) setTimeout(broadcast, 800);
  }

  var t0 = Date.now();
  function presenterRender() {
    if (!isPresenter || cur < 0) return;
    var id = ids[cur];
    document.getElementById('prTitle').textContent = cur + 1 + '. ' + titleOf(cur);
    document.getElementById('prNotes').textContent = (window.NOTES && window.NOTES[id]) || '';
    document.getElementById('prNext').textContent = cur + 1 < N ? cur + 2 + '. ' + titleOf(cur + 1) : t('pres.end');
    document.getElementById('prCount').textContent = cur + 1 + ' / ' + N;
  }
  function presenterInit() {
    document.body.classList.add('presenter-mode');
    document.getElementById('presenter').hidden = false;
    document.getElementById('prPrev').addEventListener('click', function () { send({ type: 'go', i: cur - 1 }); });
    document.getElementById('prNextBtn').addEventListener('click', function () { send({ type: 'go', i: cur + 1 }); });
    document.getElementById('prReset').addEventListener('click', function () { t0 = Date.now(); });
    setInterval(function () {
      var s = Math.floor((Date.now() - t0) / 1000);
      document.getElementById('prTimer').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      var d = new Date();
      document.getElementById('prClock').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }, 500);
    cur = fromHash();
    applyLang();
    send({ type: 'hello' });
  }

  /* ---------------------------------------------------------------- офлайн: service worker сохраняет всё после первого открытия */
  var offState = '';
  function offlineText() {
    var b = document.getElementById('offBadge'), hp = document.getElementById('helpOff');
    if (!offState) { b.hidden = true; hp.textContent = ''; return; }
    b.hidden = false;
    b.classList.toggle('wait', offState !== 'ready');
    var txt = offState === 'ready' ? t('ui.offline') : t('ui.caching');
    b.querySelector('span').textContent = txt;
    hp.textContent = offState === 'ready' ? '✓ ' + txt : txt;
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
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !isPresenter) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function () {
        offState = 'caching'; offlineText();
        return navigator.serviceWorker.ready;
      }).then(function (reg) { askSw(reg, 0); }).catch(function (e) { console.warn('sw', e); });
    });
  }

  /* ---------------------------------------------------------------- старт */
  function initScenes() {
    if (SC._bg) { try { SC._bg.init(); } catch (e) { console.warn('bg', e); } }
    ids.forEach(function (id) { if (SC[id] && SC[id].init) { try { SC[id].init(); } catch (e) { console.warn(id, e); } } });
  }
  if (isPresenter) { presenterInit(); return; }
  initScenes();
  applyLang();
  go(fromHash(), true);
  wake();
})();
