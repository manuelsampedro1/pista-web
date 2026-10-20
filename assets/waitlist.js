/* Pista, lista de espera. Alta con correo y ciudad, confirmación por correo, página privada de estado
   (?s=TOKEN) y contador en vivo. Sin cookies ni almacenamiento: el token privado va en la URL. */
(function () {
  'use strict';
  var api = window.PistaAPI;
  var lang = document.documentElement.lang === 'en' ? 'en' : 'es';
  var T = {
    es: {
      err_email: 'Ese correo no parece bien escrito. Revísalo.',
      err_consent: 'Marca la casilla para poder guardarte el sitio.',
      err_city: 'Elige tu ciudad.',
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
  // El servidor guarda los nombres de ciudad en español; "otras" se traduce aquí.
  var cityName = function (c) { return c.slug === 'otras' && lang === 'en' ? 'Another city' : c.name; };
  var nf = new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-GB');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(location.search);
  var openedAt = Date.now();
  var form = $('[data-view="form"]');
  var views = { form: form, sent: $('[data-view="sent"]'), status: $('[data-view="status"]') };
  var refCode = (params.get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(refCode)) refCode = '';
  var lastSignup = null;
  var statusToken = null;

  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
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

  // ---------- Contador y ciudades ----------

  var citiesBuilt = false;
  // Si el contador no responde, el formulario sigue funcionando con las ciudades de siempre.
  var FALLBACK = [{ slug: 'madrid', name: 'Madrid' }, { slug: 'barcelona', name: 'Barcelona' },
                  { slug: 'valencia', name: 'Valencia' }, { slug: 'otras', name: lang === 'es' ? 'Otra ciudad' : 'Another city' }];
  async function loadCounts() {
    var data;
    try { data = await api.rpc('waitlist_counts'); } catch (e) {
      if (!citiesBuilt) buildCities(FALLBACK);
      return;
    }
    // Un contador con cuatro gatos resta más que suma: sale a partir de 50 personas.
    var showCounts = (data.total || 0) >= 50;
    $('[data-counter]').hidden = !showCounts;
    $('[data-city-counts]').hidden = !showCounts;
    if (showCounts) animate($('[data-total]'), data.total || 0);
    var list = $('[data-city-counts]');
    list.innerHTML = '';
    (data.cities || []).forEach(function (c) {
      var li = document.createElement('li');
      if (c.status === 'open') li.className = 'open';
      li.innerHTML = '<span></span><b></b>';
      li.firstChild.textContent = cityName(c);
      li.lastChild.textContent = c.status === 'open' ? T.open : nf.format(c.count);
      list.appendChild(li);
    });
    if (!citiesBuilt) buildCities(data.cities || []);
  }

  function buildCities(cities) {
    var box = $('[data-cities]');
    var wanted = (params.get('ciudad') || params.get('city') || '').toLowerCase();
    cities.forEach(function (c) {
      var label = document.createElement('label');
      label.className = 'chip';
      label.innerHTML = '<input type="radio" name="city" required><span></span>';
      label.firstChild.value = c.slug;
      label.lastChild.textContent = cityName(c);
      if (c.slug === wanted) label.firstChild.checked = true;
      box.appendChild(label);
    });
    citiesBuilt = true;
  }

  function poll(fn, ms) {
    setInterval(function () { if (document.visibilityState === 'visible') fn(); }, ms);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') fn(); });
  }

  // ---------- Alta ----------

  async function signup(payload) {
    return api.rpc('waitlist_signup', {
      p_email: payload.email, p_city: payload.city, p_locale: lang, p_ref: refCode || null,
      p_consent: true, p_elapsed_ms: Date.now() - openedAt, p_website: payload.website || null
    });
  }

  function setBusy(button, busy) {
    button.disabled = busy;
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var error = $('[data-error]', form);
    var email = form.email.value.trim();
    var city = (form.querySelector('input[name="city"]:checked') || {}).value;
    error.hidden = true;
    form.email.removeAttribute('aria-invalid');
    var fail = null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { fail = T.err_email; form.email.setAttribute('aria-invalid', 'true'); }
    else if (!city) fail = T.err_city;
    else if (!form.consent.checked) fail = T.err_consent;
    if (fail) { error.textContent = fail; error.hidden = false; return; }
    var button = form.querySelector('button[type="submit"]');
    setBusy(button, true);
    lastSignup = { email: email, city: city, website: form.website.value };
    try {
      await signup(lastSignup);
      $('[data-sent-text]').textContent = T.sent_to(email);
      show('sent');
      startResendTimer();
      views.sent.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    } catch (err) {
      error.textContent = message(err);
      error.hidden = false;
    } finally {
      setBusy(button, false);
    }
  });

  var resend = $('[data-resend]');
  function startResendTimer() {
    var left = 60;
    resend.disabled = true;
    var note = $('[data-sent-note]');
    note.hidden = false;
    note.textContent = T.resend_in(left);
    clearInterval(startResendTimer.t);
    startResendTimer.t = setInterval(function () {
      left -= 1;
      note.textContent = T.resend_in(left);
      if (left <= 0) { clearInterval(startResendTimer.t); resend.disabled = false; note.hidden = true; }
    }, 1000);
  }
  resend.addEventListener('click', async function () {
    if (!lastSignup) return;
    setBusy(resend, true);
    try { await signup(lastSignup); toast(T.resent); startResendTimer(); }
    catch (err) { toast(message(err)); resend.disabled = false; }
    finally { resend.setAttribute('aria-busy', 'false'); }
  });
  $('[data-change]').addEventListener('click', function () { show('form'); form.email.focus(); });

  // ---------- Estado ----------

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
    show('status');
  }

  $('[data-copy]').addEventListener('click', async function () {
    var input = $('[data-link]');
    try { await navigator.clipboard.writeText(input.value); } catch (e) { input.select(); document.execCommand('copy'); }
    toast(T.copied);
  });
  $('[data-native]').addEventListener('click', function () {
    var link = $('[data-link]').value;
    navigator.share({ title: 'Pista', text: T.share_msg, url: link }).catch(function () {});
  });

  async function refreshStatus() {
    if (!statusToken) return;
    try { renderStatus(await api.rpc('waitlist_status', { p_token: statusToken })); } catch (e) { /* se reintenta */ }
  }

  async function start() {
    await loadCounts();
    poll(loadCounts, 20000);
    var confirm = params.get('confirmar') || params.get('confirm');
    var status = params.get('s');
    if (confirm) {
      show('status');
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
      } catch (err) {
        show('form');
        var error = $('[data-error]', form);
        error.textContent = T.err_link;
        error.hidden = false;
      }
      return;
    }
    if (status) {
      statusToken = status;
      try {
        renderStatus(await api.rpc('waitlist_status', { p_token: status }));
        poll(refreshStatus, 60000);
      } catch (err) {
        show('form');
        var e2 = $('[data-error]', form);
        e2.textContent = T.err_link;
        e2.hidden = false;
      }
      return;
    }
    show('form');
    if (refCode) {
      try {
        var r = await api.rpc('waitlist_referrer', { p_code: refCode });
        if (r && r.valid) {
          $('[data-ref]').hidden = false;
          var pick = form.querySelector('input[name="city"][value="' + r.city_slug + '"]');
          if (pick && !form.querySelector('input[name="city"]:checked')) pick.checked = true;
        }
      } catch (e) { /* sin aviso de referido */ }
    }
  }

  start();
})();
