import { letters, sections, alignmentUnits } from './fatiha.mjs';

export function validateWordPreview(document, audio) {
  if (document?.version !== 1 || document.alignment !== 'word-candidates-v1'
    || document.audio?.sha256 !== audio.sha256
    || !Number.isFinite(document.audio.duration) || Math.abs(document.audio.duration - audio.duration) > .25
    || !Array.isArray(document.words)) throw new Error('Kelime önizleme verisi bu sesle eşleşmiyor.');
  const known = new Map(sections.flatMap(section => section.arabic.split(/\s+/u).map((text, word) => [
    `${section.id}:${word}`, { section: section.id, text, letterIds: letters.filter(letter => letter.verse === section.id && letter.word === word).map(letter => letter.id) },
  ])));
  const seen = new Set();
  let end = 0;
  return document.words.map(word => {
    const expected = known.get(word.id);
    if (!expected || seen.has(word.id) || word.section !== expected.section || word.text !== expected.text
      || JSON.stringify(word.letterIds) !== JSON.stringify(expected.letterIds)
      || !Array.isArray(word.issues) || word.issues.length
      || !Number.isFinite(word.start) || !Number.isFinite(word.end)
      || word.start < end || word.end <= word.start || word.end > audio.duration) {
      throw new Error('Kelime önizleme aralıkları geçerli değil.');
    }
    seen.add(word.id);
    end = word.end;
    const units = alignmentUnits.filter(unit => unit.verse === word.section && `${unit.verse}:${unit.word}` === word.id);
    if (!units.length) throw new Error('Kelime için hareke grubu bulunamadı.');
    return { ...word, units };
  });
}

export function applyPreviewOverrides(words, document, audio) {
  if (document?.version !== 1 || document.alignment !== 'word-preview-overrides-v1'
    || document.audio?.sha256 !== audio.sha256 || !Number.isFinite(document.audio.duration)
    || Math.abs(document.audio.duration - audio.duration) > .25 || !Array.isArray(document.overrides)) {
    throw new Error('Özel kelime önizlemesi bu sesle eşleşmiyor.');
  }
  const overrides = new Map();
  for (const override of document.overrides) {
    const word = words.find(word => word.id === override.id);
    if (!word || overrides.has(word.id) || override.text !== word.text || override.reviewed !== false
      || !Number.isFinite(override.start) || !Number.isFinite(override.end) || override.start < 0
      || override.end <= override.start || override.end > audio.duration
      || !Array.isArray(override.groupRanges) || override.groupRanges.length !== word.units.length) {
      throw new Error('Özel kelime aralıkları geçerli değil.');
    }
    let end = override.start;
    const ranges = override.groupRanges.map((range, index) => {
      if (range.id !== word.units[index].id || range.reviewed !== false
        || !Number.isFinite(range.start) || !Number.isFinite(range.end)
        || range.start < end || range.end <= range.start || range.end > override.end) {
        throw new Error('Özel hareke grupları geçerli değil.');
      }
      end = range.end;
      return { ...range };
    });
    if (ranges[0].start !== override.start || end !== override.end) throw new Error('Özel kelime sınırları gruplarla eşleşmiyor.');
    overrides.set(word.id, { ...word, start: override.start, end: override.end,
      acousticScore: override.acousticScore, groupRanges: ranges, reviewed: false, previewSource: document.source });
  }
  let end = 0;
  return words.map(word => {
    const updated = overrides.get(word.id) || word;
    if (updated.start < end) throw new Error('Özel kelimeler üst üste binemez.');
    end = updated.end;
    return updated;
  });
}

export function validatePreviewSilences(document, audio) {
  if (document?.version !== 1 || document.audio?.sha256 !== audio.sha256
    || !Number.isFinite(document.audio.duration) || Math.abs(document.audio.duration - audio.duration) > .25
    || !Array.isArray(document.silences)) throw new Error('Sessizlik verisi bu sesle eşleşmiyor.');
  let previousEnd = 0;
  return document.silences.map(interval => {
    if (!Number.isFinite(interval.start) || !Number.isFinite(interval.end)
      || interval.start < previousEnd || interval.end <= interval.start || interval.end > audio.duration) {
      throw new Error('Sessizlik aralıkları geçerli değil.');
    }
    previousEnd = interval.end;
    return { start: interval.start, end: interval.end };
  });
}

export function audibleDuration(start, end, silences) {
  return Math.max(0, end - start - silences.reduce((removed, silence) =>
    removed + Math.max(0, Math.min(end, silence.end) - Math.max(start, silence.start)), 0));
}

// Visual movement only: no estimated letter timestamps are saved or called alignment.
export function wordPreviewAt(time, words, silences = []) {
  const word = words.find(word => time >= word.start && time < word.end);
  if (!word || silences.some(silence => time >= silence.start && time < silence.end)) return null;
  if (word.groupRanges) {
    const index = word.groupRanges.findIndex(range => time >= range.start && time < range.end);
    if (index < 0) return null;
    const range = word.groupRanges[index];
    const duration = audibleDuration(range.start, range.end, silences);
    if (duration <= 0) return null;
    return { word, letter: word.units[index], fraction: Math.min(1 - 1e-9, audibleDuration(range.start, time, silences) / duration) };
  }
  const duration = audibleDuration(word.start, word.end, silences);
  if (duration <= 0) return null;
  const progress = Math.min(1, audibleDuration(word.start, time, silences) / duration);
  const position = Math.min(progress * word.units.length, word.units.length - 1e-9);
  const index = Math.min(Math.floor(position), word.units.length - 1);
  return { word, letter: word.units[index], fraction: position - index };
}
