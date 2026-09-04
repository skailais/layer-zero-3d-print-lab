/* Generates procedural SVG artwork for seed items: dark technical/blueprint style. */
'use strict';
const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, '..', 'public', 'assets');
fs.mkdirSync(OUT, { recursive: true });

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const W = 800, H = 600;
const INK = '#e9e7e1', DIM = '#6b6b6b', RED = '#c8102e', BG = '#0d0d0e';

function frame(body, seed, label, opts = {}) {
  const r = rng(seed);
  let dots = '';
  for (let i = 0; i < 90; i++) { const x = r() * W, y = r() * H, s = r() * 2.2; dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.toFixed(2)}" fill="${INK}" opacity="${(0.15 + r() * 0.5).toFixed(2)}"/>`; }
  let splat = '';
  for (let i = 0; i < 6; i++) { const x = 80 + r() * (W - 160), y = 60 + r() * (H - 120); for (let j = 0; j < 14; j++) { const a = r() * 6.283, d = r() * r() * 46; splat += `<circle cx="${(x + Math.cos(a) * d).toFixed(1)}" cy="${(y + Math.sin(a) * d).toFixed(1)}" r="${(r() * 3.5).toFixed(2)}" fill="${INK}" opacity="${(0.2 + r() * 0.5).toFixed(2)}"/>`; } }
  const grid = `<path d="M0 ${H / 2}H${W}M${W / 2} 0V${H}" stroke="${INK}" stroke-opacity=".08"/>` +
    [0.2, 0.8].map(f => `<path d="M0 ${H * f}H${W}M${W * f} 0V${H}" stroke="${INK}" stroke-opacity=".06"/>`).join('');
  const corners = `<g stroke="${INK}" stroke-width="1.5" fill="none" opacity=".8">
    <path d="M24 44V24h20M${W - 44} 24h20v20M24 ${H - 44}v20h20M${W - 24} ${H - 44}v20h-20"/></g>`;
  const cross = `<g stroke="${INK}" stroke-opacity=".5"><path d="M${W / 2 - 14} ${H / 2}h28M${W / 2} ${H / 2 - 14}v28"/><circle cx="${W / 2}" cy="${H / 2}" r="22" fill="none" stroke-opacity=".25"/></g>`;
  const text = `<g font-family="'JetBrains Mono','Courier New',monospace" font-size="11" fill="${INK}" opacity=".7" letter-spacing="1.5">
    <text x="30" y="${H - 58}">${label.toUpperCase()}</text>
    <text x="30" y="${H - 44}" opacity=".6">LZ // ${opts.code || String(seed).slice(-4)} · 26.2445N 80.2064W</text>
    <text x="${W - 30}" y="52" text-anchor="end" opacity=".6">${opts.tech || 'FDM 0.2'}</text>
    <text x="${W - 30}" y="66" text-anchor="end" opacity=".4">${opts.sub || 'MARGATE FL'}</text></g>`;
  const accent = `<rect x="30" y="52" width="6" height="${34 + Math.round(r() * 30)}" fill="${RED}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .06 0"/></filter>
<pattern id="h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V6" stroke="${INK}" stroke-width="1" stroke-opacity=".55"/></pattern>
<pattern id="h2" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><path d="M0 0V4" stroke="${INK}" stroke-width=".7" stroke-opacity=".35"/></pattern></defs>
<rect width="${W}" height="${H}" fill="${BG}"/>${grid}
<g>${body}</g>
${dots}${splat}<rect width="${W}" height="${H}" filter="url(#g)" opacity=".6"/>
${corners}${cross}${text}${accent}</svg>`;
}

// isometric helpers
const iso = (x, y, z, cx = W / 2, cy = H / 2 + 40, s = 1) => [cx + (x - y) * 0.866 * s, cy + (x + y) * 0.5 * s - z * s];
const poly = (pts, fill = 'none', stroke = INK, sw = 1.5, extra = '') => `<polygon points="${pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" ${extra}/>`;
const line = (a, b, stroke = INK, sw = 1, extra = '') => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
function box(x, y, z, w, d, h, s = 1, cx, cy) {
  const P = (a, b, c) => iso(x + a, y + b, z + c, cx, cy, s);
  const top = [P(0, 0, h), P(w, 0, h), P(w, d, h), P(0, d, h)];
  const right = [P(w, 0, h), P(w, d, h), P(w, d, 0), P(w, 0, 0)];
  const front = [P(0, d, h), P(w, d, h), P(w, d, 0), P(0, d, 0)];
  return poly(front, 'url(#h)') + poly(right, '#1c1c1e') + poly(top, '#2a2a2d');
}
function dim(a, b, text) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  return line(a, b, INK, .8, 'stroke-dasharray="3 3" opacity=".6"') + `<text x="${mx}" y="${my - 6}" font-family="monospace" font-size="10" fill="${INK}" opacity=".7" text-anchor="middle">${text}</text>`;
}

