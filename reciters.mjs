export const reciters = [
  { id: '1', label: 'Hafız 1', audio: '001.mp3', duration: 54.220125,
    timings: 'timings.json', timingSource: 'data/fatiha-timing.json',
    words: 'word-preview.json', wordSource: 'data/alignment-local-001-verified/word-candidates.json',
    silence: 'preview-silence.json', silenceSource: 'data/preview-silence.json',
    overrides: 'final-preview.json', overrideSource: 'data/final-phrase-local/preview-overrides.json' },
  { id: '2', label: 'Hafız 2 AA', audio: '001_2.mp3', duration: 99.160813,
    timings: 'timings-2.json', timingSource: 'data/fatiha-timing-2.json',
    words: 'word-preview-2.json', wordSource: 'data/alignment-local-001-2-aligned/word-candidates.json',
    silence: 'preview-silence-2.json', silenceSource: 'data/preview-silence-2.json',
    overrides: null },
];

export const filReciters = [
  { id: '1', label: 'Hafız 1', audio: '105.mp3', duration: 46.174375,
    timings: 'fil-timings.json', timingSource: 'data/fil-timing.json',
    words: 'fil-word-preview.json', wordSource: 'data/alignment-local-105/word-candidates.json',
    silence: 'fil-preview-silence.json', silenceSource: 'data/fil-preview-silence.json',
    overrides: null },
];

export function recitersForSurah(surah = 1) {
  if (Number(surah) === 1) return reciters;
  if (Number(surah) === 105) return filReciters;
  throw new Error('Bilinmeyen sure.');
}

export function reciterById(id = '1', surah = 1) {
  const reciter = recitersForSurah(surah).find(reciter => reciter.id === id);
  if (!reciter) throw new Error('Bilinmeyen hafız.');
  return reciter;
}
