/* Pista, cliente mínimo de Supabase para la web, sin dependencias.
   - rpc(): funciones públicas con la clave publishable (lista de espera, invitaciones, embajadores).
   - Paneles de embajador y admin: entrada con enlace mágico. La sesión vive solo en sessionStorage,
     que el navegador borra al cerrar la pestaña. Nada de cookies. */
(function () {
  'use strict';
  var cfg = window.PISTA_CONFIG || {};
  var base = String(cfg.SUPABASE_URL || '').replace(/\/$/, '');
  var key = String(cfg.SUPABASE_PUBLISHABLE_KEY || '');
  var SESSION_KEY = 'pista.session';

  function ApiError(code, status, detail) {
    this.code = code;
    this.status = status || 0;
    this.detail = detail || null;
  }

  function configured() {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base) && /^sb_publishable_/.test(key);
  }

  function headers(token) {
    return { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + (token || key) };
  }

  async function rpc(name, params, token) {
    if (!configured()) throw new ApiError('NOT_CONFIGURED');
    var res;
    try {
      res = await fetch(base + '/rest/v1/rpc/' + name, {
        method: 'POST', headers: headers(token), body: JSON.stringify(params || {})
      });
    } catch (e) {
      throw new ApiError('NETWORK');
    }
    var text = await res.text();
    var body = null;
    try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
    if (!res.ok) {
      var message = body && typeof body.message === 'string' ? body.message : '';
      var code = /^[A-Z_]{3,32}$/.test(message) ? message
        : (body && body.code === 'PGRST301') || res.status === 401 ? 'SESSION_EXPIRED'
        : res.status === 403 ? 'NOT_ALLOWED' : 'SERVER_ERROR';
      throw new ApiError(code, res.status, body && body.details);
    }
    return body;
  }

  // ---------- Sesión de los paneles ----------

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }
  function saveSession(s) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) { /* modo privado */ }
  }
  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* nada */ }
  }

  // Al volver del enlace, Supabase deja los tokens en el fragmento (#access_token=...).
  function sessionFromHash() {
    var hash = new URLSearchParams(location.hash.slice(1));
    if (hash.get('error_description') || hash.get('error')) {
      history.replaceState(null, '', location.pathname + location.search);
      throw new ApiError('LINK_EXPIRED', 0, hash.get('error_description'));
    }
    if (!hash.get('access_token')) return null;
    var s = {
      access_token: hash.get('access_token'),
      refresh_token: hash.get('refresh_token'),
      expires_at: Number(hash.get('expires_at')) || Math.floor(Date.now() / 1000) + Number(hash.get('expires_in') || 3600)
    };
    saveSession(s);
    history.replaceState(null, '', location.pathname + location.search);
    return s;
  }

  async function refresh(s) {
    if (!s || !s.refresh_token) { clearSession(); return null; }
    try {
      var res = await fetch(base + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      if (!res.ok) { clearSession(); return null; }
      var b = await res.json();
      var next = { access_token: b.access_token, refresh_token: b.refresh_token,
                   expires_at: b.expires_at || Math.floor(Date.now() / 1000) + (b.expires_in || 3600) };
      saveSession(next);
      return next;
    } catch (e) {
      return s;
    }
  }

  async function session() {
    var s = sessionFromHash() || readSession();
    if (!s) return null;
    if ((s.expires_at || 0) - 60 < Date.now() / 1000) s = await refresh(s);
    return s;
  }

  // Solo para correos que ya tienen acceso (create_user: false). La respuesta no se enseña tal cual,
  // para no decir a nadie qué correos están dados de alta.
  async function sendMagicLink(email, redirectTo) {
    if (!configured()) throw new ApiError('NOT_CONFIGURED');
    var res;
    try {
      res = await fetch(base + '/auth/v1/otp?redirect_to=' + encodeURIComponent(redirectTo), {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key },
        body: JSON.stringify({ email: email, create_user: false })
      });
    } catch (e) {
      throw new ApiError('NETWORK');
    }
    if (res.status === 429) throw new ApiError('RATE_LIMITED', 429);
    return true;
  }

  async function authed(name, params) {
    var s = await session();
    if (!s) throw new ApiError('SIGNED_OUT');
    try {
      return await rpc(name, params, s.access_token);
    } catch (e) {
      if (e.code !== 'SESSION_EXPIRED') throw e;
      s = await refresh(s);
      if (!s) throw new ApiError('SIGNED_OUT');
      return await rpc(name, params, s.access_token);
    }
  }

  async function callFunction(name, body) {
    var s = await session();
    if (!s) throw new ApiError('SIGNED_OUT');
    var res = await fetch(base + '/functions/v1/' + name, {
      method: 'POST', headers: headers(s.access_token), body: JSON.stringify(body || {})
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new ApiError(data.error || 'SERVER_ERROR', res.status);
    return data;
  }

  async function signOut() {
    var s = readSession();
    clearSession();
    if (s && s.access_token) {
      try { await fetch(base + '/auth/v1/logout', { method: 'POST', headers: headers(s.access_token) }); } catch (e) { /* nada */ }
    }
  }

  // ---------- Utilidades de página ----------

  function csv(rows, columns) {
    var esc = function (v) {
      if (v === null || v === undefined) return '';
      var s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      // Evita que una celda que empieza por = o + se ejecute como fórmula en una hoja de cálculo
      // (los importes negativos se quedan como números).
      if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    var lines = [columns.join(',')];
    rows.forEach(function (r) { lines.push(columns.map(function (c) { return esc(r[c]); }).join(',')); });
    return '﻿' + lines.join('\n');
  }

  function download(name, content) {
    var blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  window.PistaAPI = {
    configured: configured, rpc: rpc, session: session, sendMagicLink: sendMagicLink, authed: authed,
    callFunction: callFunction, signOut: signOut, csv: csv, download: download, ApiError: ApiError
  };
})();
