import { mountStudentTracker } from './student-tracker.js';
import { getLessonActivityContext } from './lesson-context.mjs';
import {
  checkSortAnswer, checkSyllableAnswer, checkVcCvAnswer, createOutcomeCounts,
  getSortCategory, getSyllableType, getWorkshopItems, loadCustomVcCvItems,
  normalizeVcCvAnnotation, recordOutcome, saveCustomVcCvItems,
} from './word-workshop-logic.mjs';

const $ = selector => document.querySelector(selector);
const tracker = mountStudentTracker($('#studentTracker'), { activityLabel: 'Word Workshop' });
const setup = $('#setupPanel');
const practice = $('#practicePanel');
const done = $('#donePanel');
const strandSelect = $('#strandSelect');
const responseMode = $('#responseMode');
const setupStatus = $('#setupStatus');
const interaction = $('#interaction');
const answer = $('#revealedAnswer');
const outcomeButtons = [...document.querySelectorAll('[data-outcome]')];
const labels = {
  'silent-e': 'Silent-e transformations',
  sort: 'FLOSS, ai, and ay sort',
  syllables: 'Six syllable types',
  vccv: 'Annotated VC.CV practice',
};
const lessonContext = getLessonActivityContext('word-workshop');
let customItems = loadCustomVcCvItems();
let state = { strand: 'silent-e', mode: 'screen', items: [], index: 0, completed: 0, outcomeCounts: createOutcomeCounts(), studentId: '', startedAt: 0, selectedOutcome: '', selectedChoice: '', response: '', responseChecked: false, saved: false };

