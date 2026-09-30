import { TUTOR_SUGGESTIONS } from '../../data/tutor-suggestions.mjs';
import { parseReadingWords, normalizeWordLists } from './reading-words-logic.mjs';

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
  let existing;
  let raw;
  try {
    raw = target.getItem(READING_WORD_LISTS_KEY);
  } catch { return { ok: false, error: 'storage-unavailable' }; }
  if (raw === null) existing = [];
  else {
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return { ok: false, error: 'invalid-storage' }; }
    if (!Array.isArray(parsed)) return { ok: false, error: 'invalid-storage' };
    if (parsed.length >= MAX_READING_WORD_LISTS) return { ok: false, error: 'limit' };
    existing = normalizeWordLists(parsed);
  }
  if (existing.length >= MAX_READING_WORD_LISTS) return { ok: false, error: 'limit' };
  const id = makeId(suggestion.id);
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id) || existing.some(list => list.id === id)) {
    return { ok: false, error: 'invalid-id' };
  }
  const words = parseReadingWords(suggestion.words);
  if (!words.length) return { ok: false, error: 'invalid-suggestion' };
  const list = { id, name: `Suggested: ${suggestion.title}`.slice(0, 40), words };
  const lists = [...existing, list];
  try {
    target.setItem(READING_WORD_LISTS_KEY, JSON.stringify(lists));
    return { ok: true, error: null, list, lists };
  } catch { return { ok: false, error: 'storage-unavailable' }; }
}
