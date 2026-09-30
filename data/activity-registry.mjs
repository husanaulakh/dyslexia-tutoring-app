import { ASSESSMENT_ITEM_IDS } from './assessment-scope-sequence.mjs';

/** Stable catalog for activities that can be placed into a tutor lesson. */
const descriptors = [
  { id: 'whats-missing-cards', label: "What's Missing? Cards", path: '/activities/whats-missing-cards.html', kind: 'practice', available: true, conceptIds: ['l1-learned-words'], supportedModes: ['screen', 'paper'] },
  { id: 'blending-board', label: 'Blending Board', path: '/activities/blending-board.html', kind: 'practice', available: true, conceptIds: ['l1-short-vowels', 'l1-digraphs', 'l1-blends', 'l1-closed-syllable'], supportedModes: ['screen', 'paper'] },
  { id: 'trace-copy-cover-close', label: 'Trace, Copy, Cover, Close', path: '/activities/trace-copy-cover-close.html', kind: 'practice', available: true, conceptIds: ['l1-short-vowel-spelling', 'l2-k-ck', 'l2-ch-tch', 'l2-ge-dge'], supportedModes: ['screen', 'paper'] },
  { id: 'visual-drill-cards', label: 'Visual Drill Cards', path: '/activities/visual-drill-cards.html', kind: 'practice', available: true, conceptIds: ['l1-learned-words', 'l2-learned-words', 'l3-learned-words'], supportedModes: ['screen', 'paper'] },
  { id: 'reading-words', label: 'Reading Words', path: '/activities/reading-words.html', kind: 'reading', available: true, conceptIds: ['l1-short-vowels', 'l1-digraphs', 'l1-blends', 'l2-vowel-teams'], supportedModes: ['screen', 'paper'] },
  { id: 'paragraph-reading', label: 'Paragraph Reading', path: '/activities/paragraph-reading.html', kind: 'reading', available: true, conceptIds: ['l1-connected-text', 'l2-connected-text', 'l3-advanced-review'], supportedModes: ['screen', 'paper'] },
  { id: 'sound-boxes', label: 'Sound Boxes', path: '/activities/sound-boxes.html', kind: 'practice', available: true, conceptIds: ['l1-short-vowels', 'l1-digraphs', 'l1-blends'], supportedModes: ['screen', 'paper'] },
  { id: 'auditory-dictation', label: 'Auditory Dictation', path: '/activities/auditory-dictation.html', kind: 'practice', available: true, conceptIds: ['l1-short-vowel-spelling', 'l1-digraphs', 'l1-blends'], supportedModes: ['screen', 'paper'] },
  { id: 'word-workshop', label: 'Word Workshop', path: '/activities/word-workshop.html', kind: 'practice', available: false, conceptIds: ['l1-silent-e', 'l1-floss', 'l1-vccv', 'l2-open-syllable', 'l2-vowel-teams'], supportedModes: ['screen', 'paper'] },
  { id: 'student-progress', label: 'Student Progress', path: '/activities/student-progress.html', kind: 'tracking', available: true, conceptIds: [], supportedModes: [] },
  { id: 'ufli-blending-board', label: 'UFLI Blending Board', path: '/activities/ufli-blending-board.html', kind: 'external', available: true, conceptIds: ['l1-short-vowels', 'l1-digraphs', 'l1-blends'], supportedModes: ['screen'] },
];

function freezeDescriptor(item) {
  const conceptIds = [...new Set(item.conceptIds)].filter(id => ASSESSMENT_ITEM_IDS.has(id));
  return Object.freeze({ ...item, conceptIds: Object.freeze(conceptIds), supportedModes: Object.freeze([...item.supportedModes]) });
}

export const ACTIVITY_REGISTRY = Object.freeze(descriptors.map(freezeDescriptor));
export const PRACTICE_ACTIVITIES = Object.freeze(ACTIVITY_REGISTRY.filter(item => item.kind === 'practice' || item.kind === 'reading'));
export const AVAILABLE_PRACTICE_ACTIVITIES = Object.freeze(PRACTICE_ACTIVITIES.filter(item => item.available));
const BY_ID = new Map(ACTIVITY_REGISTRY.map(item => [item.id, item]));

export function getActivity(id) {
  return typeof id === 'string' ? BY_ID.get(id) ?? null : null;
}

export function getActivitiesForConcept(conceptId) {
  if (typeof conceptId !== 'string' || !ASSESSMENT_ITEM_IDS.has(conceptId)) return [];
  return PRACTICE_ACTIVITIES.filter(item => item.conceptIds.includes(conceptId));
}
