/* Pista, portada: scroll suave (Lenis), marcador de la portada, retratos que se suceden, calendario que corre
   según lo rápido que bajas, números fijos de "cómo funciona", mazo de perfiles, anillo de deportes y la pelota
   que bota al apuntarte. GSAP 3.15 con ScrollTrigger y SplitText; Flip, Draggable e Inertia se cargan después.
   Con "reducir movimiento" todo pasa a fundidos. Sin GSAP la página se ve entera y funciona igual. */
(function () {
  'use strict';
  var d = document;
  var html = d.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  var desktop = window.matchMedia('(min-width: 861px)');
  var finePointer = window.matchMedia('(pointer: fine)');
  var $ = function (sel, root) { return (root || d).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); };
  var hd = function () { return ($('[data-header]') || {}).offsetHeight || 64; };
  if (reduce) html.classList.add('no-motion');
  if (!gsap || !ST) { html.classList.add('no-motion'); reduce = true; }
  if (gsap && ST) gsap.registerPlugin(ST, window.SplitText);

  // ---------- Scroll suave ----------

  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.11, wheelMultiplier: 0.95 });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  function scrollTo(el, opts) {
    opts = opts || {};
    var offset = opts.offset != null ? opts.offset : -hd() - 12;
    if (lenis) lenis.scrollTo(el, { offset: offset, duration: opts.duration || 1.2, onComplete: opts.done });
    else {
      var top = el.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
      if (opts.done) setTimeout(opts.done, reduce ? 0 : 600);
    }
  }
  // waitlist.js lo usa para no pelearse con el scroll suave.
  window.PistaScrollTo = function (el) {
    var r = el.getBoundingClientRect();
    if (r.top < hd() || r.bottom > window.innerHeight) scrollTo(el, { duration: 0.8 });
  };

  // Enlaces internos: bajan suave y dejan el foco donde toca.
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1);
      var target = id && d.getElementById(id);
      if (!target) return;
      e.preventDefault();
      history.replaceState(null, '', '#' + id);
      if (target.tagName === 'DETAILS') target.open = true;
      var form = a.hasAttribute('data-to-form') && target.querySelector('[data-view="form"]');
      scrollTo(target, {
        offset: form ? -hd() - 24 : -hd(),
        done: function () {
          var email = form && !form.hidden && form.querySelector('input[name="email"]');
          if (email) email.focus({ preventScroll: true });
          else { if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
        }
      });
    });
  });

  // Si se llega con el ancla de una pregunta (#seguridad), se abre.
  var hashTarget = location.hash && d.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (hashTarget && hashTarget.tagName === 'DETAILS') hashTarget.open = true;

  // ---------- Cabecera ----------

  var header = $('[data-header]');
  var lastY = window.scrollY;
  function onScroll() {
    var y = window.scrollY;
    header.classList.toggle('is-solid', y > 24);
    if (y > 700 && y > lastY + 6) header.classList.add('is-hidden');
    else if (y < lastY - 6 || y < 700) header.classList.remove('is-hidden');
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
  onScroll();

  // ---------- Portada: marcador ----------

  var LETTERS = 'ABCDEFGHIJLMNOPQRSTUVZ';
  function board(el, delay) {
    var text = el.textContent;
    if (reduce) {
      el.classList.add('is-set');
      if (gsap) gsap.from(el, { opacity: 0, duration: 0.8, delay: delay * 0.5, ease: 'power1.out' });
      return;
    }
    el.textContent = '';
    var reels = [];
    Array.prototype.forEach.call(text, function (ch, i) {
      var box = d.createElement('span');
      box.className = 'board-char';
      box.textContent = ch;
      el.appendChild(box);
      var w = box.getBoundingClientRect().width;
      if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(ch)) return;
      box.style.width = w + 'px';
      box.textContent = '';
      var reel = d.createElement('span');
      reel.className = 'board-reel';
      var spins = 3 + (i % 3);
      for (var k = 0; k < spins; k++) {
        var r = d.createElement('span');
        r.textContent = LETTERS.charAt(Math.floor(Math.random() * LETTERS.length));
        reel.appendChild(r);
      }
      var last = d.createElement('span');
      last.textContent = ch;
      reel.appendChild(last);
      box.appendChild(reel);
      reels.push({ reel: reel, steps: spins });
    });
    el.classList.add('is-set');
    var tl = gsap.timeline({ delay: delay, onComplete: function () { el.textContent = text; } });
    reels.forEach(function (o, i) {
      tl.fromTo(o.reel, { yPercent: 0 }, {
        yPercent: -100 * o.steps / (o.steps + 1), duration: 0.5 + o.steps * 0.09, ease: 'power3.out'
      }, i * 0.06);
    });
  }

  var boards = $$('[data-board]');
  function startBoards() { boards.forEach(function (el, i) { board(el, 0.05 + i * 0.32); }); }
  if (boards.length) {
    var fontsReady = d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve();
    var started = false;
    var go = function () { if (!started) { started = true; startBoards(); } };
    fontsReady.then(go);
    setTimeout(go, 1200);
  }
  if (gsap) {
    gsap.from('.ht-aside', { opacity: 0, y: reduce ? 0 : 14, duration: 0.9, delay: reduce ? 0.2 : 0.9, ease: 'expo.out' });
    gsap.from('.hero-meta > *', { opacity: 0, duration: 0.8, delay: 0.1, stagger: 0.08 });
  }

  // ---------- Portada: retratos de ejemplo cada 3 segundos ----------

  var stack = $('[data-stack]');
  if (stack && gsap) {
    var items = $$('.stack-item', stack);
    var nameEl = $('[data-stack-name]', stack);
    var capEl = $('[data-stack-cap]', stack);
    var clockBar = $('.stack-clock i', stack);
    var toggle = $('[data-stack-toggle]', stack);
    var idx = 0;
    var clock = null;
    var userPaused = false;
    var inView = true;

    var hydrate = function (item) {
      $$('[data-srcset]', item).forEach(function (s) { s.srcset = s.getAttribute('data-srcset'); s.removeAttribute('data-srcset'); });
      $$('img[data-src]', item).forEach(function (img) { img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); });
    };
    var ready = function (item) {
      var img = $('img', item);
      return !img || (img.complete && img.naturalWidth > 0);
    };

    var swapCaption = function (item) {
      var parts = [nameEl, capEl];
      gsap.to(parts, {
        opacity: 0, y: reduce ? 0 : -8, duration: 0.25, stagger: 0.04, ease: 'power2.in',
        onComplete: function () {
          nameEl.textContent = item.getAttribute('data-name');
          capEl.textContent = item.getAttribute('data-cap');
          gsap.fromTo(parts, { opacity: 0, y: reduce ? 0 : 10 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out' });
        }
      });
    };

    var next = function () {
      var n = (idx + 1) % items.length;
      var cur = items[idx];
      var nxt = items[n];
      hydrate(nxt);
      if (!ready(nxt)) { runClock(); return; }
      nxt.classList.add('is-next');
      var done = function () {
        cur.classList.remove('is-on');
        cur.setAttribute('aria-hidden', 'true');
        nxt.classList.remove('is-next');
        nxt.classList.add('is-on');
        nxt.removeAttribute('aria-hidden');
        gsap.set(nxt, { clearProps: 'clipPath,opacity' });
        idx = n;
        runClock();
      };
      if (reduce) gsap.fromTo(nxt, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power1.inOut', onComplete: done });
      else {
        gsap.fromTo(nxt, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.05, ease: 'expo.inOut', onComplete: done });
        gsap.fromTo($('img', nxt), { scale: 1.14 }, { scale: 1, duration: 1.6, ease: 'expo.out' });
        gsap.to($('img', cur), { scale: 1.05, duration: 1.05, ease: 'expo.inOut', onComplete: function () { gsap.set($('img', cur), { clearProps: 'transform' }); } });
      }
      swapCaption(nxt);
    };

    var runClock = function () {
      if (clock) clock.kill();
      var upcoming = items[(idx + 1) % items.length];
      clock = gsap.fromTo(clockBar, { scaleX: 0 }, {
        scaleX: 1, duration: reduce ? 5 : 3, ease: 'none', onComplete: next,
        onUpdate: function () { if (this.progress() > 0.3) hydrate(upcoming); }
      });
      if (userPaused || !inView) clock.pause();
    };
    var syncPause = function () { if (!clock) return; if (userPaused || !inView) clock.pause(); else clock.resume(); };
    toggle.addEventListener('click', function () {
      userPaused = !userPaused;
      toggle.setAttribute('aria-pressed', String(userPaused));
      toggle.setAttribute('aria-label', toggle.getAttribute(userPaused ? 'data-play' : 'data-pause'));
      syncPause();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; syncPause(); }).observe(stack);
    }
    runClock();
  }

  // ---------- Títulos: líneas que suben al entrar ----------

  function revealTitle(el) {
    if (!gsap || !el) return;
    if (reduce || !window.SplitText) {
      gsap.from(el, { opacity: 0, duration: 0.8, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      return;
    }
    window.SplitText.create(el, {
      type: 'lines', mask: 'lines', autoSplit: true,
      onSplit: function (self) {
        return gsap.from(self.lines, {
          yPercent: 105, duration: 1.1, stagger: 0.09, ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 86%', once: true }
        });
      }
    });
  }
  function revealSoft(el, delay) {
    if (!gsap || !el) return;
    gsap.from(el, {
      opacity: 0, y: reduce ? 0 : 26, duration: reduce ? 0.6 : 1, delay: delay || 0, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true }
    });
  }
  if (gsap) {
    d.fonts && d.fonts.ready.then(function () {
      $$('.fx-title, .how-title, .people-title, .close-title, .faq-title').forEach(revealTitle);
    });
    $$('.fx-lede, .people-side, .ring-head, .close-lede, .hero-lede').forEach(function (el) { revealSoft(el, 0.1); });
    $$('.how-text, .faq-list details').forEach(function (el, i) { revealSoft(el, (i % 7) * 0.04); });
  }

  // ---------- Calendario: dos filas que corren y aceleran con el scroll ----------

  var fx = $('[data-fx]');
  if (fx && gsap && !reduce) {
    var trackA = $('.fx-a .fx-track', fx);
    var trackB = $('.fx-b .fx-track', fx);
    var loops = [
      gsap.fromTo(trackA, { xPercent: 0 }, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 }),
      gsap.fromTo(trackB, { xPercent: -50 }, { xPercent: 0, duration: 44, ease: 'none', repeat: -1 })
    ];
    var speed = 1;
    var target = 1;
    var direction = 1;
    var fxPaused = false;
    var fxVisible = false;
    ST.create({
      trigger: fx, start: 'top bottom', end: 'bottom top',
      onToggle: function (self) { fxVisible = self.isActive; },
      onUpdate: function (self) {
        var v = self.getVelocity();
        if (Math.abs(v) > 20) direction = v > 0 ? 1 : -1;
        target = direction * (1 + Math.min(Math.abs(v) / 220, 7));
      }
    });
    gsap.ticker.add(function () {
      if (fxPaused || !fxVisible) return;
      target += (direction - target) * 0.04;
      speed += (target - speed) * 0.12;
      loops.forEach(function (t) { t.timeScale(speed); });
    });
    var fxToggle = $('[data-fx-toggle]');
    fxToggle.addEventListener('click', function () {
      fxPaused = !fxPaused;
      fxToggle.setAttribute('aria-pressed', String(fxPaused));
      fxToggle.textContent = fxToggle.getAttribute(fxPaused ? 'data-play' : 'data-pause');
      loops.forEach(function (t) { if (fxPaused) t.pause(); else t.resume(); });
    });
    gsap.from('.fx-row', { xPercent: function (i) { return i ? -12 : 12; }, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: fx, start: 'top 85%', once: true } });
  }

  // ---------- Cómo funciona: número fijo que rueda y fotos que se mueven ----------

  var reel = $('[data-how-reel]');
  var list = $('[data-how-list]');
  var marker = $('[data-how-marker]');
  var steps = $$('.how-step');
  var active = -1;
  function setStep(i) {
    if (i === active || !reel) return;
    active = i;
    var lis = $$('li', list);
    lis.forEach(function (li, k) { li.classList.toggle('is-on', k === i); });
    if (reduce) {
      gsap.to(reel, { opacity: 0, duration: 0.2, onComplete: function () { gsap.set(reel, { yPercent: -100 * i / steps.length }); gsap.to(reel, { opacity: 1, duration: 0.35 }); } });
    } else {
      gsap.to(reel, { yPercent: -100 * i / steps.length, duration: 0.9, ease: 'expo.inOut', overwrite: true });
    }
    if (marker && lis[i]) {
      var Flip = window.Flip;
      var state = Flip && !reduce ? Flip.getState(marker) : null;
      lis[i].appendChild(marker);
      if (state) Flip.from(state, { duration: 0.7, ease: 'expo.inOut' });
    }
  }
  if (steps.length && gsap) {
    var mmHow = gsap.matchMedia();
    mmHow.add('(min-width: 861px)', function () {
      steps.forEach(function (step, i) {
        ST.create({ trigger: step, start: 'top 55%', end: 'bottom 55%', onToggle: function (self) { if (self.isActive) setStep(i); } });
      });
      setStep(0);
    });
    steps.forEach(function (step) {
      var photo = $('.how-photo', step);
      var phone = $('.how-phone', step);
      if (reduce) { revealSoft(photo); revealSoft(phone, 0.1); return; }
      gsap.fromTo(photo, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut', scrollTrigger: { trigger: step, start: 'top 75%', once: true } });
      gsap.from(phone, { yPercent: 18, opacity: 0, duration: 1.3, delay: 0.15, ease: 'expo.out', scrollTrigger: { trigger: step, start: 'top 75%', once: true } });
      gsap.fromTo(photo, { yPercent: 6 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: step, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  // ---------- La plantilla: mazo que se arrastra; la tarjeta del centro se enciende ----------

  var deck = $('[data-deck]');
  var cards = deck ? $$('.card', deck) : [];
  var center = null;
  function deckUpdate() {
    if (!deck) return;
    var r = deck.getBoundingClientRect();
    var mid = r.left + r.width / 2;
    var best = null;
    var bestD = Infinity;
    cards.forEach(function (c) {
      var b = c.getBoundingClientRect();
      var off = (b.left + b.width / 2 - mid) / b.width;
      var a = Math.abs(off);
      if (a < bestD) { bestD = a; best = c; }
      if (gsap && !reduce) {
        gsap.set(c, {
          rotation: Math.max(-7, Math.min(7, off * 3.2)),
          y: Math.min(a * 22, 46),
          scale: 1 - Math.min(a * 0.05, 0.1)
        });
      }
    });
    if (best !== center) {
      if (center) center.classList.remove('is-center');
      center = best;
      if (center) center.classList.add('is-center');
    }
  }
  if (deck) {
    var ticking = false;
    deck.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; deckUpdate(); });
    }, { passive: true });
    window.addEventListener('resize', deckUpdate);
    // Empieza con la segunda tarjeta en el centro, para que haya perfiles a los dos lados.
    if (cards[1]) deck.scrollLeft = cards[1].offsetLeft + cards[1].offsetWidth / 2 - deck.clientWidth / 2;
    deckUpdate();
    var step = function (dir) {
      var c = cards[0];
      var gap = parseFloat(getComputedStyle(deck).columnGap) || 20;
      deck.scrollBy({ left: dir * (c.getBoundingClientRect().width + gap), behavior: reduce ? 'auto' : 'smooth' });
    };
    $('[data-deck-prev]').addEventListener('click', function () { step(-1); });
    $('[data-deck-next]').addEventListener('click', function () { step(1); });
    if (gsap) gsap.from(cards, { y: reduce ? 0 : 80, opacity: 0, duration: 1.2, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: deck, start: 'top 85%', once: true }, onComplete: deckUpdate });
  }

  // Arrastre con ratón. Draggable mueve un elemento fantasma y aquí se traduce a scroll horizontal: así el mazo
  // sigue siendo un scroll nativo (táctil, teclado, lector de pantalla) y Draggable no toca su HTML.
  function initDrag() {
    if (!deck || !window.Draggable || !finePointer.matches) return;
    var proxy = d.createElement('div');
    var start = 0;
    var max = function () { return deck.scrollWidth - deck.clientWidth; };
    var snaps = function () {
      return cards.map(function (c) { return Math.max(0, Math.min(max(), c.offsetLeft + c.offsetWidth / 2 - deck.clientWidth / 2)); });
    };
    var apply = function (x) { deck.scrollLeft = Math.max(0, Math.min(max(), start - x)); };
    window.Draggable.create(proxy, {
      trigger: deck, type: 'x', inertia: !!window.InertiaPlugin, allowContextMenu: true, minimumMovement: 6,
      onPress: function () {
        gsap.killTweensOf(proxy);
        start = deck.scrollLeft;
        gsap.set(proxy, { x: 0 });
        this.update();
      },
      onDragStart: function () { deck.classList.add('is-dragging'); },
      onDrag: function () { apply(this.x); },
      onThrowUpdate: function () { apply(this.x); },
      snap: function (x) {
        var pos = start - x;
        var best = snaps().reduce(function (p, c) { return Math.abs(c - pos) < Math.abs(p - pos) ? c : p; });
        return start - best;
      },
      onRelease: function () { if (!this.isThrowing) deck.classList.remove('is-dragging'); },
      onThrowComplete: function () { deck.classList.remove('is-dragging'); }
    });
  }

  // ---------- Deportes: anillo de fotos alrededor de "Madrid" ----------

  var ring = $('.ring');
  if (ring && gsap) {
    var mmRing = gsap.matchMedia();
    mmRing.add('(min-width: 861px) and (prefers-reduced-motion: no-preference)', function () {
      ring.classList.add('is-3d');
      var stage = $('.ring-stage', ring);
      var ringCards = $$('.ring-card', ring);
      var tints = ringCards.map(function (c) { return $('.tint', c); });
      var spin = 0;
      var layout = function () {
        var w = stage.clientWidth;
        var h = stage.clientHeight;
        var rx = Math.min(w * 0.43, 820);
        var ry = h * 0.35;
        ringCards.forEach(function (c, i) {
          var a = (i / ringCards.length) * Math.PI * 2 + spin;
          var depth = Math.cos(a);
          gsap.set(c, {
            xPercent: -50, yPercent: -50, x: Math.sin(a) * rx, y: depth * ry,
            scale: 0.66 + 0.34 * (depth + 1) / 2, rotation: Math.sin(a) * -9 + (i % 2 ? 2 : -2),
            zIndex: depth > -0.1 ? 3 : 1
          });
          tints[i].style.opacity = Math.max(0, Math.min(0.94, (0.35 - depth) * 0.8)).toFixed(3);
        });
      };
      layout();
      var trig = ST.create({
        trigger: stage, start: 'top top', end: '+=150%', pin: stage, scrub: 0.8,
        onUpdate: function (self) { spin = -self.progress * Math.PI * 1.15; layout(); },
        onRefresh: layout
      });
      gsap.from(ringCards, { opacity: 0, scale: 0.5, duration: 1.2, stagger: 0.04, ease: 'expo.out', scrollTrigger: { trigger: ring, start: 'top 70%', once: true } });
      return function () {
        trig.kill();
        ring.classList.remove('is-3d');
        gsap.set(ringCards, { clearProps: 'all' });
        tints.forEach(function (t) { t.style.opacity = ''; });
      };
    });
  }

  // ---------- Cierre: la pelota bota una vez al apuntarte ----------

  function bounce(el, shadow) {
    if (!el || !gsap) return;
    if (reduce) { gsap.fromTo(el, { opacity: 0.3 }, { opacity: 1, duration: 0.8 }); return; }
    var tl = gsap.timeline();
    tl.to(el, { y: -150, rotation: 200, duration: 0.42, ease: 'power2.out' })
      .to(el, { y: 0, rotation: 360, duration: 0.38, ease: 'power2.in' })
      .to(el, { scaleY: 0.8, scaleX: 1.14, transformOrigin: '50% 100%', duration: 0.07, yoyo: true, repeat: 1, ease: 'power1.out' })
      .to(el, { y: -34, duration: 0.2, ease: 'power2.out' })
      .to(el, { y: 0, duration: 0.2, ease: 'power2.in' })
      .set(el, { rotation: 0 });
    if (shadow) {
      gsap.timeline()
        .to(shadow, { scaleX: 0.45, opacity: 0.4, duration: 0.42, ease: 'power2.out' })
        .to(shadow, { scaleX: 1, opacity: 1, duration: 0.38, ease: 'power2.in' })
        .to(shadow, { scaleX: 0.85, duration: 0.2, delay: 0.14 }).to(shadow, { scaleX: 1, duration: 0.2 });
    }
  }
  var ballBox = $('[data-ball]');
  d.addEventListener('waitlist:sent', function (e) {
    var inClose = e.target.closest && e.target.closest('.close');
    if (inClose && ballBox) bounce($('svg', ballBox), $('.close-shadow', ballBox));
    else bounce($('.hd .wm-ball'));
  });

  // ---------- Plugins que pueden esperar: Flip, Draggable e Inertia ----------

  function load(src) {
    return new Promise(function (resolve, reject) {
      var s = d.createElement('script');
      s.src = src; s.async = true; s.onload = resolve; s.onerror = reject;
      d.head.appendChild(s);
    });
  }
  function extras() {
    if (!gsap) return;
    var base = '/assets/vendor/';
    Promise.all([load(base + 'Flip.min.js'), load(base + 'Draggable.min.js'), load(base + 'InertiaPlugin.min.js')])
      .then(function () {
        gsap.registerPlugin(window.Flip, window.Draggable, window.InertiaPlugin);
        initDrag();
      })
      .catch(function () { /* sin arrastre con ratón: el mazo sigue con scroll y flechas */ });
  }
  if (d.readyState === 'complete') setTimeout(extras, 400);
  else window.addEventListener('load', function () { setTimeout(extras, 400); });

  // Las fuentes y las fotos cambian alturas: ScrollTrigger recalcula al final.
  window.addEventListener('load', function () { if (ST) ST.refresh(); });
})();