const art = {};

art['sc-terrain'] = () => {
  const r = rng(11); let s = '';
  for (let k = 0; k < 14; k++) {
    let d = ''; const cx = 400 + Math.sin(k) * 40, cy = 300 + Math.cos(k * 1.3) * 30, rad = 40 + k * 22;
    for (let a = 0; a <= 64; a++) { const t = a / 64 * 6.283; const rr = rad * (1 + 0.18 * Math.sin(3 * t + k) + 0.1 * Math.sin(7 * t + k * 2) + 0.05 * r()); const px = cx + Math.cos(t) * rr * 1.3, py = cy + Math.sin(t) * rr * 0.75; d += (a ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1); }
    s += `<path d="${d}Z" fill="none" stroke="${k % 4 === 0 ? INK : DIM}" stroke-width="${k % 4 === 0 ? 1.6 : .9}" opacity="${(1 - k / 18).toFixed(2)}"/>`;
  }
  s += `<path d="M120 470 L680 470" stroke="${INK}" opacity=".5"/>`;
  for (let i = 0; i < 24; i++) s += `<path d="M${120 + i * 24} 470v${i % 4 === 0 ? 14 : 7}" stroke="${INK}" opacity=".5"/>`;
  s += `<text x="120" y="500" font-family="monospace" font-size="10" fill="${INK}" opacity=".6">1:50 000 · 6 TILES · 40mm RELIEF</text>`;
  return frame(s, 11, 'Topographic relief', { tech: 'FDM 0.12', code: 'SC-01' });
};

art['sc-drone'] = () => {
  let s = ''; const c = [400, 300];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2; const ex = c[0] + Math.cos(a) * 200, ey = c[1] + Math.sin(a) * 140;
    s += line(c, [ex, ey], INK, 9) + line(c, [ex, ey], BG, 5) + `<circle cx="${ex}" cy="${ey}" r="62" fill="none" stroke="${INK}" stroke-width="1.2" opacity=".8"/><circle cx="${ex}" cy="${ey}" r="62" fill="url(#h2)"/><circle cx="${ex}" cy="${ey}" r="8" fill="${INK}"/>`;
    s += `<circle cx="${ex}" cy="${ey}" r="62" fill="none" stroke="${INK}" stroke-dasharray="2 6" opacity=".5"/>`;
  }
  s += `<rect x="352" y="262" width="96" height="76" fill="#1c1c1e" stroke="${INK}" stroke-width="1.5"/><rect x="366" y="276" width="68" height="48" fill="url(#h)" stroke="${INK}" stroke-width="1"/>`;
  s += `<rect x="388" y="248" width="24" height="14" fill="${RED}"/>`;
  s += dim([200, 470], [600, 470], '210 mm');
  return frame(s, 22, 'Drone frame Mk.IV', { tech: 'NYLON CF', code: 'SC-02' });
};

art['sc-gears'] = () => {
  const gear = (cx, cy, R, n, rot = 0, fill = '#1c1c1e') => {
    let d = ''; for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n; const rr = i % 2 ? R : R * 0.84; const a2 = a + Math.PI / n * 0.5; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1) + 'L' + (cx + Math.cos(a2) * rr).toFixed(1) + ' ' + (cy + Math.sin(a2) * rr).toFixed(1); }
    return `<path d="${d}Z" fill="${fill}" stroke="${INK}" stroke-width="1.4"/><circle cx="${cx}" cy="${cy}" r="${R * .55}" fill="none" stroke="${INK}" opacity=".6"/><circle cx="${cx}" cy="${cy}" r="${R * .12}" fill="${INK}"/>` + [0, 1, 2, 3, 4, 5].map(i => `<circle cx="${cx + Math.cos(i * 1.047 + rot) * R * .36}" cy="${cy + Math.sin(i * 1.047 + rot) * R * .36}" r="${R * .07}" fill="${BG}" stroke="${INK}"/>`).join('');
  };
  let s = gear(300, 300, 130, 24, 0, 'url(#h2)') + gear(470, 240, 78, 14, .2) + gear(560, 350, 95, 18, .1, '#161618') + gear(215, 440, 55, 10, .3) + `<circle cx="470" cy="240" r="6" fill="${RED}"/>`;
  s += `<text x="560" y="480" font-family="monospace" font-size="10" fill="${INK}" opacity=".6" text-anchor="middle">Ø ±0.08 mm</text>`;
  return frame(s, 33, 'Gear train', { tech: 'PETG 0.16', code: 'SC-03' });
};

