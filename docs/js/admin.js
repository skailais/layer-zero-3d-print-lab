/* MASTER panel: auth, dashboard, content CRUD, orders/quotes/messages, settings */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => '$' + (+n || 0).toFixed(2);
  const when = ts => new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const api = {
    async get(u) { const r = await fetch(u, { cache: 'no-store' }); const j = await r.json(); if (r.status === 401) { showLogin(); throw new Error('Session expired'); } if (!r.ok) throw new Error(j.error || 'Failed'); return j; },
    async send(u, body, method = 'POST') { const r = await fetch(u, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json(); if (r.status === 401) { showLogin(); throw new Error('Session expired'); } if (!r.ok) throw new Error(j.error || 'Failed'); return j; }
  };
  function toast(msg, err) { const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3000); }
  const INK = '#e9e7e1', RED = '#c8102e', DIM = '#77756f', LINE = 'rgba(233,231,225,.12)';

  // ---------- auth ----------
  function showLogin() { $('#login').classList.remove('hidden'); $('#app').classList.add('hidden'); }
  function showApp() { $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); loadTab(current); refreshBadges(); }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); $('#loginErr').textContent = '';
    try { await api.send('/api/admin/login', { password: $('#pw').value }); $('#pw').value = ''; showApp(); } catch (err) { $('#loginErr').textContent = err.message.toUpperCase(); }
  });
  $('#logout').addEventListener('click', async () => { await api.send('/api/admin/logout'); showLogin(); });

  // ---------- tabs ----------
  let current = location.hash.slice(1) || 'overview';
  $('#sideNav').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (!b) return; current = b.dataset.tab; location.hash = current; $$('#sideNav button').forEach(x => x.classList.toggle('active', x === b)); $$('.tab').forEach(t => t.classList.toggle('hidden', t.id !== 'tab-' + current)); loadTab(current); });
  function loadTab(t) {
    $$('#sideNav button').forEach(x => x.classList.toggle('active', x.dataset.tab === t)); $$('.tab').forEach(x => x.classList.toggle('hidden', x.id !== 'tab-' + t));
    ({ overview: loadOverview, orders: loadOrders, quotes: loadQuotes, messages: loadMessages, showcase: () => loadList('showcase'), products: () => loadList('products'), reviews: () => loadList('reviews'), activity: loadActivity, settings: loadSettings }[t] || loadOverview)();
  }
  async function refreshBadges() {
    try { const s = await api.get('/api/admin/stats/1'); $('#bActive').textContent = s.activeOrders || ''; $('#bQuotes').textContent = s.pendingQuotes || ''; $('#bMsgs').textContent = s.unreadMessages || ''; } catch { }
  }

  // ---------- overview ----------
  let days = 30;
  $('#range').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; days = +b.dataset.d; $$('#range button').forEach(x => x.classList.toggle('active', x === b)); loadOverview(); });
  async function loadOverview() {
    const s = await api.get('/api/admin/stats/' + days);
    const k = [
      ['Sessions', s.sessions, `${s.pageviews} page views`], ['Orders', s.funnel.orders, `${s.activeOrders} active`, s.activeOrders > 0],
      ['Revenue', fmt(s.revenue), `AOV ${fmt(s.aov)}`], ['Conversion', s.conversion + '%', 'orders / sessions'],
      ['Quotes', s.quotes, `${fmt(s.quoteValue)} est. value`, s.pendingQuotes > 0], ['Add to cart', (s.counts ? s.counts.addToCart : s.funnel.addToCart), `${(s.counts ? s.counts.checkoutStart : s.funnel.checkoutStart)} checkouts started`]
    ];
    $('#kpis').innerHTML = k.map(([l, v, sub, hot]) => `<div class="kpi ${hot ? 'hot' : ''}"><span>${l}</span><b>${v}</b><small>${sub}</small></div>`).join('');
    drawLine($('#chTraffic'), $('#tipTraffic'), s.series, [['views', INK], ['sessions', RED]], v => v);
    drawBars($('#chRevenue'), $('#tipRevenue'), s.series, 'revenue', fmt);
    const f = s.funnel; const steps = [['Visits', f.visits], ['Store views', f.storeViews], ['Product views', f.productViews], ['Add to cart', f.addToCart], ['Checkout', f.checkoutStart], ['Orders', f.orders]];
    const max = Math.max(1, ...steps.map(x => x[1]));
    $('#funnel').innerHTML = '<div class="funnel">' + steps.map(([l, v], i) => `<div class="f"><span class="lbl">${l}</span><div class="bar"><i style="--w:${(v / max * 100).toFixed(1)}%"></i></div><span class="val">${v}</span><span class="step">${i ? (steps[i - 1][1] ? Math.round(v / steps[i - 1][1] * 100) + '%' : '—') : ''}</span></div>`).join('') + '</div>';
    bars($('#clicks'), s.clicks, 8); bars($('#pages'), s.byPage, 8);
    bars($('#zones'), Object.assign({}, Object.fromEntries(Object.entries(s.zones).map(([k, v]) => ['zone: ' + k, v])), Object.fromEntries(Object.entries(s.ordersByStatus).map(([k, v]) => ['status: ' + k, v]))), 10);
    bars($('#topProducts'), s.topProducts, 8);
    bars($('#devices'), Object.assign({ 'desktop events': s.devices.desktop, 'mobile events': s.devices.mobile }, Object.fromEntries(Object.entries(s.refs).map(([k, v]) => ['ref: ' + k, v]))), 8);
  }
  function bars(el, obj, n) {
    const rows = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).slice(0, n); const max = Math.max(1, ...rows.map(r => r[1]));
    el.innerHTML = rows.length ? rows.map(([l, v]) => `<div class="row"><span class="lbl" title="${esc(l)}">${esc(l)}</span><span class="val">${v}</span><div class="bar"><i style="--w:${(v / max * 100).toFixed(1)}%"></i></div></div>`).join('') : '<div class="empty">NO DATA YET · OPEN THE SITE TO GENERATE EVENTS</div>';
  }
  function setupCanvas(cv) { const DPR = Math.min(2, devicePixelRatio || 1); const W = cv.clientWidth, H = cv.clientHeight; cv.width = W * DPR; cv.height = H * DPR; const ctx = cv.getContext('2d'); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H); return { ctx, W, H }; }
  function axes(ctx, W, H, pad, series, max, fmtY) {
    ctx.font = '9px "JetBrains Mono", monospace'; ctx.fillStyle = DIM; ctx.strokeStyle = LINE; ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) { const y = pad.t + (H - pad.t - pad.b) * (1 - i / 3); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(fmtY(max * i / 3).replace('.00', ''), pad.l - 6, y + 3); }
    const step = Math.ceil(series.length / 6); ctx.textAlign = 'center';
    series.forEach((d, i) => { if (i % step === 0) ctx.fillText(d.date.slice(5), pad.l + (W - pad.l - pad.r) * (series.length > 1 ? i / (series.length - 1) : .5), H - 4); });
  }
  function drawLine(cv, tip, series, keys, fmtY) {
    const { ctx, W, H } = setupCanvas(cv); const pad = { l: 36, r: 10, t: 10, b: 18 };
    const max = Math.max(1, ...series.flatMap(d => keys.map(k => d[k[0]])));
    axes(ctx, W, H, pad, series, max, v => String(Math.round(v)));
    const X = i => pad.l + (W - pad.l - pad.r) * (series.length > 1 ? i / (series.length - 1) : .5), Y = v => pad.t + (H - pad.t - pad.b) * (1 - v / max);
    keys.forEach(([k, col]) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath(); series.forEach((d, i) => i ? ctx.lineTo(X(i), Y(d[k])) : ctx.moveTo(X(i), Y(d[k]))); ctx.stroke(); });
    hover(cv, tip, series, X, i => keys.map(([k]) => `${k} ${series[i][k]}`).join(' · '), i => Y(Math.max(...keys.map(([k]) => series[i][k]))));
  }
  function drawBars(cv, tip, series, key, fmtY) {
    const { ctx, W, H } = setupCanvas(cv); const pad = { l: 44, r: 10, t: 10, b: 18 };
    const max = Math.max(1, ...series.map(d => d[key]));
    axes(ctx, W, H, pad, series, max, fmtY);
    const n = series.length, bw = Math.max(2, (W - pad.l - pad.r) / n - 2);
    const X = i => pad.l + (W - pad.l - pad.r) * (i + .5) / n, Y = v => pad.t + (H - pad.t - pad.b) * (1 - v / max);
    ctx.fillStyle = INK;
    series.forEach((d, i) => { if (!d[key]) return; const y = Y(d[key]); const h = H - pad.b - y; const x = X(i) - bw / 2; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, bw, h, [3, 3, 0, 0]) : ctx.rect(x, y, bw, h); ctx.fill(); });
    hover(cv, tip, series, X, i => `${series[i].date} · ${fmtY(series[i][key])} · ${series[i].orders} orders`, i => Y(series[i][key]));
  }
  function hover(cv, tip, series, X, text, Y) {
    cv.onmousemove = e => { const r = cv.getBoundingClientRect(); const x = e.clientX - r.left; let best = 0, bd = 1e9; series.forEach((d, i) => { const dd = Math.abs(X(i) - x); if (dd < bd) { bd = dd; best = i; } }); tip.textContent = series[best].date + ' · ' + text(best); tip.style.left = X(best) + 'px'; tip.style.top = Math.max(18, Y(best)) + 'px'; tip.classList.add('on'); };
    cv.onmouseleave = () => tip.classList.remove('on');
  }

  // ---------- orders ----------
  const ORDER_STATUS = ['new', 'printing', 'ready', 'shipped', 'delivered', 'cancelled'];
  async function loadOrders() {
    const list = await api.get('/api/admin/orders'); const f = $('#orderFilter').value; const rows = f ? list.filter(o => o.status === f) : list;
    $('#ordersTbl').innerHTML = `<tr><th>Order</th><th>Customer</th><th>Items</th><th>Fulfilment</th><th>Total</th><th>Status</th><th>Note</th></tr>` + (rows.map(o => `<tr>
      <td><div class="id">${esc(o.id)}</div><div class="sm">${when(o.ts)}</div></td>
      <td>${esc(o.customer.name)}<div class="sm">${esc(o.customer.email)}${o.customer.phone ? ' · ' + esc(o.customer.phone) : ''}</div>${o.customer.notes ? `<div class="sm">“${esc(o.customer.notes)}”</div>` : ''}</td>
      <td>${o.totals.lines.map(l => `${esc(l.name)}${l.variant ? ' (' + esc(l.variant) + ')' : ''} × ${l.qty}`).join('<br>')}</td>
      <td>${o.method === 'pickup' ? 'PICKUP' : `DELIVERY · ${esc(o.totals.zone).toUpperCase()}${o.express ? ' · EXPRESS' : ''}<div class="sm">${esc(o.customer.address)}, ${esc(o.customer.city)} ${esc(o.customer.zip)}</div>`}</td>
      <td>${fmt(o.totals.total)}<div class="sm">ship ${fmt(o.totals.shipping)} · tax ${fmt(o.totals.tax)}</div></td>
      <td><select class="sel" data-id="${esc(o.id)}" data-kind="orders">${ORDER_STATUS.map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
      <td><input class="note" data-id="${esc(o.id)}" data-kind="orders" value="${esc(o.adminNote || '')}" placeholder="internal note"></td></tr>`).join('') || '<tr><td colspan="7" class="empty">NO ORDERS YET</td></tr>');
  }
  $('#orderFilter').addEventListener('change', loadOrders);
  document.addEventListener('change', async e => {
    const el = e.target; if (!el.dataset.kind || !['orders', 'quotes'].includes(el.dataset.kind)) return;
    const body = el.classList.contains('note') ? { adminNote: el.value } : el.name === 'finalPrice' ? { finalPrice: +el.value } : { status: el.value };
    try { await api.send(`/api/admin/${el.dataset.kind}/${el.dataset.id}`, body, 'PATCH'); toast('SAVED ' + el.dataset.id); refreshBadges(); } catch (err) { toast(err.message, true); }
  });

  // ---------- quotes ----------
  async function loadQuotes() {
    const list = await api.get('/api/admin/quotes');
    $('#quotesTbl').innerHTML = `<tr><th>Quote</th><th>Customer</th><th>Spec</th><th>Estimate</th><th>File</th><th>Status</th><th>Final $</th><th>Note</th></tr>` + (list.map(q => `<tr>
      <td><div class="id">${esc(q.id)}</div><div class="sm">${when(q.ts)}</div></td>
      <td>${esc(q.name)}<div class="sm">${esc(q.email)}${q.phone ? ' · ' + esc(q.phone) : ''}${q.zip ? ' · ' + esc(q.zip) : ''}</div>${q.notes ? `<div class="sm">“${esc(q.notes)}”</div>` : ''}</td>
      <td>${esc(q.material).toUpperCase()} · ${q.infill}% · ×${q.qty}<div class="sm">${esc(q.finish)}${q.rush ? ' · RUSH' : ''} · ${q.volumeCm3} cm³${q.dims ? ' · ' + esc(q.dims) : ''}</div></td>
      <td>${fmt(q.estimate.total)}<div class="sm">${q.estimate.grams} g · ${q.estimate.printHours} h · ${q.estimate.leadDays} d</div></td>
      <td>${q.file ? `<a href="uploads/${esc(q.file)}" download class="link-arrow" style="font-size:10px">FILE</a>` : '<span class="sm">none</span>'}</td>
      <td><select class="sel" data-id="${esc(q.id)}" data-kind="quotes">${['new', 'quoted', 'accepted', 'printing', 'done', 'declined'].map(s => `<option ${s === q.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
      <td><input class="note" name="finalPrice" type="number" step="0.01" style="min-width:90px" data-id="${esc(q.id)}" data-kind="quotes" value="${q.finalPrice != null ? q.finalPrice : ''}" placeholder="${q.estimate.total}"></td>
      <td><input class="note" data-id="${esc(q.id)}" data-kind="quotes" value="${esc(q.adminNote || '')}" placeholder="internal note"></td></tr>`).join('') || '<tr><td colspan="8" class="empty">NO QUOTE REQUESTS YET</td></tr>');
  }

  // ---------- messages ----------
  async function loadMessages() {
    const list = await api.get('/api/admin/messages');
    $('#msgList').innerHTML = list.map(m => `<div class="msg ${m.read ? '' : 'unread'}"><div><div class="from">${esc(m.name || 'Anonymous')}<span>${esc(m.email)} · ${when(m.ts)}</span></div><p>${esc(m.message)}</p></div><div><button class="btn sm" data-read="${esc(m.id)}" data-val="${m.read ? 'false' : 'true'}">${m.read ? 'MARK UNREAD' : 'MARK READ'}</button></div></div>`).join('') || '<div class="empty">INBOX EMPTY</div>';
    $$('[data-read]').forEach(b => b.addEventListener('click', async () => { await api.send('/api/admin/messages/' + b.dataset.read, { read: b.dataset.val === 'true' }, 'PATCH'); loadMessages(); refreshBadges(); }));
  }

  // ---------- content lists ----------
  const SCHEMAS = {
    showcase: { title: 'Showcase piece', fields: [['title', 'Title'], ['category', 'Category (e.g. Architecture)'], ['material', 'Material'], ['tech', 'Process (e.g. FDM · 0.2mm)'], ['dims', 'Dimensions'], ['hours', 'Print hours', 'number'], ['tags', 'Tags (comma separated)'], ['description', 'Description', 'textarea'], ['featured', 'Featured on home page', 'checkbox']], image: true, label: i => i.title, sub: i => `${i.category} · ${i.material}` },
    products: { title: 'Product', fields: [['name', 'Name'], ['sku', 'SKU'], ['price', 'Price USD', 'number'], ['category', 'Category'], ['material', 'Material'], ['stock', 'Stock (0 = made to order)', 'number'], ['leadDays', 'Lead time, days', 'number'], ['description', 'Description', 'textarea'], ['featured', 'Featured on home page', 'checkbox']], image: true, variants: true, label: i => i.name, sub: i => `${i.sku} · ${fmt(i.price)} · stock ${i.stock}` },
    reviews: { title: 'Review', fields: [['name', 'Customer name'], ['location', 'Location'], ['rating', 'Rating 1–5', 'number'], ['service', 'Service (e.g. Custom part)'], ['text', 'Review text', 'textarea']], image: false, label: i => `${i.name} · ${'★'.repeat(i.rating || 0)}`, sub: i => `${i.location} · ${i.service || ''}` }
  };
  async function loadList(col) {
    const list = await api.get('/api/admin/' + col); const S = SCHEMAS[col];
    const box = $('#list-' + col);
    box.innerHTML = list.map(i => `<div class="item ${i.active ? '' : 'inactive'}" draggable="true" data-id="${esc(i.id)}"><span class="handle">≡</span>${S.image ? `<img src="${esc(i.image || '')}" alt="">` : '<span></span>'}<div><div class="t">${esc(S.label(i))}</div><div class="s">${esc(S.sub(i))}${i.featured ? ' · FEATURED' : ''}</div></div>
      <div class="ctl"><span class="switch ${i.active ? 'on' : ''}" data-toggle title="visible on site"></span><button data-edit>EDIT</button><button class="del" data-del>DELETE</button></div></div>`).join('') || '<div class="empty">EMPTY · ADD THE FIRST ONE</div>';
    box.onclick = async e => {
      const it = e.target.closest('.item'); if (!it) return; const item = list.find(x => x.id === it.dataset.id);
      if (e.target.closest('[data-edit]')) openEditor(col, item);
      else if (e.target.closest('[data-toggle]')) { await api.send('/api/admin/' + col, Object.assign({}, item, { active: !item.active })); toast(item.active ? 'HIDDEN FROM SITE' : 'VISIBLE ON SITE'); loadList(col); }
      else if (e.target.closest('[data-del]')) { if (!confirm(`Delete "${S.label(item)}"? This cannot be undone.`)) return; await api.send(`/api/admin/${col}/${item.id}`, null, 'DELETE'); toast('DELETED'); loadList(col); }
    };
    // drag reorder
    let drag = null;
    box.ondragstart = e => { drag = e.target.closest('.item'); if (drag) drag.classList.add('dragging'); };
    box.ondragover = e => { e.preventDefault(); const over = e.target.closest('.item'); if (!over || over === drag) return; const r = over.getBoundingClientRect(); box.insertBefore(drag, e.clientY < r.top + r.height / 2 ? over : over.nextSibling); };
    box.ondragend = async () => { if (!drag) return; drag.classList.remove('dragging'); drag = null; await api.send(`/api/admin/${col}/reorder`, { ids: $$('.item', box).map(x => x.dataset.id) }); toast('ORDER SAVED'); };
  }
  $$('[data-new]').forEach(b => b.addEventListener('click', () => openEditor(b.dataset.new, null)));

  function openEditor(col, item) {
    const S = SCHEMAS[col]; item = item || {};
    const bg = document.createElement('div'); bg.className = 'editor-bg';
    bg.innerHTML = `<form class="editor"><h3>${item.id ? 'EDIT' : 'NEW'} · ${S.title.toUpperCase()}</h3>
      ${S.image ? `<div class="img-pick"><img id="edImg" src="${esc(item.image || '')}" alt=""><div><div class="drop" id="edDrop"><input type="file" accept="image/*" id="edFile"><div class="sub">DROP OR CLICK · PNG / JPG / WEBP / SVG · UP TO 8 MB</div></div><div class="field" style="margin-top:10px"><label>OR IMAGE URL</label><input name="image" value="${esc(item.image || '')}"></div></div></div>` : ''}
      <div class="fields">${S.fields.map(([k, l, t]) => t === 'textarea' ? `<div class="field wide"><label>${l}</label><textarea name="${k}">${esc(item[k] || '')}</textarea></div>` : t === 'checkbox' ? `<label class="check mb-2 wide"><input type="checkbox" name="${k}" ${item[k] ? 'checked' : ''}> ${l}</label>` : `<div class="field"><label>${l}</label><input name="${k}" type="${t || 'text'}" step="any" value="${esc(Array.isArray(item[k]) ? item[k].join(', ') : (item[k] != null ? item[k] : ''))}"></div>`).join('')}</div>
      ${S.variants ? `<div class="field"><label>VARIANTS · name + price delta</label><div id="vars">${(item.variants || []).map(v => varRow(v)).join('')}</div><button type="button" class="btn sm" id="addVar">+ VARIANT</button></div>` : ''}
      <div class="actions"><button type="button" class="btn sm" id="edCancel">CANCEL</button><button type="submit" class="btn sm fill">SAVE & PUBLISH</button></div></form>`;
    document.body.appendChild(bg);
    const form = $('form', bg);
    $('#edCancel', bg).onclick = () => bg.remove(); bg.onclick = e => { if (e.target === bg) bg.remove(); };
    if (S.variants) { $('#addVar', bg).onclick = () => $('#vars', bg).insertAdjacentHTML('beforeend', varRow({})); $('#vars', bg).addEventListener('click', e => { if (e.target.closest('[data-rm]')) e.target.closest('.var-row').remove(); }); }
    if (S.image) {
      const up = async f => { if (!f) return; if (f.size > 8 * 1024 * 1024) return toast('IMAGE TOO LARGE', true); const r = new FileReader(); r.onload = async () => { try { const res = await api.send('/api/admin/upload', { data: r.result }); form.image.value = res.url; $('#edImg', bg).src = res.url; toast('IMAGE UPLOADED'); } catch (err) { toast(err.message, true); } }; r.readAsDataURL(f); };
      $('#edFile', bg).onchange = e => up(e.target.files[0]);
      const d = $('#edDrop', bg); d.ondragover = e => { e.preventDefault(); d.classList.add('over'); }; d.ondragleave = () => d.classList.remove('over'); d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); up(e.dataTransfer.files[0]); };
      form.image.oninput = () => $('#edImg', bg).src = form.image.value;
    }
    form.onsubmit = async e => {
      e.preventDefault(); const out = Object.assign({}, item);
      S.fields.forEach(([k, l, t]) => { const el = form[k]; out[k] = t === 'checkbox' ? el.checked : t === 'number' ? +el.value : k === 'tags' ? el.value.split(',').map(s => s.trim()).filter(Boolean) : el.value.trim(); });
      if (S.image) out.image = form.image.value.trim();
      if (S.variants) out.variants = $$('.var-row', bg).map(r => ({ name: $('[name=vn]', r).value.trim(), delta: +$('[name=vd]', r).value || 0 })).filter(v => v.name);
      if (col === 'reviews') out.rating = Math.min(5, Math.max(1, out.rating || 5));
      if (col === 'products' && !out.name) return toast('NAME REQUIRED', true);
      if (col === 'showcase' && !out.title) return toast('TITLE REQUIRED', true);
      try { await api.send('/api/admin/' + col, out); toast('PUBLISHED'); bg.remove(); loadList(col); } catch (err) { toast(err.message, true); }
    };
  }
  const varRow = v => `<div class="var-row"><input name="vn" placeholder="e.g. Black" value="${esc(v.name || '')}"><input name="vd" type="number" step="0.5" placeholder="+0" value="${v.delta || 0}"><button type="button" data-rm>×</button></div>`;

  // ---------- activity ----------
  async function loadActivity() {
    const ev = await api.get('/api/admin/events/recent');
    $('#actTbl').innerHTML = '<tr><th>Time</th><th>Type</th><th>Page</th><th>Label</th><th>Value</th><th>Session</th><th>Device</th></tr>' + (ev.map(e => `<tr><td class="sm">${when(e.ts)}</td><td><span class="status ${e.type === 'purchase' ? 'new' : ''}">${esc(e.type)}</span></td><td class="sm">${esc(e.page)}</td><td>${esc(e.label)}</td><td class="sm">${e.value != null ? e.value : ''}</td><td class="sm">${esc(e.sid).slice(0, 8)}</td><td class="sm">${esc(e.device)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">NO EVENTS</td></tr>');
  }
  $('#refreshAct').onclick = loadActivity;
  $('#clearEvents').onclick = async () => { if (!confirm('Clear the entire analytics log?')) return; await api.send('/api/admin/events', null, 'DELETE'); toast('LOG CLEARED'); loadActivity(); };
  $$('[data-export]').forEach(b => b.addEventListener('click', async () => { const data = await api.get('/api/admin/export/' + b.dataset.export); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = `layerzero-${b.dataset.export}-${new Date().toISOString().slice(0, 10)}.json`; a.click(); }));

  // ---------- settings ----------
  async function loadSettings() {
    const s = await api.get('/api/admin/settings');
    const fill = (form, obj) => Object.entries(obj).forEach(([k, v]) => { if (form[k]) form[k].value = Array.isArray(v) ? v.join(', ') : v; });
    fill($('#fBusiness'), s.business); fill($('#fDelivery'), Object.assign({}, s.delivery.rates, { pickupZips: s.delivery.pickupZips, localZipPrefixes: s.delivery.localZipPrefixes })); fill($('#fPricing'), s.pricing);
  }
  $('#fBusiness').onsubmit = async e => { e.preventDefault(); const f = e.target; await api.send('/api/admin/settings', { business: { name: f.name.value, tagline: f.tagline.value, address: f.address.value, phone: f.phone.value, email: f.email.value, hours: f.hours.value } }, 'PUT'); toast('BUSINESS SAVED'); };
  $('#fDelivery').onsubmit = async e => { e.preventDefault(); const f = e.target; const s = await api.get('/api/admin/settings'); const d = s.delivery; d.rates = { pickup: 0, local: +f.local.value, florida: +f.florida.value, national: +f.national.value, expressSurcharge: +f.expressSurcharge.value, freeOver: +f.freeOver.value }; d.pickupZips = f.pickupZips.value.split(',').map(x => x.trim()).filter(Boolean); d.localZipPrefixes = f.localZipPrefixes.value.split(',').map(x => x.trim()).filter(Boolean); await api.send('/api/admin/settings', { delivery: d }, 'PUT'); toast('DELIVERY SAVED'); };
  $('#fPricing').onsubmit = async e => { e.preventDefault(); const f = e.target; const p = {}; ['pla', 'petg', 'abs', 'tpu', 'nylon', 'resin', 'minOrder', 'setupFee', 'rush'].forEach(k => p[k] = +f[k].value); await api.send('/api/admin/settings', { pricing: p }, 'PUT'); toast('PRICING SAVED'); };
  $('#fPassword').onsubmit = async e => { e.preventDefault(); const f = e.target; try { await api.send('/api/admin/password', { current: f.current.value, next: f.next.value }); toast('PASSWORD CHANGED'); f.reset(); } catch (err) { toast(err.message, true); } };

  // ---------- boot ----------
  fetch('/api/admin/me').then(r => r.json()).then(j => j.admin ? showApp() : showLogin());
  setInterval(() => { if (!$('#app').classList.contains('hidden')) refreshBadges(); }, 30000);
})();
