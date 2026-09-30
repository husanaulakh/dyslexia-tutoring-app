import test from 'node:test';
import assert from 'node:assert/strict';
import { TUTOR_SUGGESTIONS } from '../../data/tutor-suggestions.mjs';
import { ASSESSMENT_ITEM_IDS } from '../../data/assessment-scope-sequence.mjs';
import { parseReadingWords } from '../../assets/js/reading-words-logic.mjs';
import {
  MAX_READING_WORD_LISTS, READING_WORD_LISTS_KEY, getSuggestionsForConcept,
  getTutorSuggestion, saveSuggestionAsReadingList,
} from '../../assets/js/tutor-suggestions-logic.mjs';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}
class BrokenStorage { getItem() { throw new Error('blocked'); } setItem() { throw new Error('blocked'); } }

test('suggestion catalog has unique safe IDs, valid concepts, useful observation and pattern guidance, and 8–12 normalized words', () => {
  const ids = TUTOR_SUGGESTIONS.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const suggestion of TUTOR_SUGGESTIONS) {
    assert.match(suggestion.id, /^[a-z0-9-]+$/);
    assert.ok(suggestion.conceptIds.length > 0 && suggestion.conceptIds.every(id => ASSESSMENT_ITEM_IDS.has(id)));
    assert.ok(suggestion.observation.length > 20);
    assert.ok(suggestion.reminder.length > 20);
    assert.ok(suggestion.words.length >= 8 && suggestion.words.length <= 12);
    assert.deepEqual(parseReadingWords(suggestion.words), suggestion.words);
  }
});

test('every VC.CV starter has an explicit tutor boundary between its two middle consonants', () => {
  const suggestion = TUTOR_SUGGESTIONS.find(item => item.id === 'vccv');
  assert.ok(suggestion);
  assert.equal(suggestion.words.length, suggestion.tutorSplits.length);
  const consonant = /^[bcdfghjklmnpqrstvwxyz]$/i;

  for (const [index, annotated] of suggestion.tutorSplits.entries()) {
    const parts = annotated.split('/');
    assert.equal(parts.length, 2, `${annotated} should have one explicit split`);
    const [firstSyllable, secondSyllable] = parts;
    assert.ok(firstSyllable.length >= 2 && secondSyllable.length >= 2);
    assert.match(firstSyllable.at(-1), consonant, `${annotated} needs a consonant before the boundary`);
    assert.match(secondSyllable[0], consonant, `${annotated} needs a consonant after the boundary`);
    assert.equal(firstSyllable + secondSyllable, suggestion.words[index]);
  }
});

test('lookups return matching concept suggestions and safely reject unknown or hostile values', () => {
  assert.equal(getTutorSuggestion('short-vowels').title, 'Short vowel sounds');
  assert.equal(getTutorSuggestion('<script>'), null);
  assert.deepEqual(getSuggestionsForConcept('l1-vccv').map(item => item.id), ['vccv']);
  assert.deepEqual(getSuggestionsForConcept('<img>'), []);
  assert.deepEqual(getSuggestionsForConcept('valid-but-unmapped'), []);
});

test('saving a suggestion appends a safe Reading Words list and preserves existing tutor lists', () => {
  const storage = new MemoryStorage();
  const before = [
    { id: 'list-a', name: 'Short review', words: ['tap', 'ship'] },
    { id: 'list-b', name: 'Long review', words: ['train', 'night'] },
  ];
  storage.setItem(READING_WORD_LISTS_KEY, JSON.stringify(before));
  const result = saveSuggestionAsReadingList('short-vowels', {
    storage,
    makeId: id => `suggested-${id}-abc123`,
  });
  assert.equal(result.ok, true);
  assert.equal(result.list.id, 'suggested-short-vowels-abc123');
  assert.equal(result.lists.length, 3);
  assert.deepEqual(result.lists.slice(0, 2), before);
  assert.deepEqual(result.list.words, ['cat', 'bed', 'sit', 'hop', 'cup', 'map', 'red', 'fin', 'hot', 'sun']);
  assert.deepEqual(JSON.parse(storage.getItem(READING_WORD_LISTS_KEY)).map(list => list.id), ['list-a', 'list-b', 'suggested-short-vowels-abc123']);
});

test('saving rejects list overflow, hostile stored words, malformed data, duplicate IDs, and storage errors safely', () => {
  const storage = new MemoryStorage();
  const twelve = Array.from({ length: MAX_READING_WORD_LISTS }, (_, index) => ({ id: `list-${index}`, name: `List ${index}`, words: ['cat'] }));
  const original = JSON.stringify(twelve);
  storage.setItem(READING_WORD_LISTS_KEY, original);
  assert.equal(saveSuggestionAsReadingList('short-vowels', { storage }).error, 'limit');
  assert.equal(storage.getItem(READING_WORD_LISTS_KEY), original);

  storage.setItem(READING_WORD_LISTS_KEY, JSON.stringify([{ id: 'list-1', name: '<img src=x>', words: ['cat', '<script>'] }]));
  const clean = saveSuggestionAsReadingList('digraphs', { storage, makeId: () => 'suggested-digraphs-1' });
  assert.equal(clean.ok, true);
  assert.equal(clean.lists[0].name, 'img src=x');
  assert.deepEqual(clean.lists[0].words, ['cat']);
  assert.equal(JSON.stringify(clean.lists).includes('<script>'), false);

  storage.setItem(READING_WORD_LISTS_KEY, '{bad json');
  assert.equal(saveSuggestionAsReadingList('short-vowels', { storage }).error, 'invalid-storage');
  assert.equal(saveSuggestionAsReadingList('short-vowels', { storage: new BrokenStorage() }).error, 'storage-unavailable');
  assert.equal(saveSuggestionAsReadingList('unknown', { storage }).error, 'unknown-suggestion');
  assert.equal(saveSuggestionAsReadingList('short-vowels', { storage: new MemoryStorage(), makeId: () => '<bad>' }).error, 'invalid-id');
});
