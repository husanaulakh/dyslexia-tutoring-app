import { mountStudentTracker } from './student-tracker.js';
import { getLessonActivityContext } from './lesson-context.mjs';
import { auditoryDictationItems } from '../../data/auditory-dictation-items.mjs';
import { emptyOutcomeCounts, isAcceptedSpelling, normalizeOutcome, selectDictationItems } from './auditory-dictation-logic.mjs';

const $ = selector => document.querySelector(selector);
const tracker = mountStudentTracker($('#studentTracker'), { activityLabel: 'Auditory Dictation' });
const ctx = getLessonActivityContext('auditory-dictation');
let currentItems = [...auditoryDictationItems];
let index = 0;
let revealed = false;
let chosenOutcome = '';
let outcomes = emptyOutcomeCounts();
let learnerId = '';
let startedAt = 0;
let completed = 0;
let sessionSaved = false;

if (ctx) {
  $('#setupPanel').hidden = true;
  $('#itemMode').value = ['sounds', 'words'].includes(ctx.settings.preset) ? ctx.settings.preset : 'all';
  $('#responseMode').value = ctx.responseMode;
}

function setOutcome(value) {
  chosenOutcome = normalizeOutcome(value);
  document.querySelectorAll('.outcome').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.outcome === chosenOutcome)));
  $('#nextItem').disabled = !chosenOutcome;
}

function renderItem() {
  const item = currentItems[index];
  if (!item) { finishPractice(); return; }
  revealed = false; setOutcome('');
  $('#progressText').textContent = `Item ${index + 1} of ${currentItems.length}`;
  $('#itemKind').textContent = item.kind === 'sound' ? 'Sound dictation' : 'Word dictation';
  $('#prompt').textContent = item.prompt;
  $('#prompt').hidden = true;
  $('#showPrompt').hidden = false;
  $('#showPrompt').textContent = 'Show tutor prompt';
  $('#revealedAnswer').hidden = true;
  $('#answerSpellings').textContent = '';
  $('#outcomeChoices').hidden = true;
  $('#revealAnswer').disabled = false;
  $('#response').value = '';
  $('#response').disabled = false;
  const paper = $('#responseMode').value === 'paper';
  $('#typedResponse').hidden = paper;
  $('#paperHelp').hidden = !paper;
  $('#practiceStatus').textContent = '';
}

function startPractice() {
  currentItems = selectDictationItems(ctx?.settings ?? { preset: $('#itemMode').value });
  if (!ctx) {
    const mode = $('#itemMode').value;
    if (mode === 'sounds' || mode === 'words') currentItems = currentItems.filter(item => item.kind === (mode === 'sounds' ? 'sound' : 'word'));
  }
  if (!currentItems.length) { $('#setupError').textContent = 'Choose at least one valid dictation item.'; return; }
  index = 0; completed = 0; outcomes = emptyOutcomeCounts(); sessionSaved = false;
  learnerId = ctx?.studentId ?? tracker.getSelectedStudent()?.id ?? '';
  startedAt = Date.now();
  $('#setupError').textContent = '';
  $('#studentTracker').hidden = true;
  $('#setupPanel').hidden = true;
  $('#donePanel').hidden = true;
  $('#practicePanel').hidden = false;
  renderItem();
}

function showPrompt() {
  $('#prompt').hidden = false;
  $('#showPrompt').hidden = true;
}

function revealAnswer() {
  if (revealed) return;
  const item = currentItems[index];
  revealed = true;
  $('#answerSpellings').textContent = item.acceptedSpellings.join(' · ');
  $('#revealedAnswer').hidden = false;
  $('#outcomeChoices').hidden = false;
  $('#revealAnswer').disabled = true;
  $('#response').disabled = true;
  if ($('#responseMode').value === 'screen') {
    const correct = isAcceptedSpelling(item, $('#response').value);
    $('#practiceStatus').textContent = $('#response').value.trim()
      ? (correct ? 'The typed response matches an accepted spelling. Tutor: confirm the learning outcome.' : 'The typed response does not match the listed spelling. Tutor: confirm the learning outcome.')
      : 'No typed response was entered. Tutor: confirm the learning outcome.';
  } else {
    $('#practiceStatus').textContent = 'Accepted spellings revealed. Tutor: confirm the paper response and learning outcome.';
  }
}

function saveSession() {
  if (sessionSaved) return true;
  if (!learnerId || completed === 0) return false;
  const result = tracker.recordSession({
    studentId: learnerId, activity: 'auditory-dictation', listLabel: 'Tutor-spoken dictation',
    completedItems: completed, totalItems: currentItems.length, outcomeCounts: outcomes,
    durationSeconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
  });
  sessionSaved = Boolean(result.ok);
  return sessionSaved;
}

function finishPractice() {
  const saved = saveSession();
  $('#practicePanel').hidden = true;
  $('#studentTracker').hidden = false;
  $('#donePanel').hidden = false;
  $('#doneSummary').textContent = `Finished ${completed} ${completed === 1 ? 'item' : 'items'}: ${outcomes.independent} independent, ${outcomes.supported} with help, ${outcomes.revisit} to revisit.`;
  $('#saveNotice').textContent = !learnerId ? 'No learner was selected. This practice is not in a learner history.' : saved ? 'Session saved on this device.' : 'The session could not be saved. Try again when browser storage is available.';
  $('#retrySave').hidden = !learnerId || saved || completed === 0;
}

$('#startPractice').addEventListener('click', startPractice);
$('#showPrompt').addEventListener('click', showPrompt);
$('#revealAnswer').addEventListener('click', revealAnswer);
document.querySelectorAll('.outcome').forEach(button => button.addEventListener('click', () => setOutcome(button.dataset.outcome)));
$('#nextItem').addEventListener('click', () => {
  if (!revealed || !chosenOutcome) return;
  outcomes[chosenOutcome] += 1; completed += 1; index += 1;
  if (index >= currentItems.length) finishPractice(); else renderItem();
});
$('#endPractice').addEventListener('click', finishPractice);
$('#retrySave').addEventListener('click', () => {
  const saved = saveSession();
  $('#saveNotice').textContent = saved ? 'Session saved on this device.' : 'The session could not be saved. Try again when browser storage is available.';
  $('#retrySave').hidden = saved;
});
$('#again').addEventListener('click', () => { $('#donePanel').hidden = true; $('#studentTracker').hidden = false; $('#setupPanel').hidden = false; });
if (ctx) startPractice();
