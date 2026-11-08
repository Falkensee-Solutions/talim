import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateWordPreview, applyPreviewOverrides } from '../word-preview.mjs';
import { versePlaybackRange, selectedVerseRanges, repeatAtBoundary } from '../verse-playback.mjs';
import { buildTalimSteps, nextTalimStep, talimGapAfter, REPEAT_GAP_SECONDS, validateRepeatGapSeconds, repeatGapRemaining } from '../memorization.mjs';
const source = JSON.parse(await readFile(new URL('../data/alignment-local-001-verified/word-candidates.json', import.meta.url)));
const override = JSON.parse(await readFile(new URL('../data/final-phrase-local/preview-overrides.json', import.meta.url)));
const audio = { ...source.audio, duration: 54.220125 };
const words = applyPreviewOverrides(validateWordPreview(source, audio), override, audio);

test('selecting each verse can start there or repeat only that verse', () => {
  for (let verse = 0; verse <= 7; verse++) {
    const selected = words.filter(word => word.section === verse);
    const fromHere = versePlaybackRange(words, verse, audio.duration);
    assert.equal(fromHere.start, selected[0].start);
    assert.equal(fromHere.end, audio.duration);
    assert.equal(fromHere.repeat, false);
    const loop = versePlaybackRange(words, verse, audio.duration, true);
    assert.equal(loop.start, selected[0].start);
    assert.equal(loop.end, selected.at(-1).end);
    assert.equal(loop.repeat, true);
  }
  assert.equal(versePlaybackRange(words, 7, audio.duration, true).end, 53.659002);
});

test('incomplete and invalid selection cannot be played', () => {
  assert.equal(versePlaybackRange(words, 8, audio.duration), null);
  assert.equal(versePlaybackRange(words, 1, NaN), null);
  assert.equal(versePlaybackRange(words.slice(1), 0, audio.duration), null);
  const invalid = structuredClone(words);
  invalid[1].start = invalid[0].start;
  assert.equal(versePlaybackRange(invalid, 0, audio.duration), null);
});

test('repeat boundary only restarts an active repeat clip', () => {
  const loop = versePlaybackRange(words, 7, audio.duration, true);
  assert.equal(repeatAtBoundary(loop, loop.end - .01), false);
  assert.equal(repeatAtBoundary(loop, loop.end), true);
  assert.equal(repeatAtBoundary(loop, loop.end + .1), true);
  assert.equal(repeatAtBoundary(null, loop.end), false);
  assert.equal(repeatAtBoundary({ ...loop, repeat: false }, loop.end), false);
  assert.equal(repeatAtBoundary(loop, NaN), false);
});

test('listening playlist contains only selected verses in source order', () => {
  const playlist = selectedVerseRanges(words, [3, 1, 3], audio.duration);
  assert.deepEqual(playlist.map(range => range.verse), [1, 3]);
  assert.equal(playlist[0].end, words.filter(word => word.section === 1).at(-1).end);
  assert.equal(playlist[1].start, words.find(word => word.section === 3).start);
  assert.deepEqual(selectedVerseRanges(words, [], audio.duration), []);
  assert.deepEqual(selectedVerseRanges(words, [1, 8], audio.duration), []);
});

test('verse Talim has one teacher then three silent turns and waits for manual next verse', () => {
  const steps = buildTalimSteps(words, audio, [3, 1], 'verse');
  assert.deepEqual(steps.map(step => step.role), ['teacher', 'child', 'child', 'child', 'teacher', 'child', 'child', 'child']);
  assert.deepEqual(steps.slice(0, 4).map(step => step.verse), [1, 1, 1, 1]);
  assert.deepEqual(steps.slice(4).map(step => step.verse), [3, 3, 3, 3]);
  for (let i = 0; i < 3; i++) assert.deepEqual(nextTalimStep(steps, i, 'verse'), { index: i + 1, finished: false, waitingNext: false });
  assert.deepEqual(nextTalimStep(steps, 3, 'verse'), { index: 3, finished: false, waitingNext: true });
  assert.deepEqual(nextTalimStep(steps, 7, 'verse'), { index: 7, finished: true, waitingNext: false });
});

