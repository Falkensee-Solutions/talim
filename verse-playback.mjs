import * as activeText from './active-surah.mjs';

export function versePlaybackRange(words, verse, duration, repeat = false, text = activeText) {
  const section = text.sections.find(section => section.id === verse);
  if (!section || !Number.isFinite(duration) || duration <= 0) return null;
  const expected = section.arabic.split(/\s+/u).map((_, index) => `${verse}:${index}`);
  const selected = words.filter(word => word.section === verse);
  if (selected.length !== expected.length || selected.some((word, index) => word.id !== expected[index]
    || !Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < 0
    || word.end <= word.start || word.end > duration || (index > 0 && word.start < selected[index - 1].end))) return null;
  return { start: selected[0].start, end: repeat ? selected.at(-1).end : duration, verse, repeat };
}

export function selectedVerseRanges(words, selectedVerses, duration, text = activeText) {
  if (!Array.isArray(selectedVerses) || !selectedVerses.length) return [];
  const selected = [...new Set(selectedVerses)].sort((a, b) => a - b);
  const ranges = selected.map(verse => versePlaybackRange(words, verse, duration, true, text));
  if (ranges.some(range => !range)) return [];
  return ranges.map(range => ({ ...range, repeat: false }));
}

export function repeatAtBoundary(clip, time) {
  return Boolean(clip?.repeat && Number.isFinite(time) && time >= clip.end);
}
