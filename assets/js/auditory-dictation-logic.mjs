import { auditoryDictationItems } from '../../data/auditory-dictation-items.mjs';

const CONCEPT_IDS = new Set(['l1-short-vowels', 'l1-digraphs', 'l1-blends', 'l1-short-vowel-spelling']);
const SPELLING = /^[a-z]+(?:['-][a-z]+)*$/i;

export function normalizeDictationItem(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!['sound', 'word'].includes(value.kind) || typeof value.prompt !== 'string' || value.prompt.length > 120) return null;
  if (!Array.isArray(value.acceptedSpellings) || !value.acceptedSpellings.length || value.acceptedSpellings.length > 8) return null;
  const acceptedSpellings = [...new Set(value.acceptedSpellings.map(item => typeof item === 'string' ? item.trim().toLowerCase() : ''))];
  if (acceptedSpellings.some(item => !SPELLING.test(item))) return null;
  if (/[<>\u0000-\u001f]/.test(value.prompt)) return null;
  return {
    id: typeof value.id === 'string' && /^[a-z0-9-]{1,40}$/i.test(value.id) ? value.id : 'custom-item',
    kind: value.kind, prompt: value.prompt,
    acceptedSpellings,
    conceptIds: Array.isArray(value.conceptIds) ? [...new Set(value.conceptIds.filter(id => CONCEPT_IDS.has(id)))] : [],
  };
}

export function selectDictationItems(settings = {}, all = auditoryDictationItems) {
  const ids = Array.isArray(settings.itemIds) ? new Set(settings.itemIds) : null;
  const selected = ids ? all.filter(item => ids.has(item.id)) : [...all];
  const preset = settings.preset;
  const filtered = preset === 'sounds' ? selected.filter(item => item.kind === 'sound')
    : preset === 'words' ? selected.filter(item => item.kind === 'word') : selected;
  const count = Number.isInteger(settings.count) ? Math.max(1, Math.min(40, settings.count)) : filtered.length;
  return filtered.slice(0, count).map(item => ({ ...item, acceptedSpellings: [...item.acceptedSpellings], conceptIds: [...item.conceptIds] }));
}

export function isAcceptedSpelling(item, response) {
  if (!item || typeof response !== 'string' || !SPELLING.test(response.trim())) return false;
  return item.acceptedSpellings.includes(response.trim().toLowerCase());
}

export { normalizeOutcome, createOutcomeCounts as emptyOutcomeCounts } from './practice-outcomes.mjs';
