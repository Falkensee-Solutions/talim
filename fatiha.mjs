export const source = {
  url: 'https://acikkuran.com/fatiha-suresi.md',
  license: 'CC BY-NC-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.tr',
  retrieved: '2026-11-08',
};

export const verses = [
  ['بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّح۪يمِ', 'Bismillahir rahmanir rahim.'],
  ['اَلْحَمْدُ لِلّٰهِ رَبِّ الْعَالَم۪ينَۙ', 'El hamdu lillahi rabbil alemin .'],
  ['اَلرَّحْمٰنِ الرَّح۪يمِۙ', 'Er rahmanir rahim.'],
  ['مَالِكِ يَوْمِ الدّ۪ينِۜ', 'Maliki yevmid din.'],
  ['اِيَّاكَ نَعْبُدُ وَاِيَّاكَ نَسْتَع۪ينُۜ', "İyyake na'budu ve iyyake nestain."],
  ['اِهْدِنَا الصِّرَاطَ الْمُسْتَق۪يمَۙ', 'İhdinas sıratel mustakim.'],
  ['صِرَاطَ الَّذ۪ينَ اَنْعَمْتَ عَلَيْهِمْۙ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّٓالّ۪ينَ', "Sıratallezine en'amte aleyhim gayril magdubi aleyhim ve lad dallin."],
].map(([arabic, reading], index) => ({ id: index + 1, arabic, reading }));

export const introduction = {
  id: 0,
  label: 'Eûzü · Başlangıç duası',
  arabic: 'أَعُوذُ بِاللّٰهِ مِنَ الشَّيْطَانِ الرَّجِيمِ',
  reading: 'Eûzü billâhi mineşşeytânirracîm.',
};
export const sections = [introduction, ...verses];

export function displayArabic(text) {
  // Keep UTF-16 offsets stable for saved timings and DOM letter highlighting.
  return text.replace(/\u06ea/gu, '\u0650');
}

export function sectionLabel(id) {
  return id === 0 ? introduction.label : `${id}. ayet`;
}

const segmenter = new Intl.Segmenter('ar', { granularity: 'grapheme' });
export const letters = sections.flatMap(verse => {
  let word = 0;
  return [...segmenter.segment(verse.arabic)].flatMap(part => {
    if (/^\s+$/u.test(part.segment)) { word++; return []; }
    if (!/\p{Letter}/u.test(part.segment)) return [];
    return [{
      id: `${verse.id}:${part.index}`,
      verse: verse.id,
      word,
      text: part.segment,
      offset: part.index,
      length: part.segment.length,
    }];
  });
});

export function hasHaraka(text) {
  return /[\u064b-\u0652\u0670\u06ea]/u.test(text);
}

export const alignmentUnits = [];
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

export function alignmentUnitFor(id) {
  return unitByLetter.get(id);
}

