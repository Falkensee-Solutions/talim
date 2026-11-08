import { createTextModel } from './quran-text.mjs';
export { hasHaraka } from './quran-text.mjs';

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

export const { letters, alignmentUnits, alignmentUnitFor } = createTextModel(sections);

