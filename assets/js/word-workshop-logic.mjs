import { silentEItems, sortCategories, sortItems, syllableItems, syllableTypes, vcCvItems } from '../../data/word-workshop.mjs';
import { loadStoredCollection, saveStoredCollection } from './collection-storage.mjs';

export const WORKSHOP_CUSTOM_KEY = 'bright-steps-word-workshop-v1';
const VOWELS = new Set('aeiou');
const CONSONANTS = new Set('bcdfghjklmnpqrstvwxyz');

export function normalizeWord(value) {
  if (typeof value !== 'string') return '';
  const word = value.normalize('NFKC').trim().toLowerCase();
  return word.length >= 4 && word.length <= 24 && /^[a-z]+$/.test(word) ? word : '';
}

/** Accept only tutor-provided exact VC.CV annotations. No split is inferred. */
export function normalizeVcCvAnnotation(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const word = normalizeWord(record.word);
  const rawSplit = typeof record.split === 'string' ? record.split.trim().toLowerCase()
    : typeof record.pattern === 'string' ? record.pattern.trim().toLowerCase() : '';
  const match = /^([a-z]{2,12})\/([a-z]{2,12})$/.exec(rawSplit);
  if (!word || !match || `${match[1]}${match[2]}` !== word) return null;
  const boundary = match[1].length;
  const leftConsonant = word[boundary - 1];
  const rightConsonant = word[boundary];
  if (!CONSONANTS.has(leftConsonant) || !CONSONANTS.has(rightConsonant)) return null;
  if (![...match[1]].some(char => VOWELS.has(char)) || ![...match[2]].some(char => VOWELS.has(char))) return null;
  const note = typeof record.note === 'string'
    ? record.note.normalize('NFKC').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 100)
    : '';
  return { id: `custom-${word}-${boundary}`, word, pattern: `${match[1]}/${match[2]}`, note };
}

export function normalizeCustomVcCvItems(value) {
  if (!Array.isArray(value)) return [];
  const results = [];
  const ids = new Set();
  for (const raw of value.slice(0, 40)) {
    const item = normalizeVcCvAnnotation(raw);
    if (item && !ids.has(item.id) && !vcCvItems.some(starter => starter.word === item.word)) {
      ids.add(item.id);
      results.push(item);
    }
  }
  return results;
}

export function loadCustomVcCvItems(storage) {
  return loadCustomVcCvCatalog(storage).items;
}

/** Load validated tutor annotations while retaining unreadable bytes for safe save decisions. */
export function loadCustomVcCvCatalog(storage) {
  return loadStoredCollection({
    key: WORKSHOP_CUSTOM_KEY,
    normalize: normalizeCustomVcCvItems,
    fallback: [],
    ...(storage === undefined ? {} : { storage }),
  });
}

/** Catalog shared by the activity and lesson builder, including saved tutor annotations. */
export function loadWordWorkshopCatalog(strand, storage) {
  if (strand !== 'vccv') return { items: getWorkshopItems(strand), error: null, raw: null };
  const saved = loadCustomVcCvCatalog(storage);
  return { items: getWorkshopItems(strand, saved.items), error: saved.error, raw: saved.raw };
}

export function saveCustomVcCvItems(items, storage, loaded = loadCustomVcCvCatalog(storage)) {
  const normalized = normalizeCustomVcCvItems(items);
  const result = saveStoredCollection({
    key: WORKSHOP_CUSTOM_KEY,
    items: normalized,
    loaded,
    ...(storage === undefined ? {} : { storage }),
  });
  return { ok: result.ok, items: normalized, error: result.error, raw: result.raw };
}

export function getWorkshopItems(strand, customVcCv = []) {
  if (strand === 'silent-e') return silentEItems.map(item => ({ ...item }));
  if (strand === 'sort') return sortItems.map(item => ({ ...item }));
  if (strand === 'syllables') return syllableItems.map(item => ({ ...item }));
  if (strand === 'vccv') return [...vcCvItems, ...normalizeCustomVcCvItems(customVcCv)].map(item => ({ ...item }));
  return [];
}

export function getSortCategory(id) {
  return sortCategories.find(category => category.id === id) ?? null;
}

export function getSyllableType(id) {
  return syllableTypes.find(type => type.id === id) ?? null;
}

export function checkSortAnswer(itemId, categoryId) {
  const item = sortItems.find(candidate => candidate.id === itemId);
  return Boolean(item && sortCategories.some(category => category.id === categoryId) && item.pattern === categoryId);
}

export function checkSyllableAnswer(itemId, typeId) {
  const item = syllableItems.find(candidate => candidate.id === itemId);
  return Boolean(item && syllableTypes.some(type => type.id === typeId) && item.pattern === typeId);
}

export function checkVcCvAnswer(itemId, split, customVcCv = []) {
  const item = getWorkshopItems('vccv', customVcCv).find(candidate => candidate.id === itemId);
  return Boolean(item && typeof split === 'string' && split.trim().toLowerCase() === item.pattern.toLowerCase());
}

export { createOutcomeCounts, recordOutcome } from './practice-outcomes.mjs';
