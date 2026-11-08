import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sections, displayArabic } from '../fatiha.mjs';

const font = await readFile(new URL('../TalimQuran.ttf', import.meta.url));
const u16 = offset => font.readUInt16BE(offset);
const u32 = offset => font.readUInt32BE(offset);
const tables = new Map(Array.from({ length: u16(4) }, (_, index) => {
  const record = 12 + index * 16;
  return [font.toString('ascii', record, record + 4), u32(record + 8)];
}));

function glyphFor(code) {
  const cmap = tables.get('cmap');
  for (let index = 0; index < u16(cmap + 2); index++) {
    const table = cmap + u32(cmap + 8 + index * 8);
    if (u16(table) !== 4) continue;
    const count = u16(table + 6) / 2;
    const ends = table + 14;
    const starts = ends + count * 2 + 2;
    const deltas = starts + count * 2;
    const offsets = deltas + count * 2;
    for (let segment = 0; segment < count; segment++) {
      if (code < u16(starts + segment * 2) || code > u16(ends + segment * 2)) continue;
      const delta = u16(deltas + segment * 2);
      const offset = offsets + segment * 2;
      const distance = u16(offset);
      if (!distance) return (code + delta) & 0xffff;
      const glyph = u16(offset + distance + (code - u16(starts + segment * 2)) * 2);
      return glyph ? (glyph + delta) & 0xffff : 0;
    }
  }
  return 0;
}

function colorsFor(code) {
  const colr = tables.get('COLR');
  const records = colr + u32(colr + 4);
  const layers = colr + u32(colr + 8);
  const glyph = glyphFor(code);
  for (let index = 0; index < u16(colr + 2); index++) {
    const record = records + index * 6;
    if (u16(record) !== glyph) continue;
    return Array.from({ length: u16(record + 4) }, (_, layer) => u16(layers + (u16(record + 2) + layer) * 4 + 2));
  }
  return [];
}

test('Quran font retains shaping tables and covers every displayed Arabic character', () => {
  for (const tag of ['GPOS', 'GSUB', 'COLR', 'CPAL']) assert.ok(tables.has(tag));
  for (const section of sections) {
    for (const character of displayArabic(section.arabic)) assert.ok(glyphFor(character.codePointAt(0)), character);
  }
});

test('vowels and shadda are red; stop marks including small seen are purple', () => {
  const cpal = tables.get('CPAL');
  assert.equal(u16(cpal + 2), 4);
  const colors = cpal + u32(cpal + 8);
  for (let index = 0; index < 4; index++) {
    assert.deepEqual([...font.subarray(colors + index * 4, colors + index * 4 + 4)], index === 3 ? [152, 60, 125, 255] : [50, 35, 180, 255]);
  }
  for (const code of [0x064e, 0x064f, 0x0650, 0x0651, 0x0652, 0x0670]) assert.deepEqual(colorsFor(code), [0]);
  for (const code of [0x06d6, 0x06d7, 0x06d8, 0x06d9, 0x06da, 0x06dc]) assert.deepEqual(colorsFor(code), [3]);
});
