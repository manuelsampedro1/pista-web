/* Pista, panel de embajadores. Entrada con enlace mágico (solo correos dados de alta por el equipo).
   Enseña el enlace y el código, clics, registros, validados, Pista+, ganancias y pagos, con CSV.
   Nunca enseña quién se ha registrado: solo cifras. */
(function () {
  'use strict';
  var api = window.PistaAPI;
  var root = document.querySelector('[data-ambassador]');
  var lang = document.documentElement.lang === 'en' ? 'en' : 'es';
  var money = new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-GB', { style: 'currency', currency: 'EUR' });
  var nf = new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-GB');
  var df = new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  var wf = new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short' });
  var T = {
    es: {
      signin_title: 'Tu panel de embajador', signin_lede: 'Escribe el correo con el que te dimos de alta y te mandamos un enlace para entrar. Sin contraseñas.',
      email: 'Correo', signin_cta: 'Mandarme el enlace',
      sent: 'Si ese correo es de un embajador, te llegará un enlace en un minuto. Ábrelo en este navegador.',
      not_ambassador: 'Esta cuenta no es de embajador. Si crees que es un error, escríbenos.', expired: 'El enlace ha caducado. Pide otro.',
      rate: 'Has pedido varios enlaces seguidos. Espera un poco.', error: 'Algo ha fallado. Recarga la página.',
      hello: function (n) { return 'Hola, ' + n.split(' ')[0]; }, signout: 'Salir',
      your_link: 'Tu enlace', your_code: 'Tu código', copy_link: 'Copiar enlace', copy_code: 'Copiar código', copied: 'Copiado',
      share_msg: 'Pista es la app de citas para gente que entrena. Con mi enlace entras sin lista de espera:',
      paused: 'Tu código está en pausa: ahora mismo no suma registros nuevos.',
      clicks: 'Clics en tu enlace', signups: 'Registros', validated: 'Validados', premium: 'Con Pista+', conversion: 'Registro a validado',
      weeks: 'Últimas 12 semanas', w_signups: 'Registros', w_validated: 'Validados',
      earnings: 'Ganancias', pending: 'Pendiente', approved: 'Aprobado', paid: 'Pagado', cancelled: 'Anulado',
      plan_title: 'Cómo ganas',
      plan: function (p) {
        var parts = [];
        if (p.cpa_validated_cents > 0) parts.push(money.format(p.cpa_validated_cents / 100) + ' por cada registro validado');
        if (p.cpa_premium_cents > 0) parts.push(money.format(p.cpa_premium_cents / 100) + ' por su primer pago de Pista+ (las pruebas gratis no cuentan)');
        if (p.revshare_pct > 0 && p.revshare_months > 0) parts.push('un ' + nf.format(p.revshare_pct) + ' % de lo que pague durante ' + p.revshare_months + ' meses, sin IVA ni la comisión de Apple');
        return parts.length ? 'Ganas ' + parts.join(', ') + '.' : 'Tu plan aún no tiene comisiones.';
      },
      rules: function (m) { return 'Cuenta quien se registra en los ' + m.attribution_window_days + ' días siguientes a abrir tu enlace o escribir tu código. Validado: perfil completo, teléfono verificado y unos días en Pista sin borrar la cuenta. Todo espera ' + m.clawback_days + ' días antes de aprobarse; si la cuenta se borra antes, se anula. Pagamos a partir de ' + money.format(m.payout_minimum_cents / 100) + ' aprobados.'; },
      review: function (n) { return n === 1 ? '1 registro en revisión' : n + ' registros en revisión'; },
      payouts: 'Pagos', none: 'Aún no hay pagos.', date: 'Fecha', amount: 'Importe', reference: 'Referencia',
      csv: 'Descargar movimientos (CSV)', terms: 'Condiciones del programa'
    },
    en: {
      signin_title: 'Your ambassador dashboard', signin_lede: "Enter the email we signed you up with and we'll send you a link. No passwords.",
      email: 'Email', signin_cta: 'Send me the link',
      sent: "If that email belongs to an ambassador, you'll get a link in a minute. Open it in this browser.",
      not_ambassador: "This account isn't an ambassador. If you think that's wrong, write to us.", expired: 'The link has expired. Ask for another.',
      rate: "You've asked for several links in a row. Wait a bit.", error: 'Something went wrong. Reload the page.',
      hello: function (n) { return 'Hi, ' + n.split(' ')[0]; }, signout: 'Sign out',
      your_link: 'Your link', your_code: 'Your code', copy_link: 'Copy link', copy_code: 'Copy code', copied: 'Copied',
      share_msg: 'Pista is the dating app for people who train. With my link you skip the waitlist:',
      paused: "Your code is paused: it isn't counting new sign ups right now.",
      clicks: 'Clicks on your link', signups: 'Sign ups', validated: 'Validated', premium: 'With Pista+', conversion: 'Sign up to validated',
      weeks: 'Last 12 weeks', w_signups: 'Sign ups', w_validated: 'Validated',
      earnings: 'Earnings', pending: 'Pending', approved: 'Approved', paid: 'Paid', cancelled: 'Cancelled',
      plan_title: 'How you earn',
      plan: function (p) {
        var parts = [];
        if (p.cpa_validated_cents > 0) parts.push(money.format(p.cpa_validated_cents / 100) + ' for each validated sign up');
        if (p.cpa_premium_cents > 0) parts.push(money.format(p.cpa_premium_cents / 100) + ' for their first Pista+ payment (free trials don\'t count)');
        if (p.revshare_pct > 0 && p.revshare_months > 0) parts.push(nf.format(p.revshare_pct) + '% of what they pay for ' + p.revshare_months + ' months, after VAT and Apple\'s fee');
        return parts.length ? 'You earn ' + parts.join(', ') + '.' : "Your plan doesn't have commissions yet.";
      },
      rules: function (m) { return 'Anyone who signs up within ' + m.attribution_window_days + ' days of opening your link or typing your code counts for you. Validated: complete profile, verified phone and a few days on Pista without deleting the account. Everything waits ' + m.clawback_days + ' days before it is approved; if the account is deleted before then, it is cancelled. We pay from ' + money.format(m.payout_minimum_cents / 100) + ' approved.'; },
      review: function (n) { return n === 1 ? '1 sign up in review' : n + ' sign ups in review'; },
      payouts: 'Payouts', none: 'No payouts yet.', date: 'Date', amount: 'Amount', reference: 'Reference',
      csv: 'Download ledger (CSV)', terms: 'Programme terms'
    }
  }[lang];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function view(name) {
    root.querySelectorAll('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; });
  }
  function toast(text) {
    var t = document.querySelector('[data-toast]');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast(T.copied); });
  }

  // ---------- Entrada ----------

  function signin(note) {
    root.querySelectorAll('[data-t]').forEach(function (n) { if (T[n.getAttribute('data-t')]) n.textContent = T[n.getAttribute('data-t')]; });
    var box = root.querySelector('[data-signin-note]');
    if (note) { box.textContent = note; box.className = 'notice error'; box.hidden = false; }
    view('signin');
    var form = root.querySelector('[data-signin]');
    form.onsubmit = async function (e) {
      e.preventDefault();
      var email = form.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
      var button = form.querySelector('button');
      button.disabled = true;
      try {
        await api.sendMagicLink(email, location.origin + location.pathname);
        box.textContent = T.sent;
        box.className = 'notice ok';
      } catch (err) {
        box.textContent = err.code === 'RATE_LIMITED' ? T.rate : T.error;
        box.className = 'notice error';
      }
      box.hidden = false;
      button.disabled = false;
    };
  }

  // ---------- Panel ----------

  function kpi(label, value, dark) {
    var k = el('div', 'kpi' + (dark ? ' dark' : ''));
    k.appendChild(el('span', '', label));
    k.appendChild(el('b', '', value));
    return k;
  }

  function render(me, ledger) {
    var dash = root.querySelector('[data-view="dash"]');
    dash.innerHTML = '';
    var s = me.stats || {};

    var head = el('div', 'row between');
    head.appendChild(el('h1', '', T.hello(me.name || '')));
    var out = el('button', 'btn small ghost', T.signout);
    out.type = 'button';
    out.onclick = async function () { await api.signOut(); signin(); };
    head.appendChild(out);
    dash.appendChild(head);

    if (me.status !== 'active') dash.appendChild(el('p', 'notice info', T.paused));

    var share = el('div', 'box');
    share.style.background = 'var(--court)';
    share.style.color = 'var(--paper)';
    share.style.border = '0';
    var codeLine = el('p', '');
    codeLine.appendChild(el('span', 'muted', T.your_code + ' '));
    var code = el('b', '', me.code);
    code.style.font = '500 26px/1.2 ui-monospace, Menlo, monospace';
    codeLine.appendChild(code);
    share.appendChild(codeLine);
    var linkLine = el('p', '', me.link);
    linkLine.style.wordBreak = 'break-all';
    share.appendChild(linkLine);
    var actions = el('div', 'row');
    var b1 = el('button', 'btn small volt', T.copy_link);
    b1.type = 'button';
    b1.onclick = function () { copy(me.link); };
    var b2 = el('button', 'btn small ghost', T.copy_code);
    b2.type = 'button';
    b2.onclick = function () { copy(me.code); };
    var b3 = el('a', 'btn small ghost', 'WhatsApp');
    b3.href = 'https://wa.me/?text=' + encodeURIComponent(T.share_msg + ' ' + me.link);
    b3.target = '_blank';
    b3.rel = 'noopener';
    actions.appendChild(b1);
    actions.appendChild(b2);
    actions.appendChild(b3);
    share.appendChild(actions);
    dash.appendChild(share);

    var grid = el('div', 'grid-cards');
    grid.appendChild(kpi(T.clicks, nf.format(s.clicks || 0)));
    grid.appendChild(kpi(T.signups, nf.format(s.signups || 0)));
    grid.appendChild(kpi(T.validated, nf.format(s.validated || 0), true));
    grid.appendChild(kpi(T.premium, nf.format(s.premium || 0)));
    dash.appendChild(grid);
    var conv = s.signups ? Math.round((s.validated || 0) / s.signups * 100) : 0;
    var convLine = el('p', 'muted', T.conversion + ': ' + conv + ' %' + (s.in_review ? ' · ' + T.review(s.in_review) : ''));
    dash.appendChild(convLine);

    var weeks = el('div', 'box');
    weeks.appendChild(el('h2', '', T.weeks));
    var bars = el('div', 'bars');
    var max = Math.max(1, Math.max.apply(null, (s.weeks || []).map(function (w) { return Math.max(w.signups, w.validated); })));
    (s.weeks || []).forEach(function (w) {
      var col = el('div');
      var pair = el('div');
      pair.style.display = 'grid';
      pair.style.gridTemplateColumns = '1fr 1fr';
      pair.style.gap = '2px';
      pair.style.alignItems = 'end';
      pair.style.height = '100%';
      var a = el('i');
      a.style.height = (w.signups / max * 100) + '%';
      a.title = T.w_signups + ': ' + w.signups;
      var b = el('i', 'alt');
      b.style.height = (w.validated / max * 100) + '%';
      b.title = T.w_validated + ': ' + w.validated;
      pair.appendChild(a);
      pair.appendChild(b);
      col.appendChild(pair);
      col.appendChild(el('small', '', wf.format(new Date(w.week))));
      bars.appendChild(col);
    });
    weeks.appendChild(bars);
    var legend = el('div', 'legend');
    legend.appendChild(el('span', '', T.w_signups));
    legend.appendChild(el('span', 'alt', T.w_validated));
    weeks.appendChild(legend);
    dash.appendChild(weeks);

    var e = (s.earnings || {});
    var earn = el('div', 'box');
    earn.appendChild(el('h2', '', T.earnings));
    var eg = el('div', 'grid-cards');
    eg.appendChild(kpi(T.pending, money.format((e.pending || 0) / 100)));
    eg.appendChild(kpi(T.approved, money.format((e.approved || 0) / 100), true));
    eg.appendChild(kpi(T.paid, money.format((e.paid || 0) / 100)));
    eg.appendChild(kpi(T.cancelled, money.format((e.cancelled || 0) / 100)));
    earn.appendChild(eg);
    earn.appendChild(el('h2', '', T.plan_title));
    earn.appendChild(el('p', '', T.plan(me.plan || {})));
    earn.appendChild(el('p', 'muted', T.rules(me)));
    var terms = el('a', '', T.terms);
    terms.href = lang === 'es' ? '/embajadores/condiciones.html' : '/en/ambassadors/terms.html';
    earn.appendChild(terms);
    dash.appendChild(earn);

    var pays = el('div', 'box');
    var ph = el('div', 'row between');
    ph.appendChild(el('h2', '', T.payouts));
    var csv = el('button', 'btn small ghost', T.csv);
    csv.type = 'button';
    csv.onclick = function () {
      var rows = (ledger || []).map(function (r) {
        return { date: r.created_at, kind: r.kind, amount_eur: (r.amount_cents / 100).toFixed(2), status: r.status,
                 approve_after: r.approve_after, paid_at: r.paid_at, reason: r.reason };
      });
      api.download('pista-' + me.code.toLowerCase() + '.csv',
        api.csv(rows, ['date', 'kind', 'amount_eur', 'status', 'approve_after', 'paid_at', 'reason']));
    };
    ph.appendChild(csv);
    pays.appendChild(ph);
    if (!(me.payouts || []).length) {
      pays.appendChild(el('p', 'muted', T.none));
    } else {
      var wrap = el('div', 'table-wrap');
      var table = el('table', 'data');
      var thead = el('thead');
      var tr = el('tr');
      [T.date, T.reference, T.amount].forEach(function (h, i) { tr.appendChild(el('th', i === 2 ? 'num' : '', h)); });
      thead.appendChild(tr);
      table.appendChild(thead);
      var tbody = el('tbody');
      me.payouts.forEach(function (p) {
        var r = el('tr');
        r.appendChild(el('td', '', df.format(new Date(p.created_at))));
        r.appendChild(el('td', '', p.reference || ''));
        r.appendChild(el('td', 'num', money.format(p.amount_cents / 100)));
        tbody.appendChild(r);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      pays.appendChild(wrap);
    }
    dash.appendChild(pays);
    view('dash');
  }

  async function start() {
    var s;
    try {
      s = await api.session();
    } catch (err) {
      signin(T.expired);
      return;
    }
    if (!s) { signin(); return; }
    try {
      var me = await api.authed('ambassador_me');
      var ledger = await api.authed('ambassador_ledger');
      render(me, ledger);
    } catch (err) {
      if (err.code === 'NOT_ALLOWED') { await api.signOut(); signin(T.not_ambassador); return; }
      if (err.code === 'SIGNED_OUT') { signin(); return; }
      signin(T.error);
    }
  }

  start();
})();
