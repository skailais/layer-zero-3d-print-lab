/* QA helper: full-page screenshots via Chrome DevTools Protocol (no deps).
   node tools/shot.js <url> <out.png> [width] [evalJS] [waitMs] */
'use strict';
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path'); const os = require('os');
const [url, out, width = '1440', evalJS = '', waitMs = '2500', y0 = '0', hh = '0'] = process.argv.slice(2);
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const port = 9333 + Math.floor(Math.random() * 500);
const udd = path.join(os.tmpdir(), 'lz-shot-' + port);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${udd}`, `--window-size=${width},900`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let target;
  for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }); target = await r.json(); break; } catch { await sleep(250); } }
  if (!target) throw new Error('Chrome did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl); let id = 0; const pending = new Map();
  await new Promise(r => ws.onopen = r);
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: +width, height: 900, deviceScaleFactor: 1, mobile: +width < 700 });
  await send('Page.navigate', { url }); await sleep(+waitMs);
  if (evalJS) { await send('Runtime.evaluate', { expression: evalJS, awaitPromise: true }); await sleep(1500); }
  const h = await send('Runtime.evaluate', { expression: 'Math.min(12000, document.documentElement.scrollHeight)', returnByValue: true });
  const full = h.result.result.value || 900;
  await send('Runtime.evaluate', { expression: '(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=600){scrollTo(0,y);await new Promise(r=>setTimeout(r,260));} scrollTo(0,0);})()', awaitPromise: true });
  await sleep(1500);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: +y0, width: +width, height: +hh ? Math.min(+hh, full - +y0) : full, scale: 1 } });
  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log('saved', out, width + 'x' + full);
  ws.close(); chrome.kill(); setTimeout(() => { try { fs.rmSync(udd, { recursive: true, force: true }); } catch { } process.exit(0); }, 300);
})().catch(e => { console.error(e.message); chrome.kill(); process.exit(1); });
