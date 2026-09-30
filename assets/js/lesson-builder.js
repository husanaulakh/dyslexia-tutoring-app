import { ASSESSMENT_LEVELS } from '../../data/assessment-scope-sequence.mjs';
import { PRACTICE_ACTIVITIES, getActivity } from '../../data/activity-registry.mjs';
import { visualDrillCards, visualDrillGroups } from '../../data/visual-drill-cards.mjs';
import { normalizeWordLists } from './reading-words-logic.mjs';
import { normalizeParagraphLists } from './paragraph-reading-logic.mjs';
import { normalizePracticeWord } from './learning-logic.mjs';
import { loadBlendingBoardWords } from './blending-board-data.mjs';
import { loadWordWorkshopCatalog } from './word-workshop-logic.mjs';
import { mountStudentTracker } from './student-tracker.js';
import { loadStudentData } from './student-progress-store.mjs';
import {
  loadActiveLesson, loadLessonTemplates, MAX_LESSON_STEPS, MAX_LESSON_TEMPLATES,
  normalizeLessonTemplate, saveLessonTemplates, startLesson,
} from './lesson-context.mjs';

const soundBoxWords = getActivity('sound-boxes')?.available
  ? (await import('../../data/sound-boxes-words.mjs')).soundBoxWords : [];
const auditoryDictationItems = getActivity('auditory-dictation')?.available
  ? (await import('../../data/auditory-dictation-items.mjs')).auditoryDictationItems : [];
const workshopStrands = getActivity('word-workshop')?.available
  ? (await import('../../data/word-workshop.mjs')).workshopStrands : [];

const $ = selector => document.querySelector(selector);
const tracker = mountStudentTracker($('#studentTracker'), { activityLabel: 'lesson planning' });
const activitySelect = $('#activitySelect');
const responseMode = $('#responseMode');
const presetSelect = $('#activityPreset');
const presetField = $('#presetField');
const wordListSelect = $('#wordList');
const wordListField = $('#wordListField');
const itemPickerField = $('#itemPickerField');
const itemSelection = $('#itemSelection');
const stepList = $('#lessonSteps');
const status = $('#builderStatus');
const DRAFT_KEY = 'bright-steps-lesson-builder-draft';
const WIZARD_STAGES = ['Learner and plan', 'Concepts', 'Activities', 'Review and start'];

let steps = [];
let templates = [];
let active = null;
let stepSequence = 0;
let selectedTemplateId = '';
let editingStepId = '';
let wizardMode = false;
let wizardIndex = 0;

function make(tag, className = '', value = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
}

function setStatus(message, error = false) {
  status.textContent = message;
  status.dataset.error = error ? 'true' : 'false';
}

