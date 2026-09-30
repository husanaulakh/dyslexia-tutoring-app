import { createPracticeSession } from './practice-session.mjs';
import { loadStoredCollection, saveStoredCollection } from './collection-storage.mjs';
import { mountStudentTracker } from './student-tracker.js';
import {
  advanceParagraphReviewQueue, buildParagraphReviewQueue, createParagraphOutcomeCounts,
  normalizeParagraphLists, normalizeParagraphOutcome, normalizeParagraphRows, recordParagraphOutcome,
} from './paragraph-reading-logic.mjs';
import { getLessonActivityContext } from './lesson-context.mjs';

const STORAGE_KEY = 'bright-steps-paragraph-reading-lists';
const STARTER_PARAGRAPHS = [
  'Sam has a red cap. He can tap the cap on his lap. The cap slips, and Sam grabs it.',
  'A duck sat by the pond. It saw a bug on a log. The duck gave one quack and swam off.',
  'The bell rang at ten. Nell put her book in her bag. Then she went to meet Ben.',
];
const $ = selector => document.querySelector(selector);
const tracker = mountStudentTracker($('#studentTracker'), { activityLabel: 'Paragraph Reading' });
const lessonContext = getLessonActivityContext('paragraph-reading');
const elements = {
  tutor: $('#tutorPanel'), practice: $('#practicePanel'), done: $('#donePanel'),
  select: $('#listSelect'), name: $('#listName'), paragraphs: $('#listParagraphs'), questions: $('#listQuestions'),
  questionMode: $('#questionMode'), rereadMode: $('#rereadMode'), status: $('#tutorStatus'),
  activeName: $('#activeListName'), progress: $('#paragraphProgressText'), progressBar: $('.progress'),
  progressFill: $('#progressFill'), kind: $('#paragraphKind'), paragraph: $('#practiceParagraph'), hint: $('#practiceHint'),
  questionWrap: $('#comprehensionPrompt'), question: $('#practiceQuestion'),
};

let storedLists = null;
function loadLists() {
  storedLists = loadStoredCollection({
    key: STORAGE_KEY,
    normalize: value => normalizeParagraphLists(value, STARTER_PARAGRAPHS),
    fallback: () => normalizeParagraphLists(null, STARTER_PARAGRAPHS),
  });
  if (storedLists.error) elements.status.textContent = 'Saved paragraph lists could not be read. Starter paragraphs are available for this visit, and the existing stored data will be left untouched.';
  return storedLists.items;
}

const state = {
  lists: loadLists(), selectedId: '', queue: [], total: 0, shown: 0, completed: 0,
  activeName: '', studentId: '', startedAt: 0, sessionSaved: false,
  questionMode: 'oral', rereadMode: 'all', selectedOutcome: '',
  outcomeCounts: createParagraphOutcomeCounts(), retryOutcomeCounts: createParagraphOutcomeCounts(),
};
state.selectedId = state.lists[0].id;

