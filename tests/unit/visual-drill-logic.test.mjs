import test from 'node:test';
import assert from 'node:assert/strict';
import { visualDrillCards } from '../../data/visual-drill-cards.mjs';
import {
  createVisualDrillOutcomeCounts,
  filterVisualDrillCards,
  getLessonDrillSelection,
  recordVisualDrillOutcome,
  selectVisualDrillCards,
  summarizeVisualDrillOutcomes,
} from '../../assets/js/visual-drill-logic.mjs';

test('tutor filters retain original stage and group browsing', () => {
  assert.deepEqual(filterVisualDrillCards(visualDrillCards, 'Stage 1 · SATPIN', 'consonants').map(card => card.grapheme), ['s', 't', 'p', 'n']);
  assert.ok(filterVisualDrillCards(visualDrillCards, 'all', 'stage').every(card => card.stage !== 'Extension'));
});

test('lesson selection uses only exact valid IDs and applies a bounded count', () => {
  const ids = ['vowels-a-apple', 'consonants-s-sun', '__proto__', '<img src=x onerror=alert(1)>'];
  const selected = selectVisualDrillCards(visualDrillCards, ids, { limit: 1 });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, 'consonants-s-sun');
  assert.deepEqual(getLessonDrillSelection(visualDrillCards, { cardIds: ['bad-id'] }), []);
  assert.equal(getLessonDrillSelection(visualDrillCards, { preset: 'vowels', count: 2 }).length, 2);
  assert.deepEqual(getLessonDrillSelection(visualDrillCards, { cardIds: [], preset: 'all' }), []);
});

test('recall outcomes remain one first rating per selected card and contain no response text', () => {
  let outcomes = {};
  ({ outcomes } = recordVisualDrillOutcome(outcomes, 'vowels-a-apple', 'supported'));
  const duplicate = recordVisualDrillOutcome(outcomes, 'vowels-a-apple', 'independent');
  assert.equal(duplicate.added, false);
  assert.equal(duplicate.outcomes['vowels-a-apple'], 'supported');
  ({ outcomes } = recordVisualDrillOutcome(outcomes, 'consonants-s-sun', 'independent'));
  assert.deepEqual(summarizeVisualDrillOutcomes(outcomes), { independent: 1, supported: 1, revisit: 0 });
  assert.deepEqual(createVisualDrillOutcomeCounts(), { independent: 0, supported: 0, revisit: 0 });
  assert.equal(recordVisualDrillOutcome(outcomes, 'vowels-a-apple', '<img>').added, false);
});
