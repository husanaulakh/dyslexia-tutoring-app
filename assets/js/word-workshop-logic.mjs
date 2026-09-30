import { silentEItems, sortCategories, sortItems, syllableItems, syllableTypes, vcCvItems } from '../../data/word-workshop.mjs';

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
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    return normalizeCustomVcCvItems(JSON.parse(target?.getItem(WORKSHOP_CUSTOM_KEY) ?? '[]'));
  }
  catch { return []; }
}

export function saveCustomVcCvItems(items, storage) {
  const normalized = normalizeCustomVcCvItems(items);
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (!target) return { ok: false, items: normalized };
    target.setItem(WORKSHOP_CUSTOM_KEY, JSON.stringify(normalized));
    return { ok: true, items: normalized };
  } catch { return { ok: false, items: normalized }; }
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

export function createOutcomeCounts() {
  return { independent: 0, supported: 0, revisit: 0 };
}

export function recordOutcome(counts, outcome) {
  if (!counts || !Object.hasOwn(counts, outcome) || !['independent', 'supported', 'revisit'].includes(outcome)) return counts;
  return { ...counts, [outcome]: counts[outcome] + 1 };
}
