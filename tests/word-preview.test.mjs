import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateWordPreview, applyPreviewOverrides, validatePreviewSilences, audibleDuration, wordPreviewAt } from '../word-preview.mjs';
import { parseSilences } from '../scripts/detect-preview-silence.mjs';
import { buildTalimSteps, repeatCueTime, memoryTime } from '../memorization.mjs';
import { alignmentUnits, alignmentUnitFor, hasHaraka, sections } from '../fatiha.mjs';
const document = JSON.parse(await readFile(new URL('../data/alignment-local-001-verified/word-candidates.json', import.meta.url)));
const audio = { sha256: document.audio.sha256, duration: 54.220125 };

test('real word candidates yield visual positions without saved letter timestamps', () => {
  const words = validateWordPreview(document, audio);
  assert.equal(words.length, 34);
  const word = words[0];
  assert.equal(wordPreviewAt(word.start, words).letter.id, word.units[0].id);
  const middle = wordPreviewAt((word.start + word.end) / 2, words);
  assert.equal(middle.letter.id, word.units[Math.floor(word.units.length / 2)].id);
  assert.ok(middle.fraction >= 0 && middle.fraction < 1);
  assert.equal(wordPreviewAt(word.end - .00001, words).letter.id, word.units.at(-1).id);
  assert.equal(wordPreviewAt(0, words), null);
  assert.equal(wordPreviewAt(word.end, words), null);
  assert.equal(wordPreviewAt(words.at(-1).end, words), null);
  assert.equal(document.words[0].reviewed, false);
  assert.equal('start' in middle.letter, false);
});

test('preparation cue starts at the first real group without advancing normal repeat timing', () => {
  const words = validateWordPreview(document, audio);
  for (const mode of ['full', 'verse', 'medium', 'many']) {
    const steps = buildTalimSteps(words, audio, [1, 7], mode);
    for (const step of steps.filter(step => step.role === 'child')) {
      const word = words.find(word => word.start === step.start);
      assert.ok(word);
      for (const remaining of [0.1, 0.05, 0.001]) {
        const position = wordPreviewAt(repeatCueTime(step, remaining), words);
        assert.equal(position.letter.id, word.units[0].id);
        assert.equal(position.fraction, 0);
      }
      const started = wordPreviewAt(memoryTime(step, 0), words);
      assert.equal(started.fraction, 0);
      assert.ok(wordPreviewAt(memoryTime(step, 0.01), words).fraction > 0);
    }
  }
});

test('rejects mismatched audio, letter membership, overlap and unresolved candidates', () => {
  assert.throws(() => validateWordPreview(document, { ...audio, sha256: 'wrong' }));
  for (const change of [w => { w.letterIds = ['1:0']; }, w => { w.start = null; },
    w => { w.issues = ['missing']; }, w => { w.section = 2; }, w => { w.end = 100; }]) {
    const bad = structuredClone(document);
    change(bad.words[0]);
    assert.throws(() => validateWordPreview(bad, audio));
  }
  const overlap = structuredClone(document);
  overlap.words[1].start = overlap.words[0].start;
  assert.throws(() => validateWordPreview(overlap, audio));
});

test('internal silence is excluded from visual progress and arrow is hidden in pauses', () => {
  const words = [{ start: 0, end: 4, units: [{ id: 'a' }, { id: 'b' }] }];
  const silences = [{ start: 1, end: 3 }];
  assert.equal(audibleDuration(0, 4, silences), 2);
  assert.equal(wordPreviewAt(2, words, silences), null);
  const before = wordPreviewAt(.5, words, silences);
  assert.equal(before.letter.id, 'a');
  assert.equal(before.fraction, .5);
  const after = wordPreviewAt(3.5, words, silences);
  assert.equal(after.letter.id, 'b');
  assert.equal(after.fraction, .5);
  assert.equal(wordPreviewAt(3, words, silences).fraction, 0);
  assert.equal(wordPreviewAt(1, words, silences), null);
  assert.equal(wordPreviewAt(.5, words, [{ start: 0, end: 4 }]), null);
  assert.equal(audibleDuration(0, 4, [{ start: 5, end: 6 }]), 4);
});

test('real verse-ending pauses shorten the movement without changing saved word boundaries', async () => {
  const source = JSON.parse(await readFile(new URL('../data/preview-silence.json', import.meta.url)));
  const silences = validatePreviewSilences(source, audio);
  const words = validateWordPreview(document, audio);
  assert.equal(silences.length, 6);
  assert.equal(wordPreviewAt(7, words, silences), null);
  assert.equal(wordPreviewAt(26, words, silences), null);
  assert.equal(wordPreviewAt(33.2, words, silences), null);
  assert.equal(wordPreviewAt(53.9, words, silences), null);
  const word = words.find(w => w.id === '0:4');
  assert.ok(audibleDuration(word.start, word.end, silences) < word.end - word.start - .5);
  assert.equal(document.words.find(w => w.id === word.id).end, word.end);
});

