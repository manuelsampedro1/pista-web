/* Pista. Animaciones al hacer scroll. Sin cookies ni almacenamiento. */
(function () {
  'use strict';
  var items = document.querySelectorAll('.reveal');
  if (!items.length) return;
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  items.forEach(function (el) { io.observe(el); });
})();

/* Índice de las páginas legales: abierto en escritorio, plegado en móvil. */
(function () {
  'use strict';
  var tocs = document.querySelectorAll('details.toc');
  if (!tocs.length || !window.matchMedia) return;
  var mq = window.matchMedia('(max-width: 900px)');
  function sync() { tocs.forEach(function (d) { d.open = !mq.matches; }); }
  sync();
  if (mq.addEventListener) mq.addEventListener('change', sync);
  tocs.forEach(function (d) {
    d.querySelector('summary').addEventListener('click', function (e) { if (!mq.matches) e.preventDefault(); });
    d.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { if (mq.matches) d.open = false; }); });
  });
})();
