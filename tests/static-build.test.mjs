import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStatic, staticAssets } from '../scripts/build-static.mjs';

test('Pages build publishes a validated, read-only allowlist and original audio only', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'talim-pages-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, 'site');
  const files = await buildStatic(output);
  assert.deepEqual(files, [...staticAssets, '.nojekyll', 'site-config.json', 'timings.json', 'word-preview.json', 'preview-silence.json', 'final-preview.json',
    'timings-2.json', 'word-preview-2.json', 'preview-silence-2.json',
    'fil-timings.json', 'fil-word-preview.json', 'fil-preview-silence.json'].sort());
  assert.deepEqual((await readdir(output)).sort(), files);
  assert.deepEqual(JSON.parse(await readFile(join(output, 'site-config.json'))), { timingStorage: 'static' });
  const silence = JSON.parse(await readFile(join(output, 'preview-silence.json')));
  assert.equal('rawLog' in silence, false);
  assert.equal(silence.silences.length, 6);
  assert.equal(JSON.parse(await readFile(join(output, 'word-preview.json'))).words.length, 34);
  assert.equal(JSON.parse(await readFile(join(output, 'final-preview.json'))).overrides.length, 3);
  assert.deepEqual(await readFile(join(output, '001.mp3')), await readFile(new URL('../001.mp3', import.meta.url)));
  assert.deepEqual(await readFile(join(output, 'TalimQuran.ttf')), await readFile(new URL('../TalimQuran.ttf', import.meta.url)));
  assert.match(await readFile(join(output, 'Hamdullah-NOTICE.txt'), 'utf8'), /Shaikh Hamdullah Mushaf[\s\S]*Muhammet Abay/);
  assert.ok(!files.some(file => /server|\.env|asr|diagnostic|requirements/.test(file)));
  const html = await readFile(join(output, 'index.html'), 'utf8');
  assert.match(html, /src="\.\/app\.mjs"/);
  assert.match(html, /<section id="home" class="surah-home" aria-label="Sureler">/);
  assert.match(html, /<section id="lesson"[^>]* hidden>/);
  const home = html.match(/<section id="home"[\s\S]*?<\/section>/)[0];
  assert.equal((home.match(/<li\b/g) ?? []).length, 2);
  assert.match(home, /Fil Suresi/);
  assert.deepEqual([...home.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map(match => match[1]), ['Dinle', 'Ezberle', 'Dinle', 'Ezberle']);
  assert.match(home, /id="home-memory"[^>]*aria-haspopup="dialog"/);
  assert.match(html, /class="back-home" href="#"/);
});

test('static build cannot replace the project root', async () => {
  await assert.rejects(buildStatic(fileURLToPath(new URL('../', import.meta.url))), /cannot replace/);
});
