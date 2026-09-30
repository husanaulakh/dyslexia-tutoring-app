import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeParagraph, parseParagraphs, normalizeParagraphLists,
  normalizeParagraphRows, normalizeComprehensionQuestion, parseComprehensionQuestions,
  buildParagraphReviewQueue, advanceParagraphReviewQueue, createParagraphOutcomeCounts,
  normalizeParagraphOutcome, recordParagraphOutcome,
} from '../../assets/js/paragraph-reading-logic.mjs';

test('paragraph normalization preserves punctuation and line breaks while removing control characters', () => {
  assert.equal(normalizeParagraph('  “A fox!”\r\nIt ran.\u0000  '), '“A fox!”\nIt ran.');
  assert.equal(normalizeParagraph('   '), null);
  assert.equal(normalizeParagraph('<script>alert(1)</script>'), '<script>alert(1)</script>');
  assert.equal(normalizeParagraph('x'.repeat(2001)), null);
  assert.equal(normalizeParagraph({ text: 'unsafe' }), null);
});

test('paragraph input splits on blank lines, trims, removes duplicates, and caps entries', () => {
  assert.deepEqual(parseParagraphs('One line.\ncontinues.\n\n Second. \n\nOne line.\ncontinues.'), [
    'One line.\ncontinues.', 'Second.',
  ]);
  assert.equal(parseParagraphs(Array.from({ length: 35 }, (_, i) => `Paragraph ${i}`)).length, 30);
});

test('saved tutor lists are bounded and normalized without trusting record data', () => {
  assert.deepEqual(normalizeParagraphLists(null, ['A sample.']), [
    { id: 'list-1', name: 'Paragraphs 1', paragraphs: ['A sample.'], questions: [''] },
  ]);
  assert.deepEqual(normalizeParagraphLists([
    { id: '<script>', name: '<b>Lesson</b>', paragraphs: ['A fox.'] },
    null,
    { id: 'lesson_2', name: ' ', paragraphs: ['Safe.', '<img src=x onerror=alert(1)>'] },
  ]), [
    { id: 'list-1', name: 'Lesson', paragraphs: ['A fox.'], questions: [''] },
    { id: 'lesson_2', name: 'Paragraphs 3', paragraphs: ['Safe.', '<img src=x onerror=alert(1)>'], questions: ['', ''] },
  ]);
  assert.equal(normalizeParagraphLists(Array.from({ length: 15 }, (_, i) => ({ name: `L${i}` }))).length, 12);
});

test('each paragraph returns after three others and finishes after one review', () => {
  let queue = buildParagraphReviewQueue(['A.', 'B.', 'C.', 'D.']);
  assert.deepEqual(queue.map(item => item.paragraph), ['A.', 'B.', 'C.', 'D.']);
  const allCards = [queue[0]];
  queue = advanceParagraphReviewQueue(queue);
  assert.deepEqual(queue.map(item => item.paragraph), ['B.', 'C.', 'D.', 'A.']);
  assert.equal(queue.at(-1).isReview, true);
  while (queue.length) {
    allCards.push(queue[0]);
    queue = advanceParagraphReviewQueue(queue);
  }
  assert.deepEqual(queue, []);
  assert.equal(allCards.length, 8);
  assert.equal(allCards.filter(item => item.isReview).length, 4);
  assert.deepEqual(allCards.filter(item => item.isReview).map(item => item.paragraph).sort(), ['A.', 'B.', 'C.', 'D.']);
  assert.deepEqual(buildParagraphReviewQueue(['Only.']).map(item => item.paragraph), ['Only.']);
  assert.deepEqual(advanceParagraphReviewQueue([{ id: '0-first', paragraph: 'Only.', isReview: false }]), [
    { id: '0-first-review', paragraph: 'Only.', question: '', isReview: true },
  ]);
});

test('oral questions stay aligned to paragraph rows through blanks, invalid text, and duplicates', () => {
  const rows = normalizeParagraphRows(['First.', 'First.', '   ', 'Second.'], ['Ask first?', 'duplicate prompt?', 'ignored', 'Ask second?']);
  assert.deepEqual(rows, { paragraphs: ['First.', 'Second.'], questions: ['Ask first?', 'Ask second?'] });
  assert.deepEqual(parseComprehensionQuestions(['First?', '', 'Third?'], 2), ['First?', '']);
  assert.equal(normalizeComprehensionQuestion(`  ${'x'.repeat(600)}  `).length, 500);
  assert.equal(normalizeComprehensionQuestion('Bad\u0000question?'), 'Badquestion?');
  const saved = normalizeParagraphLists([{ paragraphs: ['One.', 'One.', 'Two.'], questions: ['Q one?', 'Q duplicate?', 'Q two?'] }])[0];
  assert.deepEqual(saved.paragraphs, ['One.', 'Two.']);
  assert.deepEqual(saved.questions, ['Q one?', 'Q two?']);
});

test('paragraph reread all is the default; needs-practice reruns only supported or revisit once', () => {
  const makeQueue = () => buildParagraphReviewQueue(['A.', 'B.', 'C.'], ['QA?', '', 'QC?']);
  let queue = makeQueue();
  queue = advanceParagraphReviewQueue(queue, 'independent');
  assert.equal(queue.some(item => item.isReview), true, 'default mode rereads every initial paragraph');
  assert.equal(queue.find(item => item.isReview).question, 'QA?');

  queue = advanceParagraphReviewQueue(makeQueue(), 'independent', 'needs-practice');
  assert.deepEqual(queue.map(item => [item.paragraph, item.isReview]), [['B.', false], ['C.', false]]);
  queue = advanceParagraphReviewQueue(queue, 'supported', 'needs-practice');
  assert.equal(queue.at(-1).paragraph, 'B.');
  assert.equal(queue.at(-1).isReview, true);
  queue = advanceParagraphReviewQueue(queue, 'independent', 'needs-practice');
  assert.equal(queue[0].isReview, true);
  queue = advanceParagraphReviewQueue(queue, 'revisit', 'needs-practice');
  assert.deepEqual(queue, []);
});

test('paragraph outcome counts separate first responses and retries', () => {
  const first = recordParagraphOutcome(recordParagraphOutcome(createParagraphOutcomeCounts(), 'independent'), 'revisit');
  const retry = recordParagraphOutcome(createParagraphOutcomeCounts(), 'supported');
  assert.deepEqual(first, { independent: 1, supported: 0, revisit: 1 });
  assert.deepEqual(retry, { independent: 0, supported: 1, revisit: 0 });
  assert.equal(normalizeParagraphOutcome('unsupported'), '');
});
