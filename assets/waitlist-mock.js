/* Pista, respuestas de prueba de la lista de espera. Solo se carga con ?mock=1 o en localhost (waitlist.js).
   Imita waitlist_join, waitlist_profile, waitlist_status, waitlist_confirm y waitlist_referrer sin tocar el
   servidor, para diseñar y probar cada estado sin que nadie cuente en la lista de verdad. El contador
   (waitlist_counts, de solo lectura) sí va al servidor, salvo con ?mock_total=N.

   Parámetros:
     mock_join=joined|check_email|INVALID:name|INVALID:email|INVALID:city|DISPOSABLE_EMAIL|RATE_LIMITED|NETWORK
     mock_pos=308            puesto al apuntarse
     mock_status=pending|confirmed|admitted|joined   para /lista/?s=...
     mock_profile=ok|INVALID:consent|RATE_LIMITED
     mock_ref=Laura          nombre de quien invita (con ?r=CODIGO); mock_ref= (vacío) para un código que no existe
     mock_profile_done=1     la tarjeta ya trae el perfil hecho
     mock_refs=3             personas traídas
     mock_total=307          contador sin llamar al servidor */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var lang = document.documentElement.lang === 'en' ? 'en' : 'es';
  var get = function (k, def) { return params.has(k) ? params.get(k) : def; };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var fail = function (spec) {
    var parts = String(spec).split(':');
    return { code: parts[0], status: 400, detail: parts[1] || null };
  };
  var TOTAL = parseInt(get('mock_total', '307'), 10) || 307;
  var card = {
    status: 'pending', first_name: 'Laura', city_slug: 'madrid', city_name: 'Madrid', position: parseInt(get('mock_pos', '308'), 10) || 308,
    total: TOTAL + 1, waiting: TOTAL + 1, points: 50, share_code: 'K7M2Q9XA', share_url: 'https://pista.one/r/K7M2Q9XA',
    referrals: parseInt(get('mock_refs', '0'), 10) || 0, referral_points: 50, welcome_points: 50, profile_points: 25,
    profile_done: get('mock_profile_done', '') === '1', referred_by_name: null, city_open: false, locale: lang, access_expires_at: null
  };
  var copy = function (extra) { return Object.assign({}, card, extra || {}); };

  async function rpc(name, p) {
    p = p || {};
    if (name === 'waitlist_counts') {
      if (!params.has('mock_total') && window.PistaAPI) return window.PistaAPI.rpc('waitlist_counts');
      return { total: TOTAL, launch_city: 'madrid', cities: [] };
    }
    await wait(name === 'waitlist_referrer' ? 250 : 700);
    if (name === 'waitlist_join') {
      var spec = get('mock_join', 'joined');
      if (spec === 'check_email') return { ok: true, status: 'check_email' };
      if (spec !== 'joined') throw fail(spec);
      var first = String(p.p_name || 'Laura').trim().split(/\s+/)[0];
      card.first_name = first.charAt(0).toUpperCase() + first.slice(1);
      card.city_slug = p.p_city || 'madrid';
      var sel = document.querySelector('select[name="city"] option[value="' + card.city_slug + '"]');
      card.city_name = card.city_slug === 'madrid' ? 'Madrid' : (sel ? sel.textContent : card.city_slug);
      return copy({ ok: true, status: 'joined', entry_status: 'pending', status_token: 'mocktoken' });
    }
    if (name === 'waitlist_profile') {
      var ps = get('mock_profile', 'ok');
      if (ps !== 'ok') throw fail(ps);
      if (!p.p_consent) throw fail('INVALID:consent');
      card.position = Math.max(1, card.position - card.profile_points);
      card.points += card.profile_points;
      card.profile_done = true;
      return copy({ status: get('mock_status', 'pending') });
    }
    if (name === 'waitlist_status') {
      if (p.p_token === 'bad') throw fail('NOT_FOUND');
      return copy({ status: get('mock_status', 'confirmed'), position: Math.max(1, card.position - card.referral_points * card.referrals) });
    }
    if (name === 'waitlist_confirm') {
      if (p.p_token === 'bad') throw fail('NOT_FOUND');
      return copy({ status: 'confirmed', status_token: 'mocktoken' });
    }
    if (name === 'waitlist_referrer') {
      return { first_name: get('mock_ref', 'Laura') || null };
    }
    throw fail('SERVER_ERROR');
  }

  window.PistaMockAPI = { rpc: rpc };
  if (window.console) console.info('Pista: lista de espera en modo de prueba (no se envía nada).');
})();
