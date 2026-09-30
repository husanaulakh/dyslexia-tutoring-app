/** Original tutor-spoken starter prompts with explicit allowed spellings. */
export const auditoryDictationItems = Object.freeze([
  { id: 'sound-a', kind: 'sound', prompt: 'Say the short a sound, as in apple.', acceptedSpellings: ['a'], conceptIds: ['l1-short-vowels'] },
  { id: 'sound-sh', kind: 'sound', prompt: 'Say /sh/.', acceptedSpellings: ['sh'], conceptIds: ['l1-digraphs'] },
  { id: 'sound-th', kind: 'sound', prompt: 'Say /th/ as in thin.', acceptedSpellings: ['th'], conceptIds: ['l1-digraphs'] },
  { id: 'sound-k', kind: 'sound', prompt: 'Say the /k/ sound. Accept c, k, or ck when appropriate to the taught spelling.', acceptedSpellings: ['c', 'k', 'ck'], conceptIds: ['l1-short-vowel-spelling'] },
  { id: 'word-map', kind: 'word', prompt: 'Say the word map.', acceptedSpellings: ['map'], conceptIds: ['l1-short-vowels'] },
  { id: 'word-ship', kind: 'word', prompt: 'Say the word ship.', acceptedSpellings: ['ship'], conceptIds: ['l1-digraphs', 'l1-short-vowels'] },
  { id: 'word-frog', kind: 'word', prompt: 'Say the word frog.', acceptedSpellings: ['frog'], conceptIds: ['l1-blends', 'l1-short-vowels'] },
  { id: 'word-chest', kind: 'word', prompt: 'Say the word chest.', acceptedSpellings: ['chest'], conceptIds: ['l1-digraphs', 'l1-blends', 'l1-short-vowel-spelling'] },
]);
