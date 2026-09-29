const MAX_PARAGRAPH_LENGTH = 2000;
const MAX_PARAGRAPHS = 30;

export function normalizeParagraph(value) {
  if (typeof value !== 'string') return null;
  const paragraph = value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  if (!paragraph || paragraph.length > MAX_PARAGRAPH_LENGTH) return null;
  return paragraph;
}

export function parseParagraphs(value) {
  const entries = Array.isArray(value)
    ? value
    : String(value ?? '').split(/\n\s*\n+/);
  return [...new Set(entries.map(normalizeParagraph).filter(Boolean))].slice(0, MAX_PARAGRAPHS);
}

export function normalizeParagraphLists(value, fallbackParagraphs = []) {
  if (!Array.isArray(value)) {
    return [{ id: 'list-1', name: 'Paragraphs 1', paragraphs: parseParagraphs(fallbackParagraphs) }];
  }
  const lists = value.slice(0, 12).flatMap((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return [];
    const name = typeof record.name === 'string'
      ? record.name.trim().replace(/<[^>]*>/g, '').slice(0, 40)
      : '';
    return [{
      id: typeof record.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(record.id) ? record.id : `list-${index + 1}`,
      name: name || `Paragraphs ${index + 1}`,
      paragraphs: parseParagraphs(record.paragraphs),
    }];
  });
  return lists.length ? lists : [{ id: 'list-1', name: 'Paragraphs 1', paragraphs: [] }];
}

export function buildParagraphReviewQueue(paragraphs) {
  return parseParagraphs(paragraphs).map((paragraph, index) => ({
    id: `${index}-first`, paragraph, isReview: false,
  }));
}

export function advanceParagraphReviewQueue(queue) {
  if (!Array.isArray(queue) || queue.length === 0) return [];
  const [current, ...remaining] = queue;
  if (!current.isReview) {
    remaining.splice(Math.min(3, remaining.length), 0, {
      id: `${current.id}-review`, paragraph: current.paragraph, isReview: true,
    });
  }
  return remaining;
}
