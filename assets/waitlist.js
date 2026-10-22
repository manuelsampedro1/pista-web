/* Pista, lista de espera. Formulario de tres campos (nombre, correo y ciudad) en la portada y en /lista/, hoja
   para apuntarse (<dialog> nativo), celebración con el número, pedir invitación (WhatsApp, story de Instagram,
   compartir y copiar), campo para entrar con un código, paso opcional de perfil, página privada de estado
   (?s=TOKEN), confirmación (?confirmar=TOKEN, ?confirm=TOKEN), enlace de quien te recomienda Pista (?r=CODIGO)
   y contador en directo. La lista es solo por invitación: compartir no da puestos.
   Sin cookies ni almacenamiento: el token privado solo vive en la URL de la página de estado.

   Modo de prueba: con ?mock=1, y siempre en localhost (salvo ?live=1), las llamadas que escriben no tocan el
   servidor: las contesta /assets/waitlist-mock.js. Así ninguna prueba cuenta en la lista de verdad. */
(function () {
  'use strict';
  var d = document;
  var html = d.documentElement;
  var stringsEl = d.getElementById('wl-strings');
  if (!stringsEl) return;
  var T = JSON.parse(stringsEl.textContent);
  var lang = T.lang;
  var params = new URLSearchParams(location.search);
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var nf = new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-GB');
  var $ = function (sel, root) { return (root || d).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); };
  var fill = function (tpl, data) { return String(tpl).replace(/\{(\w+)\}/g, function (_, k) { return data[k] != null ? data[k] : ''; }); };

  var host = location.hostname;
  var local = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || /\.localhost$/.test(host);
  var MOCK = params.has('mock') || (local && !params.has('live'));
  var READ_ONLY = { waitlist_counts: 1 };

  var apiReady = MOCK ? new Promise(function (resolve, reject) {
    var s = d.createElement('script');
    s.src = '/assets/waitlist-mock.js';
    s.onload = function () { window.PistaMockAPI ? resolve(window.PistaMockAPI) : reject(new Error('mock')); };
    s.onerror = function () { reject(new Error('mock')); };
    d.head.appendChild(s);
  }) : Promise.resolve(window.PistaAPI);

  function rpc(name, payload) {
    return apiReady.then(function (api) {
      // En modo de prueba solo el contador (de solo lectura) llega al servidor de verdad.
      if (MOCK && !READ_ONLY[name] && api === window.PistaAPI) throw { code: 'MOCK_MISSING' };
      return api.rpc(name, payload);
    }, function () { throw { code: 'MOCK_MISSING' }; });
  }

  // ---------- Utilidades ----------

  var toastTimer;
  function toast(text) {
    var el = $('[data-toast]');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  function countUp(el, to, from, ms) {
    if (!el) return;
    from = from == null ? 0 : from;
    if (reduce || from === to) { el.textContent = nf.format(to); return; }
    var start = performance.now();
    ms = ms || 1200;
    (function step(now) {
      var k = Math.min(1, (now - start) / ms);
      var eased = 1 - Math.pow(1 - k, 4);
      el.textContent = nf.format(Math.round(from + (to - from) * eased));
      if (k < 1) requestAnimationFrame(step);
    })(start);
  }

  var HEART = '<svg viewBox="0 0 24 24"><path d="M12 20.4s-7.6-4.5-9.2-9.2C1.6 7.7 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.2 4.4 6.7-1.6 4.7-9.2 9.2-9.2 9.2Z" fill="currentColor"/></svg>';
  var BALLDOT = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>';
  // Corazones (y alguna pelota) que salen de un punto. Lo usa también la portada.
  function burst(container, n, spread) {
    if (reduce || !container || !window.gsap) return;
    var gsap = window.gsap;
    for (var i = 0; i < n; i++) {
      var p = d.createElement('i');
      var ball = i % 5 === 4;
      if (ball) p.className = 'b';
      p.innerHTML = ball ? BALLDOT : HEART;
      container.appendChild(p);
      var a = (Math.PI * 2 * i) / n + (Math.random() - .5) * .6;
      var r = spread * (.55 + Math.random() * .6);
      gsap.fromTo(p, { x: 0, y: 0, scale: .2, rotation: (Math.random() - .5) * 60, opacity: 1 },
        { x: Math.cos(a) * r, y: Math.sin(a) * r - spread * .25, scale: ball ? .55 : .7 + Math.random() * .7,
          rotation: (Math.random() - .5) * 90, duration: .9 + Math.random() * .4, ease: 'power3.out',
          onComplete: (function (el) { return function () { el.remove(); }; })(p) });
      gsap.to(p, { opacity: 0, duration: .35, delay: .65 + Math.random() * .3 });
    }
  }

  function shortLink(url) { return String(url || '').replace(/^https?:\/\//, ''); }

  // ---------- Estado ----------

  var refCode = (params.get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/.test(refCode)) refCode = '';
  var state = { card: null, token: null, story: null, storyFor: null };
  var sheet = $('[data-sheet]');
  var storyDialog = $('[data-story]');

  // ---------- Hoja ----------

  var lastFocus = null;
  function sheetView(name) {
    if (!sheet) return null;
    var shown = null;
    $$('.wl-view', sheet).forEach(function (v) {
      var on = v.getAttribute('data-view') === name;
      v.hidden = !on;
      if (on) { shown = v; v.classList.remove('is-in'); void v.offsetWidth; v.classList.add('is-in'); }
    });
    var heading = shown && shown.querySelector('h2');
    if (heading) sheet.setAttribute('aria-labelledby', heading.id);
    var body = $('[data-sheet-body]', sheet);
    if (body) body.scrollTop = 0;
    return shown;
  }

  function openSheet(view) {
    if (!sheet) return;
    var target = view || (state.card ? 'done' : 'form');
    var shown = sheetView(target);
    if (!sheet.open) {
      lastFocus = d.activeElement;
      sheet.showModal();
      html.classList.add('sheet-open');
      d.dispatchEvent(new CustomEvent('waitlist:sheet', { detail: { open: true } }));
    }
    if (target === 'form' && finePointer) {
      var first = $('input[name="name"]', sheet);
      if (first) first.focus({ preventScroll: true });
    } else if (shown) {
      var h = shown.querySelector('h2');
      if (h) h.focus({ preventScroll: true });
    }
  }

  function closeSheet() {
    if (!sheet || !sheet.open || sheet.classList.contains('is-closing')) return;
    if (reduce) { sheet.close(); return; }
    sheet.classList.add('is-closing');
    setTimeout(function () {
      sheet.classList.remove('is-closing');
      var panel = $('[data-sheet-panel]', sheet);
      if (panel) panel.style.transform = '';
      sheet.close();
    }, 300);
  }

  if (sheet) {
    sheet.addEventListener('cancel', function (e) { e.preventDefault(); closeSheet(); });
    sheet.addEventListener('close', function () {
      html.classList.remove('sheet-open');
      d.dispatchEvent(new CustomEvent('waitlist:sheet', { detail: { open: false } }));
      if (lastFocus && lastFocus.focus && d.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    });
    // Tocar fuera del panel cierra.
    sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
    $$('[data-close]', sheet).forEach(function (b) { b.addEventListener('click', closeSheet); });

    // Arrastrar la barra hacia abajo cierra (móvil).
    var bar = $('.sheet-bar', sheet);
    var panel = $('[data-sheet-panel]', sheet);
    var drag = null;
    bar.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button') || window.innerWidth >= 720) return;
      drag = { y: e.clientY, t: performance.now(), dy: 0 };
      bar.setPointerCapture(e.pointerId);
      panel.style.transition = 'none';
    });
    bar.addEventListener('pointermove', function (e) {
      if (!drag) return;
      drag.dy = Math.max(0, e.clientY - drag.y);
      panel.style.transform = 'translateY(' + drag.dy + 'px)';
    });
    var endDrag = function () {
      if (!drag) return;
      var v = drag.dy / Math.max(1, performance.now() - drag.t);
      panel.style.transition = 'transform .35s cubic-bezier(.2,.7,.1,1)';
      if (drag.dy > 110 || v > .6) { closeSheet(); }
      else panel.style.transform = '';
      drag = null;
    };
    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);

    // Con el teclado del iPhone abierto, la hoja se queda pegada encima.
    if (window.visualViewport) {
      var vv = window.visualViewport;
      var onVV = function () {
        var kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        sheet.style.setProperty('--kb', (kb > 40 ? kb : 0) + 'px');
        sheet.style.setProperty('--vvh', vv.height + 'px');
      };
      vv.addEventListener('resize', onVV);
      vv.addEventListener('scroll', onVV);
      onVV();
    }
    $$('input, select', sheet).forEach(function (el) {
      el.addEventListener('focus', function () {
        if (window.innerWidth >= 720) return;
        setTimeout(function () { el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); }, 320);
      });
    });
  }

  $$('[data-open-sheet]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      if (!sheet) return;
      e.preventDefault();
      // p_source dice desde dónde se apunta la gente: dock, header, match, count, final, stack-end...
      var sheetForm = $('[data-join]', sheet);
      if (sheetForm) sheetForm.setAttribute('data-source', (b.getAttribute('data-open-sheet') || 'sheet').slice(0, 20));
      var match = $('[data-match]');
      if (match && match.open) match.close();
      openSheet();
    });
  });

  // ---------- Ciudades ----------

  function buildCities(cities, launch) {
    if (!cities || !cities.length) return;
    $$('select[name="city"]').forEach(function (select) {
      var current = $$('option', select).map(function (o) { return o.value; }).join(',');
      var wanted = cities.map(function (c) { return c.slug; });
      if (current === wanted.join(',')) return;
      var keep = select.value;
      select.innerHTML = '';
      var group = null;
      cities.forEach(function (c) {
        var o = d.createElement('option');
        o.value = c.slug;
        o.textContent = c.slug === launch ? T.city_first : (c.slug === 'otras' ? T.other_city : c.name);
        if (c.slug === launch || c.slug === 'otras') { select.appendChild(o); return; }
        if (!group) { group = d.createElement('optgroup'); group.label = T.city_group; select.appendChild(group); }
        group.appendChild(o);
      });
      select.value = wanted.indexOf(keep) >= 0 ? keep : launch;
    });
  }

  var wantedCity = (params.get('ciudad') || params.get('city') || '').toLowerCase();
  if (wantedCity) {
    $$('select[name="city"]').forEach(function (s) {
      if ($$('option', s).some(function (o) { return o.value === wantedCity; })) s.value = wantedCity;
    });
  }

  // ---------- Contador ----------

  var total = null;
  function setTotal(n) {
    var from = total;
    total = n;
    $$('[data-total]').forEach(function (el) {
      if (el.hasAttribute('data-count-big')) { el.setAttribute('data-target', n); el.dispatchEvent(new CustomEvent('count:set')); return; }
      var shown = parseInt(String(el.textContent).replace(/\D/g, ''), 10);
      countUp(el, n, isNaN(shown) ? from : shown, 900);
    });
    d.dispatchEvent(new CustomEvent('waitlist:total', { detail: { total: n } }));
  }

  function loadCounts() {
    return rpc('waitlist_counts').then(function (data) {
      if (!data) return;
      if (typeof data.total === 'number') setTotal(data.total);
      buildCities(data.cities, data.launch_city || T.launch);
    }, function () { /* el formulario sigue con las ciudades escritas en la página */ });
  }

  // ---------- Formulario ----------

  function fieldError(form, field, msg) {
    var input = form.elements.namedItem(field);
    var err = $('[data-err="' + field + '"]', form);
    if (input) input.setAttribute('aria-invalid', 'true');
    if (err) { err.textContent = msg; err.hidden = false; }
    if (input && input.focus) input.focus();
  }

  function clearErrors(form) {
    $$('[aria-invalid]', form).forEach(function (el) { el.removeAttribute('aria-invalid'); });
    $$('[data-err], [data-error]', form).forEach(function (el) { el.hidden = true; el.textContent = ''; });
  }

  function errorMessage(err) {
    var code = err && err.code;
    return { DISPOSABLE_EMAIL: T.err_disposable, RATE_LIMITED: T.err_rate, NETWORK: T.err_network,
             NOT_CONFIGURED: T.err_config }[code] || T.err_generic;
  }

  function setBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
    var label = button.querySelector('span');
    if (label) {
      if (busy) { button.setAttribute('data-label', label.textContent); label.textContent = T.busy; }
      else if (button.getAttribute('data-label')) label.textContent = button.getAttribute('data-label');
    }
  }

  function bindJoin(form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(form);
      var name = form.elements.namedItem('name');
      var email = form.elements.namedItem('email');
      var city = form.elements.namedItem('city');
      var website = form.elements.namedItem('website');
      var v = { name: name.value.trim().replace(/\s+/g, ' '), email: email.value.trim(), city: city.value };
      if (!v.name || v.name.length > 40 || !/[A-Za-zÀ-ÿ]/.test(v.name)) return fieldError(form, 'name', T.err_name);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) return fieldError(form, 'email', T.err_email);
      if (!v.city) return fieldError(form, 'city', T.err_city);
      var button = form.querySelector('button[type="submit"]');
      setBusy(button, true);
      rpc('waitlist_join', {
        p_name: v.name, p_email: v.email, p_city: v.city, p_locale: lang, p_ref: refCode || null,
        p_elapsed_ms: Math.round(performance.now()), p_website: (website && website.value) || null,
        p_source: form.getAttribute('data-source') || 'sheet'
      }).then(function (res) {
        if (res && res.status === 'check_email') { openSheet('known'); return; }
        state.card = res;
        state.token = res.status_token || null;
        name.value = ''; email.value = '';
        renderDone(sheet, res, { fresh: true, pending: (res.entry_status || 'pending') === 'pending' });
        openSheet('done');
        celebrate(sheet);
        d.dispatchEvent(new CustomEvent('waitlist:joined', { detail: res }));
        // El botón fijo pasa a enseñar tu puesto y abre tu enlace para compartir.
        $$('[data-dock-label]').forEach(function (el) { if (res.position) el.textContent = fill(T.dock_joined, { pos: nf.format(res.position) }); });
        if (typeof res.total === 'number') setTotal(res.total);
      }, function (err) {
        var code = err && err.code;
        if (code === 'INVALID' && /^(name|email|city)$/.test(err.detail)) {
          fieldError(form, err.detail, { name: T.err_name, email: T.err_email, city: T.err_city }[err.detail]);
        } else if (code === 'DISPOSABLE_EMAIL') {
          fieldError(form, 'email', T.err_disposable);
        } else {
          var box = $('[data-error]', form);
          box.textContent = code === 'MOCK_MISSING' ? T.err_generic : errorMessage(err);
          box.hidden = false;
        }
      }).then(function () { setBusy(button, false); });
    });
  }
  $$('[data-join]').forEach(bindJoin);

  // ---------- Celebración y compartir ----------

  function celebrate(root) {
    var b = $('[data-done-burst]', root);
    setTimeout(function () { burst(b, 16, 150); }, 450);
  }

  function renderDone(root, card, opts) {
    opts = opts || {};
    var view = $('[data-view="done"]', root);
    if (!view || !card) return;
    var lead = $('[data-done-lead]', view);
    lead.textContent = card.first_name ? fill(lead.getAttribute('data-template'), { name: card.first_name }) : lead.getAttribute('data-anon');
    var pos = $('[data-done-pos]', view);
    if (card.position) {
      var old = parseInt(String(pos.textContent).replace(/\D/g, ''), 10);
      if (opts.fresh || isNaN(old)) countUp(pos, card.position, Math.max(1, card.position - Math.min(card.position - 1, 240)), 1500);
      else countUp(pos, card.position, old, 1100);
    } else {
      pos.textContent = '·';
    }
    var city = $('[data-done-city]', view);
    if (card.city_name || card.city_slug) {
      var cname = card.city_slug === 'otras' ? T.other_city : card.city_name;
      city.textContent = card.city_slug === 'otras' ? '' : fill(city.getAttribute('data-template'), { city: cname });
      city.hidden = card.city_slug === 'otras';
    }
    $('[data-done-mail]', view).hidden = !opts.pending;
    var status = $('[data-done-status]', view);
    if (opts.note) { status.textContent = opts.note; status.classList.toggle('warn', !!opts.warn); status.hidden = false; }
    else status.hidden = true;

    var link = card.share_url || '';
    $('[data-share-link]', view).textContent = shortLink(link);
    $('[data-share-wa]', view).href = 'https://wa.me/?text=' + encodeURIComponent(T.share_msg + ' ' + link);
    var native = $('[data-share-native]', view);
    native.hidden = !navigator.share;

    var more = $('[data-more]', view);
    var moreDone = $('[data-more-done]', view);
    if (card.profile_done) {
      more.hidden = true;
      if (!moreDone.textContent) { moreDone.textContent = T.profile_done; }
      moreDone.hidden = false;
    } else if (state.token) {
      more.hidden = false;
    } else {
      more.hidden = true;
    }
    bindShare(view, card);
    // La imagen de la story se prepara ya, para que al tocar el botón se pueda compartir sin esperar.
    prepareStory(card);
  }

  function bindShare(view, card) {
    if (view.getAttribute('data-bound')) return;
    view.setAttribute('data-bound', '1');
    var current = function () { return state.card || card; };
    $('[data-share-copy]', view).addEventListener('click', function () {
      var link = current().share_url || '';
      var done = function () { toast(T.copied); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function () { legacyCopy(link); done(); });
      else { legacyCopy(link); done(); }
    });
    $('[data-share-native]', view).addEventListener('click', function () {
      var link = current().share_url || '';
      navigator.share({ title: T.share_title, text: T.share_msg, url: link }).catch(function () {});
    });
    $('[data-share-story]', view).addEventListener('click', function () { shareStory(current()); });
    bindMore(view);
  }

  function legacyCopy(text) {
    var ta = d.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    d.body.appendChild(ta);
    ta.select();
    try { d.execCommand('copy'); } catch (e) { /* nada */ }
    ta.remove();
  }

  // ---------- Paso opcional de perfil ----------

  function bindMore(view) {
    var open = $('[data-more-open]', view);
    var form = $('[data-more-form]', view);
    if (!open || !form) return;
    open.addEventListener('click', function () {
      var expanded = open.getAttribute('aria-expanded') === 'true';
      open.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      form.hidden = expanded;
      if (!expanded) { var f = form.querySelector('input'); if (f) f.focus({ preventScroll: true }); form.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); }
    });
    var values = function (name) { return $$('input[name="' + name + '"]:checked', form).map(function (i) { return i.value; }); };
    $$('input[name="sports"]', form).forEach(function (box) {
      box.addEventListener('change', function () {
        if (box.checked && values('sports').length > 3) { box.checked = false; toast(T.sports_max); }
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var error = $('[data-more-error]', form);
      error.hidden = true;
      var gender = values('gender')[0] || null, seeking = values('seeking'), sports = values('sports');
      if (!gender && !seeking.length && !sports.length) { error.textContent = T.err_profile; error.hidden = false; return; }
      var consent = form.elements.namedItem('consent');
      if (!consent.checked) { error.textContent = T.err_consent; error.hidden = false; consent.focus(); return; }
      var button = $('[data-more-submit]', form);
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      rpc('waitlist_profile', { p_token: state.token, p_gender: gender, p_seeking: seeking, p_sports: sports, p_consent: true })
        .then(function (card) {
          state.card = Object.assign({}, state.card || {}, card, { profile_done: true });
          var moreDone = $('[data-more-done]', view);
          moreDone.textContent = T.more_done;
          renderDone(view.parentNode, state.card, { pending: !$('[data-done-mail]', view).hidden, note: $('[data-done-status]', view).hidden ? null : $('[data-done-status]', view).textContent });
          moreDone.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
          if (card.position) $$('[data-dock-label]').forEach(function (el) { el.textContent = fill(T.dock_joined, { pos: nf.format(card.position) }); });
        }, function (err) {
          error.textContent = err && err.code === 'INVALID' && err.detail === 'consent' ? T.err_consent
            : err && err.code === 'INVALID' ? T.err_profile : errorMessage(err);
          error.hidden = false;
        }).then(function () { button.disabled = false; button.setAttribute('aria-busy', 'false'); });
    });
  }

  // ---------- Story de Instagram (lienzo de 1080x1920) ----------

  var WM = null;
  function wordmarkPath() {
    if (WM) return WM;
    var p = d.querySelector('.hd-brand .wm path');
    WM = p ? new Path2D(p.getAttribute('d')) : null;
    return WM;
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCover(ctx, img, x, y, w, h, fy) {
    var s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    var sw = w / s, sh = h / s;
    var sx = (img.naturalWidth - sw) / 2;
    var sy = (img.naturalHeight - sh) * (fy == null ? .4 : fy);
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  function makeStory(card) {
    var W = 1080, H = 1920;
    var fonts = ['400 112px Newsreader', 'italic 400 112px Newsreader', '600 40px "DM Sans"', '500 32px "DM Sans"', 'extra-condensed 900 220px Archivo'];
    var holder = d.querySelector('[data-story-photos]');
    var srcs = holder ? holder.getAttribute('data-story-photos').split('|').filter(Boolean) : [];
    var names = holder ? holder.getAttribute('data-story-names').split('|') : [];
    return Promise.all([Promise.all(fonts.map(function (f) { return d.fonts ? d.fonts.load(f).catch(function () {}) : null; })),
                        Promise.all(srcs.map(loadImage))])
      .then(function (r) {
        var imgs = r[1];
        var c = d.createElement('canvas');
        c.width = W; c.height = H;
        var ctx = c.getContext('2d');
        // Papel, tinta y fotos: como la web y la app.
        ctx.fillStyle = '#F7F6F4';
        ctx.fillRect(0, 0, W, H);
        // Marca. Todo lo importante queda entre los 220 px de arriba y los 260 de abajo, que tapa Instagram.
        var wm = wordmarkPath();
        if (wm) {
          ctx.save();
          ctx.translate(84, 232);
          ctx.scale(.86, .86);
          ctx.fillStyle = '#111111';
          ctx.fill(wm);
          ctx.beginPath(); ctx.arc(62.8, -71.4, 8.1, 0, Math.PI * 2); ctx.fillStyle = '#D7F24B'; ctx.fill();
          ctx.lineWidth = 1.2; ctx.strokeStyle = '#111111'; ctx.stroke();
          ctx.restore();
        }
        ctx.fillStyle = '#5C5C5C';
        ctx.font = '500 32px "DM Sans", sans-serif';
        ctx.fillText(T.story_kicker, 84, 300);
        // Dos perfiles como en la app.
        var cardAt = function (img, cx, cy, rot, name) {
          var w = 380, h = 440;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rot * Math.PI / 180);
          roundRect(ctx, -w / 2, -h / 2, w, h + 88, 30);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = '#E4E4E4'; ctx.stroke();
          ctx.save();
          roundRect(ctx, -w / 2, -h / 2, w, h, 30);
          ctx.clip();
          if (img) drawCover(ctx, img, -w / 2, -h / 2, w, h, .3);
          ctx.restore();
          ctx.fillStyle = '#111111';
          ctx.font = '600 40px "DM Sans", sans-serif';
          ctx.fillText(name || '', -w / 2 + 28, h / 2 + 58);
          ctx.restore();
        };
        cardAt(imgs[0], 310, 610, -6, names[0]);
        cardAt(imgs[1], 750, 590, 5, names[1]);
        // Titular.
        ctx.fillStyle = '#111111';
        ctx.font = '400 112px Newsreader, Georgia, serif';
        ctx.fillText(T.story_h1, 80, 1060);
        ctx.font = 'italic 400 112px Newsreader, Georgia, serif';
        ctx.fillText(T.story_h2, 80, 1166);
        // Número.
        var num = nf.format(card.position || 0);
        ctx.fillStyle = '#5C5C5C';
        ctx.font = '500 36px "DM Sans", sans-serif';
        ctx.fillText(T.story_num, 84, 1252);
        ctx.fillStyle = '#111111';
        ctx.font = 'extra-condensed 900 220px Archivo, "DM Sans", sans-serif';
        ctx.fillText((lang === 'es' ? 'nº ' : 'No. ') + num, 76, 1448);
        ctx.fillStyle = '#111111';
        ctx.font = '600 40px "DM Sans", sans-serif';
        ctx.fillText(T.story_cta, 84, 1530);
        // Enlace en una píldora negra.
        var link = shortLink(card.share_url);
        ctx.font = '600 38px "DM Sans", sans-serif';
        var lw = ctx.measureText(link).width + 80;
        roundRect(ctx, 84, 1574, Math.min(lw, W - 168), 88, 44);
        ctx.fillStyle = '#111111';
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(link, 124, 1632);
        return new Promise(function (resolve) { c.toBlob(function (b) { resolve(b); }, 'image/png'); });
      });
  }

  function prepareStory(card) {
    if (!card || !card.share_url) return;
    var key = card.share_url + '|' + card.position;
    if (state.storyFor === key) return;
    state.storyFor = key;
    state.story = null;
    var run = function () { makeStory(card).then(function (blob) { if (state.storyFor === key) state.story = blob; }, function () {}); };
    if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 1500 }); else setTimeout(run, 400);
  }

  function shareStory(card) {
    var go = function (blob) {
      if (!blob) { toast(T.err_generic); return; }
      var file = new File([blob], 'pista-story.png', { type: 'image/png' });
      if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch(function (e) { if (!e || e.name !== 'AbortError') showStory(blob); });
      } else showStory(blob);
    };
    if (state.story) go(state.story);
    else { toast(T.story_busy); makeStory(card).then(function (b) { state.story = b; go(b); }, function () { toast(T.err_generic); }); }
  }

  function showStory(blob) {
    if (!storyDialog) return;
    var url = URL.createObjectURL(blob);
    var img = $('[data-story-img]', storyDialog);
    img.src = url;
    img.alt = T.story_h1 + ' ' + T.story_h2;
    var save = $('[data-story-save]', storyDialog);
    save.href = url;
    storyDialog.showModal();
  }
  if (storyDialog) {
    $('[data-story-close]', storyDialog).addEventListener('click', function () { storyDialog.close(); });
    storyDialog.addEventListener('click', function (e) { if (e.target === storyDialog) storyDialog.close(); });
  }

  // ---------- "¿Tienes una invitación? Entra directo" ----------

  // Invitación (8), acceso de la lista (12) o embajador (PISTA-NOMBRE): la página de cada enlace corto lo comprueba.
  function codeTarget(raw) {
    // También vale el enlace entero (pista.one/i/CODIGO, ...?c=CODIGO): nos quedamos con lo de después de la última / o =.
    var code = String(raw || '').toUpperCase().replace(/\s+/g, '').replace(/[\/?#]+$/, '').replace(/^.*[\/=]/, '');
    var langQ = lang === 'en' ? '&lang=en' : '';
    if (/^PISTA-?[A-Z0-9]{2,20}$/.test(code)) return '/e/?c=' + encodeURIComponent(code.replace(/^PISTA-?/, 'PISTA-')) + langQ;
    var clean = code.replace(/-/g, '');
    if (/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/.test(clean)) return '/i/?c=' + clean + langQ;
    if (/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{12}$/.test(clean)) return '/a/?c=' + clean + langQ;
    return null;
  }
  $$('[data-code-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.elements.namedItem('code');
      var err = $('[data-code-err]', form);
      var target = codeTarget(input.value);
      if (!target) {
        input.setAttribute('aria-invalid', 'true');
        err.textContent = T.err_code;
        err.hidden = false;
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      err.hidden = true;
      location.href = target;
    });
  });

  // ---------- Quien te recomienda Pista ----------

  function showReferrer(name) {
    var initial = name ? name.trim().charAt(0).toUpperCase() : '';
    $$('[data-hero-ref], [data-ref]').forEach(function (box) {
      var title = box.querySelector('[data-ref-name], [data-ref-title]');
      if (title) title.textContent = name ? fill(title.getAttribute('data-template'), { name: name }) : (title.getAttribute('data-generic') || '');
      if (!name && box.hasAttribute('data-hero-ref')) return;
      var hero = box.closest('[data-hero]');
      if (hero) hero.classList.add('has-ref');
      var av = box.querySelector('[data-ref-initial]');
      if (av) av.textContent = initial || '♥';
      box.hidden = false;
    });
    d.dispatchEvent(new CustomEvent('waitlist:referrer', { detail: { name: name } }));
  }

  // ---------- Página de estado (/lista/) ----------

  var statusRoot = $('[data-status-root]');

  function statusNote(st) {
    return { pending: [T.st_pending, true], confirmed: [T.st_confirmed, false], admitted: [T.st_admitted, false], joined: [T.st_joined, false] }[st] || [null, false];
  }

  function showStatus(card, justConfirmed) {
    state.card = card;
    var note = justConfirmed ? [T.st_confirmed_now, false] : statusNote(card.status);
    $$('[data-status-hide]').forEach(function (el) { el.hidden = true; });
    $$('[data-status-show]').forEach(function (el) { el.hidden = false; });
    var view = $('[data-view="done"]', statusRoot);
    renderDone(statusRoot, card, { note: note[0], warn: note[1], status: true });
    $$('.wl-view', statusRoot).forEach(function (v) { v.hidden = v !== view; });
    $('[data-status-loading]', statusRoot).hidden = true;
    var bookmark = $('[data-bookmark]');
    if (bookmark) bookmark.hidden = false;
  }

  function linkError() {
    var top = $('[data-status-loading]', statusRoot);
    top.textContent = T.err_link;
    top.classList.add('warn');
    top.hidden = false;
    $$('.wl-view', statusRoot).forEach(function (v) { v.hidden = v.getAttribute('data-view') !== 'form'; });
  }

  function startStatus() {
    var confirmToken = params.get('confirmar') || params.get('confirm');
    var token = params.get('s');
    if (!statusRoot || !(confirmToken || token)) return false;
    // Las páginas con token son privadas: que no las indexe nadie.
    var robots = d.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    d.head.appendChild(robots);
    var loading = $('[data-status-loading]', statusRoot);
    loading.textContent = confirmToken ? T.confirming : T.loading;
    loading.hidden = false;
    $$('.wl-view', statusRoot).forEach(function (v) { v.hidden = true; });
    if (confirmToken) {
      rpc('waitlist_confirm', { p_token: confirmToken }).then(function (card) {
        state.token = card.status_token || null;
        if (state.token) history.replaceState(null, '', location.pathname + '?s=' + encodeURIComponent(state.token) + (params.has('mock') ? '&mock=1' : ''));
        showStatus(card, true);
      }, linkError);
    } else {
      state.token = token;
      rpc('waitlist_status', { p_token: token }).then(function (card) { showStatus(card, false); }, linkError);
    }
    return true;
  }

  // ---------- Arranque ----------

  loadCounts();
  var onStatus = startStatus();
  if (!onStatus && refCode) {
    rpc('waitlist_referrer', { p_code: refCode }).then(function (r) {
      showReferrer(r && r.first_name ? String(r.first_name) : '');
    }, function () {});
  }
  setInterval(function () { if (d.visibilityState === 'visible') loadCounts(); }, 45000);

  window.PistaWaitlist = {
    open: function () { openSheet(); },
    close: closeSheet,
    burst: burst,
    get total() { return total; },
    mock: MOCK
  };
})();