if (lessonContext?.settings?.listId && state.lists.some(list => list.id === lessonContext.settings.listId)) {
  state.selectedId = lessonContext.settings.listId;
  elements.select.disabled = true;
}
if (lessonContext?.settings?.questionMode !== undefined) {
  elements.questionMode.value = lessonContext.settings.questionMode === 'none' || lessonContext.settings.questionMode === false ? 'none' : 'oral';
  elements.questionMode.disabled = true;
}
if (lessonContext?.settings?.rereadMode) {
  elements.rereadMode.value = lessonContext.settings.rereadMode === 'needs-practice' ? 'needs-practice' : 'all';
  elements.rereadMode.disabled = true;
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
    ? 'Saved only for this visit. Stored paragraph-list data is unreadable or changed elsewhere, so it was left untouched.'
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
  elements.paragraphs.value = list.paragraphs.join('\n\n');
  elements.questions.value = list.questions.join('\n');
  $('#addList').disabled = state.lists.length >= 12;
}
function saveEditor(showMessage = true) {
  const list = selectedList();
  const name = elements.name.value.trim().replace(/<[^>]*>/g, '').slice(0, 40);
  list.name = name || `Paragraphs ${state.lists.indexOf(list) + 1}`;
  const rows = normalizeParagraphRows(elements.paragraphs.value, elements.questions.value);
  list.paragraphs = rows.paragraphs;
  list.questions = rows.questions;
  const persisted = saveStorage();
  refreshSelect();
  showEditor();
  if (showMessage) elements.status.textContent = persisted
    ? `Saved ${list.name} (${list.paragraphs.length} ${list.paragraphs.length === 1 ? 'paragraph' : 'paragraphs'}).`
    : saveFailureMessage();
  return list;
}
function beginPractice() {
  if (!session.flush()) return;
  const student = tracker.getSelectedStudent();
  if (!student) { elements.status.textContent = 'Add or select a student above before starting.'; return; }
  const list = saveEditor(false);
  if (!list.paragraphs.length) {
    elements.status.textContent = 'Add at least one paragraph before starting.';
    return;
  }
  state.queue = buildParagraphReviewQueue(list.paragraphs, list.questions);
  state.rereadMode = lessonContext?.settings?.rereadMode === 'needs-practice'
    ? 'needs-practice' : lessonContext?.settings?.rereadMode === 'all' ? 'all' : elements.rereadMode.value;
  state.questionMode = lessonContext?.settings?.questionMode === 'none'
    || lessonContext?.settings?.questionMode === false
    ? 'none' : lessonContext?.settings?.questionMode === 'oral' || lessonContext?.settings?.questionMode === true ? 'oral' : elements.questionMode.value;
  state.total = state.queue.length * (state.rereadMode === 'all' ? 2 : 1);
  state.shown = 1;
  state.completed = 0;
  state.activeName = list.name;
  state.studentId = lessonContext?.studentId ?? student.id;
  state.startedAt = Date.now();
  session.reset();
  state.sessionSaved = false;
  state.selectedOutcome = '';
  state.outcomeCounts = createParagraphOutcomeCounts();
  state.retryOutcomeCounts = createParagraphOutcomeCounts();
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
  const question = state.questionMode === 'oral' ? (current.question ?? '') : '';
  elements.question.textContent = question;
  elements.questionWrap.hidden = !question;
  $('#paragraphOutcomeHeading').textContent = current.isReview ? 'Tutor-confirmed retry outcome' : 'Tutor-confirmed first response';
  document.querySelectorAll('[data-outcome]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  state.selectedOutcome = '';
  $('#nextParagraph').disabled = true;
  elements.hint.textContent = current.isReview
    ? 'Read this paragraph again, then record the retry outcome separately.'
    : state.rereadMode === 'all'
      ? 'Read aloud and record the first response. Every paragraph returns once for rereading.'
      : 'Read aloud and record the first response. Paragraphs marked With help or Revisit return once after up to three other paragraphs.';
  elements.paragraph.focus({ preventScroll: true });
}
function nextParagraph(outcomeValue) {
  if (!state.queue.length) return;
  const outcome = normalizeParagraphOutcome(outcomeValue ?? state.selectedOutcome);
  if (!outcome) return;
  const current = state.queue[0];
  if (current.isReview) state.retryOutcomeCounts = recordParagraphOutcome(state.retryOutcomeCounts, outcome);
  else state.outcomeCounts = recordParagraphOutcome(state.outcomeCounts, outcome);
  const shouldReread = !current.isReview && (state.rereadMode === 'all' || outcome !== 'independent');
  state.queue = advanceParagraphReviewQueue(state.queue, outcome, state.rereadMode);
  state.completed += 1;
  if (shouldReread && state.rereadMode === 'needs-practice') state.total += 1;
  if (!state.queue.length) { completePractice(); return; }
  state.shown += 1;
  saveSession();
  renderParagraph();
}
function selectOutcome(outcome) {
  state.selectedOutcome = outcome;
  document.querySelectorAll('[data-outcome]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.outcome === outcome)));
  $('#nextParagraph').disabled = false;
  elements.hint.textContent = `${outcome === 'independent' ? 'Independent' : outcome === 'supported' ? 'With help' : 'Revisit'} selected. Tutor: finish this paragraph to continue.`;
}
const session = createPracticeSession({
  record: value => tracker.recordSession(value),
  onRecovery: () => tracker.refresh(),
  summary: () => ({
    studentId: state.studentId, activity: 'paragraph-reading', conceptIds: lessonContext?.conceptIds ?? [], listLabel: state.activeName,
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
  const first = state.outcomeCounts;
  const retry = state.retryOutcomeCounts;
  const rereadText = state.rereadMode === 'all' ? 'Every paragraph was scheduled for rereading.' : 'Only paragraphs marked With help or Revisit were scheduled for rereading.';
  const retryText = Object.values(retry).some(Boolean)
    ? ` Retry outcomes: ${retry.independent} independent, ${retry.supported} with help, ${retry.revisit} revisit.` : '';
  $('#doneText').textContent = `You completed ${state.completed} of ${state.total} paragraph cards from ${state.activeName}. First responses: ${first.independent} independent, ${first.supported} with help, ${first.revisit} revisit. ${rereadText}${retryText}${state.completed > 0 && !saved ? ' The session could not be saved in browser storage.' : ''}`;
}
function backToLists() {
  const saved = saveSession();
  $('#studentTracker').hidden = false;
  elements.practice.hidden = true;
  elements.done.hidden = true;
  elements.tutor.hidden = false;
  elements.status.textContent = state.completed && !saved ? 'The completed practice could not be saved in browser storage.' : '';
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
  state.lists.push({ id, name: `Paragraphs ${number}`, paragraphs: [], questions: [] });
  state.selectedId = id;
  const persisted = saveStorage();
  refreshSelect();
  showEditor();
  elements.status.textContent = persisted ? `Added Paragraphs ${number}.` : `Added Paragraphs ${number} for this session only. ${saveFailureMessage()}`;
  elements.name.focus();
});
$('#nextParagraph').addEventListener('click', () => nextParagraph());
document.querySelectorAll('[data-outcome]').forEach(button => button.addEventListener('click', () => selectOutcome(button.dataset.outcome)));
$('#endPractice').addEventListener('click', backToLists);
$('#backToLists').addEventListener('click', backToLists);
$('#repeatList').addEventListener('click', beginPractice);
$('#doneToLists').addEventListener('click', backToLists);
