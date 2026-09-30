import { soundBoxWords } from '../../data/sound-boxes-words.mjs';

const CONCEPT_IDS = new Set(['l1-short-vowels', 'l1-digraphs', 'l1-blends']);
const SAFE_WORD = /^[a-z]{2,24}$/i;

export function normalizeSoundBoxItem(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (typeof value.word !== 'string' || !SAFE_WORD.test(value.word)) return null;
  if (!Array.isArray(value.phonemes) || value.phonemes.length < 2 || value.phonemes.length > 6) return null;
  const phonemes = value.phonemes.map(part => typeof part === 'string' ? part.normalize('NFKC').trim() : '');
  if (phonemes.some(part => !part || part.length > 16 || /[<>\u0000-\u001f]/.test(part))) return null;
  const conceptIds = Array.isArray(value.conceptIds)
    ? [...new Set(value.conceptIds.filter(id => CONCEPT_IDS.has(id)))] : [];
  return {
    id: typeof value.id === 'string' && /^[a-z0-9-]{1,40}$/i.test(value.id) ? value.id : value.word.toLowerCase(),
    word: value.word.toLowerCase(), phonemes, conceptIds,
  };
}

export function parseAnnotatedWords(raw) {
  const lines = String(raw ?? '').split(/\r?\n/).slice(0, 40);
  const items = [];
  const errors = [];
  lines.forEach((line, index) => {
    const text = line.trim();
    if (!text) return;
    const [wordPart, phonemePart, extra] = text.split('|');
    const word = (wordPart ?? '').trim();
    const phonemes = (phonemePart ?? '').trim().split(/\s+/).filter(Boolean);
    const item = !extra ? normalizeSoundBoxItem({ word, phonemes }) : null;
    if (!item) errors.push(`Line ${index + 1}: enter a word | then 2–6 explicit phonemes.`);
    else items.push(item);
  });
  return { items, errors };
}

export function selectSoundBoxItems(settings = {}, all = soundBoxWords) {
  const requested = Array.isArray(settings.wordIds) ? new Set(settings.wordIds) : null;
  const selected = requested ? all.filter(item => requested.has(item.id)) : [...all];
  const max = Number.isInteger(settings.count) ? Math.max(1, Math.min(40, settings.count)) : selected.length;
  return selected.slice(0, max).map(item => ({ ...item, phonemes: [...item.phonemes], conceptIds: [...item.conceptIds] }));
}

export function normalizeOutcome(value) {
  return ['independent', 'supported', 'revisit'].includes(value) ? value : '';
}

export function emptyOutcomeCounts() { return { independent: 0, supported: 0, revisit: 0 }; }
