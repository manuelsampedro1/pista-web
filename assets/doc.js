/* Pista, páginas legales y de ayuda: cabecera que se vuelve sólida al bajar e índice plegado en móvil.
   Sin cookies ni almacenamiento. */
(function () {
  'use strict';
  var header = document.querySelector('[data-header]');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-solid', window.scrollY > 24); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

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
