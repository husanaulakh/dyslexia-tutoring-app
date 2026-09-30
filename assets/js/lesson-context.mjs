import { PRACTICE_ACTIVITIES, getActivity } from '../../data/activity-registry.mjs';
import { ASSESSMENT_ITEM_IDS } from '../../data/assessment-scope-sequence.mjs';

export const LESSON_TEMPLATE_KEY = 'bright-steps-lesson-templates';
export const ACTIVE_LESSON_KEY = 'bright-steps-active-lesson';
export const MAX_LESSON_TEMPLATES = 40;
export const MAX_LESSON_STEPS = 30;

const ACTIVITY_IDS = new Set(PRACTICE_ACTIVITIES.map(activity => activity.id));
const SETTINGS_KEYS = Object.freeze({
  'whats-missing-cards': ['mode', 'listId', 'cardSetId', 'cardIds', 'count', 'preset'],
  'blending-board': ['mode', 'listId', 'wordSetId', 'wordIds', 'word', 'count', 'preset', 'tileCount'],
  'trace-copy-cover-close': ['mode', 'listId', 'wordSetId', 'wordIds', 'word', 'count', 'preset', 'paperMode'],
  'visual-drill-cards': ['mode', 'listId', 'cardSetId', 'cardIds', 'count', 'preset'],
  'reading-words': ['mode', 'listId', 'wordIds', 'word', 'count', 'preset', 'paperMode'],
  'paragraph-reading': ['mode', 'listId', 'passageId', 'count', 'preset', 'questionMode', 'rereadMode'],
  'sound-boxes': ['mode', 'listId', 'wordSetId', 'wordIds', 'words', 'phonemeCounts', 'word', 'count', 'preset', 'counterMode'],
  'auditory-dictation': ['mode', 'listId', 'itemSetId', 'itemIds', 'word', 'count', 'preset', 'paperMode'],
  'word-workshop': ['mode', 'listId', 'workshop', 'itemSetId', 'itemIds', 'word', 'count', 'preset', 'paperMode'],
});

function text(value, max = 80) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/[<>]/g, '').trim().slice(0, max);
}

function safeId(value, fallback) {
  const id = typeof value === 'string' ? value.trim() : '';
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(id) ? id : fallback;
}

function createRunId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') return `run-${globalThis.crypto.randomUUID()}`;
  } catch { /* Fall back to a bounded, locally generated identifier. */ }
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function storageOrNull(storage, kind) {
  if (storage !== undefined) return storage;
  try { return globalThis[kind] ?? null; } catch { return null; }
}

function allowedSettings(activityId, settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
  const allowed = new Set(SETTINGS_KEYS[activityId] ?? []);
  const result = {};
  for (const [key, value] of Object.entries(settings)) {
    if (!allowed.has(key)) continue;
    if (typeof value === 'boolean') result[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = Math.max(0, Math.min(1000, Math.floor(value)));
    else if (typeof value === 'string') result[key] = text(value, 100);
    else if (Array.isArray(value)) {
      result[key] = value.slice(0, 100).map(item => key === 'phonemeCounts'
        ? (Number.isInteger(item) && item >= 2 && item <= 6 ? item : null)
        : text(item, 80)).filter(item => item !== null && item !== '');
    }
  }
  return result;
}

function normalizeConceptIds(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter(id => typeof id === 'string' && ASSESSMENT_ITEM_IDS.has(id)))].slice(0, 100);
}

function normalizeStep(step, index) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) return null;
  const activityId = typeof step.activityId === 'string' ? step.activityId : '';
  if (!ACTIVITY_IDS.has(activityId)) return null;
  const activity = getActivity(activityId);
  const responseMode = step.responseMode === 'paper' ? 'paper' : step.responseMode === 'screen' ? 'screen' : '';
  if (!responseMode || !activity.supportedModes.includes(responseMode)) return null;
  return {
    id: safeId(step.id, `step-${index + 1}`),
    activityId,
    responseMode,
    settings: allowedSettings(activityId, step.settings),
  };
}

/** Normalize untrusted template data to the small, supported local schema. */
export function normalizeLessonTemplate(value, index = 0) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const name = text(value.name, 60);
  if (!name) return null;
  const rawSteps = Array.isArray(value.steps) ? value.steps.slice(0, MAX_LESSON_STEPS) : [];
  const steps = rawSteps.map(normalizeStep).filter(Boolean);
  if (!steps.length) return null;
  const ids = new Set();
  for (const step of steps) {
    if (ids.has(step.id)) {
      const base = `step-${steps.indexOf(step) + 1}`;
      let suffix = 1;
      step.id = base;
      while (ids.has(step.id)) step.id = `${base}-${suffix++}`;
    }
    ids.add(step.id);
  }
  return {
    id: safeId(value.id, `lesson-${index + 1}`),
    name,
    conceptIds: normalizeConceptIds(value.conceptIds),
    steps,
  };
}

export function loadLessonTemplates(storage) {
  const target = storageOrNull(storage, 'localStorage');
  if (!target) return { templates: [], error: 'unavailable' };
  try {
    const raw = target.getItem(LESSON_TEMPLATE_KEY);
    if (raw === null) return { templates: [], error: null };
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : parsed?.templates;
    if (!Array.isArray(list)) return { templates: [], error: 'invalid-data' };
    const templates = list.slice(0, MAX_LESSON_TEMPLATES).map(normalizeLessonTemplate).filter(Boolean);
    return { templates, error: null };
  } catch { return { templates: [], error: 'unavailable' }; }
}

