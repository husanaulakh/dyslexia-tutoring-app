import { loadStoredCollection } from './collection-storage.mjs';
import { normalizeStoredWord } from './learning-logic.mjs';

export const BLENDING_BOARD_STORAGE_KEY = 'blending-board-words-standalone';

// The original starter vocabulary, kept separate so the Board and Lesson
// Builder always offer the same curated word IDs.
export const BLENDING_BOARD_STARTER_WORDS = Object.freeze([
  ['cat',['c','a','t']],['bat',['b','a','t']],['hat',['h','a','t']],['mat',['m','a','t']],['sat',['s','a','t']],['rat',['r','a','t']],['pat',['p','a','t']],['fat',['f','a','t']],
  ['cab',['c','a','b']],['cap',['c','a','p']],['can',['c','a','n']],['cot',['c','o','t']],['cut',['c','u','t']],['cup',['c','u','p']],['dog',['d','o','g']],['dig',['d','i','g']],
  ['dip',['d','i','p']],['hid',['h','i','d']],['him',['h','i','m']],['hit',['h','i','t']],['dug',['d','u','g']],['sun',['s','u','n']],['map',['m','a','p']],['pig',['p','i','g']],['pit',['p','i','t']],
  ['fan',['f','a','n']],['hop',['h','o','p']],['ship',['sh','i','p']],['shop',['sh','o','p']],['chip',['ch','i','p']],['chat',['ch','a','t']],['thin',['th','i','n']],['that',['th','a','t']],
  ['fish',['f','i','sh']],['cash',['c','a','sh']],['stop',['s','t','o','p']],['frog',['f','r','o','g']],['clip',['c','l','i','p']],['flag',['f','l','a','g']],['drip',['d','r','i','p']],
  ['plug',['p','l','u','g']],['milk',['m','i','l','k']],['jump',['j','u','m','p']],['hand',['h','a','n','d']],['desk',['d','e','s','k']],['tent',['t','e','n','t']],['tim',['t','i','m']],
  ['belt',['b','e','l','t']],['pond',['p','o','n','d']],['lamp',['l','a','m','p']],['nest',['n','e','s','t']],['soft',['s','o','f','t']],
].map(([word, chunks]) => Object.freeze({ word, chunks: Object.freeze([...chunks]), lessonTag: 'current' })));

function starterWords() {
  return BLENDING_BOARD_STARTER_WORDS.map(item => ({ ...item, chunks: [...item.chunks] }));
}

/** Validate the entire collection. A single malformed entry must not silently
 * discard valid saved words or permit a later write over the original payload.
 */
export function normalizeBlendingBoardWords(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Word collection must be an array');
  const normalized = rows.map(normalizeStoredWord);
  if (normalized.some(item => !item)) throw new TypeError('Word collection contains an invalid spelling tile record');
  return normalized;
}

/** Return the saved dictionary or safe starter fallback. `error` is non-null
 * when storage could not be read or contained malformed data; callers should
 * use saveStoredCollection with this result to preserve those original bytes.
 */
export function loadBlendingBoardWords(storage) {
  return loadStoredCollection({
    key: BLENDING_BOARD_STORAGE_KEY,
    normalize: normalizeBlendingBoardWords,
    fallback: starterWords,
    ...(storage === undefined ? {} : { storage }),
  });
}
