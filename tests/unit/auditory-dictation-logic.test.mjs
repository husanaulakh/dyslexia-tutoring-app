import test from 'node:test';
import assert from 'node:assert/strict';
import { auditoryDictationItems } from '../../data/auditory-dictation-items.mjs';
import { isAcceptedSpelling, normalizeDictationItem, selectDictationItems } from '../../assets/js/auditory-dictation-logic.mjs';

test('dictation uses an explicit allowlist of accepted spellings', () => {
  const k = auditoryDictationItems.find(item => item.id === 'sound-k');
  assert.deepEqual(k.acceptedSpellings, ['c', 'k', 'ck']);
  assert.equal(isAcceptedSpelling(k, 'K'), true);
  assert.equal(isAcceptedSpelling(k, '<img>'), false);
  assert.equal(isAcceptedSpelling(k, 'q'), false);
  assert.equal(isAcceptedSpelling(auditoryDictationItems.find(item => item.id === 'word-ship'), 'ship'), true);
});

test('dictation annotations reject invalid modes, empty accepted forms, and hostile prompt markup', () => {
  assert.equal(normalizeDictationItem({ kind: 'word', prompt: 'Say cat.', acceptedSpellings: [] }), null);
  assert.equal(normalizeDictationItem({ kind: 'word', prompt: '<img src=x>', acceptedSpellings: ['cat'] }), null);
  assert.equal(normalizeDictationItem({ kind: 'other', prompt: 'Say cat.', acceptedSpellings: ['cat'] }), null);
});

test('lesson selection filters sound or word sets and applies known item IDs', () => {
  assert.ok(selectDictationItems({ preset: 'sounds' }).every(item => item.kind === 'sound'));
  assert.deepEqual(selectDictationItems({ itemIds: ['word-ship'] }).map(item => item.id), ['word-ship']);
});
