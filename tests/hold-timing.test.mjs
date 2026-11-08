import test from 'node:test';
import assert from 'node:assert/strict';
import { createHoldRecorder } from '../hold-timing.mjs';
import { validateTimingDocument } from '../timing.mjs';

test('hold records exact audio positions, including long vowels', () => {
  const recorder = createHoldRecorder();
  assert.equal(recorder.begin('1:0', .123), true);
  assert.equal(recorder.active, true);
  const timing = recorder.finish(3.456);
  assert.deepEqual(timing, { id: '1:0', start: .123, end: 3.456, reviewed: true, silent: false });
  assert.equal(recorder.active, false);
  assert.doesNotThrow(() => validateTimingDocument({ version: 1, audio: { sha256: 'test', duration: 54 }, timings: [timing] }, { sha256: 'test', duration: 54 }));
});
test('second touch cannot replace active hold; double release cannot duplicate it', () => {
  const recorder = createHoldRecorder();
  recorder.begin('1:0', 1);
  assert.equal(recorder.begin('1:2', 2), false);
  assert.equal(recorder.finish(3).id, '1:0');
  assert.equal(recorder.finish(4), null);
});
test('interrupted gestures and non-advancing audio are not saved', () => {
  const recorder = createHoldRecorder();
  recorder.begin('1:0', 1); recorder.cancel();
  assert.equal(recorder.finish(2), null);
  for (const end of [1, .5, NaN, Infinity]) {
    recorder.begin('1:0', 1);
    assert.equal(recorder.finish(end), null);
    assert.equal(recorder.active, false);
  }
  assert.equal(recorder.begin('1:0', NaN), false);
  assert.equal(recorder.begin('1:0', -1), false);
});
