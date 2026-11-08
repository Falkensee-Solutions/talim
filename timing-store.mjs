import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { normalizeTimingDocument } from './timing.mjs';

export function createTimingStore({ audioPath, timingPath, duration = 54.220125, text }) {
  let writes = Promise.resolve();
  async function audioInfo() {
    return { sha256: createHash('sha256').update(await readFile(audioPath)).digest('hex'), duration };
  }
  async function load() {
    const audio = await audioInfo();
    try {
      const document = JSON.parse(await readFile(timingPath, 'utf8'));
      return normalizeTimingDocument(document, audio, text);
    } catch (error) {
      if (error.code === 'ENOENT') return normalizeTimingDocument({ version: 1, audio, timings: [] }, audio, text);
      throw error;
    }
  }
  function save(document) {
    const operation = writes.then(async () => {
      const audio = await audioInfo();
      const clean = normalizeTimingDocument(document, audio, text);
      await mkdir(dirname(timingPath), { recursive: true });
      const temporary = `${timingPath}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, `${JSON.stringify(clean, null, 2)}\n`, { flag: 'wx' });
        await rename(temporary, timingPath);
      } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
      return clean;
    });
    writes = operation.catch(() => {});
    return operation;
  }
  return { load, save };
}
