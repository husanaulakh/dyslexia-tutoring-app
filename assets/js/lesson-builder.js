import { ASSESSMENT_LEVELS } from '../../data/assessment-scope-sequence.mjs';
import { PRACTICE_ACTIVITIES, getActivity } from '../../data/activity-registry.mjs';
import { visualDrillCards, visualDrillGroups } from '../../data/visual-drill-cards.mjs';
import { normalizeWordLists } from './reading-words-logic.mjs';
import { normalizeParagraphLists } from './paragraph-reading-logic.mjs';
import { mountStudentTracker } from './student-tracker.js';
import {
  loadActiveLesson, loadLessonTemplates, MAX_LESSON_STEPS, MAX_LESSON_TEMPLATES,
  normalizeLessonTemplate, saveLessonTemplates, startLesson,
} from './lesson-context.mjs';

const soundBoxWords = getActivity('sound-boxes')?.available
  ? (await import('../../data/sound-boxes-words.mjs')).soundBoxWords : [];
const auditoryDictationItems = getActivity('auditory-dictation')?.available
  ? (await import('../../data/auditory-dictation-items.mjs')).auditoryDictationItems : [];
const workshopContent = getActivity('word-workshop')?.available
  ? await import('../../data/word-workshop.mjs') : null;
const silentEItems = workshopContent?.silentEItems ?? [];
const sortItems = workshopContent?.sortItems ?? [];
const syllableItems = workshopContent?.syllableItems ?? [];
const vcCvItems = workshopContent?.vcCvItems ?? [];
const workshopStrands = workshopContent?.workshopStrands ?? [];

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

let steps = [];
let templates = [];
let active = null;
let stepSequence = 0;

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
}

function loadWordLists(activityId) {
  const key = activityId === 'reading-words' ? 'bright-steps-reading-word-lists'
    : activityId === 'paragraph-reading' ? 'bright-steps-paragraph-reading-lists' : '';
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [{ id: 'list-1', name: activityId === 'reading-words' ? 'Starter word list' : 'Starter passage list' }];
    const parsed = JSON.parse(raw);
    const lists = activityId === 'reading-words'
      ? normalizeWordLists(parsed)
      : normalizeParagraphLists(parsed);
    return lists.map(list => ({ id: list.id, name: list.name }));
  } catch { return [{ id: 'list-1', name: 'Starter list' }]; }
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
  if (activityId === 'auditory-dictation') return auditoryDictationItems.filter(item => presetSelect.value === 'sounds' ? item.kind === 'sound' : presetSelect.value === 'words' ? item.kind === 'word' : true).map(item => ({ id: item.id, label: `${item.kind === 'word' ? 'Word' : 'Sound'} · ${item.prompt}` }));
  if (activityId === 'word-workshop') {
    const data = { 'silent-e': silentEItems, sort: sortItems, syllables: syllableItems, vccv: vcCvItems }[presetSelect.value] ?? [];
    return data.map(item => ({ id: item.id, label: item.word }));
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
}

function selectedConcepts() {
  return [...document.querySelectorAll('[data-concept-id]:checked')].map(input => input.value);
}

