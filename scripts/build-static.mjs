import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateWordPreview, applyPreviewOverrides, validatePreviewSilences } from '../word-preview.mjs';
import { validateTimingDocument } from '../timing.mjs';
import { recitersForSurah } from '../reciters.mjs';
import { surahs } from '../active-surah.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const staticAssets = [
  'index.html', 'style.css', 'waveform.css', 'hold-timing.css', 'memorization.css',
  'app.mjs', 'fatiha.mjs', 'timing.mjs', 'word-preview.mjs', 'tajweed-timing.mjs', 'verse-playback.mjs',
  'study-groups.mjs', 'memorization.mjs', 'waveform.mjs', 'hold-timing.mjs', '001.mp3',
  'TalimQuran.ttf', 'Hamdullah-NOTICE.txt', 'reciters.mjs', 'active-surah.mjs', 'quran-text.mjs', 'fil.mjs', '001_2.mp3', '105.mp3',
];

export async function buildStatic(output = join(root, 'dist')) {
  output = resolve(output);
  const source = resolve(root);
  if (output === source || source.startsWith(`${output}${sep}`)) throw new Error('Build output cannot replace the source directory.');
  const json = async path => JSON.parse(await readFile(join(root, path), 'utf8'));
  const data = { 'site-config.json': { timingStorage: 'static' } };
  for (const surah of surahs) {
    for (const reciter of recitersForSurah(surah.id)) {
      const [timings, words, silence] = await Promise.all([
        json(reciter.timingSource), json(reciter.wordSource), json(reciter.silenceSource),
      ]);
      const audio = { sha256: createHash('sha256').update(await readFile(join(root, reciter.audio))).digest('hex'), duration: reciter.duration };
      validateTimingDocument(timings, audio, { text: surah.text });
      const validatedWords = validateWordPreview(words, audio, surah.text);
      validatePreviewSilences(silence, audio);
      data[reciter.timings] = timings;
      data[reciter.words] = words;
      data[reciter.silence] = { version: silence.version, audio: silence.audio, detector: silence.detector, silences: silence.silences };
      if (reciter.overrides) {
        const overrides = await json(reciter.overrideSource);
        applyPreviewOverrides(validatedWords, overrides, audio);
        data[reciter.overrides] = overrides;
      }
    }
  }
  await mkdir(dirname(output), { recursive: true });
  const staging = await mkdtemp(join(dirname(output), '.talim-static-'));
  try {
    await Promise.all(staticAssets.map(file => copyFile(join(root, file), join(staging, file))));
    // Only playback inputs are published; local inference logs and tooling stay out of the site.
    for (const [name, value] of Object.entries(data)) await writeFile(join(staging, name), `${JSON.stringify(value, null, 2)}\n`);
    await writeFile(join(staging, '.nojekyll'), '');
    const manifest = await readdir(staging);
    await rm(output, { recursive: true, force: true });
    await rename(staging, output);
    return manifest.sort();
  } finally { await rm(staging, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await buildStatic();
  console.log(`Static site built: ${files.length} files in dist/`);
}
