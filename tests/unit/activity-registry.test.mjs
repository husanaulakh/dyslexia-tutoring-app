import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY_REGISTRY, AVAILABLE_PRACTICE_ACTIVITIES, PRACTICE_ACTIVITIES, getActivitiesForConcept, getActivity } from '../../data/activity-registry.mjs';
import { ASSESSMENT_ITEM_IDS } from '../../data/assessment-scope-sequence.mjs';

test('registry ids are stable, concepts valid, and lesson activities have supported response modes', () => {
  const ids = ACTIVITY_REGISTRY.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const activity of ACTIVITY_REGISTRY) {
    assert.match(activity.path, /^\/[a-z0-9/-]+\.html$/);
    assert.ok(activity.conceptIds.every(id => ASSESSMENT_ITEM_IDS.has(id)));
    if (PRACTICE_ACTIVITIES.includes(activity)) assert.ok(activity.supportedModes.includes('paper') || activity.supportedModes.includes('screen'));
  }
});

test('lookup helpers are safe and future activities do not appear as available pages', () => {
  assert.equal(getActivity('sound-boxes').available, false);
  assert.equal(getActivity('not-an-activity'), null);
  assert.ok(!AVAILABLE_PRACTICE_ACTIVITIES.some(item => item.id === 'sound-boxes'));
  assert.ok(PRACTICE_ACTIVITIES.some(item => item.id === 'sound-boxes'));
  assert.ok(getActivitiesForConcept('l1-vccv').some(item => item.id === 'word-workshop'));
  assert.deepEqual(getActivitiesForConcept('<script>'), []);
});
