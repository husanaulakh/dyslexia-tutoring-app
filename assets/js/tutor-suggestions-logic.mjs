import { TUTOR_SUGGESTIONS } from '../../data/tutor-suggestions.mjs';
import { parseReadingWords, normalizeWordLists } from './reading-words-logic.mjs';
import { loadStoredCollection, saveStoredCollection } from './collection-storage.mjs';

export const READING_WORD_LISTS_KEY = 'bright-steps-reading-word-lists';
export const MAX_READING_WORD_LISTS = 12;

const BY_ID = new Map(TUTOR_SUGGESTIONS.map(suggestion => [suggestion.id, suggestion]));

export function getTutorSuggestion(id) {
  return typeof id === 'string' ? BY_ID.get(id) ?? null : null;
}

export function getSuggestionsForConcept(conceptId) {
  if (typeof conceptId !== 'string' || !/^[a-z0-9-]{1,40}$/.test(conceptId)) return [];
  return TUTOR_SUGGESTIONS.filter(suggestion => suggestion.conceptIds.includes(conceptId));
}

function getStorage(storage) {
  if (storage !== undefined) return storage;
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function makeListId(suggestionId) {
  let suffix = '';
  try { if (globalThis.crypto?.randomUUID) suffix = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12); } catch { /* use fallback */ }
  if (!suffix) suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `suggested-${suggestionId}-${suffix}`;
}

/** Add one curated set to the existing Reading Words list collection without replacing tutor lists. */
export function saveSuggestionAsReadingList(suggestionId, { storage, makeId = makeListId } = {}) {
  const suggestion = getTutorSuggestion(suggestionId);
  if (!suggestion) return { ok: false, error: 'unknown-suggestion' };
  const target = getStorage(storage);
  if (!target) return { ok: false, error: 'storage-unavailable' };
  const loaded = loadStoredCollection({
    key: READING_WORD_LISTS_KEY,
    storage: target,
    normalize: value => normalizeWordLists(value, []),
    fallback: [],
  });
  if (loaded.error) return { ok: false, error: loaded.error === 'invalid-data' ? 'invalid-storage' : 'storage-unavailable' };
  const existing = loaded.items;
  const words = parseReadingWords(suggestion.words);
  if (!words.length) return { ok: false, error: 'invalid-suggestion' };
  const matchingList = existing.find(list => list.name === `Suggested: ${suggestion.title}`.slice(0, 40)
    && list.words.length === words.length
    && list.words.every((word, index) => word === words[index]));
  if (matchingList) return { ok: true, error: null, list: matchingList, lists: existing, reused: true };
  if (existing.length >= MAX_READING_WORD_LISTS) return { ok: false, error: 'limit' };
  const id = makeId(suggestion.id);
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id) || existing.some(list => list.id === id)) {
    return { ok: false, error: 'invalid-id' };
  }
  const list = { id, name: `Suggested: ${suggestion.title}`.slice(0, 40), words };
  const lists = [...existing, list];
  const saved = saveStoredCollection({ key: READING_WORD_LISTS_KEY, items: lists, loaded, storage: target });
  if (!saved.ok) return { ok: false, error: saved.error === 'invalid-data' || saved.error === 'changed' ? 'changed-storage' : 'storage-unavailable' };
  return { ok: true, error: null, list, lists };
}
