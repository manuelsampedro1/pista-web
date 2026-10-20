/* Pista, portada: scroll suave y animaciones. Sin cookies ni almacenamiento.
   Con "reducir movimiento" todo queda quieto y legible desde el principio. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) document.documentElement.classList.add('anim');
  var mobile = window.matchMedia('(max-width: 860px)');
  var header = document.querySelector('.site-header');
  var hero = document.querySelector('.hero');

  // ---------- Vídeo de portada: llega después de lo importante ----------
  var video = document.querySelector('.hero-media video');
  function loadVideo() {
    if (!video || reduce || (navigator.connection && navigator.connection.saveData)) return;
    video.src = video.getAttribute(mobile.matches ? 'data-src-mobile' : 'data-src-desktop');
    video.addEventListener('canplay', function () { video.classList.add('is-ready'); video.play().catch(function () {}); }, { once: true });
    video.load();
  }
  if (document.readyState === 'complete') setTimeout(loadVideo, 200); else window.addEventListener('load', function () { setTimeout(loadVideo, 200); });

  // ---------- Lista de espera: cuánta gente espera ya (solo si es una cifra que diga algo) ----------
  var live = document.querySelector('[data-wl-count]');
  var cfg = window.PISTA_CONFIG || {};
  if (live && /^https:\/\//.test(cfg.SUPABASE_URL || '') && window.fetch) {
    fetch(cfg.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/waitlist_counts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_PUBLISHABLE_KEY },
      body: '{}'
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !(d.total >= 100)) return;
      live.querySelector('b').textContent = new Intl.NumberFormat(document.documentElement.lang === 'en' ? 'en-GB' : 'es-ES').format(d.total);
      live.hidden = false;
    }).catch(function () {});
  }

  // ---------- Entradas sencillas ----------
  var rises = document.querySelectorAll('.rise');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    rises.forEach(function (el, i) {
      if (el.closest('.hero')) el.style.transitionDelay = (0.15 + i * 0.12) + 's';
      io.observe(el);
    });
  } else {
    rises.forEach(function (el) { el.classList.add('is-in'); });
  }

  // ---------- Cabecera ----------
  var lastY = 0;
  function onScroll(y) {
    var past = hero ? y > hero.offsetHeight - 90 : y > 40;
    header.classList.toggle('is-solid', past);
    header.classList.toggle('is-hidden', past && y > lastY + 4 && y > 900);
    if (y < lastY - 4) header.classList.remove('is-hidden');
    lastY = y;
  }
  onScroll(window.scrollY);

  if (reduce || !window.gsap || !window.ScrollTrigger) {
    window.addEventListener('scroll', function () { onScroll(window.scrollY); }, { passive: true });
    var tagStatic = document.querySelector('.phone-tag');
    if (tagStatic) tagStatic.style.display = 'none';
    return;
  }

  var gsap = window.gsap, ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);
  if (window.SplitText) gsap.registerPlugin(window.SplitText);

  // ---------- Scroll suave ----------
  var lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', function (e) { ST.update(); onScroll(e.scroll); });
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id.length < 2) return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -60, duration: 1.4 });
        history.replaceState(null, '', id);
      });
    });
  } else {
    window.addEventListener('scroll', function () { onScroll(window.scrollY); }, { passive: true });
  }

  // ---------- Portada: líneas de pista que se dibujan y el vídeo que se aleja ----------
  var courtPaths = document.querySelectorAll('.court path');
  courtPaths.forEach(function (p, i) {
    var len = p.getTotalLength();
    gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.8, delay: 0.3 + i * 0.18, ease: 'power3.inOut' });
  });
  gsap.to('.hero-media', { scale: 1.08, yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-inner', { yPercent: -12, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: '40% top', end: 'bottom top', scrub: true } });

  // ---------- Manifiesto: palabra a palabra ----------
  var big = document.querySelector('[data-words]');
  if (big && window.SplitText) {
    var split = new window.SplitText(big, { type: 'words', wordsClass: 'w' });
    gsap.fromTo(split.words, { opacity: 0.16 }, {
      opacity: 1, stagger: 0.08, ease: 'none',
      scrollTrigger: { trigger: big, start: 'top 78%', end: 'bottom 45%', scrub: true }
    });
  }
  var circle = document.querySelector('.circled path');
  if (circle) {
    var cl = circle.getTotalLength();
    gsap.fromTo(circle, { strokeDasharray: cl, strokeDashoffset: cl }, {
      strokeDashoffset: 0, ease: 'none',
      scrollTrigger: { trigger: '.circled', start: 'top 70%', end: 'top 40%', scrub: true }
    });
  }

  // ---------- Así se juega: el móvil cambia con cada tiempo del partido ----------
  var screens = document.querySelectorAll('.phone-col .screen img');
  var tag = document.querySelector('.phone-tag');
  document.querySelectorAll('.step').forEach(function (step, i) {
    gsap.fromTo(step.querySelector('.score'), { yPercent: 30, opacity: 0.2 }, {
      yPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: step, start: 'top 85%', end: 'top 45%', scrub: true }
    });
    ST.create({
      trigger: step, start: 'top 55%', end: 'bottom 55%',
      onToggle: function (self) {
        if (!self.isActive) return;
        screens.forEach(function (img, k) { img.classList.toggle('is-on', k === i); });
        if (tag) {
          gsap.fromTo(tag, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
          tag.textContent = step.getAttribute('data-tag');
        }
      }
    });
  });

  // ---------- Gente que entrena: cada foto a su ritmo ----------
  ST.matchMedia({
    '(min-width: 861px)': function () {
      document.querySelectorAll('.shot').forEach(function (el) {
        var speed = parseFloat(el.getAttribute('data-speed')) || 1;
        gsap.fromTo(el, { y: 220 * speed }, { y: -260 * speed, ease: 'none', scrollTrigger: { trigger: '.people-stage', start: 'top bottom', end: 'bottom top', scrub: true } });
        gsap.fromTo(el.querySelector('img'), { rotate: (speed - 0.7) * 6 }, { rotate: (0.7 - speed) * 6, ease: 'none', scrollTrigger: { trigger: '.people-stage', start: 'top bottom', end: 'bottom top', scrub: true } });
      });
      gsap.fromTo('.third-photo img', { yPercent: -8 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.third', start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  });

  // ---------- Cinta de deportes: se mueve sola y acelera con el scroll ----------
  var rows = document.querySelectorAll('.marquee-row');
  var offsets = [0, 0], boost = 0;
  if (lenis) lenis.on('scroll', function (e) { boost = Math.min(Math.abs(e.velocity) * 0.6, 24); });
  gsap.ticker.add(function () {
    rows.forEach(function (row, i) {
      var half = row.scrollWidth / 2;
      if (!half) return;
      var dir = i === 0 ? -1 : 1;
      offsets[i] += dir * (0.6 + boost);
      if (offsets[i] <= -half) offsets[i] += half;
      if (offsets[i] >= 0 && dir > 0) offsets[i] -= half;
      row.style.transform = 'translate3d(' + offsets[i] + 'px,0,0)';
    });
    boost *= 0.92;
  });
  offsets[1] = -(rows[1] ? rows[1].scrollWidth / 2 : 0);

  // ---------- Planes ----------
  gsap.from('.plan', { y: 30, opacity: 0, stagger: 0.12, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: '.plans', start: 'top 80%' } });

  // ---------- Dorsal: se inclina con el ratón y cuenta hasta su número ----------
  var bib = document.querySelector('.bib');
  if (bib) {
    var num = bib.querySelector('[data-count]');
    var target = parseInt(num.getAttribute('data-count'), 10);
    var counter = { v: 1 };
    gsap.to(counter, {
      v: target, duration: 1.6, ease: 'power2.out',
      scrollTrigger: { trigger: bib, start: 'top 75%', once: true },
      onUpdate: function () { num.textContent = String(Math.round(counter.v)).padStart(4, '0'); }
    });
    num.textContent = '0001';
    var stage = bib.parentElement;
    stage.addEventListener('pointermove', function (e) {
      var r = bib.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      bib.style.setProperty('--ry', (px * 18) + 'deg');
      bib.style.setProperty('--rx', (-py * 14) + 'deg');
      bib.style.setProperty('--gx', ((px + 0.5) * 100) + '%');
      bib.style.setProperty('--gy', ((py + 0.5) * 100) + '%');
    });
    stage.addEventListener('pointerleave', function () {
      bib.style.removeProperty('--ry'); bib.style.removeProperty('--rx');
    });
  }

  // La pelota recalcula sus sitios cuando cambian las medidas (fuentes, imágenes, pantalla).
  window.addEventListener('load', function () { ST.refresh(); if (window.PistaBall) window.PistaBall.measure(); });
  ST.addEventListener('refresh', function () { if (window.PistaBall) window.PistaBall.measure(); });
})();
