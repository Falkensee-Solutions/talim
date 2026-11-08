import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../server.mjs';
import { timeAtPosition } from '../waveform.mjs';

test('waveform pointer positions map to bounded times', () => {
  assert.equal(timeAtPosition(50, 100, 12, 6, 54), 15);
  assert.equal(timeAtPosition(-10, 100, 12, 6, 54), 12);
  assert.equal(timeAtPosition(150, 100, 50, 6, 54), 54);
});

test('edited content persists across server restarts, invalid saves preserve it', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'talim-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'timing.json');
  let server;
  t.after(() => server?.listening ? new Promise(resolve => server.close(resolve)) : undefined);
  const launch = async () => {
    server = createServer({ timingPath: path });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${server.address().port}`;
  };
  let base = await launch();
  const initial = await (await fetch(`${base}/api/timings`)).json();
  assert.deepEqual(initial.timings, []);
  // Synthetic test timing is stored only in this isolated temporary directory.
  const fixture = { ...initial, timings: [{ id: '1:0', start: .1, end: .2, reviewed: false }] };
  const save = await fetch(`${base}/api/timings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(fixture) });
  assert.equal(save.status, 200);
  const disk = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(disk.timings[0].id, '1:0');
  assert.equal(disk.alignment, 'haraka-groups-v1');
  assert.equal('silentLetters' in disk, false);
  assert.deepEqual(await readdir(directory), ['timing.json']);
  const wrong = await fetch(`${base}/api/timings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fixture, audio: { ...fixture.audio, sha256: 'wrong' } }) });
  assert.equal(wrong.status, 400);
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), disk);
  const foreign = await fetch(`${base}/api/timings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' }, body: JSON.stringify(fixture) });
  assert.equal(foreign.status, 403);
  await new Promise(resolve => server.close(resolve));
  base = await launch();
  const restored = await (await fetch(`${base}/api/timings`)).json();
  assert.deepEqual(restored, disk);
});
