import test from 'node:test';
import assert from 'node:assert/strict';
import { verses, sections, sectionLabel, displayArabic, letters, alignmentUnits } from '../fatiha.mjs';
import { ALIGNMENT_VERSION, validateTimingDocument, buildSegments, activeLetter } from '../timing.mjs';

// Synthetic times exercise the schema; they are not timestamps for the supplied recording.
const audio = { sha256: 'test-audio', duration: 60 };
const fixture = () => ({ version: 1, alignment: ALIGNMENT_VERSION, audio, timings: alignmentUnits.map((letter, index) => ({ id: letter.id, start: index * .3, end: index * .3 + .2, reviewed: true })) });

test('graphemes preserve original Arabic offsets and attached vowel marks', () => {
  for (const letter of letters) assert.equal(sections.find(section => section.id === letter.verse).arabic.slice(letter.offset, letter.offset + letter.length), letter.text);
  assert.equal(letters.find(letter => letter.id === '1:0').text, 'بِ');
  assert.equal(letters[0].verse, 0);
  assert.equal(verses.length, 7);
  assert.equal(sectionLabel(0), 'Eûzü · Başlangıç duası');
  assert.ok(letters.some(letter => letter.text.includes('ّ')));
  assert.equal(new Set(letters.map(letter => letter.id)).size, letters.length);
});
test('child display uses kasra instead of circular marks without changing timing offsets', () => {
  assert.equal(displayArabic('ح۪'), 'حِ');
  assert.equal(displayArabic('بِسْمِ'), 'بِسْمِ');
  for (const section of sections) {
    const displayed = displayArabic(section.arabic);
    assert.equal(displayed.includes('\u06ea'), false);
    assert.equal(displayed.length, section.arabic.length);
    for (const letter of letters.filter(letter => letter.verse === section.id)) {
      assert.equal(displayed.slice(letter.offset, letter.offset + letter.length), displayArabic(letter.text));
    }
  }
  assert.ok(verses[0].arabic.includes('\u06ea'));
});
test('full audio works without alignment; segmented modes do not', () => {
  assert.deepEqual(buildSegments('full', [], 54), [{ title: 'Eûzü ve Fatiha’nın tamamı', start: 0, end: 54, verse: 0 }]);
  for (const mode of ['many', 'medium', 'few']) assert.deepEqual(buildSegments(mode, [], 54), []);
});
test('complete reviewed data builds word, pair and verse clips without changing speed', () => {
  const clean = validateTimingDocument(fixture(), audio, { requireComplete: true });
  const words = sections.reduce((sum, verse) => sum + verse.arabic.split(/\s+/u).length, 0);
  assert.equal(buildSegments('many', clean, 60).length, words);
  assert.equal(buildSegments('medium', clean, 60).length, sections.reduce((sum, verse) => sum + Math.ceil(verse.arabic.split(/\s+/u).length / 2), 0));
  const few = buildSegments('few', clean, 60);
  assert.equal(few.length, 8);
  assert.equal(few[0].verse, 0);
  assert.equal(few[1].title, '1. ayet');
  assert.equal(few[0].start, clean[0].start);
  assert.equal(few.at(-1).end, clean.at(-1).end);
});
test('draft data imports but cannot enable complete alignment', () => {
  const data = fixture(); data.timings[0].reviewed = false;
  assert.doesNotThrow(() => validateTimingDocument(data, audio));
  assert.throws(() => validateTimingDocument(data, audio, { requireComplete: true }));
  assert.deepEqual(buildSegments('many', data.timings, 60), []);
  data.timings.pop();
  assert.throws(() => validateTimingDocument(data, audio, { requireComplete: true }));
});
test('rejects wrong audio, unknown/duplicate ids, invalid bounds and overlap', () => {
  assert.throws(() => validateTimingDocument(fixture(), { ...audio, sha256: 'other' }));
  assert.throws(() => validateTimingDocument(fixture(), { ...audio, duration: 62 }));
  for (const mutate of [
    data => { data.timings[0].id = 'unknown'; },
    data => { data.timings.push(data.timings[0]); },
    data => { data.timings[0].start = -1; },
    data => { data.timings[0].start = NaN; },
    data => { data.timings[0].end = 70; },
    data => { data.timings[0].end = 0; },
    data => { data.timings[1].start = .1; },
    data => { data.timings[0].reviewed = 'yes'; },
  ]) {
    const data = fixture(); mutate(data);
    assert.throws(() => validateTimingDocument(data, audio));
  }
});
test('group timing cannot mark a pronounced group silent or use zero duration', () => {
  const data = fixture();
  data.timings[3].silent = true;
  data.timings[3].end = data.timings[3].start;
  assert.throws(() => validateTimingDocument(data, audio));
});
test('marker hides in silence and for unreviewed data', () => {
  const { timings } = fixture();
  assert.equal(activeLetter(.1, timings), alignmentUnits[0].id);
  assert.equal(activeLetter(.25, timings), null);
  assert.equal(activeLetter(60, timings), null);
  timings[0].reviewed = false;
  assert.equal(activeLetter(.1, timings), null);
});
