import { ASSESSMENT_ITEMS } from '../../data/assessment-scope-sequence.mjs';
import { TUTOR_SUGGESTIONS } from '../../data/tutor-suggestions.mjs';
import { loadActiveLesson } from './lesson-context.mjs';
import { getSuggestionsForConcept, getTutorSuggestion, saveSuggestionAsReadingList } from './tutor-suggestions-logic.mjs';

const $ = selector => document.querySelector(selector);
const select = $('#suggestionSelect');
const panel = $('#suggestionPanel');
const status = $('#suggestionStatus');
const suggestionById = new Map(TUTOR_SUGGESTIONS.map(item => [item.id, item]));
const conceptById = new Map(ASSESSMENT_ITEMS.map(item => [item.id, item]));

function make(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function setStatus(message, error = false) {
  status.textContent = message;
  status.dataset.error = error ? 'true' : 'false';
}

function fillSelector() {
  const groups = new Map();
  for (const suggestion of TUTOR_SUGGESTIONS) {
    if (!groups.has(suggestion.level)) groups.set(suggestion.level, []);
    groups.get(suggestion.level).push(suggestion);
  }
  for (const [level, suggestions] of groups) {
    const group = document.createElement('optgroup');
    group.label = level;
    for (const suggestion of suggestions) {
      const option = document.createElement('option');
      option.value = suggestion.id;
      option.textContent = suggestion.title;
      group.append(option);
    }
    select.append(group);
  }
}

function refreshUseButton() {
  const lesson = loadActiveLesson();
  const active = Boolean(lesson.active);
  const unavailable = Boolean(lesson.error);
  $('#activeLessonNote').hidden = !active && !unavailable;
  $('#useSet').disabled = !select.value || active || unavailable;
  if (unavailable) $('#activeLessonNote').textContent = 'Lesson storage is unavailable. The set cannot be started while lesson state is unknown.';
  else $('#activeLessonNote').textContent = 'End the active lesson to start this set. You can use these words in a later lesson.';
}

function renderSuggestion(id) {
  const suggestion = getTutorSuggestion(id);
  panel.hidden = !suggestion;
  status.textContent = '';
  if (!suggestion) { refreshUseButton(); return; }
  $('#suggestionLevel').textContent = suggestion.level;
  $('#suggestionTitle').textContent = suggestion.title;
  $('#suggestionObservation').textContent = suggestion.observation;
  $('#suggestionReminder').textContent = suggestion.reminder + (suggestion.tutorSplits ? ` Tutor divisions: ${suggestion.tutorSplits.join(', ')}.` : '');
  $('#suggestionWords').replaceChildren(...suggestion.words.map(word => make('li', '', word)));
  const concepts = suggestion.conceptIds.map(conceptId => conceptById.get(conceptId)).filter(Boolean);
  $('#suggestionConcept').textContent = concepts.map(item => `${item.levelLabel} · ${item.title}`).join('; ');
  refreshUseButton();
}

fillSelector();
const params = new URLSearchParams(window.location.search);
const requestedConcept = params.get('concept');
if (requestedConcept) {
  const matches = getSuggestionsForConcept(requestedConcept);
  if (matches.length && suggestionById.has(matches[0].id)) {
    select.value = matches[0].id;
    renderSuggestion(select.value);
  } else {
    setStatus('No word suggestion is linked to that concept. Choose a pattern from the list.', true);
  }
}

select.addEventListener('change', () => renderSuggestion(select.value));
$('#useSet').addEventListener('click', () => {
  const lesson = loadActiveLesson();
  if (lesson.error) { refreshUseButton(); setStatus('Lesson storage is unavailable. Try again when it is available.', true); return; }
  if (lesson.active) { refreshUseButton(); return; }
  const result = saveSuggestionAsReadingList(select.value);
  if (!result.ok) {
    const message = result.error === 'limit' ? 'Reading Words already has the maximum of 12 lists. Remove a list before adding this set.'
      : result.error === 'invalid-storage' ? 'The saved Reading Words lists could not be read safely, so nothing was changed.'
        : result.error === 'unknown-suggestion' ? 'Choose a word set before continuing.'
          : 'Browser storage is unavailable. The word set was not added.';
    setStatus(message, true);
    return;
  }
  setStatus('Word set saved. Opening Reading Words.');
  window.location.assign(`/activities/reading-words.html?list=${encodeURIComponent(result.list.id)}`);
});