function make(tag, text = '', className = '') {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function currentItem() { return state.items[state.index] ?? null; }

function setSetupStatus(message, error = false) {
  setupStatus.textContent = message;
  setupStatus.classList.toggle('error', error);
}

function renderStrandFromContext() {
  if (!lessonContext) return;
  const requested = lessonContext.settings?.workshop;
  if (Object.hasOwn(labels, requested)) strandSelect.value = requested;
  strandSelect.disabled = true;
  responseMode.value = lessonContext.responseMode;
  responseMode.disabled = true;
  $('#annotationEditor').hidden = lessonContext.responseMode !== 'paper' && requested !== 'vccv';
}

function beginPractice() {
  const student = tracker.getSelectedStudent();
  if (!student) { setSetupStatus('Add or select a learner label before starting.', true); return; }
  const strand = lessonContext?.settings?.workshop && Object.hasOwn(labels, lessonContext.settings.workshop)
    ? lessonContext.settings.workshop : strandSelect.value;
  const mode = lessonContext?.responseMode ?? responseMode.value;
  let items = getWorkshopItems(strand, customItems);
  const selectedIds = lessonContext?.settings?.itemIds;
  if (Array.isArray(selectedIds) && selectedIds.length) {
    const selected = new Set(selectedIds);
    const filtered = items.filter(item => selected.has(item.id));
    items = filtered;
  }
  if (!items.length) { setSetupStatus('No items are available in this workshop yet.', true); return; }
  state = {
    strand, mode, items, index: 0, completed: 0, outcomeCounts: createOutcomeCounts(), studentId: student.id,
    startedAt: Date.now(), selectedOutcome: '', selectedChoice: '', response: '', responseChecked: false, saved: false,
  };
  $('#studentTracker').hidden = true;
  setup.hidden = true;
  done.hidden = true;
  practice.hidden = false;
  renderItem();
}

function taskCopy() {
  if (state.mode === 'paper') {
    return 'Tutor: read the prompt aloud. The learner can respond on paper or verbally. Use Reveal tutor key only after the response.';
  }
  if (state.strand === 'silent-e') return 'Read the word. Type the new word after adding a final silent e.';
  if (state.strand === 'sort') return 'Read the word aloud, then choose the spelling pattern that fits. The key stays hidden until the tutor reveals it.';
  if (state.strand === 'syllables') return 'Read the tutor-marked word and choose one of the six syllable types.';
  return 'Read the word. Type the tutor-marked VC.CV split with a slash between the parts.';
}

function answerText(item) {
  if (state.strand === 'silent-e') return `Add silent e: ${item.word} → ${item.answer}. ${item.note}`;
  if (state.strand === 'sort') return `Sort ${item.word} under: ${getSortCategory(item.pattern)?.label ?? 'Tutor key unavailable'}.`;
  if (state.strand === 'syllables') return `The marked syllable ${item.focus} in ${item.word} is ${getSyllableType(item.pattern)?.label ?? 'tutor-marked'}. ${getSyllableType(item.pattern)?.description ?? ''}`;
  return `Tutor-marked split: ${item.pattern.replace('/', ' / ')}. ${item.note ?? ''}`;
}

function buildChoiceButtons(choices, className) {
  const group = make('div', '', `choice-grid ${className}`);
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', state.strand === 'sort' ? 'Choose a spelling pattern' : 'Choose a syllable type');
  for (const option of choices) {
    const button = make('button', option.label, 'btn choice-button');
    button.type = 'button';
    button.dataset.choice = option.id;
    button.setAttribute('aria-pressed', String(state.selectedChoice === option.id));
    button.addEventListener('click', () => {
      state.selectedChoice = option.id;
      state.response = option.id;
      state.responseChecked = true;
      renderInteraction();
      $('#practiceStatus').textContent = 'Response noted for the tutor. The correct answer remains covered.';
    });
    group.append(button);
  }
  return group;
}

function renderInteraction() {
  interaction.replaceChildren();
  const item = currentItem();
  if (!item) return;
  if (state.mode === 'paper') {
    const prompt = make('p', taskCopy(), 'paper-prompt');
    interaction.append(prompt);
    return;
  }
  if (state.strand === 'sort') {
    interaction.append(buildChoiceButtons([
      { id: 'floss', label: 'FLOSS' }, { id: 'ai', label: 'ai in the middle' }, { id: 'ay', label: 'ay at the end' },
    ], 'sort-choices'));
    return;
  }
  if (state.strand === 'syllables') {
    interaction.append(buildChoiceButtons([
      { id: 'closed', label: 'Closed' }, { id: 'open', label: 'Open' },
      { id: 'vce', label: 'Vowel-consonant-e' }, { id: 'vowel-team', label: 'Vowel team' },
      { id: 'r-controlled', label: 'R-controlled' }, { id: 'consonant-le', label: 'Consonant-le' },
    ], 'syllable-choices'));
    return;
  }
  const label = make('label', state.strand === 'silent-e'
    ? 'Your new word after adding silent e' : 'Your tutor-marked split (use / between parts)');
  label.htmlFor = 'learnerResponse';
  const input = make('input');
  input.id = 'learnerResponse';
  input.type = 'text';
  input.maxLength = state.strand === 'silent-e' ? 24 : 50;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.value = state.response;
  input.setAttribute('aria-describedby', 'responseStatus');
  const submit = make('button', state.responseChecked ? 'Update response' : 'Record response', 'btn secondary');
  submit.type = 'button';
  const status = make('span', '', 'sr-only');
  status.id = 'responseStatus';
  status.setAttribute('aria-live', 'polite');
  const responseStatus = make('p', state.responseChecked ? 'Response recorded for the tutor.' : '', 'hint');
  submit.addEventListener('click', () => {
    state.response = input.value.trim();
    state.responseChecked = true;
    responseStatus.textContent = state.response ? 'Response recorded for the tutor.' : 'No response entered yet.';
  });
  interaction.append(label, input, submit, status, responseStatus);
}

function renderItem() {
  const item = currentItem();
  if (!item) { completePractice(); return; }
  $('#progressText').textContent = `Item ${state.index + 1} of ${state.items.length}`;
  $('#progressText').setAttribute('aria-label', `Item ${state.index + 1} of ${state.items.length}`);
  $('#strandBadge').textContent = labels[state.strand];
  $('#taskPrompt').textContent = taskCopy();
  $('#itemLabel').textContent = state.strand === 'silent-e' ? 'Start with this word'
    : state.strand === 'sort' ? 'Sort this word'
      : state.strand === 'syllables' ? 'Identify the syllable type'
        : 'Find the tutor-marked division';
  $('#itemWord').textContent = item.word;
  const focus = $('#focusSyllable');
  focus.textContent = state.strand === 'syllables' ? `Classify this marked syllable: ${item.focus}` : '';
  focus.hidden = state.strand !== 'syllables';
  $('#itemNote').textContent = item.note ?? '';
  $('#itemNote').hidden = true;
  answer.textContent = '';
  answer.hidden = true;
  $('#revealAnswer').disabled = false;
  $('#practiceStatus').textContent = '';
  state.selectedOutcome = '';
  state.selectedChoice = '';
  state.response = '';
  state.responseChecked = false;
  outcomeButtons.forEach(button => {
    button.setAttribute('aria-pressed', 'false');
    button.disabled = true;
  });
  $('#nextItem').disabled = true;
  $('#revealAnswer').textContent = 'Reveal tutor key';
  renderInteraction();
  $('#itemWord').focus({ preventScroll: true });
}

function revealAnswer() {
  const item = currentItem();
  if (!item) return;
  answer.textContent = answerText(item);
  answer.hidden = false;
  $('#itemNote').hidden = !(item.note && state.strand !== 'silent-e' && state.strand !== 'vccv');
  $('#revealAnswer').disabled = true;
  outcomeButtons.forEach(button => { button.disabled = false; });
}

function selectOutcome(outcome) {
  state.selectedOutcome = outcome;
  outcomeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.outcome === outcome)));
  $('#nextItem').disabled = false;
  $('#practiceStatus').textContent = `${outcome === 'independent' ? 'Independent' : outcome === 'supported' ? 'With help' : 'Revisit'} selected. Tutor: finish this item to continue.`;
}