art['sc-bust'] = () => {
  const r = rng(44); const pts = []; const cx = 400, cy = 290;
  for (let ring = 0; ring < 7; ring++) { const ry = cy - 150 + ring * 52; const rad = [40, 72, 88, 82, 70, 60, 120][ring]; const n = 8; for (let i = 0; i < n; i++) { const a = i / n * 6.283 + ring * 0.3; pts.push([cx + Math.cos(a) * rad * (1 + (r() - .5) * .25), ry + Math.sin(a) * rad * 0.28 + (r() - .5) * 12]); } }
  let s = '';
  for (let ring = 0; ring < 6; ring++) for (let i = 0; i < 8; i++) { const a = pts[ring * 8 + i], b = pts[ring * 8 + (i + 1) % 8], c = pts[(ring + 1) * 8 + i], d = pts[(ring + 1) * 8 + (i + 1) % 8]; const sh = ['#111112', '#1a1a1c', '#232326', 'url(#h2)', '#2c2c30'][(i + ring) % 5]; s += poly([a, b, d], sh, INK, .9) + poly([a, d, c], ['#161618', '#202023', 'url(#h)'][(i * 3 + ring) % 3], INK, .9); }
  s += `<rect x="330" y="446" width="140" height="18" fill="#1c1c1e" stroke="${INK}"/><rect x="392" y="446" width="16" height="18" fill="${RED}"/>`;
  return frame(s, 44, 'Faceted bust · study 07', { tech: 'SLA 0.05', code: 'SC-04' });
};

art['sc-tower'] = () => {
  let s = ''; const bx = 400; const top = 70, bot = 520; const wTop = 22, wBot = 110;
  const wAt = y => wTop + (wBot - wTop) * (y - top) / (bot - top);
  s += `<path d="M${bx - wBot} ${bot}L${bx - wTop} ${top}L${bx + wTop} ${top}L${bx + wBot} ${bot}" fill="url(#h2)" stroke="${INK}" stroke-width="1.6"/>`;
  for (let y = top + 30; y < bot; y += 34) { const w = wAt(y), w2 = wAt(y + 34); s += line([bx - w, y], [bx + w, y], INK, .9) + line([bx - w, y], [bx + w2, Math.min(bot, y + 34)], INK, .7) + line([bx + w, y], [bx - w2, Math.min(bot, y + 34)], INK, .7); }
  s += `<circle cx="${bx}" cy="${top - 10}" r="5" fill="${RED}"/><path d="M${bx} ${top - 15}v-25" stroke="${INK}"/>`;
  for (let i = 0; i < 3; i++) s += `<path d="M${bx + 40 + i * 14} ${top + 90 - i * 10}a${30 + i * 16} ${30 + i * 16} 0 0 1 0 ${60 + i * 32}" fill="none" stroke="${INK}" opacity="${.5 - i * .12}"/>`;
  s += dim([bx + 150, top], [bx + 150, bot], '410 mm');
  return frame(s, 55, 'Signal tower · 1:100', { tech: 'FDM 0.10', code: 'SC-05' });
};

