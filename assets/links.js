/* Pista, enlaces cortos que abren la app: /e/CODIGO (embajador), /a/CODIGO (acceso desde la lista de
   espera) e /i/CODIGO (invitación). Si la app está instalada, iOS la abre antes de llegar aquí; esta
   página es para quien aún no la tiene. Español o inglés según el navegador (o ?lang=en). */
(function () {
  'use strict';
  var api = window.PistaAPI;
  var cfg = window.PISTA_CONFIG || {};
  var params = new URLSearchParams(location.search);
  var lang = params.get('lang') === 'en' || (!params.get('lang') && /^en\b/i.test(navigator.language || '')) ? 'en' : 'es';
  var box = document.querySelector('[data-solo]');
  var kind = box.getAttribute('data-solo');

  var T = {
    es: {
      common: { copy: 'Copiar código', copied: 'Copiado', store: 'Descargar Pista', code_label: 'Tu código' },
      e: {
        eyebrow: 'Embajadores de Pista',
        title: function (n) { return n ? n + ' te invita a <em>Pista</em>.' : 'Te invitan a <em>Pista</em>.'; },
        lede: 'Pista es la app de citas para gente que entrena. Con este código entras directo, sin lista de espera.',
        code_label: 'Código de embajador',
        steps: ['Descarga Pista en tu iPhone.', 'Crea tu perfil.', 'Escribe el código donde pone ¿Tienes una invitación o un código?'],
        fallback: '¿Aún no está la app en tu país o en tu iPhone? <a href="/lista/">Apúntate a la lista</a> y guarda el código.',
        invalid: 'Este código no existe o ya no está activo.'
      },
      a: {
        eyebrow: 'Lista de espera',
        title: function () { return 'Ya puedes <em>entrar</em>.'; },
        lede: 'Tu tanda está abierta. Abre este mismo enlace en tu iPhone con Pista instalada y entras directo. Si prefieres, escribe el código en la app.',
        code_label: 'Código de acceso',
        steps: ['Descarga Pista en tu iPhone.', 'Entra con Apple y crea tu perfil.', 'Escribe el código donde pone ¿Tienes una invitación o un código?'],
        fallback: 'El código es solo para ti y caduca. Si se te pasa, escríbenos desde <a href="/soporte.html">soporte</a>.',
        invalid: 'A este enlace le falta el código. Ábrelo desde el correo otra vez.'
      },
      i: {
        eyebrow: 'Invitación',
        title: function (n) { return n ? n + ' te invita a <em>Pista</em>.' : 'Te han invitado a <em>Pista</em>.'; },
        lede: 'Pista es la app de citas para gente que entrena. Con esta invitación entras sin lista de espera.',
        code_label: 'Código de invitación',
        reward: function (r) { return ' Y cuando lleves ' + r.validation_days + ' días con el perfil completo, los dos tenéis ' + r.text + '.'; },
        boosts: function (n) { return n === 1 ? 'un Boost' : n + ' Boosts'; },
        aces: function (n) { return n === 1 ? 'un Ace' : n + ' Aces'; },
        likes: function (n) { return n + ' likes extra'; },
        steps: ['Descarga Pista en tu iPhone.', 'Entra con Apple y crea tu perfil.', 'Escribe el código donde pone ¿Tienes una invitación o un código?'],
        fallback: 'Cada invitación sirve para una persona y caduca a los pocos días.',
        used: 'Esta invitación ya se ha usado o ha caducado. Pide otra a quien te la pasó o <a href="/lista/">apúntate a la lista</a>.',
        invalid: 'A este enlace le falta el código. Pide a quien te invitó que te lo pase otra vez.'
      }
    },
    en: {
      common: { copy: 'Copy code', copied: 'Copied', store: 'Download Pista', code_label: 'Your code' },
      e: {
        eyebrow: 'Pista ambassadors',
        title: function (n) { return n ? n + ' invites you to <em>Pista</em>.' : "You're invited to <em>Pista</em>."; },
        lede: 'Pista is the dating app for people who train. With this code you go straight in, no waitlist.',
        code_label: 'Ambassador code',
        steps: ['Download Pista on your iPhone.', 'Create your profile.', 'Type the code under Got an invite or a code?'],
        fallback: 'Not on your iPhone yet? <a href="/en/waitlist/">Join the waitlist</a> and keep the code.',
        invalid: "This code doesn't exist or isn't active any more."
      },
      a: {
        eyebrow: 'Waitlist',
        title: function () { return 'You can <em>get in</em>.'; },
        lede: 'Your group is open. Open this same link on your iPhone with Pista installed and you go straight in. Or type the code in the app.',
        code_label: 'Access code',
        steps: ['Download Pista on your iPhone.', 'Sign in with Apple and create your profile.', 'Type the code under Got an invite or a code?'],
        fallback: 'The code is just for you and it expires. If you miss it, write to us from <a href="/en/support.html">support</a>.',
        invalid: 'This link is missing its code. Open it from the email again.'
      },
      i: {
        eyebrow: 'Invite',
        title: function (n) { return n ? n + ' invites you to <em>Pista</em>.' : "You've been invited to <em>Pista</em>."; },
        lede: 'Pista is the dating app for people who train. With this invite you skip the waitlist.',
        code_label: 'Invite code',
        reward: function (r) { return ' And after ' + r.validation_days + ' days with a complete profile, you both get ' + r.text + '.'; },
        boosts: function (n) { return n === 1 ? 'a Boost' : n + ' Boosts'; },
        aces: function (n) { return n === 1 ? 'an Ace' : n + ' Aces'; },
        likes: function (n) { return n + ' extra likes'; },
        steps: ['Download Pista on your iPhone.', 'Sign in with Apple and create your profile.', 'Type the code under Got an invite or a code?'],
        fallback: 'Each invite works for one person and expires after a few days.',
        used: 'This invite has been used or has expired. Ask whoever sent it for another, or <a href="/en/waitlist/">join the waitlist</a>.',
        invalid: 'This link is missing its code. Ask whoever invited you to send it again.'
      }
    }
  }[lang];
  var t = T[kind];

  // Los nombres los escribe la gente: nunca entran como HTML sin escapar.
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function set(name, value, isHtml) {
    var el = box.querySelector('[data-t="' + name + '"]');
    if (!el) return;
    if (isHtml) el.innerHTML = value; else el.textContent = value;
  }

  function readCode() {
    var raw = params.get('c') || (location.pathname.match(/\/[eai]\/([A-Za-z0-9-]{4,30})\/?$/) || [])[1] || '';
    raw = raw.toUpperCase().replace(/\s/g, '');
    if (kind === 'e') return /^PISTA-?[A-Z0-9]{2,20}$/.test(raw) ? raw.replace(/^PISTA-?/, 'PISTA-') : null;
    var clean = raw.replace(/-/g, '');
    if (kind === 'a') return /^[A-HJ-NP-Z2-9]{12}$/.test(clean) ? clean : null;
    return /^[A-HJ-NP-Z2-9]{8}$/.test(clean) ? clean : null;
  }

  function error(html) {
    var el = box.querySelector('[data-error]');
    el.innerHTML = html;
    el.hidden = false;
  }

  function showCode(code) {
    var shown = kind === 'a' ? code.replace(/(.{4})(?=.)/g, '$1 ') : code;
    box.querySelector('[data-code]').textContent = shown;
    box.querySelector('[data-plate]').hidden = false;
    var btn = box.querySelector('[data-copy]');
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var done = function () {
        btn.textContent = T.common.copied;
        setTimeout(function () { btn.textContent = T.common.copy; }, 2000);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, function () {});
    });
  }

  async function start() {
    document.documentElement.lang = lang;
    set('eyebrow', t.eyebrow);
    set('title', t.title(''), true);
    set('lede', t.lede);
    set('code_label', t.code_label);
    set('copy', T.common.copy);
    set('store', T.common.store);
    set('fallback', t.fallback, true);
    box.querySelector('[data-steps]').innerHTML = t.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('');
    // Sin app publicada no hay botón de la App Store.
    if (cfg.APP_STORE_URL) { box.querySelector('[data-store]').href = cfg.APP_STORE_URL; box.querySelector('[data-store]').hidden = false; }
    box.querySelector('[data-copy]').hidden = true;

    var code = readCode();
    if (!code) { error(t.invalid); return; }
    // Para quien tenga la app: que el banner de Safari la abra con este enlace.
    var meta = document.querySelector('meta[name="apple-itunes-app"]');
    var appId = meta && (meta.getAttribute('content').match(/app-id=(\d+)/) || [])[1];
    if (appId) meta.setAttribute('content', 'app-id=' + appId + ', app-argument=' + location.origin + '/' + kind + '/' + code);

    if (kind === 'e') {
      try {
        var a = await api.rpc('ambassador_click', { p_code: code });
        if (!a || !a.valid) { error(t.invalid); return; }
        set('title', t.title(escapeHtml(a.name)), true);
        showCode(a.code);
      } catch (e) { showCode(code); }
      return;
    }
    if (kind === 'i') {
      try {
        var inv = await api.rpc('public_invite', { p_code: code });
        if (!inv) { error(t.used); return; }
        set('title', t.title(escapeHtml(inv.inviter_name)), true);
        if (!inv.valid) { error(t.used); return; }
        var r = inv.reward || {};
        var text = r.type === 'boosts' && r.boosts > 0 ? t.boosts(r.boosts)
          : r.type === 'aces' && r.aces > 0 ? t.aces(r.aces)
          : r.type === 'likes' && r.likes > 0 ? t.likes(r.likes) : '';
        if (text) set('lede', t.lede + t.reward({ validation_days: r.validation_days, text: text }));
      } catch (e) { /* se enseña el código igualmente */ }
    }
    showCode(code);
  }

  start();
})();