function makeId(prefix) {
  try { if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`; } catch { /* portable fallback */ }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function addOption(select, value, label) {
  const option = make('option', '', label);
  option.value = value;
  select.append(option);
}

function populateActivities() {
  for (const activity of PRACTICE_ACTIVITIES.filter(item => item.available)) {
    addOption(activitySelect, activity.id, activity.label);
  }
}

function buildConceptPicker() {
  const host = $('#conceptPicker');
  for (const level of ASSESSMENT_LEVELS) {
    const details = make('details', 'concept-group');
    const summary = make('summary', '', level.label);
    const options = make('div', 'concept-options');
    for (const strand of level.strands) {
      for (const concept of strand.items) {
        const label = make('label', 'concept-option');
        const checkbox = make('input');
        checkbox.type = 'checkbox';
        checkbox.value = concept.id;
        checkbox.dataset.conceptId = concept.id;
        const text = make('span', '', concept.title);
        text.title = `${strand.title}: ${concept.detail}`;
        label.append(checkbox, text);
        options.append(label);
      }
    }
    details.append(summary, options);
    host.append(details);
  }
}

function presetsFor(activityId) {
  if (activityId === 'visual-drill-cards') return visualDrillGroups.map(group => [group.id, group.label]);
  const map = {
    'sound-boxes': [['phoneme-mapping', 'Annotated starter words']],
    'auditory-dictation': [['all', 'Sounds and words'], ['sounds', 'Sounds only'], ['words', 'Words only']],
    'word-workshop': workshopStrands.map(strand => [strand.id, strand.label]),
  };
  return map[activityId] ?? [['', 'Use activity default']];
}

function populatePresets() {
  const activity = getActivity(activitySelect.value);
  presetSelect.replaceChildren();
  for (const [value, label] of presetsFor(activitySelect.value)) addOption(presetSelect, value, label);
  presetField.hidden = !['sound-boxes', 'auditory-dictation', 'word-workshop', 'visual-drill-cards'].includes(activitySelect.value);
  const modes = activity?.supportedModes ?? ['screen'];
  responseMode.replaceChildren();
  for (const mode of modes) addOption(responseMode, mode, mode === 'paper' ? 'Paper or tutor response' : 'On screen');
  if (modes.includes('screen')) responseMode.value = 'screen';
  populateWordLists(activitySelect.value);
  populateItemPicker(activitySelect.value);
  $('#tutorWordField').hidden = activitySelect.value !== 'trace-copy-cover-close';
  $('#paragraphSettingsField').hidden = activitySelect.value !== 'paragraph-reading';
  $('#rereadField').hidden = activitySelect.value !== 'paragraph-reading';
  $('#missingCountField').hidden = activitySelect.value !== 'whats-missing-cards';
  $('#missingPositionField').hidden = activitySelect.value !== 'whats-missing-cards';
  $('#boardTileCountField').hidden = activitySelect.value !== 'blending-board';
  const materialLinks = {
    'reading-words': ['Manage word lists', '/activities/reading-words.html'],
    'paragraph-reading': ['Manage paragraph lists', '/activities/paragraph-reading.html'],
    'blending-board': ['Manage the word dictionary', '/activities/blending-board.html'],
    'word-workshop': ['Manage word practice and VC.CV annotations', '/activities/word-workshop.html'],
  };
  const materialLink = materialLinks[activitySelect.value];
  $('#manageMaterialLink').hidden = !materialLink;
  if (materialLink) { $('#manageMaterialLink').textContent = materialLink[0]; $('#manageMaterialLink').href = materialLink[1]; }
}

function loadWordListCatalog(activityId) {
  const key = activityId === 'reading-words' ? 'bright-steps-reading-word-lists'
    : activityId === 'paragraph-reading' ? 'bright-steps-paragraph-reading-lists' : '';
  if (!key) return { lists: [], error: null };
  const fallback = [{ id: 'list-1', name: activityId === 'reading-words' ? 'Starter word list' : 'Starter passage list' }];
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return { lists: fallback, error: null };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { lists: fallback, error: 'invalid-data' };
    const lists = activityId === 'reading-words'
      ? normalizeWordLists(parsed)
      : normalizeParagraphLists(parsed);
    return { lists: lists.map(list => ({ id: list.id, name: list.name })), error: null };
  } catch { return { lists: fallback, error: 'unavailable' }; }
}

function loadWordLists(activityId) {
  return loadWordListCatalog(activityId).lists;
}

function populateWordLists(activityId) {
  const lists = loadWordLists(activityId);
  wordListField.hidden = !lists.length;
  wordListSelect.replaceChildren();
  if (!lists.length) return;
  addOption(wordListSelect, '', 'Use activity default');
  for (const list of lists) addOption(wordListSelect, list.id, list.name);
}

function selectedItemCatalog(activityId) {
  if (activityId === 'visual-drill-cards') {
    const group = presetSelect.value;
    const cards = visualDrillCards.filter(card => group === 'all' || (group === 'stage' ? card.stage !== 'Extension' : card.group === group));
    return cards.map(card => ({ id: card.id, label: `${card.grapheme} · ${card.keyword}` }));
  }
  if (activityId === 'sound-boxes') return soundBoxWords.map(word => ({ id: word.id, label: `${word.word} · ${word.phonemes.length} sounds` }));
  if (activityId === 'blending-board') {
    const tileCount = Number($('#boardTileCount').value) || 0;
    return loadBlendingBoardWords().items
      .filter(item => tileCount === 0 || item.chunks.length === tileCount)
      .map(item => ({ id: item.word, label: `${item.word} · ${item.chunks.length} spelling tiles` }));
  }
  if (activityId === 'auditory-dictation') return auditoryDictationItems.filter(item => presetSelect.value === 'sounds' ? item.kind === 'sound' : presetSelect.value === 'words' ? item.kind === 'word' : true).map(item => ({ id: item.id, label: `${item.kind === 'word' ? 'Word' : 'Sound'} · ${item.prompt}` }));
  if (activityId === 'word-workshop') {
    const data = loadWordWorkshopCatalog(presetSelect.value);
    return data.items.map(item => ({ id: item.id, label: `${item.word}${item.pattern ? ` · ${item.pattern}` : ''}` }));
  }
  return [];
}

function populateItemPicker(activityId) {
  const catalog = selectedItemCatalog(activityId);
  itemPickerField.hidden = !catalog.length;
  itemSelection.replaceChildren();
  for (const item of catalog) {
    const option = make('option', '', item.label);
    option.value = item.id;
    option.selected = true;
    itemSelection.append(option);
  }
  if (activityId === 'blending-board' && loadBlendingBoardWords().error) {
    $('#stepSettingsStatus').textContent = 'The saved Board dictionary could not be fully read. Starter words are shown; original stored data will be left unchanged.';
  }
}

function selectedConcepts() {
  return [...document.querySelectorAll('[data-concept-id]:checked')].map(input => input.value);
}

function currentSettings() {
  const activityId = activitySelect.value;
  const settings = {};
  if (activityId === 'word-workshop') settings.workshop = presetSelect.value;
  if (['sound-boxes', 'auditory-dictation', 'visual-drill-cards'].includes(activityId)) settings.preset = presetSelect.value;
  if (activityId === 'whats-missing-cards') {
    settings.count = Math.max(1, Math.min(24, Number($('#missingCount').value) || 10));
    settings.mode = $('#missingPosition').value;
  }
  if (activityId === 'blending-board') {
    settings.tileCount = Number($('#boardTileCount').value) || 0;
  }
  const listId = wordListSelect.value;
  if (listId) settings.listId = listId;
  if (activityId === 'trace-copy-cover-close' && $('#tutorWord').value.trim()) {
    settings.word = normalizePracticeWord($('#tutorWord').value.trim());
  }
  if (activityId === 'paragraph-reading') {
    settings.questionMode = $('#questionMode').value;
    settings.rereadMode = $('#rereadMode').value;
  }
  const catalog = selectedItemCatalog(activityId);
  if (catalog.length) {
    const chosen = [...itemSelection.selectedOptions].map(option => option.value);
    if (!chosen.length) return null;
    if (chosen.length && chosen.length < catalog.length) {
      if (activityId === 'visual-drill-cards') settings.cardIds = chosen;
      else if (activityId === 'sound-boxes') settings.wordIds = chosen;
      else if (activityId === 'blending-board') settings.wordIds = chosen;
      else settings.itemIds = chosen;
    }
    if (activityId === 'blending-board') settings.wordIds = chosen;
  }
  return settings;
}

function moveItem(index, offset) {
  const next = index + offset;
  if (next < 0 || next >= steps.length) return;
  [steps[index], steps[next]] = [steps[next], steps[index]];
  renderSteps();
  const moved = stepList.querySelector(`[data-step-id="${CSS.escape(steps[next].id)}"]`);
  moved?.focus();
  setStatus(`${getActivity(steps[next].activityId).label} moved to step ${next + 1}.`);
  persistDraft();
}

function renderSteps() {
  stepList.replaceChildren();
  $('#emptySteps').hidden = steps.length > 0;
  steps.forEach((step, index) => {
    const activity = getActivity(step.activityId);
    const item = make('li', 'lesson-step');
    item.dataset.stepId = step.id;
    item.tabIndex = -1;
    const row = make('div', 'step-row');
    const info = make('div', 'step-info');
    const title = make('span', 'step-title', activity?.label ?? 'Practice activity');
    const detailParts = [step.responseMode === 'paper' ? 'Paper or tutor response' : 'On screen'];
    if (step.settings.preset) {
      const preset = presetsFor(step.activityId).find(([value]) => value === step.settings.preset)?.[1];
      if (preset) detailParts.push(preset);
    }
    if (step.settings.workshop) {
      const strand = workshopStrands.find(item => item.id === step.settings.workshop);
      if (strand) detailParts.push(strand.label);
    }
    if (step.settings.listId) {
      const list = loadWordLists(step.activityId).find(item => item.id === step.settings.listId);
      detailParts.push(list?.name ?? 'Selected list');
    }
    if (step.settings.word) detailParts.push(`Tutor word: ${step.settings.word}`);
    if (step.settings.cardIds) detailParts.push(`${step.settings.cardIds.length} selected cards`);
    if (step.settings.wordIds) detailParts.push(`${step.settings.wordIds.length} selected words`);
    if (step.settings.itemIds) detailParts.push(`${step.settings.itemIds.length} selected items`);
    if (step.activityId === 'whats-missing-cards') detailParts.push(`${step.settings.count ?? 10} cards · ${step.settings.mode ?? 'middle'} missing`);
    if (step.activityId === 'blending-board' && step.settings.tileCount) detailParts.push(`${step.settings.tileCount} spelling tiles`);
    info.append(title, make('span', 'step-description', detailParts.join(' · ')));
    const buttons = make('div', 'step-actions');
    const up = make('button', 'btn secondary', 'Move up');
    up.type = 'button'; up.disabled = index === 0; up.setAttribute('aria-label', `Move ${activity?.label ?? 'step'} up`);
    up.addEventListener('click', () => moveItem(index, -1));
    const down = make('button', 'btn secondary', 'Move down');
    down.type = 'button'; down.disabled = index === steps.length - 1; down.setAttribute('aria-label', `Move ${activity?.label ?? 'step'} down`);
    down.addEventListener('click', () => moveItem(index, 1));
    const edit = make('button', 'btn secondary', 'Edit');
    edit.type = 'button'; edit.setAttribute('aria-label', `Edit ${activity?.label ?? 'step'}`);
    edit.addEventListener('click', () => editStep(index));
    const remove = make('button', 'btn danger', 'Remove');
    remove.type = 'button'; remove.setAttribute('aria-label', `Remove ${activity?.label ?? 'step'}`);
    remove.addEventListener('click', () => { if (editingStepId === step.id) cancelStepEdit(); steps.splice(index, 1); renderSteps(); });
    buttons.append(up, down, edit, remove);
    row.append(info, buttons);
    item.append(row);
    stepList.append(item);
  });
  renderReview();
  persistDraft();
}

function persistDraft() {
  const name = $('#templateName')?.value ?? '';
  const draftSteps = steps.length ? steps : [{ id: 'draft-placeholder', activityId: 'reading-words', responseMode: 'screen', settings: {} }];
  const clean = normalizeLessonTemplate({ id: 'lesson-draft', name: name || 'Planning draft', conceptIds: selectedConcepts(), steps: draftSteps });
  if (!clean) return;
  clean.steps = steps.length ? clean.steps.filter(step => step.id !== 'draft-placeholder') : [];
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      name: name.slice(0, 60), conceptIds: clean.conceptIds, steps: clean.steps,
      templateId: selectedTemplateId, wizardMode, wizardIndex,
      form: {
        activityId: activitySelect.value, responseMode: responseMode.value, preset: presetSelect.value,
        listId: wordListSelect.value, selectedIds: [...itemSelection.selectedOptions].map(option => option.value).slice(0, 100),
        word: $('#tutorWord').value.slice(0, 24), questionMode: $('#questionMode').value, rereadMode: $('#rereadMode').value,
        missingCount: $('#missingCount').value, missingPosition: $('#missingPosition').value, boardTileCount: $('#boardTileCount').value,
      },
    }));
  } catch { /* Draft recovery is best effort and must not interrupt planning. */ }
}

function conceptLabel(id) {
  for (const level of ASSESSMENT_LEVELS) {
    for (const strand of level.strands) {
      const item = strand.items.find(concept => concept.id === id);
      if (item) return item.title;
    }
  }
  return '';
}

function renderReview() {
  const host = $('#lessonReview');
  if (!host) return;
  host.replaceChildren();
  const student = tracker.getSelectedStudent();
  const heading = make('p', 'review-learner', `Learner: ${student?.name ?? 'Choose a learner label'}`);
  const concepts = selectedConcepts().map(conceptLabel).filter(Boolean);
  const conceptSummary = make('p', 'review-concepts', `Concepts: ${concepts.length ? concepts.join(', ') : 'None selected'}`);
  host.append(heading, conceptSummary);
  if (active) host.append(make('p', 'active-review-note', `An active lesson is already in progress: ${active.template.name}, step ${active.index + 1} of ${active.template.steps.length}. Resume it using the Resume lesson button. Changes to this plan apply to a future lesson.`));
  const list = make('ol', 'review-steps');
  steps.forEach((step, index) => {
    const activity = getActivity(step.activityId);
    const details = [step.responseMode === 'paper' ? 'Paper or tutor response' : 'On screen'];
    const presetId = step.settings.workshop ?? step.settings.preset;
    if (presetId) {
      const preset = presetsFor(step.activityId).find(([value]) => value === presetId)?.[1]
        ?? workshopStrands.find(item => item.id === presetId)?.label;
      if (preset) details.push(preset);
    }
    if (step.settings.word) details.push(`Tutor word: ${step.settings.word}`);
    if (step.activityId === 'whats-missing-cards') details.push(`${step.settings.count ?? 10} cards · ${step.settings.mode ?? 'middle'} missing`);
    if (step.activityId === 'blending-board' && step.settings.tileCount) details.push(`${step.settings.tileCount} spelling tiles`);
    if (step.settings.listId) details.push(loadWordLists(step.activityId).find(item => item.id === step.settings.listId)?.name ?? 'Selected list');
    if (step.activityId === 'paragraph-reading') {
      details.push(step.settings.questionMode === 'none' ? 'Comprehension prompts hidden' : 'Tutor comprehension prompts');
      details.push(step.settings.rereadMode === 'needs-practice' ? 'Reread needs-practice only' : 'Reread all paragraphs');
    }
    for (const [key, label] of [['cardIds', 'cards'], ['wordIds', 'words'], ['itemIds', 'items']]) {
      if (step.settings[key]) details.push(`${step.settings[key].length} selected ${label}`);
    }
    const item = make('li', '', `${activity?.label ?? 'Practice'} — ${details.join(' · ')}`);
    list.append(item);
  });
  if (!steps.length) list.append(make('li', '', 'No practice steps have been added yet.'));
  host.append(list);
}

function editStep(index) {
  const step = steps[index];
  if (!step) return;
  editingStepId = step.id;
  activitySelect.value = step.activityId;
  populatePresets();
  const preset = step.settings.workshop ?? step.settings.preset ?? '';
  if ([...presetSelect.options].some(option => option.value === preset)) presetSelect.value = preset;
  $('#boardTileCount').value = step.settings.tileCount ?? 0;
  populateItemPicker(step.activityId);
  responseMode.value = step.responseMode;
  wordListSelect.value = step.settings.listId ?? '';
  $('#tutorWord').value = step.settings.word ?? '';
  $('#missingCount').value = step.settings.count ?? 10;
  $('#missingPosition').value = step.settings.mode ?? 'middle';
  $('#boardTileCount').value = step.settings.tileCount ?? 0;
  $('#questionMode').value = step.settings.questionMode === 'none' ? 'none' : 'oral';
  $('#rereadMode').value = step.settings.rereadMode === 'needs-practice' ? 'needs-practice' : 'all';
  const selectedIds = step.settings.cardIds ?? step.settings.wordIds ?? step.settings.itemIds;
  if (selectedIds) {
    for (const option of itemSelection.options) option.selected = selectedIds.includes(option.value);
  }
  $('#addStep').textContent = 'Update step';
  $('#cancelStepEdit').hidden = false;
  $('#stepSettingsStatus').textContent = `Editing step ${index + 1}. Update it to keep the same position and step ID.`;
  $('#add-step-heading').scrollIntoView({ block: 'start', behavior: 'smooth' });
  activitySelect.focus();
}

function cancelStepEdit() {
  editingStepId = '';
  $('#addStep').textContent = 'Add step';
  $('#cancelStepEdit').hidden = true;
  $('#stepSettingsStatus').textContent = '';
}

function showWizardStage(index) {
  wizardIndex = Math.max(0, Math.min(WIZARD_STAGES.length - 1, index));
  for (let i = 0; i < WIZARD_STAGES.length; i += 1) {
    const stage = $(`#wizardStage${i + 1}`);
    stage.hidden = wizardMode && i !== wizardIndex;
    const indicator = $(`[data-wizard-indicator="${i}"]`);
    if (i === wizardIndex) indicator.setAttribute('aria-current', 'step');
    else indicator.removeAttribute('aria-current');
  }
  $('#wizardProgress').textContent = `Step ${wizardIndex + 1} of ${WIZARD_STAGES.length}: ${WIZARD_STAGES[wizardIndex]}`;
  $('#wizardBack').disabled = wizardIndex === 0;
  $('#wizardContinue').hidden = wizardIndex === WIZARD_STAGES.length - 1;
  $('#wizardContinue').textContent = wizardIndex === WIZARD_STAGES.length - 2 ? 'Review lesson' : 'Continue';
  if (wizardMode && wizardIndex === 1) document.querySelectorAll('#conceptPicker details').forEach(group => { group.open = true; });
  if (wizardMode) {
    const heading = $(`#wizardStage${wizardIndex + 1}`).querySelector('h2');
    if (heading) { heading.tabIndex = -1; heading.focus(); }
  }
  renderReview();
  persistDraft();
}

