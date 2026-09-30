import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_STUDENTS,
  STUDENT_SCHEMA_VERSION,
  STUDENT_STORAGE_KEY,
  addStudentProfile,
  getRecentStudentSessions,
  getSelectedStudent,
  loadStudentData,
  migrateStudentData,
  normalizeStudentName,
  normalizeStudentProfile,
  normalizeSessionSummary,
  recordStudentSession,
  getStudentAssessmentProgress,
  saveStudentData,
  setStudentAssessmentStatus,
  setSelectedStudent,
} from '../../assets/js/student-progress-store.mjs';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

class BrokenStorage {
  getItem() { throw new Error('blocked'); }
  setItem() { throw new Error('blocked'); }
}

class ReadBrokenStorage extends MemoryStorage {
  writes = 0;
  getItem() { throw new Error('read blocked'); }
  setItem(key, value) { this.writes += 1; super.setItem(key, value); }
}

test('unversioned legacy data migrates to the current schema and validates records', () => {
  const migrated = migrateStudentData({
    students: [
      { id: 's1', name: '  Maya  ' },
      { id: 's2', name: '<script>alert(1)</script>' },
      null,
      { id: 's1', name: 'Duplicate' },
    ],
    selectedStudentId: 'missing',
    sessions: [
      { id: 'h1', studentId: 's1', activity: 'reading-words', listLabel: 'List 1', completedItems: 5, totalItems: 8, words: ['tap'] },
      { id: 'h2', studentId: 's1', activity: 'unsafe <script>', completedItems: 1, totalItems: 1 },
      { id: 'h3', studentId: 'gone', activity: 'paragraph-reading', completedItems: 1, totalItems: 1 },
    ],
  });
  assert.equal(migrated.schemaVersion, STUDENT_SCHEMA_VERSION);
  assert.deepEqual(migrated.students, [{ id: 's1', name: 'Maya' }]);
  assert.equal(migrated.selectedStudentId, 's1');
  assert.equal(migrated.sessions.length, 1);
  assert.deepEqual(Object.keys(migrated.sessions[0]).sort(), [
    'activity', 'completedAt', 'completedItems', 'id', 'listLabel', 'studentId', 'totalItems',
  ]);
  assert.deepEqual(migrateStudentData({ schemaVersion: 99, students: [{ id: 'x', name: 'X' }] }), {
    schemaVersion: STUDENT_SCHEMA_VERSION, students: [], selectedStudentId: '', sessions: [], assessment: [],
  });
});

test('version 1 student data migrates without losing session history', () => {
  const migrated = migrateStudentData({
    schemaVersion: 1,
    students: [{ id: 's1', name: 'Maya' }],
    selectedStudentId: 's1',
    sessions: [{ id: 'h1', studentId: 's1', activity: 'reading-words', completedItems: 2, totalItems: 3 }],
  });
  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.students[0].name, 'Maya');
  assert.equal(migrated.sessions.length, 1);
  assert.deepEqual(migrated.assessment, []);
});

test('loadStudentData persists the migrated versioned schema under a stable key', () => {
  const storage = new MemoryStorage();
  storage.setItem(STUDENT_STORAGE_KEY, JSON.stringify({ version: 0, profiles: [{ id: 'a', name: 'Lee' }] }));
  const result = loadStudentData(storage);
  assert.equal(result.error, null);
  assert.equal(result.data.schemaVersion, STUDENT_SCHEMA_VERSION);
  assert.equal(result.data.selectedStudentId, 'a');
  assert.equal(JSON.parse(storage.getItem(STUDENT_STORAGE_KEY)).schemaVersion, STUDENT_SCHEMA_VERSION);
  assert.equal(loadStudentData(new BrokenStorage()).error, 'unavailable');
});

