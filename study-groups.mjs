import { verses } from './fatiha.mjs';
import { selectedVerseRanges } from './verse-playback.mjs';

// Recording-independent, editable word-index boundaries. Never split a word or a madd.
export const studyGroups = {
  medium: {
    1: [[0, 1], [2, 3]],
    2: [[0, 1], [2, 3]],
    3: [[0], [1]],
    4: [[0], [1, 2]],
    5: [[0, 1], [2, 3]],
    6: [[0], [1, 2]],
    7: [[0, 1], [2, 3], [4, 5], [6], [7, 8]],
  },
  many: {
    1: [[0], [1], [2], [3]],
    2: [[0], [1], [2], [3]],
    3: [[0], [1]],
    4: [[0], [1], [2]],
    5: [[0], [1], [2], [3]],
    6: [[0], [1], [2]],
    7: [[0], [1], [2], [3], [4], [5], [6], [7], [8]],
  },
};

export function buildStudyRanges(words, selectedVerses, duration, mode, selectedParts = null) {
  const definition = studyGroups[mode];
  if (!definition) throw new Error('Geçerli bir adım türü seç.');
  const ranges = selectedVerseRanges(words, selectedVerses, duration);
  if (!ranges.length || ranges.some(range => range.verse === 0)) throw new Error('En az bir Fatiha ayeti seç.');
  const clips = ranges.flatMap(range => {
    const verse = verses.find(verse => verse.id === range.verse);
    const expected = verse.arabic.split(/\s+/u);
    const groups = definition[verse.id];
    if (!groups || JSON.stringify(groups.flat()) !== JSON.stringify(expected.map((_, index) => index))) {
      throw new Error('Adım tanımları ayetin bütün kelimelerini sırayla kapsamalı.');
    }
    const verseWords = words.filter(word => word.section === verse.id);
    return groups.map((indexes, index) => ({
      key: `${mode}:${verse.id}:${index}`, verse: verse.id, verses: [verse.id],
      part: index + 1, totalParts: groups.length,
      start: verseWords[indexes[0]].start, end: verseWords[indexes.at(-1)].end,
      wordIds: indexes.map(word => `${verse.id}:${word}`),
      text: indexes.map(word => expected[word]).join(' '),
    }));
  });
  if (selectedParts === null) return clips;
  if (!Array.isArray(selectedParts) || selectedParts.some(key => !clips.some(clip => clip.key === key))) {
    throw new Error('Seçili adımlar seçili ayetlere ait olmalı.');
  }
  const selected = new Set(selectedParts);
  return clips.filter(clip => selected.has(clip.key));
}
