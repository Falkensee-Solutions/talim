import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reciters, reciterById, recitersForSurah } from '../reciters.mjs';
import { validateWordPreview, validatePreviewSilences, wordPreviewAt } from '../word-preview.mjs';
import { selectedVerseRanges } from '../verse-playback.mjs';
import { buildTalimSteps } from '../memorization.mjs';
import { createServer } from '../server.mjs';
import { buildStatic } from '../scripts/build-static.mjs';

const json = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

test('second hafız has its own complete word alignment, pauses and study steps', async () => {
  assert.equal(reciterById('2').label, 'Hafız 2 AA');
  assert.equal(recitersForSurah(105).length, 1);
  assert.throws(() => reciterById('2', 105), /Bilinmeyen hafız/);
  assert.throws(() => recitersForSurah(999), /Bilinmeyen sure/);
  const first = await json(reciters[0].wordSource);
  const reciter = reciterById('2');
  const audio = { sha256: createHash('sha256').update(await readFile(new URL(`../${reciter.audio}`, import.meta.url))).digest('hex'), duration: reciter.duration };
  const document = await json(reciter.wordSource);
  const words = validateWordPreview(document, audio);
  assert.equal(words.length, 34);
  assert.notEqual(audio.sha256, first.audio.sha256);
  assert.notEqual(words[5].start, first.words[5].start);
  assert.ok(words.every(word => word.reviewed === false && word.issues.length === 0));
  const silences = validatePreviewSilences(await json(reciter.silenceSource), audio);
  assert.equal(silences.length, 10);
  assert.equal(selectedVerseRanges(words, [1, 2, 3, 4, 5, 6, 7], audio.duration).length, 7);
  for (const mode of ['full', 'verse', 'medium', 'many']) {
    const steps = buildTalimSteps(words, audio, [1, 2, 3, 4, 5, 6, 7], mode, null, 3);
    assert.ok(steps.length > 0);
  }
  assert.ok(wordPreviewAt(words[5].start + .1, words));
  assert.throws(() => validateWordPreview(first, audio), /bu sesle eşleşmiyor/);
  assert.equal((await json(reciter.timingSource)).timings.length, 0);
});

test('second recording is seekable and timing API saves only to its selected reciter', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'talim-reciters-'));
  const server = createServer({ timingPath: join(directory, 'first.json'), timingPath2: join(directory, 'second.json'), filTimingPath: join(directory, 'fil.json') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const range = await fetch(`${base}/001_2.mp3`, { headers: { Range: 'bytes=0-99' } });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 100);
  assert.equal((await fetch(`${base}/reciters.mjs`)).status, 200);
  const preview = await (await fetch(`${base}/word-preview-2.json`)).json();
  const first = await (await fetch(`${base}/api/timings`)).json();
  const second = await (await fetch(`${base}/api/timings?reciter=2`)).json();
  assert.equal(second.audio.sha256, preview.audio.sha256);
  assert.notEqual(first.audio.sha256, second.audio.sha256);
  const payload = { ...second, timings: [{ id: '1:0', start: 9, end: 9.2, reviewed: false, silent: false }] };
  const post = body => fetch(`${base}/api/timings?reciter=2`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(body) });
  assert.equal((await post(first)).status, 400);
  const saved = await post(payload);
  assert.equal(saved.status, 200, JSON.stringify(await saved.json()));
  assert.equal((await jsonFromFile(join(directory, 'second.json'))).timings.length, 1);
  assert.equal((await (await fetch(`${base}/api/timings`)).json()).timings.length, 0);
  for (const query of ['reciter=999', 'surah=999', 'surah=105&reciter=2']) {
    assert.equal((await fetch(`${base}/api/timings?${query}`)).status, 400);
  }
  assert.equal((await fetch(`${base}/data/alignment-local-001-2-aligned/asr-raw.json`)).status, 404);
});

test('static publication includes the original second audio and only its playback inputs', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'talim-reciter-static-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, 'site');
  const files = await buildStatic(output);
  for (const name of ['001_2.mp3', 'reciters.mjs', 'timings-2.json', 'word-preview-2.json', 'preview-silence-2.json']) assert.ok(files.includes(name));
  assert.deepEqual(await readFile(join(output, '001_2.mp3')), await readFile(new URL('../001_2.mp3', import.meta.url)));
  const words = await jsonFromFile(join(output, 'word-preview-2.json'));
  assert.equal(words.words.length, 34);
  assert.equal((await jsonFromFile(join(output, 'timings-2.json'))).audio.sha256, words.audio.sha256);
  assert.equal('rawLog' in await jsonFromFile(join(output, 'preview-silence-2.json')), false);
  assert.ok(!files.some(name => /asr|run\.json|status\.json|reference-aligned/.test(name)));
});

async function jsonFromFile(path) { return JSON.parse(await readFile(path, 'utf8')); }
