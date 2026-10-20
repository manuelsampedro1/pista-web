/*
 * Pista. Página pública de un plan compartido: /p/CODIGO o /p/?c=CODIGO.
 * Llama a la RPC public_plan de Supabase con la clave publishable de config.js.
 * Todo el contenido remoto se pinta con textContent, nunca como HTML.
 */
(function () {
  'use strict';

  var cfg = window.PISTA_CONFIG || {};
  var SITE = (cfg.SITE_URL || 'https://pista.one').replace(/\/$/, '');
  var TZ = 'Europe/Madrid';
  var TZ_CANARY = 'Atlantic/Canary';

  var SPORTS = {
    running: 'Running', trail: 'Trail', cycling: 'Ciclismo', swimming: 'Natación', triathlon: 'Triatlón',
    rowing: 'Remo', padel: 'Pádel', tennis: 'Tenis', gym: 'Gimnasio', crossfit: 'CrossFit', hyrox: 'Hyrox',
    calisthenics: 'Calistenia', yoga: 'Yoga', pilates: 'Pilates', dance: 'Baile', football: 'Fútbol',
    basketball: 'Baloncesto', volleyball: 'Voleibol', rugby: 'Rugby', boxing: 'Boxeo',
    martial_arts: 'Artes marciales', climbing: 'Escalada', hiking: 'Senderismo', surf: 'Surf', ski: 'Esquí',
    snowboard: 'Snowboard', sailing: 'Vela', golf: 'Golf', skate: 'Skate'
  };
  var LEVELS = { 1: 'Por diversión', 2: 'Constante', 3: 'A tope' };

  function $(id) { return document.getElementById(id); }
  function text(id, value) { var el = $(id); if (el) el.textContent = value == null ? '' : String(value); return el; }

  function show(state) {
    document.querySelectorAll('[data-state]').forEach(function (el) {
      el.hidden = el.getAttribute('data-state') !== state;
    });
    var active = document.querySelector('[data-state="' + state + '"]');
    if (active) active.setAttribute('aria-busy', 'false');
  }

  function readCode() {
    var q = null;
    try { q = new URLSearchParams(location.search).get('c'); } catch (e) { q = null; }
    var m = location.pathname.match(/\/p\/([A-Za-z0-9]{4,16})\/?$/);
    var raw = (q || (m && m[1]) || '').trim();
    return /^[A-Za-z0-9]{4,16}$/.test(raw) ? raw : null;
  }

  function configured() {
    var url = cfg.SUPABASE_URL || '';
    var key = cfg.SUPABASE_PUBLISHABLE_KEY || '';
    return /^https:\/\/[^\s]+$/.test(url) && key.length > 20 && key !== 'SUPABASE_PUBLISHABLE_KEY';
  }

  function setLinks(code) {
    var deep = SITE + '/p/' + encodeURIComponent(code);
    // Enlace universal: si la app está instalada y se llega desde otra app (WhatsApp, Mensajes...), iOS la abre.
    // Dentro de Safari en este mismo dominio iOS no salta a la app; para eso está el banner inteligente.
    document.querySelectorAll('[data-open-app]').forEach(function (a) { a.href = deep; });
    if (cfg.APP_STORE_URL) {
      document.querySelectorAll('[data-store]').forEach(function (a) { a.href = cfg.APP_STORE_URL; });
    }
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // Hora local del plan: Europe/Madrid, salvo planes en Canarias.
  function zoneFor(lat, lng) {
    return (lat !== null && lng !== null && lat > 27 && lat < 29.6 && lng > -18.5 && lng < -13) ? TZ_CANARY : TZ;
  }

  function formatWhen(iso, minutes, tz) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    var yearOf = function (x) { return new Intl.DateTimeFormat('es-ES', { year: 'numeric', timeZone: tz }).format(x); };
    var day = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }).format(d);
    if (yearOf(d) !== yearOf(new Date())) day += ' de ' + yearOf(d);
    var time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(d);
    var line = 'A las ' + time;
    var dur = formatDuration(minutes);
    if (dur) line += ' · ' + dur;
    return { day: cap(day), line: line, past: d.getTime() + (Number(minutes) || 0) * 60000 < Date.now() };
  }

  function formatDuration(minutes) {
    var m = Number(minutes);
    if (!m || m <= 0) return '';
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '');
  }

  function num(v) { if (v === null || v === undefined || v === '') return null; var n = Number(v); return isFinite(n) ? n : null; }

  function render(plan, code) {
    var title = plan.title || 'Plan en Pista';
    document.title = title + ' · Pista';

    if (plan.status === 'cancelled') {
      text('cancelled-name', title + '. ');
      show('cancelled');
      return;
    }

    text('plan-sport', SPORTS[plan.sport] || cap(String(plan.sport || 'Plan')));
    var level = LEVELS[plan.level];
    var levelEl = text('plan-level', level ? 'Nivel ' + level.toLowerCase() : '');
    levelEl.hidden = !level;
    text('plan-title', title);

    var lat = num(plan.lat), lng = num(plan.lng);
    var when = formatWhen(plan.starts_at, plan.duration_min, zoneFor(lat, lng));
    text('plan-date', when ? when.day : 'Fecha por confirmar');
    text('plan-time', when ? when.line : '');

    var place = plan.place_name || plan.city || '';
    text('plan-place', place || 'Lugar por confirmar');
    var map = $('plan-map');
    if (lat !== null && lng !== null && map) {
      map.href = 'https://maps.apple.com/?ll=' + lat + ',' + lng + '&q=' + encodeURIComponent(place || title);
      map.hidden = false;
    }

    var capacity = num(plan.capacity);
    var taken = num(plan.attendees_count);
    var left = num(plan.spots_left);
    if (left === null && capacity !== null && taken !== null) left = Math.max(0, capacity - taken);
    if (taken === null && capacity !== null && left !== null) taken = Math.max(0, capacity - left);

    var flag = $('plan-flag');
    var past = when && when.past;
    if (past) {
      flag.textContent = 'Ya se jugó';
      flag.hidden = false;
      $('plan-spots-row').hidden = true;
      text('plan-note', 'Este plan ya ha pasado. En la app hay más planes en tu ciudad.');
    } else if (left !== null) {
      text('plan-spots', left <= 0 ? 'Plan completo' : left === 1 ? 'Queda 1 plaza' : 'Quedan ' + left + ' plazas');
      text('plan-capacity', capacity ? (taken || 0) + ' de ' + capacity + ' apuntados' : '');
      if (left <= 0) { flag.textContent = 'Completo'; flag.hidden = false; }
      var bar = $('plan-bar');
      bar.textContent = '';
      if (capacity && capacity <= 30) {
        for (var i = 0; i < capacity; i++) {
          var dot = document.createElement('i');
          if (i >= (taken || 0)) dot.className = 'free';
          bar.appendChild(dot);
        }
      }
    } else {
      $('plan-spots-row').hidden = true;
    }

    var desc = (plan.description || '').trim();
    var descEl = text('plan-desc', desc);
    descEl.hidden = !desc;

    show('plan');
  }

  function rpc(code, withAuth) {
    var key = cfg.SUPABASE_PUBLISHABLE_KEY;
    var headers = { 'Content-Type': 'application/json', 'Accept': 'application/json', 'apikey': key };
    if (withAuth) headers.Authorization = 'Bearer ' + key;
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 12000) : null;
    return fetch(cfg.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/public_plan', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ p_share_code: code }),
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      return res;
    }, function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  function load(code) {
    show('loading');
    rpc(code, true)
      .then(function (res) {
        // Con las claves publishable nuevas, algunos proyectos rechazan la clave en Authorization: reintenta solo con apikey.
        return (res.status === 401 || res.status === 403) ? rpc(code, false) : res;
      })
      .then(function (res) {
        return res.text().then(function (body) {
          var data = null;
          try { data = body ? JSON.parse(body) : null; } catch (e) { data = null; }
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (r) {
        if (!r.ok) {
          var msg = (r.data && (r.data.message || r.data.error)) || '';
          if (/NOT_FOUND|INVALID|not found/i.test(msg)) { show('notfound'); return; }
          show('error');
          return;
        }
        var plan = Array.isArray(r.data) ? r.data[0] : r.data;
        if (!plan || typeof plan !== 'object') { show('notfound'); return; }
        render(plan, code);
      })
      .catch(function () { show('error'); });
  }

  function start() {
    var code = readCode();
    if (!code) {
      text('notfound-text', 'A este enlace le falta el código del plan. Pide a quien te lo pasó que te lo mande otra vez.');
      show('notfound');
      return;
    }
    setLinks(code);
    if (!configured()) {
      text('config-code', code);
      show('config');
      return;
    }
    var retry = $('retry');
    if (retry) retry.addEventListener('click', function () { load(code); });
    load(code);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
