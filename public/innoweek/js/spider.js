/* ATOMLAB · InnoWeek — визитка на один экран (страница spider/): экран просто стоит, посетители смотрят.
 * Шапка (логотип + что это), 8 крупных карточек с настоящими экранами ATOMLAB, внизу 3 панели:
 * «Учителю», «Государству», «Лучше других». Тексты — js/spider-i18n.js (ru / uz / en). */
(function () {
  'use strict';

  var CARDS = [
    { id: 'ai', c: '#ec4899', icon: 'i-spark', img: '../img/shots/teacher.webp' },
    { id: 'lab', c: '#fbbf24', icon: 'i-flask', img: '../img/shots/lab3d.webp' },
    { id: 'vr', c: '#a78bfa', icon: 'i-vr', img: '../img/ai/vr.webp' },
    { id: 'org', c: '#c084fc', icon: 'i-cube', img: '../img/shots/organic.webp' },
    { id: 'form', c: '#2dd4bf', icon: 'i-atom', img: '../img/shots/reactor.webp' },
    { id: 'book', c: '#34d399', icon: 'i-book', img: '../img/shots/book.webp' },
    { id: 'pt', c: '#60a5fa', icon: 'i-grid', img: '../img/shots/periodic.webp' },
    { id: 'method', c: '#38bdf8', icon: 'i-test', img: '../img/shots/labtask.webp' },
  ];
  var PANELS = [
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
    '<div class="vc-brand"><span class="logo"><span>ATOM</span><span class="grad">LAB</span></span><span class="vc-tag" data-t="sp.tag"></span></div>' +
    '<div class="vc-what"><div class="kicker" data-t="sp.kicker"></div><h1 data-t="sp.sub"></h1></div>'));

  // 8 карточек с фото
  var grid = el('div', 'vc-grid');
  CARDS.forEach(function (c, i) {
    var card = el('article', 'vc-card',
      '<div class="vc-img"><img src="' + c.img + '" alt="" /></div>' +
      '<div class="vc-body">' +
      '<div class="vc-title"><span class="ico-wrap">' + icon(c.icon) + '</span><b data-t="sp.c.' + c.id + '.t"></b></div>' +
      '<div class="vc-metric" data-t="sp.c.' + c.id + '.m"></div>' +
      '<ul><li data-t="sp.c.' + c.id + '.1"></li><li data-t="sp.c.' + c.id + '.2"></li></ul>' +
      '</div>');
    card.style.setProperty('--c', c.c);
    card.style.setProperty('--i', String(i));
    card.querySelector('.ico-wrap').style.setProperty('--c', c.c);
    grid.appendChild(card);
  });
  stage.appendChild(grid);

  // 3 панели: учителю, государству, лучше других
  var band = el('div', 'vc-band');
  PANELS.forEach(function (p, i) {
    var panel = el('section', 'vc-panel',
      '<div class="vc-ptitle"><span class="ico-wrap">' + icon(p.icon) + '</span><b data-t="sp.p.' + p.id + '.t"></b></div>' +
      '<ul><li data-t="sp.p.' + p.id + '.1"></li><li data-t="sp.p.' + p.id + '.2"></li><li data-t="sp.p.' + p.id + '.3"></li></ul>');
    panel.style.setProperty('--c', p.c);
    panel.style.setProperty('--i', String(i + 8));
    panel.querySelector('.ico-wrap').style.setProperty('--c', p.c);
    band.appendChild(panel);
  });
  stage.appendChild(band);

  stage.appendChild(el('div', 'vc-foot', '<span data-t="sp.foot"></span>'));

  var cards = Array.prototype.slice.call(stage.querySelectorAll('.vc-card'));
  window.SPIDER = {
    cards: cards,
    hot: function (i) { cards.forEach(function (c, k) { c.classList.toggle('hot', k === i); }); },
    enter: function () {
      map.classList.remove('shown');
      void map.offsetWidth; // перезапуск анимации появления
      map.classList.add('shown');
    },
  };
})();