test('future, invalid, and unreadable store payloads are preserved and mutations fail closed', () => {
  const future = new MemoryStorage();
  const futureRaw = JSON.stringify({ schemaVersion: 4, students: [{ id: 's4', name: 'Future learner' }], privateFutureField: ['keep'] });
  future.setItem(STUDENT_STORAGE_KEY, futureRaw);
  assert.equal(loadStudentData(future).error, 'future-version');
  assert.equal(future.getItem(STUDENT_STORAGE_KEY), futureRaw);
  assert.equal(addStudentProfile('New learner', future).error, 'future-version');
  assert.equal(recordStudentSession({ studentId: 's4', activity: 'lesson', completedItems: 1, totalItems: 1 }, future).error, 'future-version');
  assert.equal(setStudentAssessmentStatus('s4', 'l1-short-vowels', 'secure', future).error, 'future-version');
  assert.equal(setSelectedStudent('s4', future), false);
  assert.equal(saveStudentData({ schemaVersion: 4, students: [] }, future), false);
  assert.equal(future.getItem(STUDENT_STORAGE_KEY), futureRaw);

  const malformed = new MemoryStorage();
  malformed.setItem(STUDENT_STORAGE_KEY, '{truncated');
  assert.equal(loadStudentData(malformed).error, 'invalid-data');
  assert.equal(addStudentProfile('New learner', malformed).error, 'invalid-data');
  assert.equal(setStudentAssessmentStatus('missing', 'l1-short-vowels', 'secure', malformed).error, 'invalid-data');
  assert.equal(malformed.getItem(STUDENT_STORAGE_KEY), '{truncated');

  const unreadable = new ReadBrokenStorage();
  assert.equal(addStudentProfile('New learner', unreadable).error, 'unavailable');
  assert.equal(recordStudentSession({ activity: 'lesson', completedItems: 1, totalItems: 1 }, unreadable).error, 'unavailable');
  assert.equal(setStudentAssessmentStatus('s1', 'l1-short-vowels', 'secure', unreadable).error, 'unavailable');
  assert.equal(setSelectedStudent('s1', unreadable), false);
  assert.equal(unreadable.writes, 0);
});

test('version 2 sessions migrate to schema 3 and retain only validated concepts and aggregate outcomes', () => {
  const migrated = migrateStudentData({
    schemaVersion: 2,
    students: [{ id: 's1', name: 'S1' }], selectedStudentId: 's1',
    sessions: [{ id: 'h1', studentId: 's1', activity: 'sound-boxes', completedItems: 2, totalItems: 3,
      conceptIds: ['l1-short-vowels', '<script>'], outcomeCounts: { independent: 1, supported: 1, revisit: 0 }, responseText: 'private work' }],
  });
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.sessions[0].conceptIds, ['l1-short-vowels']);
  assert.deepEqual(migrated.sessions[0].outcomeCounts, { independent: 1, supported: 1, revisit: 0 });
  assert.equal('responseText' in migrated.sessions[0], false);
  assert.equal(migrateStudentData({ schemaVersion: 2, students: [{ id: 's1', name: 'S1' }], sessions: [{ id: 'h1', studentId: 's1', activity: 'x', completedItems: 3, totalItems: 3, outcomeCounts: { independent: 2, supported: 2, revisit: 0 } }] }).sessions.length, 0);
});

test('names and profiles are normalized and reject markup and unsupported values', () => {
  assert.equal(normalizeStudentName('  Zoë   D’Arcy  '), 'Zoë D’Arcy');
  assert.equal(normalizeStudentName('A. B'), 'A. B');
  assert.equal(normalizeStudentName('<img src=x>'), '');
  assert.equal(normalizeStudentName(''), '');
  assert.equal(normalizeStudentName('x'.repeat(41)), '');
  assert.deepEqual(normalizeStudentProfile({ id: '<x>', name: 'Sam' }, 2), { id: 'student-3', name: 'Sam' });
  assert.equal(normalizeStudentProfile({ id: 'x', name: '<script>' }), null);
  assert.equal(addStudentProfile('<svg/onload=1>', new MemoryStorage()).error, 'invalid-name');
});

test('adding and selecting students persists one global selection across store reads', () => {
  const storage = new MemoryStorage();
  const first = addStudentProfile('Student A', storage);
  const second = addStudentProfile('Student B', storage);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(getSelectedStudent(storage).id, second.student.id);
  assert.equal(setSelectedStudent(first.student.id, storage), true);
  assert.equal(getSelectedStudent(storage).name, 'Student A');
  assert.equal(setSelectedStudent('unknown', storage), false);
  assert.equal(addStudentProfile('No save', new BrokenStorage()).error, 'unavailable');

  for (let i = 2; i < MAX_STUDENTS; i += 1) assert.equal(addStudentProfile(`Student ${i}`, storage).ok, true);
  assert.equal(addStudentProfile('Too many', storage).error, 'limit');
});

