import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBlendingBoardWords, normalizeBlendingBoardWords, BLENDING_BOARD_STARTER_WORDS, BLENDING_BOARD_STORAGE_KEY } from '../../assets/js/blending-board-data.mjs';
import { saveStoredCollection } from '../../assets/js/collection-storage.mjs';

function memoryStorage(initial = null) {
  let raw = initial;
  return {
    getItem() { return raw; },
    setItem(_key, value) { raw = String(value); },
    inspect() { return raw; },
  };
}

test('Board word loader shares original starter catalog and exposes stable word IDs', () => {
  const storage = memoryStorage();
  const loaded = loadBlendingBoardWords(storage);
  assert.equal(loaded.error, null);
  assert.equal(loaded.items.length, BLENDING_BOARD_STARTER_WORDS.length);
  assert.deepEqual(loaded.items.find(item => item.word === 'ship'), { word: 'ship', chunks: ['sh', 'i', 'p'], lessonTag: 'current' });
  loaded.items[0].chunks[0] = 'changed';
  assert.equal(BLENDING_BOARD_STARTER_WORDS[0].chunks[0], 'c');
});

test('Board loader normalizes saved words and rejects a malformed row as one collection', () => {
  const saved = JSON.stringify([{ word: 'At', chunks: ['A', 't'], lessonTag: 'previous' }]);
  const valid = loadBlendingBoardWords(memoryStorage(saved));
  assert.equal(valid.error, null);
  assert.deepEqual(valid.items, [{ word: 'at', chunks: ['a', 't'], lessonTag: 'previous' }]);

  const malformedRaw = JSON.stringify([{ word: 'safe', chunks: ['s','a','f','e'] }, { word: '<img>', chunks: ['x','y'] }]);
  const storage = memoryStorage(malformedRaw);
  const loaded = loadBlendingBoardWords(storage);
  assert.equal(loaded.error, 'invalid-data');
  assert.equal(loaded.raw, malformedRaw);
  assert.equal(loaded.items.length, BLENDING_BOARD_STARTER_WORDS.length);
  assert.throws(() => normalizeBlendingBoardWords([{ word: 'ok', chunks: ['o','k'] }, null]));

  const save = saveStoredCollection({ key: BLENDING_BOARD_STORAGE_KEY, items: [], loaded, storage });
  assert.equal(save.ok, false);
  assert.equal(save.error, 'invalid-data');
  assert.equal(storage.inspect(), malformedRaw);
});

test('Board guarded save refuses overwriting a dictionary changed after load', () => {
  const storage = memoryStorage();
  const loaded = loadBlendingBoardWords(storage);
  storage.setItem(BLENDING_BOARD_STORAGE_KEY, 'not-json');
  const result = saveStoredCollection({ key: BLENDING_BOARD_STORAGE_KEY, items: loaded.items, loaded, storage });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'changed');
  assert.equal(storage.inspect(), 'not-json');
});
