import { AVAILABLE_PRACTICE_ACTIVITIES } from '../../data/activity-registry.mjs';

const summaries = {
  'sound-boxes': 'Listen to a tutor-spoken word, move a counter for each sound, then reveal the spelling.',
  'auditory-dictation': 'Write tutor-spoken sounds and words on paper or screen. Reveal accepted spellings and mark the response.',
  'word-workshop': 'Explore silent e, spelling sorts, syllable types, and tutor-annotated syllable divisions.',
};
const grid = document.querySelector('.grid');
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}
for (const activity of AVAILABLE_PRACTICE_ACTIVITIES) {
  if (!summaries[activity.id] || grid.querySelector(`a[href="${activity.path.slice(1)}"]`)) continue;
  const link = node('a', 'activity');
  link.href = activity.path.slice(1);
  const top = node('div', 'activity-top');
  const icon = node('span', 'icon lime', 'Aa');
  icon.setAttribute('aria-hidden', 'true');
  top.append(icon, node('span', 'tag', 'Tutor-led practice'));
  const launch = node('div', 'launch');
  launch.append(node('span', '', 'Open activity'));
  link.append(top, node('h3', '', activity.label), node('p', '', summaries[activity.id]), launch);
  grid.append(link);
}
document.querySelector('.count').textContent = `${grid.querySelectorAll('a.activity').length} tools`;
