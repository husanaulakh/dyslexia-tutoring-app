import { createPracticeSession } from './practice-session.mjs';
import { normalizePracticeWord, isSpellingMatch, traceableLetters } from './learning-logic.mjs';
import { mountStudentTracker } from './student-tracker.js';
import { getLessonActivityContext } from './lesson-context.mjs';

(() => {
  let traceTimer = null;
  let traceToken = 0;
  const app = document.getElementById('app');
  const context = getLessonActivityContext('trace-copy-cover-close');
  const tracker = mountStudentTracker(document.getElementById('studentTracker'), { activityLabel: 'Trace, Copy, Cover, Close' });
  const steps = [
    ['Trace', 'Watch each letter appear, then trace it with your finger.'],
    ['Copy', 'Copy the word while it is still visible.'],
    ['Cover', 'Hide the model and spell the word from memory.'],
    ['Close', 'Close your eyes, say the word, and spell it aloud.'],
  ];
  const state = {
    word: '', responseMode: context?.responseMode ?? 'screen', studentId: '', step: 0, spoken: false,
    trace: 0, animating: null, copyValue: '', coverValue: '', coverChecked: false,
    completed: false, coverCorrected: false, coverAttempts: 0, coverCanContinue: false, closeSpoken: false, sessionSaved: false,
  };
  const session = createPracticeSession({
    record: value => tracker.recordSession(value),
    onRecovery: () => tracker.refresh(),
    summary: () => ({ studentId: state.studentId, conceptIds: context?.conceptIds ?? [], activity: 'trace-copy-cover-close', listLabel: 'Word practice', completedItems: state.completed ? 1 : 0, totalItems: 1 }),
  });
  session.bind(window);
  const letters = () => traceableLetters(state.word);
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

  function clearTraceTimer() {
    clearTimeout(traceTimer);
    traceTimer = null;
    traceToken += 1;
  }

  function resetWord(word) {
    session.reset();
    state.completed = false;
    clearTraceTimer();
    state.word = word;
    state.studentId = context?.studentId ?? tracker.getSelectedStudent()?.id ?? '';
    state.step = 0; state.spoken = false; state.trace = 0; state.animating = null;
    state.copyValue = ''; state.coverValue = ''; state.coverChecked = false;
    state.coverCorrected = false; state.coverAttempts = 0; state.coverCanContinue = false;
    state.closeSpoken = false; state.sessionSaved = false;
    render();
  }

  function setup() {
    if (!session.flush()) return;
    clearTraceTimer();
    document.getElementById('newWord').hidden = true;
    const suggested = context?.settings.word ?? '';
    const responseMode = context?.responseMode === 'paper' ? 'paper' : 'screen';
    app.innerHTML = `<section class="card setup" data-tutor-tools><h2>Choose the word for today</h2><p>The tutor enters a word the learner is ready to practise. Start by having the learner read it aloud; the tutor confirms before tracing begins.</p><form id="wordForm"><div class="field"><label for="targetWord">Practice word</label><input id="targetWord" name="word" maxlength="24" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="e.g. bright" value="${esc(suggested)}" required><div class="hint">One word, up to 24 letters. Hyphens and apostrophes are okay.</div><div class="error" id="setupError" role="status" aria-live="polite"></div></div>${context ? `<p class="hint">Lesson response mode: ${responseMode === 'paper' ? 'paper and tutor confirmation' : 'typed response'}.</p>` : '<div class="field mode-field"><label for="responseMode">Response mode</label><select id="responseMode"><option value="screen">Type responses onscreen</option><option value="paper">Paper with tutor confirmation</option></select></div>'}<button class="btn primary" type="submit">Begin this word</button></form></section>`;
    document.getElementById('wordForm').addEventListener('submit', event => {
      event.preventDefault();
      const raw = normalizePracticeWord(document.getElementById('targetWord').value);
      if (!raw) { document.getElementById('setupError').textContent = 'Enter one word using letters, with an optional apostrophe or hyphen.'; return; }
      state.responseMode = context?.responseMode === 'paper' ? 'paper' : context?.responseMode === 'screen' ? 'screen' : document.getElementById('responseMode').value;
      resetWord(raw.toLowerCase());
    });
  }

  function wordBanner() {
    return `<div class="word-banner"><div><small>Today's word</small><strong class="${state.step >= 2 ? 'hidden-word' : ''}">${state.step >= 2 ? '••••••' : esc(state.word)}</strong></div><span aria-hidden="true" style="font-size:28px">${state.step >= 2 ? '◌' : '✦'}</span></div>`;
  }

  function spokenCheck() {
    return `<div class="say-check ${state.spoken ? 'confirmed' : ''}"><p><b>${state.spoken ? 'Word read aloud ✓' : 'First, read the word aloud'}</b>${state.spoken ? 'The tutor has confirmed the learner said the word correctly.' : 'Look at the word together. The tutor listens, then confirms the learner read it correctly.'}</p>${state.spoken ? '' : '<button class="btn" type="button" data-action="confirm-read">Tutor confirms</button>'}</div>`;
  }

  function traceGlyphs() {
    let letterIndex = 0;
    return [...state.word].map(char => {
      if (!/[a-z]/i.test(char)) return `<span aria-hidden="true" class="trace-punctuation">${esc(char)}</span>`;
      const index = letterIndex++;
      let className = 'trace-char';
      if (index < state.trace) className += ' completed';
      else if (index === state.trace && state.animating === index) className += ' current';
      else className += ' pending';
      return `<span class="${className}" data-glyph="${index}" aria-label="Letter ${index + 1}"><svg viewBox="0 0 64 78" aria-hidden="true"><text x="32" y="38" pathLength="1">${esc(char)}</text></svg></span>`;
    }).join('');
  }

  function traceRow() {
    const total = letters().length;
    return `<p>Say the word, then say each letter as you follow it. Click the orange dot to draw the next letter.</p><div class="trace-word" aria-label="Animated letter tracing">${traceGlyphs()}</div><div class="trace-controls" role="group" aria-label="Trace controls" tabindex="-1">${state.trace < total ? `<button class="dot-action" type="button" data-action="trace" ${state.spoken && state.animating === null ? '' : 'disabled'}><span class="dot" aria-hidden="true">•</span><span>${state.animating !== null ? 'Drawing letter…' : `Draw letter ${state.trace + 1}`}</span></button>` : `<span class="counter">All ${total} letters traced</span>`}<span class="counter" aria-live="polite">${Math.min(state.trace,total)} / ${total} letters</span></div>${!state.spoken ? '<p class="copy-help">Confirm the spoken word above to begin.</p>' : ''}${state.trace >= total ? '<button class="btn primary finish-word" type="button" data-action="next">Continue to Copy →</button>' : ''}`;
  }

  function copyRow() {
    if (state.responseMode === 'paper') {
      return `<p>Keep the model visible. The learner copies the word on paper or a whiteboard while saying the word and each letter.</p><div class="word-example" aria-label="Word to copy">${esc(state.word)}</div><button class="btn primary" type="button" data-action="confirm-copy">Tutor confirms copy completed on paper</button><p class="copy-help">The tutor confirms that the learner copied the model; no paper response is stored.</p>`;
    }
    return `<p>Keep the model visible. Say the word and each letter while copying it below.</p><div class="word-example" aria-label="Word to copy">${esc(state.word)}</div><form data-form="copy"><div class="copy-line"><input class="copy-input" id="copyInput" aria-label="Copy the word" autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(state.copyValue)}" placeholder="Type the word"><button class="btn primary" type="submit">Check copy</button></div></form><p class="copy-help">The tutor listens as the learner says the word and letter names.</p>${state.copyValue && state.copyValue !== state.word ? '<p class="feedback try" role="status">Check the letters and try copying the word again.</p>' : ''}`;
  }

  function coverRow() {
    if (state.responseMode === 'paper') {
      return `<p>Cover the model. The learner spells the word from memory on paper or a whiteboard.</p><div class="hidden-reminder">The model is covered. Try spelling it without looking.</div><button class="btn primary" type="button" data-action="confirm-cover">Tutor confirms spelling from memory on paper</button><p class="copy-help">The tutor confirms the attempt. No paper response is stored.</p>`;
    }
    if (state.coverCanContinue) {
      return `<p>Hide the model and say each letter while spelling the word from memory.</p><div class="hidden-reminder">The model is covered. Try spelling it without looking.</div><p class="feedback correction" role="status">The one retry is complete. The tutor can continue with this result.</p><button class="btn primary" type="button" data-action="continue-cover">Tutor confirms continue to Close</button>`;
    }
    return `<p>Hide the model and say each letter while spelling the word from memory.</p><div class="hidden-reminder">The model is covered. Try spelling it without looking.</div><form data-form="cover"><div class="copy-line"><input class="memory-input" id="coverInput" aria-label="Spell the covered word" autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(state.coverValue)}" placeholder="Spell it from memory"><button class="btn primary" type="submit">${state.coverChecked ? 'Check retry' : 'Check spelling'}</button></div></form>${state.coverChecked && !state.coverCorrected ? `<p class="feedback correction" role="status">Compare with the model: <strong>${esc(state.word)}</strong>. Study it, cover it again, and try the whole word once more.</p><button class="btn" type="button" data-action="retry-cover">Try again from memory</button>` : ''}${state.coverCorrected ? '<p class="feedback good" role="status">Spelled accurately. Ready for Close.</p>' : ''}<p class="copy-help">If the spelling needs a fix, uncover the model, study the correct form, cover it again, and retry.</p>`;
  }

  function closeRow() {
    return `<p>Close your eyes or look away. Say the word, then spell it aloud letter by letter. The tutor listens.</p><div class="oral-prompt">“Say the word. Now spell it aloud.”</div>${state.closeSpoken ? `<div class="say-check confirmed"><p><b>Spoken spelling confirmed ✓</b>The learner has said the word and spelled each letter aloud.</p></div><div class="word-example" aria-label="Check the word">${esc(state.word)}</div><p class="copy-help">Open your eyes and compare the word with the spelling you said.</p><button class="btn primary finish-word" type="button" data-action="complete">Finish this word ✓</button>` : '<button class="btn" type="button" data-action="confirm-close">Tutor confirms spoken spelling</button>'}`;
  }

  function stepRow(index) {
    const status = index < state.step ? 'done' : index === state.step ? 'active' : 'locked';
    const summary = state.step > index ? 'Complete ✓' : index === state.step ? 'Your turn' : 'Up next';
    let body = '';
    if (index === 0 && state.step === 0) body = traceRow();
    if (index === 1 && state.step === 1) body = copyRow();
    if (index === 2 && state.step === 2) body = coverRow();
    if (index === 3 && state.step === 3) body = closeRow();
    return `<section class="step-row ${status}" aria-current="${index === state.step ? 'step' : 'false'}"><div class="step-aside"><span class="step-number">${index < state.step ? '✓' : index + 1}</span><div><div class="step-title">${steps[index][0]}</div><div class="step-sub">${steps[index][1]}</div></div></div><div class="step-content">${body || `<p>${summary}</p>`}</div></section>`;
  }

  function render(focusSelector = null) {
    document.getElementById('newWord').hidden = false;
    const progress = Math.round(state.step / 4 * 100);
    app.innerHTML = `<div class="progress-wrap"><span class="progress-label">Step ${Math.min(state.step + 1,4)} of 4</span><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${state.step}"><span style="width:${progress}%"></span></div></div>${wordBanner()}${state.step === 0 ? spokenCheck() : ''}<div class="steps">${steps.map((_, index) => stepRow(index)).join('')}</div>`;
    bind();
    if (focusSelector) app.querySelector(focusSelector)?.focus({ preventScroll: true });
  }

  function saveCompletion() { state.sessionSaved = session.save(); return state.sessionSaved; }

  function completeWord() {
    state.completed = true;
    clearTraceTimer();
    const saved = saveCompletion();
    app.innerHTML = `<section class="card setup completion" style="text-align:center"><div style="font-size:50px;margin:0 0 12px" aria-hidden="true">✦</div><div class="eyebrow">Word practice complete</div><h2 style="margin:9px 0">Practice finished</h2><p>Nice work. The learner traced, copied, recalled, and said the word aloud with tutor feedback.</p><p class="session-status" id="completionStatus" role="status">${!state.studentId ? 'No learner was selected; this practice is not in a learner history.' : saved ? 'Session saved on this device.' : 'The session could not be saved yet. Retry below; completion details are still held on this page.'}</p>${state.studentId && !saved ? '<button class="btn secondary" type="button" id="retrySave">Retry saving session</button>' : ''}<button class="btn primary" type="button" id="again">Practise another word</button></section>`;
    state.copyValue = ''; state.coverValue = '';
    document.getElementById('retrySave')?.addEventListener('click', () => {
      const retrySaved = saveCompletion();
      document.getElementById('completionStatus').textContent = retrySaved
        ? 'Session saved on this device.'
        : 'The session could not be saved yet. Completion details are still held on this page; try again when browser storage is available.';
      document.getElementById('retrySave').hidden = retrySaved;
    });
    document.getElementById('again').addEventListener('click', setup);
    document.getElementById('again').focus({ preventScroll: true });
  }

  function bind() {
    document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
      switch (button.dataset.action) {
        case 'confirm-read': state.spoken = true; render('button[data-action="trace"]'); break;
        case 'trace': {
          if (state.animating !== null || !state.spoken) break;
          if (reducedMotion()) { state.trace += 1; state.animating = null; render(state.trace >= letters().length ? 'button[data-action="next"]' : 'button[data-action="trace"]'); break; }
          state.animating = state.trace; render('.trace-controls');
          const wordAtStart = state.word; const currentToken = ++traceToken;
          traceTimer = setTimeout(() => {
            traceTimer = null;
            if (traceToken !== currentToken || state.word !== wordAtStart || state.step !== 0 || state.animating === null) return;
            state.trace += 1; state.animating = null; render(state.trace >= letters().length ? 'button[data-action="next"]' : 'button[data-action="trace"]');
          }, 850);
          break;
        }
        case 'next': state.step = 1; render(state.responseMode === 'paper' ? 'button[data-action="confirm-copy"]' : '#copyInput'); break;
        case 'confirm-copy': state.copyValue = ''; state.step = 2; render(state.responseMode === 'paper' ? 'button[data-action="confirm-cover"]' : '#coverInput'); break;
        case 'confirm-cover': state.coverChecked = true; state.coverCorrected = true; state.coverValue = ''; state.step = 3; render('button[data-action="confirm-close"]'); break;
        case 'retry-cover': state.coverValue = ''; render('#coverInput'); break;
        case 'continue-cover': state.step = 3; render('button[data-action="confirm-close"]'); break;
        case 'confirm-close': state.closeSpoken = true; render('button[data-action="complete"]'); break;
        case 'complete': completeWord(); break;
      }
    }));
    document.querySelectorAll('[data-form]').forEach(form => form.addEventListener('submit', event => {
      event.preventDefault();
      if (form.dataset.form === 'copy') {
        state.copyValue = document.getElementById('copyInput').value.trim().toLowerCase();
        if (isSpellingMatch(state.copyValue, state.word)) { state.step = 2; render(state.responseMode === 'paper' ? 'button[data-action="confirm-cover"]' : '#coverInput'); }
        else { render('#copyInput'); }
      } else {
        state.coverValue = document.getElementById('coverInput').value.trim().toLowerCase(); state.coverChecked = true;
        state.coverAttempts += 1;
        if (isSpellingMatch(state.coverValue, state.word)) { state.coverCorrected = true; state.step = 3; render('button[data-action="confirm-close"]'); }
        else if (state.coverAttempts >= 2) { state.coverCorrected = false; state.coverCanContinue = true; render('button[data-action="continue-cover"]'); }
        else { state.coverCorrected = false; render('#coverInput'); }
      }
    }));
  }

  document.getElementById('newWord').addEventListener('click', setup);
  setup();
})();
