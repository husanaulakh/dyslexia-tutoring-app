export function normalizeReadingWord(value) {
  if (typeof value !== 'string') return null;
  const word = value.trim().toLowerCase();
  if (word.length > 24 || !/^[a-z]+(?:['-][a-z]+)*$/.test(word)) return null;
  return word;
}

export function parseReadingWords(value) {
  const tokens = Array.isArray(value)
    ? value
    : String(value ?? '').split(/[\s,;]+/);
  return [...new Set(tokens.map(normalizeReadingWord).filter(Boolean))];
}

export function normalizeWordLists(value, fallbackWords = ['tap', 'duck', 'rub', 'bog', 'net', 'bell', 'tall', 'van', 'pits', 'chap']) {
  if (!Array.isArray(value)) return [{ id: 'list-1', name: 'List 1', words: [...fallbackWords] }];
  const lists = value.slice(0, 12).flatMap((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return [];
    const words = parseReadingWords(record.words);
    const name = typeof record.name === 'string'
      ? record.name.trim().replace(/[<>]/g, '').slice(0, 40)
      : '';
    return [{
      id: typeof record.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(record.id) ? record.id : `list-${index + 1}`,
      name: name || `List ${index + 1}`,
      words,
    }];
  });
  return lists.length ? lists : [{ id: 'list-1', name: 'List 1', words: [...fallbackWords] }];
}

export function buildReviewQueue(words) {
  return parseReadingWords(words).map((word, index) => ({ id: `${index}-first`, word, isReview: false }));
}

export function advanceReviewQueue(queue) {
  if (!Array.isArray(queue) || queue.length === 0) return [];
  const [current, ...remaining] = queue;
  if (!current.isReview) {
    const review = { id: `${current.id}-review`, word: current.word, isReview: true };
    remaining.splice(Math.min(3, remaining.length), 0, review);
  }
  return remaining;
}
