// Local static preview only. Vercel serves these files directly, without this server.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.md':'text/plain; charset=utf-8'};
http.createServer((req, res) => {
  let name;
  try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!file.startsWith(root + path.sep) || name.split('/').some(p => p.startsWith('.'))) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, content) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(content);
  });
}).listen(4173, '127.0.0.1', () => console.log('Squash IQ: http://127.0.0.1:4173'));
