const item = (id, word, pattern, note = '') => Object.freeze({ id, word, pattern, note });

// Starter material is original and intentionally includes explicit instructional
// labels. In particular, VC.CV boundaries are written by the tutor here; code
// never guesses syllable divisions from a word's spelling.
export const silentEItems = Object.freeze([
  Object.freeze({ id: 'cap-cape', word: 'cap', answer: 'cape', note: 'The a changes from /ă/ to /ā/.' }),
  Object.freeze({ id: 'kit-kite', word: 'kit', answer: 'kite', note: 'The i changes from /ĭ/ to /ī/.' }),
  Object.freeze({ id: 'hop-hope', word: 'hop', answer: 'hope', note: 'The o changes from /ŏ/ to /ō/.' }),
  Object.freeze({ id: 'cub-cube', word: 'cub', answer: 'cube', note: 'The u changes from /ŭ/ to /ū/.' }),
  Object.freeze({ id: 'pin-pine', word: 'pin', answer: 'pine', note: 'The i changes from /ĭ/ to /ī/.' }),
  Object.freeze({ id: 'mad-made', word: 'mad', answer: 'made', note: 'The a changes from /ă/ to /ā/.' }),
]);

export const sortCategories = Object.freeze([
  Object.freeze({ id: 'floss', label: 'FLOSS: double f, l, s, or z' }),
  Object.freeze({ id: 'ai', label: 'ai in the middle' }),
  Object.freeze({ id: 'ay', label: 'ay at the end' }),
]);

export const sortItems = Object.freeze([
  item('cliff', 'cliff', 'floss'), item('sniff', 'sniff', 'floss'),
  item('stuff', 'stuff', 'floss'), item('shell', 'shell', 'floss'),
  item('dress', 'dress', 'floss'), item('fuzz', 'fuzz', 'floss'),
  item('train', 'train', 'ai'), item('paint', 'paint', 'ai'),
  item('snail', 'snail', 'ai'), item('chain', 'chain', 'ai'),
  item('day', 'day', 'ay'), item('play', 'play', 'ay'),
  item('stay', 'stay', 'ay'), item('tray', 'tray', 'ay'),
]);

export const syllableTypes = Object.freeze([
  Object.freeze({ id: 'closed', label: 'Closed', description: 'A vowel followed by one or more consonants; the vowel is usually short.' }),
  Object.freeze({ id: 'open', label: 'Open', description: 'A syllable ends with a vowel; the vowel is usually long.' }),
  Object.freeze({ id: 'vce', label: 'Vowel-consonant-e', description: 'A vowel, consonant, and final e; the first vowel is usually long.' }),
  Object.freeze({ id: 'vowel-team', label: 'Vowel team', description: 'Two or more letters work together to spell a vowel sound.' }),
  Object.freeze({ id: 'r-controlled', label: 'R-controlled', description: 'A vowel is followed by r, which affects its sound.' }),
  Object.freeze({ id: 'consonant-le', label: 'Consonant-le', description: 'An ending consonant plus le forms the final syllable.' }),
]);

export const syllableItems = Object.freeze([
  Object.freeze({ id: 'sun', word: 'sun', focus: 'sun', pattern: 'closed' }),
  Object.freeze({ id: 'rabbit', word: 'rab·bit', focus: 'rab', pattern: 'closed' }),
  Object.freeze({ id: 'me', word: 'me', focus: 'me', pattern: 'open' }),
  Object.freeze({ id: 'robot', word: 'ro·bot', focus: 'ro', pattern: 'open' }),
  Object.freeze({ id: 'these', word: 'these', focus: 'these', pattern: 'vce' }),
  Object.freeze({ id: 'sunshine', word: 'sun·shine', focus: 'shine', pattern: 'vce' }),
  Object.freeze({ id: 'team', word: 'team', focus: 'team', pattern: 'vowel-team' }),
  Object.freeze({ id: 'rainbow', word: 'rain·bow', focus: 'rain', pattern: 'vowel-team' }),
  Object.freeze({ id: 'farm', word: 'farm', focus: 'farm', pattern: 'r-controlled' }),
  Object.freeze({ id: 'storm', word: 'storm', focus: 'storm', pattern: 'r-controlled' }),
  Object.freeze({ id: 'table', word: 'ta·ble', focus: 'ble', pattern: 'consonant-le' }),
  Object.freeze({ id: 'puzzle', word: 'puz·zle', focus: 'zle', pattern: 'consonant-le' }),
]);

export const vcCvItems = Object.freeze([
  item('napkin', 'napkin', 'nap/kin', 'The two middle consonants are p and k.'),
  item('rabbit', 'rabbit', 'rab/bit', 'The two middle consonants are b and b.'),
  item('sunset', 'sunset', 'sun/set', 'The two middle consonants are n and s.'),
  item('magnet', 'magnet', 'mag/net', 'The two middle consonants are g and n.'),
  item('picnic', 'picnic', 'pic/nic', 'The two middle consonants are c and n.'),
  item('basket', 'basket', 'bas/ket', 'The two middle consonants are s and k.'),
]);

export const workshopStrands = Object.freeze([
  Object.freeze({ id: 'silent-e', label: 'Silent-e transformations' }),
  Object.freeze({ id: 'sort', label: 'FLOSS, ai, and ay sort' }),
  Object.freeze({ id: 'syllables', label: 'Six syllable types' }),
  Object.freeze({ id: 'vccv', label: 'Annotated VC.CV practice' }),
]);
