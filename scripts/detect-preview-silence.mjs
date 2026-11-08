import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function parseSilences(log, duration, guard = .08) {
  const silences = [];
  let start = null;
  for (const match of log.matchAll(/silence_(start|end):\s*([\d.]+)/g)) {
    const time = Number(match[2]);
    if (match[1] === 'start') start = time;
    else if (start !== null) {
      const safeStart = start + guard;
      const safeEnd = Math.min(time, duration) - guard;
      if (safeEnd > safeStart) silences.push({ start: safeStart, end: safeEnd });
      start = null;
    }
  }
  if (start !== null && duration - guard > start + guard) {
    silences.push({ start: start + guard, end: duration - guard });
  }
  return silences;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const audioPath = process.argv[2] || '001.mp3';
  const outputPath = process.argv[3] || 'data/preview-silence.json';
  const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioPath], { encoding: 'utf8' }).trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid audio duration.');
  // Keep quiet phonemes and fading vowels: only remove long very quiet cores, with edge guards.
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', audioPath, '-af', 'silencedetect=noise=-42dB:d=0.2', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || 'Silence detection failed.');
  const log = result.stderr;
  const document = { version: 1, audio: { sha256: createHash('sha256').update(readFileSync(audioPath)).digest('hex'), duration },
    detector: { tool: 'ffmpeg silencedetect', thresholdDb: -42, minimumSeconds: .2, guardSeconds: .08 },
    silences: parseSilences(log, duration), rawLog: log };
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, { flag: 'wx' });
  console.log(`Saved ${document.silences.length} guarded silence intervals to ${outputPath}`);
}