export function saveLessonTemplates(templates, storage) {
  const target = storageOrNull(storage, 'localStorage');
  if (!target) return { ok: false, error: 'unavailable' };
  if (!Array.isArray(templates)) return { ok: false, error: 'invalid-data' };
  const loaded = loadLessonTemplates(storage);
  if (loaded.error) return { ok: false, error: loaded.error };
  const normalized = templates.slice(0, MAX_LESSON_TEMPLATES).map(normalizeLessonTemplate).filter(Boolean);
  try {
    target.setItem(LESSON_TEMPLATE_KEY, JSON.stringify(normalized));
    return { ok: true, error: null, templates: normalized };
  } catch { return { ok: false, error: 'unavailable' }; }
}

function normalizeActive(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.version !== 1) return null;
  const template = normalizeLessonTemplate(value.template);
  const studentId = safeId(value.studentId, '');
  const index = Number.isInteger(value.index) ? value.index : -1;
  if (!template || !studentId || index < 0 || index >= template.steps.length) return null;
  const completedStepIds = Array.isArray(value.completedStepIds)
    ? [...new Set(value.completedStepIds.filter(id => template.steps.some(step => step.id === id)))].slice(0, MAX_LESSON_STEPS)
    : [];
  const startedAt = typeof value.startedAt === 'string' && Number.isFinite(Date.parse(value.startedAt))
    ? new Date(value.startedAt).toISOString() : new Date(0).toISOString();
  // Older active lessons had no run ID. Keep their previous deterministic
  // summary ID so a resumed legacy lesson still updates its existing record.
  const legacyRunId = `${Date.parse(startedAt).toString(36)}-${studentId.slice(0, 70)}`.slice(0, 80);
  const runId = safeId(value.runId, legacyRunId);
  return { version: 1, runId, template, studentId, index, completedStepIds, startedAt };
}

function readActive(storage) {
  const target = storageOrNull(storage, 'sessionStorage');
  if (!target) return { active: null, error: 'unavailable' };
  try {
    const raw = target.getItem(ACTIVE_LESSON_KEY);
    if (raw === null) return { active: null, error: null };
    const active = normalizeActive(JSON.parse(raw));
    return { active, error: active ? null : 'invalid-data' };
  } catch { return { active: null, error: 'unavailable' }; }
}

function writeActive(active, storage) {
  const target = storageOrNull(storage, 'sessionStorage');
  if (!target) return { ok: false, error: 'unavailable' };
  try {
    target.setItem(ACTIVE_LESSON_KEY, JSON.stringify(active));
    return { ok: true, error: null, active };
  } catch { return { ok: false, error: 'unavailable' }; }
}

export function loadActiveLesson(storage) {
  const result = readActive(storage);
  return { active: result.active, error: result.error };
}

export function startLesson(templateValue, studentId, storage) {
  const template = normalizeLessonTemplate(templateValue);
  const id = safeId(studentId, '');
  if (!template) return { ok: false, error: 'invalid-template' };
  if (!id) return { ok: false, error: 'invalid-student' };
  const existing = readActive(storage);
  if (existing.error) return { ok: false, error: existing.error };
  if (existing.active) return { ok: false, error: 'active-lesson' };
  return writeActive({ version: 1, runId: createRunId(), template, studentId: id, index: 0, completedStepIds: [], startedAt: new Date().toISOString() }, storage);
}

export function completeLessonStep(stepId, storage) {
  const { active, error } = readActive(storage);
  if (error) return { ok: false, error };
  if (!active) return { ok: false, error: 'no-active-lesson' };
  const current = active.template.steps[active.index];
  if (stepId !== current.id) return { ok: false, error: 'invalid-step' };
  active.completedStepIds = [...new Set([...active.completedStepIds, current.id])];
  if (active.index + 1 >= active.template.steps.length) {
    const result = writeActive(active, storage);
    return result.ok ? { ...result, complete: true } : result;
  }
  active.index += 1;
  const result = writeActive(active, storage);
  return result.ok ? { ...result, complete: false } : result;
}

export function moveLessonStep(index, storage) {
  const { active, error } = readActive(storage);
  if (error) return { ok: false, error };
  if (!active) return { ok: false, error: 'no-active-lesson' };
  if (!Number.isInteger(index) || index < 0 || index >= active.template.steps.length) return { ok: false, error: 'invalid-index' };
  active.index = index;
  return writeActive(active, storage);
}

export function endLesson(storage) {
  const target = storageOrNull(storage, 'sessionStorage');
  if (!target) return { ok: false, error: 'unavailable' };
  try { target.removeItem(ACTIVE_LESSON_KEY); return { ok: true, error: null }; }
  catch { return { ok: false, error: 'unavailable' }; }
}

export function getLessonActivityContext(activityId, storage) {
  const { active } = readActive(storage);
  if (!active) return null;
  const step = active.template.steps[active.index];
  if (step.activityId !== activityId) return null;
  return {
    studentId: active.studentId,
    conceptIds: [...active.template.conceptIds],
    responseMode: step.responseMode,
    settings: { ...step.settings },
    stepId: step.id,
  };
}
