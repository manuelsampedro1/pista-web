/* Pista, portada "Busco pareja". El mazo de perfiles ocupa la pantalla del móvil y se desliza con el dedo (GSAP
   Draggable con inercia): a la derecha es like, con corazones; a la izquierda pasas y la tarjeta sale volando. El
   aspa y el corazón van en cada tarjeta, como en la app, y tocar la foto enseña la siguiente. A los dos likes,
   "Es un match" y de ahí a la hoja para apuntarse. Además: titular que cambia una vez y se queda en "de verdad",
   un chat que se escribe solo al bajar (del like a la cita), cabecera, barra fija con el botón, apariciones al
   bajar, carrusel de citas y contador.
   Con "reducir movimiento" se sigue pudiendo deslizar, pero todo lo demás pasa a fundidos y el chat sale ya
   terminado. Sin GSAP, los botones y el teclado siguen funcionando. */
(function () {
  'use strict';
  var d = document;
  var html = d.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // GSAP, Draggable e Inertia se piden cuando la página ya ha cargado (no compiten con la foto de la portada).
  var gsap = window.gsap;
  var Draggable = window.Draggable;
  var vendor = null;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = src;
      sc.async = false;
      sc.onload = resolve;
      sc.onerror = reject;
      document.head.appendChild(sc);
    });
  }
  function loadVendor() {
    if (vendor) return vendor;
    vendor = Promise.all(['/assets/vendor/gsap.min.js', '/assets/vendor/Draggable.min.js', '/assets/vendor/InertiaPlugin.min.js'].map(loadScript))
      .then(function () {
        gsap = window.gsap;
        Draggable = window.Draggable;
        gsap.registerPlugin(Draggable, window.InertiaPlugin);
        document.dispatchEvent(new CustomEvent('pista:vendor'));
      }, function () { /* sin GSAP los botones siguen funcionando */ });
    return vendor;
  }
  var whenIdle = function (fn) { if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: 1200 }); else setTimeout(fn, 300); };
  var pageLoaded = document.readyState === 'complete';
  window.addEventListener('load', function () { pageLoaded = true; });
  var afterLoad = function () {
    $$('.count-num, .pts').forEach(function (el) { el.classList.add('num-font'); });
    loadVendor();
  };
  if (document.readyState === 'complete') whenIdle(afterLoad);
  else window.addEventListener('load', function () { whenIdle(afterLoad); });

  // Fotos diferidas: se piden al acercarse (las del carrusel, todas a la vez).
  function hydrate(pic) {
    if (!pic || !pic.hasAttribute('data-lazy')) return;
    Array.prototype.forEach.call(pic.querySelectorAll('source[data-srcset]'), function (s) { s.srcset = s.getAttribute('data-srcset'); s.removeAttribute('data-srcset'); });
    var img = pic.querySelector('img[data-src]');
    if (img) { img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); }
    pic.removeAttribute('data-lazy');
  }
  (function () {
    var lazy = Array.prototype.slice.call(document.querySelectorAll('picture[data-lazy]')).filter(function (p) { return !p.closest('[data-stack]'); });
    if (!('IntersectionObserver' in window)) { lazy.forEach(hydrate); return; }
    var lio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var group = e.target.closest('[data-rail]');
        if (group) Array.prototype.forEach.call(group.querySelectorAll('picture[data-lazy]'), function (p) { hydrate(p); lio.unobserve(p); });
        else { hydrate(e.target); lio.unobserve(e.target); }
      });
    }, { rootMargin: '400px 0px' });
    lazy.forEach(function (p) { lio.observe(p); });
  })();
  var $ = function (sel, root) { return (root || d).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); };
  var fill = function (tpl, data) { return String(tpl).replace(/\{(\w+)\}/g, function (_, k) { return data[k] != null ? data[k] : ''; }); };
  var haptic = function (ms) { if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* nada */ } } };

  // ---------- Cabecera ----------

  var header = $('[data-header]');
  var hero = $('[data-hero]');
  function onScroll() {
    if (header) header.classList.toggle('is-solid', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Apariciones ----------

  if ('IntersectionObserver' in window) {
    // La clase va en cada elemento y no en <html>: cambiar <html> obliga a recalcular el estilo de toda la página.
    $$('[data-reveal]').forEach(function (el) { el.classList.add('rv'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: .12 });
    $$('[data-reveal]').forEach(function (el) { io.observe(el); });
  }

  // ---------- Titular: cambia una vez y se queda en el último ----------

  var rot = $('[data-rot]');
  if (rot) {
    var words = $$('.h1-w', rot);
    var wi = 0, paused = false, visible = true, timer = null;
    var step = reduce ? 2600 : 1700;
    var next = function () {
      timer = null;
      if (wi >= words.length - 1) return;
      if (paused || !visible) { timer = setTimeout(next, 400); return; }
      var cur = words[wi];
      wi += 1;
      cur.classList.remove('is-on');
      cur.classList.add('is-out');
      words[wi].classList.remove('is-out');
      words[wi].classList.add('is-on');
      setTimeout(function () { cur.classList.remove('is-out'); }, 800);
      if (wi < words.length - 1) timer = setTimeout(next, step);
    };
    var h1 = rot.closest('h1');
    ['pointerenter', 'touchstart', 'focusin'].forEach(function (ev) { h1.addEventListener(ev, function () { paused = true; }, { passive: true }); });
    ['pointerleave', 'touchend', 'focusout'].forEach(function (ev) { h1.addEventListener(ev, function () { paused = false; }, { passive: true }); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(h1);
    }
    setTimeout(next, reduce ? 1800 : 2300);
  }

  // ---------- Mazo ----------

  var stack = $('[data-stack]');
  if (stack) {
    var cards = $$('[data-card]', stack);
    var ui = JSON.parse(stack.getAttribute('data-ui') || '{}');
    var hint = $('[data-hint]');
    var live = $('[data-stack-live]');
    var end = $('[data-stack-end]', stack);
    var index = 0, likes = 0, matched = false, busy = false, dragger = null, touched = false, moved = false;

    var top = function () { return cards[index]; };
    var nameOf = function (card) { return card ? card.getAttribute('data-name') : ''; };
    var width = function () { return stack.getBoundingClientRect().width || 360; };

    function setClasses() {
      cards.forEach(function (c, i) {
        var dpt = i - index;
        c.classList.toggle('is-top', dpt === 0);
        c.classList.toggle('is-next', dpt === 1);
        c.classList.toggle('is-third', dpt === 2);
        c.classList.toggle('is-back', dpt > 2);
        c.classList.toggle('is-gone', dpt < 0);
        var hidden = dpt !== 0;
        if (hidden) { c.setAttribute('aria-hidden', 'true'); c.setAttribute('inert', ''); }
        else { c.removeAttribute('aria-hidden'); c.removeAttribute('inert'); }
      });
      stack.style.setProperty('--p', 0);
      var card = top();
      var done = !card;
      end.hidden = !done;
      if (done) { end.classList.add('is-in'); }
      if (card) {
        // Las fotos de la tarjeta que viene (y las demás de esta) se piden ya, salvo al cargar la página:
        // entonces esperan a que termine para no competir con la primera foto.
        var nxt = cards[index + 1];
        var warm = function () {
          $$('picture[data-lazy]', card).forEach(hydrate);
          if (nxt) $$('picture[data-lazy]', nxt).forEach(hydrate);
        };
        if (pageLoaded) warm(); else window.addEventListener('load', function () { whenIdle(warm); }, { once: true });
      }
      bindDrag();
    }

    function stamps(card, x) {
      var w = width();
      var k = Math.max(-1, Math.min(1, x / (w * .38)));
      var like = $('.stamp-like', card), pass = $('.stamp-pass', card);
      if (like) { like.style.opacity = Math.max(0, k); like.style.transform = 'scale(' + (.5 + .5 * Math.max(0, k)) + ')'; }
      if (pass) { pass.style.opacity = Math.max(0, -k); pass.style.transform = 'scale(' + (.5 + .5 * Math.max(0, -k)) + ')'; }
      stack.style.setProperty('--p', Math.min(1, Math.abs(x) / (w * .6)).toFixed(3));
    }

    function firstTouch() {
      if (touched) return;
      touched = true;
      if (hint) hint.classList.add('is-off');
    }

    function announce(text) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = text; }, 40); } }

    function done(card, dir) {
      var name = nameOf(card);
      var act = d.activeElement;
      var hadFocus = act && card.contains(act) ? (act.hasAttribute('data-like') ? 'like' : 'pass') : null;
      index += 1;
      busy = false;
      stack.classList.remove('is-dragging');
      setClasses();
      announce(fill(dir > 0 ? ui.liked : ui.passed, { name: name }));
      if (dir > 0) {
        likes += 1;
        if (likes >= 2 && !matched) { matched = true; setTimeout(function () { openMatch(card); }, reduce ? 150 : 380); }
      }
      // Si el foco estaba en los botones de la tarjeta que se ha ido, pasa a los de la siguiente (o al final del mazo).
      if (hadFocus) {
        var next = top();
        var target = next ? $(hadFocus === 'like' ? '[data-like]' : '[data-pass]', next) : $('button', end);
        if (target) target.focus({ preventScroll: true });
      }
    }

    function fly(dir, fromButton) {
      var card = top();
      if (!card || busy) return;
      busy = true;
      firstTouch();
      if (dragger) { dragger.kill(); dragger = null; }
      if (dir > 0) {
        haptic(12);
        var origin = fromButton && $('[data-like]', card);
        var rect = (origin || card).getBoundingClientRect();
        heartBurst(rect.left + rect.width / 2, rect.top + rect.height * (fromButton ? .5 : .35));
      }
      if (!gsap || reduce) {
        stamps(card, dir * width());
        card.style.transition = 'opacity .3s ease';
        card.style.opacity = '0';
        setTimeout(function () { card.style.transition = ''; card.style.opacity = ''; resetCard(card); done(card, dir); }, 300);
        return;
      }
      var w = width();
      var x = gsap.getProperty(card, 'x') || 0;
      if (fromButton) {
        stamps(card, dir * w * .5);
        gsap.to(card, { x: dir * w * .08, rotation: dir * 3, duration: .12, ease: 'power1.out' });
      }
      gsap.to(card, {
        x: dir * (window.innerWidth + w), y: fromButton ? -40 : '+=30', rotation: dir * 26,
        duration: fromButton ? .55 : Math.max(.3, .55 - Math.abs(x) / w * .25), delay: fromButton ? .1 : 0, ease: 'power2.in',
        onUpdate: function () { stamps(card, gsap.getProperty(card, 'x')); },
        onComplete: function () { resetCard(card); done(card, dir); }
      });
    }

    function resetCard(card) {
      if (gsap) gsap.set(card, { clearProps: 'transform' });
      card.style.transform = '';
      $$('.stamp', card).forEach(function (s) { s.style.opacity = ''; s.style.transform = ''; });
    }

    function nextPhoto(card, back) {
      var photos = $$('.card-photo', card);
      if (photos.length < 2) return false;
      var cur = photos.findIndex(function (p) { return p.classList.contains('is-on'); });
      var nx = Math.max(0, Math.min(photos.length - 1, cur + (back ? -1 : 1)));
      if (nx === cur) { if (gsap && !reduce) gsap.fromTo(card, { x: back ? 8 : -8 }, { x: 0, duration: .4, ease: 'elastic.out(1, .4)' }); return true; }
      hydrate(photos[nx]);
      photos[cur].classList.remove('is-on');
      photos[nx].classList.add('is-on');
      $$('.card-bars i', card).forEach(function (b, i) { b.classList.toggle('is-on', i === nx); });
      return true;
    }

    function bindDrag() {
      if (dragger) { dragger.kill(); dragger = null; }
      var card = top();
      if (!card || !gsap || !Draggable) return;
      var w = width();
      dragger = Draggable.create(card, {
        type: 'x',
        inertia: !reduce && !!window.InertiaPlugin,
        allowNativeTouchScrolling: true,
        minimumMovement: 6,
        zIndexBoost: false,
        onPress: function () { firstTouch(); moved = false; },
        onDragStart: function () { moved = true; stack.classList.add('is-dragging'); },
        onDrag: function () {
          var x = this.x;
          gsap.set(card, { rotation: reduce ? 0 : Math.max(-16, Math.min(16, x / w * 22)) });
          stamps(card, x);
        },
        onThrowUpdate: function () {
          var x = this.x;
          gsap.set(card, { rotation: Math.max(-16, Math.min(16, x / w * 22)) });
          stamps(card, x);
        },
        snap: {
          x: function (endX) {
            var x0 = this.x;
            var out = Math.abs(endX) > w * .42 || Math.abs(x0) > w * .32;
            return out ? (endX > 0 || (endX === 0 && x0 > 0) ? 1 : -1) * (window.innerWidth + w) : 0;
          }
        },
        onRelease: function () {
          var x = this.x;
          if (!this.tween || reduce || !window.InertiaPlugin) {
            if (Math.abs(x) > w * .32) { fly(x > 0 ? 1 : -1); return; }
            gsap.to(card, { x: 0, rotation: 0, duration: .5, ease: 'back.out(2)', onUpdate: function () { stamps(card, gsap.getProperty(card, 'x')); }, onComplete: function () { stack.classList.remove('is-dragging'); } });
          }
        },
        onThrowComplete: function () {
          var x = this.x;
          if (Math.abs(x) > w) {
            var dir = x > 0 ? 1 : -1;
            if (dir > 0) { haptic(12); var r = card.getBoundingClientRect(); heartBurst(Math.min(window.innerWidth - 40, Math.max(40, r.left + r.width / 2)), r.top + r.height * .3); }
            resetCard(card);
            done(card, dir);
          } else {
            gsap.to(card, { rotation: 0, duration: .3 });
            stamps(card, 0);
            stack.classList.remove('is-dragging');
          }
        },
        onClick: function (e) {
          if (e.target && e.target.closest && e.target.closest('button')) return;
          var r = card.getBoundingClientRect();
          var cx = e.clientX != null ? e.clientX : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : r.left + r.width / 2);
          nextPhoto(card, cx < r.left + r.width * .35);
        }
      })[0];
    }

    document.addEventListener('pista:vendor', function () {
      bindDrag();
      // Una vez, cuando ya se puede: un pequeño empujón para que se note que se desliza.
      if (reduce) return;
      setTimeout(function () {
        var card = top();
        if (!card || touched || busy) return;
        // Solo si se ve: si ya has bajado, no se mueve nada fuera de pantalla.
        var sr = stack.getBoundingClientRect();
        if (sr.bottom < 0 || sr.top > window.innerHeight) return;
        gsap.timeline()
          .to(card, { x: -26, rotation: -3, duration: .38, ease: 'power2.out', onUpdate: function () { stamps(card, gsap.getProperty(card, 'x')); } })
          .to(card, { x: 22, rotation: 2.5, duration: .5, ease: 'power2.inOut', onUpdate: function () { stamps(card, gsap.getProperty(card, 'x')); } })
          .to(card, { x: 0, rotation: 0, duration: .6, ease: 'back.out(2.2)', onUpdate: function () { stamps(card, gsap.getProperty(card, 'x')); } });
      }, 600);
    });
    stack.addEventListener('pointerdown', function () { loadVendor(); }, { passive: true });
    cards.forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        // Con Draggable activo, el toque lo recoge su onClick.
        if (dragger || moved) { moved = false; return; }
        var r = card.getBoundingClientRect();
        nextPhoto(card, e.clientX < r.left + r.width * .35);
      });
    });
    stack.addEventListener('click', function (e) {
      var like = e.target.closest('[data-like]'), pass = e.target.closest('[data-pass]');
      if (!like && !pass) return;
      e.stopPropagation();
      fly(like ? 1 : -1, true);
    });
    // Con el foco en el mazo o en sus botones, las flechas también eligen.
    (stack.closest('.hero-stage') || stack).addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('.stack-end')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); fly(1, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); fly(-1, true); }
    });
    var again = $('[data-stack-again]', stack);
    if (again) again.addEventListener('click', function () {
      index = 0;
      cards.forEach(resetCard);
      setClasses();
      var first = $('[data-like]', top());
      if (first) first.focus({ preventScroll: true });
    });

    setClasses();

  }

  function heartBurst(x, y) {
    if (reduce || !window.PistaWaitlist) return;
    var b = d.createElement('div');
    b.className = 'burst';
    b.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    d.body.appendChild(b);
    window.PistaWaitlist.burst(b, 12, 120);
    setTimeout(function () { b.remove(); }, 1600);
  }

  // ---------- Match ----------

  var match = $('[data-match]');
  function openMatch(card) {
    if (!match) return;
    var img = card && card.querySelector('.card-photo.is-on img, .card-photo img');
    var target = $('[data-match-photo]', match);
    if (img && target) { target.src = img.currentSrc || img.src; }
    haptic([10, 40, 18]);
    match.showModal();
    var pair = $('.match-pair', match);
    if (gsap && !reduce) {
      var them = $('.mc-them', match), you = $('.mc-you', match);
      gsap.timeline()
        .fromTo(them, { x: -220, rotation: -24, opacity: 0 }, { x: 0, rotation: 0, opacity: 1, duration: .7, ease: 'back.out(1.5)' }, 0)
        .fromTo(you, { x: 220, rotation: 24, opacity: 0 }, { x: 0, rotation: 0, opacity: 1, duration: .7, ease: 'back.out(1.5)' }, 0)
        .fromTo([$('.match-h', match), $('.match-p', match)], { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .6, stagger: .08, ease: 'power3.out' }, .35)
        .add(function () { if (window.PistaWaitlist) window.PistaWaitlist.burst($('[data-match-burst]', match), 18, 170); }, .45);
    } else if (pair) {
      pair.style.opacity = '1';
    }
    var first = $('[data-open-sheet]', match);
    if (first) first.focus({ preventScroll: true });
  }
  if (match) {
    $('[data-match-close]', match).addEventListener('click', function () { match.close(); });
    match.addEventListener('close', function () { var card = $('[data-card].is-top'); var like = card && $('[data-like]', card); if (like) like.focus({ preventScroll: true }); });
  }

  // ---------- Cómo funciona: el chat se escribe solo al bajar ----------

  var talk = $('[data-talk]');
  if (talk) {
    var dateCard = $('.date-card', talk);
    if (reduce) {
      // Con "reducir movimiento" se ve la conversación terminada, sin escribir ni animar nada.
      if (dateCard) dateCard.classList.add('is-ok');
    } else {
      talk.classList.add('is-live');
      var bits = $$('[data-at]', talk);
      var typings = $$('.typing', talk);
      var steps = $$('[data-talk-steps] li', talk);
      var stepAt = [0, .18, .54, .8];
      var ticking = false;
      var paint = function () {
        ticking = false;
        var r = talk.getBoundingClientRect();
        var total = Math.max(1, talk.offsetHeight - window.innerHeight);
        var p = Math.max(0, Math.min(1, -r.top / total));
        bits.forEach(function (el) { el.classList.toggle('on', p >= parseFloat(el.getAttribute('data-at'))); });
        typings.forEach(function (el) {
          el.classList.toggle('on', p >= parseFloat(el.getAttribute('data-from')) && p < parseFloat(el.getAttribute('data-to')));
        });
        if (dateCard) dateCard.classList.toggle('is-ok', p >= parseFloat(dateCard.getAttribute('data-ok-at')));
        var active = 0;
        stepAt.forEach(function (v, i) { if (p >= v) active = i; });
        steps.forEach(function (li, i) { li.classList.toggle('is-on', i === active); });
      };
      window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
      window.addEventListener('resize', paint);
      paint();
    }
  }

  // ---------- Barra fija con el botón ----------

  var dock = $('[data-dock]');
  if (dock) {
    d.body.classList.add('has-dock');
    var hideFor = { sheet: false, final: false };
    var sync = function () { dock.classList.toggle('is-hidden', hideFor.sheet || hideFor.final); };
    d.addEventListener('waitlist:sheet', function (e) { hideFor.sheet = e.detail.open; sync(); });
    var finalSec = $('.final'), foot = $('.ft');
    if ('IntersectionObserver' in window) {
      var seen = new Set();
      var dio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); });
        hideFor.final = seen.size > 0;
        sync();
      }, { threshold: .15 });
      [finalSec, foot].forEach(function (el) { if (el) dio.observe(el); });
    }
  }

  // ---------- Carrusel de citas ----------

  var rail = $('[data-rail]');
  if (rail) {
    var bar = $('[data-rail-bar]');
    var prev = $('[data-rail-prev]'), nextB = $('[data-rail-next]');
    var item = function () { var li = $('.date', rail); return li ? li.getBoundingClientRect().width + 14 : 300; };
    var update = function () {
      var max = rail.scrollWidth - rail.clientWidth;
      var k = max > 0 ? rail.scrollLeft / max : 0;
      var share = rail.clientWidth / rail.scrollWidth;
      if (bar) { bar.style.width = (share * 100).toFixed(1) + '%'; bar.style.transform = 'translateX(' + (k * (1 / share - 1) * 100).toFixed(1) + '%)'; }
      if (prev) prev.disabled = rail.scrollLeft < 8;
      if (nextB) nextB.disabled = rail.scrollLeft > max - 8;
    };
    rail.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    var go = function (dir) { rail.scrollBy({ left: dir * item(), behavior: reduce ? 'auto' : 'smooth' }); };
    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (nextB) nextB.addEventListener('click', function () { go(1); });
  }

  // ---------- Contador grande: cuenta al verlo ----------

  var big = $('[data-count-big]');
  if (big) {
    var nf = new Intl.NumberFormat(html.lang === 'en' ? 'en-GB' : 'es-ES');
    var counted = false, inView = false;
    var run = function () {
      var to = parseInt(big.getAttribute('data-target') || String(big.textContent).replace(/\D/g, ''), 10);
      if (!to || !inView) return;
      if (reduce) { big.textContent = nf.format(to); return; }
      var from = counted ? parseInt(String(big.textContent).replace(/\D/g, ''), 10) || 0 : Math.max(0, to - 180);
      counted = true;
      var start = performance.now();
      (function step(now) {
        var k = Math.min(1, (now - start) / 1600);
        big.textContent = nf.format(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 4))));
        if (k < 1) requestAnimationFrame(step);
      })(start);
    };
    big.addEventListener('count:set', run);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting && !inView) { inView = true; run(); } });
      }, { threshold: .4 }).observe(big);
    }
  }

  // ---------- Quien te invita: el titular de la portada también lo dice ----------

  d.addEventListener('waitlist:referrer', function (e) {
    if (!e.detail.name || !hero) return;
    var ref = $('[data-hero-ref]', hero);
    if (ref) ref.hidden = false;
  });
})();
