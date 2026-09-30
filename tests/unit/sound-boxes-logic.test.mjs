import test from 'node:test';
import assert from 'node:assert/strict';
import { soundBoxWords } from '../../data/sound-boxes-words.mjs';
import { normalizeSoundBoxItem, parseAnnotatedWords, selectSoundBoxItems } from '../../assets/js/sound-boxes-logic.mjs';

test('starter annotations preserve explicit phoneme counts distinct from written letters', () => {
  const ship = soundBoxWords.find(item => item.word === 'ship');
  assert.equal(ship.word.length, 4);
  assert.equal(ship.phonemes.length, 3);
  assert.deepEqual(ship.phonemes, ['/sh/', '/ĭ/', '/p/']);
  assert.equal(normalizeSoundBoxItem({ word: 'sixphon', phonemes: ['a', 'b', 'c', 'd', 'e', 'f'] }).phonemes.length, 6);
});

test('annotation parser accepts explicit 2–6 sound rows and rejects missing or unsafe annotations', () => {
  const parsed = parseAnnotatedWords('at | /ă/ /t/\nship | /sh/ /ĭ/ /p/\nwrong | /w/');
  assert.equal(parsed.items.length, 2);
  assert.deepEqual(parsed.errors, ['Line 3: enter a word | then 2–6 explicit phonemes.']);
  assert.equal(normalizeSoundBoxItem({ word: '<img>', phonemes: ['x', 'y'] }), null);
  assert.equal(normalizeSoundBoxItem({ word: 'bad', phonemes: ['b', 'a', '<img onerror=1>'] }), null);
  assert.equal(normalizeSoundBoxItem({ word: 'one', phonemes: ['w'] }), null);
  assert.equal(normalizeSoundBoxItem({ word: 'seven', phonemes: ['s','e','v','e','n','t','h'] }), null);
});

test('annotation parser rejects more than forty nonblank rows instead of silently dropping the rest', () => {
  const rows = Array.from({ length: 41 }, () => 'at | /ă/ /t/').join('\n');
  const parsed = parseAnnotatedWords(rows);
  assert.deepEqual(parsed.items, []);
  assert.deepEqual(parsed.errors, ['Enter no more than 40 annotated words at a time.']);
});

test('lesson settings choose tutor-annotated IDs without deriving segmentation', () => {
  const chosen = selectSoundBoxItems({ wordIds: ['ship', 'frog'], count: 1 });
  assert.equal(chosen.length, 1);
  assert.equal(chosen[0].id, 'ship');
  assert.equal(chosen[0].phonemes.length, 3);
});