function setWizardMode(enabled) {
  wizardMode = enabled;
  $('#wizardToggle').setAttribute('aria-expanded', String(enabled));
  $('#wizardToggle').textContent = enabled ? 'Use quick edit (show all sections)' : 'Use planning wizard';
  $('#planningWizard').hidden = !enabled;
  $('#wizardNavigation').hidden = !enabled;
  showWizardStage(wizardIndex);
}

function restoreDraftOrActive() {
  const activeLesson = loadActiveLesson().active;
  if (activeLesson) {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
      if (draft && typeof draft === 'object') {
        wizardMode = draft.wizardMode === true;
        wizardIndex = Number.isInteger(draft.wizardIndex) ? Math.max(0, Math.min(WIZARD_STAGES.length - 1, draft.wizardIndex)) : 0;
      }
    } catch { /* Keep quick edit as the fallback. */ }
    showTemplate(activeLesson.template);
    if (templates.some(item => item.id === activeLesson.template.id)) $('#savedTemplates').value = activeLesson.template.id;
    setWizardMode(wizardMode);
    return;
  }
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== 'object') return;
    selectedTemplateId = typeof draft.templateId === 'string' && templates.some(item => item.id === draft.templateId) ? draft.templateId : '';
    wizardMode = draft.wizardMode === true;
    wizardIndex = Number.isInteger(draft.wizardIndex) ? Math.max(0, Math.min(WIZARD_STAGES.length - 1, draft.wizardIndex)) : 0;
    const placeholder = { id: 'draft-placeholder', activityId: 'reading-words', responseMode: 'screen', settings: {} };
    const clean = normalizeLessonTemplate({ id: 'lesson-draft', name: draft.name || 'Planning draft', conceptIds: draft.conceptIds, steps: [...(Array.isArray(draft.steps) ? draft.steps : []), placeholder] });
    if (!clean) return;
    $('#templateName').value = typeof draft.name === 'string' ? draft.name.slice(0, 60) : '';
    const concepts = new Set(clean.conceptIds);
    document.querySelectorAll('[data-concept-id]').forEach(input => { input.checked = concepts.has(input.value); });
    steps = clean.steps.filter(step => step.id !== 'draft-placeholder');
    renderSteps();
    const form = draft.form;
    if (form && typeof form === 'object' && PRACTICE_ACTIVITIES.some(item => item.id === form.activityId && item.available)) {
      activitySelect.value = form.activityId;
      populatePresets();
      if ([...presetSelect.options].some(option => option.value === form.preset)) presetSelect.value = form.preset;
      populateItemPicker(form.activityId);
      if (['paper', 'screen'].includes(form.responseMode) && [...responseMode.options].some(option => option.value === form.responseMode)) responseMode.value = form.responseMode;
      if ([...wordListSelect.options].some(option => option.value === form.listId)) wordListSelect.value = form.listId;
      if (Array.isArray(form.selectedIds)) for (const option of itemSelection.options) option.selected = form.selectedIds.includes(option.value);
      $('#tutorWord').value = typeof form.word === 'string' ? form.word.slice(0, 24) : '';
      $('#questionMode').value = form.questionMode === 'none' ? 'none' : 'oral';
      $('#rereadMode').value = form.rereadMode === 'needs-practice' ? 'needs-practice' : 'all';
    }
    $('#missingCount').value = Math.max(1, Math.min(24, Number(draft.form?.missingCount) || 10));
    $('#missingPosition').value = ['first', 'middle', 'last', 'random'].includes(draft.form?.missingPosition) ? draft.form.missingPosition : 'middle';
    $('#boardTileCount').value = ['0', '2', '3', '4', '5', '6'].includes(String(draft.form?.boardTileCount)) ? String(draft.form.boardTileCount) : '0';
    if (draft.form?.activityId === 'blending-board') {
      populateItemPicker('blending-board');
      if (Array.isArray(draft.form.selectedIds)) for (const option of itemSelection.options) option.selected = draft.form.selectedIds.includes(option.value);
    }
    if (templates.some(item => item.id === selectedTemplateId)) $('#savedTemplates').value = selectedTemplateId;
    setWizardMode(wizardMode);
  } catch { /* Ignore malformed drafts without changing stored plans. */ }
}

