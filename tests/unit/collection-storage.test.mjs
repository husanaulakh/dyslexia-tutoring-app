import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStoredCollection, saveStoredCollection } from '../../assets/js/collection-storage.mjs';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const copy = value => value.map(item => ({ ...item }));
const fallback = () => [{ id: 'starter' }];
const load = storage => loadStoredCollection({ key: 'lists', storage, normalize: copy, fallback });

test('a missing collection returns defaults and can be saved', () => {
  const storage = new MemoryStorage();
  const loaded = load(storage);
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.items, fallback());
  const saved = saveStoredCollection({ key: 'lists', items: [{ id: 'new' }], loaded, storage });
  assert.equal(saved.ok, true);
  assert.equal(storage.getItem('lists'), '[{"id":"new"}]');
});

test('malformed or non-array payloads are reported and their raw data is preserved', () => {
  for (const raw of ['{broken', '{"items":[]}']) {
    const storage = new MemoryStorage();
    storage.setItem('lists', raw);
    const loaded = load(storage);
    assert.equal(loaded.error, 'invalid-data');
    assert.equal(loaded.raw, raw);
    assert.deepEqual(loaded.items, fallback());
    assert.equal(saveStoredCollection({ key: 'lists', items: [{ id: 'replace' }], loaded, storage }).ok, false);
    assert.equal(storage.getItem('lists'), raw);
  }
});

test('save rereads storage and refuses external changes or corruption', () => {
  const storage = new MemoryStorage();
  storage.setItem('lists', '[{"id":"first"}]');
  const loaded = load(storage);
  storage.setItem('lists', '{broken after load');
  const result = saveStoredCollection({ key: 'lists', items: [{ id: 'overwrite' }], loaded, storage });
  assert.equal(result.error, 'changed');
  assert.equal(storage.getItem('lists'), '{broken after load');

  const corruptLoad = load(storage);
  assert.equal(saveStoredCollection({ key: 'lists', items: [{ id: 'overwrite' }], loaded: corruptLoad, storage }).error, 'invalid-data');
  assert.equal(storage.getItem('lists'), '{broken after load');
});

test('storage read failures produce defaults but do not permit writes', () => {
  const storage = { getItem() { throw new Error('unavailable'); }, setItem() { throw new Error('should not write'); } };
  const loaded = load(storage);
  assert.equal(loaded.error, 'storage-unavailable');
  assert.deepEqual(loaded.items, fallback());
  assert.equal(saveStoredCollection({ key: 'lists', items: [{ id: 'unsafe' }], loaded, storage }).error, 'storage-unavailable');
});
