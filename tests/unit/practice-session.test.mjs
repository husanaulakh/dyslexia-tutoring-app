import test from 'node:test';
import assert from 'node:assert/strict';
import { createPracticeSession } from '../../assets/js/practice-session.mjs';
import { createOutcomeCounts, normalizeOutcome, recordOutcome } from '../../assets/js/practice-outcomes.mjs';

function fixture() {
  let current = { studentId: 'L01', activity: 'reading-words', completedItems: 0, totalItems: 3, durationSeconds: 0 };
  let blocked = false;
  const writes = [];
  const session = createPracticeSession({ summary: () => current, record: value => {
    if (blocked) return { ok: false };
    writes.push(value);
    return { ok: true };
  } });
  return { session, writes, progress: value => { current = { ...current, ...value }; }, block: value => { blocked = value; } };
}

test('partial saves update a stable practice ID while repeated save and duration changes do not duplicate writes', () => {
  const f = fixture();
  assert.equal(f.session.flush(), true);
  assert.equal(f.writes.length, 0);
  f.progress({ completedItems: 1 });
  assert.equal(f.session.save(), true);
  const id = f.writes[0].id;
  f.progress({ durationSeconds: 2 });
  assert.equal(f.session.save(), true);
  assert.equal(f.writes.length, 1);
  f.progress({ completedItems: 2 });
  assert.equal(f.session.save(), true);
  assert.equal(f.writes[1].id, id);
  f.session.reset();
  assert.equal(f.session.save(), true);
  assert.notEqual(f.writes[2].id, id);
});

test('failed navigation saves cancel the transition and can be retried without losing aggregate progress', () => {
  const f = fixture();
  const target = new EventTarget();
  const cleanup = f.session.bind(target);
  f.progress({ completedItems: 1 });
  f.block(true);
  assert.equal(target.dispatchEvent(new Event('bright-steps:before-lesson-navigation', { cancelable: true })), false);
  assert.equal(f.writes.length, 0);
  f.block(false);
  assert.equal(target.dispatchEvent(new Event('bright-steps:before-lesson-navigation', { cancelable: true })), true);
  assert.equal(f.writes.length, 1);
  target.dispatchEvent(new Event('pagehide'));
  assert.equal(f.writes.length, 1);
  cleanup();
});

test('shared outcome helpers reject invalid counts and preserve immutable first/retry aggregation', () => {
  const counts = createOutcomeCounts();
  assert.deepEqual(recordOutcome(counts, 'supported'), { independent: 0, supported: 1, revisit: 0 });
  assert.deepEqual(counts, { independent: 0, supported: 0, revisit: 0 });
  for (const value of ['<script>', '__proto__', '', undefined]) {
    assert.equal(normalizeOutcome(value), '');
    assert.equal(recordOutcome(counts, value), counts);
  }
  const bad = { independent: -1 };
  assert.equal(recordOutcome(bad, 'independent'), bad);
});


test('failed aggregates survive reload without saving response text or changing the learner', () => {
  const pending = new Map();
  const local = new Map();
  const storage = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) });
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = storage(local);
  local.set('bright-steps-student-progress', JSON.stringify({ schemaVersion: 3, students: [{ id: 'L01', name: 'L01' }, { id: 'L02', name: 'L02' }], selectedStudentId: 'L02', sessions: [], assessment: [] }));
  try {
    const target = new EventTarget();
    target.sessionStorage = storage(pending);
    const session = createPracticeSession({ summary: () => ({ studentId: 'L01', activity: 'reading-words', completedItems: 1, totalItems: 2, answer: 'transient answer' }), record: () => ({ ok: false }) });
    const cleanup = session.bind(target);
    assert.equal(session.save(), false);
    const raw = pending.get('bright-steps-pending-outcomes');
    assert.ok(raw);
    assert.equal(raw.includes('transient answer'), false);
    assert.equal(target.dispatchEvent(new Event('beforeunload', { cancelable: true })), false);
    cleanup();
    const reloaded = createPracticeSession({ summary: () => null, record: () => ({ ok: true }) });
    const cleanupReload = reloaded.bind(target);
    const sessions = JSON.parse(local.get('bright-steps-student-progress')).sessions;
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].studentId, 'L01');
    assert.equal(pending.has('bright-steps-pending-outcomes'), false);
    cleanupReload();
  } finally { globalThis.localStorage = originalStorage; }
});
