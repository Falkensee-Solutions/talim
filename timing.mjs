import { letters, alignmentUnits, alignmentUnitFor, sections, sectionLabel } from './fatiha.mjs';

export const ALIGNMENT_VERSION = 'haraka-groups-v1';

function migrateLetterTimings(timings) {
  const lookup = new Map(timings.map(timing => [timing.id, timing]));
  return alignmentUnits.flatMap(unit => {
    const head = lookup.get(unit.id);
    if (!head || head.silent) return [];
    const members = unit.members.map(id => lookup.get(id));
    const tail = members.filter(Boolean).at(-1);
    return [{
      id: unit.id,
      start: head.start,
      end: Math.max(head.end, tail.end),
      reviewed: members.every(timing => timing?.reviewed && !timing.silent),
      silent: false,
    }];
  });
}

export function normalizeTimingDocument(document, audio) {
  return { version: 1, alignment: ALIGNMENT_VERSION, audio, timings: validateTimingDocument(document, audio) };
}

export function validateSilentLetters(ids = []) {
  if (!Array.isArray(ids)) throw new Error('Okunmayan harf listesi geçerli değil.');
  const known = new Set(letters.map(letter => letter.id));
  if (ids.some(id => !known.has(id)) || new Set(ids).size !== ids.length) {
    throw new Error('Okunmayan harf listesinde bilinmeyen veya yinelenen harf var.');
  }
  const excluded = new Set(ids);
  for (const letter of letters) {
    if (letters.filter(other => other.verse === letter.verse && other.word === letter.word).every(other => excluded.has(other.id))) {
      throw new Error('Bir kelimenin bütün harfleri okunmayan olarak seçilemez.');
    }
  }
  return letters.filter(letter => excluded.has(letter.id)).map(letter => letter.id);
}

export function nextSpokenLetter(id, includeCurrent = false) {
  const owner = alignmentUnitFor(id);
  if (!owner) return undefined;
  const index = alignmentUnits.findIndex(unit => unit.id === owner.id);
  return alignmentUnits[index + (includeCurrent ? 0 : 1)];
}

export function validateTimingDocument(document, audio, { requireComplete = false } = {}) {
  if (!document || document.version !== 1 || !Array.isArray(document.timings)) {
    throw new Error('Geçerli bir sürüm 1 zamanlama dosyası seçin.');
  }
  if (document.audio?.sha256 !== audio.sha256 || !Number.isFinite(document.audio?.duration)
    || Math.abs(document.audio.duration - audio.duration) > 0.25) {
    throw new Error('Bu zamanlama dosyası yüklenen ses kaydına ait değil.');
  }
  if (document.alignment !== undefined && document.alignment !== ALIGNMENT_VERSION) throw new Error('Bilinmeyen eşleştirme biçimi.');
  const grouped = document.alignment === ALIGNMENT_VERSION;
  const excluded = new Set(grouped ? [] : validateSilentLetters(document.silentLetters));
  const known = new Map((grouped ? alignmentUnits : letters).map(letter => [letter.id, letter]));
  const seen = new Set();
  let clean = document.timings.filter(timing => !excluded.has(timing.id)).map(timing => {
    if (!known.has(timing.id) || seen.has(timing.id)) throw new Error('Bilinmeyen veya yinelenen harf kimliği.');
    seen.add(timing.id);
    if (!Number.isFinite(timing.start) || !Number.isFinite(timing.end)
      || timing.start < 0 || timing.end < timing.start || (!timing.silent && timing.end === timing.start)
      || (timing.silent === true && timing.end !== timing.start) || timing.end > audio.duration
      || (timing.silent !== undefined && typeof timing.silent !== 'boolean')
      || (grouped && timing.silent === true)
      || typeof timing.reviewed !== 'boolean') {
      throw new Error('Harf aralıkları ses süresi içinde olmalı; bitiş başlangıçtan büyük olmalı.');
    }
    return { id: timing.id, start: timing.start, end: timing.end, reviewed: timing.reviewed, silent: timing.silent === true };
  });
  const order = new Map(letters.map((letter, index) => [letter.id, index]));
  clean.sort((a, b) => order.get(a.id) - order.get(b.id));
  for (let i = 1; i < clean.length; i++) {
    if (clean[i].start < clean[i - 1].end - 0.001) {
      throw new Error('Harf aralıkları okuma sırasında ilerlemeli ve üst üste binmemeli.');
    }
  }
  if (!grouped) clean = migrateLetterTimings(clean);
  if (requireComplete && (clean.length !== alignmentUnits.length || clean.some(t => !t.reviewed))) {
    throw new Error('Parçalı dinleme için bütün harflerin zamanları girilmeli ve dinlenerek doğrulanmalı.');
  }
  return clean;
}

export function buildSegments(mode, timings, duration) {
  if (mode === 'full') return [{ title: 'Eûzü ve Fatiha’nın tamamı', start: 0, end: duration, verse: 0 }];
  const lookup = new Map(timings.map(timing => [timing.id, timing]));
  if (alignmentUnits.some(unit => !lookup.get(unit.id)?.reviewed)) return [];
  const groups = [];
  for (const verse of sections) {
    const verseLetters = alignmentUnits.filter(letter => letter.verse === verse.id);
    const words = [...new Set(verseLetters.map(letter => letter.word))];
    const size = mode === 'many' ? 1 : mode === 'medium' ? 2 : mode === 'few' ? words.length : 0;
    if (!size) throw new Error('Bilinmeyen parçalama modu.');
    for (let index = 0; index < words.length; index += size) {
      const chosen = verseLetters.filter(letter => words.slice(index, index + size).includes(letter.word));
      if (!chosen.length) continue;
      groups.push({
        title: mode === 'few' ? sectionLabel(verse.id) : `${sectionLabel(verse.id)} · ${Math.floor(index / size) + 1}. parça`,
        verse: verse.id,
        start: lookup.get(chosen[0].id).start,
        end: lookup.get(chosen.at(-1).id).end,
      });
    }
  }
  return groups;
}

export function activeLetter(time, timings) {
  return timings.find(timing => timing.reviewed && time >= timing.start && time < timing.end)?.id ?? null;
}
