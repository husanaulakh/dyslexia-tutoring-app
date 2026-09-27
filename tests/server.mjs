import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const headersConfig = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).headers?.[0]?.headers ?? [];
const securityHeaders = Object.fromEntries(headersConfig.map(({ key, value }) => [key.toLowerCase(), value]));
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.svg':'image/svg+xml' };
const port = Number(process.env.PORT || 4173);

http.createServer((req, res) => {
  Object.entries(securityHeaders).forEach(([key, value]) => res.setHeader(key, value));
  res.setHeader('Cache-Control', 'no-store');
  let requestPath;
  try { requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end('Bad request'); return; }
  if (requestPath.includes('\0') || requestPath.includes('\\')) { res.writeHead(400).end('Bad request'); return; }
  if (requestPath === '/') requestPath = '/index.html';
  let filename = path.resolve(root, `.${requestPath}`);
  if (!filename.startsWith(root + path.sep) && filename !== path.join(root, 'index.html')) { res.writeHead(403).end('Forbidden'); return; }
  if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) filename = path.join(filename, 'index.html');
  if (!fs.existsSync(filename) && !path.extname(filename) && fs.existsSync(`${filename}.html`)) filename += '.html';
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) { res.writeHead(404).end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff' });
  fs.createReadStream(filename).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Test server listening on http://127.0.0.1:${port}`));
