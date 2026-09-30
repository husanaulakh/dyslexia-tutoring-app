const MAX_PARAGRAPH_LENGTH = 2000;
const MAX_PARAGRAPHS = 30;
const MAX_QUESTION_LENGTH = 500;

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
  return normalizeParagraphRows(value, []).paragraphs;
}

export function normalizeComprehensionQuestion(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim().slice(0, MAX_QUESTION_LENGTH);
}

/** Keep one optional, spoken tutor prompt aligned with each paragraph index. */
export function parseComprehensionQuestions(value, paragraphCount = MAX_PARAGRAPHS) {
  const entries = Array.isArray(value) ? value : String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
  const count = Number.isInteger(paragraphCount) ? Math.max(0, Math.min(MAX_PARAGRAPHS, paragraphCount)) : MAX_PARAGRAPHS;
  return entries.slice(0, count).map(normalizeComprehensionQuestion);
}

/** Normalize paragraph/question pairs together so duplicates keep their own prompt. */
export function normalizeParagraphRows(paragraphValues, questionValues = []) {
  const paragraphs = Array.isArray(paragraphValues)
    ? paragraphValues
    : String(paragraphValues ?? '').split(/\n\s*\n+/);
  const questions = Array.isArray(questionValues)
    ? questionValues
    : String(questionValues ?? '').replace(/\r\n?/g, '\n').split('\n');
  const normalizedParagraphs = [];
  const normalizedQuestions = [];
  const seen = new Set();
  paragraphs.forEach((value, index) => {
    if (normalizedParagraphs.length >= MAX_PARAGRAPHS) return;
    const paragraph = normalizeParagraph(value);
    if (!paragraph || seen.has(paragraph)) return;
    seen.add(paragraph);
    normalizedParagraphs.push(paragraph);
    normalizedQuestions.push(normalizeComprehensionQuestion(questions[index]));
  });
  return { paragraphs: normalizedParagraphs, questions: normalizedQuestions };
}

export function normalizeParagraphLists(value, fallbackParagraphs = []) {
  if (!Array.isArray(value)) {
    const rows = normalizeParagraphRows(fallbackParagraphs, []);
    return [{ id: 'list-1', name: 'Paragraphs 1', ...rows }];
  }
  const lists = value.slice(0, 12).flatMap((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return [];
    const name = typeof record.name === 'string'
      ? record.name.trim().replace(/<[^>]*>/g, '').slice(0, 40)
      : '';
    const rows = normalizeParagraphRows(record.paragraphs, record.questions);
    return [{
      id: typeof record.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(record.id) ? record.id : `list-${index + 1}`,
      name: name || `Paragraphs ${index + 1}`,
      ...rows,
    }];
  });
  return lists.length ? lists : [{ id: 'list-1', name: 'Paragraphs 1', paragraphs: [], questions: [] }];
}

export function buildParagraphReviewQueue(paragraphs, questions = []) {
  const rows = normalizeParagraphRows(paragraphs, questions);
  return rows.paragraphs.map((paragraph, index) => ({
    id: `${index}-first`, paragraph, question: rows.questions[index] ?? '', isReview: false,
  }));
}

export function advanceParagraphReviewQueue(queue, outcome = 'revisit', rereadMode = 'all') {
  if (!Array.isArray(queue) || queue.length === 0) return [];
  const [current, ...remaining] = queue;
  const normalizedOutcome = outcome === true ? 'independent' : outcome === false ? 'revisit' : outcome;
  const shouldReview = rereadMode !== 'needs-practice' || normalizedOutcome !== 'independent';
  if (!current.isReview && shouldReview) {
    remaining.splice(Math.min(3, remaining.length), 0, {
      id: `${current.id}-review`, paragraph: current.paragraph, question: current.question ?? '', isReview: true,
    });
  }
  return remaining;
}

export function normalizeParagraphOutcome(value) {
  return ['independent', 'supported', 'revisit'].includes(value) ? value : '';
}

export function createParagraphOutcomeCounts() {
  return { independent: 0, supported: 0, revisit: 0 };
}

export function recordParagraphOutcome(counts, value) {
  const outcome = normalizeParagraphOutcome(value);
  if (!outcome || !counts || !Number.isInteger(counts[outcome]) || counts[outcome] < 0) return counts;
  return { ...counts, [outcome]: counts[outcome] + 1 };
}
