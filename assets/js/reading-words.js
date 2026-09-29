import { mountStudentTracker } from './student-tracker.js';
import { advanceReviewQueue, buildReviewQueue, normalizeWordLists, parseReadingWords } from './reading-words-logic.mjs';

const STORAGE_KEY = 'bright-steps-reading-word-lists';
const STARTER_WORDS = ['tap', 'duck', 'rub', 'bog', 'net', 'bell', 'tall', 'van', 'pits', 'chap'];
const $ = selector => document.querySelector(selector);
const tracker = mountStudentTracker($('#studentTracker'), { activityLabel: 'Reading Words' });
const elements = {
  tutor: $('#tutorPanel'), practice: $('#practicePanel'), done: $('#donePanel'),
  select: $('#listSelect'), name: $('#listName'), words: $('#listWords'), status: $('#tutorStatus'),
  activeName: $('#activeListName'), progress: $('#wordProgressText'), progressBar: $('.progress'),
  progressFill: $('#progressFill'), kind: $('#wordKind'), word: $('#practiceWord'), hint: $('#practiceHint'),
};

function loadLists() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === null ? normalizeWordLists(null, STARTER_WORDS) : normalizeWordLists(JSON.parse(value), STARTER_WORDS);
  } catch {
    return normalizeWordLists(null, STARTER_WORDS);
  }
}

const state = { lists: loadLists(), selectedId: '', queue: [], total: 0, shown: 0, activeName: '', studentId: '', startedAt: 0, sessionSaved: false };
state.selectedId = state.lists[0].id;

function selectedList() { return state.lists.find(list => list.id === state.selectedId) ?? state.lists[0]; }
function saveStorage() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.lists)); return true; }
  catch { return false; }
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
  if (showMessage) elements.status.textContent = persisted ? `Saved ${list.name} (${list.words.length} ${list.words.length === 1 ? 'word' : 'words'}).` : 'Saved for this session, but browser storage is unavailable.';
  return list;
}
function beginPractice() {
  const student = tracker.getSelectedStudent();
  if (!student) { elements.status.textContent = 'Add or select a student above before starting.'; return; }
  const list = saveEditor(false);
  if (!list.words.length) {
    elements.status.textContent = 'Add at least one valid word before starting.';
    return;
  }
  state.queue = buildReviewQueue(list.words);
  state.total = state.queue.length * 2;
  state.shown = 1;
  state.activeName = list.name;
  state.studentId = student.id;
  state.startedAt = Date.now();
  state.sessionSaved = false;
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
  elements.word.textContent = current.word;
  elements.word.classList.toggle('review-word', current.isReview);
  elements.hint.textContent = current.isReview
    ? 'This is a spaced review word. Read it aloud, then continue.'
    : 'Read the word aloud. It will return after three other words for another try.';
  elements.word.focus({ preventScroll: true });
}
function nextWord() {
  if (!state.queue.length) return;
  state.queue = advanceReviewQueue(state.queue);
  if (!state.queue.length) { completePractice(); return; }
  state.shown += 1;
  renderWord();
}
function saveSession(completedItems) {
  if (state.sessionSaved || !state.studentId || completedItems < 1) return;
  const result = tracker.recordSession({
    studentId: state.studentId, activity: 'Reading Words', listLabel: state.activeName,
    completedItems, totalItems: state.total,
    durationSeconds: Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000)),
  });
  state.sessionSaved = Boolean(result.ok);
}
function completePractice() {
  saveSession(state.total);
  $('#studentTracker').hidden = false;
  elements.practice.hidden = true;
  elements.done.hidden = false;
  $('#doneText').textContent = `You practised ${state.total} word cards from ${state.activeName}, with each word returning once for spaced review.`;
}
function backToLists() {
  saveSession(Math.min(state.shown - 1, state.total));
  $('#studentTracker').hidden = false;
  elements.practice.hidden = true;
  elements.done.hidden = true;
  elements.tutor.hidden = false;
  elements.status.textContent = '';
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
  saveStorage();
  refreshSelect();
  showEditor();
  elements.status.textContent = `Added List ${number}.`;
  elements.name.focus();
});
$('#nextWord').addEventListener('click', nextWord);
$('#endPractice').addEventListener('click', backToLists);
$('#backToLists').addEventListener('click', backToLists);
$('#repeatList').addEventListener('click', beginPractice);
$('#doneToLists').addEventListener('click', backToLists);
