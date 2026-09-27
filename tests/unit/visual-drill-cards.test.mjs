import test from 'node:test';
import assert from 'node:assert/strict';
import { visualDrillCards, visualDrillGroups } from '../../data/visual-drill-cards.mjs';

test('original visual drill set has unique complete records and the requested early sequence', () => {
  assert.ok(visualDrillCards.length >= 80);
  assert.equal(new Set(visualDrillCards.map(card => card.id)).size, visualDrillCards.length);
  for (const card of visualDrillCards) {
    assert.ok(card.grapheme && card.keyword && card.picture && card.sound && card.stage && card.group, card.id);
  }
  assert.deepEqual(visualDrillCards.filter(card => card.stage === 'Stage 1 · SATPIN').slice(0, 6).map(card => card.grapheme), ['s', 'a', 't', 'p', 'i', 'n']);
  assert.ok(visualDrillCards.some(card => card.grapheme === 'a' && card.keyword === 'apple' && card.picture === '🍎' && card.sound === '/ă/'));
  for (const group of ['vowels', 'consonants', 'digraphs', 'vowel teams', 'r-controlled', 'welded sounds', 'consonant-le', 'blends']) {
    assert.ok(visualDrillGroups.some(item => item.id === group), `missing group ${group}`);
    assert.ok(visualDrillCards.some(card => card.group === group), `no cards for ${group}`);
  }
});
