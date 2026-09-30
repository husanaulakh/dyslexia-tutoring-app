import { normalizeSessionSummary, recordStudentSession } from './student-progress-store.mjs';

const PENDING_KEY = 'bright-steps-pending-outcomes';
/** One aggregate record per practice run, including partial saves and retries. */
export function createSessionId(prefix = 'practice') {
  try { if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`; } catch { /* portable fallback */ }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createPracticeSession({ summary, record, onRecovery = () => {} }) {
  let id = createSessionId();
  let savedSignature = '';
  let recoveryStorage;
  let recover = () => true;
  let reportFailure = () => {};
  let clearFailure = () => {};
  function save() {
    const value = summary();
    if (!value?.studentId || !value.completedItems) return false;
    // Duration alone does not create another write after a completed outcome.
    const { durationSeconds, ...aggregate } = value;
    const signature = JSON.stringify(aggregate);
    if (savedSignature === signature) return true;
    try {
      const snapshot = { ...value, id, completedAt: new Date().toISOString() };
      const result = record(snapshot);
      if (!result?.ok) { retain(snapshot); reportFailure(); return false; }
      discard(id);
      savedSignature = signature;
      if (!readPending()?.length) clearFailure();
      return true;
    } catch { retain({ ...value, id, completedAt: new Date().toISOString() }); reportFailure(); return false; }
  }
  function flush() {
    const value = summary();
    return !value?.studentId || !value.completedItems || save();
  }
  function readPending() {
    if (!recoveryStorage) return null;
    try {
      const raw = recoveryStorage.getItem(PENDING_KEY);
      if (raw === null) return [];
      const payload = JSON.parse(raw);
      if (payload?.version !== 1 || !Array.isArray(payload.items) || payload.items.length > 20) return null;
      const items = payload.items.map(normalizeSessionSummary);
      return items.every(Boolean) ? items : null;
    } catch { return null; }
  }
  function writePending(items) {
    try {
      if (!items.length) recoveryStorage.removeItem(PENDING_KEY);
      else recoveryStorage.setItem(PENDING_KEY, JSON.stringify({ version: 1, items }));
      return true;
    } catch { return false; }
  }
  function retain(value) {
    const snapshot = normalizeSessionSummary(value);
    const items = readPending();
    if (!snapshot || !items) return false;
    const remaining = items.filter(item => item.id !== snapshot.id);
    if (remaining.length >= 20) return false;
    return writePending([...remaining, snapshot]);
  }
  function discard(savedId) {
    const items = readPending();
    if (items?.some(item => item.id === savedId)) writePending(items.filter(item => item.id !== savedId));
  }
  function bind(target) {
    const doc = target.document;
    try { recoveryStorage = target.sessionStorage; } catch { recoveryStorage = null; }
    let notice;
    clearFailure = () => { notice?.remove(); notice = null; };
    reportFailure = () => {
      if (!doc || notice?.isConnected) return;
      notice = doc.createElement('section');
      notice.className = 'practice-save-notice';
      notice.setAttribute('aria-label', 'Unsaved practice outcomes');
      const message = doc.createElement('p');
      message.setAttribute('role', 'status');
      message.textContent = 'Completed outcomes could not be saved. Retry saving before leaving this activity.';
      const retry = doc.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Retry saving outcomes';
      retry.addEventListener('click', () => { if (recover() && flush()) clearFailure(); });
      notice.append(message, retry);
      doc.querySelector('main')?.prepend(notice);
    };
    recover = () => {
      const items = readPending();
      if (!items?.length) return true;
      const remaining = items.filter(item => {
        try { return !recordStudentSession(item).ok; } catch { return true; }
      });
      writePending(remaining);
      if (remaining.length < items.length) onRecovery();
      if (remaining.length) reportFailure();
      return remaining.length === 0;
    };
    recover();
    const navigation = event => { if (!recover() || !flush()) event.preventDefault(); };
    const beforeunload = event => {
      if (!recover() || !flush()) {
        event.preventDefault();
        try { event.returnValue = ''; } catch { /* Synthetic events may expose a read-only returnValue. */ }
      }
    };
    const pagehide = () => { flush(); };
    const link = event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
      const destination = new URL(anchor.href, target.location.href);
      if (destination.origin !== target.location.origin || (destination.pathname === target.location.pathname && destination.search === target.location.search)) return;
      if (!flush()) event.preventDefault();
    };
    target.addEventListener('bright-steps:before-lesson-navigation', navigation);
    target.addEventListener('pagehide', pagehide);
    target.addEventListener('beforeunload', beforeunload);
    doc?.addEventListener('click', link);
    return () => {
      target.removeEventListener('bright-steps:before-lesson-navigation', navigation);
      target.removeEventListener('pagehide', pagehide);
      target.removeEventListener('beforeunload', beforeunload);
      doc?.removeEventListener('click', link);
      clearFailure();
    };
  }

  return { save, flush, bind, reset() { id = createSessionId(); savedSignature = ''; } };
}
