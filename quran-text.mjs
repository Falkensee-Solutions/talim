export function hasHaraka(text) {
  return /[\u064b-\u0652\u0670\u06ea]/u.test(text);
}

export function createTextModel(sections) {
  const segmenter = new Intl.Segmenter('ar', { granularity: 'grapheme' });
  const letters = sections.flatMap(verse => {
    let word = 0;
    return [...segmenter.segment(verse.arabic)].flatMap(part => {
      if (/^\s+$/u.test(part.segment)) { word++; return []; }
      if (!/\p{Letter}/u.test(part.segment)) return [];
      return [{ id: `${verse.id}:${part.index}`, verse: verse.id, word,
        text: part.segment, offset: part.index, length: part.segment.length }];
    });
  });
  const alignmentUnits = [];
  const unitByLetter = new Map();
  let previousWord = null;
  let currentUnit = null;
  let leading = [];
  for (const letter of letters) {
    const key = `${letter.verse}:${letter.word}`;
    if (key !== previousWord) { currentUnit = null; leading = []; previousWord = key; }
    if (hasHaraka(letter.text)) {
      currentUnit = { ...letter, members: [letter.id] };
      alignmentUnits.push(currentUnit);
      unitByLetter.set(letter.id, currentUnit);
      for (const id of leading) unitByLetter.set(id, currentUnit);
      leading = [];
    } else if (currentUnit) {
      currentUnit.members.push(letter.id);
      currentUnit.text += letter.text;
      currentUnit.length = letter.offset + letter.length - currentUnit.offset;
      unitByLetter.set(letter.id, currentUnit);
    } else leading.push(letter.id);
  }
  return { letters, alignmentUnits, alignmentUnitFor: id => unitByLetter.get(id) };
}