function syncTemplatePicker() {
  const select = $('#savedTemplates');
  const previous = select.value;
  select.replaceChildren();
  addOption(select, '', 'Choose a saved template');
  for (const template of templates) addOption(select, template.id, template.name);
  if (templates.some(template => template.id === previous)) select.value = previous;
}

function showTemplate(template) {
  selectedTemplateId = template.id;
  $('#templateName').value = template.name;
  const concepts = new Set(template.conceptIds);
  document.querySelectorAll('[data-concept-id]').forEach(input => { input.checked = concepts.has(input.value); });
  steps = template.steps.map(step => ({ ...step, settings: { ...step.settings } }));
  renderSteps();
  persistDraft();
}

function currentTemplate() {
  return normalizeLessonTemplate({
    id: selectedTemplateId || makeId('lesson'),
    name: $('#templateName').value,
    conceptIds: selectedConcepts(),
    steps,
  });
}

function saveCurrentTemplate() {
  const template = currentTemplate();
  if (!template) { setStatus('Enter a template name and add at least one supported practice step.', true); return; }
  const index = templates.findIndex(item => item.id === template.id);
  if (index < 0 && templates.length >= MAX_LESSON_TEMPLATES) {
    setStatus(`You can save up to ${MAX_LESSON_TEMPLATES} lesson templates in this browser.`, true);
    return;
  }
  const updated = [...templates];
  if (index < 0) updated.push(template); else updated[index] = template;
  const result = saveLessonTemplates(updated);
  if (!result.ok) { setStatus('Browser storage is unavailable. The template was not saved.', true); return; }
  templates = result.templates;
  selectedTemplateId = template.id;
  syncTemplatePicker();
  $('#savedTemplates').value = template.id;
  setStatus('Template saved in this browser.');
  persistDraft();
}

