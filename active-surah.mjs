import * as fatiha from './fatiha.mjs';
import * as fil from './fil.mjs';

export const surahs = [
  { id: 1, name: 'Fatiha', audio: '001.mp3', timingUrl: './timings.json',
    timingApiUrl: './api/timings', previewUrl: './word-preview.json',
    silenceUrl: './preview-silence.json', finalPreviewUrl: './final-preview.json', text: fatiha },
  { id: 105, name: 'Fil', audio: '105.mp3', timingUrl: './fil-timings.json',
    timingApiUrl: './api/timings?surah=105', previewUrl: './fil-word-preview.json',
    silenceUrl: './fil-preview-silence.json', finalPreviewUrl: null, text: fil },
];
export function surahById(id = 1) {
  const surah = surahs.find(surah => surah.id === Number(id));
  if (!surah) throw new Error('Bilinmeyen sure.');
  return surah;
}
const requested = typeof window === 'undefined' ? 1 : new URLSearchParams(window.location.search).get('surah') ?? 1;
export const activeSurah = surahs.find(surah => surah.id === Number(requested)) ?? surahs[0];
export const { sections, verses, introduction, sectionLabel, displayArabic, letters,
  alignmentUnits, alignmentUnitFor, hasHaraka, source } = activeSurah.text;
