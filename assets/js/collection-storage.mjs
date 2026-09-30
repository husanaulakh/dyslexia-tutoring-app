function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function fallbackItems(fallback) {
  try {
    const value = typeof fallback === 'function' ? fallback() : fallback;
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

/** Load one JSON-array collection without replacing unreadable stored bytes with defaults. */
export function loadStoredCollection({ key, normalize, fallback = [], storage } = {}) {
  const target = resolveStorage(storage);
  const empty = fallbackItems(fallback);
  if (!target || typeof key !== 'string' || typeof normalize !== 'function') {
    return { items: empty, raw: null, error: 'storage-unavailable' };
  }
  let raw;
  try { raw = target.getItem(key); }
  catch { return { items: empty, raw: null, error: 'storage-unavailable' }; }
  if (raw === null) return { items: empty, raw: null, error: null };
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return { items: empty, raw, error: 'invalid-data' }; }
  if (!Array.isArray(parsed)) return { items: empty, raw, error: 'invalid-data' };
  try { return { items: normalize(parsed), raw, error: null }; }
  catch { return { items: empty, raw, error: 'invalid-data' }; }
}

/** Save only if the source payload is still the readable version originally loaded. */
export function saveStoredCollection({ key, items, loaded, storage } = {}) {
  if (!loaded || loaded.error) return { ok: false, error: loaded?.error ?? 'storage-unavailable' };
  const target = resolveStorage(storage);
  if (!target || typeof key !== 'string' || !Array.isArray(items)) return { ok: false, error: 'storage-unavailable' };
  let currentRaw;
  try { currentRaw = target.getItem(key); }
  catch { return { ok: false, error: 'storage-unavailable' }; }
  if (currentRaw !== loaded.raw) return { ok: false, error: 'changed' };
  if (currentRaw !== null) {
    let parsed;
    try { parsed = JSON.parse(currentRaw); }
    catch { return { ok: false, error: 'invalid-data' }; }
    if (!Array.isArray(parsed)) return { ok: false, error: 'invalid-data' };
  }
  let serialized;
  try { serialized = JSON.stringify(items); }
  catch { return { ok: false, error: 'invalid-data' }; }
  try {
    target.setItem(key, serialized);
    return { ok: true, error: null, raw: serialized };
  } catch { return { ok: false, error: 'storage-unavailable' }; }
}
