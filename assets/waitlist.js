/* Pista, lista de espera. Alta en dos pasos (correo y ciudad; luego, si quiere, género, a quién busca y
   deportes), confirmación por correo, página privada de estado (?s=TOKEN) y contador en vivo. Sin cookies
   ni almacenamiento: el token privado va en la URL. Funciona en /lista/ y en la portada, donde solo hay
   formulario y aviso de correo enviado (dos veces: arriba y en la banda final). Al apuntarse lanza el evento
   "waitlist:sent", que la portada usa para que bote la pelota. */
(function () {
  'use strict';
  var api = window.PistaAPI;
  var lang = document.documentElement.lang === 'en' ? 'en' : 'es';
  var T = {
    es: {
      err_email: 'Ese correo no parece bien escrito. Revísalo.',
      err_consent: 'Marca la casilla para poder guardarte el sitio.',
      err_city: 'Elige tu ciudad.',
      err_profile: 'Marca la casilla para que podamos usar estos datos, o pulsa "Prefiero no decirlo".',
      sports_max: 'Hasta 3 deportes.',
      err_disposable: 'Ese correo es de los que se tiran. Usa uno que vayas a mirar.',
      err_rate: 'Demasiadas altas seguidas desde tu conexión. Prueba otra vez en un rato.',
      err_network: 'No hay conexión. Prueba otra vez en un momento.',
      err_config: 'La lista aún no está abierta. Vuelve en un rato.',
      err_generic: 'Algo ha fallado por nuestro lado. Prueba otra vez.',
      err_link: 'Ese enlace ya no vale o no es correcto. Apúntate otra vez con tu correo y te mandamos uno nuevo.',
      sent_to: function (e) { return 'Te hemos mandado un enlace a ' + e + '. Hasta que no lo abras, tu sitio no cuenta. Si no lo ves, busca en promociones o en spam.'; },
      resend_in: function (s) { return 'Puedes pedir otro en ' + s + ' s'; },
      resent: 'Enviado otra vez. Puede tardar un minuto.',
      confirmed: 'Correo confirmado. Ya cuentas en la lista.',
      admitted: 'Te toca. Te hemos mandado un correo con tu código para entrar en la app.',
      joined: 'Ya estás dentro de Pista. Nos vemos en la pista.',
      copied: 'Enlace copiado',
      share_text: function (p) { return 'Por cada persona que se apunte con tu enlace y confirme su correo, subís ' + p + ' puestos los dos.'; },
      share_msg: 'Me he apuntado a Pista, la app de citas para gente que entrena. Apúntate con mi enlace y subimos los dos en la lista:',
      stats: function (r, p) { return (r === 1 ? 'Has traído a 1 persona' : 'Has traído a ' + r + ' personas') + ' · ' + p + ' puntos'; },
      open: 'abierta',
      waiting_one: 'persona en tu ciudad', waiting_many: 'personas en tu ciudad',
      status_h1: 'Ya tienes <em>sitio</em>.',
      status_lede: 'Te escribimos cuando abramos tu tanda. Mientras, comparte tu enlace para entrar antes.'
    },
    en: {
      err_email: "That email doesn't look right. Check it.",
      err_consent: 'Tick the box so we can save your spot.',
      err_city: 'Choose your city.',
      err_profile: 'Tick the box so we can use this, or tap "I\'d rather not say".',
      sports_max: 'Up to 3 sports.',
      err_disposable: "That's a throwaway address. Use one you'll actually check.",
      err_rate: 'Too many sign ups from your connection. Try again in a while.',
      err_network: 'No connection. Try again in a moment.',
      err_config: "The waitlist isn't open yet. Come back in a bit.",
      err_generic: 'Something went wrong on our side. Try again.',
      err_link: "That link has expired or isn't right. Join again with your email and we'll send a new one.",
      sent_to: function (e) { return "We've sent a link to " + e + ". Your spot only counts once you open it. If you can't find it, look in promotions or spam."; },
      resend_in: function (s) { return 'You can ask for another in ' + s + 's'; },
      resent: 'Sent again. It may take a minute.',
      confirmed: "Email confirmed. You're on the list.",
      admitted: "You're up. We've emailed you your code to get into the app.",
      joined: "You're in Pista. See you on court.",
      copied: 'Link copied',
      share_text: function (p) { return 'For every person who joins with your link and confirms their email, you both move up ' + p + ' places.'; },
      share_msg: "I've joined Pista, the dating app for people who train. Join with my link and we both move up the list:",
      stats: function (r, p) { return (r === 1 ? "You've brought 1 person" : "You've brought " + r + ' people') + ' · ' + p + ' points'; },
      open: 'open',
      waiting_one: 'person in your city', waiting_many: 'people in your city',
      status_h1: "You've got a <em>spot</em>.",
      status_lede: "We'll email you when your group opens. Meanwhile, share your link to get in sooner."
    }
  }[lang];

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var on = function (sel, ev, fn, root) { var el = $(sel, root); if (el) el.addEventListener(ev, fn); };
  // El servidor guarda los nombres de ciudad en español; "otras" se traduce aquí.
  var cityName = function (c) { return c.slug === 'otras' && lang === 'en' ? 'Another city' : c.name; };
  var nf = new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-GB');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(location.search);
  var openedAt = Date.now();
  // Puede haber más de un formulario en la página (la portada tiene dos): cada uno con sus vistas.
  var forms = $$('[data-view="form"]');
  if (!forms.length) return;
  var refCode = (params.get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(refCode)) refCode = '';
  var statusToken = null;

  function reveal(el) {
    if (window.PistaScrollTo) window.PistaScrollTo(el);
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }

  function toast(text) {
    var el = $('[data-toast]');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  function animate(el, to) {
    var from = Number(el.getAttribute('data-value') || 0);
    el.setAttribute('data-value', to);
    if (reduce || from === to || !el.textContent.trim()) { el.textContent = nf.format(to); return; }
    if (to > from) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    var start = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - start) / 900);
      var eased = 1 - Math.pow(1 - k, 3);
      el.textContent = nf.format(Math.round(from + (to - from) * eased));
      if (k < 1) requestAnimationFrame(step);
    })(start);
  }

  function message(err) {
    var code = err && err.code;
    if (code === 'INVALID') return { email: T.err_email, consent: T.err_consent, city: T.err_city }[err.detail] || T.err_email;
    return { DISPOSABLE_EMAIL: T.err_disposable, RATE_LIMITED: T.err_rate, NETWORK: T.err_network,
             NOT_CONFIGURED: T.err_config }[code] || T.err_generic;
  }

  function setBusy(button, busy) {
    button.disabled = busy;
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  async function signup(payload) {
    return api.rpc('waitlist_signup', {
      p_email: payload.email, p_city: payload.city, p_locale: lang, p_ref: refCode || null,
      p_consent: true, p_elapsed_ms: Date.now() - openedAt, p_website: payload.website || null,
      p_gender: payload.gender || null, p_seeking: payload.seeking || null, p_sports: payload.sports || null,
      p_profile_consent: !!payload.profileConsent
    });
  }

  // ---------- Un formulario con sus vistas (formulario, correo enviado y, en /lista/, estado) ----------

  function Waitlist(form) {
    var root = form.parentNode;
    var views = { form: form, sent: $('[data-view="sent"]', root), status: $('[data-view="status"]', root) };
    var stepLabel = $('[data-step-label]', form);
    var resend = $('[data-resend]', root);
    var lastSignup = null;

    function show(name) {
      Object.keys(views).forEach(function (k) { if (views[k]) views[k].hidden = k !== name; });
    }

    function goStep(n) {
      form.setAttribute('data-step', String(n));
      $$('[data-pane]', form).forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== String(n); });
      if (stepLabel) stepLabel.textContent = stepLabel.getAttribute('data-template').replace('{n}', n);
      var first = form.querySelector('[data-pane="' + n + '"] input:not([type=hidden]):not([name=website])');
      if (first && n === 2) first.focus({ preventScroll: true });
      reveal(form);
    }

    function values(name) {
      return $$('input[name="' + name + '"]:checked', form).map(function (i) { return i.value; });
    }

    // Tres deportes como mucho: el cuarto no se marca.
    $$('input[name="sports"]', form).forEach(function (box) {
      box.addEventListener('change', function () {
        if (box.checked && values('sports').length > 3) { box.checked = false; toast(T.sports_max); }
      });
    });

    function checkFirstStep() {
      var error = $('[data-error]', form);
      var email = form.email.value.trim();
      var city = (form.querySelector('input[name="city"]:checked') || {}).value;
      error.hidden = true;
      form.email.removeAttribute('aria-invalid');
      var fail = null;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { fail = T.err_email; form.email.setAttribute('aria-invalid', 'true'); }
      else if (!city) fail = T.err_city;
      else if (!form.consent.checked) fail = T.err_consent;
      if (fail) { error.textContent = fail; error.hidden = false; return null; }
      return { email: email, city: city, website: form.website.value };
    }

    on('[data-next]', 'click', function () { if (checkFirstStep()) goStep(2); }, form);
    form.email.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && form.getAttribute('data-step') === '1') { e.preventDefault(); if (checkFirstStep()) goStep(2); }
    });
    on('[data-back]', 'click', function () { goStep(1); }, form);

    async function send(withProfile) {
      var first = checkFirstStep();
      if (!first) { goStep(1); return; }
      var error2 = $('[data-error2]', form);
      error2.hidden = true;
      var payload = first;
      if (withProfile) {
        var gender = values('gender')[0] || null, seeking = values('seeking'), sports = values('sports');
        var any = gender || seeking.length || sports.length;
        if (any && !form.profile_consent.checked) { error2.textContent = T.err_profile; error2.hidden = false; return; }
        if (any) { payload.gender = gender; payload.seeking = seeking; payload.sports = sports; payload.profileConsent = true; }
      }
      var button = form.querySelector('button[type="submit"]');
      setBusy(button, true);
      lastSignup = payload;
      try {
        await signup(payload);
        if (views.sent) {
          $('[data-sent-text]', views.sent).textContent = T.sent_to(payload.email);
          show('sent');
          startResendTimer();
          reveal(views.sent);
          var heading = $('h2', views.sent);
          if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
        }
        root.dispatchEvent(new CustomEvent('waitlist:sent', { bubbles: true }));
      } catch (err) {
        // El servidor solo rechaza datos del primer paso: se vuelve a él con el aviso.
        goStep(1);
        var error = $('[data-error]', form);
        error.textContent = message(err);
        error.hidden = false;
      } finally {
        setBusy(button, false);
      }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.getAttribute('data-step') === '1') { if (checkFirstStep()) goStep(2); return; }
      send(true);
    });
    on('[data-skip]', 'click', function () { send(false); }, form);

    function startResendTimer() {
      if (!resend) return;
      var left = 60;
      resend.disabled = true;
      var note = $('[data-sent-note]', root);
      note.hidden = false;
      note.textContent = T.resend_in(left);
      clearInterval(startResendTimer.t);
      startResendTimer.t = setInterval(function () {
        left -= 1;
        note.textContent = T.resend_in(left);
        if (left <= 0) { clearInterval(startResendTimer.t); resend.disabled = false; note.hidden = true; }
      }, 1000);
    }
    if (resend) {
      resend.addEventListener('click', async function () {
        if (!lastSignup) return;
        setBusy(resend, true);
        try { await signup(lastSignup); toast(T.resent); startResendTimer(); }
        catch (err) { toast(message(err)); resend.disabled = false; }
        finally { resend.setAttribute('aria-busy', 'false'); }
      });
    }
    on('[data-change]', 'click', function () { show('form'); goStep(1); form.email.focus(); }, root);

    return { form: form, views: views, show: show, goStep: goStep };
  }

  var lists = forms.map(Waitlist);
  var main = lists[0];

  // ---------- Contador y ciudades ----------

  var citiesBuilt = false;
  // Si el contador no responde, el formulario sigue funcionando con las ciudades de siempre.
  var FALLBACK = [{ slug: 'madrid', name: 'Madrid' }, { slug: 'barcelona', name: 'Barcelona' },
                  { slug: 'valencia', name: 'Valencia' }, { slug: 'otras', name: lang === 'es' ? 'Otra ciudad' : 'Another city' }];
  async function loadCounts() {
    var data;
    try { data = await api.rpc('waitlist_counts'); } catch (e) {
      if (!citiesBuilt) buildCities(FALLBACK, 'madrid');
      return;
    }
    // Un contador con cuatro gatos resta más que suma: sale a partir de 50 personas.
    var showCounts = (data.total || 0) >= 50;
    $$('[data-counter]').forEach(function (el) { el.hidden = !showCounts; });
    if (showCounts) $$('[data-total]').forEach(function (el) { animate(el, data.total || 0); });
    if (!citiesBuilt) buildCities(data.cities || [], data.launch_city);
    var list = $('[data-city-counts]');
    if (!list) return;
    list.hidden = !showCounts;
    list.innerHTML = '';
    (data.cities || []).forEach(function (c) {
      var li = document.createElement('li');
      if (c.status === 'open') li.className = 'open';
      li.innerHTML = '<span></span><b></b>';
      li.firstChild.textContent = cityName(c);
      li.lastChild.textContent = c.status === 'open' ? T.open : nf.format(c.count);
      list.appendChild(li);
    });
  }

  // Madrid abre primero: va la primera, marcada por defecto y con su etiqueta.
  function buildCities(cities, launch) {
    var wanted = (params.get('ciudad') || params.get('city') || '').toLowerCase() || launch || '';
    $$('[data-cities]').forEach(function (box) {
      cities.forEach(function (c) {
        var label = document.createElement('label');
        label.className = 'chip';
        label.innerHTML = '<input type="radio" name="city" required><span></span>';
        label.firstChild.value = c.slug;
        label.lastChild.textContent = cityName(c);
        if (c.slug === launch) {
          var tag = document.createElement('small');
          tag.className = 'launch';
          tag.textContent = box.getAttribute('data-launch-tag');
          label.lastChild.appendChild(tag);
        }
        if (c.slug === wanted) label.firstChild.checked = true;
        box.appendChild(label);
      });
    });
    citiesBuilt = true;
  }

  function poll(fn, ms) {
    setInterval(function () { if (document.visibilityState === 'visible') fn(); }, ms);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') fn(); });
  }

  // ---------- Estado (solo /lista/) ----------

  function renderStatus(d) {
    $('[data-city-name]').textContent = d.city_slug ? cityName({ slug: d.city_slug, name: d.city_name || '' }) : '';
    var pos = d.position;
    $('[data-position]').textContent = pos ? nf.format(pos) : '·';
    $('[data-waiting]').textContent = nf.format(d.waiting || 0);
    $('[data-waiting-label]').textContent = d.waiting === 1 ? T.waiting_one : T.waiting_many;
    $('[data-h1]').innerHTML = T.status_h1;
    $('[data-lede]').textContent = T.status_lede;
    var share = d.waiting ? Math.max(4, Math.round(100 - ((pos || 1) - 1) / Math.max(d.waiting, 1) * 100)) : 100;
    requestAnimationFrame(function () { $('[data-meter]').style.width = share + '%'; });
    var note = $('[data-status-note]');
    if (d.status === 'admitted' || d.status === 'joined') {
      note.textContent = d.status === 'admitted' ? T.admitted : T.joined;
      note.hidden = false;
      $('[data-place]').hidden = true;
    }
    var link = d.share_url || '';
    $('[data-link]').value = link;
    $('[data-share-text]').textContent = T.share_text(d.referral_points || 50);
    $('[data-whatsapp]').href = 'https://wa.me/?text=' + encodeURIComponent(T.share_msg + ' ' + link);
    $('[data-native]').hidden = !navigator.share;
    $('[data-stats]').textContent = d.referrals || d.points ? T.stats(d.referrals || 0, d.points || 0) : '';
    main.show('status');
  }

  on('[data-copy]', 'click', async function () {
    var input = $('[data-link]');
    try { await navigator.clipboard.writeText(input.value); } catch (e) { input.select(); document.execCommand('copy'); }
    toast(T.copied);
  });
  on('[data-native]', 'click', function () {
    var link = $('[data-link]').value;
    navigator.share({ title: 'Pista', text: T.share_msg, url: link }).catch(function () {});
  });

  async function refreshStatus() {
    if (!statusToken) return;
    try { renderStatus(await api.rpc('waitlist_status', { p_token: statusToken })); } catch (e) { /* se reintenta */ }
  }

  function linkError() {
    main.show('form');
    var error = $('[data-error]', main.form);
    error.textContent = T.err_link;
    error.hidden = false;
  }

  async function start() {
    await loadCounts();
    poll(loadCounts, 20000);
    var confirm = params.get('confirmar') || params.get('confirm');
    var status = params.get('s');
    if ((confirm || status) && main.views.status) {
      if (confirm) {
        main.show('status');
        $('[data-confirming]').hidden = false;
        try {
          var d = await api.rpc('waitlist_confirm', { p_token: confirm });
          statusToken = d.status_token;
          history.replaceState(null, '', location.pathname + '?s=' + statusToken);
          $('[data-confirming]').hidden = true;
          var note = $('[data-status-note]');
          note.textContent = T.confirmed;
          note.hidden = false;
          renderStatus(d);
          poll(refreshStatus, 60000);
        } catch (err) { linkError(); }
        return;
      }
      statusToken = status;
      try {
        renderStatus(await api.rpc('waitlist_status', { p_token: status }));
        poll(refreshStatus, 60000);
      } catch (err) { linkError(); }
      return;
    }
    lists.forEach(function (w) { w.show('form'); });
    if (refCode) {
      try {
        var r = await api.rpc('waitlist_referrer', { p_code: refCode });
        if (r && r.valid) {
          lists.forEach(function (w) {
            $('[data-ref]', w.form).hidden = false;
            var pick = w.form.querySelector('input[name="city"][value="' + r.city_slug + '"]');
            if (pick && !w.form.querySelector('input[name="city"]:checked')) pick.checked = true;
          });
        }
      } catch (e) { /* sin aviso de referido */ }
    }
  }

  start();
})();
