import test from 'node:test';
import assert from 'node:assert/strict';
import { alignmentUnits } from '../fatiha.mjs';
import { ALIGNMENT_VERSION } from '../timing.mjs';
import { buildMemorizationSteps, memoryTime } from '../memorization.mjs';

const audio = { sha256: 'test', duration: 60 };
const fixture = selected => ({ version: 1, alignment: ALIGNMENT_VERSION, audio, timings: alignmentUnits.filter(letter => selected.includes(letter.verse)).map((letter, index) => ({ id: letter.id, start: index * .1, end: index * .1 + .08, reviewed: true })) });

test('teacher reads once followed by exactly 1, 3, 5 or 7 silent child turns per selected verse', () => {
  for (const count of [1, 3, 5, 7]) {
    const steps = buildMemorizationSteps(fixture([1, 3]), audio, [3, 1, 1], count);
    assert.equal(steps.length, 2 * (count + 1));
    assert.deepEqual([...new Set(steps.map(step => step.verse))], [1, 3]);
    for (const verse of [1, 3]) {
      const turns = steps.filter(step => step.verse === verse);
      assert.equal(turns[0].role, 'teacher');
      assert.equal(turns.filter(step => step.role === 'teacher').length, 1);
      assert.deepEqual(turns.slice(1).map(step => step.repetition), Array.from({ length: count }, (_, i) => i + 1));
      for (const turn of turns) { assert.equal(turn.start, turns[0].start); assert.equal(turn.end, turns[0].end); }
    }
  }
});
test('selected verses do not require other verses or Euzu alignment', () => {
  assert.doesNotThrow(() => buildMemorizationSteps(fixture([1]), audio, [1], 3));
  assert.throws(() => buildMemorizationSteps(fixture([1]), audio, [1, 2], 3), /2\. ayet/);
  const draft = fixture([1]); draft.timings[0].reviewed = false;
  assert.throws(() => buildMemorizationSteps(draft, audio, [1], 1));
});
test('unmarked letters are included in groups without separate cursor timing', () => {
  const document = fixture([1]);
  assert.equal(document.timings.some(timing => timing.id === '1:34'), false);
  assert.equal(buildMemorizationSteps(document, audio, [1], 1).length, 2);
});
test('rejects empty selection, non-verses, wrong audio and invalid repeat counts', () => {
  for (const selected of [[], [0], [8], ['1']]) assert.throws(() => buildMemorizationSteps(fixture([1]), audio, selected, 1));
  for (const count of [0, 2, 4, 6]) assert.throws(() => buildMemorizationSteps(fixture([1]), audio, [1], count));
  assert.throws(() => buildMemorizationSteps(fixture([1]), { ...audio, sha256: 'wrong' }, [1], 1));
});
test('silent cursor time follows the original pace and stops exactly at verse end', () => {
  const step = { start: 10, end: 15 };
  assert.equal(memoryTime(step, 0), 10);
  assert.equal(memoryTime(step, 2.3), 12.3);
  assert.equal(memoryTime(step, 8), 15);
  assert.equal(memoryTime(step, -2), 10);
});
