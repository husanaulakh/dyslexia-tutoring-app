import { createOutcomeCounts as createVisualDrillOutcomeCounts } from './practice-outcomes.mjs';
export { createVisualDrillOutcomeCounts };
const OUTCOMES = new Set(['independent', 'supported', 'revisit']);

export function filterVisualDrillCards(cards, stage = 'all', group = 'all') {
  if (!Array.isArray(cards)) return [];
  return cards.filter(card => {
    const stageMatches = stage === 'all' || card.stage === stage;
    const groupMatches = group === 'all'
      || (group === 'stage' ? card.stage !== 'Extension' : card.group === group);
    return stageMatches && groupMatches;
  });
}

/** Restrict untrusted IDs to the known card catalog and preserve catalog order. */
export function selectVisualDrillCards(cards, ids, { limit = 0 } = {}) {
  if (!Array.isArray(cards)) return [];
  const allowed = new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string' && /^[a-z0-9-]{1,80}$/i.test(id)) : []);
  const selected = cards.filter(card => allowed.has(card.id));
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 0;
  return safeLimit ? selected.slice(0, safeLimit) : selected;
}

export function getLessonDrillSelection(cards, settings = {}) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return [];
  const hasExplicitIds = Object.hasOwn(settings, 'cardIds');
  const selected = hasExplicitIds
    ? selectVisualDrillCards(cards, settings.cardIds)
    : filterVisualDrillCards(cards, 'all', typeof settings.preset === 'string' ? settings.preset : 'all');
  const count = Number.isInteger(settings.count) && settings.count > 0 ? settings.count : 0;
  return count ? selected.slice(0, Math.min(count, 100)) : selected;
}

/** The first tutor-marked outcome for a card is immutable within this practice. */
export function recordVisualDrillOutcome(outcomes, cardId, outcome) {
  if (!outcomes || typeof outcomes !== 'object' || !cardId || !OUTCOMES.has(outcome) || Object.hasOwn(outcomes, cardId)) {
    return { outcomes: outcomes ?? {}, added: false };
  }
  return { outcomes: { ...outcomes, [cardId]: outcome }, added: true };
}

export function summarizeVisualDrillOutcomes(outcomes) {
  const counts = createVisualDrillOutcomeCounts();
  if (!outcomes || typeof outcomes !== 'object' || Array.isArray(outcomes)) return counts;
  for (const outcome of Object.values(outcomes)) if (OUTCOMES.has(outcome)) counts[outcome] += 1;
  return counts;
}
