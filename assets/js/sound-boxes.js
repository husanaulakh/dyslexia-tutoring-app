import { createPracticeSession } from './practice-session.mjs';
import { mountStudentTracker } from './student-tracker.js';
import { getLessonActivityContext } from './lesson-context.mjs';
import { soundBoxWords } from '../../data/sound-boxes-words.mjs';
import { emptyOutcomeCounts, normalizeOutcome, parseAnnotatedWords, selectSoundBoxItems } from './sound-boxes-logic.mjs';

const $ = selector => document.querySelector(selector);
const tracker = mountStudentTracker($('#studentTracker'), { activityLabel: 'Sound Boxes' });
const ctx = getLessonActivityContext('sound-boxes');
const select = $('#wordSelect');
let currentItems = [...soundBoxWords];
let index = 0;
let placed = new Set();
let revealed = false;
let chosenOutcome = '';
let outcomes = emptyOutcomeCounts();
let learnerId = '';
let startedAt = 0;
let completed = 0;
let sessionSaved = false;

for (const item of soundBoxWords) {
  const option = document.createElement('option');
  option.value = item.id;
  option.textContent = `${item.word} · ${item.phonemes.length} sounds`;
  select.append(option);
}

if (ctx) {
  $('#setupPanel').hidden = true;
  select.value = ctx.settings.wordSetId || select.value;
  if (ctx.responseMode === 'paper') $('#responseMode').value = 'paper';
  else if (ctx.responseMode === 'screen') $('#responseMode').value = 'screen';
}

function setOutcome(value) {
  chosenOutcome = normalizeOutcome(value);
  document.querySelectorAll('.outcome').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.outcome === chosenOutcome)));
  $('#nextWord').disabled = !chosenOutcome;
}

function renderBoxes(item) {
  const root = $('#boxes');
  root.replaceChildren();
  const paper = $('#responseMode').value === 'paper';
  $('#counterHelp').textContent = paper
    ? `Use physical counters or marks: ${item.phonemes.length} boxes are shown, one for each annotated sound.`
    : 'Select a box to place or remove its counter. Tab to a box and press Space or Enter to operate it.';
  item.phonemes.forEach((_, i) => {
    if (paper) {
      const box = document.createElement('div');
      box.className = 'sound-box';
      box.setAttribute('aria-label', `Physical counter box ${i + 1}`);
      box.innerHTML = `<span class="counter" aria-hidden="true">□</span><span class="box-label">Box ${i + 1}</span>`;
      root.append(box);
      return;
    }
    const box = document.createElement('button');
    box.type = 'button';
    box.className = 'sound-box';
    box.setAttribute('aria-pressed', 'false');
    box.setAttribute('aria-label', `Place counter in sound box ${i + 1}`);
    box.innerHTML = `<span class="counter" aria-hidden="true">○</span><span class="box-label">Box ${i + 1}</span>`;
    box.addEventListener('click', () => {
      if (revealed) return;
      if (placed.has(i)) placed.delete(i); else placed.add(i);
      box.setAttribute('aria-pressed', String(placed.has(i)));
      box.setAttribute('aria-label', `${placed.has(i) ? 'Remove counter from' : 'Place counter in'} sound box ${i + 1}`);
      box.querySelector('.counter').textContent = placed.has(i) ? '●' : '○';
      $('#practiceStatus').textContent = `${placed.size} of ${item.phonemes.length} counters placed.`;
    });
    root.append(box);
  });
}

function renderItem() {
  const item = currentItems[index];
  if (!item) { finishPractice(); return; }
  placed = new Set(); revealed = false; setOutcome('');
  $('#progressText').textContent = `Word ${index + 1} of ${currentItems.length}`;
  $('#boxes').setAttribute('aria-label', `${item.phonemes.length} sound boxes`);
  renderBoxes(item);
  $('#revealedAnswer').hidden = true;
  $('#targetWord').textContent = '';
  $('#tutorWord').textContent = '';
  $('#tutorWord').hidden = true;
  $('#outcomeChoices').hidden = true;
  $('#revealWord').disabled = false;
  $('#practiceStatus').textContent = '';
}

