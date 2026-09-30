import { visualDrillCards, visualDrillGroups } from '../../data/visual-drill-cards.mjs';
import { getLessonActivityContext } from './lesson-context.mjs';
import { mountStudentTracker } from './student-tracker.js';
import {
  createVisualDrillOutcomeCounts,
  filterVisualDrillCards,
  getLessonDrillSelection,
  recordVisualDrillOutcome,
  selectVisualDrillCards,
  summarizeVisualDrillOutcomes,
} from './visual-drill-logic.mjs';

const $ = selector => document.querySelector(selector);
const stageFilter = $('#stageFilter');
const groupFilter = $('#groupFilter');
const stage = $('#stage');
const count = $('#cardCount');
const flipButton = $('#flipBtn');
const choices = $('#cardChoices');
const context = getLessonActivityContext('visual-drill-cards');
const settings = context?.settings ?? {};
const tracker = mountStudentTracker($('#studentTracker'), { activityLabel: 'Visual Drill Cards' });
const stages = [...new Set(visualDrillCards.map(card => card.stage))];
let visibleCards = [];
let selectedIds = new Set();
let currentIndex = 0;
let isFlipped = false;
const practice = {
  active: false, cards: [], index: 0, flipped: false, outcomes: {}, studentId: '', startedAt: 0, saved: false,
};

function addOption(select, value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.append(option);
}
addOption(stageFilter, 'all', 'All stages');
for (const value of stages) addOption(stageFilter, value, value);
for (const { id, label } of visualDrillGroups) addOption(groupFilter, id, label);

if (context) {
  const preset = typeof settings.preset === 'string' && visualDrillGroups.some(group => group.id === settings.preset)
    ? settings.preset : 'all';
  groupFilter.value = preset;
  selectedIds = new Set(getLessonDrillSelection(visualDrillCards, settings).map(card => card.id));
} else {
  selectedIds = new Set(visualDrillCards.map(card => card.id));
}

function currentFilterCards() {
  return filterVisualDrillCards(visualDrillCards, stageFilter.value, groupFilter.value);
}

