// Minimal static server for E2E fixture pages. Content scripts only run on http(s) pages,
// so fixtures must be served over HTTP rather than opened from file://.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./pages/', import.meta.url));
const port = Number(process.env.FIXTURE_PORT ?? 4321);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/health') {
    res.writeHead(200).end('ok');
    return;
  }
  const path = normalize(join(root, url.pathname === '/' ? 'article.html' : url.pathname));
  if (!path.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`fixtures on http://127.0.0.1:${port}`);
});