art['sc-enclosure'] = () => {
  let s = box(0, 0, 0, 170, 120, 62, 1.5, 420, 330);
  const P = (a, b, c) => iso(a, b, c, 420, 330, 1.5);
  // lid outline + screws
  s += poly([P(10, 10, 62), P(160, 10, 62), P(160, 110, 62), P(10, 110, 62)], 'none', INK, .8, 'stroke-dasharray="4 3"');
  for (const [a, b] of [[16, 16], [154, 16], [154, 104], [16, 104]]) { const p = P(a, b, 62); s += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${BG}" stroke="${INK}"/>`; }
  // ports on front
  for (let i = 0; i < 3; i++) { const p = P(40 + i * 36, 120, 22); s += `<rect x="${p[0] - 9}" y="${p[1] - 9}" width="18" height="18" fill="${BG}" stroke="${INK}" transform="skewY(30) translate(0 ${-p[0] * .577})"/>`; }
  const q = P(85, 120, 40); s += `<rect x="${q[0] - 20}" y="${q[1] - 4}" width="40" height="8" fill="${RED}" transform="skewY(30) translate(0 ${-q[0] * .577})"/>`;
  s += dim(P(0, 135, 0), P(170, 135, 0), '84 mm');
  s += `<text x="560" y="150" font-family="monospace" font-size="10" fill="${INK}" opacity=".6">IP54 · ×40</text>`;
  return frame(s, 66, 'Sensor enclosure', { tech: 'ABS 0.20', code: 'SC-06' });
};

art['sc-lamp'] = () => {
  let s = ''; const cx = 400, cy = 300;
  for (let k = 0; k < 26; k++) { const y = 110 + k * 15; const rad = 80 + Math.sin(k / 25 * Math.PI) * 90; const rot = k * 0.11; let d = ''; for (let i = 0; i < 6; i++) { const a = rot + i * Math.PI / 3; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rad).toFixed(1) + ' ' + (y + Math.sin(a) * rad * 0.28).toFixed(1); } s += `<path d="${d}Z" fill="none" stroke="${INK}" stroke-width="${k % 5 === 0 ? 1.4 : .7}" opacity="${(.35 + .65 * (k / 26)).toFixed(2)}"/>`; }
  s += `<circle cx="${cx}" cy="${cy}" r="12" fill="${RED}" opacity=".9"/><circle cx="${cx}" cy="${cy}" r="40" fill="none" stroke="${RED}" opacity=".3"/>`;
  return frame(s, 77, 'Parametric lamp shade', { tech: 'VASE MODE', code: 'SC-07' });
};

art['sc-grip'] = () => {
  const r = rng(88); let s = ''; let d = '';
  for (let i = 0; i <= 40; i++) { const t = i / 40 * 6.283; const rr = 120 * (1 + .22 * Math.sin(2 * t) + .12 * Math.cos(5 * t)); d += (i ? 'L' : 'M') + (400 + Math.cos(t) * rr * 1.4).toFixed(1) + ' ' + (300 + Math.sin(t) * rr * .8).toFixed(1); }
  s += `<path d="${d}Z" fill="url(#h)" stroke="${INK}" stroke-width="1.8"/>`;
  for (let k = 1; k < 5; k++) { let d2 = ''; for (let i = 0; i <= 40; i++) { const t = i / 40 * 6.283; const rr = 120 * (1 - k * .18) * (1 + .22 * Math.sin(2 * t) + .12 * Math.cos(5 * t)); d2 += (i ? 'L' : 'M') + (400 + Math.cos(t) * rr * 1.4).toFixed(1) + ' ' + (300 + Math.sin(t) * rr * .8).toFixed(1); } s += `<path d="${d2}Z" fill="none" stroke="${INK}" opacity="${(.8 - k * .15).toFixed(2)}"/>`; }
  for (let i = 0; i < 4; i++) s += `<circle cx="${330 + i * 46}" cy="${300}" r="14" fill="#151517" stroke="${INK}"/>`;
  s += `<text x="400" y="480" font-family="monospace" font-size="10" fill="${INK}" opacity=".6" text-anchor="middle">TPU 95A OVER PETG CORE · FIT 5/5</text>`;
  return frame(s, 88, 'Prosthetic grip', { tech: 'TPU 95A', code: 'SC-08' });
};