function saveAsNewTemplate() {
  const template = normalizeLessonTemplate({
    id: makeId('lesson'), name: $('#templateName').value, conceptIds: selectedConcepts(), steps,
  });
  if (!template) { setStatus('Enter a template name and add at least one supported practice step.', true); return; }
  if (templates.length >= MAX_LESSON_TEMPLATES) {
    setStatus(`You can save up to ${MAX_LESSON_TEMPLATES} lesson templates in this browser.`, true);
    return;
  }
  const result = saveLessonTemplates([...templates, template]);
  if (!result.ok) { setStatus('Browser storage is unavailable. The template was not saved.', true); return; }
  templates = result.templates;
  selectedTemplateId = template.id;
  syncTemplatePicker();
  $('#savedTemplates').value = template.id;
  setStatus('Saved as a new template. The original template remains unchanged.');
  persistDraft();
}

function navigateToActive(activeLesson) {
  const step = activeLesson?.template.steps[activeLesson.index];
  const activity = step ? getActivity(step.activityId) : null;
  if (!activity?.available) {
    setStatus('This lesson step is not available yet. Choose a currently available activity to continue.', true);
    return;
  }
  window.location.assign(activity.path);
}

function unavailableStepConfiguration(template) {
  for (let index = 0; index < template.steps.length; index += 1) {
    const step = template.steps[index];
    if (['reading-words', 'paragraph-reading'].includes(step.activityId) && step.settings.listId) {
      const catalog = loadWordListCatalog(step.activityId);
      if (catalog.error) {
        const label = step.activityId === 'paragraph-reading' ? 'paragraph list' : 'word list';
        return { index, message: `The selected ${label} “${step.settings.listId}” could not be verified because its saved list data is unreadable. Repair the saved list or use the activity default before starting.` };
      }
      if (!catalog.lists.some(list => list.id === step.settings.listId)) {
        const label = step.activityId === 'paragraph-reading' ? 'paragraph list' : 'word list';
        return { index, message: `The selected saved ${label} “${step.settings.listId}” is no longer available. Choose an existing list or use the activity default before starting.` };
      }
    }
    if (step.activityId === 'blending-board') {
      const { items } = loadBlendingBoardWords();
      const candidates = items.filter(item => !step.settings.tileCount || item.chunks.length === step.settings.tileCount);
      if (step.settings.tileCount && !candidates.length) {
        return { index, message: `No saved Board word has ${step.settings.tileCount} spelling tiles. Change the tile count or add a matching word in the Board dictionary.` };
      }
      if (Array.isArray(step.settings.wordIds)) {
        const missing = step.settings.wordIds.filter(id => !candidates.some(item => item.word === id));
        if (!step.settings.wordIds.length || missing.length) {
          return { index, message: 'One or more selected Board words are no longer available for this tile count. Edit the step, choose available words, or add the missing words in the Board dictionary.' };
        }
      }
    }
    if (step.activityId === 'word-workshop') {
      const strand = step.settings.workshop || 'silent-e';
      const validStrands = new Set(['silent-e', 'sort', 'syllables', 'vccv']);
      const { items } = loadWordWorkshopCatalog(strand);
      if (!validStrands.has(strand) || (Array.isArray(step.settings.itemIds)
        && (!step.settings.itemIds.length || step.settings.itemIds.some(id => !items.some(item => item.id === id))))) {
        return { index, message: 'One or more selected Workshop words are no longer available in this strand. Edit the step and choose available items, or restore the tutor annotations in Word Workshop.' };
      }
    }
  }
  return null;
}

