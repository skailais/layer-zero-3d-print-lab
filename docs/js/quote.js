/* Quote: client-side STL measuring + wireframe preview + live pricing */
(function () {
  'use strict';
  document.addEventListener('lz:ready', () => {
    const { $, $$, api, track, toast, fmt, esc, sid, REDUCED } = window.LZ;
    const form = $('#qForm'); let model = null; let fileB64 = null; let fileName = null; let timer = null;

    // ---------- STL parsing ----------
    function parseSTL(buf) {
      const u8 = new Uint8Array(buf); const head = new TextDecoder().decode(u8.slice(0, 80));
      const dv = new DataView(buf);
      let tris = [];
      const isBinary = !(head.trim().startsWith('solid') && !/\x00/.test(head)) || (buf.byteLength === 84 + dv.getUint32(80, true) * 50);
      if (isBinary && buf.byteLength >= 84) {
        const n = dv.getUint32(80, true);
        if (84 + n * 50 === buf.byteLength) {
          for (let i = 0; i < n; i++) { const o = 84 + i * 50 + 12; const t = []; for (let k = 0; k < 9; k++) t.push(dv.getFloat32(o + k * 4, true)); tris.push(t); }
        }
      }
      if (!tris.length) {
        const txt = new TextDecoder().decode(u8); const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g; let m, cur = [];
        while ((m = re.exec(txt))) { cur.push(+m[1], +m[2], +m[3]); if (cur.length === 9) { tris.push(cur); cur = []; } }
      }
      if (!tris.length) throw new Error('Could not read this STL');
      let vol = 0, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const t of tris) {
        vol += (t[0] * (t[4] * t[8] - t[5] * t[7]) - t[1] * (t[3] * t[8] - t[5] * t[6]) + t[2] * (t[3] * t[7] - t[4] * t[6])) / 6;
        for (let k = 0; k < 9; k += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], t[k + a]); max[a] = Math.max(max[a], t[k + a]); }
      }
      const dims = max.map((v, i) => v - min[i]);
      return { tris, volumeMm3: Math.abs(vol), dims, min, max, faces: tris.length };
    }

    // ---------- preview ----------
    const cv = $('#preview'); const ctx = cv.getContext('2d'); let edges = null, center = null, scale = 1, raf = null;
    function setupPreview(m) {
      // decimate for drawing: cap edges
      const step = Math.max(1, Math.floor(m.tris.length / 2500));
      edges = []; for (let i = 0; i < m.tris.length; i += step) { const t = m.tris[i]; edges.push([[t[0], t[1], t[2]], [t[3], t[4], t[5]]], [[t[3], t[4], t[5]], [t[6], t[7], t[8]]], [[t[6], t[7], t[8]], [t[0], t[1], t[2]]]); }
      center = m.min.map((v, i) => (v + m.max[i]) / 2); scale = 1 / Math.max(...m.dims);
      $('#previewPh').classList.add('hidden'); $('#previewLbl').innerHTML = `PREVIEW · <b>${m.faces.toLocaleString()} FACES</b> · ${m.dims.map(d => d.toFixed(0)).join(' × ')} mm`;
      if (!raf) draw(performance.now());
    }
    function draw(now) {
      raf = requestAnimationFrame(draw); if (!edges) return;
      const DPR = Math.min(2, devicePixelRatio || 1); const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== W * DPR) { cv.width = W * DPR; cv.height = H * DPR; }
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
      const t = REDUCED ? 0.6 : now / 1000; const ay = t * .5, ax = -1.05;
      const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
      const R = Math.min(W, H) * .38;
      const P = p => { let x = (p[0] - center[0]) * scale, y = (p[1] - center[1]) * scale, z = (p[2] - center[2]) * scale; [x, z] = [x * cy - z * sy, x * sy + z * cy]; [y, z] = [y * cx - z * sx, y * sx + z * cx]; const f = 3 / (3 + z); return [W / 2 + x * R * f * 2, H / 2 - y * R * f * 2, z]; };
      ctx.lineWidth = .8;
      ctx.strokeStyle = 'rgba(233,231,225,.35)'; ctx.beginPath();
      for (const [a, b] of edges) { const A = P(a), B = P(b); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); }
      ctx.stroke();
      // build plate
      ctx.strokeStyle = 'rgba(233,231,225,.12)'; ctx.beginPath();
      const g = [[-.7, -.7], [.7, -.7], [.7, .7], [-.7, .7]].map(([x, z]) => P([center[0] + x / scale, center[1] - 0.5 / scale * (Math.max(...model.dims) * scale), center[2] + z / scale]));
      g.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.stroke();
      const sc = (Math.sin(t * 1.2) + 1) / 2; ctx.strokeStyle = 'rgba(200,16,46,.5)'; ctx.beginPath(); ctx.moveTo(W * .1, H * .15 + sc * H * .7); ctx.lineTo(W * .9, H * .15 + sc * H * .7); ctx.stroke();
    }

    // ---------- file input ----------
    const drop = $('#drop'), fileIn = $('#file');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) loadFile(f); });
    fileIn.addEventListener('change', () => { if (fileIn.files[0]) loadFile(fileIn.files[0]); });
    function loadFile(f) {
      if (f.size > 20 * 1024 * 1024) { toast('FILE TOO LARGE · 20 MB MAX', true); return; }
      fileName = f.name; $('#fname').textContent = `${f.name} · ${(f.size / 1024).toFixed(0)} KB`; drop.classList.add('has'); $('#dropTitle').textContent = 'MODEL LOADED';
      track('file_upload', f.name.split('.').pop().toLowerCase(), f.size);
      const r = new FileReader();
      r.onload = () => {
        fileB64 = r.result; // data URL
        if (/\.stl$/i.test(f.name)) {
          const rb = new FileReader();
          rb.onload = () => {
            try {
              model = parseSTL(rb.result);
              const cm3 = model.volumeMm3 / 1000;
              form.volumeCm3.value = cm3.toFixed(2);
              $('#dimsHint').textContent = `${model.dims.map(d => d.toFixed(1)).join(' × ')} mm · ${model.faces.toLocaleString()} faces`;
              setupPreview(model); estimate();
              toast('MODEL MEASURED · ' + cm3.toFixed(1) + ' cm³');
            } catch (err) { toast(err.message, true); }
          };
          rb.readAsArrayBuffer(f);
        } else { $('#dimsHint').textContent = 'We will measure this format after upload — enter volume if known'; estimate(); }
      };
      r.readAsDataURL(f);
    }

    // ---------- estimate ----------
    const params = () => ({ material: form.material.value, infill: +form.infill.value, qty: +form.qty.value || 1, finish: form.finish.value, rush: form.rush.checked, volumeCm3: +form.volumeCm3.value || 0 });
    async function estimate() {
      const p = params(); $('#infillVal').textContent = p.infill + '%'; $('#eQty').textContent = p.qty;
      if (!p.volumeCm3) { $('#eTotal').textContent = '$—'; $('#eGrams').textContent = '—'; $('#eHours').textContent = '—'; $('#eLead').textContent = '—'; $('#eUnit').textContent = 'DROP AN STL OR ENTER A VOLUME'; return; }
      try {
        const e = await api.send('/api/quotes/estimate', p);
        $('#eGrams').textContent = e.grams; $('#eHours').textContent = e.printHours; $('#eLead').textContent = e.leadDays;
        const tot = $('#eTotal'); tot.textContent = fmt(e.total); tot.classList.add('pulse'); setTimeout(() => tot.classList.remove('pulse'), 400);
        $('#eUnit').textContent = p.qty > 1 ? `${fmt(e.total / p.qty)} PER UNIT` : `SETUP FEE INCLUDED`;
      } catch (err) { $('#eUnit').textContent = err.message; }
    }
    form.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(estimate, 200); });
    form.addEventListener('change', () => { clearTimeout(timer); timer = setTimeout(estimate, 50); });
    estimate();

    // ---------- submit ----------
    form.addEventListener('submit', async e => {
      e.preventDefault(); $$('.field', form).forEach(x => x.classList.remove('err')); let ok = true;
      ['name', 'email'].forEach(n => { if (!form[n].value.trim()) { form[n].closest('.field').classList.add('err'); ok = false; } });
      if (!ok) { toast('NAME AND EMAIL ARE REQUIRED', true); return; }
      if (!fileB64 && !form.volumeCm3.value && !form.notes.value.trim()) { toast('ADD A FILE, A VOLUME, OR DESCRIBE THE PART', true); return; }
      const btn = $('#qBtn'); btn.disabled = true; btn.firstChild.textContent = 'SENDING… ';
      try {
        const body = Object.assign(params(), { name: form.name.value, email: form.email.value, phone: form.phone.value, zip: form.zip.value, notes: form.notes.value, dims: model ? model.dims.map(d => d.toFixed(1)).join(' × ') + ' mm' : '', fileData: fileB64, fileName, sid });
        const r = await api.send('/api/quotes', body);
        form.innerHTML = `<div class="confirm" style="border-color:var(--red)"><div class="mono red mb-2">QUOTE REQUEST RECEIVED</div><div class="display">GOT IT</div><div class="oid">${esc(r.quote.id)}</div><p class="lead" style="margin:0 auto 20px">Estimate ${fmt(r.quote.estimate.total)}. A technician will confirm the final price and lead time by email within one business hour.</p><a href="showcase.html" class="btn sm">BROWSE THE SHOWCASE MEANWHILE</a></div>`;
        toast('QUOTE ' + r.quote.id + ' SENT');
      } catch (err) { toast(err.message, true); btn.disabled = false; btn.firstChild.textContent = 'REQUEST FINAL QUOTE '; }
    });
  });
})();
