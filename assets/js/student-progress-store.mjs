import { ASSESSMENT_ITEM_IDS } from '../../data/assessment-scope-sequence.mjs';

/**
 * Local-only student profiles and short activity summaries.
 *
 * Data lives in one versioned localStorage record, so it remains available in
 * the same browser profile and origin after static site deployments. Nothing
 * in this module makes a network request. Session summaries intentionally
 * accept only counts and labels; learner work text is never persisted.
 */

// Keep the storage key stable as schemaVersion changes; migrations read the
// versioned payload in place across app deployments.
export const STUDENT_STORAGE_KEY = 'bright-steps-student-progress';
export const STUDENT_SCHEMA_VERSION = 3;
export const MAX_STUDENTS = 30;
export const MAX_SESSIONS = 500;
export const MAX_SESSIONS_PER_STUDENT = 100;
export const MAX_RECENT_SESSIONS = 12;

const DEFAULT_DATA = () => ({
  schemaVersion: STUDENT_SCHEMA_VERSION,
  students: [],
  selectedStudentId: '',
  sessions: [],
  assessment: [],
});

function storageOrNull(storage) {
  if (storage !== undefined) return storage;
  try { return globalThis.localStorage ?? null; }
  catch { return null; }
}

function safeText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

/** Clean a display name, retaining ordinary Unicode names and initials. */
export function normalizeStudentName(value) {
  const text = safeText(value, 80).replace(/\s+/g, ' ');
  if (!text || text.length > 40 || /[<>]/.test(text)) return '';
  if (!/^[\p{L}\p{M}\p{N} .’'\-]+$/u.test(text)) return '';
  return text;
}

function makeId(prefix) {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') return `${prefix}-${globalThis.crypto.randomUUID()}`;
  } catch { /* Use the portable fallback below. */ }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeId(value, prefix, fallbackIndex = 0) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (/^[a-zA-Z0-9_-]{1,100}$/.test(candidate)) return candidate;
  return `${prefix}-${fallbackIndex + 1}`;
}

/** Validate and normalize one profile from stored or caller-provided data. */
export function normalizeStudentProfile(record, index = 0) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const name = normalizeStudentName(record.name ?? record.displayName);
  if (!name) return null;
  return { id: normalizeId(record.id, 'student', index), name };
}

function normalizeActivity(value) {
  const activity = safeText(value, 60).toLowerCase();
  return /^[a-z0-9][a-z0-9 _-]*$/.test(activity) ? activity : '';
}

function normalizeCount(value) {
  if (!Number.isFinite(value)) return null;
  const count = Math.floor(value);
  return count >= 0 && count <= 100000 ? count : null;
}

function normalizeSession(record, students, index) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const studentId = typeof record.studentId === 'string' ? record.studentId : '';
  if (!students.some(student => student.id === studentId)) return null;
  const activity = normalizeActivity(record.activity);
  const completedItems = normalizeCount(record.completedItems);
  const totalItems = normalizeCount(record.totalItems);
  if (!activity || completedItems === null || totalItems === null || completedItems > totalItems) return null;
  const listLabel = safeText(record.listLabel, 80).replace(/[<>]/g, '');
  const id = normalizeId(record.id, 'session', index);
  const completedAtCandidate = typeof record.completedAt === 'string' ? record.completedAt : '';
  const completedAt = Number.isFinite(Date.parse(completedAtCandidate))
    ? new Date(completedAtCandidate).toISOString()
    : new Date(0).toISOString();
  const session = { id, studentId, activity, listLabel, completedItems, totalItems, completedAt };
  if (Array.isArray(record.conceptIds)) {
    session.conceptIds = [...new Set(record.conceptIds.filter(id => typeof id === 'string' && ASSESSMENT_ITEM_IDS.has(id)))].slice(0, 100);
  }
  let ratedItems = 0;
  for (const field of ['outcomeCounts', 'retryOutcomeCounts']) {
    if (record[field] === undefined) continue;
    if (!record[field] || typeof record[field] !== 'object' || Array.isArray(record[field])) return null;
    const counts = {};
    for (const name of ['independent', 'supported', 'revisit']) {
      const count = normalizeCount(record[field][name]);
      if (count === null || count > completedItems) return null;
      counts[name] = count;
    }
    ratedItems += counts.independent + counts.supported + counts.revisit;
    if (ratedItems > completedItems) return null;
    session[field] = counts;
  }
  if (Number.isFinite(record.accuracy) && record.accuracy >= 0 && record.accuracy <= 100) {
    session.accuracy = Math.round(record.accuracy * 10) / 10;
  }
  if (Number.isFinite(record.durationSeconds) && record.durationSeconds >= 0 && record.durationSeconds <= 604800) {
    session.durationSeconds = Math.round(record.durationSeconds);
  }
  return session;
}

