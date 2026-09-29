import { mountStudentTracker } from './student-tracker.js';
import {
  advanceParagraphReviewQueue, buildParagraphReviewQueue,
  normalizeParagraphLists, parseParagraphs,
} from './paragraph-reading-logic.mjs';

const STORAGE_KEY = 'bright-steps-paragraph-reading-lists';
const STARTER_PARAGRAPHS = [
  'Sam has a red cap. He can tap the cap on his lap. The cap slips, and Sam grabs it.',
  'A duck sat by the pond. It saw a bug on a log. The duck gave one quack and swam off.',
  'The bell rang at ten. Nell put her book in her bag. Then she went to meet Ben.',
];
const $ = selector => document.querySelector(selector);
const tracker = mountStudentTracker($('#studentTracker'), { activityLabel: 'Paragraph Reading' });
const elements = {
  tutor: $('#tutorPanel'), practice: $('#practicePanel'), done: $('#donePanel'),
  select: $('#listSelect'), name: $('#listName'), paragraphs: $('#listParagraphs'), status: $('#tutorStatus'),
  activeName: $('#activeListName'), progress: $('#paragraphProgressText'), progressBar: $('.progress'),
  progressFill: $('#progressFill'), kind: $('#paragraphKind'), paragraph: $('#practiceParagraph'), hint: $('#practiceHint'),
};

function loadLists() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === null
      ? normalizeParagraphLists(null, STARTER_PARAGRAPHS)
      : normalizeParagraphLists(JSON.parse(value), STARTER_PARAGRAPHS);
  } catch {
    return normalizeParagraphLists(null, STARTER_PARAGRAPHS);
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
  elements.paragraphs.value = list.paragraphs.join('\n\n');
  $('#addList').disabled = state.lists.length >= 12;
}
function saveEditor(showMessage = true) {
  const list = selectedList();
  const name = elements.name.value.trim().replace(/<[^>]*>/g, '').slice(0, 40);
  list.name = name || `Paragraphs ${state.lists.indexOf(list) + 1}`;
  list.paragraphs = parseParagraphs(elements.paragraphs.value);
  const persisted = saveStorage();
  refreshSelect();
  showEditor();
  if (showMessage) elements.status.textContent = persisted
    ? `Saved ${list.name} (${list.paragraphs.length} ${list.paragraphs.length === 1 ? 'paragraph' : 'paragraphs'}).`
    : 'Saved for this session, but browser storage is unavailable.';
  return list;
}
function beginPractice() {
  const student = tracker.getSelectedStudent();
  if (!student) { elements.status.textContent = 'Add or select a student above before starting.'; return; }
  const list = saveEditor(false);
  if (!list.paragraphs.length) {
    elements.status.textContent = 'Add at least one paragraph before starting.';
    return;
  }
  state.queue = buildParagraphReviewQueue(list.paragraphs);
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
  renderParagraph();
}
function renderParagraph() {
  const current = state.queue[0];
  if (!current) { completePractice(); return; }
  const originalIndex = Number(current.id.split('-')[0]) + 1;
  elements.activeName.textContent = state.activeName;
  elements.progress.textContent = `Paragraph ${state.shown} of ${state.total}`;
  elements.progressBar.setAttribute('aria-valuemax', String(state.total));
  elements.progressBar.setAttribute('aria-valuenow', String(state.shown));
  elements.progressFill.style.width = `${Math.round((state.shown / state.total) * 100)}%`;
  elements.kind.textContent = current.isReview ? `Review · Paragraph ${originalIndex}` : `Paragraph ${originalIndex}`;
  elements.paragraph.textContent = current.paragraph;
  elements.hint.textContent = current.isReview
    ? 'Read this paragraph aloud again, then continue.'
    : 'Read the paragraph aloud. It will return after three other paragraphs for another try.';
  elements.paragraph.focus({ preventScroll: true });
}
function nextParagraph() {
  if (!state.queue.length) return;
  state.queue = advanceParagraphReviewQueue(state.queue);
  if (!state.queue.length) { completePractice(); return; }
  state.shown += 1;
  renderParagraph();
}
function saveSession(completedItems) {
  if (state.sessionSaved || !state.studentId || completedItems < 1) return;
  const result = tracker.recordSession({
    studentId: state.studentId, activity: 'Paragraph Reading', listLabel: state.activeName,
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
  $('#doneText').textContent = `You read ${state.total} paragraph cards from ${state.activeName}. Each paragraph came back once for a second reading.`;
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
  state.lists.push({ id, name: `Paragraphs ${number}`, paragraphs: [] });
  state.selectedId = id;
  const persisted = saveStorage();
  refreshSelect();
  showEditor();
  elements.status.textContent = persisted ? `Added Paragraphs ${number}.` : `Added Paragraphs ${number} for this session.`;
  elements.name.focus();
});
$('#nextParagraph').addEventListener('click', nextParagraph);
$('#endPractice').addEventListener('click', backToLists);
$('#backToLists').addEventListener('click', backToLists);
$('#repeatList').addEventListener('click', beginPractice);
$('#doneToLists').addEventListener('click', backToLists);
