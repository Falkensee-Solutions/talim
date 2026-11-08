import { alignmentUnits, verses } from './fatiha.mjs';
import { validateTimingDocument } from './timing.mjs';
import { selectedVerseRanges } from './verse-playback.mjs';
import { buildStudyRanges } from './study-groups.mjs';

export const REPETITION_COUNTS = [1, 3, 5, 7];

export function buildMemorizationSteps(document, audio, selectedVerses, repetitions) {
  if (!REPETITION_COUNTS.includes(repetitions)) throw new Error('Tekrar sayısı 1, 3, 5 veya 7 olmalı.');
  if (!Array.isArray(selectedVerses) || !selectedVerses.length) throw new Error('En az bir ayet seç.');
  if (selectedVerses.some(id => !verses.some(verse => verse.id === id))) throw new Error('Geçerli Fatiha ayetleri seçilmeli.');
  const timings = validateTimingDocument(document, audio);
  const lookup = new Map(timings.map(timing => [timing.id, timing]));
  const selected = [...new Set(selectedVerses)].sort((a, b) => a - b);
  const missing = selected.filter(id => alignmentUnits.some(unit => unit.verse === id && !lookup.get(unit.id)?.reviewed));
  if (missing.length) throw new Error(`${missing.join(', ')}. ayet için harf eşleştirmeleri henüz tamamlanıp doğrulanmadı. Önce Büyükler için bölümünde hazırlayın.`);
  return selected.flatMap(id => {
    const spoken = alignmentUnits.filter(unit => unit.verse === id);
    if (!spoken.length) throw new Error(`${id}. ayette okunacak harf kalmadı.`);
    const clip = { verse: id, start: lookup.get(spoken[0].id).start, end: lookup.get(spoken.at(-1).id).end };
    return [
      { ...clip, role: 'teacher', repetition: 0 },
      ...Array.from({ length: repetitions }, (_, index) => ({ ...clip, role: 'child', repetition: index + 1 })),
    ];
  });
}

export function buildTalimSteps(words, audio, selectedVerses, mode = 'verse', selectedParts = null, repetitions = 3) {
  if (!REPETITION_COUNTS.includes(repetitions)) throw new Error('Tekrar sayısı 1, 3, 5 veya 7 olmalı.');
  if (!['full', 'verse', 'medium', 'many'].includes(mode)) throw new Error('Geçerli bir ezber türü seç.');
  const selected = mode === 'full' ? verses.map(verse => verse.id) : selectedVerses;
  if (!Array.isArray(selected) || !selected.length || selected.some(id => !verses.some(verse => verse.id === id))) {
    throw new Error('En az bir Fatiha ayeti seç.');
  }
  const ranges = selectedVerseRanges(words, selected, audio?.duration);
  if (!ranges.length) throw new Error('Seçili ayetlerin kayıtlı kelime zamanları yüklenemedi.');
  const clips = mode === 'full' ? [{ start: ranges[0].start, end: ranges.at(-1).end,
    verse: 1, verses: ranges.map(range => range.verse), key: 'full' }]
    : mode === 'verse' ? ranges.map(range => ({ ...range, verses: [range.verse], key: String(range.verse) }))
      : buildStudyRanges(words, selected, audio.duration, mode, selectedParts);
  if (!clips.length) throw new Error('En az bir adım seç.');
  return clips.flatMap(clip => [
    { ...clip, role: 'teacher', repetition: 0 },
    ...Array.from({ length: repetitions }, (_, index) => ({ ...clip, role: 'child', repetition: index + 1 })),
  ]);
}

export const DEFAULT_PROGRESSION = 'auto';

export function validateProgression(progression) {
  if (!['auto', 'manual'].includes(progression)) throw new Error('Geçiş Otomatik veya Manuel olmalı.');
  return progression;
}

export function nextTalimStep(steps, index, mode, progression = 'manual') {
  validateProgression(progression);
  if (index + 1 >= steps.length) return { index, finished: true, waitingNext: false };
  if (progression === 'manual' && mode !== 'full' && steps[index + 1].role === 'teacher') {
    return { index, finished: false, waitingNext: true };
  }
  return { index: index + 1, finished: false, waitingNext: false };
}

export const REPEAT_CUE_LEAD_SECONDS = 0.1;

export function repeatCueTime(step, remainingSeconds) {
  return step?.role === 'child' && remainingSeconds > 0
    && remainingSeconds <= REPEAT_CUE_LEAD_SECONDS + 1e-9 ? step.start : null;
}

export const REPEAT_GAP_SECONDS = 1.5;
export const REPEAT_GAP_OPTIONS = [0.5, 1, 1.5, 2, 3, 4, 5];

export function validateRepeatGapSeconds(seconds) {
  if (!REPEAT_GAP_OPTIONS.includes(seconds)) throw new Error('Tekrar arası 0,5; 1; 1,5; 2; 3; 4 veya 5 saniye olmalı.');
  return seconds;
}

export function talimGapAfter(steps, index, mode, gapSeconds = REPEAT_GAP_SECONDS, progression = 'manual') {
  validateRepeatGapSeconds(gapSeconds);
  const next = nextTalimStep(steps, index, mode, progression);
  return !next.finished && !next.waitingNext ? gapSeconds : 0;
}

export function repeatGapRemaining(elapsedSeconds, gapSeconds = REPEAT_GAP_SECONDS) {
  validateRepeatGapSeconds(gapSeconds);
  return Math.max(0, gapSeconds - Math.max(0, elapsedSeconds));
}

export function repeatGapFraction(remainingSeconds, gapSeconds = REPEAT_GAP_SECONDS) {
  validateRepeatGapSeconds(gapSeconds);
  return Math.max(0, Math.min(1, remainingSeconds / gapSeconds));
}

export function memoryTime(step, elapsedSeconds) {
  return Math.max(step.start, Math.min(step.end, step.start + elapsedSeconds));
}
