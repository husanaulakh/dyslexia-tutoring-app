import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_LESSON_KEY, LESSON_TEMPLATE_KEY, completeLessonStep, endLesson, getLessonActivityContext,
  loadActiveLesson, loadLessonTemplates, moveLessonStep, normalizeLessonTemplate,
  saveLessonTemplates, startLesson,
} from '../../assets/js/lesson-context.mjs';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
class BrokenStorage { getItem() { throw Error('blocked'); } setItem() { throw Error('blocked'); } removeItem() { throw Error('blocked'); } }

const template = {
  id: 'lesson-one', name: 'Short vowel review', conceptIds: ['l1-short-vowels', 'unknown'],
  steps: [
    { id: 'first', activityId: 'sound-boxes', responseMode: 'paper', settings: { mode: 'counters', count: 6, words: ['cat'], injected: '<script>' } },
    { id: 'second', activityId: 'reading-words', responseMode: 'screen', settings: { listId: 'short-a', count: 4 } },
  ],
};

test('templates allow only known activities, supported modes, concepts, and bounded settings', () => {
  const clean = normalizeLessonTemplate(template);
  assert.deepEqual(clean.conceptIds, ['l1-short-vowels']);
  assert.deepEqual(clean.steps[0].settings, { mode: 'counters', count: 6, words: ['cat'] });
  assert.equal(normalizeLessonTemplate({ ...template, steps: [{ id: 'x', activityId: '<script>', responseMode: 'screen' }] }), null);
  assert.equal(normalizeLessonTemplate({ ...template, steps: [{ id: 'x', activityId: 'sound-boxes', responseMode: 'remote' }] }), null);
});

test('templates persist locally and active lesson reload pins learner and current activity context', () => {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  assert.equal(saveLessonTemplates([template], local).ok, true);
  assert.equal(local.getItem(LESSON_TEMPLATE_KEY) !== null, true);
  assert.equal(loadLessonTemplates(local).templates[0].steps.length, 2);
  assert.equal(startLesson(template, 'student-1', session).ok, true);
  const runId = loadActiveLesson(session).active.runId;
  assert.match(runId, /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/);
  assert.equal(session.getItem(ACTIVE_LESSON_KEY) !== null, true);
  assert.deepEqual(getLessonActivityContext('sound-boxes', session), {
    studentId: 'student-1', conceptIds: ['l1-short-vowels'], responseMode: 'paper',
    settings: { mode: 'counters', count: 6, words: ['cat'] }, stepId: 'first',
  });
  assert.equal(getLessonActivityContext('reading-words', session), null);
  assert.equal(loadActiveLesson(session).active.studentId, 'student-1');
  assert.equal(completeLessonStep('first', session).active.index, 1);
  assert.equal(loadActiveLesson(session).active.runId, runId);
  assert.equal(completeLessonStep('second', session).complete, true);
  assert.deepEqual(loadActiveLesson(session).active.completedStepIds, ['first', 'second']);
  assert.equal(moveLessonStep(2, session).error, 'invalid-index');
  assert.equal(moveLessonStep(0, session).active.index, 0);
  assert.equal(endLesson(session).ok, true);
  assert.equal(loadActiveLesson(session).active, null);
});

test('legacy active lessons derive a stable run ID compatible with their prior summary ID', () => {
  const session = new MemoryStorage();
  const startedAt = '2026-04-03T12:30:00.000Z';
  session.setItem(ACTIVE_LESSON_KEY, JSON.stringify({
    version: 1, template, studentId: 'student-1', index: 0, completedStepIds: [], startedAt,
  }));
  const first = loadActiveLesson(session).active;
  const second = loadActiveLesson(session).active;
  assert.equal(first.runId, `${Date.parse(startedAt).toString(36)}-student-1`);
  assert.equal(second.runId, first.runId);
  assert.equal(startLesson(template, 'student-2', session).error, 'active-lesson');
});

test('step movement rejects invalid ids, storage failures return errors, and navigation is bounded', () => {
  const session = new MemoryStorage();
  assert.equal(startLesson(template, 'student-1', session).ok, true);
  assert.equal(completeLessonStep('wrong-step', session).error, 'invalid-step');
  assert.equal(moveLessonStep(-1, session).error, 'invalid-index');
  assert.equal(startLesson(template, '<script>', session).error, 'invalid-student');
  assert.equal(startLesson(template, 'student-1', new BrokenStorage()).error, 'unavailable');
  assert.equal(loadLessonTemplates(new BrokenStorage()).error, 'unavailable');
  assert.equal(saveLessonTemplates([template], new BrokenStorage()).error, 'unavailable');
  assert.equal(endLesson(new BrokenStorage()).error, 'unavailable');
});


test('duplicate step IDs normalize uniquely and unknown active versions cannot resume', () => {
  const clean = normalizeLessonTemplate({ ...template, steps: [
    { id: 'step-2', activityId: 'reading-words', responseMode: 'screen' },
    { id: 'step-2', activityId: 'reading-words', responseMode: 'screen' },
    { id: 'step-2-1', activityId: 'reading-words', responseMode: 'screen' },
  ] });
  assert.equal(new Set(clean.steps.map(step => step.id)).size, 3);
  const session = new MemoryStorage();
  session.setItem(ACTIVE_LESSON_KEY, JSON.stringify({ version: 99, template, studentId: 'student-1', index: 0 }));
  assert.equal(loadActiveLesson(session).active, null);
});

test('starting a lesson preserves an existing or unreadable active snapshot', () => {
  const session = new MemoryStorage();
  assert.equal(startLesson(template, 'student-1', session).ok, true);
  const raw = session.getItem(ACTIVE_LESSON_KEY);
  assert.equal(startLesson(template, 'student-2', session).error, 'active-lesson');
  assert.equal(session.getItem(ACTIVE_LESSON_KEY), raw);
  const future = JSON.stringify({ version: 99, studentId: 'student-1' });
  session.setItem(ACTIVE_LESSON_KEY, future);
  assert.equal(loadActiveLesson(session).error, 'invalid-data');
  assert.equal(startLesson(template, 'student-2', session).error, 'invalid-data');
  assert.equal(session.getItem(ACTIVE_LESSON_KEY), future);
});
