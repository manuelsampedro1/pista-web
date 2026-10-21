/* Pista, portada: cabecera que se vuelve sólida al salir de la foto, apariciones al hacer scroll y
   botones que llevan al formulario de la lista. Sin librerías. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var header = document.querySelector('.site-header');
  var hero = document.querySelector('.lp-hero');
  var lastY = 0;

  function onScroll() {
    var y = window.scrollY;
    var past = y > (hero ? hero.offsetHeight * 0.5 : 200);
    header.classList.toggle('is-solid', past);
    header.classList.toggle('is-hidden', past && y > lastY + 4 && y > 900);
    if (y < lastY - 4) header.classList.remove('is-hidden');
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('is-in'); });
  }

  // Los botones de "apúntate" bajan al formulario y dejan el cursor en el correo.
  document.querySelectorAll('[data-to-form]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      var email = target.querySelector('input[name="email"]');
      if (email && !target.querySelector('[data-view="form"]').hidden) setTimeout(function () { email.focus({ preventScroll: true }); }, reduce ? 0 : 500);
    });
  });
})();
