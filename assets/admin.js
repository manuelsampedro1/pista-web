/* Pista, panel de admin. Todo pasa por funciones admin_* que comprueban is_admin en el servidor:
   esta página no decide nada, solo enseña y pide. */
(function () {
  'use strict';
  var api = window.PistaAPI;
  var root = document.querySelector('[data-admin]');
  var pane = root.querySelector('[data-pane]');
  var money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
  var nf = new Intl.NumberFormat('es-ES');
  var dtf = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  var TABS = [
    ['overview', 'Resumen'], ['config', 'Configuración'], ['cities', 'Ciudades'], ['waitlist', 'Lista de espera'],
    ['ambassadors', 'Embajadores'], ['denuncias', 'Denuncias'], ['review', 'Antifraude'], ['funnel', 'Embudo']
  ];
  var ERR = {
    INVALID: 'Valor no válido. Revisa el tipo y el rango.', NOT_ALLOWED: 'Esta cuenta no es admin.',
    BELOW_MINIMUM: 'El saldo aprobado no llega al mínimo de pago.', NETWORK: 'Sin conexión.',
    SIGNED_OUT: 'La sesión ha caducado. Vuelve a entrar.'
  };

  // ---------- Utilidades ----------

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function toast(text) {
    var t = document.querySelector('[data-toast]');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function fail(err) { toast(ERR[err && err.code] || 'Error: ' + ((err && err.code) || 'desconocido')); }
  function date(v) { return v ? dtf.format(new Date(v)) : ''; }
  function euros(c) { return money.format((c || 0) / 100); }
  function tag(text, kind) { return el('span', { class: 'tag' + (kind ? ' ' + kind : ''), text: text }); }
  var KIND = { cpa_validated: 'Registro validado', cpa_premium: 'Primer pago Pista+', revshare: 'Parte del pago', adjustment: 'Ajuste' };
  var STATE = { pending: 'Pendiente', approved: 'Aprobada', paid: 'Pagada', clawed_back: 'Recuperada', void: 'Anulada',
                active: 'Activo', paused: 'En pausa', closed: 'Cerrado' };
  function planText(p) {
    p = p || {};
    var parts = [];
    if (p.cpa_validated_cents > 0) parts.push(euros(p.cpa_validated_cents) + ' por validado');
    if (p.cpa_premium_cents > 0) parts.push(euros(p.cpa_premium_cents) + ' por primer pago');
    if (p.revshare_pct > 0 && p.revshare_months > 0) parts.push(p.revshare_pct + ' % durante ' + p.revshare_months + ' meses');
    return parts.length ? parts.join(' · ') : 'Sin comisiones';
  }
  function table(columns, rows) {
    var thead = el('thead', {}, [el('tr', {}, columns.map(function (c) { return el('th', { class: c.num ? 'num' : '', text: c.label }); }))]);
    var tbody = el('tbody', {}, rows.map(function (r) {
      return el('tr', {}, columns.map(function (c) {
        var v = c.render ? c.render(r) : r[c.key];
        var td = el('td', { class: c.num ? 'num' : '' });
        if (v instanceof Node) td.appendChild(v); else td.textContent = v === null || v === undefined ? '' : String(v);
        return td;
      }));
    }));
    return el('div', { class: 'table-wrap' }, [el('table', { class: 'data' }, [thead, tbody])]);
  }
  async function call(name, params) {
    try { return await api.authed(name, params); }
    catch (err) {
      if (err.code === 'SIGNED_OUT' || err.code === 'NOT_ALLOWED') { await api.signOut(); signin(ERR[err.code]); }
      throw err;
    }
  }
  function box(title, children) { return el('div', { class: 'box' }, [title ? el('h2', { text: title }) : null].concat(children)); }
  function kpi(label, value, dark) { return el('div', { class: 'kpi' + (dark ? ' dark' : '') }, [el('span', { text: label }), el('b', { text: value })]); }

  // ---------- Entrada ----------

  function view(name) { root.querySelectorAll('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; }); }

  function signin(note) {
    view('signin');
    var form = root.querySelector('[data-signin]');
    var box2 = root.querySelector('[data-signin-note]');
    if (note) { box2.textContent = note; box2.className = 'notice error'; box2.hidden = false; }
    form.onsubmit = async function (e) {
      e.preventDefault();
      var button = form.querySelector('button');
      button.disabled = true;
      try {
        await api.sendMagicLink(form.email.value.trim(), location.origin + location.pathname);
        box2.textContent = 'Si es un correo de admin, te llega un enlace en un minuto. Ábrelo en este navegador.';
        box2.className = 'notice ok';
      } catch (err) {
        box2.textContent = err.code === 'RATE_LIMITED' ? 'Demasiados enlaces seguidos. Espera un poco.' : 'No se ha podido enviar.';
        box2.className = 'notice error';
      }
      box2.hidden = false;
      button.disabled = false;
    };
  }

  // ---------- Pestañas ----------

  var current = 'overview';
  function tabs() {
    var bar = root.querySelector('[data-tabs]');
    bar.innerHTML = '';
    TABS.forEach(function (t) {
      bar.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': t[0] === current ? 'true' : 'false', text: t[1],
        onclick: function () { current = t[0]; history.replaceState(null, '', '#' + t[0]); tabs(); open(); } }));
    });
  }
  async function open() {
    pane.innerHTML = '';
    pane.appendChild(el('p', { class: 'muted', text: 'Cargando...' }));
    try { await PANES[current](); } catch (err) { pane.innerHTML = ''; pane.appendChild(el('p', { class: 'notice error', text: ERR[err.code] || 'No se ha podido cargar.' })); }
  }

  var PANES = {};

  PANES.overview = async function () {
    var o = await call('admin_overview');
    var w = o.waitlist || {};
    var a = o.accounts || {};
    pane.innerHTML = '';
    pane.appendChild(el('div', { class: 'stack' }, [
      el('div', { class: 'grid-cards' }, [
        kpi('Lista: confirmados', nf.format(w.confirmed || 0), true), kpi('Lista: sin confirmar', nf.format(w.pending || 0)),
        kpi('Admitidos desde la lista', nf.format((w.admitted || 0) + (w.joined || 0))), kpi('Perfiles completos', nf.format(a.completed || 0)),
        kpi('Dentro de la app', nf.format(a.admitted || 0), true), kpi('Esperando en la app', nf.format(a.waiting || 0)),
        kpi('Validados', nf.format(a.validated || 0)), kpi('Pista+ activos', nf.format(a.premium || 0)),
        kpi('Denuncias abiertas', nf.format(o.open_reports || 0), o.open_reports > 0), kpi('Cuentas suspendidas', nf.format(a.suspended || 0)),
        kpi('Invitaciones esta semana', nf.format(o.invites_this_week || 0)), kpi('Antifraude por revisar', nf.format(o.open_flags || 0), o.open_flags > 0),
        kpi('Comisiones pendientes', euros((o.commissions || {}).pending)), kpi('Comisiones aprobadas', euros((o.commissions || {}).approved))
      ]),
      o.oldest_open_report && Date.now() - new Date(o.oldest_open_report).getTime() > 20 * 3600 * 1000
        ? el('p', { class: 'notice error', text: 'Hay una denuncia de hace casi un día o más. Prometemos revisarlas en menos de 24 horas.' }) : null,
      o.emails_queued ? el('p', { class: 'notice info', text: o.emails_queued + ' correos en cola. Si no bajan, revisa RESEND_API_KEY y MAIL_FROM en Supabase.' }) : null
    ]));
  };

  PANES.config = async function () {
    var rows = await call('admin_config');
    pane.innerHTML = '';
    var groups = {};
    rows.forEach(function (r) { (groups[r.category] = groups[r.category] || []).push(r); });
    var stack = el('div', { class: 'stack' });
    stack.appendChild(el('p', { class: 'muted', text: 'Cada cambio se aplica al momento y queda en el historial con quién lo hizo.' }));
    Object.keys(groups).forEach(function (cat) {
      stack.appendChild(box(cat, groups[cat].map(configRow)));
    });
    pane.appendChild(stack);
  };

  function configRow(r) {
    var input;
    if (r.kind === 'bool') {
      input = el('input', { type: 'checkbox' });
      input.checked = r.value === true;
      input = el('label', { class: 'toggle' }, [input, el('span')]);
    } else if (r.kind === 'enum') {
      input = el('select', { class: 'input' }, (r.options || []).map(function (o) {
        var opt = el('option', { value: o, text: o });
        if (o === r.value) opt.selected = true;
        return opt;
      }));
    } else {
      input = el('input', { class: 'input', type: r.kind === 'text' ? 'text' : 'number', value: r.value,
        min: r.min, max: r.max, step: r.kind === 'int' ? '1' : 'any' });
    }
    var save = el('button', { class: 'btn small', type: 'button', text: 'Guardar' });
    var meta = el('p', { class: 'meta', text: (r.min !== null || r.max !== null ? 'Rango ' + (r.min ?? '') + ' a ' + (r.max ?? '') + ' · ' : '') +
      (r.updated_by ? 'Cambiado por ' + r.updated_by + ' el ' + date(r.updated_at) : 'Valor de origen') });
    save.onclick = async function () {
      var value;
      if (r.kind === 'bool') value = input.querySelector('input').checked;
      else if (r.kind === 'enum' || r.kind === 'text') value = input.value;
      else value = Number(input.value);
      if (r.kind !== 'bool' && r.kind !== 'enum' && r.kind !== 'text' && !Number.isFinite(value)) { toast(ERR.INVALID); return; }
      save.disabled = true;
      try {
        await call('admin_set_config', { p_key: r.key, p_value: value });
        toast('Guardado: ' + r.key);
        meta.textContent = 'Guardado ahora';
      } catch (err) { fail(err); }
      save.disabled = false;
    };
    var history = el('button', { class: 'btn small ghost', type: 'button', text: 'Historial', onclick: async function () {
      try {
        var h = await call('admin_config_history', { p_key: r.key });
        alertBox(r.key, h.length ? h.map(function (x) { return date(x.at) + ': ' + JSON.stringify(x.old) + ' a ' + JSON.stringify(x.new) + (x.by ? ' (' + x.by + ')' : ''); }).join('\n') : 'Sin cambios.');
      } catch (err) { fail(err); }
    } });
    return el('div', { class: 'config-row' }, [
      el('div', {}, [el('p', { class: 'k', text: r.key }), el('p', { class: 'd', text: r.description }), meta]),
      el('div', { class: 'ctl' }, [input, el('div', { class: 'row' }, [save, history])])
    ]);
  }

  function alertBox(title, text) {
    var dialog = el('dialog', { class: 'box' }, [el('h2', { text: title }), el('pre', { text: text, style: 'white-space:pre-wrap;font-size:13px;margin:0' }),
      el('button', { class: 'btn small', type: 'button', text: 'Cerrar', onclick: function () { dialog.close(); dialog.remove(); } })]);
    dialog.style.maxWidth = '640px';
    document.body.appendChild(dialog);
    dialog.showModal();
  }

  var GENDERS = { woman: 'mujeres', man: 'hombres', nonbinary: 'no binarias', unknown: 'sin dato' };
  var GENDER_ONE = { woman: 'mujer', man: 'hombre', nonbinary: 'no binario' };
  function mix(obj, names) {
    var keys = Object.keys(obj || {});
    if (!keys.length) return '';
    return keys.sort(function (a, b) { return obj[b] - obj[a]; })
      .map(function (k) { return nf.format(obj[k]) + ' ' + (names ? names[k] || k : k); }).join(' · ');
  }

  PANES.cities = async function () {
    var rows = await call('admin_cities');
    pane.innerHTML = '';
    var preview = el('div');
    var t = table([
      { label: 'Ciudad', render: function (r) { return el('span', {}, [r.name + ' ', tag(r.status === 'open' ? 'abierta' : 'lista', r.status === 'open' ? 'ok' : ''),
          r.launch_order ? tag('abre ' + r.launch_order + 'ª', 'warn') : '']); } },
      { label: 'Sin confirmar', key: 'pending', num: true }, { label: 'Esperando', key: 'waiting', num: true },
      { label: 'De ellos en la app', key: 'waiting_in_app', num: true }, { label: 'Con código', key: 'admitted', num: true },
      { label: 'Ya dentro', key: 'joined', num: true }, { label: 'Cuentas', key: 'accounts', num: true },
      { label: 'Quién espera', render: function (r) {
        return el('div', { class: 'muted', style: 'font-size:13px;line-height:1.4;max-width:220px' }, [
          el('div', { text: mix(r.waiting_gender, GENDERS) }), el('div', { text: mix(r.waiting_sports) })]); } },
      { label: 'Tanda', render: function (r) {
        var n = el('input', { class: 'input', type: 'number', min: 1, max: 5000, value: 50, style: 'width:90px;height:40px' });
        var bal = el('input', { type: 'checkbox', checked: true });
        return el('div', { class: 'row' }, [n,
          el('label', { class: 'check', style: 'grid-template-columns:22px auto;font-size:13px', title: 'Alterna mujeres, hombres y el resto para que la tanda salga equilibrada' },
            [bal, el('span', { text: 'Equilibrar' })]),
          el('button', { class: 'btn small ghost', type: 'button', text: 'Ver', onclick: async function () {
            var list = await call('admin_batch_preview', { p_city: r.slug, p_count: Number(n.value), p_balance: bal.checked });
            preview.innerHTML = '';
            preview.appendChild(box('Próxima tanda en ' + r.name + ' (' + list.length + ')', [table([
              { label: '#', key: 'position', num: true }, { label: 'Correo', render: function (x) { return x.email || 'Cuenta de la app'; } },
              { label: 'Género', render: function (x) { return GENDER_ONE[x.gender] || ''; } },
              { label: 'Deportes', render: function (x) { return (x.sports || []).join(', '); } },
              { label: 'Puntos', key: 'points', num: true }, { label: 'Desde', render: function (x) { return date(x.created_at); } }
            ], list)]));
          } }),
          el('button', { class: 'btn small', type: 'button', text: 'Admitir', onclick: async function () {
            if (!confirm('¿Admitir a ' + n.value + ' personas de ' + r.name + (bal.checked ? ', equilibrando por género' : ', por orden de la lista') + '? Les llega el correo con su código.')) return;
            try { var res = await call('admin_admit_batch', { p_city: r.slug, p_count: Number(n.value), p_balance: bal.checked }); toast(res.admitted + ' admitidos'); open(); } catch (err) { fail(err); }
          } })]);
      } },
      { label: '', render: function (r) {
        return r.status === 'open'
          ? el('button', { class: 'btn small ghost', type: 'button', text: 'Cerrar', onclick: async function () {
              if (!confirm('¿Volver a poner ' + r.name + ' en lista de espera? Quien ya está dentro sigue dentro.')) return;
              try { await call('admin_close_city', { p_city: r.slug }); open(); } catch (err) { fail(err); } } })
          : el('button', { class: 'btn small volt', type: 'button', text: 'Abrir ciudad', onclick: async function () {
              if (!confirm('¿Abrir ' + r.name + '? Entran todos los que esperan y quien se registre a partir de ahora.')) return;
              try { var res = await call('admin_open_city', { p_city: r.slug }); toast(res.admitted + ' admitidos'); open(); } catch (err) { fail(err); } } });
      } }
    ], rows);
    var form = el('form', { class: 'row' }, [
      el('input', { class: 'input', name: 'slug', placeholder: 'slug (sevilla)', required: true, style: 'max-width:180px' }),
      el('input', { class: 'input', name: 'name', placeholder: 'Nombre', required: true, style: 'max-width:200px' }),
      el('input', { class: 'input', name: 'position', type: 'number', value: 50, style: 'max-width:110px' }),
      el('label', { class: 'check', style: 'grid-template-columns:24px auto' }, [el('input', { type: 'checkbox', name: 'listed', checked: true }), el('span', { text: 'En el formulario' })]),
      el('button', { class: 'btn small', type: 'submit', text: 'Añadir o editar' })
    ]);
    form.onsubmit = async function (e) {
      e.preventDefault();
      try {
        await call('admin_city_upsert', { p_slug: form.slug.value, p_name: form.name.value, p_listed: form.listed.checked, p_position: Number(form.position.value) });
        toast('Ciudad guardada'); open();
      } catch (err) { fail(err); }
    };
    pane.appendChild(el('div', { class: 'stack' }, [box('Ciudades', [t]), preview, box('Añadir ciudad', [form])]));
  };

  PANES.waitlist = async function () {
    pane.innerHTML = '';
    var state = { city: null, status: null, search: '', offset: 0 };
    var results = el('div');
    var cities = await call('admin_cities');
    var cityS = el('select', { class: 'input', style: 'max-width:200px' }, [el('option', { value: '', text: 'Todas las ciudades' })]
      .concat(cities.map(function (c) { return el('option', { value: c.slug, text: c.name }); })));
    var statusS = el('select', { class: 'input', style: 'max-width:200px' }, [['', 'Todos'], ['pending', 'Sin confirmar'], ['confirmed', 'Esperando'], ['admitted', 'Con código'], ['joined', 'Dentro']]
      .map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
    var search = el('input', { class: 'input', type: 'search', placeholder: 'Correo o código', style: 'max-width:240px' });
    async function load() {
      var data = await call('admin_waitlist', { p_city: state.city, p_status: state.status, p_search: state.search || null, p_limit: 100, p_offset: state.offset });
      results.innerHTML = '';
      results.appendChild(el('p', { class: 'muted', text: nf.format(data.total) + ' en total' }));
      results.appendChild(table([
        { label: 'Correo', render: function (r) { return r.email || 'Cuenta de la app'; } }, { label: 'Ciudad', key: 'city' },
        { label: 'Perfil', render: function (r) {
          var bits = [GENDER_ONE[r.gender], (r.seeking || []).length ? 'busca ' + r.seeking.map(function (g) { return GENDERS[g]; }).join(' y ') : '', (r.sports || []).join(', ')];
          return el('span', { class: 'muted', style: 'font-size:13px', text: bits.filter(Boolean).join(' · ') });
        } },
        { label: 'Estado', render: function (r) { return tag(r.status, r.status === 'joined' ? 'ok' : r.status === 'pending' ? '' : 'warn'); } },
        { label: 'Puesto', key: 'position', num: true }, { label: 'Puntos', key: 'points', num: true }, { label: 'Ha traído', key: 'referrals', num: true },
        { label: 'Alta', render: function (r) { return date(r.created_at); } },
        { label: '', render: function (r) {
          return r.status === 'admitted' && !r.in_app ? el('button', { class: 'btn small ghost', type: 'button', text: 'Reenviar código', onclick: async function () {
            if (!confirm('Se genera un código nuevo y el anterior deja de valer. ¿Seguro?')) return;
            try { await call('admin_resend_access', { p_id: r.id }); toast('Código reenviado'); } catch (err) { fail(err); } } }) : '';
        } }
      ], data.rows));
      var nav = el('div', { class: 'row' }, [
        el('button', { class: 'btn small ghost', type: 'button', text: 'Anteriores', disabled: state.offset === 0, onclick: function () { state.offset = Math.max(0, state.offset - 100); load(); } }),
        el('button', { class: 'btn small ghost', type: 'button', text: 'Siguientes', disabled: state.offset + 100 >= data.total, onclick: function () { state.offset += 100; load(); } })
      ]);
      results.appendChild(nav);
    }
    var filters = el('form', { class: 'row' }, [cityS, statusS, search, el('button', { class: 'btn small', type: 'submit', text: 'Filtrar' }),
      el('button', { class: 'btn small ghost', type: 'button', text: 'Exportar CSV', onclick: async function () {
        try {
          var rows = await call('admin_waitlist_export', { p_city: state.city, p_status: state.status });
          api.download('pista-lista-' + new Date().toISOString().slice(0, 10) + '.csv', api.csv(rows,
            ['email', 'city', 'locale', 'status', 'position', 'points', 'gender', 'seeking', 'sports', 'referred', 'referrals', 'created_at', 'consent_at', 'profile_consent_at', 'confirmed_at', 'admitted_at', 'joined_at']));
        } catch (err) { fail(err); }
      } })]);
    filters.onsubmit = function (e) {
      e.preventDefault();
      state = { city: cityS.value || null, status: statusS.value || null, search: search.value.trim(), offset: 0 };
      load();
    };
    pane.appendChild(el('div', { class: 'stack' }, [box('Lista de espera', [filters, results])]));
    await load();
  };

  PANES.ambassadors = async function () {
    var list = await call('admin_ambassadors');
    pane.innerHTML = '';
    var detail = el('div');
    var t = table([
      { label: 'Código', render: function (a) { return el('b', { text: a.code }); } }, { label: 'Nombre', key: 'name' },
      { label: 'Estado', render: function (a) { return tag(STATE[a.status] || a.status, a.status === 'active' ? 'ok' : 'warn'); } },
      { label: 'Plan', render: function (a) { return planText(a.effective_plan); } },
      { label: 'Clics', render: function (a) { return a.stats.clicks; }, num: true }, { label: 'Registros', render: function (a) { return a.stats.signups; }, num: true },
      { label: 'Validados', render: function (a) { return a.stats.validated; }, num: true }, { label: 'Pista+', render: function (a) { return a.stats.premium; }, num: true },
      { label: 'Aprobado', render: function (a) { return euros(a.stats.earnings.approved); }, num: true },
      { label: '', render: function (a) { return el('button', { class: 'btn small ghost', type: 'button', text: 'Abrir', onclick: function () { showAmbassador(a.id, detail); } }); } }
    ], list);
    pane.appendChild(el('div', { class: 'stack' }, [
      box('Embajadores', [t, el('div', { class: 'row' }, [
        el('button', { class: 'btn small', type: 'button', text: 'Nuevo embajador', onclick: function () { editAmbassador(null, detail); } }),
        el('button', { class: 'btn small ghost', type: 'button', text: 'CSV comisiones', onclick: async function () { exportCommissions(null); } }),
        el('button', { class: 'btn small ghost', type: 'button', text: 'CSV pagos', onclick: async function () { exportPayouts(null); } })
      ])]), detail]));
  };

  async function exportCommissions(id) {
    try {
      var rows = await call('admin_commissions_export', { p_ambassador: id });
      api.download('pista-comisiones.csv', api.csv(rows.map(function (r) { return Object.assign({}, r, { amount_eur: (r.amount_cents / 100).toFixed(2) }); }),
        ['ambassador', 'id', 'kind', 'amount_eur', 'currency', 'status', 'reason', 'source_transaction_id', 'created_at', 'approve_after', 'approved_at', 'paid_at', 'payout_id']));
    } catch (err) { fail(err); }
  }
  async function exportPayouts(id) {
    try {
      var rows = await call('admin_payouts_export', { p_ambassador: id });
      api.download('pista-pagos.csv', api.csv(rows.map(function (r) { return Object.assign({}, r, { amount_eur: (r.amount_cents / 100).toFixed(2) }); }),
        ['ambassador', 'name', 'email', 'id', 'amount_eur', 'currency', 'reference', 'method', 'created_at', 'by']));
    } catch (err) { fail(err); }
  }

  function editAmbassador(a, target) {
    var p = (a && a.plan) || {};
    var f = el('form', { class: 'stack' }, [
      el('div', { class: 'grid-cards' }, [
        field('Código', el('input', { class: 'input', name: 'code', value: a ? a.code : 'PISTA-', required: true })),
        field('Nombre', el('input', { class: 'input', name: 'name', value: a ? a.name : '', required: true })),
        field('Correo', el('input', { class: 'input', name: 'email', type: 'email', value: a ? a.email : '', required: true })),
        field('Correo de su cuenta en la app (opcional)', el('input', { class: 'input', name: 'profile', type: 'email' })),
        field('€ por validado (vacío: por defecto)', el('input', { class: 'input', name: 'cpa_v', type: 'number', step: '0.01', value: p.cpa_validated_cents !== undefined ? p.cpa_validated_cents / 100 : '' })),
        field('€ por primer pago Pista+', el('input', { class: 'input', name: 'cpa_p', type: 'number', step: '0.01', value: p.cpa_premium_cents !== undefined ? p.cpa_premium_cents / 100 : '' })),
        field('% de ingresos netos', el('input', { class: 'input', name: 'rev', type: 'number', step: '0.1', value: p.revshare_pct !== undefined ? p.revshare_pct : '' })),
        field('Meses del %', el('input', { class: 'input', name: 'months', type: 'number', step: '1', value: p.revshare_months !== undefined ? p.revshare_months : '' })),
        field('Estado', el('select', { class: 'input', name: 'status' }, ['active', 'paused', 'closed'].map(function (s) { var o = el('option', { value: s, text: s }); if (a && a.status === s) o.selected = true; return o; }))),
        field('Idioma de los correos', el('select', { class: 'input', name: 'locale' }, ['es', 'en'].map(function (s) { var o = el('option', { value: s, text: s }); if (a && a.locale === s) o.selected = true; return o; })))
      ]),
      field('Notas internas', el('textarea', { class: 'input', name: 'notes', text: a && a.notes ? a.notes : '' })),
      el('button', { class: 'btn', type: 'submit', text: a ? 'Guardar cambios' : 'Dar de alta y mandar bienvenida' })
    ]);
    f.onsubmit = async function (e) {
      e.preventDefault();
      var plan = {};
      if (f.cpa_v.value !== '') plan.cpa_validated_cents = Math.round(Number(f.cpa_v.value) * 100);
      if (f.cpa_p.value !== '') plan.cpa_premium_cents = Math.round(Number(f.cpa_p.value) * 100);
      if (f.rev.value !== '') plan.revshare_pct = Number(f.rev.value);
      if (f.months.value !== '') plan.revshare_months = Math.round(Number(f.months.value));
      try {
        var saved = await call('admin_ambassador_upsert', { p_id: a ? a.id : null, p_code: f.code.value, p_name: f.name.value, p_email: f.email.value,
          p_plan: plan, p_status: f.status.value, p_locale: f.locale.value, p_notes: f.notes.value || null, p_profile_email: f.profile.value || null });
        if (saved.is_new || !saved.has_login) {
          await api.callFunction('ambassador-user', { ambassador_id: saved.id });
          toast('Alta hecha. Le llega la bienvenida con su código.');
        } else {
          toast('Guardado');
        }
        PANES.ambassadors();
      } catch (err) { fail(err); }
    };
    target.innerHTML = '';
    target.appendChild(box(a ? 'Editar ' + a.code : 'Nuevo embajador', [f]));
    target.scrollIntoView({ behavior: 'smooth' });
  }

  function field(label, input) { return el('label', { class: 'field' }, [el('span', { text: label }), input]); }

  async function showAmbassador(id, target) {
    var d = await call('admin_ambassador_detail', { p_id: id });
    var a = d.ambassador;
    var s = d.stats || {};
    var e = s.earnings || {};
    target.innerHTML = '';
    var payForm = el('form', { class: 'row' }, [
      el('input', { class: 'input', name: 'ref', placeholder: 'Referencia de la transferencia', style: 'max-width:260px' }),
      el('input', { class: 'input', name: 'method', placeholder: 'Método', value: 'transferencia', style: 'max-width:180px' }),
      el('button', { class: 'btn small', type: 'submit', text: 'Registrar pago de lo aprobado' })
    ]);
    payForm.onsubmit = async function (ev) {
      ev.preventDefault();
      if (!confirm('¿Registrar el pago de ' + euros(e.approved) + ' a ' + a.name + '? Primero haz la transferencia.')) return;
      try { var r = await call('admin_record_payout', { p_ambassador: id, p_reference: payForm.ref.value, p_method: payForm.method.value }); toast('Pago registrado: ' + euros(r.amount_cents)); showAmbassador(id, target); }
      catch (err) { fail(err); }
    };
    var commissions = table([
      { label: 'Fecha', render: function (c) { return date(c.created_at); } }, { label: 'Tipo', render: function (c) { return KIND[c.kind] || c.kind; } },
      { label: 'Importe', render: function (c) { return euros(c.amount_cents); }, num: true },
      { label: 'Estado', render: function (c) { return tag(STATE[c.status] || c.status, c.status === 'paid' || c.status === 'approved' ? 'ok' : c.status === 'pending' ? '' : 'bad'); } },
      { label: 'Se aprueba', render: function (c) { return c.status === 'pending' ? date(c.approve_after) : ''; } }, { label: 'Motivo', key: 'reason' },
      { label: '', render: function (c) {
        if (c.kind === 'adjustment' || !(c.status === 'pending' || c.status === 'approved')) return '';
        return el('div', { class: 'row' }, [
          c.status === 'pending' ? el('button', { class: 'btn small ghost', type: 'button', text: 'Aprobar ya', onclick: async function () {
            try { await call('admin_set_commission', { p_id: c.id, p_action: 'approve' }); showAmbassador(id, target); } catch (err) { fail(err); } } }) : null,
          el('button', { class: 'btn small ghost', type: 'button', text: 'Anular', onclick: async function () {
            var why = prompt('Motivo de la anulación');
            if (why === null) return;
            try { await call('admin_set_commission', { p_id: c.id, p_action: 'void', p_reason: why }); showAmbassador(id, target); } catch (err) { fail(err); } } })
        ]);
      } }
    ], d.commissions || []);
    target.appendChild(el('div', { class: 'stack' }, [
      box(a.code + ' · ' + a.name, [
        el('div', { class: 'grid-cards' }, [kpi('Pendiente', euros(e.pending)), kpi('Aprobado', euros(e.approved), true), kpi('Pagado', euros(e.paid)), kpi('Anulado', euros(e.cancelled))]),
        el('p', { class: 'muted', text: 'Plan: ' + planText(a.effective_plan) }),
        el('div', { class: 'row' }, [
          el('button', { class: 'btn small ghost', type: 'button', text: 'Editar', onclick: function () { editAmbassador(a, target); } }),
          el('button', { class: 'btn small ghost', type: 'button', text: 'Reenviar bienvenida', onclick: async function () {
            try { await api.callFunction('ambassador-user', { ambassador_id: id }); toast('Bienvenida reenviada'); } catch (err) { fail(err); } } }),
          el('button', { class: 'btn small ghost', type: 'button', text: 'CSV comisiones', onclick: function () { exportCommissions(id); } })
        ]),
        payForm
      ]),
      box('Comisiones', [commissions]),
      box('Pagos', [table([
        { label: 'Fecha', render: function (p) { return date(p.created_at); } }, { label: 'Referencia', key: 'reference' }, { label: 'Método', key: 'method' },
        { label: 'Importe', render: function (p) { return euros(p.amount_cents); }, num: true }], d.payouts || [])])
    ]));
    target.scrollIntoView({ behavior: 'smooth' });
  }

  PANES.denuncias = async function () {
    pane.innerHTML = '';
    var status = el('select', { class: 'input', style: 'max-width:220px' }, [['open', 'Sin revisar'], ['reviewed', 'Con aviso'], ['actioned', 'Suspendidas'], ['dismissed', 'Descartadas']]
      .map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
    var list = el('div', { class: 'stack' });
    var REASONS = { fake: 'Perfil falso', inappropriate: 'Contenido inapropiado', harassment: 'Acoso', underage: 'Posible menor', spam: 'Spam', other: 'Otro' };
    var WHERE = { discover: 'en Descubrir', likes: 'en Le gustas', chat: 'en el chat' };
    async function load() {
      var rows = await call('admin_reports', { p_status: status.value });
      list.innerHTML = '';
      if (!rows.length) { list.appendChild(el('p', { class: 'muted', text: 'Nada por aquí.' })); return; }
      rows.forEach(function (r) {
        var d = r.reported;
        var who = !d ? el('p', { class: 'muted', text: 'La cuenta denunciada ya no existe.' }) : el('p', {}, [el('b', { text: 'Denunciada: ' }),
          d.deleted ? 'cuenta borrada' : (d.name || 'sin nombre') + ' · ' + (d.city || '') + ' · alta ' + date(d.created_at) +
          ' · ' + d.reports_total + (d.reports_total === 1 ? ' denuncia' : ' denuncias') + ' (' + d.reports_open + ' sin revisar) · la han bloqueado ' + d.blocked_by +
          (d.blocked_by === 1 ? ' persona' : ' personas') + (d.phone_verified ? ' · móvil verificado' : ' · sin móvil')]);
        var note = el('input', { class: 'input', placeholder: 'Nota (opcional, solo para el equipo)', style: 'max-width:340px' });
        function act(action, label, cls, ask) {
          return el('button', { class: 'btn small ' + (cls || ''), type: 'button', text: label, onclick: async function () {
            if (ask && !confirm(ask)) return;
            try { await call('admin_resolve_report', { p_id: r.id, p_action: action, p_note: note.value || null }); toast('Hecho'); load(); } catch (err) { fail(err); }
          } });
        }
        var actions;
        if (r.status === 'open') {
          actions = el('div', { class: 'row' }, [note, act('dismiss', 'Descartar', 'ghost'), act('warn', 'Apuntar y vigilar', 'ghost'),
            act('suspend', 'Suspender cuenta', 'danger', '¿Suspender esta cuenta? Deja de salir en la app y no puede escribir a nadie. Se puede deshacer.')]);
        } else {
          actions = el('p', { class: 'muted', text: ({ dismissed: 'Descartada', reviewed: 'Con aviso', actioned: 'Suspendida' }[r.status] || r.status) +
            (r.resolved_by ? ' por ' + r.resolved_by : '') + (r.resolved_at ? ' el ' + date(r.resolved_at) : '') + (r.note ? ': ' + r.note : '') });
        }
        var lift = d && d.suspended_at ? el('button', { class: 'btn small ghost', type: 'button', text: 'Quitar la suspensión', onclick: async function () {
          if (!confirm('¿Quitar la suspensión? Vuelve a salir en la app.')) return;
          try { await call('admin_unsuspend', { p_user: d.id, p_note: note.value || null }); toast('Suspensión quitada'); load(); } catch (err) { fail(err); }
        } }) : null;
        list.appendChild(box(null, [
          el('div', { class: 'row' }, [tag(REASONS[r.reason] || r.reason, r.reason === 'underage' || r.reason === 'harassment' ? 'warn' : ''),
            el('span', { class: 'muted', text: date(r.created_at) + (WHERE[r.context] ? ' · ' + WHERE[r.context] : '') }),
            d && d.suspended_at ? tag('suspendida', 'warn') : null]),
          r.details ? el('p', { text: '«' + r.details + '»' }) : el('p', { class: 'muted', text: 'Sin comentario.' }),
          who, r.reporter ? el('p', { class: 'muted', text: 'La envió ' + (r.reporter.name || 'alguien') + (r.reporter.deleted ? ' (cuenta borrada)' : '') }) : null,
          actions, lift
        ]));
      });
    }
    status.onchange = load;
    pane.appendChild(el('div', { class: 'stack' }, [el('div', { class: 'row' }, [status,
      el('p', { class: 'muted', text: 'Quien denuncia ya ha bloqueado a esa persona. Suspender la saca de la app hasta que la quites; descartar o apuntar no le avisa de nada.' })]), list]));
    await load();
  };

  PANES.review = async function () {
    pane.innerHTML = '';
    var status = el('select', { class: 'input', style: 'max-width:220px' }, [['open', 'Por revisar'], ['approved', 'Aprobados'], ['rejected', 'Rechazados']]
      .map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
    var list = el('div', { class: 'stack' });
    var REASONS = { same_device: 'Mismo iPhone', same_network: 'Misma red', deleted_account_reused: 'Cuenta borrada reutilizada',
      network_burst: 'Muchas altas desde una red', self_referral: 'Autorreferido', device_seen_before: 'iPhone ya usado (DeviceCheck)' };
    async function load() {
      var flags = await call('admin_fraud_queue', { p_status: status.value });
      list.innerHTML = '';
      if (!flags.length) { list.appendChild(el('p', { class: 'muted', text: 'Nada por aquí.' })); return; }
      flags.forEach(function (f) {
        var who = function (b, label) {
          if (!b) return null;
          return el('p', {}, [el('b', { text: label + ': ' }), b.deleted ? 'cuenta borrada' : (b.name || 'sin nombre') + ' · ' + (b.city || '') +
            ' · alta ' + date(b.created_at) + ' · ' + (b.validated ? 'validada' : 'sin validar') + ' · comparte iPhone con ' + b.shared_device_accounts + ', red con ' + b.shared_network_accounts]);
        };
        var note = el('input', { class: 'input', placeholder: 'Nota (opcional)', style: 'max-width:320px' });
        var actions = f.status === 'open' ? el('div', { class: 'row' }, [note,
          el('button', { class: 'btn small', type: 'button', text: 'Aprobar y pagar', onclick: async function () {
            try { await call('admin_resolve_flag', { p_id: f.id, p_approve: true, p_note: note.value || null }); toast('Aprobado'); load(); } catch (err) { fail(err); } } }),
          el('button', { class: 'btn small ghost', type: 'button', text: 'Rechazar', onclick: async function () {
            try { await call('admin_resolve_flag', { p_id: f.id, p_approve: false, p_note: note.value || null }); toast('Rechazado'); load(); } catch (err) { fail(err); } } })
        ]) : el('p', { class: 'muted', text: (f.status === 'approved' ? 'Aprobado' : 'Rechazado') + ' por ' + (f.resolved_by || '') + ' el ' + date(f.resolved_at) + (f.note ? ': ' + f.note : '') });
        list.appendChild(box(null, [
          el('div', { class: 'row' }, [tag({ invite: 'Invitación', attribution: 'Embajador', account: 'Cuenta' }[f.subject] || f.subject)]
            .concat((f.reasons || []).map(function (r) { return tag(REASONS[r] || r, 'warn'); }))
            .concat([el('span', { class: 'muted', text: date(f.created_at) })])),
          who(f.account, 'Cuenta'), who(f.related, f.subject === 'attribution' ? 'Embajador (su cuenta)' : 'Quien invitó'),
          f.invite ? el('p', { class: 'muted', text: 'Invitación ' + f.invite.code + ' · ' + f.invite.status }) : null,
          f.attribution ? el('p', { class: 'muted', text: 'Código ' + f.attribution.ambassador + ' · ' + f.attribution.status + ' · ' + f.attribution.source }) : null,
          actions
        ]));
      });
    }
    status.onchange = load;
    pane.appendChild(el('div', { class: 'stack' }, [el('div', { class: 'row' }, [status, el('p', { class: 'muted', text: 'Aprobar da el premio o la comisión que estaba esperando. Rechazar lo anula. La persona sigue pudiendo usar la app.' })]), list]));
    await load();
  };

  PANES.funnel = async function () {
    pane.innerHTML = '';
    var days = el('select', { class: 'input', style: 'max-width:160px' }, [7, 30, 90, 365].map(function (d) { var o = el('option', { value: d, text: 'Últimos ' + d + ' días' }); if (d === 30) o.selected = true; return o; }));
    var out = el('div', { class: 'stack' });
    var NAMES = { waitlist_signup: 'Alta en la lista', waitlist_confirmed: 'Correo confirmado', phone_verified: 'Móvil verificado',
      onboarding_completed: 'Perfil completo', access_granted: 'Entra en la app', invite_created: 'Invitación creada', invite_redeemed: 'Invitación usada',
      ambassador_click: 'Clic de embajador', ambassador_attributed: 'Registro de embajador', account_validated: 'Registro validado',
      referral_rewarded: 'Premio por invitar', trial_started: 'Prueba de Pista+', premium_conversion: 'Primer pago de Pista+',
      commission_accrued: 'Comisión generada', fraud_flagged: 'A revisión', account_deleted: 'Cuenta borrada' };
    async function load() {
      var f = await call('admin_funnel', { p_days: Number(days.value) });
      out.innerHTML = '';
      var tot = f.totals || {};
      var chain = ['waitlist_signup', 'waitlist_confirmed', 'access_granted', 'account_validated', 'premium_conversion'];
      out.appendChild(box('Embudo', [table([
        { label: 'Paso', render: function (k) { return NAMES[k] || k; } }, { label: 'Total', render: function (k) { return nf.format(tot[k] || 0); }, num: true },
        { label: 'Desde el anterior', render: function (k) { var i = chain.indexOf(k); if (i <= 0) return ''; var prev = tot[chain[i - 1]] || 0; return prev ? Math.round((tot[k] || 0) / prev * 100) + ' %' : ''; }, num: true }
      ], chain)]));
      out.appendChild(box('Por origen (perfiles completos en el periodo)', [table([
        { label: 'Origen', key: 'source' }, { label: 'Completos', key: 'completed', num: true }, { label: 'Validados', key: 'validated', num: true },
        { label: 'Pista+', key: 'premium', num: true },
        { label: 'Validación', render: function (r) { return r.completed ? Math.round(r.validated / r.completed * 100) + ' %' : ''; }, num: true }
      ], f.by_source || [])]));
      out.appendChild(box('Todos los eventos', [table([
        { label: 'Evento', render: function (k) { return NAMES[k] || k; } }, { label: 'Total', render: function (k) { return nf.format(tot[k] || 0); }, num: true }
      ], Object.keys(tot))]));
      var daily = f.daily || [];
      var max = Math.max(1, Math.max.apply(null, daily.map(function (d) { return (d.counts.waitlist_signup || 0) + (d.counts.onboarding_completed || 0); })));
      var bars = el('div', { class: 'bars', style: 'grid-template-columns:repeat(' + Math.max(daily.length, 1) + ',minmax(0,1fr))' }, daily.map(function (d) {
        return el('div', {}, [el('i', { style: 'height:' + (((d.counts.waitlist_signup || 0) + (d.counts.onboarding_completed || 0)) / max * 100) + '%', title: d.day }), el('small', { text: d.day.slice(5) })]);
      }));
      out.appendChild(box('Altas en la lista y perfiles completos por día', [bars]));
    }
    days.onchange = load;
    pane.appendChild(el('div', { class: 'stack' }, [days, out]));
    await load();
  };

  // ---------- Arranque ----------

  async function start() {
    var s;
    try { s = await api.session(); } catch (err) { signin('El enlace ha caducado. Pide otro.'); return; }
    if (!s) { signin(); return; }
    try { await api.authed('admin_overview'); }
    catch (err) {
      await api.signOut();
      signin(err.code === 'NOT_ALLOWED' ? ERR.NOT_ALLOWED : 'No se ha podido entrar.');
      return;
    }
    view('app');
    var hash = location.hash.slice(1);
    if (TABS.some(function (t) { return t[0] === hash; })) current = hash;
    root.querySelector('[data-signout]').onclick = async function () { await api.signOut(); signin(); };
    tabs();
    open();
  }

  start();
})();
