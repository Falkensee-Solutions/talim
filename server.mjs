import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createTimingStore } from './timing-store.mjs';
import { recitersForSurah, reciterById } from './reciters.mjs';
import { surahs, surahById } from './active-surah.mjs';

const root = new URL('./', import.meta.url);
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/site-config.json', ['site-config.json', 'application/json; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/TalimQuran.ttf', ['TalimQuran.ttf', 'font/ttf']],
  ['/Hamdullah-NOTICE.txt', ['Hamdullah-NOTICE.txt', 'text/plain; charset=utf-8']],
  ['/waveform.css', ['waveform.css', 'text/css; charset=utf-8']],
  ['/waveform.mjs', ['waveform.mjs', 'text/javascript; charset=utf-8']],
  ['/hold-timing.mjs', ['hold-timing.mjs', 'text/javascript; charset=utf-8']],
  ['/hold-timing.css', ['hold-timing.css', 'text/css; charset=utf-8']],
  ['/memorization.mjs', ['memorization.mjs', 'text/javascript; charset=utf-8']],
  ['/memorization.css', ['memorization.css', 'text/css; charset=utf-8']],
  ['/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']],
  ['/word-preview.mjs', ['word-preview.mjs', 'text/javascript; charset=utf-8']],
  ['/tajweed-timing.mjs', ['tajweed-timing.mjs', 'text/javascript; charset=utf-8']],
  ['/verse-playback.mjs', ['verse-playback.mjs', 'text/javascript; charset=utf-8']],
  ['/study-groups.mjs', ['study-groups.mjs', 'text/javascript; charset=utf-8']],
  ['/word-preview.json', ['data/alignment-local-001-verified/word-candidates.json', 'application/json; charset=utf-8']],
  ['/preview-silence.json', ['data/preview-silence.json', 'application/json; charset=utf-8']],
  ['/final-preview.json', ['data/final-phrase-local/preview-overrides.json', 'application/json; charset=utf-8']],
  ['/fatiha.mjs', ['fatiha.mjs', 'text/javascript; charset=utf-8']],
  ['/timing.mjs', ['timing.mjs', 'text/javascript; charset=utf-8']],
  ['/001.mp3', ['001.mp3', 'audio/mpeg']],
]);

for (const name of ['reciters.mjs', 'active-surah.mjs', 'fil.mjs', 'quran-text.mjs']) {
  files.set(`/${name}`, [name, 'text/javascript; charset=utf-8']);
}
for (const surah of surahs) {
  for (const reciter of recitersForSurah(surah.id)) {
    files.set(`/${reciter.audio}`, [reciter.audio, 'audio/mpeg']);
    for (const [url, source] of [[reciter.timings, reciter.timingSource], [reciter.words, reciter.wordSource],
      [reciter.silence, reciter.silenceSource], [reciter.overrides, reciter.overrideSource]]) {
      if (url) files.set(`/${url}`, [source, 'application/json; charset=utf-8']);
    }
  }
}

export function parseRange(range, size) {
  if (!range) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return false;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return false;
  return { start, end };
}

export function createServer({ timingPath = fileURLToPath(new URL('data/fatiha-timing.json', root)), timingPath2 = fileURLToPath(new URL('data/fatiha-timing-2.json', root)), filTimingPath = fileURLToPath(new URL('data/fil-timing.json', root)) } = {}) {
  const paths = new Map([['1:1', timingPath], ['1:2', timingPath2], ['105:1', filTimingPath]]);
  const stores = new Map(surahs.flatMap(surah => recitersForSurah(surah.id).map(reciter => [
    `${surah.id}:${reciter.id}`, createTimingStore({
      audioPath: fileURLToPath(new URL(reciter.audio, root)), timingPath: paths.get(`${surah.id}:${reciter.id}`),
      duration: reciter.duration, text: surah.text,
    }),
  ])));
  return http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/api/timings') {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      const respond = (status, value) => { response.writeHead(status); response.end(JSON.stringify(value)); };
      try {
        const params = new URL(request.url, 'http://localhost').searchParams;
        let store;
        try {
          const surah = surahById(params.get('surah') ?? 1);
          const reciter = reciterById(params.get('reciter') ?? '1', surah.id);
          store = stores.get(`${surah.id}:${reciter.id}`);
        } catch (error) { respond(400, { error: error.message }); return; }
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
