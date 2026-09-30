import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesActivityPath } from '../../assets/js/activity-routing.mjs';

test('activity routes match static file URLs and production clean URLs exactly', () => {
  const path = '/activities/sound-boxes.html';
  assert.equal(matchesActivityPath(path, path), true);
  assert.equal(matchesActivityPath('/activities/sound-boxes', path), true);
  for (const value of ['/other/activities/sound-boxes', '/activities/sound-boxes-extra', '/activities/reading-words', null]) {
    assert.equal(matchesActivityPath(value, path), false);
  }
});