function refreshResumeButton() {
  const result = loadActiveLesson();
  active = result.active;
  const button = $('#resumeLesson');
  button.hidden = !active;
  $('#startLesson').disabled = Boolean(active) || Boolean(result.error);
  const notice = $('#activeLessonNotice');
  notice.hidden = !active;
  if (active) notice.textContent = `An active lesson is in progress (${active.template.name}, step ${active.index + 1} of ${active.template.steps.length}). This builder edits a future plan; the current lesson stays fixed. Use Resume lesson to continue the current sequence.`;
  if (result.error) setStatus('Session storage is unavailable. An active lesson cannot be resumed.', true);
  else if (active) button.textContent = `Resume lesson · ${active.template.name}`;
}

function showCompletionSummary() {
  const requestedId = new URLSearchParams(location.search).get('completed');
  if (!requestedId || !/^[a-zA-Z0-9_-]{1,100}$/.test(requestedId)) return;
  const { data, error } = loadStudentData();
  if (error) return;
  const session = data.sessions.find(item => item.id === requestedId && item.activity === 'lesson');
  if (session) setStatus(`Lesson complete: ${session.completedItems} of ${session.totalItems} practice steps recorded for ${session.listLabel}. You can start a new plan or resume another saved lesson.`);
}

activitySelect.addEventListener('change', populatePresets);
presetSelect.addEventListener('change', () => populateItemPicker(activitySelect.value));
$('#addStep').addEventListener('click', () => {
  if (!editingStepId && steps.length >= MAX_LESSON_STEPS) {
    setStatus(`A lesson can include up to ${MAX_LESSON_STEPS} steps.`, true);
    return;
  }
  const activity = getActivity(activitySelect.value);
  if (!activity?.available || !activity.supportedModes.includes(responseMode.value)) {
    setStatus('Choose an available activity and response mode.', true);
    return;
  }
  if (activity.id === 'blending-board' && !selectedItemCatalog(activity.id).length) {
    $('#stepSettingsStatus').textContent = `No saved Board word has ${Number($('#boardTileCount').value)} spelling tiles. Change the tile count or add a matching word using Manage the word dictionary.`;
    return;
  }
  const settings = currentSettings();
  if (settings === null) {
    $('#stepSettingsStatus').textContent = 'Choose at least one item for this step, or restore a selection before adding it.';
    return;
  }
  if (activity.id === 'trace-copy-cover-close' && $('#tutorWord').value.trim() && !normalizePracticeWord($('#tutorWord').value.trim())) {
    $('#stepSettingsStatus').textContent = 'Enter one word using letters, with an optional apostrophe or hyphen, or leave the tutor word blank.';
    return;
  }
  if (editingStepId) {
    const index = steps.findIndex(step => step.id === editingStepId);
    if (index >= 0) steps[index] = { id: editingStepId, activityId: activity.id, responseMode: responseMode.value, settings };
    cancelStepEdit();
    setStatus(`${activity.label} updated in the lesson.`);
  } else {
    stepSequence += 1;
    steps.push({ id: makeId(`step-${stepSequence}`), activityId: activity.id, responseMode: responseMode.value, settings });
    setStatus(`${activity.label} added to the lesson.`);
  }
  $('#stepSettingsStatus').textContent = '';
  renderSteps();
});

