/* Reports computed geometry/visibility for selectors on a page.
   node tools/probe.js <url> "sel1,sel2,..." */
'use strict';
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path'); const os = require('os');
const [url, sels] = process.argv.slice(2);
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
const port = 9800 + Math.floor(Math.random() * 300);
const udd = path.join(os.tmpdir(), 'lz-probe-' + port);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${udd}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let t;
  for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }); t = await r.json(); break; } catch { await sleep(250); } }
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  await new Promise(r => ws.onopen = r);
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url }); await sleep(3500);
  const expr = `JSON.stringify(${JSON.stringify(sels.split(','))}.map(function(s){
    var e=document.querySelector(s); if(!e) return {s:s,found:false};
    var c=getComputedStyle(e), r=e.getBoundingClientRect();
    return {s:s,found:true,display:c.display,opacity:c.opacity,visibility:c.visibility,z:c.zIndex,pos:c.position,
      top:Math.round(r.top),left:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height),
      color:c.color,text:(e.textContent||'').trim().slice(0,40)};
  }))`;
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log(JSON.stringify(JSON.parse(r.result.result.value), null, 1));
  ws.close(); chrome.kill(); setTimeout(() => { try { fs.rmSync(udd, { recursive: true, force: true }); } catch { } process.exit(0); }, 200);
})().catch(e => { console.error(e.message); chrome.kill(); process.exit(1); });
