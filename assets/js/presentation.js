const KEY = 'bright-steps-presentation';
const sizes = [100, 125, 150];
const spacings = [1.5, 1.8, 2];
let preferences = { size: 100, spacing: 1.5 };
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  if (sizes.includes(saved?.size)) preferences.size = saved.size;
  if (spacings.includes(saved?.spacing)) preferences.spacing = saved.spacing;
} catch { /* Defaults remain usable without storage. */ }
function make(tag, text) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}
const host = make('section');
host.className = 'presentation-controls';
host.setAttribute('aria-label', 'Presentation controls');
const toggle = make('button', 'Show learner view');
toggle.type = 'button';
toggle.setAttribute('aria-pressed', 'false');
toggle.addEventListener('click', () => {
  const enabled = document.body.classList.toggle('learner-view');
  toggle.textContent = enabled ? 'Show tutor tools' : 'Show learner view';
  toggle.setAttribute('aria-pressed', String(enabled));
});
function select(label, values, key, display) {
  const wrapper = make('label', label);
  const input = make('select');
  input.setAttribute('aria-label', label);
  for (const value of values) {
    const option = make('option', display(value));
    option.value = String(value);
    input.append(option);
  }
  input.value = String(preferences[key]);
  input.addEventListener('change', () => {
    preferences[key] = Number(input.value);
    apply();
    try { localStorage.setItem(KEY, JSON.stringify(preferences)); }
    catch { status.textContent = 'Settings apply now but could not be saved on this device.'; }
  });
  wrapper.append(input);
  return wrapper;
}
const status = make('p');
status.setAttribute('role', 'status');
const notice = make('p', 'Learner view hides editing tools on this screen. Anyone viewing a shared screen sees this same view.');
notice.className = 'presentation-note';
host.append(toggle, select('Text size', sizes, 'size', value => `${value}%`), select('Line spacing', spacings, 'spacing', value => value.toFixed(1)), notice, status);
const main = document.querySelector('main');
const fixedHost = document.getElementById('presentationHost');
if (fixedHost) fixedHost.append(host); else main?.prepend(host);
function apply() {
  document.documentElement.style.setProperty('--reading-scale', preferences.size / 100);
  document.documentElement.style.setProperty('--reading-spacing', preferences.spacing);
  const tutorTargets = '#tutorPanel, #newWord, #backToLists, #doneToLists, #endPractice, #again, #returnToDeckBtn, .lesson-shell .panel, .lesson-actions, #app .setup-grid > .panel:first-child, .item-status-label';
  for (const node of document.querySelectorAll(tutorTargets)) node.setAttribute('data-tutor-tools', '');
  const readingTargets = '[data-reading-content], #practiceWord, #practiceParagraph, #practiceQuestion, #itemWord, #focusSyllable, #targetWord:not(input), #answerSpellings, .grapheme, .keyword, .sound, .tile.exercise, .tile.review, .word-example, .word-banner strong, .oral-prompt, #stage .card, #promptText';
  for (const node of document.querySelectorAll(readingTargets)) {
    node.setAttribute('data-reading-content', '');
    if (!node.dataset.readingBase) node.dataset.readingBase = String(parseFloat(getComputedStyle(node).fontSize));
    node.style.setProperty('--reading-base-size', `${node.dataset.readingBase}px`);
  }
}
apply();
new MutationObserver(() => apply()).observe(document.body, { childList: true, subtree: true });