function startPractice() {
  if (!session.flush()) return;
  const parsed = parseAnnotatedWords($('#customWords').value);
  if ($('#customWords').value.trim() && parsed.errors.length) {
    $('#setupError').textContent = parsed.errors.join(' ');
    return;
  }
  currentItems = parsed.items.length ? parsed.items : selectSoundBoxItems(ctx?.settings ?? {});
  if (!currentItems.length) { $('#setupError').textContent = 'Choose or annotate at least one valid word.'; return; }
  if (!parsed.items.length && !ctx) {
    const chosen = select.value;
    currentItems = chosen === 'all' ? [...soundBoxWords] : soundBoxWords.filter(item => item.id === chosen);
  }
  index = 0; completed = 0; outcomes = emptyOutcomeCounts(); sessionSaved = false;
  learnerId = ctx?.studentId ?? tracker.getSelectedStudent()?.id ?? '';
  startedAt = Date.now();
  session.reset();
  $('#setupError').textContent = '';
  $('#studentTracker').hidden = true;
  $('#setupPanel').hidden = true;
  $('#donePanel').hidden = true;
  $('#practicePanel').hidden = false;
  renderItem();
}

function reveal() {
  if (revealed) return;
  const item = currentItems[index];
  revealed = true;
  $('#targetWord').textContent = item.word;
  $('#revealedAnswer').hidden = false;
  $('#outcomeChoices').hidden = false;
  $('#revealWord').disabled = true;
  $('#boxes').querySelectorAll('button').forEach(button => { button.disabled = true; });
  $('#practiceStatus').textContent = `The word has ${item.phonemes.length} phonemes. The tutor confirms the outcome.`;
}

function showTutorWord() {
  $('#tutorWord').textContent = `Word: ${currentItems[index].word}`;
  $('#tutorWord').hidden = false;
}

const session = createPracticeSession({
  record: value => tracker.recordSession(value),
  onRecovery: () => tracker.refresh(),
  summary: () => ({
    studentId: learnerId, conceptIds: ctx?.conceptIds ?? [], activity: 'sound-boxes', listLabel: 'Annotated sound boxes',
    completedItems: completed, totalItems: currentItems.length,
    outcomeCounts: outcomes,
    durationSeconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
  }),
});
session.bind(window);
function saveSession() { sessionSaved = session.save(); return sessionSaved; }

function finishPractice() {
  const saved = saveSession();
  $('#practicePanel').hidden = true;
  $('#studentTracker').hidden = false;
  $('#donePanel').hidden = false;
  $('#doneSummary').textContent = `Finished ${completed} ${completed === 1 ? 'word' : 'words'}: ${outcomes.independent} independent, ${outcomes.supported} with help, ${outcomes.revisit} to revisit.`;
  $('#saveNotice').textContent = !learnerId ? 'No learner was selected. This practice is not in a learner history.' : saved ? 'Session saved on this device.' : 'The session could not be saved. Try again when browser storage is available.';
  $('#retrySave').hidden = !learnerId || saved || completed === 0;
}

$('#startPractice').addEventListener('click', startPractice);
$('#clearCounters').addEventListener('click', () => { if (!revealed) { placed.clear(); renderBoxes(currentItems[index]); $('#practiceStatus').textContent = 'Counters cleared.'; } });
$('#revealWord').addEventListener('click', reveal);
$('#showTutorWord').addEventListener('click', showTutorWord);
document.querySelectorAll('.outcome').forEach(button => button.addEventListener('click', () => setOutcome(button.dataset.outcome)));
$('#nextWord').addEventListener('click', () => {
  if (!revealed || !chosenOutcome) return;
  outcomes[chosenOutcome] += 1; completed += 1; index += 1;
  saveSession();
  if (index >= currentItems.length) finishPractice(); else renderItem();
});
$('#endPractice').addEventListener('click', finishPractice);
$('#retrySave').addEventListener('click', () => {
  const saved = saveSession();
  $('#saveNotice').textContent = saved ? 'Session saved on this device.' : 'The session could not be saved. Try again when browser storage is available.';
  $('#retrySave').hidden = saved;
});
$('#again').addEventListener('click', () => {
  $('#donePanel').hidden = true; $('#studentTracker').hidden = false; $('#setupPanel').hidden = false;
});
if (ctx) startPractice();
