/* Store: catalog, product modal, checkout with live delivery totals, order tracking */
(function () {
  'use strict';
  document.addEventListener('lz:ready', () => {
    const { $, $$, api, content, track, toast, cart, modal, motion, fmt, esc, sid } = window.LZ;
    let products = [], rates = null;

    const card = p => `<div class="card rv corners" data-id="${esc(p.id)}" id="${esc(p.id)}"><span class="c"></span>
      ${p.featured ? '<div class="bl"><span class="tag red">POPULAR</span></div>' : ''}
      <div class="img" data-open><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"></div>
      <div class="body"><div class="meta"><span>${esc(p.category)}</span><span>${esc(p.material)}</span></div>
      <div class="flex between center gap"><h3>${esc(p.name)}</h3><span class="price">${fmt(p.price)}</span></div>
      <div class="stock ${p.stock <= 5 ? 'low' : ''}">${p.stock <= 0 ? 'MADE TO ORDER' : p.stock <= 5 ? 'LOW STOCK · ' + p.stock + ' LEFT' : 'IN STOCK · ' + p.leadDays + 'D LEAD'}</div>
      <div class="actions"><button class="btn sm" data-open data-track="store:details:${esc(p.name)}">DETAILS</button><button class="btn sm red" data-add data-track="store:add:${esc(p.name)}">ADD <span class="arr"></span></button></div></div></div>`;

    function render(f) {
      const list = f === 'all' ? products : products.filter(p => p.category === f);
      $('#grid').innerHTML = list.map(card).join('') || '<div class="empty-note">Nothing here yet</div>';
      $('#count').textContent = `${list.length} / ${products.length} SKU`;
      motion($('#grid'));
    }
    function openProduct(p) {
      track('product_view', p.name, p.price);
      let variant = p.variants && p.variants[0] ? p.variants[0].name : null, qty = 1;
      const price = () => { const v = (p.variants || []).find(x => x.name === variant); return p.price + (v ? v.delta || 0 : 0); };
      modal.open(`<div class="m-grid"><div class="m-img"><img src="${esc(p.image)}" alt="${esc(p.name)}"></div>
        <div class="m-body"><div class="eyebrow"><span class="n">${esc(p.sku)}</span> ${esc(p.category)} · ${esc(p.material)}</div>
        <h2 class="display h-m">${esc(p.name)}</h2><div class="m-price" id="mPrice">${fmt(price())}<small>USD · INCL. PRINT</small></div>
        <p class="lead mt-2" style="font-size:15px">${esc(p.description)}</p>
        ${p.variants && p.variants.length ? `<div class="mono">OPTION</div><div class="variants" id="mVars">${p.variants.map(v => `<button class="${v.name === variant ? 'active' : ''}" data-v="${esc(v.name)}">${esc(v.name)}${v.delta ? ' +' + fmt(v.delta) : ''}</button>`).join('')}</div>` : ''}
        <div class="flex gap center mt-2"><div class="qty"><button id="qm">−</button><span id="qv">1</span><button id="qp">+</button></div><button class="btn red" id="mAdd" data-track="store:modal-add:${esc(p.name)}">ADD TO CART <span class="arr"></span></button></div>
        <div class="spec mt-3"><div><b>Lead time</b><span>${esc(p.leadDays)} business days</span></div><div><b>Stock</b><span>${p.stock > 0 ? p.stock + ' ready' : 'Made to order'}</span></div><div><b>Material</b><span>${esc(p.material)}</span></div><div><b>Ships from</b><span>Margate, FL 33063</span></div></div></div></div>`);
      const m = $('#modal');
      if ($('#mVars', m)) $('#mVars', m).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; variant = b.dataset.v; $$('button', $('#mVars', m)).forEach(x => x.classList.toggle('active', x === b)); $('#mPrice', m).firstChild.textContent = fmt(price()); });
      $('#qm', m).addEventListener('click', () => { qty = Math.max(1, qty - 1); $('#qv', m).textContent = qty; });
      $('#qp', m).addEventListener('click', () => { qty = Math.min(99, qty + 1); $('#qv', m).textContent = qty; });
      $('#mAdd', m).addEventListener('click', () => { cart.add(p, variant, qty); modal.close(); });
    }

    // ---------- checkout ----------
    const form = $('#coForm'); let totals = null; let started = false; let calcTimer = null;
    function refreshSummary() {
      const empty = !cart.items.length;
      $('#coEmpty').classList.toggle('hidden', !empty); $('#coGrid').classList.toggle('hidden', empty);
      if (empty) return;
      $('#sumLines').innerHTML = cart.items.map(i => `<div class="li"><span>${esc(i.name)} × ${i.qty}${i.variant ? `<small>${esc(i.variant)}</small>` : ''}</span><span>${fmt(i.price * i.qty)}</span></div>`).join('');
      clearTimeout(calcTimer); calcTimer = setTimeout(calc, 250);
    }
    async function calc() {
      const method = form.method.value, zip = form.zip.value.trim(), express = form.express.checked;
      $('#addrBlock').style.display = method === 'pickup' ? 'none' : '';
      try {
        totals = await api.send('/api/cart/totals', { items: cart.items.map(i => ({ id: i.id, qty: i.qty, variant: i.variant })), zip, method, express });
        $('#sSub').textContent = fmt(totals.subtotal); $('#sTax').textContent = fmt(totals.tax); $('#sTot').textContent = fmt(totals.total);
        $('#sShip').textContent = method === 'pickup' ? 'FREE PICKUP' : (!/^\d{5}$/.test(zip) ? 'ENTER ZIP' : (totals.shipping === 0 ? 'FREE' : fmt(totals.shipping)));
        const zoneNames = { pickup: 'PICKUP ZONE · courier available', local: 'LOCAL COURIER ZONE', florida: 'FLORIDA SHIPPING', national: 'NATIONWIDE SHIPPING', unknown: '' };
        $('#zoneNote').textContent = method === 'pickup' ? '' : (/^\d{5}$/.test(zip) ? `ZIP ${zip} → ${zoneNames[totals.zone]} · ETA ${totals.eta || ''}${totals.subtotal >= rates.freeOver ? ' · FREE SHIPPING APPLIED' : ''}` : (zip ? 'ENTER A 5-DIGIT ZIP' : `Free shipping on orders over ${fmt(rates.freeOver)}`));
        $('#sEta').innerHTML = method === 'pickup' ? 'PICKUP · <b>Margate lab · ready in 1–5 days</b>' : (totals.eta ? `ESTIMATED DELIVERY · <b>${esc(totals.eta)}</b>` : 'ENTER ZIP FOR ETA');
      } catch (e) { $('#zoneNote').textContent = e.message; }
    }
    form.addEventListener('input', () => { clearTimeout(calcTimer); calcTimer = setTimeout(calc, 300); });
    form.addEventListener('change', calc);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const f = form; let ok = true;
      $$('.field', f).forEach(x => x.classList.remove('err'));
      const need = ['name', 'email'].concat(f.method.value === 'pickup' ? [] : ['address', 'city', 'zip']);
      need.forEach(n => { if (!f[n].value.trim()) { f[n].closest('.field').classList.add('err'); ok = false; } });
      if (!ok) { toast('FILL THE HIGHLIGHTED FIELDS', true); return; }
      const btn = $('#placeBtn'); btn.disabled = true;
      try {
        const r = await api.send('/api/orders', { items: cart.items.map(i => ({ id: i.id, qty: i.qty, variant: i.variant })), method: f.method.value, express: f.express.checked, sid,
          customer: { name: f.name.value, email: f.email.value, phone: f.phone.value, address: f.address.value, city: f.city.value, zip: f.zip.value, notes: f.notes.value } });
        cart.clear(); form.reset();
        const o = r.order;
        $('#coGrid').classList.add('hidden'); $('#coEmpty').classList.add('hidden');
        const c = $('#confirm'); c.classList.remove('hidden');
        c.innerHTML = `<div class="mono red mb-2">ORDER RECEIVED</div><div class="display">THANK YOU</div><div class="oid">${esc(o.id)}</div>
          <p class="lead" style="margin:0 auto 20px">${o.method === 'pickup' ? 'We will email you when it is ready for pickup at the Margate lab.' : `Shipping to ${esc(o.customer.city || '')} ${esc(o.customer.zip)} · estimated ${esc(o.totals.eta || '')}.`} Total ${fmt(o.totals.total)}.</p>
          <div class="flex gap wrapf" style="justify-content:center"><a href="#track" class="btn sm" id="trackNow">TRACK THIS ORDER</a><a href="#catalog" class="btn sm">KEEP SHOPPING</a></div>`;
        c.classList.add('in'); c.scrollIntoView({ behavior: 'smooth', block: 'center' });
        $('#trackNow').addEventListener('click', () => { $('#trackId').value = o.id; setTimeout(() => $('#trackForm').requestSubmit(), 500); });
        toast('ORDER ' + o.id + ' PLACED');
      } catch (err) { toast(err.message, true); } finally { btn.disabled = false; }
    });
    document.addEventListener('cart:change', refreshSummary);
    new IntersectionObserver(en => { if (en[0].isIntersecting && cart.items.length && !started) { started = true; track('checkout_start', 'store', cart.subtotal()); } }, { threshold: .3 }).observe($('#checkout'));

    // ---------- tracking ----------
    const STEPS = ['new', 'printing', 'ready', 'shipped', 'delivered'];
    $('#trackForm').addEventListener('submit', async e => {
      e.preventDefault(); const id = $('#trackId').value.trim().toUpperCase(); const out = $('#trackRes');
      if (!id) return;
      try {
        const o = await api.get('/api/orders/' + encodeURIComponent(id));
        const idx = STEPS.indexOf(o.status);
        const labels = o.method === 'pickup' ? ['RECEIVED', 'PRINTING', 'READY FOR PICKUP', 'COLLECTED'] : ['RECEIVED', 'PRINTING', 'PACKED', 'SHIPPED', 'DELIVERED'];
        const keys = o.method === 'pickup' ? ['new', 'printing', 'ready', 'delivered'] : STEPS;
        const cur = keys.indexOf(o.status);
        out.innerHTML = `<div class="mono ink">ORDER ${esc(o.id)} · PLACED ${new Date(o.ts).toLocaleDateString()} · ${o.status === 'cancelled' ? '<span class="red">CANCELLED</span>' : esc(o.status).toUpperCase()}</div>
          <div class="timeline">${labels.map((l, i) => `<div class="${i < cur ? 'done' : i === cur ? 'on' : ''}">${l}</div>`).join('')}</div>
          <div class="mono mt-2">${o.lines.map(l => esc(l.name) + ' × ' + l.qty).join(' · ')} · ${fmt(o.total)}${o.eta ? ' · ETA ' + esc(o.eta) : ''}</div>`;
        track('track_lookup', o.id);
      } catch (err) { out.innerHTML = `<div class="mono red">${esc(err.message)}</div>`; }
    });

    // ---------- init ----------
    content().then(c => {
      products = c.products; rates = c.delivery.rates;
      $('#cnt').textContent = String(products.length).padStart(2, '0'); $('#freeOver').textContent = fmt(rates.freeOver).replace('.00', ''); $('#expressFee').textContent = '+' + fmt(rates.expressSurcharge).replace('.00', '');
      const cats = Array.from(new Set(products.map(p => p.category)));
      const fl = $('#filters'); const sp = fl.querySelector('.sp');
      cats.forEach(cat => { const b = document.createElement('button'); b.dataset.f = cat; b.textContent = cat.toUpperCase(); fl.insertBefore(b, sp); });
      fl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', fl).forEach(x => x.classList.toggle('active', x === b)); track('filter', 'store:' + b.dataset.f); render(b.dataset.f); });
      render('all');
      $('#grid').addEventListener('click', e => {
        const c = e.target.closest('.card'); if (!c) return; const p = products.find(x => x.id === c.dataset.id); if (!p) return;
        if (e.target.closest('[data-add]')) cart.add(p, p.variants && p.variants[0] ? p.variants[0].name : null);
        else if (e.target.closest('[data-open]')) openProduct(p);
      });
      refreshSummary();
      const h = location.hash.slice(1);
      if (h && h !== 'checkout' && h !== 'track' && h !== 'catalog') { const p = products.find(x => x.id === h); if (p) setTimeout(() => openProduct(p), 400); }
      if (h === 'checkout') setTimeout(() => $('#checkout').scrollIntoView({ behavior: 'smooth' }), 300);
    }).catch(() => toast('Could not load catalog', true));
  });
})();