const ASSESSMENT_STATUSES = new Set(['introduced', 'developing', 'secure', 'revisit']);

function normalizeAssessmentRecord(record, students) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const studentId = typeof record.studentId === 'string' ? record.studentId : '';
  const itemId = typeof record.itemId === 'string' ? record.itemId : '';
  const status = typeof record.status === 'string' ? record.status : '';
  if (!students.some(student => student.id === studentId) || !ASSESSMENT_ITEM_IDS.has(itemId) || !ASSESSMENT_STATUSES.has(status)) return null;
  const candidate = typeof record.updatedAt === 'string' ? record.updatedAt : '';
  const updatedAt = Number.isFinite(Date.parse(candidate)) ? new Date(candidate).toISOString() : new Date(0).toISOString();
  return { studentId, itemId, status, updatedAt };
}

function uniqueById(records) {
  const ids = new Set();
  return records.filter(record => {
    if (ids.has(record.id)) return false;
    ids.add(record.id);
    return true;
  });
}

/**
 * Migrate and validate parsed store data. Unversioned v0 data is accepted when
 * it contains `students`; invalid records are dropped and the selection falls
 * back to a valid profile. Extra/learner-work fields are never retained.
 */
export function migrateStudentData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_DATA();
  const version = value.schemaVersion ?? value.version ?? 0;
  if (version !== 0 && version !== 1 && version !== 2 && version !== STUDENT_SCHEMA_VERSION) return DEFAULT_DATA();

  const rawStudents = Array.isArray(value.students) ? value.students : Array.isArray(value.profiles) ? value.profiles : [];
  const students = uniqueById(rawStudents.slice(0, MAX_STUDENTS)
    .map(normalizeStudentProfile).filter(Boolean));
  const selectedCandidate = typeof value.selectedStudentId === 'string' ? value.selectedStudentId : '';
  const selectedStudentId = students.some(student => student.id === selectedCandidate)
    ? selectedCandidate
    : (students[0]?.id ?? '');
  const rawSessions = Array.isArray(value.sessions) ? value.sessions : Array.isArray(value.history) ? value.history : [];
  const sessions = uniqueById(rawSessions.map((session, index) => normalizeSession(session, students, index))
    .filter(Boolean))
    .slice(-MAX_SESSIONS);
  const assessment = Array.isArray(value.assessment)
    ? value.assessment.map(record => normalizeAssessmentRecord(record, students)).filter(Boolean).slice(-3000)
    : [];
  const uniqueAssessment = [];
  const assessmentKeys = new Set();
  for (const record of assessment) {
    const key = `${record.studentId}:${record.itemId}`;
    if (assessmentKeys.has(key)) continue;
    assessmentKeys.add(key);
    uniqueAssessment.push(record);
  }
  return { schemaVersion: STUDENT_SCHEMA_VERSION, students, selectedStudentId, sessions, assessment: uniqueAssessment };
}

/** Load and migrate the persistent store; `error` indicates unavailable or invalid storage. */
export function loadStudentData(storage) {
  const target = storageOrNull(storage);
  if (!target) return { data: DEFAULT_DATA(), error: 'unavailable' };
  try {
    const raw = target.getItem(STUDENT_STORAGE_KEY);
    if (raw === null) return { data: DEFAULT_DATA(), error: null };
    const data = migrateStudentData(JSON.parse(raw));
    if (JSON.stringify(data) !== raw) {
      try { target.setItem(STUDENT_STORAGE_KEY, JSON.stringify(data)); }
      catch { /* Valid in-memory data remains usable when migration cannot persist. */ }
    }
    return { data, error: null };
  } catch {
    return { data: DEFAULT_DATA(), error: 'unavailable' };
  }
}

/** Persist only the supported versioned shape. Returns false on storage failure. */
export function saveStudentData(value, storage) {
  const target = storageOrNull(storage);
  if (!target) return false;
  try {
    target.setItem(STUDENT_STORAGE_KEY, JSON.stringify(migrateStudentData(value)));
    return true;
  } catch { return false; }
}

