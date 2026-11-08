import { pathToFileURL } from 'node:url';
import * as fatiha from '../fatiha.mjs';
import * as fil from '../fil.mjs';

export function alignmentReference(surah = 1) {
  if (![1, 105].includes(surah)) throw new Error('Supported surahs: 1, 105.');
  const { sections, letters, source } = surah === 105 ? fil : fatiha;
  return {
    version: 1,
    source,
    sections: sections.map(section => ({
      id: section.id,
      words: section.arabic.split(/\s+/u).map((text, word) => ({
        id: `${section.id}:${word}`,
        text,
        letterIds: letters.filter(letter => letter.verse === section.id && letter.word === word).map(letter => letter.id),
      })),
    })),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(alignmentReference(Number(process.argv[2] ?? 1))));
}
