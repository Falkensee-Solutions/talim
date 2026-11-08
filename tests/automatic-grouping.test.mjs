import test from 'node:test';
import assert from 'node:assert/strict';
import { letters, alignmentUnits, alignmentUnitFor, hasHaraka, displayArabic, sections } from '../fatiha.mjs';
import { ALIGNMENT_VERSION, nextSpokenLetter, normalizeTimingDocument, validateTimingDocument, buildSegments } from '../timing.mjs';

const audio = { sha256: 'test', duration: 60 };

test('vowels, sukun and shadda make steps; pause marks alone do not', () => {
  for (const text of ['بِ', 'مْ', 'لّٰ', 'ح۪', 'نُ', 'بَ']) assert.equal(hasHaraka(text), true);
  for (const text of ['ا', 'ي', 'و', 'اۙ', 'آ']) assert.equal(hasHaraka(text), false);
  assert.ok(alignmentUnits.length < letters.length);
  assert.ok(alignmentUnits.every(unit => hasHaraka(unit.text)));
});
test('unmarked vowel letters attach to preceding marked letter within the same word', () => {
  const unit = alignmentUnitFor('1:34');
  assert.equal(displayArabic(unit.text), 'حِي');
  assert.equal(unit.id, '1:32');
  assert.deepEqual(unit.members, ['1:32', '1:34']);
  assert.equal(nextSpokenLetter('1:29').id, unit.id);
  assert.equal(nextSpokenLetter(unit.id).text, 'مِ');
  assert.equal(nextSpokenLetter('1:7', true).id, '1:9');
  for (const group of alignmentUnits) {
    for (const id of group.members) {
      const letter = letters.find(letter => letter.id === id);
      assert.equal(letter.verse, group.verse);
      assert.equal(letter.word, group.word);
    }
    const source = sections.find(section => section.id === group.verse).arabic;
    assert.equal(source.slice(group.offset, group.offset + group.length), group.text);
  }
});
test('new schema requires group times only and rejects separate bare-letter times', () => {
  const document = { version: 1, alignment: ALIGNMENT_VERSION, audio, timings: alignmentUnits.map((unit, index) => ({ id: unit.id, start: index * .3, end: index * .3 + .2, reviewed: true })) };
  const clean = validateTimingDocument(document, audio, { requireComplete: true });
  assert.equal(clean.length, alignmentUnits.length);
  assert.ok(buildSegments('many', clean, 60).length > 0);
  assert.throws(() => validateTimingDocument({ ...document, timings: [{ id: '1:34', start: 0, end: 1, reviewed: true }] }, audio));
});
test('old letter timings retain long-vowel duration, missing tails require review', () => {
  const legacy = { version: 1, audio, timings: [
    { id: '1:32', start: 10, end: 10.3, reviewed: true },
    { id: '1:34', start: 10.3, end: 12.5, reviewed: true },
    { id: '1:35', start: 12.5, end: 13, reviewed: true },
  ] };
  const migrated = normalizeTimingDocument(legacy, audio);
  assert.equal(migrated.alignment, ALIGNMENT_VERSION);
  assert.deepEqual(migrated.timings[0], { id: '1:32', start: 10, end: 12.5, reviewed: true, silent: false });
  assert.equal(migrated.timings.some(timing => timing.id === '1:34'), false);
  legacy.timings.splice(1, 1);
  const incomplete = normalizeTimingDocument(legacy, audio);
  assert.equal(incomplete.timings[0].end, 10.3);
  assert.equal(incomplete.timings[0].reviewed, false);
  assert.deepEqual(normalizeTimingDocument(migrated, audio), migrated);
});