test('sessions are bounded summaries and histories remain isolated by student', () => {
  const storage = new MemoryStorage();
  const a = addStudentProfile('A', storage).student;
  const b = addStudentProfile('B', storage).student;
  const saved = recordStudentSession({
    studentId: a.id,
    activity: 'Reading Words',
    listLabel: 'List 1',
    completedItems: 10,
    totalItems: 12,
    accuracy: 83.333,
    durationSeconds: 90.6,
    wordText: 'tap duck rub',
    paragraph: 'private learner work',
  }, storage);
  assert.equal(saved.ok, true);
  assert.equal(saved.session.activity, 'reading words');
  assert.equal(saved.session.accuracy, 83.3);
  assert.equal(saved.session.durationSeconds, 91);
  assert.equal('wordText' in saved.session, false);
  assert.equal('paragraph' in saved.session, false);
  assert.equal(recordStudentSession({ activity: 'reading-words', completedItems: 2, totalItems: 1 }, storage).error, 'invalid-session');
  assert.equal(getRecentStudentSessions(a.id, 5, storage).length, 1);
  assert.equal(getRecentStudentSessions(b.id, 5, storage).length, 0);
  assert.equal(getRecentStudentSessions(a.id, 0, storage).length, 0);
  assert.equal(recordStudentSession({ activity: 'reading-words', completedItems: 1, totalItems: 1 }, new BrokenStorage()).error, 'unavailable');
});

test('stable session IDs upsert same learner and activity, but reject unsafe or mismatched reuse', () => {
  const storage = new MemoryStorage();
  const a = addStudentProfile('A', storage).student;
  const b = addStudentProfile('B', storage).student;
  const initial = recordStudentSession({ id: 'lesson-checkpoint-1', studentId: a.id, activity: 'lesson', completedItems: 1, totalItems: 3 }, storage);
  assert.equal(initial.ok, true);
  const update = recordStudentSession({ id: 'lesson-checkpoint-1', studentId: a.id, activity: 'lesson', completedItems: 2, totalItems: 3 }, storage);
  assert.equal(update.ok, true);
  assert.equal(update.session.id, 'lesson-checkpoint-1');
  assert.equal(update.session.completedItems, 2);
  assert.equal(getRecentStudentSessions(a.id, 20, storage).filter(item => item.id === 'lesson-checkpoint-1').length, 1);
  assert.equal(recordStudentSession({ id: 'lesson-checkpoint-1', studentId: b.id, activity: 'lesson', completedItems: 1, totalItems: 3 }, storage).error, 'id-conflict');
  assert.equal(recordStudentSession({ id: 'lesson-checkpoint-1', studentId: a.id, activity: 'reading-words', completedItems: 1, totalItems: 3 }, storage).error, 'id-conflict');
  assert.equal(recordStudentSession({ id: '<script>', studentId: a.id, activity: 'lesson', completedItems: 1, totalItems: 3 }, storage).error, 'invalid-id');
  assert.equal(recordStudentSession({ id: 'x'.repeat(101), studentId: a.id, activity: 'lesson', completedItems: 1, totalItems: 3 }, storage).error, 'invalid-id');
  assert.equal(getRecentStudentSessions(b.id, 20, storage).length, 0);
});

test('stable session upserts ignore decreasing completion counts without changing persisted data', () => {
  const storage = new MemoryStorage();
  const learner = addStudentProfile('L01', storage).student;
  assert.equal(recordStudentSession({ id: 'lesson-run-1', studentId: learner.id, activity: 'lesson', completedItems: 2, totalItems: 4 }, storage).ok, true);
  const stale = recordStudentSession({ id: 'lesson-run-1', studentId: learner.id, activity: 'lesson', completedItems: 1, totalItems: 4 }, storage);
  assert.equal(stale.ok, true);
  assert.equal(stale.session.completedItems, 2);
  assert.equal(getRecentStudentSessions(learner.id, 10, storage)[0].completedItems, 2);
});