test('silence parser guards phoneme edges and closes trailing silence', () => {
  const intervals = parseSilences('silence_start: 1\nsilence_end: 2\nsilence_start: 4', 5);
  assert.deepEqual(intervals, [{ start: 1.08, end: 1.92 }, { start: 4.08, end: 4.92 }]);
  assert.deepEqual(parseSilences('silence_start: 1\nsilence_end: 1.1', 5), []);
});

test('silence validation rejects foreign audio, reversed, overlapping or nonfinite ranges', () => {
  const base = { version: 1, audio, silences: [{ start: 1, end: 2 }] };
  assert.throws(() => validatePreviewSilences(base, { ...audio, sha256: 'wrong' }));
  for (const silences of [[{ start: 2, end: 1 }], [{ start: NaN, end: 2 }],
    [{ start: 1, end: 2 }, { start: 1.5, end: 3 }], [{ start: 0, end: 100 }]]) {
    assert.throws(() => validatePreviewSilences({ ...base, silences }, audio));
  }
});

test('unmarked letters are attached to vowel groups, never independent animation steps', () => {
  const original = JSON.stringify(document);
  const text = sections.map(section => section.arabic);
  const words = validateWordPreview(document, audio);
  assert.ok(words.reduce((sum, word) => sum + word.units.length, 0)
    < words.reduce((sum, word) => sum + word.letterIds.length, 0));
  for (const word of words) {
    assert.deepEqual(word.units, alignmentUnits.filter(unit => `${unit.verse}:${unit.word}` === word.id));
    for (const id of word.letterIds) {
      const owner = alignmentUnitFor(id);
      assert.ok(owner && word.units.includes(owner));
    }
    for (const unit of word.units) {
      assert.ok(hasHaraka(unit.text));
      assert.ok(unit.offset + unit.length <= sections.find(section => section.id === word.section).arabic.length);
    }
  }
  const first = words[0];
  assert.ok(first.units.some(unit => unit.members.length > 1));
  assert.equal(first.units.length, 3); // Long-vowel waw shares the preceding vowel group.
  const article = words.find(word => word.id === '0:3');
  assert.notEqual(article.units[0].id, article.letterIds[0]);
  assert.equal(wordPreviewAt(article.start, words).letter.id, alignmentUnitFor(article.letterIds[0]).id);
  assert.equal(JSON.stringify(document), original);
  assert.deepEqual(sections.map(section => section.arabic), text);
});

test('localized final phrase stops attributing the long daa to la and uses unequal group intervals', async () => {
  const override = JSON.parse(await readFile(new URL('../data/final-phrase-local/preview-overrides.json', import.meta.url)));
  const original = JSON.stringify(document);
  const baseline = validateWordPreview(document, audio);
  const updated = applyPreviewOverrides(baseline, override, audio);
  for (let i = 0; i < baseline.length - 3; i++) assert.equal(updated[i], baseline[i]);
  assert.equal(wordPreviewAt(48.5, updated).letter.id, '7:74');
  for (const time of [49.1, 50, 51.3]) assert.equal(wordPreviewAt(time, updated).letter.id, '7:80');
  for (const time of [51.7, 52.8, 53.2]) assert.equal(wordPreviewAt(time, updated).letter.id, '7:85');
  assert.equal(wordPreviewAt(53.5, updated).letter.id, '7:89');
  assert.equal(wordPreviewAt(53.7, updated), null);
  const final = updated.at(-1);
  assert.ok(final.groupRanges[0].end - final.groupRanges[0].start > 2);
  assert.ok(final.groupRanges[1].end - final.groupRanges[1].start > 1.5);
  assert.equal(final.groupRanges.at(-1).source, 'local-ctc-with-estimated-tail-to-quiet-onset');
  assert.equal(final.groupRanges.at(-1).alignedEnd, 53.422);
  assert.ok(final.groupRanges.every(range => range.reviewed === false));
  assert.equal(JSON.stringify(document), original);
  assert.equal(baseline.at(-1).end, 52.183);
});

test('override rejects wrong audio, wrong groups, word overlap and reviewed claims', async () => {
  const source = JSON.parse(await readFile(new URL('../data/final-phrase-local/preview-overrides.json', import.meta.url)));
  const words = validateWordPreview(document, audio);
  assert.throws(() => applyPreviewOverrides(words, source, { ...audio, sha256: 'wrong' }));
  for (const modify of [d => { d.overrides[0].reviewed = true; },
    d => { d.overrides[0].groupRanges[0].id = '7:80'; },
    d => { d.overrides[0].start = 0; d.overrides[0].groupRanges[0].start = 0; },
    d => { d.overrides.push(d.overrides[0]); },
    d => { d.overrides[2].groupRanges[1].start = 49; },
    d => { d.overrides[2].groupRanges.pop(); }]) {
    const bad = structuredClone(source);
    modify(bad);
    assert.throws(() => applyPreviewOverrides(words, bad, audio));
  }
});