/** Return a copy of the currently selected profile, or null when none exists. */
export function getSelectedStudent(storage) {
  const { data } = loadStudentData(storage);
  const student = data.students.find(item => item.id === data.selectedStudentId);
  return student ? { ...student } : null;
}

/** Change the globally selected profile. Returns false for unknown IDs or storage errors. */
export function setSelectedStudent(studentId, storage) {
  const { data } = loadStudentData(storage);
  if (!data.students.some(student => student.id === studentId)) return false;
  data.selectedStudentId = studentId;
  return saveStudentData(data, storage);
}

/** Add a profile and select it. Result includes an error code suitable for UI messaging. */
export function addStudentProfile(name, storage) {
  const normalizedName = normalizeStudentName(name);
  if (!normalizedName) return { ok: false, error: 'invalid-name', student: null };
  const { data } = loadStudentData(storage);
  if (data.students.length >= MAX_STUDENTS) return { ok: false, error: 'limit', student: null };
  const student = { id: makeId('student'), name: normalizedName };
  data.students.push(student);
  data.selectedStudentId = student.id;
  if (!saveStudentData(data, storage)) return { ok: false, error: 'storage', student: null };
  return { ok: true, error: null, student: { ...student } };
}

/** Record a bounded activity summary for the selected (or explicitly supplied) profile. */
export function recordStudentSession(summary, storage) {
  const { data } = loadStudentData(storage);
  const studentId = typeof summary?.studentId === 'string' ? summary.studentId : data.selectedStudentId;
  if (!data.students.some(student => student.id === studentId)) return { ok: false, error: 'no-student', session: null };
  const session = normalizeSession({
    ...summary,
    id: makeId('session'),
    studentId,
    completedAt: new Date().toISOString(),
  }, data.students, data.sessions.length);
  if (!session) return { ok: false, error: 'invalid-session', session: null };
  data.sessions.push(session);
  const perStudentCount = data.sessions.reduce((count, item) => count + (item.studentId === studentId ? 1 : 0), 0);
  if (perStudentCount > MAX_SESSIONS_PER_STUDENT) {
    const excess = perStudentCount - MAX_SESSIONS_PER_STUDENT;
    let removed = 0;
    data.sessions = data.sessions.filter(item => {
      if (item.studentId === studentId && removed < excess) { removed += 1; return false; }
      return true;
    });
  }
  data.sessions = data.sessions.slice(-MAX_SESSIONS);
  if (!saveStudentData(data, storage)) return { ok: false, error: 'storage', session: null };
  return { ok: true, error: null, session: { ...session } };
}

/** Return recent summaries for one profile; no learner words or paragraph text are included. */
export function getRecentStudentSessions(studentId, limit = MAX_RECENT_SESSIONS, storage) {
  const { data } = loadStudentData(storage);
  const boundedLimit = Number.isFinite(limit) ? Math.max(0, Math.min(MAX_RECENT_SESSIONS, Math.floor(limit))) : MAX_RECENT_SESSIONS;
  if (boundedLimit === 0) return [];
  return data.sessions.filter(session => session.studentId === studentId).slice(-boundedLimit).reverse()
    .map(session => ({ ...session }));
}

/** Read the learner's assessed concepts as a map from scope item ID to record. */
export function getStudentAssessmentProgress(studentId, storage) {
  const { data } = loadStudentData(storage);
  return Object.fromEntries(data.assessment
    .filter(record => record.studentId === studentId)
    .map(record => [record.itemId, { ...record }]));
}

/** Save one learner's scope status; an empty status clears the item back to not assessed. */
export function setStudentAssessmentStatus(studentId, itemId, status, storage) {
  if (typeof studentId !== 'string' || typeof itemId !== 'string' || !ASSESSMENT_ITEM_IDS.has(itemId)) {
    return { ok: false, error: 'invalid-item' };
  }
  if (status !== '' && !ASSESSMENT_STATUSES.has(status)) return { ok: false, error: 'invalid-status' };
  const { data } = loadStudentData(storage);
  if (!data.students.some(student => student.id === studentId)) return { ok: false, error: 'no-student' };
  data.assessment = data.assessment.filter(record => !(record.studentId === studentId && record.itemId === itemId));
  if (status) data.assessment.push({ studentId, itemId, status, updatedAt: new Date().toISOString() });
  if (!saveStudentData(data, storage)) return { ok: false, error: 'storage' };
  return { ok: true, error: null };
}
