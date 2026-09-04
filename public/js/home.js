/* Home page: wireframe hero, content strips, delivery check, contact */
(function () {
  'use strict';
  document.addEventListener('lz:ready', () => {
    const { $, $$, api, content, track, toast, cart, modal, motion, fmt, esc, stars, sid, REDUCED } = window.LZ;

    // ---------- HUD date ----------
    const d = new Date(); $('#hudDate').textContent = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`;

    // ---------- marquees ----------
    const items1 = ['FDM · SLA · NYLON CF', 'SAME-DAY PICKUP IN MARGATE', 'COURIER ACROSS BROWARD', 'SHIPPING TO ALL 50 STATES', 'INSTANT QUOTES', '0.05 MM LAYERS', 'CAD & REVERSE ENGINEERING', 'SMALL-BATCH PRODUCTION'];
    $('#marquee1').innerHTML = items1.concat(items1).map(t => `<span>${t}</span>`).join('');
    const items2 = ['UPLOAD', 'QUOTE', 'PRINT', 'DELIVER'];
    $('#marquee2').innerHTML = items2.concat(items2, items2).map(t => `<span>${t}</span>`).join('');

    // ---------- hero canvas: software-rendered wireframe ----------
    (function hero() {
      const cv = $('#heroCanvas'); if (!cv) return;
      const ctx = cv.getContext('2d');
      let W, H, DPR;
      const resize = () => { DPR = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); };
      resize(); addEventListener('resize', resize);
      // icosphere
      const t = (1 + Math.sqrt(5)) / 2;
      let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v => { const l = Math.hypot(...v); return v.map(x => x / l); });
      let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
      // subdivide once
      const mid = {}; const midpoint = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (mid[k] != null) return mid[k]; const m = V[a].map((x, i) => (x + V[b][i]) / 2); const l = Math.hypot(...m); V.push(m.map(x => x / l)); return mid[k] = V.length - 1; };
      F = F.flatMap(([a, b, c]) => { const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]; });
      const edges = new Set(); F.forEach(f => { for (let i = 0; i < 3; i++) { const a = f[i], b = f[(i + 1) % 3]; edges.add(a < b ? a + '_' + b : b + '_' + a); } });
      const E = Array.from(edges).map(k => k.split('_').map(Number));
      // terrain grid
      const GN = 26, GM = 14;
      let mx = 0, my = 0, tx = 0, ty = 0;
      addEventListener('mousemove', e => { tx = (e.clientX / innerWidth - .5); ty = (e.clientY / innerHeight - .5); });
      const rot = (p, ax, ay) => { let [x, y, z] = p; let c = Math.cos(ay), s = Math.sin(ay); [x, z] = [x * c - z * s, x * s + z * c]; c = Math.cos(ax); s = Math.sin(ax); [y, z] = [y * c - z * s, y * s + z * c]; return [x, y, z]; };
      const proj = (p, cx, cy, scale) => { const f = 4 / (4 + p[2]); return [cx + p[0] * scale * f, cy + p[1] * scale * f, f]; };
      let t0 = performance.now(); let visible = true;
      new IntersectionObserver(en => visible = en[0].isIntersecting).observe(cv);
      function frame(now) {
        requestAnimationFrame(frame); if (!visible) return;
        const tm = (now - t0) / 1000; mx += (tx - mx) * .04; my += (ty - my) * .04;
        ctx.clearRect(0, 0, W, H);
        const cx = W * (W > 900 ? .66 : .5), cy = H * .48, R = Math.min(W, H) * (W > 900 ? .27 : .22);
        // terrain
        ctx.lineWidth = 1;
        for (let j = 0; j < GM; j++) {
          ctx.beginPath();
          for (let i = 0; i <= GN; i++) {
            const x = (i / GN - .5) * 2.6, z = (j / GM - .5) * 1.6 + .2;
            const h = Math.sin(x * 2.1 + tm * .4) * Math.cos(z * 3 + tm * .3) * .12 + Math.sin(x * 5 + z * 4 + tm * .2) * .05;
            const p = rot([x, .95 - h, z], -.55 + my * .1, mx * .3);
            const [sx, sy] = proj(p, cx, cy + R * .1, R * 1.1);
            i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
          }
          ctx.strokeStyle = `rgba(233,231,225,${.05 + j / GM * .1})`; ctx.stroke();
        }
        // sphere
        const ax = tm * .12 + my * .8, ay = tm * .2 + mx * 1.2;
        const P = V.map((v, i) => { const n = 1 + Math.sin(tm * 1.1 + i * .7) * .035 + Math.sin(tm * .6 + v[1] * 3) * .03; return rot(v.map(x => x * n), ax, ay); });
        const S = P.map(p => proj(p, cx, cy, R));
        ctx.beginPath();
        E.forEach(([a, b]) => { const depth = (P[a][2] + P[b][2]) / 2; ctx.strokeStyle = `rgba(233,231,225,${(.12 + (1 - (depth + 1) / 2) * .5).toFixed(2)})`; ctx.beginPath(); ctx.moveTo(S[a][0], S[a][1]); ctx.lineTo(S[b][0], S[b][1]); ctx.stroke(); });
        S.forEach((s, i) => { if (P[i][2] < -.2) { ctx.fillStyle = i % 9 === 0 ? '#c8102e' : 'rgba(233,231,225,.8)'; ctx.fillRect(s[0] - 1.5, s[1] - 1.5, 3, 3); } });
        // rings
        for (let k = 0; k < 2; k++) {
          ctx.beginPath();
          for (let i = 0; i <= 90; i++) { const a = i / 90 * Math.PI * 2; const p = rot([Math.cos(a) * (1.45 + k * .25), 0, Math.sin(a) * (1.45 + k * .25)], .9 + k * .5 + my * .3, tm * (.15 + k * .1) + mx); const [sx, sy] = proj(p, cx, cy, R); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }
          ctx.setLineDash(k ? [2, 6] : []); ctx.strokeStyle = `rgba(233,231,225,${k ? .18 : .28})`; ctx.stroke(); ctx.setLineDash([]);
        }
        // scanning reticle
        const sc = (Math.sin(tm * .8) + 1) / 2;
        ctx.strokeStyle = 'rgba(200,16,46,.55)'; ctx.beginPath(); ctx.moveTo(cx - R * 1.3, cy - R + sc * 2 * R); ctx.lineTo(cx + R * 1.3, cy - R + sc * 2 * R); ctx.stroke();
        ctx.fillStyle = 'rgba(233,231,225,.6)'; ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillText(`Z ${(sc * 100).toFixed(1).padStart(5, '0')} mm`, cx + R * 1.32, cy - R + sc * 2 * R + 3);
        // brackets
        ctx.strokeStyle = 'rgba(233,231,225,.5)'; const b = R * 1.25, l = 14;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { ctx.beginPath(); ctx.moveTo(cx + sx * b, cy + sy * b - sy * l); ctx.lineTo(cx + sx * b, cy + sy * b); ctx.lineTo(cx + sx * b - sx * l, cy + sy * b); ctx.stroke(); });
      }
      if (REDUCED) { frame(performance.now()); } else requestAnimationFrame(frame);
    })();

    // ---------- content strips ----------
    content().then(c => {
      const rates = c.delivery.rates;
      $('#rLocal').textContent = fmt(rates.local).replace('.00', ''); $('#rFlorida').textContent = fmt(rates.florida).replace('.00', ''); $('#rNational').textContent = fmt(rates.national).replace('.00', '');
      $('#cAddr').textContent = c.business.address; $('#cHours').textContent = c.business.hours; $('#cPhone').textContent = c.business.phone;
      // showcase
      const feat = c.showcase.filter(s => s.featured).concat(c.showcase.filter(s => !s.featured)).slice(0, 6);
      $('#workStrip').innerHTML = feat.map((s, i) => `<a class="card rv corners" href="/showcase#${esc(s.id)}" data-track="home:work:${esc(s.title)}"><span class="c"></span><div class="num">SC-${String(i + 1).padStart(2, '0')}</div><div class="img"><img src="${esc(s.image)}" alt="${esc(s.title)}" loading="lazy"></div><div class="body"><div class="meta"><span>${esc(s.category)}</span><span>${esc(s.material)}</span></div><h3>${esc(s.title)}</h3><p>${esc(s.description).slice(0, 110)}…</p></div></a>`).join('');
      // reviews
      $('#reviewGrid').innerHTML = c.reviews.slice(0, 6).map(r => `<div class="review rv">${stars(r.rating)}<p>${esc(r.text)}</p><div class="who"><div><b>${esc(r.name)}</b><span>${esc(r.location)}</span></div><span>${esc(r.service || '')}</span></div></div>`).join('');
      // products
      const prods = c.products.filter(p => p.featured).concat(c.products.filter(p => !p.featured)).slice(0, 4);
      $('#productGrid').innerHTML = prods.map(p => `<div class="card rv corners" data-id="${esc(p.id)}"><span class="c"></span><div class="bl"><span class="tag">${esc(p.material)}</span></div><a class="img" href="/store#${esc(p.id)}" data-track="home:product:${esc(p.name)}"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"></a><div class="body"><div class="meta"><span>${esc(p.category)}</span><span>${esc(p.sku)}</span></div><div class="flex between center"><h3>${esc(p.name)}</h3><span class="price">${fmt(p.price)}</span></div><div class="mt-1"><button class="btn sm add" data-track="home:add:${esc(p.name)}">ADD TO CART <span class="arr"></span></button></div></div></div>`).join('');
      $$('#productGrid .add').forEach(b => b.addEventListener('click', () => { const p = c.products.find(x => x.id === b.closest('.card').dataset.id); cart.add(p, p.variants && p.variants[0] ? p.variants[0].name : null); }));
      motion();
      // drag-scroll strip
      const strip = $('#workStrip'); let down = false, sx = 0, sl = 0;
      strip.addEventListener('pointerdown', e => { down = true; sx = e.clientX; sl = strip.scrollLeft; });
      addEventListener('pointerup', () => down = false); strip.addEventListener('pointermove', e => { if (down) strip.scrollLeft = sl - (e.clientX - sx); });
    }).catch(e => toast('Could not load content', true));

    // ---------- zip check ----------
    $('#zipForm').addEventListener('submit', async e => {
      e.preventDefault(); const zip = $('#zipInput').value.trim(); const out = $('#zipResult');
      if (!/^\d{5}$/.test(zip)) { out.innerHTML = 'ENTER A 5-DIGIT US ZIP'; return; }
      try {
        const r = await api.get('/api/delivery/' + zip);
        const names = { pickup: 'PICKUP ZONE', local: 'LOCAL COURIER', florida: 'FLORIDA SHIPPING', national: 'NATIONWIDE SHIPPING' };
        out.innerHTML = `ZIP ${zip} → <b>${names[r.zone] || r.zone}</b><br>RATE: ${r.zone === 'pickup' ? 'FREE PICKUP · COURIER ' + fmt(r.rate) : fmt(r.rate)} · ETA: ${esc(r.eta)}<br>FREE SHIPPING ON ORDERS OVER ${fmt(r.rates.freeOver)}`;
        track('zip_check', r.zone);
        const rings = $$('#rings circle'); rings.forEach(c => c.classList.remove('hl'));
        const idx = { pickup: 2, local: 2, florida: 1, national: 0 }[r.zone]; if (rings[idx]) rings[idx].classList.add('hl');
      } catch (err) { out.textContent = err.message; }
    });

    // ---------- contact ----------
    $('#contactForm').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target; const btn = f.querySelector('button'); btn.disabled = true;
      try { await api.send('/api/messages', { name: f.name.value, email: f.email.value, message: f.message.value, sid }); toast('MESSAGE SENT · WE REPLY WITHIN AN HOUR'); f.reset(); }
      catch (err) { toast(err.message, true); } finally { btn.disabled = false; }
    });
  });
})();
