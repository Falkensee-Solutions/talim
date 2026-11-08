import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createTimingStore } from './timing-store.mjs';

const root = new URL('./', import.meta.url);
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/site-config.json', ['site-config.json', 'application/json; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/waveform.css', ['waveform.css', 'text/css; charset=utf-8']],
  ['/waveform.mjs', ['waveform.mjs', 'text/javascript; charset=utf-8']],
  ['/hold-timing.mjs', ['hold-timing.mjs', 'text/javascript; charset=utf-8']],
  ['/hold-timing.css', ['hold-timing.css', 'text/css; charset=utf-8']],
  ['/memorization.mjs', ['memorization.mjs', 'text/javascript; charset=utf-8']],
  ['/memorization.css', ['memorization.css', 'text/css; charset=utf-8']],
  ['/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']],
  ['/word-preview.mjs', ['word-preview.mjs', 'text/javascript; charset=utf-8']],
  ['/verse-playback.mjs', ['verse-playback.mjs', 'text/javascript; charset=utf-8']],
  ['/study-groups.mjs', ['study-groups.mjs', 'text/javascript; charset=utf-8']],
  ['/word-preview.json', ['data/alignment-local-001-verified/word-candidates.json', 'application/json; charset=utf-8']],
  ['/preview-silence.json', ['data/preview-silence.json', 'application/json; charset=utf-8']],
  ['/final-preview.json', ['data/final-phrase-local/preview-overrides.json', 'application/json; charset=utf-8']],
  ['/fatiha.mjs', ['fatiha.mjs', 'text/javascript; charset=utf-8']],
  ['/timing.mjs', ['timing.mjs', 'text/javascript; charset=utf-8']],
  ['/001.mp3', ['001.mp3', 'audio/mpeg']],
]);

export function parseRange(range, size) {
  if (!range) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return false;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return false;
  return { start, end };
}

export function createServer({ timingPath = fileURLToPath(new URL('data/fatiha-timing.json', root)) } = {}) {
  const store = createTimingStore({ audioPath: fileURLToPath(new URL('001.mp3', root)), timingPath });
  return http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/api/timings') {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      const respond = (status, value) => { response.writeHead(status); response.end(JSON.stringify(value)); };
      try {
        if (request.method === 'GET') { respond(200, await store.load()); return; }
        if (request.method !== 'POST') { response.setHeader('Allow', 'GET, POST'); respond(405, { error: 'Yöntem desteklenmiyor.' }); return; }
        const origin = request.headers.origin;
        if ((origin && origin !== `http://${request.headers.host}`)
          || !request.headers['content-type']?.startsWith('application/json')) {
          respond(403, { error: 'Yalnızca aynı sayfadan JSON kaydı kabul edilir.' }); return;
        }
        let body = '';
        for await (const chunk of request) {
          body += chunk.toString('utf8');
          if (Buffer.byteLength(body) > 1024 * 1024) { respond(413, { error: 'Dosya çok büyük.' }); return; }
        }
        const saved = await store.save(JSON.parse(body));
        respond(200, saved);
      } catch (error) {
        respond(request.method === 'GET' ? 500 : 400, { error: error.message });
      }
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
    }
    const entry = files.get(new URL(request.url, 'http://localhost').pathname);
    if (!entry) { response.writeHead(404); response.end('Bulunamadı'); return; }
    try {
      const path = fileURLToPath(new URL(entry[0], root));
      const { size } = await stat(path);
      const range = parseRange(request.headers.range, size);
      const headers = {
        'Content-Type': entry[1], 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; media-src 'self' blob:; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      };
      if (entry[1] === 'audio/mpeg' && !range && request.method === 'GET') {
        headers['X-Audio-SHA256'] = createHash('sha256').update(await readFile(path)).digest('hex');
      }
      if (range === false) {
        response.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }); response.end(); return;
      }
      if (range) {
        headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
        headers['Content-Length'] = range.end - range.start + 1;
      } else headers['Content-Length'] = size;
      response.writeHead(range ? 206 : 200, headers);
      if (request.method === 'HEAD') { response.end(); return; }
      const stream = createReadStream(path, range || undefined);
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    } catch {
      if (!response.headersSent) response.writeHead(500);
      response.end('Dosya okunamadı.');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  const host = process.env.HOST || '127.0.0.1';
  const server = createServer();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, host, () => console.log(`Talim hazır: http://${host}:${port}`));
}
