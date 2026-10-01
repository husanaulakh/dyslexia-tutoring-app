import test from 'node:test';
import assert from 'node:assert/strict';
import { moveStepBy, placeStepRelative, restoreStepOrder } from '../../assets/js/lesson-reorder.mjs';

const rows = [{ id: 'step-a' }, { id: 'step-b' }, { id: 'step-c' }];

 test('keyboard movement respects bounds and preserves stable step objects', () => {
  const earlier = moveStepBy(rows, 'step-b', -1);
  assert.equal(earlier.moved, true);
  assert.deepEqual(earlier.steps.map(step => step.id), ['step-b', 'step-a', 'step-c']);
  assert.equal(earlier.steps[0], rows[1]);
  assert.equal(moveStepBy(rows, 'step-a', -1).moved, false);
  assert.equal(moveStepBy(rows, 'step-c', 1).moved, false);
});

test('pointer placement moves before or after a target without changing IDs', () => {
  assert.deepEqual(placeStepRelative(rows, 'step-a', 'step-c', true).steps.map(step => step.id), ['step-b', 'step-c', 'step-a']);
  assert.deepEqual(placeStepRelative(rows, 'step-c', 'step-a', false).steps.map(step => step.id), ['step-c', 'step-a', 'step-b']);
  assert.equal(placeStepRelative(rows, 'step-a', 'step-a').moved, false);
});

test('canceled pointer drag restores the snapshot order', () => {
  const changed = placeStepRelative(rows, 'step-a', 'step-c', true).steps;
  assert.deepEqual(restoreStepOrder(changed, rows.map(step => step.id)).map(step => step.id), ['step-a', 'step-b', 'step-c']);
});
