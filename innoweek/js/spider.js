/* ATOM LAB · InnoWeek — визитка на один экран (страница spider/): экран просто стоит, посетители смотрят.
 * «Бенто»: слева ИИ-учитель с живым примером диалога, в центре — видео опытов из ATOM LAB (два по очереди),
 * справа и под видео — карточки с крупными кадрами приложения, внизу 4 панели. Язык выбирают кнопками в шапке. */
(function () {
  'use strict';

  var CARDS = [
    // большое видео в центре — опыты из ATOM LAB по очереди (записи экрана владельца):
    // BaCl₂ + H₂SO₄ → осадок BaSO₄; 2Na + Cl₂ → кристалл NaCl
    { id: 'form', c: '#2dd4bf', icon: 'i-atom', videos: [
      { src: '../img/clips/formation.webm', poster: '../img/clips/formation-poster.jpg', eq: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl' },
      { src: '../img/clips/nacl.webm', poster: '../img/clips/nacl-poster.jpg', eq: '2Na + Cl₂ → 2NaCl' },
    ] },
    { id: 'lab', c: '#fbbf24', icon: 'i-flask', img: '../img/cards/lab.webp' },
    { id: 'vr', c: '#a78bfa', icon: 'i-vr', img: '../img/ai/vr.webp' },
    { id: 'org', c: '#c084fc', icon: 'i-cube', img: '../img/cards/organic.webp' },
    { id: 'book', c: '#34d399', icon: 'i-book', img: '../img/cards/book.webp', n: 4 },
  ];
  var PANELS = [
    { id: 'method', c: '#38bdf8', icon: 'i-test' },
    { id: 'teacher', c: '#60a5fa', icon: 'i-plan' },
    { id: 'state', c: '#4ade80', icon: 'i-globe' },
    { id: 'better', c: '#fb7185', icon: 'i-check' },
  ];

  var map = document.getElementById('map');
  var stage = document.getElementById('mapStage');
  if (!map || !stage) return;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function icon(id) { return '<svg class="ic"><use href="#' + id + '"/></svg>'; }

  // шапка: логотип слева, что это — справа
  stage.appendChild(el('header', 'vc-head',
    '<div class="vc-brand"><span class="logo"><span>ATOM</span> <span class="grad">LAB</span></span><span class="vc-tag" data-t="sp.tag"></span></div>' +
    '<div class="vc-what"><div class="kicker" data-t="sp.kicker"></div><h1 data-t="sp.sub"></h1></div>'));

  // строка «для кого / где / нет реактивов» + языки (сменяются сами)
  stage.appendChild(el('div', 'vc-info',
    [['i1', 'i-users'], ['i2', 'i-phone'], ['i4', 'i-flask']].map(function (x) {
      return '<span class="vc-chip">' + icon(x[1]) + '<span data-t="sp.' + x[0] + '"></span></span>';
    }).join('') +
    '<span class="vc-langs" role="group" aria-label="Til / Язык / Language">' + icon('i-globe') +
    '<button type="button" data-l="uz">oʻzbek</button><button type="button" data-l="ru">русский</button><button type="button" data-l="en">English</button></span>'));

  // большая карточка ИИ-учителя с живым примером диалога
  var hero = el('article', 'vc-hero',
    '<div class="vc-htop"><span class="ico-wrap">' + icon('i-spark') + '</span><div><b data-t="sp.ai.t"></b><p data-t="sp.ai.sub"></p></div></div>' +
    '<div class="vc-live"><i></i><span data-t="sp.ai.live"></span></div>' +
    '<div class="vc-chatbox">' +
    '<div class="chat-body" id="chatBody"></div><button type="button" id="chatReplay" hidden></button></div>' +
    '<div class="vc-feats">' + [['f1', 'i-book'], ['f2', 'i-calc'], ['f3', 'i-mic'], ['f4', 'i-camera']].map(function (x) {
      return '<span>' + icon(x[1]) + '<span data-t="sp.ai.' + x[0] + '"></span></span>';
    }).join('') + '</div>');
  hero.style.setProperty('--c', '#ec4899');
  hero.style.setProperty('--i', '0');
  hero.querySelector('.ico-wrap').style.setProperty('--c', '#ec4899');

  // 6 карточек с фото (горизонтальные)
  var grid = el('div', 'vc-grid');
  grid.appendChild(hero);
  CARDS.forEach(function (c, i) {
    var v0 = c.videos && c.videos[0];
    var media = v0
      ? '<video src="' + v0.src + '" poster="' + v0.poster + '" autoplay muted playsinline preload="auto"></video>' +
        '<span class="vc-vid"><i></i><span data-t="sp.video"></span><b class="vc-vnum">1 / ' + c.videos.length + '</b></span>' +
        '<span class="vc-eq">' + v0.eq + '</span>'
      : '<img src="' + c.img + '" alt="" />';
    var card = el('article', 'vc-card' + (v0 ? ' has-video' : ''),
      '<div class="vc-img">' + media + '</div>' +
      '<div class="vc-body">' +
      '<div class="vc-title"><span class="ico-wrap">' + icon(c.icon) + '</span><b data-t="sp.c.' + c.id + '.t"></b></div>' +
      '<div class="vc-metric" data-t="sp.c.' + c.id + '.m"></div>' +
      '<ul>' + [1, 2, 3, 4].slice(0, c.n || 3).map(function (k) { return '<li data-t="sp.c.' + c.id + '.' + k + '"></li>'; }).join('') + '</ul>' +
      '</div>');
    card.setAttribute('data-id', c.id);
    card.style.setProperty('--c', c.c);
    card.style.setProperty('--i', String(i + 1));
    card.querySelector('.ico-wrap').style.setProperty('--c', c.c);
    grid.appendChild(card);
  });
  stage.appendChild(grid);

  // 4 панели: методы обучения, учителю, государству, лучше других
  var band = el('div', 'vc-band');
  PANELS.forEach(function (p, i) {
    var panel = el('section', 'vc-panel',
      '<div class="vc-ptitle"><span class="ico-wrap">' + icon(p.icon) + '</span><b data-t="sp.p.' + p.id + '.t"></b></div>' +
      '<ul>' + [1, 2, 3, 4].map(function (k) { return '<li data-t="sp.p.' + p.id + '.' + k + '"></li>'; }).join('') + '</ul>');
    panel.style.setProperty('--c', p.c);
    panel.style.setProperty('--i', String(i + 7));
    panel.querySelector('.ico-wrap').style.setProperty('--c', p.c);
    band.appendChild(panel);
  });
  stage.appendChild(band);


  // опыты в центре идут по очереди: закончился ролик — следующий (подпись реакции и номер меняются)
  CARDS.forEach(function (c) {
    if (!c.videos) return;
    var card = stage.querySelector('.vc-card[data-id="' + c.id + '"]');
    var v = card && card.querySelector('video');
    if (!v) return;
    var k = 0;
    v.addEventListener('ended', function () {
      k = (k + 1) % c.videos.length;
      var it = c.videos[k];
      v.poster = it.poster;
      v.src = it.src;
      card.querySelector('.vc-eq').textContent = it.eq;
      card.querySelector('.vc-vnum').textContent = k + 1 + ' / ' + c.videos.length;
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    });
  });

  var cards = Array.prototype.slice.call(stage.querySelectorAll('.vc-card'));
  window.SPIDER = {
    cards: cards,
    hot: function (i) { cards.forEach(function (c, k) { c.classList.toggle('hot', k === i); }); },
    lang: function (l) { Array.prototype.forEach.call(stage.querySelectorAll('.vc-langs button'), function (b) { b.classList.toggle('on', b.getAttribute('data-l') === l); }); },
    enter: function () {
      map.classList.remove('shown');
      void map.offsetWidth; // перезапуск анимации появления
      map.classList.add('shown');
    },
  };
})();