$('#cancelStepEdit').addEventListener('click', cancelStepEdit);

$('#saveTemplate').addEventListener('click', saveCurrentTemplate);
$('#loadTemplate').addEventListener('click', () => {
  const template = templates.find(item => item.id === $('#savedTemplates').value);
  if (!template) { setStatus('Choose a saved template to load.', true); return; }
  showTemplate(template);
  setStatus(`Loaded ${template.name}.`);
});

$('#newPlan').addEventListener('click', () => {
  selectedTemplateId = '';
  $('#savedTemplates').value = '';
  $('#templateName').value = '';
  document.querySelectorAll('[data-concept-id]').forEach(input => { input.checked = false; });
  steps = [];
  cancelStepEdit();
  renderSteps();
  setStatus('Started a new plan. Saved templates are unchanged.');
});

$('#saveAsNewTemplate').addEventListener('click', saveAsNewTemplate);

$('#wizardToggle').addEventListener('click', () => setWizardMode(!wizardMode));
$('#wizardBack').addEventListener('click', () => {
  if (wizardIndex > 0) showWizardStage(wizardIndex - 1);
});
$('#wizardContinue').addEventListener('click', () => {
  if (wizardIndex === 0) {
    if (!tracker.getSelectedStudent()) { setStatus('Choose a learner label before continuing.', true); $('#studentTracker').scrollIntoView({ block: 'center' }); return; }
    if (!$('#templateName').value.trim()) { setStatus('Give this lesson plan a name before continuing.', true); $('#templateName').focus(); return; }
  }
  if (wizardIndex === 2 && !steps.length) { setStatus('Add at least one activity before reviewing the lesson.', true); $('#activitySelect').focus(); return; }
  if (wizardIndex < WIZARD_STAGES.length - 1) showWizardStage(wizardIndex + 1);
  else setStatus('Review the plan above, then choose Start lesson or Save as new template.');
});

