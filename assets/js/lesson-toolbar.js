import { matchesActivityPath } from './activity-routing.mjs';
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
    if (error) {
      const warning = element('p', 'Lesson state could not be read. Browser storage must be available before starting a lesson.');
      warning.setAttribute('role', 'status');
      host.append(warning);
    }
    if (matchesActivityPath(location.pathname, '/activities/lesson-builder.html')) return;
    const link = element('a', 'Plan a lesson');
    link.href = '/activities/lesson-builder.html?wizard=1';
    host.append(link);
    return;
  }
  const section = element('section');
  section.className = 'lesson-toolbar';
  section.setAttribute('aria-label', 'Active lesson');
  const studentLoad = loadStudentData();
  const student = studentLoad.error ? null : studentLoad.data.students.find(item => item.id === active.studentId);
  const step = active.template.steps[active.index];
  const identity = element('p', active.template.name);
  identity.className = 'lesson-toolbar__identity';
  const learner = element('p', `Learner: ${student?.name ?? 'unavailable'}`);
  learner.className = 'lesson-toolbar__learner';
  const progressText = `Step ${active.index + 1} of ${active.template.steps.length} · ${getActivity(step.activityId).label}`;
  const progressLabel = element('p', progressText);
  progressLabel.className = 'lesson-toolbar__progress-label';
  if (active.completedStepIds.includes(step.id)) progressLabel.append(document.createTextNode(' · Previously completed'));
  const progress = element('progress');
  progress.className = 'lesson-toolbar__progress';
  progress.max = active.template.steps.length;
  progress.value = active.index + 1;
  progress.setAttribute('aria-label', `Lesson progress: step ${active.index + 1} of ${active.template.steps.length}`);
  const status = element('p', error ? 'Lesson storage is unavailable.' : '');
  status.setAttribute('role', 'status');
  const controls = element('div');
  controls.className = 'lesson-toolbar__controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Lesson step navigation');
  function button(text, action, disabled = false, destination = controls, className = '') {
    const node = element('button', text);
    node.type = 'button';
    node.disabled = disabled;
    if (className) node.className = className;
    node.addEventListener('click', () => {
      const ready = window.dispatchEvent(new CustomEvent('bright-steps:before-lesson-navigation', { cancelable: true }));
      if (!ready) { status.textContent = 'Completed practice outcomes could not be saved. Retry when browser storage is available.'; return; }
      action();
    });
    destination.append(node);
  }
  function navigate(result) {
    if (!result.ok) { status.textContent = 'Could not update the lesson. Browser storage is unavailable.'; return; }
    const activity = getActivity(result.active.template.steps[result.active.index].activityId);
    if (!activity?.available) { status.textContent = 'This activity is unavailable. Return to Lesson Builder to edit the template.'; return; }
    location.assign(activity.path);
  }
  function finishLesson(state) {
    const currentStudents = loadStudentData();
    const currentStudent = currentStudents.error ? null : currentStudents.data.students.find(item => item.id === state.studentId);
    if (currentStudents.error) { status.textContent = 'Could not verify the lesson learner. The lesson remains active; restore browser storage and try again.'; return; }
    if (!currentStudent) { status.textContent = 'The lesson learner is no longer available. The lesson remains active; return to Lesson Builder after resolving the learner profile.'; return; }
    const id = `lesson-${state.runId}`;
    const result = recordStudentSession({ id, studentId: state.studentId, activity: 'lesson', listLabel: state.template.name,
      conceptIds: state.template.conceptIds, completedItems: state.completedStepIds.length, totalItems: state.template.steps.length });
    if (!result.ok) { status.textContent = 'Could not save lesson completion. Try again when browser storage is available.'; return; }
    if (!endLesson().ok) { status.textContent = 'Could not end the lesson. Browser storage is unavailable.'; return; }
    location.assign(`/activities/lesson-builder.html?completed=${encodeURIComponent(result.session.id)}`);
  }
  button('Back', () => navigate(moveLessonStep(active.index - 1)), active.index === 0);
  button('Finish step', () => {
    // Only the current activity may be completed from this page.
    const result = completeLessonStep(step.id);
    if (!result.ok) { status.textContent = 'Could not save step completion.'; return; }
    if (result.complete) finishLesson(result.active);
    else navigate(result);
  }, !matchesActivityPath(location.pathname, getActivity(step.activityId).path), controls, 'lesson-toolbar__finish');
  button('Next', () => navigate(moveLessonStep(active.index + 1)), active.index === active.template.steps.length - 1);
  const options = element('details');
  options.className = 'lesson-toolbar__options';
  options.append(element('summary', 'Lesson options'));
  const optionActions = element('div');
  optionActions.className = 'lesson-toolbar__option-actions';
  button('End lesson', () => finishLesson(active), false, optionActions);
  const planLink = element('a', 'Review lesson plan');
  planLink.href = '/activities/lesson-builder.html';
  optionActions.append(planLink);
  options.append(optionActions);
  section.append(identity, learner, progressLabel, progress, controls, options, status);
  host.append(section);
}
render();

// Refresh context after a cached page is restored by normal browser navigation.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