// ---------- products (square 1:1 framing works in 4:3 too) ----------
art['p-combs'] = () => { let s = ''; for (let i = 0; i < 6; i++) { const x = 150 + i * 90, h = 60 + i * 30; s += `<rect x="${x}" y="${420 - h}" width="60" height="${h}" fill="${i % 2 ? '#1c1c1e' : 'url(#h)'}" stroke="${INK}" stroke-width="1.4"/>`; for (let k = 0; k < 4; k++) s += `<rect x="${x + 8 + k * 12}" y="${420 - h - 10}" width="6" height="${h * .6 + 10}" fill="${BG}" stroke="${INK}"/>`; } s += `<rect x="150" y="420" width="510" height="6" fill="${RED}"/>`; return frame(s, 101, 'Cable comb set', { tech: 'PLA', code: 'LZ-CC-01' }); };
art['p-planter'] = () => { let s = ''; const P = (a, b, c) => iso(a, b, c, 400, 330, 1.7); const hexTop = [], hexBot = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + .2; hexTop.push(P(Math.cos(a) * 70, Math.sin(a) * 70, 120)); hexBot.push(P(Math.cos(a) * 55, Math.sin(a) * 55, 0)); } for (let i = 0; i < 6; i++) { const j = (i + 1) % 6; s += poly([hexTop[i], hexTop[j], hexBot[j], hexBot[i]], ['#1c1c1e', 'url(#h)', '#242427', '#151517', 'url(#h2)', '#1f1f22'][i], INK, 1.2); } s += poly(hexTop, '#2b2b2f', INK, 1.4); s += `<ellipse cx="400" cy="${hexTop[0][1] + 10}" rx="48" ry="16" fill="${BG}" stroke="${INK}" opacity=".8"/>`; s += `<path d="M400 ${hexTop[0][1]} c-20 -60 10 -90 30 -120 M400 ${hexTop[0][1]} c20 -40 -5 -80 -40 -100" stroke="${INK}" fill="none" stroke-width="1.5"/>`; s += dim([260, 480], [540, 480], '120 mm A/F'); return frame(s, 102, 'Hex planter', { tech: 'PETG', code: 'LZ-HP-120' }); };
art['p-dock'] = () => { let s = box(0, 0, 0, 90, 130, 24, 1.9, 400, 340); const P = (a, b, c) => iso(a, b, c, 400, 340, 1.9); s += poly([P(10, 30, 24), P(80, 30, 24), P(80, 30, 130), P(10, 30, 130)], '#111112', INK, 1.4); s += poly([P(14, 30, 30), P(76, 30, 30), P(76, 30, 124), P(14, 30, 124)], 'url(#h2)', INK, .8); const q = P(45, 30, 20); s += `<circle cx="${q[0]}" cy="${q[1]}" r="4" fill="${RED}"/>`; s += `<path d="M ${P(45, 130, 12)[0]} ${P(45, 130, 12)[1]} q -60 60 -120 30" stroke="${INK}" fill="none" stroke-dasharray="3 3"/>`; return frame(s, 103, 'Phone dock · tilt', { tech: 'PLA MATTE', code: 'LZ-PD-02' }); };
art['p-hook'] = () => { let s = `<rect x="330" y="120" width="40" height="150" fill="#1c1c1e" stroke="${INK}" stroke-width="1.4"/><path d="M370 270 h90 a40 40 0 0 1 0 80 h-30" fill="none" stroke="${INK}" stroke-width="20"/><path d="M370 270 h90 a40 40 0 0 1 0 80 h-30" fill="none" stroke="${BG}" stroke-width="14"/><path d="M370 270 h90 a40 40 0 0 1 0 80 h-30" fill="none" stroke="url(#h)" stroke-width="14"/>`; s += `<circle cx="350" cy="150" r="6" fill="${BG}" stroke="${INK}"/><circle cx="350" cy="240" r="6" fill="${BG}" stroke="${INK}"/><rect x="330" y="190" width="40" height="8" fill="${RED}"/>`; s += `<path d="M310 100 v300" stroke="${INK}" opacity=".3" stroke-dasharray="6 4"/>`; s += `<text x="470" y="440" font-family="monospace" font-size="10" fill="${INK}" opacity=".6">LOAD 2.0 kg</text>`; return frame(s, 104, 'Headset wall mount', { tech: 'PETG', code: 'LZ-WM-04' }); };
art['p-coasters'] = () => { let s = ''; const pos = [[280, 220], [520, 220], [280, 400], [520, 400]]; pos.forEach(([cx, cy], k) => { s += `<circle cx="${cx}" cy="${cy}" r="82" fill="#161618" stroke="${INK}" stroke-width="1.4"/>`; for (let i = 1; i < 6; i++) { let d = ''; for (let a = 0; a <= 40; a++) { const t = a / 40 * 6.283; const rr = 82 - i * 13 + Math.sin(t * 3 + k + i) * 5; d += (a ? 'L' : 'M') + (cx + Math.cos(t) * rr).toFixed(1) + ' ' + (cy + Math.sin(t) * rr).toFixed(1); } s += `<path d="${d}Z" fill="none" stroke="${INK}" opacity="${.9 - i * .14}"/>`; } }); s += `<circle cx="520" cy="220" r="5" fill="${RED}"/>`; return frame(s, 105, 'Terrain coasters ×4', { tech: 'PLA MATTE', code: 'LZ-TC-04' }); };
art['p-drawer'] = () => { let s = box(0, 0, 0, 120, 160, 100, 1.4, 400, 350); const P = (a, b, c) => iso(a, b, c, 400, 350, 1.4); for (let k = 0; k < 2; k++) { s += poly([P(8, 160, 8 + k * 50), P(112, 160, 8 + k * 50), P(112, 160, 42 + k * 50), P(8, 160, 42 + k * 50)], '#0f0f10', INK, 1) ; const m = P(60, 160, 25 + k * 50); s += `<rect x="${m[0] - 16}" y="${m[1] - 3}" width="32" height="6" fill="${k ? RED : INK}" transform="skewY(30) translate(0 ${-m[0] * .577})"/>`; } s += poly([P(8, 20, 100), P(112, 20, 100), P(112, 140, 100), P(8, 140, 100)], 'none', INK, .7, 'stroke-dasharray="4 3"'); s += dim(P(130, 0, 0), P(130, 160, 0), '2U'); return frame(s, 106, 'Modular drawer', { tech: 'PETG', code: 'LZ-MD-2U' }); };
art['p-fox'] = () => { const r = rng(107); let s = ''; const tri = (a, b, c, f) => poly([a, b, c], f, INK, .9); const head = [[400, 150], [330, 230], [470, 230], [360, 300], [440, 300], [400, 350], [300, 180], [500, 180], [400, 260]]; const faces = [[0, 6, 1], [0, 1, 8], [0, 8, 2], [0, 2, 7], [1, 3, 8], [8, 4, 2], [3, 5, 8], [8, 5, 4], [6, 1, 3], [7, 2, 4]]; faces.forEach((f, i) => s += tri(head[f[0]], head[f[1]], head[f[2]], ['#1c1c1e', 'url(#h)', '#242427', '#111112', 'url(#h2)'][i % 5])); s += poly([[360, 350], [440, 350], [480, 470], [320, 470]], '#161618', INK, 1.2) + poly([[440, 350], [480, 470], [560, 440], [520, 380]], 'url(#h)', INK, 1) + poly([[330, 230], [300, 180], [345, 205]], RED, INK, .8); s += `<circle cx="372" cy="262" r="3" fill="${INK}"/><circle cx="428" cy="262" r="3" fill="${INK}"/>`; return frame(s, 107, 'Low-poly fox', { tech: 'RESIN', code: 'LZ-LF-01' }); };
art['p-keys'] = () => { let s = `<rect x="300" y="180" width="60" height="240" rx="6" fill="#1c1c1e" stroke="${INK}" stroke-width="1.4"/><rect x="440" y="180" width="60" height="240" rx="6" fill="url(#h)" stroke="${INK}" stroke-width="1.4"/>`; for (let i = 0; i < 3; i++) { const a = -30 + i * 25; s += `<g transform="rotate(${a} 400 210)"><rect x="392" y="200" width="16" height="200" rx="4" fill="#111112" stroke="${INK}"/><path d="M408 300h6v10h-6v10h6v10h-6" stroke="${INK}" fill="none"/></g>`; } s += `<circle cx="400" cy="210" r="10" fill="${BG}" stroke="${INK}" stroke-width="1.5"/><circle cx="400" cy="390" r="10" fill="${BG}" stroke="${INK}" stroke-width="1.5"/><rect x="300" y="290" width="60" height="10" fill="${RED}"/>`; return frame(s, 108, 'Key organizer', { tech: 'NYLON', code: 'LZ-KO-01' }); };

for (const [name, fn] of Object.entries(art)) fs.writeFileSync(path.join(OUT, name + '.svg'), fn());
console.log('generated', Object.keys(art).length, 'assets');
