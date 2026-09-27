import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanWord, autoChunkWord, parseSoundSplit, tokenizeBulkWords,
  normalizeStoredWord, buildLetterTriplets, chooseMissingIndex,
  normalizePracticeWord, traceableLetters, isSpellingMatch,
} from '../../assets/js/learning-logic.mjs';

test('word input normalization removes non-letters and lowercases', () => {
  assert.equal(cleanWord('Sh!p-42'), 'shp');
  assert.deepEqual(autoChunkWord('ship'), ['sh', 'i', 'p']);
  assert.deepEqual(autoChunkWord('black'), ['b', 'l', 'a', 'ck']);
});

test('sound split accepts matching 3–4 sound chunks and falls back safely', () => {
  assert.deepEqual(parseSoundSplit('b l a ck', 'black'), ['b', 'l', 'a', 'ck']);
  assert.deepEqual(parseSoundSplit('sh i p', 'ship'), ['sh', 'i', 'p']);
  assert.deepEqual(parseSoundSplit('wrong', 'ship'), ['sh', 'i', 'p']);
});

test('bulk word parsing deduplicates and accepts longer spellings for 3–4 sound words', () => {
  assert.deepEqual(tokenizeBulkWords('black think BLACK a xylophone'), ['black', 'think', 'xylophone']);
  assert.deepEqual(autoChunkWord('think'), ['th', 'i', 'n', 'k']);
});

test('stored words are strictly normalized and unsafe values cannot become markup', () => {
  assert.deepEqual(normalizeStoredWord({ word: 'SHIP', chunks: ['sh', 'i', 'p'], lessonTag: 'previous' }), {
    word: 'ship', chunks: ['sh', 'i', 'p'], lessonTag: 'previous',
  });
  assert.equal(normalizeStoredWord({ word: '<img src=x onerror=alert(1)>', chunks: ['img', 'src', 'x', 'onerror'] }), null);
  assert.equal(normalizeStoredWord({ word: 'ship', chunks: ['sh', 'i'] }), null);
  assert.equal(normalizeStoredWord(['ship']), null);
});

test('missing-letter cards cover every adjacent alphabet triplet', () => {
  const triplets = buildLetterTriplets();
  assert.equal(triplets.length, 24);
  assert.deepEqual(triplets[0], ['a', 'b', 'c']);
  assert.deepEqual(triplets.at(-1), ['x', 'y', 'z']);
});

test('missing index supports fixed positions and bounded random values', () => {
  assert.equal(chooseMissingIndex('first'), 0);
  assert.equal(chooseMissingIndex('middle'), 1);
  assert.equal(chooseMissingIndex('last'), 2);
  assert.equal(chooseMissingIndex('random', () => 0.99), 2);
  assert.equal(chooseMissingIndex('random', () => -1), 0);
});

test('TCCC word validation, tracing, and spelling checks handle edge cases', () => {
  assert.equal(normalizePracticeWord('  Bright  '), 'bright');
  assert.equal(normalizePracticeWord('two words'), null);
  assert.equal(normalizePracticeWord('<script>'), null);
  assert.equal(normalizePracticeWord('a'.repeat(25)), null);
  assert.deepEqual(traceableLetters("can't"), ['c', 'a', 'n', 't']);
  assert.equal(isSpellingMatch(' Word ', 'word'), true);
  assert.equal(isSpellingMatch('word', 'ward'), false);
});