function updateVisibleCards() {
  visibleCards = currentFilterCards();
  currentIndex = 0;
  isFlipped = false;
  renderChoices();
  renderBrowseCard();
  updateSelectionStatus();
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderChoices() {
  choices.replaceChildren();
  for (const card of visibleCards) {
    const label = make('label', 'card-choice');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = card.id;
    input.checked = selectedIds.has(card.id);
    input.setAttribute('aria-label', `Include ${card.grapheme}, keyword ${card.keyword}`);
    input.addEventListener('change', () => {
      if (input.checked) selectedIds.add(card.id);
      else selectedIds.delete(card.id);
      updateSelectionStatus();
    });
    const description = make('span', 'choice-description');
    description.append(make('strong', '', card.grapheme), make('span', '', `${card.keyword} · ${card.stage}`));
    label.append(input, description);
    choices.append(label);
  }
  if (!visibleCards.length) choices.append(make('p', 'empty-choice', 'No cards match these filters.'));
}

function updateSelectionStatus(message = '') {
  const status = $('#tutorStatus');
  status.textContent = message || `${selectedIds.size} card${selectedIds.size === 1 ? '' : 's'} selected for recall practice.`;
  $('#startRecallBtn').disabled = selectedIds.size === 0 || practice.active;
}

function renderFlashcard(host, card, flipped, { recalled = false } = {}) {
  host.replaceChildren();
  if (!card) {
    host.append(make('div', 'empty', 'Choose at least one card to begin.'));
    return;
  }
  const wrapper = make('div', 'card-wrap');
  const button = make('button', `flash-card ${flipped ? 'flipped' : ''}`, '');
  button.type = 'button';
  button.id = host === stage ? 'flashCard' : 'recallCard';
  button.setAttribute('aria-pressed', String(flipped));
  button.setAttribute('aria-label', flipped
    ? `Flip back to ${card.grapheme}. Keyword ${card.keyword}; sound ${card.sound}.`
    : `Flip to reveal keyword and sound for ${card.grapheme}.`);
  const front = make('span', 'face front');
  front.setAttribute('aria-hidden', String(flipped));
  const frontTitle = make('span', 'face-label', 'Front · grapheme');
  front.append(frontTitle, make('span', 'grapheme', card.grapheme), make('span', 'tap-hint', 'Tap to reveal keyword'));
  const back = make('span', 'face back');
  back.setAttribute('aria-hidden', String(!flipped));
  const backTitle = make('span', 'face-label', 'Back · keyword and sound');
  const picture = make('span', 'picture', card.picture);
  picture.setAttribute('aria-hidden', 'true');
  back.append(backTitle, picture, make('span', 'keyword', card.keyword), make('span', 'sound', card.sound), make('span', 'meta', `${card.stage} · ${card.group}`));
  front.querySelector('.grapheme').dataset.readingContent = '';
  back.querySelector('.keyword').dataset.readingContent = '';
  back.querySelector('.sound').dataset.readingContent = '';
  button.append(front, back);
  button.addEventListener('click', () => recalled ? flipRecall() : flipBrowse());
  wrapper.append(button);
  if (host === stage) {
    const previous = make('button', 'nav-btn', '‹');
    previous.type = 'button';
    previous.setAttribute('aria-label', 'Previous card');
    previous.disabled = visibleCards.length < 2;
    previous.addEventListener('click', () => moveBrowse(-1));
    const next = make('button', 'nav-btn', '›');
    next.type = 'button';
    next.setAttribute('aria-label', 'Next card');
    next.disabled = visibleCards.length < 2;
    next.addEventListener('click', () => moveBrowse(1));
    host.append(previous, wrapper, next);
  } else host.append(wrapper);
}

function renderBrowseCard() {
  const card = visibleCards[currentIndex];
  count.textContent = card ? `Card ${currentIndex + 1} of ${visibleCards.length}` : 'No cards in this set';
  $('#shuffleBtn').disabled = visibleCards.length < 2;
  flipButton.disabled = !card;
  renderFlashcard(stage, card, isFlipped);
  flipButton.textContent = isFlipped ? 'Show grapheme' : 'Show keyword';
}

function moveBrowse(step) {
  if (!visibleCards.length) return;
  currentIndex = (currentIndex + step + visibleCards.length) % visibleCards.length;
  isFlipped = false;
  renderBrowseCard();
}

function flipBrowse() {
  if (!visibleCards.length) return;
  isFlipped = !isFlipped;
  renderBrowseCard();
}

function renderRecallCard() {
  const card = practice.cards[practice.index];
  const outcome = card ? practice.outcomes[card.id] : null;
  $('#recallProgress').textContent = card ? `Card ${practice.index + 1} of ${practice.cards.length}` : 'No cards';
  renderFlashcard($('#recallStage'), card, practice.flipped, { recalled: true });
  const fieldset = $('#recallOutcomes');
  fieldset.disabled = !practice.flipped || Boolean(outcome);
  $('#outcomeLegend').textContent = outcome
    ? `Recorded first outcome: ${outcome === 'supported' ? 'With help' : outcome}`
    : practice.flipped ? 'Tutor-marked recall outcome' : 'Tutor-marked recall outcome · reveal first';
  document.querySelectorAll('.outcome').forEach(button => {
    button.setAttribute('aria-pressed', String(outcome === button.dataset.outcome));
  });
  $('#revealRecallBtn').textContent = practice.flipped ? 'Hide keyword' : 'Show keyword';
  $('#previousRecallBtn').disabled = practice.index === 0;
  $('#nextRecallBtn').textContent = practice.index === practice.cards.length - 1 ? 'Finish recall practice' : 'Next card';
  $('#recallHint').textContent = outcome
    ? 'This card’s first tutor-marked outcome is recorded and cannot be changed during this practice.'
    : practice.flipped ? 'Mark the learner’s recall, or move on without recording an outcome.' : 'Say the sound aloud. Reveal the keyword before recording a tutor-confirmed outcome.';
}

function flipRecall() {
  if (!practice.active) return;
  practice.flipped = !practice.flipped;
  renderRecallCard();
}

function saveRecall() {
  if (practice.saved) return true;
  const counts = summarizeVisualDrillOutcomes(practice.outcomes);
  const completedItems = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (!practice.studentId || !completedItems) return false;
  const result = tracker.recordSession({
    studentId: practice.studentId,
    activity: 'visual-drill-cards',
    conceptIds: context?.conceptIds ?? [],
    listLabel: `${completedItems} tutor-marked recall${completedItems === 1 ? '' : 's'}`,
    completedItems,
    totalItems: practice.cards.length,
    outcomeCounts: counts,
    durationSeconds: Math.max(0, Math.floor((Date.now() - practice.startedAt) / 1000)),
  });
  practice.saved = Boolean(result?.ok);
  return practice.saved;
}

function finishRecall() {
  if (!practice.active) return;
  const saved = saveRecall();
  practice.active = false;
  $('#recallPanel').hidden = true;
  $('#donePanel').hidden = false;
  $('#studentTracker').hidden = false;
  const counts = summarizeVisualDrillOutcomes(practice.outcomes);
  const rated = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const learnerMessage = practice.studentId
    ? (rated && saved ? ' Outcomes were saved to learner history.' : rated ? ' The session could not be saved in browser storage.' : ' No outcomes were marked, so no session was saved.')
    : ' No learner was selected, so outcomes were not saved.';
  $('#doneText').textContent = `You marked ${rated} of ${practice.cards.length} selected cards: ${counts.independent} independent, ${counts.supported} with help, ${counts.revisit} revisit.${learnerMessage}`;
  updateSelectionStatus();
}

function startRecall() {
  const cards = selectVisualDrillCards(visualDrillCards, [...selectedIds]);
  if (!cards.length) {
    updateSelectionStatus('Select at least one valid card before starting recall practice.');
    return;
  }
  practice.active = true;
  practice.cards = cards;
  practice.index = 0;
  practice.flipped = false;
  practice.outcomes = {};
  practice.studentId = tracker.getSelectedStudent()?.id ?? '';
  practice.startedAt = Date.now();
  practice.saved = false;
  $('#donePanel').hidden = true;
  $('#studentTracker').hidden = true;
  $('.tutor-tools').hidden = true;
  $('.browse-tools').hidden = true;
  $('#recallPanel').hidden = false;
  renderRecallCard();
  $('#recallCard').focus();
}

function selectOutcome(outcome) {
  const card = practice.cards[practice.index];
  if (!card || !practice.flipped || !['independent', 'supported', 'revisit'].includes(outcome)) return;
  const result = recordVisualDrillOutcome(practice.outcomes, card.id, outcome);
  if (result.added) practice.outcomes = result.outcomes;
  renderRecallCard();
}

function moveRecall(step) {
  if (step > 0 && practice.index === practice.cards.length - 1) { finishRecall(); return; }
  const next = practice.index + step;
  if (next < 0 || next >= practice.cards.length) return;
  practice.index = next;
  practice.flipped = false;
  renderRecallCard();
  $('#recallCard').focus();
}

stageFilter.addEventListener('change', updateVisibleCards);
groupFilter.addEventListener('change', updateVisibleCards);
$('#selectVisibleBtn').addEventListener('click', () => {
  for (const card of visibleCards) selectedIds.add(card.id);
  renderChoices();
  updateSelectionStatus();
});
$('#clearSelectionBtn').addEventListener('click', () => {
  for (const card of visibleCards) selectedIds.delete(card.id);
  renderChoices();
  updateSelectionStatus();
});
flipButton.addEventListener('click', flipBrowse);
$('#shuffleBtn').addEventListener('click', () => {
  for (let index = visibleCards.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [visibleCards[index], visibleCards[other]] = [visibleCards[other], visibleCards[index]];
  }
  currentIndex = 0;
  isFlipped = false;
  renderBrowseCard();
});
$('#startRecallBtn').addEventListener('click', startRecall);
$('#revealRecallBtn').addEventListener('click', flipRecall);
$('#previousRecallBtn').addEventListener('click', () => moveRecall(-1));
$('#nextRecallBtn').addEventListener('click', () => moveRecall(1));
$('#endRecallBtn').addEventListener('click', finishRecall);
$('#returnToDeckBtn').addEventListener('click', () => {
  $('#donePanel').hidden = true;
  $('.tutor-tools').hidden = false;
  $('.browse-tools').hidden = false;
  $('#studentTracker').hidden = false;
  updateSelectionStatus();
});
document.querySelectorAll('.outcome').forEach(button => button.addEventListener('click', () => selectOutcome(button.dataset.outcome)));
window.addEventListener('keydown', event => {
  const target = event.target;
  const interactive = typeof target?.closest === 'function'
    && target.closest('button, a, input, select, textarea, [contenteditable=""], [contenteditable="true"], [role="button"], [role="link"]');
  if (event.altKey || event.ctrlKey || event.metaKey || !target || target.isContentEditable) return;
  if (interactive && (!interactive.matches('.flash-card') || event.code === 'Space')) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') event.preventDefault();
  if (!practice.active) {
    if (event.code === 'Space') { event.preventDefault(); flipBrowse(); }
    if (event.key === 'ArrowRight') moveBrowse(1);
    if (event.key === 'ArrowLeft') moveBrowse(-1);
    return;
  }
  if (event.code === 'Space') { event.preventDefault(); flipRecall(); }
  if (event.key === 'ArrowRight') moveRecall(1);
  if (event.key === 'ArrowLeft') moveRecall(-1);
});

updateVisibleCards();

if (context) {
  const firstSelected = visibleCards.findIndex(card => selectedIds.has(card.id));
  if (firstSelected >= 0) { currentIndex = firstSelected; renderBrowseCard(); }
}