test('full Talim reads all seven verses once then repeats the whole surah three times', () => {
  const steps = buildTalimSteps(words, audio, [3], 'full');
  assert.equal(steps.length, 4);
  assert.deepEqual(steps.map(step => step.role), ['teacher', 'child', 'child', 'child']);
  assert.deepEqual(steps.map(step => step.repetition), [0, 1, 2, 3]);
  assert.deepEqual(steps[0].verses, [1, 2, 3, 4, 5, 6, 7]);
  for (const step of steps) {
    assert.equal(step.start, words.find(word => word.section === 1).start);
    assert.equal(step.end, 53.659002);
  }
  assert.deepEqual(nextTalimStep(steps, 3, 'full'), { index: 3, finished: true, waitingNext: false });
  assert.throws(() => buildTalimSteps(words, audio, [1], 'unknown'));
  assert.throws(() => buildTalimSteps(words, audio, [], 'verse'));
  assert.throws(() => buildTalimSteps(words, audio, [0], 'verse'));
});

test('all Talim modes support one teacher and 1, 3, 5 or 7 students per verse or part', () => {
  for (const mode of ['full', 'verse', 'medium', 'many']) for (const repetitions of [1, 3, 5, 7]) {
    const steps = buildTalimSteps(words, audio, [3, 7], mode, null, repetitions);
    const teachers = steps.filter(step => step.role === 'teacher');
    assert.equal(steps.length, teachers.length * (repetitions + 1));
    for (const teacher of teachers) {
      const turns = steps.filter(step => step.key === teacher.key);
      assert.equal(turns.filter(turn => turn.role === 'teacher').length, 1);
      assert.deepEqual(turns.filter(turn => turn.role === 'child').map(turn => turn.repetition),
        Array.from({ length: repetitions }, (_, index) => index + 1));
    }
    if (mode !== 'full') {
      assert.deepEqual(nextTalimStep(steps, repetitions, mode), { index: repetitions, finished: false, waitingNext: true });
    }
  }
  for (const repetitions of [0, 2, 4, 6, 8, NaN, '3']) {
    assert.throws(() => buildTalimSteps(words, audio, [1], 'verse', null, repetitions));
  }
});

test('configurable preparation defaults to three seconds and skips manual next or completion', () => {
  assert.equal(REPEAT_GAP_SECONDS, 3);
  for (const mode of ['full', 'verse', 'medium', 'many']) for (const count of [1, 3, 5, 7]) {
    const steps = buildTalimSteps(words, audio, [3, 7], mode, null, count);
    assert.equal(talimGapAfter(steps, 0, mode), 3);
    for (const seconds of [1, 2, 3, 4, 5]) {
      for (let index = 0; index < steps.length; index++) {
        const next = nextTalimStep(steps, index, mode);
        const expected = next.finished || next.waitingNext ? 0 : seconds;
        assert.equal(talimGapAfter(steps, index, mode, seconds), expected);
      }
      assert.equal(repeatGapRemaining(0, seconds), seconds);
      assert.equal(repeatGapRemaining(-1, seconds), seconds);
      assert.ok(repeatGapRemaining(seconds - 0.001, seconds) > 0);
      assert.equal(repeatGapRemaining(seconds, seconds), 0);
      assert.equal(repeatGapRemaining(10, seconds), 0);
    }
  }
  assert.equal(repeatGapRemaining(0), 3);
});

test('repeat gap rejects durations outside integer one to five seconds', () => {
  const steps = buildTalimSteps(words, audio, [1]);
  for (const seconds of [0, -1, 6, 1.5, NaN, Infinity, '3', null]) {
    assert.throws(() => validateRepeatGapSeconds(seconds));
    assert.throws(() => talimGapAfter(steps, 0, 'verse', seconds));
    assert.throws(() => repeatGapRemaining(0, seconds));
  }
});
