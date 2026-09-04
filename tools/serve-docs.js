/* Serves docs/ under a sub-path to mimic GitHub Pages project hosting.
   node tools/serve-docs.js  ->  http://localhost:4000/layer-zero-3d-print-lab/ */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'docs');
const PREFIX = '/layer-zero-3d-print-lab';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (!p.startsWith(PREFIX)) { res.writeHead(404); return res.end('outside prefix'); }
  p = p.slice(PREFIX.length) || '/';
  if (p.endsWith('/')) p += 'index.html';
  const abs = path.normalize(path.join(ROOT, p));
  if (!abs.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(abs, (e, d) => {
    if (e) { const nf = fs.readFileSync(path.join(ROOT, '404.html')); res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(nf); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream' });
    res.end(d);
  });
}).listen(4000, () => console.log('docs/ on http://localhost:4000' + PREFIX + '/'));
