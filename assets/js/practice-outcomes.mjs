/** Shared tutor-confirmed outcomes; no learner response text belongs here. */
const OUTCOMES = new Set(['independent', 'supported', 'revisit']);

export function normalizeOutcome(value) {
  return OUTCOMES.has(value) ? value : '';
}

export function createOutcomeCounts() {
  return { independent: 0, supported: 0, revisit: 0 };
}

export function recordOutcome(counts, value) {
  const outcome = normalizeOutcome(value);
  if (!outcome || !counts || typeof counts !== 'object' || Array.isArray(counts)
    || !Object.hasOwn(counts, outcome) || !Number.isSafeInteger(counts[outcome]) || counts[outcome] < 0) return counts;
  return { ...counts, [outcome]: counts[outcome] + 1 };
}
