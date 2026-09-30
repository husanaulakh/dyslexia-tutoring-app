const DIGRAPHS = new Set(['ch', 'sh', 'th', 'ck', 'wh', 'ph', 'ng']);

export function cleanWord(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

export function autoChunkWord(word) {
  const clean = cleanWord(word);
  const chunks = [];
  for (let i = 0; i < clean.length;) {
    const pair = clean.slice(i, i + 2);
    if (DIGRAPHS.has(pair)) {
      chunks.push(pair);
      i += 2;
    } else {
      chunks.push(clean[i]);
      i += 1;
    }
  }
  return chunks;
}

export function parseSoundSplit(raw, word) {
  const clean = cleanWord(word);
  const split = String(raw ?? '').normalize('NFKC').trim().toLowerCase();
  if (!split) return autoChunkWord(clean);
  if (!/^[a-z]+(?:[\s,-]+[a-z]+)*$/.test(split)) return null;
  const chunks = split.split(/[\s,-]+/).filter(Boolean);
  return chunks.join('') === clean && chunks.length >= 2 && chunks.length <= 6 ? chunks : null;
}

export function tokenizeBulkWords(raw) {
  return [...new Set((String(raw ?? '').match(/[a-zA-Z]+/g) ?? [])
    .map(cleanWord)
    .filter(word => word.length >= 2 && word.length <= 12))];
}

export function normalizeStoredWord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  if (typeof record.word !== 'string' || !Array.isArray(record.chunks)) return null;
  if (!/^[a-z]{2,12}$/i.test(record.word) || record.chunks.some(chunk => typeof chunk !== 'string' || !/^[a-z]+$/i.test(chunk))) return null;
  const word = cleanWord(record.word);
  const chunks = record.chunks.map(cleanWord);
  if (word.length < 2 || word.length > 12 || chunks.length < 2 || chunks.length > 6) return null;
  if (chunks.some(chunk => !chunk) || chunks.join('') !== word) return null;
  return { word, chunks, lessonTag: record.lessonTag === 'previous' ? 'previous' : 'current' };
}

export function buildLetterTriplets(alphabet = 'abcdefghijklmnopqrstuvwxyz') {
  const letters = typeof alphabet === 'string' ? [...alphabet] : [...alphabet];
  const triplets = [];
  for (let i = 0; i <= letters.length - 3; i += 1) triplets.push(letters.slice(i, i + 3));
  return triplets;
}

export function chooseMissingIndex(mode, random = Math.random) {
  if (mode === 'first') return 0;
  if (mode === 'middle') return 1;
  if (mode === 'last') return 2;
  return Math.min(2, Math.max(0, Math.floor(random() * 3)));
}

export function normalizePracticeWord(raw) {
  if (typeof raw !== 'string') return null;
  const word = raw.trim();
  if (word.length > 24 || !/^[a-zA-Z]+(?:['-][a-zA-Z]+)*$/.test(word)) return null;
  return word.toLowerCase();
}

export function traceableLetters(word) {
  return [...String(word ?? '').toLowerCase()].filter(char => /[a-z]/.test(char));
}

export function isSpellingMatch(expected, actual) {
  return typeof expected === 'string' && typeof actual === 'string'
    && expected.trim().toLowerCase() === actual.trim().toLowerCase();
}
