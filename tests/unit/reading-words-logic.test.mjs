import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceReviewQueue, buildReviewQueue, normalizeWordLists, normalizeReadingWord, parseReadingWords } from '../../assets/js/reading-words-logic.mjs';

test('reading words accept single words with optional apostrophes or hyphens', () => {
  assert.equal(normalizeReadingWord(' Duck '), 'duck');
  assert.equal(normalizeReadingWord("can't"), "can't");
  assert.equal(normalizeReadingWord('well-known'), 'well-known');
  assert.equal(normalizeReadingWord('two words'), null);
  assert.equal(normalizeReadingWord('<script>'), null);
  assert.equal(normalizeReadingWord('a'.repeat(25)), null);
});

test('word lists tokenize pasted text, normalize case, and remove duplicates', () => {
  assert.deepEqual(parseReadingWords('Tap, duck\nrub; TAP\nbog'), ['tap', 'duck', 'rub', 'bog']);
});

test('saved lists are normalized, bounded, and safely fall back on malformed values', () => {
  assert.deepEqual(normalizeWordLists([{ id: '<img>', name: '<script>List</script>', words: ['cat', '<script>'] }]), [
    { id: 'list-1', name: 'scriptList/script', words: ['cat'] },
  ]);
  assert.equal(normalizeWordLists(null)[0].words.length, 10);
  assert.equal(normalizeWordLists([])[0].name, 'List 1');
});

test('every initial word returns once after three other words', () => {
  let queue = buildReviewQueue(['tap', 'duck', 'rub', 'bog', 'net']);
  assert.equal(queue[0].word, 'tap');
  queue = advanceReviewQueue(queue);
  assert.deepEqual(queue.slice(0, 4).map(item => item.word), ['duck', 'rub', 'bog', 'tap']);
  assert.equal(queue[3].isReview, true);
  let reviews = 0;
  while (queue.length) {
    const current = queue[0];
    if (current.isReview) reviews += 1;
    queue = advanceReviewQueue(queue);
  }
  assert.equal(reviews, 5);
});

test('short lists repeat once and terminate without an endless queue', () => {
  let queue = buildReviewQueue(['cat']);
  assert.equal(queue.length, 1);
  queue = advanceReviewQueue(queue);
  assert.deepEqual(queue.map(item => [item.word, item.isReview]), [['cat', true]]);
  queue = advanceReviewQueue(queue);
  assert.deepEqual(queue, []);
});