function nextItem() {
  if (!state.selectedOutcome) return;
  state.outcomeCounts = recordOutcome(state.outcomeCounts, state.selectedOutcome);
  state.completed += 1;
  state.index += 1;
  renderItem();
}

function saveSession() {
  if (state.saved) return true;
  if (state.completed < 1 || !state.studentId) return false;
  const result = tracker.recordSession({
    studentId: state.studentId,
    activity: 'word-workshop',
    conceptIds: lessonContext?.conceptIds ?? [],
    listLabel: labels[state.strand],
    completedItems: state.completed,
    totalItems: state.items.length,
    outcomeCounts: state.outcomeCounts,
    durationSeconds: Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000)),
  });
  state.saved = Boolean(result.ok);
  return state.saved;
}

function completePractice() {
  const saved = saveSession();
  practice.hidden = true;
  $('#studentTracker').hidden = false;
  done.hidden = false;
  const { independent, supported, revisit } = state.outcomeCounts;
  $('#doneSummary').textContent = `Completed ${state.completed} of ${state.items.length} items in ${labels[state.strand]}. Tutor-confirmed outcomes: ${independent} independent, ${supported} with help, ${revisit} revisit.${state.completed > 0 && !saved ? ' The session could not be saved in browser storage.' : ''}`;
}

function endPractice() {
  const saved = state.completed > 0 ? saveSession() : false;
  practice.hidden = true;
  done.hidden = true;
  $('#studentTracker').hidden = false;
  setup.hidden = false;
  setSetupStatus(state.completed
    ? saved ? `Saved ${state.completed} completed ${state.completed === 1 ? 'item' : 'items'}.` : 'The completed practice could not be saved in browser storage.'
    : 'Practice ended before an item was completed.', state.completed > 0 && !saved);
}

function addAnnotation() {
  const annotation = normalizeVcCvAnnotation({ word: $('#customWord').value, split: $('#customSplit').value, note: $('#customNote').value });
  if (!annotation) {
    $('#annotationStatus').textContent = 'Enter a plain alphabetic word with two vowel-containing parts, joined by a tutor-marked consonant-consonant boundary (for example, basket | bas/ket).';
    return;
  }
  const next = [...customItems.filter(item => item.word !== annotation.word), annotation];
  const result = saveCustomVcCvItems(next);
  customItems = result.items;
  $('#annotationStatus').textContent = result.ok ? `Saved tutor annotation for ${annotation.word}.` : `The annotation for ${annotation.word} is available for this visit, but browser storage did not save it.`;
  $('#customWord').value = '';
  $('#customSplit').value = '';
  $('#customNote').value = '';
}

renderStrandFromContext();
$('#startPractice').addEventListener('click', beginPractice);
$('#endPractice').addEventListener('click', endPractice);
$('#revealAnswer').addEventListener('click', revealAnswer);
$('#nextItem').addEventListener('click', nextItem);
$('#again').addEventListener('click', () => { done.hidden = true; setup.hidden = false; setSetupStatus(''); });
$('#addAnnotation').addEventListener('click', addAnnotation);
outcomeButtons.forEach(button => button.addEventListener('click', () => selectOutcome(button.dataset.outcome)));
