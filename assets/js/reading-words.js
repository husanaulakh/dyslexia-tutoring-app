import { createPracticeSession } from './practice-session.mjs';
import { loadStoredCollection, saveStoredCollection } from './collection-storage.mjs';
import { mountStudentTracker } from './student-tracker.js';
import { getLessonActivityContext, loadActiveLesson } from './lesson-context.mjs';
import {
  advanceReviewQueue, buildReviewQueue, createReadingOutcomeCounts,
  normalizeReadingOutcome, normalizeWordLists, parseReadingWords, recordReadingOutcome,
} from './reading-words-logic.mjs';

const STORAGE_KEY = 'bright-steps-reading-word-lists';
const STARTER_WORDS = ['tap', 'duck', 'rub', 'bog', 'net', 'bell', 'tall', 'van', 'pits', 'chap'];
const $ = selector => document.querySelector(selector);
const tracker = mountStudentTracker($('#studentTracker'), { activityLabel: 'Reading Words' });
const lessonContext = getLessonActivityContext('reading-words');
const elements = {
  tutor: $('#tutorPanel'), practice: $('#practicePanel'), done: $('#donePanel'),
  select: $('#listSelect'), name: $('#listName'), words: $('#listWords'), status: $('#tutorStatus'),
  activeName: $('#activeListName'), progress: $('#wordProgressText'), progressBar: $('.progress'),
  progressFill: $('#progressFill'), kind: $('#wordKind'), word: $('#practiceWord'), hint: $('#practiceHint'),
};

let storedLists = null;
function loadLists() {
  storedLists = loadStoredCollection({
    key: STORAGE_KEY,
    normalize: value => normalizeWordLists(value, STARTER_WORDS),
    fallback: () => normalizeWordLists(null, STARTER_WORDS),
  });
  if (storedLists.error) elements.status.textContent = 'Saved word lists could not be read. Starter words are available for this visit, and the existing stored data will be left untouched.';
  return storedLists.items;
}

const state = {
  lists: loadLists(), selectedId: '', queue: [], total: 0, shown: 0, completed: 0, reviewsScheduled: 0,
  activeName: '', studentId: '', startedAt: 0, sessionSaved: false,
  outcomeCounts: createReadingOutcomeCounts(), retryOutcomeCounts: createReadingOutcomeCounts(), selectedOutcome: '',
};
state.selectedId = state.lists[0].id;
// A tutor suggestion can select an existing saved list without replacing a lesson.
const suggestedListId = new URLSearchParams(location.search).get('list');
const activeLessonState = loadActiveLesson();
if (!activeLessonState.error && !activeLessonState.active && state.lists.some(list => list.id === suggestedListId)) {
  state.selectedId = suggestedListId;
}


if (lessonContext?.settings?.listId && state.lists.some(list => list.id === lessonContext.settings.listId)) {
  state.selectedId = lessonContext.settings.listId;
  elements.select.disabled = true;
}

