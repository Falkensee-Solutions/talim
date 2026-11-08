import { createTextModel } from './quran-text.mjs';
export { displayArabic } from './fatiha.mjs';
export { hasHaraka } from './quran-text.mjs';

export const source = {
  url: 'https://acikkuran.com/fil-suresi.md',
  license: 'CC BY-NC-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.tr',
  retrieved: '2026-11-08',
};
export const verses = [
  ['اَلَمْ تَرَ كَيْفَ فَعَلَ رَبُّكَ بِاَصْحَابِ الْف۪يلِۜ', 'E lem tere keyfe feale rabbuke bi ashabil fil.'],
  ['اَلَمْ يَجْعَلْ كَيْدَهُمْ ف۪ي تَضْل۪يلٍۙ', "E lem yec'al keydehum fi tadlil."],
  ['وَاَرْسَلَ عَلَيْهِمْ طَيْراً اَبَاب۪يلَۙ', 'Ve ersele aleyhim tayren ebabil.'],
  ['تَرْم۪يهِمْ بِحِجَارَةٍ مِنْ سِجّ۪يلٍۖۙ', 'Termihim bi hicaretin min siccil.'],
  ['فَجَعَلَهُمْ كَعَصْفٍ مَأْكُولٍ', "Fe cealehum keasfin me'kul."],
].map(([arabic, reading], index) => ({ id: index + 1, arabic, reading }));
export const introduction = {
  id: 0,
  label: 'Besmele · Başlangıç duası',
  arabic: 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّح۪يمِ',
  reading: 'Bismillahir rahmanir rahim.',
};
export const sections = [introduction, ...verses];
export function sectionLabel(id) {
  return id === 0 ? introduction.label : `${id}. ayet`;
}
export const { letters, alignmentUnits, alignmentUnitFor } = createTextModel(sections);
