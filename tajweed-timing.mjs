import { letters } from './fatiha.mjs';

export const TAJWEED_BLEND = .15;
export const MAX_BOUNDARY_SHIFT = .02;
export const timingSources = {
  med: 'https://tecvid.org/7-ders-med-uzatma/',
  shadda: 'https://tecvid.org/6-ders-diger-idgamlar/',
};
const letterById = new Map(letters.map(letter => [letter.id, letter]));

export function groupTimingWeights(units) {
  return units.map((unit, index) => {
    const head = letterById.get(unit.id)?.text || unit.text || '';
    const tails = (unit.members || []).filter(id => id !== unit.id).map(id => letterById.get(id)?.text || '');
    const longVowel = /\u0670/u.test(head)
      || (/\u064e/u.test(head) && tails.some(text => /^[اى]$/u.test(text)))
      || (/[\u0650\u06ea]/u.test(head) && tails.some(text => /^[يى]$/u.test(text)))
      || (/\u064f/u.test(head) && tails.some(text => /^و$/u.test(text)));
    const next = units[index + 1];
    const nextHead = next ? letterById.get(next.id)?.text || next.text || '' : '';
    const shadda = /\u0651/u.test(head);
    const rules = [];
    let vowelWeight = 1;
    if (longVowel && /[\u0651\u0652]/u.test(nextHead)) {
      vowelWeight = 6;
      rules.push('written-lazim');
    } else if (longVowel && !/\u0653/u.test(head)) {
      vowelWeight = 2;
      rules.push('natural-madd');
    } else if (/\u0653/u.test(head)) {
      // A madd sign alone cannot select muttasil/munfasil or a valid length variant.
      rules.push('unresolved-madd');
    }
    if (shadda) rules.push('gemination');
    // The extra consonant is a visual prior, not a prescribed shadda duration.
    return { id: unit.id, weight: vowelWeight + (shadda ? 1 : 0), rules };
  });
}

export function weightedUnitBoundaries(units) {
  if (!units.length) return [];
  const hints = groupTimingWeights(units);
  const total = hints.reduce((sum, hint) => sum + hint.weight, 0);
  let accumulated = 0;
  const boundaries = [0];
  for (let index = 0; index < units.length - 1; index++) {
    accumulated += hints[index].weight;
    const original = (index + 1) / units.length;
    const proposed = (1 - TAJWEED_BLEND) * original + TAJWEED_BLEND * accumulated / total;
    boundaries.push(Math.max(original - MAX_BOUNDARY_SHIFT, Math.min(original + MAX_BOUNDARY_SHIFT, proposed)));
  }
  boundaries.push(1);
  return boundaries;
}
