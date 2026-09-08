/* LAYER ZERO — shared runtime: chrome, motion, cart, tracking */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const PAGE = (location.pathname.split('/').pop() || 'index.html');
  const fmt = n => '$' + (Math.round(n * 100) / 100).toFixed(2);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- session / tracking ----------
  let sid = null;
  try { sid = localStorage.getItem('lz_sid'); if (!sid) { sid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem('lz_sid', sid); } } catch { sid = 'anon'; }
  function track(type, label, value) {
    const body = JSON.stringify({ type, page: PAGE, label: label || '', value, sid, ref: document.referrer || '' });
    try { if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' })); else fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }); } catch { }
  }
  if (!/master/.test(PAGE)) track('pageview');
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-track]'); if (el) track('click', el.getAttribute('data-track'));
  });

  // ---------- API ----------
  const api = {
    async get(u) { const r = await fetch(u); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Request failed'); return j; },
    async send(u, body, method = 'POST') { const r = await fetch(u, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Request failed'); return j; }
  };
  let contentPromise = null;
  const content = () => contentPromise || (contentPromise = api.get('/api/content'));

  // ---------- chrome injection ----------
  const NAV = [['index.html', 'Home'], ['showcase.html', 'Showcase'], ['store.html', 'Store'], ['quote.html', 'Get a quote']];
  function injectChrome() {
    if (!$('.grain')) document.body.insertAdjacentHTML('afterbegin', '<div class="grain"></div><div class="gridlines"></div>');
    document.body.insertAdjacentHTML('afterbegin', `
      <div class="preloader" id="preloader"><div class="pl-inner"><div class="pl-num" id="plNum">000</div>INITIALIZING LAYER ZERO<div class="pl-bar"><i id="plBar"></i></div></div></div>
      <a href="#main" class="skip">Skip to content</a>
      <div class="wipe" id="wipe"></div>
      <div class="cursor"><div class="cursor-dot"></div><div class="cursor-ring"></div></div>
      <div class="nav-scrim" id="navScrim"></div>
      <header class="nav" id="nav">
        <a href="/" class="brand" data-track="nav:brand"><span class="sq"></span>LAYER ZERO<small>MARGATE·FL</small></a>
        <nav class="links">${NAV.map(([h, t], i) => `<a href="${h}" class="${h === PAGE ? 'active' : ''}"><span class="idx">0${i + 1}</span>${t}</a>`).join('')}</nav>
        <div class="right">
          <button class="cart-btn" id="cartBtn" data-track="nav:cart"><span>CART</span><b id="cartCount">0</b></button>
          <button class="burger" id="burger" aria-label="menu"><i></i><i></i></button>
        </div>
      </header>
      <div class="drawer-bg" id="drawerBg"></div>
      <aside class="drawer" id="drawer">
        <div class="dh"><h3>YOUR CART</h3><button class="dx" id="drawerX" aria-label="close"></button></div>
        <div class="items" id="cartItems"></div>
        <div class="df">
          <div class="sum"><span>SUBTOTAL</span><span id="cartSub">$0.00</span></div>
          <div class="sum muted"><span>SHIPPING</span><span>calculated at checkout</span></div>
          <a href="store.html#checkout" class="btn fill block" id="checkoutBtn" data-track="cart:checkout">PROCEED TO CHECKOUT <span class="arr"></span></a>
        </div>
      </aside>
      <div class="toasts" id="toasts"></div>`);
    if (!$('.footer')) document.body.insertAdjacentHTML('beforeend', `
      <footer class="footer">
        <div class="f-grid">
          <div><h2>Layer Zero · 3D Print Lab</h2><p id="fAddr">5400 W Atlantic Blvd, Margate, FL 33063</p><p id="fHours">Mon–Sat 09:00–19:00</p><p class="mono" style="margin-top:14px">26.2445° N / 80.2064° W</p></div>
          <div><h2>Navigate</h2>${NAV.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}<a href="store.html#track">Track order</a></div>
          <div><h2>Services</h2><a href="quote.html">Custom prints</a><a href="quote.html">Design & CAD</a><a href="quote.html">Batch production</a><a href="showcase.html">Case studies</a></div>
          <div><h2>Contact</h2><a id="fMail" href="mailto:orders@layerzero.print">orders@layerzero.print</a><a id="fPhone" href="tel:+19545550142">(954) 555-0142</a><p class="muted" style="font-size:12px;margin-top:14px">Local pickup & courier in Broward · Shipping across Florida and the US.</p></div>
        </div>
        <div class="big">LAYER ZERO</div>
        <div class="bottom"><span>© ${new Date().getFullYear()} LAYER ZERO 3D PRINT LAB</span><span>MARGATE · FLORIDA · USA</span><span><a href="master.html" style="display:inline;margin:0;font-size:inherit;color:inherit">MASTER</a></span></div>
      </footer>`);
    content().then(c => { const b = c.business; if ($('#fAddr')) $('#fAddr').textContent = b.address; if ($('#fHours')) $('#fHours').textContent = b.hours; if ($('#fMail')) { $('#fMail').textContent = b.email; $('#fMail').href = 'mailto:' + b.email; } if ($('#fPhone')) { $('#fPhone').textContent = b.phone; $('#fPhone').href = 'tel:' + b.phone.replace(/\D/g, ''); } }).catch(() => { });
  }

  // ---------- preloader ----------
  function preloader() {
    const pl = $('#preloader'), num = $('#plNum'), bar = $('#plBar');
    const seen = sessionStorage.getItem('lz_seen');
    if (seen || REDUCED || /nopl/.test(location.search)) { pl.remove(); document.body.classList.add('loaded'); return; }
    let p = 0; const t0 = performance.now();
    const step = () => {
      const el = performance.now() - t0; p = Math.min(100, Math.round(el / 12));
      num.textContent = String(p).padStart(3, '0'); bar.style.width = p + '%';
      if (p < 100) requestAnimationFrame(step); else setTimeout(() => { pl.classList.add('out'); document.body.classList.add('loaded'); sessionStorage.setItem('lz_seen', '1'); setTimeout(() => pl.remove(), 1000); }, 200);
    };
    requestAnimationFrame(step);
  }

  // ---------- page transitions ----------
  function transitions() {
    const wipe = $('#wipe');
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href]'); if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || a.target === '_blank' || /^(mailto|tel|http)/.test(href) || e.metaKey || e.ctrlKey) return;
      const [pathPart, hash] = href.split('#');
      if ((pathPart || PAGE) === PAGE) return; // same page anchors handled natively
      if (REDUCED) return;
      e.preventDefault(); wipe.classList.add('in');
      setTimeout(() => { location.href = href; }, 520);
    });
    window.addEventListener('pageshow', () => { wipe.classList.remove('in'); });
  }

  // ---------- cursor ----------
  function cursor() {
    if (matchMedia('(hover: none)').matches) return;
    const dot = $('.cursor-dot'), ring = $('.cursor-ring');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px,${my}px)`; });
    (function loop() { rx += (mx - rx) * .18; ry += (my - ry) * .18; ring.style.transform = `translate(${rx}px,${ry}px)`; requestAnimationFrame(loop); })();
    document.addEventListener('mouseover', e => { if (e.target.closest('a,button,[data-cursor],input,select,textarea,label')) document.body.classList.add('cursor-hover'); });
    document.addEventListener('mouseout', e => { if (e.target.closest('a,button,[data-cursor],input,select,textarea,label')) document.body.classList.remove('cursor-hover'); });
  }

  // ---------- nav ----------
  function nav() {
    const n = $('#nav'), scrim = $('#navScrim'); let last = scrollY;
    const setHidden = v => { n.classList.toggle('hide', v); if (scrim) scrim.classList.toggle('hide', v); };
    addEventListener('scroll', () => { const y = scrollY; if (y > last + 6 && y > 200 && !n.classList.contains('open')) setHidden(true); else if (y < last - 6) setHidden(false); last = y; }, { passive: true });
    $('#burger').addEventListener('click', () => { n.classList.toggle('open'); document.body.classList.toggle('no-scroll', n.classList.contains('open')); });
    $$('.links a', n).forEach(a => a.addEventListener('click', () => { n.classList.remove('open'); document.body.classList.remove('no-scroll'); }));
  }

  // ---------- reveal / split / magnetic ----------
  function splitWords(el) {
    if (el.dataset.split) return; el.dataset.split = '1';
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w, i) => `<span class="w"><span style="transition-delay:${i * 0.06}s">${esc(w)}</span></span>`).join(' ');
  }
  function motion(root = document) {
    $$('.split', root).forEach(splitWords);
    const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    $$('.rv, .rv-l, .rv-scale, .rv-line, .split, .mask-img', root).forEach(el => io.observe(el));
    $$('[data-stagger]', root).forEach(p => $$(p.dataset.stagger, p).forEach((c, i) => c.style.setProperty('--d', (i * 0.08) + 's')));
    if (!REDUCED && !matchMedia('(hover: none)').matches) $$('.magnetic', root).forEach(el => {
      el.addEventListener('mousemove', e => { const r = el.getBoundingClientRect(); const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2; el.style.transform = `translate(${x * .25}px,${y * .3}px)`; });
      el.addEventListener('mouseleave', () => { el.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1)'; el.style.transform = ''; setTimeout(() => el.style.transition = '', 600); });
    });
    // counters
    const cio = new IntersectionObserver(entries => entries.forEach(en => { if (!en.isIntersecting) return; cio.unobserve(en.target); const el = en.target, target = parseFloat(el.dataset.count), dur = 1600, t0 = performance.now(); const dec = (el.dataset.count.split('.')[1] || '').length; (function tick() { const p = Math.min(1, (performance.now() - t0) / dur); const e = 1 - Math.pow(1 - p, 4); el.textContent = (target * e).toFixed(dec); if (p < 1) requestAnimationFrame(tick); })(); }), { threshold: .5 });
    $$('[data-count]', root).forEach(el => cio.observe(el));
    // parallax
    const px = $$('[data-parallax]', root);
    if (px.length && !REDUCED) addEventListener('scroll', () => { const y = scrollY; px.forEach(el => { const s = parseFloat(el.dataset.parallax) || .2; el.style.transform = `translateY(${y * s}px)`; }); }, { passive: true });
  }

  // ---------- toasts ----------
  function toast(msg, err) { const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; setTimeout(() => t.remove(), 400); }, 2800); }

  // ---------- cart ----------
  const cart = {
    items: [],
    load() { try { this.items = JSON.parse(localStorage.getItem('lz_cart') || '[]'); } catch { this.items = []; } },
    save() { try { localStorage.setItem('lz_cart', JSON.stringify(this.items)); } catch { } this.render(); },
    add(p, variant, qty = 1) {
      const key = p.id + '|' + (variant || '');
      const ex = this.items.find(i => i.key === key);
      const v = (p.variants || []).find(x => x.name === variant);
      if (ex) ex.qty = Math.min(99, ex.qty + qty); else this.items.push({ key, id: p.id, name: p.name, variant: variant || null, price: p.price + (v ? v.delta || 0 : 0), image: p.image, qty });
      this.save(); track('add_to_cart', p.name, p.price); toast('ADDED · ' + p.name); this.open();
    },
    setQty(key, q) { const it = this.items.find(i => i.key === key); if (!it) return; it.qty = q; if (it.qty <= 0) this.items = this.items.filter(i => i.key !== key); this.save(); },
    clear() { this.items = []; this.save(); },
    count() { return this.items.reduce((s, i) => s + i.qty, 0); },
    subtotal() { return this.items.reduce((s, i) => s + i.qty * i.price, 0); },
    open() { document.body.classList.add('drawer-open'); }, close() { document.body.classList.remove('drawer-open'); },
    render() {
      $('#cartCount').textContent = this.count();
      $('#cartSub').textContent = fmt(this.subtotal());
      $('#checkoutBtn').style.display = this.items.length ? '' : 'none';
      const box = $('#cartItems');
      box.innerHTML = this.items.length ? this.items.map(i => `<div class="ci"><img src="${esc(i.image)}" alt=""><div><div class="n">${esc(i.name)}</div>${i.variant ? `<div class="v">${esc(i.variant)}</div>` : ''}<div class="q"><button data-k="${esc(i.key)}" data-d="-1">−</button><span>${i.qty}</span><button data-k="${esc(i.key)}" data-d="1">+</button></div></div><div><div class="p">${fmt(i.price * i.qty)}</div><button class="rm" data-k="${esc(i.key)}" data-d="rm">remove</button></div></div>`).join('') : '<div class="empty-note">Cart is empty<br><br><a href="store.html" class="link-arrow">Visit the store</a></div>';
      document.dispatchEvent(new CustomEvent('cart:change'));
    },
    init() {
      this.load(); this.render();
      $('#cartBtn').addEventListener('click', () => this.open());
      $('#drawerX').addEventListener('click', () => this.close()); $('#drawerBg').addEventListener('click', () => this.close());
      $('#cartItems').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (!b) return; const it = this.items.find(i => i.key === b.dataset.k); if (!it) return; if (b.dataset.d === 'rm') this.setQty(it.key, 0); else this.setQty(it.key, it.qty + parseInt(b.dataset.d)); });
      $('#checkoutBtn').addEventListener('click', () => { this.close(); if (PAGE === 'store.html') { const c = $('#checkout'); if (c) c.scrollIntoView({ behavior: 'smooth' }); } });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') { this.close(); const m = $('.modal-bg.open'); if (m) modal.close(); } });
    }
  };

  // ---------- modal ----------
  const modal = {
    open(html) {
      let bg = $('#modalBg');
      if (!bg) { document.body.insertAdjacentHTML('beforeend', '<div class="modal-bg" id="modalBg"><div class="modal" id="modal"></div></div>'); bg = $('#modalBg'); bg.addEventListener('click', e => { if (e.target === bg) modal.close(); }); }
      $('#modal').innerHTML = '<button class="mx" id="modalX" aria-label="close"></button>' + html;
      $('#modalX').addEventListener('click', () => modal.close());
      requestAnimationFrame(() => bg.classList.add('open')); document.body.classList.add('no-scroll');
      motion($('#modal'));
    },
    close() { const bg = $('#modalBg'); if (bg) bg.classList.remove('open'); document.body.classList.remove('no-scroll'); }
  };

  const stars = n => '<span class="stars">' + [1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('') + '</span>';

  // ---------- boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    if (/static/.test(location.search)) document.body.classList.add('static'); injectChrome(); preloader(); transitions(); cursor(); nav(); cart.init(); motion();
    document.dispatchEvent(new CustomEvent('lz:ready'));
  });

  window.LZ = { $, $$, api, content, track, toast, cart, modal, motion, fmt, esc, stars, sid, REDUCED };
})();
