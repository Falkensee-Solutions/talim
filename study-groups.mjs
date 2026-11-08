import * as activeText from './active-surah.mjs';
import { verses as fatihaVerses } from './fatiha.mjs';
import { selectedVerseRanges } from './verse-playback.mjs';

// Recording-independent, editable word-index boundaries. Never split a word or a madd.
const fatihaGroups = {
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

function groupsFor(verses) {
  if (verses === fatihaVerses) return fatihaGroups;
  return Object.fromEntries(['medium', 'many'].map(mode => [mode, Object.fromEntries(verses.map(verse => {
    const indexes = verse.arabic.split(/\s+/u).map((_, index) => index);
    const size = mode === 'medium' ? 2 : 1;
    return [verse.id, Array.from({ length: Math.ceil(indexes.length / size) }, (_, index) => indexes.slice(index * size, (index + 1) * size))];
  }))]));
}
export const studyGroups = groupsFor(activeText.verses);

export function buildStudyRanges(words, selectedVerses, duration, mode, selectedParts = null, text = activeText) {
  const { verses } = text;
  const definition = groupsFor(verses)[mode];
  if (!definition) throw new Error('Geçerli bir adım türü seç.');
  const ranges = selectedVerseRanges(words, selectedVerses, duration, text);
  if (!ranges.length || ranges.some(range => range.verse === 0)) throw new Error('En az bir geçerli sure ayeti seç.');
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
