import test from 'node:test';
import assert from 'node:assert/strict';
import { sortCategories, sortItems, silentEItems, syllableItems, syllableTypes, vcCvItems, workshopStrands } from '../../data/word-workshop.mjs';
import {
  WORKSHOP_CUSTOM_KEY, checkSortAnswer, checkSyllableAnswer, checkVcCvAnswer,
  createOutcomeCounts, getWorkshopItems, loadCustomVcCvCatalog, loadCustomVcCvItems, loadWordWorkshopCatalog,
  normalizeCustomVcCvItems, normalizeVcCvAnnotation, recordOutcome,
  saveCustomVcCvItems,
} from '../../assets/js/word-workshop-logic.mjs';

test('starter content covers all requested Word Workshop strands with explicit tutor keys', () => {
  assert.deepEqual(workshopStrands.map(strand => strand.id), ['silent-e', 'sort', 'syllables', 'vccv']);
  assert.ok(silentEItems.length >= 4 && silentEItems.every(item => item.word && item.answer && item.note));
  assert.ok(sortCategories.some(category => category.id === 'floss'));
  assert.ok(sortItems.some(item => item.pattern === 'ai') && sortItems.some(item => item.pattern === 'ay'));
  assert.deepEqual(new Set(syllableItems.map(item => item.pattern)), new Set(syllableTypes.map(type => type.id)));
  assert.ok(syllableItems.every(item => item.focus && item.word.includes(item.focus)), 'each classification target is explicitly marked in its example');
  assert.ok(vcCvItems.every(item => item.pattern.includes('/')));
});

test('silent-e transformations are stored as explicit pairs and returned as independent copies', () => {
  const items = getWorkshopItems('silent-e');
  assert.deepEqual(items[0], { ...silentEItems[0] });
  assert.equal(items[0].answer, 'cape');
  items[0].answer = 'unsafe';
  assert.equal(getWorkshopItems('silent-e')[0].answer, 'cape');
});

test('sort and six-type classification validate only tutor-provided item and category IDs', () => {
  assert.equal(checkSortAnswer('train', 'ai'), true);
  assert.equal(checkSortAnswer('train', 'ay'), false);
  assert.equal(checkSortAnswer('<script>', 'ai'), false);
  assert.equal(checkSyllableAnswer('robot', 'open'), true);
  assert.equal(checkSyllableAnswer('robot', 'closed'), false);
  assert.equal(checkSyllableAnswer('missing', 'open'), false);
});

test('VC.CV practice uses explicit annotations and rejects malformed or non-consonant boundaries', () => {
  assert.equal(checkVcCvAnswer('napkin', 'nap/kin'), true);
  assert.equal(checkVcCvAnswer('napkin', 'na/pkin'), false);
  assert.equal(checkVcCvAnswer('napkin', 'napkin'), false);
  assert.equal(normalizeVcCvAnnotation({ word: 'basket', split: 'bas/ket' }).pattern, 'bas/ket');
  assert.equal(normalizeVcCvAnnotation({ word: 'basket', split: 'ba/sket' }), null);
  assert.equal(normalizeVcCvAnnotation({ word: 'banana', split: 'ban/ana' }), null);
});

test('custom tutor annotations are safe, bounded, and round-trip locally', () => {
  assert.equal(normalizeVcCvAnnotation({ word: '<img src=x>', split: 'img/srcx' }), null);
  assert.equal(normalizeVcCvAnnotation({ word: 'basket', split: 'bas/ket', note: '<script>help</script>' }).note, 'scripthelp/script');
  assert.deepEqual(normalizeCustomVcCvItems([
    { word: 'dentist', split: 'den/tist' },
    { word: 'basket', split: 'ba/sket' },
    { word: 'rabbit', split: 'rab/bit' },
  ]).map(item => item.word), ['dentist']);
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const saved = saveCustomVcCvItems([{ word: 'dentist', split: 'den/tist', note: 'middle consonants' }], storage);
  assert.equal(saved.ok, true);
  assert.deepEqual(loadCustomVcCvItems(storage), saved.items);
  assert.equal(loadCustomVcCvCatalog(storage).error, null);
  assert.deepEqual(loadWordWorkshopCatalog('vccv', storage).items.map(item => item.id).slice(-1), ['custom-dentist-3']);
  assert.equal(values.has(WORKSHOP_CUSTOM_KEY), true);
  assert.equal(saveCustomVcCvItems([{ word: 'unsafe', split: 'un/safe' }], { setItem() { throw new Error('blocked'); } }).ok, false);
  assert.deepEqual(loadCustomVcCvItems({ getItem() { throw new Error('blocked'); } }), []);
});

test('shared VC.CV catalog reports unreadable saved data and refuses to overwrite it', () => {
  const values = new Map([[WORKSHOP_CUSTOM_KEY, '{broken annotations']]);
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const loaded = loadCustomVcCvCatalog(storage);
  assert.equal(loaded.error, 'invalid-data');
  assert.equal(loaded.raw, '{broken annotations');
  assert.deepEqual(loaded.items, []);
  const catalog = loadWordWorkshopCatalog('vccv', storage);
  assert.equal(catalog.error, 'invalid-data');
  assert.ok(catalog.items.some(item => item.id === 'napkin'));
  const result = saveCustomVcCvItems([{ word: 'dentist', split: 'den/tist' }], storage, loaded);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'invalid-data');
  assert.equal(values.get(WORKSHOP_CUSTOM_KEY), '{broken annotations');
});

test('paper and screen item selection retain explicit annotated content without deriving splits', () => {
  const items = getWorkshopItems('vccv', [{ word: 'dentist', split: 'den/tist' }]);
  assert.ok(items.some(item => item.word === 'dentist' && item.pattern === 'den/tist'));
  assert.ok(getWorkshopItems('sort').every(item => sortCategories.some(category => category.id === item.pattern)));
  assert.deepEqual(getWorkshopItems('unknown'), []);
});

test('tutor-confirmed outcomes aggregate counts without learner-response text', () => {
  let counts = createOutcomeCounts();
  counts = recordOutcome(counts, 'independent');
  counts = recordOutcome(counts, 'supported');
  counts = recordOutcome(counts, 'revisit');
  assert.deepEqual(counts, { independent: 1, supported: 1, revisit: 1 });
  assert.equal(recordOutcome(counts, 'anything'), counts);
  assert.equal(JSON.stringify(counts).includes('learner'), false);
});