function selectedList() { return state.lists.find(list => list.id === state.selectedId) ?? state.lists[0]; }
function saveStorage() {
  const result = saveStoredCollection({ key: STORAGE_KEY, items: state.lists, loaded: storedLists });
  if (!result.ok) {
    storedLists = { ...storedLists, error: result.error };
    return false;
  }
  storedLists = { ...storedLists, raw: result.raw, error: null };
  return true;
}
function saveFailureMessage() {
  return ['invalid-data', 'changed'].includes(storedLists?.error)
    ? 'Saved only for this visit. Stored word-list data is unreadable or changed elsewhere, so it was left untouched.'
    : 'Saved for this session, but browser storage is unavailable.';
}
function refreshSelect() {
  const previous = state.selectedId;
  elements.select.replaceChildren();
  state.lists.forEach(list => {
    const option = document.createElement('option');
    option.value = list.id;
    option.textContent = list.name;
    elements.select.append(option);
  });
  state.selectedId = state.lists.some(list => list.id === previous) ? previous : state.lists[0].id;
  elements.select.value = state.selectedId;
}
function showEditor() {
  const list = selectedList();
  elements.name.value = list.name;
  elements.words.value = list.words.join('\n');
  $('#addList').disabled = state.lists.length >= 12;
}
function saveEditor(showMessage = true) {
  const list = selectedList();
  const name = elements.name.value.trim().replace(/[<>]/g, '').slice(0, 40);
  list.name = name || `List ${state.lists.indexOf(list) + 1}`;
  list.words = parseReadingWords(elements.words.value);
  const persisted = saveStorage();
  refreshSelect();
  showEditor();
  if (showMessage) elements.status.textContent = persisted ? `Saved ${list.name} (${list.words.length} ${list.words.length === 1 ? 'word' : 'words'}).` : saveFailureMessage();
  return list;
}
function beginPractice() {
  if (!session.flush()) return;
  const student = tracker.getSelectedStudent();
  if (!student) { elements.status.textContent = 'Add or select a student above before starting.'; return; }
  const list = saveEditor(false);
  if (!list.words.length) {
    elements.status.textContent = 'Add at least one valid word before starting.';
    return;
  }
  state.queue = buildReviewQueue(list.words);
  state.total = state.queue.length;
  state.shown = 1;
  state.completed = 0;
  state.reviewsScheduled = 0;
  state.activeName = list.name;
  state.studentId = student.id;
  state.startedAt = Date.now();
  session.reset();
  state.sessionSaved = false;
  state.outcomeCounts = createReadingOutcomeCounts();
  state.retryOutcomeCounts = createReadingOutcomeCounts();
  $('#studentTracker').hidden = true;
  elements.tutor.hidden = true;
  elements.done.hidden = true;
  elements.practice.hidden = false;
  renderWord();
}
function renderWord() {
  const current = state.queue[0];
  if (!current) { completePractice(); return; }
  elements.activeName.textContent = state.activeName;
  elements.progress.textContent = `Word ${state.shown} of ${state.total}`;
  elements.progressBar.setAttribute('aria-valuemax', String(state.total));
  elements.progressBar.setAttribute('aria-valuenow', String(state.shown));
  elements.progressFill.style.width = `${Math.round((state.shown / state.total) * 100)}%`;
  elements.kind.textContent = current.isReview ? 'Read this word again' : 'Read this word';
  $('#outcomeHeading').textContent = current.isReview ? 'Tutor-confirmed retry outcome' : 'Tutor-confirmed first response';
  document.querySelectorAll('[data-outcome]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  elements.word.textContent = current.word;
  elements.word.classList.toggle('review-word', current.isReview);
  elements.hint.textContent = current.isReview
    ? 'This word needed practice earlier. Read it aloud again; this retry will be recorded separately.'
    : 'Read the word aloud. Independent ends its turn; With help or Revisit brings it back once after up to three other words.';
  elements.word.focus({ preventScroll: true });
}
function markWord(outcomeValue) {
  if (!state.queue.length) return;
  const outcome = normalizeReadingOutcome(outcomeValue);
  if (!outcome) return;
  const current = state.queue[0];
  if (current.isReview) state.retryOutcomeCounts = recordReadingOutcome(state.retryOutcomeCounts, outcome);
  else state.outcomeCounts = recordReadingOutcome(state.outcomeCounts, outcome);
  state.queue = advanceReviewQueue(state.queue, outcome);
  state.completed += 1;
  if (outcome !== 'independent' && !current.isReview) {
    state.total += 1;
    state.reviewsScheduled += 1;
  }
  if (!state.queue.length) { completePractice(); return; }
  state.shown += 1;
  saveSession();
  renderWord();
}
const session = createPracticeSession({
  record: value => tracker.recordSession(value),
  onRecovery: () => tracker.refresh(),
  summary: () => ({
    studentId: state.studentId, activity: 'reading-words', conceptIds: lessonContext?.conceptIds ?? [], listLabel: state.activeName,
    completedItems: state.completed, totalItems: state.total,
    outcomeCounts: state.outcomeCounts, retryOutcomeCounts: state.retryOutcomeCounts,
    durationSeconds: Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000)),
  }),
});
session.bind(window);
function saveSession() {
  state.sessionSaved = session.save();
  return state.sessionSaved;
}
function completePractice() {
  const saved = saveSession();
  $('#studentTracker').hidden = false;
  elements.practice.hidden = true;
  elements.done.hidden = false;
  const reviewText = state.reviewsScheduled
    ? `${state.reviewsScheduled} ${state.reviewsScheduled === 1 ? 'word was' : 'words were'} reviewed once after up to three others.`
    : 'No words needed a retry.';
  const initial = state.outcomeCounts;
  const retries = state.retryOutcomeCounts;
  const retryText = Object.values(retries).some(Boolean)
    ? ` Retry outcomes: ${retries.independent} independent, ${retries.supported} with help, ${retries.revisit} revisit.`
    : '';
  $('#doneText').textContent = `You practised ${state.completed} word cards from ${state.activeName}. First responses: ${initial.independent} independent, ${initial.supported} with help, ${initial.revisit} revisit. ${reviewText}${retryText}${state.completed > 0 && !saved ? ' The session could not be saved in browser storage.' : ''}`;
}
function backToLists() {
  const saved = saveSession();
  $('#studentTracker').hidden = false;
  elements.practice.hidden = true;
  elements.done.hidden = true;
  elements.tutor.hidden = false;
  elements.status.textContent = state.completed > 0 && !saved ? 'The completed practice could not be saved in browser storage.' : '';
}

refreshSelect();
showEditor();
elements.select.addEventListener('change', () => {
  const nextId = elements.select.value;
  saveEditor(false);
  state.selectedId = nextId;
  elements.select.value = nextId;
  showEditor();
  elements.status.textContent = '';
});
$('#saveList').addEventListener('click', () => saveEditor(true));
$('#startPractice').addEventListener('click', beginPractice);
$('#addList').addEventListener('click', () => {
  saveEditor(false);
  if (state.lists.length >= 12) return;
  const number = state.lists.length + 1;
  const id = `list-${Date.now()}-${number}`;
  state.lists.push({ id, name: `List ${number}`, words: [] });
  state.selectedId = id;
  const persisted = saveStorage();
  refreshSelect();
  showEditor();
  elements.status.textContent = persisted ? `Added List ${number}.` : `Added List ${number} for this session only. ${saveFailureMessage()}`;
  elements.name.focus();
});
$('#correctWord').addEventListener('click', () => markWord('independent'));
$('#supportedWord').addEventListener('click', () => markWord('supported'));
$('#incorrectWord').addEventListener('click', () => markWord('revisit'));
$('#endPractice').addEventListener('click', backToLists);
$('#backToLists').addEventListener('click', backToLists);
$('#repeatList').addEventListener('click', beginPractice);
$('#doneToLists').addEventListener('click', backToLists);