function currentSettings() {
  const activityId = activitySelect.value;
  const settings = {};
  if (activityId === 'word-workshop') settings.workshop = presetSelect.value;
  if (activityId === 'sound-boxes' || activityId === 'auditory-dictation') settings.preset = presetSelect.value;
  const listId = wordListSelect.value;
  if (listId) settings.listId = listId;
  const catalog = selectedItemCatalog(activityId);
  if (catalog.length) {
    const chosen = [...itemSelection.selectedOptions].map(option => option.value);
    if (chosen.length && chosen.length < catalog.length) {
      if (activityId === 'visual-drill-cards') settings.cardIds = chosen;
      else if (activityId === 'sound-boxes') settings.wordIds = chosen;
      else settings.itemIds = chosen;
    }
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
    const title = make('span', 'step-title', `${index + 1}. ${activity?.label ?? 'Practice activity'}`);
    const detailParts = [step.responseMode === 'paper' ? 'Paper or tutor response' : 'On screen'];
    if (step.settings.preset) {
      const preset = presetsFor(step.activityId).find(([value]) => value === step.settings.preset)?.[1];
      if (preset) detailParts.push(preset);
    }
    if (step.settings.listId) {
      const list = loadWordLists(step.activityId).find(item => item.id === step.settings.listId);
      detailParts.push(list?.name ?? 'Selected list');
    }
    if (step.settings.cardIds) detailParts.push(`${step.settings.cardIds.length} selected cards`);
    if (step.settings.wordIds) detailParts.push(`${step.settings.wordIds.length} selected words`);
    if (step.settings.itemIds) detailParts.push(`${step.settings.itemIds.length} selected items`);
    info.append(title, make('span', 'step-description', detailParts.join(' · ')));
    const buttons = make('div', 'step-actions');
    const up = make('button', 'btn secondary', 'Move up');
    up.type = 'button'; up.disabled = index === 0; up.setAttribute('aria-label', `Move ${activity?.label ?? 'step'} up`);
    up.addEventListener('click', () => moveItem(index, -1));
    const down = make('button', 'btn secondary', 'Move down');
    down.type = 'button'; down.disabled = index === steps.length - 1; down.setAttribute('aria-label', `Move ${activity?.label ?? 'step'} down`);
    down.addEventListener('click', () => moveItem(index, 1));
    const remove = make('button', 'btn danger', 'Remove');
    remove.type = 'button'; remove.setAttribute('aria-label', `Remove ${activity?.label ?? 'step'}`);
    remove.addEventListener('click', () => { steps.splice(index, 1); renderSteps(); });
    buttons.append(up, down, remove);
    row.append(info, buttons);
    item.append(row);
    stepList.append(item);
  });
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
  $('#templateName').value = template.name;
  const concepts = new Set(template.conceptIds);
  document.querySelectorAll('[data-concept-id]').forEach(input => { input.checked = concepts.has(input.value); });
  steps = template.steps.map(step => ({ ...step, settings: { ...step.settings } }));
  renderSteps();
}

function currentTemplate() {
  return normalizeLessonTemplate({
    id: $('#savedTemplates').value || makeId('lesson'),
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
  syncTemplatePicker();
  $('#savedTemplates').value = template.id;
  setStatus('Template saved in this browser.');
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

function refreshResumeButton() {
  const result = loadActiveLesson();
  active = result.active;
  const button = $('#resumeLesson');
  button.hidden = !active;
  $('#startLesson').disabled = Boolean(active);
  if (result.error) setStatus('Session storage is unavailable. An active lesson cannot be resumed.', true);
  else if (active) button.textContent = `Resume lesson · ${active.template.name}`;
}

activitySelect.addEventListener('change', populatePresets);
presetSelect.addEventListener('change', () => populateItemPicker(activitySelect.value));
$('#addStep').addEventListener('click', () => {
  if (steps.length >= MAX_LESSON_STEPS) {
    setStatus(`A lesson can include up to ${MAX_LESSON_STEPS} steps.`, true);
    return;
  }
  const activity = getActivity(activitySelect.value);
  if (!activity?.available || !activity.supportedModes.includes(responseMode.value)) {
    setStatus('Choose an available activity and response mode.', true);
    return;
  }
  stepSequence += 1;
  steps.push({ id: makeId(`step-${stepSequence}`), activityId: activity.id, responseMode: responseMode.value, settings: currentSettings() });
  renderSteps();
  setStatus(`${activity.label} added to the lesson.`);
});

$('#saveTemplate').addEventListener('click', saveCurrentTemplate);
$('#loadTemplate').addEventListener('click', () => {
  const template = templates.find(item => item.id === $('#savedTemplates').value);
  if (!template) { setStatus('Choose a saved template to load.', true); return; }
  showTemplate(template);
  setStatus(`Loaded ${template.name}.`);
});

$('#startLesson').addEventListener('click', () => {
  if (loadActiveLesson().active) { setStatus('A lesson is already active. Resume it or end it before starting another.', true); refreshResumeButton(); return; }
  const template = currentTemplate();
  if (!template) { setStatus('Enter a template name and add at least one supported practice step.', true); return; }
  if (template.steps.some(step => !getActivity(step.activityId)?.available)) {
    setStatus('This template contains an activity that is not available yet. Remove it before starting.', true);
    return;
  }
  const student = tracker.getSelectedStudent();
  if (!student) { setStatus('Add or select a learner label before starting.', true); $('#studentTracker').scrollIntoView({ block: 'center' }); return; }
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
renderSteps();
refreshResumeButton();
