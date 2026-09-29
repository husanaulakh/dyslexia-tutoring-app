import {
  addStudentProfile,
  getRecentStudentSessions,
  getSelectedStudent,
  loadStudentData,
  recordStudentSession,
  setSelectedStudent,
} from './student-progress-store.mjs';

let nextMountId = 0;

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatSession(session) {
  const title = session.listLabel ? `${session.activity}: ${session.listLabel}` : session.activity;
  const when = new Date(session.completedAt);
  const date = Number.isNaN(when.getTime()) || when.getTime() === 0
    ? 'Date unavailable'
    : when.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const progress = `${session.completedItems} of ${session.totalItems} items`;
  const accuracy = session.accuracy === undefined ? '' : ` · ${session.accuracy}% accuracy`;
  const duration = session.durationSeconds === undefined ? '' : ` · ${session.durationSeconds}s`;
  return `${title} · ${progress}${accuracy}${duration} · ${date}`;
}

function statusMessage(root, message, isError = false) {
  const status = root.querySelector('[data-student-status]');
  status.textContent = message;
  status.classList.toggle('student-tracker__status--error', isError);
}

function makeSessionList(sessions) {
  const list = make('ul', 'student-tracker__history');
  if (!sessions.length) {
    list.append(make('li', 'student-tracker__empty', 'No sessions recorded yet.'));
    return list;
  }
  for (const session of sessions) {
    const item = make('li', 'student-tracker__session', formatSession(session));
    list.append(item);
  }
  return list;
}

/**
 * Mount a compact, accessible roster and recent-history panel into a container.
 * Returns { refresh, getSelectedStudent, recordSession, destroy } for activity pages.
 * Privacy notice is shown in the UI: this data remains local to this browser.
 */
export function mountStudentTracker(container, { activityLabel = '', onStudentChange = null } = {}) {
  if (!container || typeof container.replaceChildren !== 'function') {
    throw new TypeError('mountStudentTracker requires a DOM container.');
  }
  const mountId = ++nextMountId;
  const section = make('section', 'student-tracker');
  section.setAttribute('aria-labelledby', `student-tracker-title-${mountId}`);
  const heading = make('h2', 'student-tracker__title', 'Student');
  heading.id = `student-tracker-title-${mountId}`;
  section.append(heading);

  const selectLabel = make('label', 'student-tracker__label', 'Current student');
  const select = make('select', 'student-tracker__select');
  select.id = `student-tracker-select-${mountId}`;
  selectLabel.htmlFor = select.id;
  selectLabel.append(select);
  section.append(selectLabel);

  const form = make('form', 'student-tracker__form');
  const nameLabel = make('label', 'student-tracker__label', 'Add a student (first name or initials)');
  const nameInput = make('input', 'student-tracker__input');
  nameInput.type = 'text';
  nameInput.name = 'studentName';
  nameInput.autocomplete = 'off';
  nameInput.maxLength = 40;
  nameInput.required = true;
  nameInput.setAttribute('aria-describedby', `student-tracker-privacy-${mountId}`);
  nameLabel.append(nameInput);
  const addButton = make('button', 'student-tracker__add', 'Add student');
  addButton.type = 'submit';
  form.append(nameLabel, addButton);
  section.append(form);

  const privacy = make('p', 'student-tracker__privacy',
    'Saved on this device in this browser only; it is not synced. Use a first name or initials. Anyone with access to this browser profile may be able to see it.');
  privacy.id = `student-tracker-privacy-${mountId}`;
  section.append(privacy);

  const status = make('p', 'student-tracker__status', '');
  status.dataset.studentStatus = '';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  section.append(status);

  const historyHeading = make('h3', 'student-tracker__history-title', 'Recent sessions');
  const history = make('div', 'student-tracker__history-wrap');
  section.append(historyHeading, history);
  container.replaceChildren(section);

  function refresh() {
    const { data, error } = loadStudentData();
    const previous = select.value;
    select.replaceChildren();
    const prompt = make('option', '', data.students.length ? 'Choose a student' : 'Add a student to begin');
    prompt.value = '';
    select.append(prompt);
    for (const student of data.students) {
      const option = make('option', '', student.name);
      option.value = student.id;
      select.append(option);
    }
    const selected = data.students.some(student => student.id === previous)
      ? previous
      : data.selectedStudentId;
    select.value = selected;
    select.disabled = data.students.length === 0;
    history.replaceChildren(makeSessionList(selected ? getRecentStudentSessions(selected) : []));
    if (error) statusMessage(section, 'Browser storage is unavailable. Student history may not be saved.', true);
    else if (!status.textContent) statusMessage(section, activityLabel ? `Ready for ${activityLabel}.` : '');
    return getSelectedStudent();
  }

  select.addEventListener('change', () => {
    if (!setSelectedStudent(select.value)) {
      statusMessage(section, 'Could not save the selected student in browser storage.', true);
      refresh();
      return;
    }
    refresh();
    statusMessage(section, `Selected ${getSelectedStudent()?.name ?? 'student'}.`);
    if (typeof onStudentChange === 'function') onStudentChange(getSelectedStudent());
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const result = addStudentProfile(nameInput.value);
    if (!result.ok) {
      const message = result.error === 'invalid-name' ? 'Enter a name or initials using letters, numbers, spaces, apostrophes, or hyphens.'
        : result.error === 'limit' ? 'The local roster is full.'
          : 'Browser storage is unavailable. The student was not saved.';
      statusMessage(section, message, true);
      nameInput.focus();
      return;
    }
    nameInput.value = '';
    refresh();
    statusMessage(section, `Added ${result.student.name}.`);
    if (typeof onStudentChange === 'function') onStudentChange(result.student);
  });

  refresh();
  return {
    refresh,
    getSelectedStudent,
    recordSession(summary) {
      const result = recordStudentSession(summary);
      if (!result.ok) {
        statusMessage(section,
          result.error === 'no-student' ? 'Add or select a student before saving this session.' : 'Could not save this session in browser storage.',
          true);
      } else {
        refresh();
        statusMessage(section, 'Session saved on this device.');
      }
      return result;
    },
    destroy() { container.replaceChildren(); },
  };
}

// Re-export the small app-facing storage API from one import path.
export { getSelectedStudent, recordStudentSession };
