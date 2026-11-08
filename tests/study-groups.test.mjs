import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { verses } from '../fatiha.mjs';
import { validateWordPreview, applyPreviewOverrides } from '../word-preview.mjs';
import { studyGroups, buildStudyRanges } from '../study-groups.mjs';
import { buildTalimSteps, nextTalimStep } from '../memorization.mjs';
const source = JSON.parse(await readFile(new URL('../data/alignment-local-001-verified/word-candidates.json', import.meta.url)));
const override = JSON.parse(await readFile(new URL('../data/final-phrase-local/preview-overrides.json', import.meta.url)));
const audio = { ...source.audio, duration: 54.220125 };
const words = applyPreviewOverrides(validateWordPreview(source, audio), override, audio);

test('editable small and medium definitions cover every word exactly once without splitting words', () => {
  for (const mode of ['medium', 'many']) for (const verse of verses) {
    const expected = verse.arabic.split(/\s+/u);
    const definitions = studyGroups[mode][verse.id];
    assert.deepEqual(definitions.flat(), expected.map((_, index) => index));
    assert.ok(definitions.every(group => group.length > 0 && group.length <= 2));
    if (mode === 'many') assert.ok(definitions.every(group => group.length === 1));
    const ranges = buildStudyRanges(words, [verse.id], audio.duration, mode);
    assert.deepEqual(ranges.flatMap(range => range.wordIds), expected.map((_, index) => `${verse.id}:${index}`));
    for (const range of ranges) {
      assert.equal(range.start, words.find(word => word.id === range.wordIds[0]).start);
      assert.equal(range.end, words.find(word => word.id === range.wordIds.at(-1)).end);
    }
  }
  assert.equal(buildStudyRanges(words, verses.map(v => v.id), audio.duration, 'many').length, 29);
  assert.equal(buildStudyRanges(words, verses.map(v => v.id), audio.duration, 'medium').length, 17);
});

test('final verse uses the explicitly requested tail phrases and retains the whole long final word', () => {
  const medium = buildStudyRanges(words, [7], audio.duration, 'medium');
  assert.deepEqual(medium.map(range => range.wordIds), [
    ['7:0', '7:1'], ['7:2', '7:3'], ['7:4', '7:5'], ['7:6'], ['7:7', '7:8'],
  ]);
  assert.equal(medium.at(-1).start, 47.926);
  assert.equal(medium.at(-1).end, 53.659002);
  const small = buildStudyRanges(words, [7], audio.duration, 'many');
  assert.equal(small.at(-1).start, 48.989);
  assert.equal(small.at(-1).end, 53.659002);
});

test('part selections retain source order and reject missing or foreign definitions', () => {
  const selected = buildStudyRanges(words, [7], audio.duration, 'medium', ['medium:7:4', 'medium:7:0']);
  assert.deepEqual(selected.map(range => range.key), ['medium:7:0', 'medium:7:4']);
  assert.throws(() => buildStudyRanges(words, [1], audio.duration, 'medium', ['medium:7:0']));
  assert.throws(() => buildTalimSteps(words, audio, [7], 'medium', []));
  assert.throws(() => buildStudyRanges(words, [0], audio.duration, 'medium'));
  assert.throws(() => buildStudyRanges(words, [], audio.duration, 'many'));
});

test('each small or medium step has exactly one teacher and three students then manual progression', () => {
  for (const mode of ['medium', 'many']) {
    const clips = buildStudyRanges(words, [7], audio.duration, mode);
    const steps = buildTalimSteps(words, audio, [7], mode);
    assert.equal(steps.length, clips.length * 4);
    for (let i = 0; i < clips.length; i++) {
      const turns = steps.slice(i * 4, i * 4 + 4);
      assert.deepEqual(turns.map(turn => turn.role), ['teacher', 'child', 'child', 'child']);
      assert.deepEqual(turns.map(turn => turn.repetition), [0, 1, 2, 3]);
      assert.ok(turns.every(turn => turn.key === clips[i].key));
    }
    assert.deepEqual(nextTalimStep(steps, 3, mode), { index: 3, finished: false, waitingNext: true });
    assert.equal(nextTalimStep(steps, steps.length - 1, mode).finished, true);
  }
});
