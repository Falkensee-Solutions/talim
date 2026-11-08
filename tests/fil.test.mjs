import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../server.mjs';
import { createHash } from 'node:crypto';
import * as fil from '../fil.mjs';
import * as fatiha from '../fatiha.mjs';
import { surahById } from '../active-surah.mjs';
import { alignmentReference } from '../scripts/alignment-reference.mjs';
import { validateWordPreview, validatePreviewSilences, wordPreviewAt } from '../word-preview.mjs';
import { selectedVerseRanges } from '../verse-playback.mjs';
import { buildTalimSteps } from '../memorization.mjs';
import { buildStudyRanges } from '../study-groups.mjs';
import { validateTimingDocument } from '../timing.mjs';

const json = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const document = await json('data/alignment-local-105/word-candidates.json');
const audio = document.audio;
const words = validateWordPreview(document, audio, fil);
const selected = fil.verses.map(verse => verse.id);

test('Fil is surah 105 with five verses and a separate Besmele introduction', () => {
  assert.equal(surahById(105).name, 'Fil');
  assert.equal(surahById(1).text, fatiha);
  assert.throws(() => surahById(106));
  assert.deepEqual(selected, [1, 2, 3, 4, 5]);
  assert.equal(fil.sections.length, 6);
  assert.match(fil.introduction.label, /Besmele/);
  assert.doesNotMatch(fil.introduction.arabic, /أَعُوذُ/);
  assert.equal(alignmentReference(105).source.url, fil.source.url);
  assert.equal(alignmentReference(105).sections.flatMap(section => section.words).length, 27);
  assert.throws(() => alignmentReference(106));
});

test('Fil word candidates match original audio and text without guessed or reviewed letter times', async () => {
  assert.equal(audio.sha256, createHash('sha256').update(await readFile(new URL('../105.mp3', import.meta.url))).digest('hex'));
  assert.equal(words.length, 27);
  assert.equal(words.filter(word => word.section > 0).length, 23);
  assert.ok(words.every(word => word.reviewed === false && word.issues.length === 0));
  assert.throws(() => validateWordPreview(document, audio, fatiha));
  assert.throws(() => validateWordPreview(document, { ...audio, sha256: 'wrong' }, fil));
  const timings = await json('data/fil-timing.json');
  assert.deepEqual(validateTimingDocument(timings, audio, { text: fil }), []);
  assert.throws(() => validateTimingDocument(timings, audio, { text: fil, requireComplete: true }));
});

test('Fil verse ranges cover all five verses and exclude the Besmele', () => {
  const ranges = selectedVerseRanges(words, selected, audio.duration, fil);
  assert.deepEqual(ranges.map(range => range.verse), selected);
  assert.equal(ranges[0].start, words.find(word => word.section === 1).start);
  assert.equal(ranges.at(-1).end, words.at(-1).end);
  assert.deepEqual(selectedVerseRanges(words, [6], audio.duration, fil), []);
  assert.deepEqual(selectedVerseRanges(words.filter(word => word.id !== '3:1'), selected, audio.duration, fil), []);
});

test('Fil supports full, verse, medium and word memorization with configured repetitions', () => {
  for (const [mode, teachers] of [['full', 1], ['verse', 5], ['medium', 13], ['many', 23]]) {
    const steps = buildTalimSteps(words, audio, selected, mode, null, 3, fil);
    assert.equal(steps.length, teachers * 4);
    assert.equal(steps.filter(step => step.role === 'teacher').length, teachers);
    assert.ok(steps.every(step => step.start < step.end && step.end <= audio.duration));
    assert.ok(steps.every(step => step.verse > 0));
  }
  assert.throws(() => buildTalimSteps(words, audio, [6], 'verse', null, 3, fil));
  assert.throws(() => buildTalimSteps(words, audio, [], 'many', null, 3, fil));
});

test('Fil study groups preserve word order and support a selected single step', () => {
  for (const mode of ['medium', 'many']) {
    const ranges = buildStudyRanges(words, selected, audio.duration, mode, null, fil);
    assert.deepEqual(ranges.flatMap(range => range.wordIds), words.filter(word => word.section > 0).map(word => word.id));
    const key = ranges.at(-1).key;
    assert.deepEqual(buildStudyRanges(words, selected, audio.duration, mode, [key], fil), [ranges.at(-1)]);
  }
});

test('Fil server serves original audio, hides diagnostics and keeps timing writes separate', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'talim-fil-'));
  const filTimingPath = join(directory, 'fil.json');
  const timingPath = join(directory, 'fatiha.json');
  const server = createServer({ timingPath, timingPath2: join(directory, 'fatiha-2.json'), filTimingPath });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    await rm(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await (await fetch(`${base}/fil-word-preview.json`)).json()).words.length, 27);
  assert.equal((await fetch(`${base}/fil.mjs`)).status, 200);
  assert.equal((await fetch(`${base}/data/alignment-local-105/asr-raw.json`)).status, 404);
  assert.equal((await fetch(`${base}/data/alignment-local-105-initial/word-candidates.json`)).status, 404);
  const clip = await fetch(`${base}/105.mp3`, { headers: { Range: 'bytes=0-99' } });
  assert.equal(clip.status, 206);
  assert.deepEqual(Buffer.from(await clip.arrayBuffer()), (await readFile(new URL('../105.mp3', import.meta.url))).subarray(0, 100));
  const initial = await (await fetch(`${base}/api/timings?surah=105`)).json();
  assert.equal(initial.audio.sha256, audio.sha256);
  const unit = fil.alignmentUnits.find(unit => !fatiha.alignmentUnits.some(other => other.id === unit.id));
  const draft = { ...initial, timings: [{ id: unit.id, start: 1, end: 2, reviewed: false }] };
  const saved = await fetch(`${base}/api/timings?surah=105`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).timings[0].id, unit.id);
  assert.equal(JSON.parse(await readFile(filTimingPath, 'utf8')).timings[0].id, unit.id);
  await assert.rejects(readFile(timingPath), { code: 'ENOENT' });
  assert.equal((await fetch(`${base}/api/timings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })).status, 400);
  assert.equal((await fetch(`${base}/api/timings?surah=105&reciter=2`)).status, 400);
});

test('Fil preview uses its own letter units and guarded silence intervals', async () => {
  const silence = validatePreviewSilences(await json('data/fil-preview-silence.json'), audio);
  assert.equal(silence.length, 7);
  for (const word of words) {
    const marker = wordPreviewAt(word.start + .001, words, [], { start: word.start });
    assert.equal(marker.letter.id, word.units[0].id);
    const continuous = wordPreviewAt(word.start + .001, words);
    assert.ok(fil.alignmentUnits.some(unit => unit.id === continuous.letter.id));
    const source = fil.sections.find(section => section.id === continuous.letter.verse).arabic;
    assert.equal(source.slice(continuous.letter.offset, continuous.letter.offset + continuous.letter.length), continuous.letter.text);
    assert.ok(fil.alignmentUnits.some(unit => unit.id === marker.letter.id));
  }
  for (const interval of silence) assert.equal(wordPreviewAt((interval.start + interval.end) / 2, words, silence), null);
});
