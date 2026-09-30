import { getActivity } from '../../data/activity-registry.mjs';
import { loadActiveLesson, moveLessonStep, completeLessonStep, endLesson } from './lesson-context.mjs';
import { loadStudentData, recordStudentSession } from './student-progress-store.mjs';

function element(tag, text) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}
const main = document.querySelector('main');
const host = document.getElementById('lessonToolbar') ?? element('div');
if (!host.parentNode && main) main.prepend(host);
host.id = 'lessonToolbar';

function render() {
  host.replaceChildren();
  const { active, error } = loadActiveLesson();
  if (!active) {
    const link = element('a', 'Plan a lesson');
    link.href = '/activities/lesson-builder.html';
    host.append(link);
    return;
  }
  const section = element('section');
  section.className = 'lesson-toolbar';
  section.setAttribute('aria-label', 'Active lesson');
  const student = loadStudentData().data.students.find(item => item.id === active.studentId);
  const step = active.template.steps[active.index];
  const label = element('p', `${active.template.name} · ${student?.name ?? 'Learner unavailable'} · Step ${active.index + 1} of ${active.template.steps.length}: ${getActivity(step.activityId).label}`);
  const status = element('p', error ? 'Lesson storage is unavailable.' : '');
  status.setAttribute('role', 'status');
  const controls = element('div');
  controls.className = 'lesson-toolbar__controls';
  function button(text, action, disabled = false) {
    const node = element('button', text);
    node.type = 'button';
    node.disabled = disabled;
    node.addEventListener('click', action);
    controls.append(node);
  }
  function navigate(result) {
    if (!result.ok) { status.textContent = 'Could not update the lesson. Browser storage is unavailable.'; return; }
    const activity = getActivity(result.active.template.steps[result.active.index].activityId);
    if (!activity?.available) { status.textContent = 'This activity is unavailable. Return to Lesson Builder to edit the template.'; return; }
    location.assign(activity.path);
  }
  function finishLesson(state) {
    if (student) {
      const result = recordStudentSession({ studentId: state.studentId, activity: 'lesson', listLabel: state.template.name,
        conceptIds: state.template.conceptIds, completedItems: state.completedStepIds.length, totalItems: state.template.steps.length });
      if (!result.ok) { status.textContent = 'Could not save lesson completion. Try again when browser storage is available.'; return; }
    }
    if (!endLesson().ok) { status.textContent = 'Could not end the lesson. Browser storage is unavailable.'; return; }
    location.assign('/activities/lesson-builder.html');
  }
  button('Back', () => navigate(moveLessonStep(active.index - 1)), active.index === 0);
  button('Finish step', () => {
    // Only the current activity may be completed from this page.
    const result = completeLessonStep(step.id);
    if (!result.ok) { status.textContent = 'Could not save step completion.'; return; }
    if (result.complete) finishLesson(result.active);
    else navigate(result);
  }, !location.pathname.endsWith(getActivity(step.activityId).path));
  button('Next', () => navigate(moveLessonStep(active.index + 1)), active.index === active.template.steps.length - 1);
  button('End lesson', () => finishLesson(active));
  section.append(label, controls, status);
  host.append(section);
}
render();

// Refresh context after a cached page is restored by normal browser navigation.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
