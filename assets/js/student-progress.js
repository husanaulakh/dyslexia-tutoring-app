import { ASSESSMENT_LEVELS, ASSESSMENT_ITEMS } from '../../data/assessment-scope-sequence.mjs';
import { getStudentAssessmentProgress, setStudentAssessmentStatus } from './student-progress-store.mjs';
import { getActivitiesForConcept } from '../../data/activity-registry.mjs';
import { getSuggestionsForConcept } from './tutor-suggestions-logic.mjs';
import { mountStudentTracker } from './student-tracker.js';

const trackerRoot = document.querySelector('#studentTracker');
const levelsRoot = document.querySelector('#assessmentLevels');
const summary = document.querySelector('#selectedStudentSummary');
const statusMessage = document.querySelector('#assessmentStatus');
const tracker = mountStudentTracker(trackerRoot, {
  activityLabel: 'scope and sequence assessment',
  onStudentChange: renderAssessment,
});

function create(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() === 0) return '';
  return `Updated ${date.toLocaleDateString(undefined, { dateStyle: 'medium' })}`;
}

function getCounts(progress) {
  const counts = { assessed: 0, introduced: 0, developing: 0, secure: 0, revisit: 0 };
  for (const record of Object.values(progress)) {
    counts.assessed += 1;
    counts[record.status] += 1;
  }
  return counts;
}

function createAssessmentItem(item, record, disabled, student) {
  const row = create('article', 'assessment-item');
  const copy = create('div');
  copy.append(create('h4', 'item-title', item.title));
  copy.append(create('p', 'item-detail', item.detail));
  if (record) copy.append(create('span', 'item-updated', formatDate(record.updatedAt)));
  const links = create('div', 'practice-links');
  for (const activity of getActivitiesForConcept(item.id).filter(activity => activity.available)) {
    const link = create('a', '', `Practise: ${activity.label}`);
    link.href = activity.path;
    links.append(link, document.createTextNode(' · '));
  }
  if (getSuggestionsForConcept(item.id).length > 0) {
    const link = create('a', '', 'Word suggestions');
    link.href = `/activities/tutor-suggestions.html?concept=${encodeURIComponent(item.id)}`;
    links.append(link, document.createTextNode(' · '));
  }
  copy.append(links);

  const label = create('label', 'item-status-label', 'Assessment status');
  const select = create('select', 'item-status');
  select.setAttribute('aria-label', `Status for ${item.title}`);
  select.dataset.itemId = item.id;
  select.dataset.status = record?.status ?? '';
  select.disabled = disabled;
  for (const [value, text] of [
    ['', 'Not assessed'],
    ['introduced', 'Introduced'],
    ['developing', 'Developing'],
    ['secure', 'Secure'],
    ['revisit', 'Revisit'],
  ]) {
    const option = create('option', '', text);
    option.value = value;
    select.append(option);
  }
  select.value = record?.status ?? '';
  select.addEventListener('change', () => {
    if (!student) return;
    const result = setStudentAssessmentStatus(student.id, item.id, select.value);
    if (!result.ok) {
      statusMessage.textContent = result.error === 'storage'
        ? 'Browser storage is unavailable; the assessment change could not be saved.'
        : 'This assessment change could not be saved.';
      return;
    }
    statusMessage.textContent = `Saved ${item.title} for ${student.name}.`;
    renderAssessment(student);
  });
  label.append(select);
  row.append(copy, label);
  return row;
}

function renderAssessment(student = tracker.getSelectedStudent()) {
  const selected = student ?? tracker.getSelectedStudent();
  const progress = selected ? getStudentAssessmentProgress(selected.id) : {};
  const counts = getCounts(progress);
  const total = ASSESSMENT_ITEMS.length;
  const previouslyOpen = new Set([...levelsRoot.querySelectorAll('.level-group[open]')].map(level => level.dataset.levelId));
  summary.textContent = selected
    ? `${selected.name}: ${counts.assessed} of ${total} concepts assessed · ${counts.secure} secure · ${counts.developing} developing · ${counts.revisit} to revisit.`
    : 'Add or select a student to begin tracking.';
  levelsRoot.replaceChildren();

  for (const [index, level] of ASSESSMENT_LEVELS.entries()) {
    const details = create('details', 'level-group');
    details.dataset.levelId = level.id;
    details.open = previouslyOpen.size ? previouslyOpen.has(level.id) : index === 0;
    const levelCount = level.strands.flatMap(strand => strand.items).filter(item => progress[item.id]).length;
    const title = create('summary', '', `${level.label} · ${levelCount} of ${level.strands.flatMap(strand => strand.items).length} assessed`);
    details.append(title);
    const content = create('div', 'level-content');
    for (const strand of level.strands) {
      const section = create('section', 'strand');
      section.append(create('h3', '', strand.title));
      for (const item of strand.items) {
        section.append(createAssessmentItem(item, progress[item.id], !selected, selected));
      }
      content.append(section);
    }
    details.append(content);
    levelsRoot.append(details);
  }
}

renderAssessment();