test('recovery summaries validate pinned identity and retain only aggregate fields', () => {
  const safe = normalizeSessionSummary({
    id: 'lesson-run-safe', studentId: 'student_1', activity: 'lesson', completedItems: 1,
    totalItems: 2, completedAt: '2026-04-03T12:30:00.000Z', learnerResponse: 'private response',
  });
  assert.deepEqual(safe, {
    id: 'lesson-run-safe', studentId: 'student_1', activity: 'lesson', listLabel: '',
    completedItems: 1, totalItems: 2, completedAt: '2026-04-03T12:30:00.000Z',
  });
  assert.equal(normalizeSessionSummary({ id: '../lesson', studentId: 'student_1', activity: 'lesson', completedItems: 0, totalItems: 1 }), null);
  assert.equal(normalizeSessionSummary({ id: 'lesson-1', studentId: '<script>', activity: 'lesson', completedItems: 0, totalItems: 1 }), null);
  assert.equal(normalizeSessionSummary({ id: 'lesson-1', studentId: 'student_1', activity: 'lesson', completedItems: 2, totalItems: 1 }), null);
});

test('scope assessment is validated, persisted per student, updated, and reset independently', () => {
  const storage = new MemoryStorage();
  const a = addStudentProfile('Student A', storage).student;
  const b = addStudentProfile('Student B', storage).student;
  assert.equal(setStudentAssessmentStatus(a.id, 'l1-short-vowels', 'developing', storage).ok, true);
  assert.equal(setStudentAssessmentStatus(a.id, 'l1-short-vowels', 'secure', storage).ok, true);
  assert.equal(setStudentAssessmentStatus(b.id, 'l1-short-vowels', 'introduced', storage).ok, true);
  assert.equal(setStudentAssessmentStatus(a.id, 'l1-short-vowels', '', storage).ok, true);
  assert.equal(getStudentAssessmentProgress(a.id, storage)['l1-short-vowels'], undefined);
  assert.equal(getStudentAssessmentProgress(b.id, storage)['l1-short-vowels'].status, 'introduced');
  assert.equal(setStudentAssessmentStatus(a.id, 'not-a-real-concept', 'secure', storage).error, 'invalid-item');
  assert.equal(setStudentAssessmentStatus(a.id, 'l1-short-vowels', '<script>', storage).error, 'invalid-status');
  assert.equal(setStudentAssessmentStatus('missing-student', 'l1-short-vowels', 'secure', storage).error, 'no-student');
  const migrated = migrateStudentData(JSON.parse(storage.getItem(STUDENT_STORAGE_KEY)));
  assert.equal(migrated.assessment.length, 1);
  assert.equal(migrated.assessment[0].studentId, b.id);
});


test('first response and retry outcomes remain separate, bounded aggregates', () => {
  const data = migrateStudentData({ schemaVersion: 3, students: [{ id: 's-1', name: 'L01' }], sessions: [
    { id: 'separate', studentId: 's-1', activity: 'reading-words', completedItems: 3, totalItems: 3,
      outcomeCounts: { independent: 1, supported: 1, revisit: 0 },
      retryOutcomeCounts: { independent: 1, supported: 0, revisit: 0 }, learnerResponses: ['private'] },
    { id: 'inflated', studentId: 's-1', activity: 'reading-words', completedItems: 1, totalItems: 5,
      outcomeCounts: { independent: 1, supported: 1, revisit: 0 } },
  ] });
  assert.equal(data.sessions.length, 1);
  assert.deepEqual(data.sessions[0].retryOutcomeCounts, { independent: 1, supported: 0, revisit: 0 });
  assert.equal(Object.hasOwn(data.sessions[0], 'learnerResponses'), false);
});

test('assessment migration keeps the latest duplicate status and resolves timestamp ties with the last row', () => {
  const migrated = migrateStudentData({ schemaVersion: 2, students: [{ id: 's1', name: 'Learner' }], assessment: [
    { studentId: 's1', itemId: 'l1-short-vowels', status: 'secure', updatedAt: '2025-01-01T00:00:00.000Z' },
    { studentId: 's1', itemId: 'l1-short-vowels', status: 'developing', updatedAt: '2026-01-01T00:00:00.000Z' },
    { studentId: 's1', itemId: 'l1-digraphs', status: 'introduced', updatedAt: '2026-03-01T00:00:00.000Z' },
    { studentId: 's1', itemId: 'l1-digraphs', status: 'secure', updatedAt: '2026-03-01T00:00:00.000Z' },
  ] });
  assert.equal(migrated.assessment.find(item => item.itemId === 'l1-short-vowels').status, 'developing');
  assert.equal(migrated.assessment.find(item => item.itemId === 'l1-digraphs').status, 'secure');
});
