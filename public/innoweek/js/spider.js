/* ATOMLAB · InnoWeek — визитка на один экран (страница spider/): экран просто стоит, посетители смотрят.
 * Современная «бенто»-сетка: слева большая карточка ИИ-учителя с живым примером диалога, справа 6 карточек
 * с настоящими экранами ATOMLAB, внизу 4 панели. Языки (uz / ru / en) сменяются сами — js/spider-app.js. */
(function () {
  'use strict';

  var CARDS = [
    { id: 'lab', c: '#fbbf24', icon: 'i-flask', img: '../img/shots/lab3d.webp' },
    { id: 'vr', c: '#a78bfa', icon: 'i-vr', img: '../img/ai/vr.webp' },
    { id: 'org', c: '#c084fc', icon: 'i-cube', img: '../img/shots/organic.webp' },
    // видео из ATOMLAB: BaCl₂ + H₂SO₄ → осадок, ионы Ba²⁺ и SO₄²⁻ собираются в кристалл BaSO₄
    { id: 'form', c: '#2dd4bf', icon: 'i-atom', video: '../img/clips/formation.webm', poster: '../img/clips/formation-poster.jpg' },
    { id: 'book', c: '#34d399', icon: 'i-book', img: '../img/shots/book.webp' },
    { id: 'pt', c: '#60a5fa', icon: 'i-grid', img: '../img/shots/periodic.webp' },
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
    '<div class="vc-brand"><span class="logo"><span>ATOM</span><span class="grad">LAB</span></span><span class="vc-tag" data-t="sp.tag"></span></div>' +
    '<div class="vc-what"><div class="kicker" data-t="sp.kicker"></div><h1 data-t="sp.sub"></h1></div>'));

  // строка «для кого / где / нет реактивов» + языки (сменяются сами)
  stage.appendChild(el('div', 'vc-info',
    [['i1', 'i-users'], ['i2', 'i-phone'], ['i4', 'i-flask']].map(function (x) {
      return '<span class="vc-chip">' + icon(x[1]) + '<span data-t="sp.' + x[0] + '"></span></span>';
    }).join('') +
    '<span class="vc-langs">' + icon('i-globe') + '<b data-l="uz">oʻzbek</b><b data-l="ru">русский</b><b data-l="en">English</b><i class="vc-lbar"><i></i></i></span>'));

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
    var media = c.video
      ? '<video src="' + c.video + '" poster="' + c.poster + '" autoplay muted loop playsinline preload="auto"></video><span class="vc-vid"><i></i><span data-t="sp.video"></span></span>'
      : '<img src="' + c.img + '" alt="" />';
    var card = el('article', 'vc-card' + (c.video ? ' has-video' : ''),
      '<div class="vc-img">' + media + '</div>' +
      '<div class="vc-body">' +
      '<div class="vc-title"><span class="ico-wrap">' + icon(c.icon) + '</span><b data-t="sp.c.' + c.id + '.t"></b></div>' +
      '<div class="vc-metric" data-t="sp.c.' + c.id + '.m"></div>' +
      '<ul><li data-t="sp.c.' + c.id + '.1"></li><li data-t="sp.c.' + c.id + '.2"></li><li data-t="sp.c.' + c.id + '.3"></li></ul>' +
      '</div>');
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
      '<ul><li data-t="sp.p.' + p.id + '.1"></li><li data-t="sp.p.' + p.id + '.2"></li><li data-t="sp.p.' + p.id + '.3"></li></ul>');
    panel.style.setProperty('--c', p.c);
    panel.style.setProperty('--i', String(i + 7));
    panel.querySelector('.ico-wrap').style.setProperty('--c', p.c);
    band.appendChild(panel);
  });
  stage.appendChild(band);

  stage.appendChild(el('div', 'vc-foot', '<span data-t="sp.foot"></span>'));

  var cards = Array.prototype.slice.call(stage.querySelectorAll('.vc-card'));
  window.SPIDER = {
    cards: cards,
    hot: function (i) { cards.forEach(function (c, k) { c.classList.toggle('hot', k === i); }); },
    lang: function (l) { Array.prototype.forEach.call(stage.querySelectorAll('.vc-langs b'), function (b) { b.classList.toggle('on', b.getAttribute('data-l') === l); }); },
    enter: function () {
      map.classList.remove('shown');
      void map.offsetWidth; // перезапуск анимации появления
      map.classList.add('shown');
    },
  };
})();
