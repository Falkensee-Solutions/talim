import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { alignmentUnits } from '../fatiha.mjs';
import { groupTimingWeights, weightedUnitBoundaries, MAX_BOUNDARY_SHIFT } from '../tajweed-timing.mjs';
import { validateWordPreview, applyPreviewOverrides, wordPreviewAt } from '../word-preview.mjs';
const unitsFor = (verse, word) => alignmentUnits.filter(unit => unit.verse === verse && unit.word === word);
const source = JSON.parse(await readFile(new URL('../data/alignment-local-001-verified/word-candidates.json', import.meta.url)));
const overrides = JSON.parse(await readFile(new URL('../data/final-phrase-local/preview-overrides.json', import.meta.url)));
const words = validateWordPreview(source, source.audio);

test('natural long vowels and gemination provide relative hints without treating every bare letter as madd', () => {
  const malik = groupTimingWeights(unitsFor(4, 0));
  assert.equal(malik[0].weight, 2);
  assert.ok(malik[0].rules.includes('natural-madd'));
  const rabb = groupTimingWeights(unitsFor(2, 2));
  assert.ok(rabb.some(hint => hint.rules.includes('gemination') && hint.weight === 2));
  const yawm = groupTimingWeights(unitsFor(4, 1));
  assert.ok(yawm.every(hint => !hint.rules.includes('natural-madd')));
  const last = groupTimingWeights(unitsFor(7, 8));
  assert.ok(last[0].rules.includes('written-lazim'));
  assert.equal(last[0].weight, 7); // Six-unit vowel prior plus the geminated consonant, not measured seconds.
});

test('interior boundaries move at most two percent and remain ordered; endpoints never move', () => {
  for (const word of words) {
    const boundaries = word.visualBoundaries;
    assert.equal(boundaries[0], 0);
    assert.equal(boundaries.at(-1), 1);
    for (let i = 1; i < boundaries.length; i++) {
      assert.ok(boundaries[i] > boundaries[i - 1]);
      assert.ok(Math.abs(boundaries[i] - i / word.units.length) <= MAX_BOUNDARY_SHIFT + 1e-12);
    }
  }
  const malik = weightedUnitBoundaries(unitsFor(4, 0));
  assert.ok(malik[1] > 1 / 3);
  assert.deepEqual(weightedUnitBoundaries([]), []);
  assert.deepEqual(weightedUnitBoundaries([{ id: 'synthetic', text: 'بَ' }]), [0, 1]);
});

test('measured final-word group ranges retain their exact positions despite higher madd hints', () => {
  const corrected = applyPreviewOverrides(words, overrides, source.audio);
  for (const [time, expected] of [[49, '7:80'], [51.455, '7:80'], [51.456, '7:85'], [53.402, '7:89']]) {
    assert.equal(wordPreviewAt(time, corrected).letter.id, expected);
  }
  const final = corrected.at(-1);
  assert.deepEqual(final.groupRanges, overrides.overrides.at(-1).groupRanges);
  assert.equal(final.start, 48.989);
  assert.equal(final.end, 53.659002);
});

test('relative weighting respects existing silence exclusion and does not mutate source words', () => {
  const before = JSON.stringify(source);
  const word = words.find(word => word.id === '4:0');
  const silence = [{ start: word.start + .1, end: word.start + .2 }];
  assert.equal(wordPreviewAt(word.start + .15, [word], silence), null);
  assert.equal(wordPreviewAt(word.start, [word], silence).fraction, 0);
  assert.equal(wordPreviewAt(word.end, [word], silence), null);
  assert.equal(JSON.stringify(source), before);
});