$('#templateName').addEventListener('input', persistDraft);
document.querySelectorAll('[data-concept-id]').forEach(input => input.addEventListener('change', () => { renderReview(); persistDraft(); }));
for (const selector of ['#activitySelect', '#responseMode', '#activityPreset', '#wordList', '#itemSelection', '#tutorWord', '#questionMode', '#rereadMode', '#missingCount', '#missingPosition', '#boardTileCount']) {
  $(selector).addEventListener('change', persistDraft);
  $(selector).addEventListener('input', persistDraft);
}
$('#boardTileCount').addEventListener('change', () => populateItemPicker(activitySelect.value));

$('#startLesson').addEventListener('click', () => {
  if (loadActiveLesson().active) { setStatus('A lesson is already active. Resume it or end it before starting another.', true); refreshResumeButton(); return; }
  const template = currentTemplate();
  if (!template) { setStatus('Enter a template name and add at least one supported practice step.', true); return; }
  if (template.steps.some(step => !getActivity(step.activityId)?.available)) {
    setStatus('This template contains an activity that is not available yet. Remove it before starting.', true);
    return;
  }
  const missingConfiguration = unavailableStepConfiguration(template);
  if (missingConfiguration) {
    if (wizardMode) showWizardStage(2);
    editStep(missingConfiguration.index);
    setStatus(missingConfiguration.message, true);
    return;
  }
  const student = tracker.getSelectedStudent();
  if (!student) { setStatus('Add or select a learner label before starting.', true); $('#studentTracker').scrollIntoView({ block: 'center' }); return; }
  persistDraft();
  const result = startLesson(template, student.id);
  if (!result.ok) { setStatus('Could not save the active lesson in session storage.', true); return; }
  setStatus(`Starting ${template.name}.`);
  navigateToActive(result.active);
});

$('#resumeLesson').addEventListener('click', () => {
  const result = loadActiveLesson();
  if (!result.active) { setStatus('No active lesson is available to resume.', true); refreshResumeButton(); return; }
  navigateToActive(result.active);
});

const loadedTemplates = loadLessonTemplates();
templates = loadedTemplates.templates;
syncTemplatePicker();
if (loadedTemplates.error) setStatus('Browser storage is unavailable. Templates cannot be loaded or saved.', true);
populateActivities();
populatePresets();
buildConceptPicker();
restoreDraftOrActive();
renderSteps();
refreshResumeButton();
showCompletionSummary();
if (new URLSearchParams(location.search).get('wizard') === '1') setWizardMode(true);
