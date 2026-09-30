import { getLessonActivityContext } from './lesson-context.mjs';
import { cleanWord as clean, autoChunkWord as autoChunk, parseSoundSplit as parse, tokenizeBulkWords, normalizeStoredWord } from './learning-logic.mjs';

const INITIAL_WORDS = [
  ['cat',['c','a','t']],['bat',['b','a','t']],['hat',['h','a','t']],['mat',['m','a','t']],['sat',['s','a','t']],['rat',['r','a','t']],['pat',['p','a','t']],['fat',['f','a','t']],
  ['cab',['c','a','b']],['cap',['c','a','p']],['can',['c','a','n']],['cot',['c','o','t']],['cut',['c','u','t']],['cup',['c','u','p']],['dog',['d','o','g']],['dig',['d','i','g']],
  ['dip',['d','i','p']],['hid',['h','i','d']],['him',['h','i','m']],['hit',['h','i','t']],['dug',['d','u','g']],['sun',['s','u','n']],['map',['m','a','p']],['pig',['p','i','g']],['pit',['p','i','t']],
  ['fan',['f','a','n']],['hop',['h','o','p']],['ship',['sh','i','p']],['shop',['sh','o','p']],['chip',['ch','i','p']],['chat',['ch','a','t']],['thin',['th','i','n']],['that',['th','a','t']],
  ['fish',['f','i','sh']],['cash',['c','a','sh']],['stop',['s','t','o','p']],['frog',['f','r','o','g']],['clip',['c','l','i','p']],['flag',['f','l','a','g']],['drip',['d','r','i','p']],
  ['plug',['p','l','u','g']],['milk',['m','i','l','k']],['jump',['j','u','m','p']],['hand',['h','a','n','d']],['desk',['d','e','s','k']],['tent',['t','e','n','t']],['tim',['t','i','m']],
  ['belt',['b','e','l','t']],['pond',['p','o','n','d']],['lamp',['l','a','m','p']],['nest',['n','e','s','t']],['soft',['s','o','f','t']],
].map(([word, chunks]) => ({ word, chunks, lessonTag: 'current' }));
const STORAGE_KEY = 'blending-board-words-standalone';
const $ = selector => document.querySelector(selector);
const vowels = new Set(['a','e','i','o','u']);
const context = getLessonActivityContext('blending-board');
let savedWords = loadWords();
const state = {
  words: savedWords,
  soundMode: '3', lessonMode: 'current', currentChunks: ['f','a','n'], lastClicked: null,
  showPrompt: false, showTools: true, showDictionary: true, singleTag: 'current', bulkTag: 'current',
  lessonWordIds: Array.isArray(context?.settings.wordIds) ? context.settings.wordIds : null,
  lessonCount: Number.isInteger(context?.settings.count) ? context.settings.count : null,
};
let confirmedSuggestion = '';
let pendingBulk = [];

function loadWords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return INITIAL_WORDS.map(item => ({ ...item, chunks: [...item.chunks] }));
    const stored = JSON.parse(raw);
    if (!Array.isArray(stored)) return INITIAL_WORDS.map(item => ({ ...item, chunks: [...item.chunks] }));
    const valid = stored.map(normalizeStoredWord).filter(Boolean);
    return stored.length > 0 && valid.length === 0 ? INITIAL_WORDS.map(item => ({ ...item, chunks: [...item.chunks] })) : valid;
  } catch { return INITIAL_WORDS.map(item => ({ ...item, chunks: [...item.chunks] })); }
}
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.words)); return true; } catch { return false; } }
function lessonLabel(tag) { return tag === 'previous' ? 'Review' : 'This lesson'; }
function chunkKey(chunks) { return chunks.join('|'); }
function currentWord() { return state.currentChunks.join(''); }
function valid() {
  const filtered = state.words.filter(item => {
    const tileCountMatches = state.soundMode === 'both' || item.chunks.length === Number(state.soundMode);
    const lessonMatches = state.lessonMode === 'both' || item.lessonTag === state.lessonMode;
    const selected = !state.lessonWordIds || state.lessonWordIds.includes(item.word);
    return tileCountMatches && lessonMatches && selected;
  });
  return state.lessonCount ? filtered.slice(0, Math.max(1, Math.min(100, state.lessonCount))) : filtered;
}
function sameExcept(a, b, changedIndex) { return a.length === b.length && a.every((part, i) => i === changedIndex || part === b[i]); }
function feedback(message) { $('#feedback').textContent = message; $('#feedback').style.display = message ? 'block' : 'none'; }
function backgroundForTile(tile) {
  const letters = tile.split('');
  const hasVowel = letters.some(letter => vowels.has(letter));
  const hasConsonant = letters.some(letter => !vowels.has(letter));
  if (hasVowel && hasConsonant) {
    const vowelFirst = vowels.has(letters[0]);
    const first = vowelFirst ? '#fb923c' : '#fff';
    const second = vowelFirst ? '#fff' : '#fb923c';
    return `linear-gradient(90deg,${first} 0%,${first} 50%,${second} 50%,${second} 100%)`;
  }
  return hasVowel ? '#fb923c' : '#fff';
}
function ensureCurrent() {
  const words = valid();
  if (!words.length) { state.currentChunks = []; return; }
  if (!words.some(item => chunkKey(item.chunks) === chunkKey(state.currentChunks))) state.currentChunks = [...words[0].chunks];
}
function renderFilters() {
  const soundOptions = [2,3,4,5,6].map(count => [String(count), `${count} spelling tiles`]);
  soundOptions.push(['both', '2–6 tiles']);
  $('#soundFilters').replaceChildren();
  for (const [key, label] of soundOptions) {
    const button = document.createElement('button'); button.type = 'button'; button.className = `pill ${state.soundMode === key ? 'active' : ''}`; button.textContent = label;
    button.addEventListener('click', () => { state.soundMode = key; ensureCurrent(); render(); }); $('#soundFilters').append(button);
  }
  const lessonOptions = [['current','This lesson'],['previous','Review'],['both','All words']];
  $('#lessonFilters').replaceChildren();
  for (const [key, label] of lessonOptions) {
    const button = document.createElement('button'); button.type = 'button'; button.className = `pill secondary ${state.lessonMode === key ? 'active' : ''}`; button.textContent = label;
    button.addEventListener('click', () => { state.lessonMode = key; ensureCurrent(); render(); }); $('#lessonFilters').append(button);
  }
}
function renderBoard() {
  $('#currentWord').textContent = currentWord() || '—';
  const tileLabel = state.soundMode === 'both' ? '2–6 spelling tiles' : `${state.soundMode} spelling tiles`;
  $('#modeBadge').textContent = `Practice set: ${state.lessonMode === 'both' ? 'All words' : state.lessonMode === 'previous' ? 'Review' : 'This lesson'} · ${tileLabel}`;
  const stage = $('#stage'); stage.replaceChildren();
  if (!state.currentChunks.length) {
    const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'No words in this practice set yet. Add words in Tutor tools, change the filters, or reset the starter list.'; stage.append(empty);
  } else {
    const cards = document.createElement('div'); cards.className = `cards count-${state.currentChunks.length}`; cards.style.setProperty('--tile-count', state.currentChunks.length);
    state.currentChunks.forEach((chunk, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = `card ${state.lastClicked === index ? 'clicked' : ''}`;
      button.dataset.p = String(index); button.style.background = backgroundForTile(chunk); button.textContent = chunk;
      button.setAttribute('aria-label', `Spelling tile ${index + 1}: ${chunk}`); button.addEventListener('click', () => cycle(index)); cards.append(button);
    });
    stage.append(cards);
  }
  $('#prompt').style.display = state.showPrompt ? 'block' : 'none';
  $('#promptText').textContent = state.currentChunks.length ? ` ${state.currentChunks.join(' · ')} → ${currentWord()}` : '';
}
function cycle(position) {
  const options = valid().filter(item => sameExcept(item.chunks, state.currentChunks, position)).sort((a,b) => a.chunks[position].localeCompare(b.chunks[position]));
  if (options.length > 1) {
    const currentIndex = options.findIndex(item => chunkKey(item.chunks) === chunkKey(state.currentChunks));
    const next = options[(currentIndex + 1 + options.length) % options.length]; state.currentChunks = [...next.chunks];
    feedback(`Changed spelling tile ${position + 1}: ${next.chunks.join(' · ')} = ${next.word}`);
  } else feedback('No word in this list changes only this spelling tile. Add a matching word or choose another tile count.');
  state.lastClicked = position; renderBoard();
}
function nextWord() { const words = valid(); if (!words.length) return; const i = words.findIndex(item => chunkKey(item.chunks) === chunkKey(state.currentChunks)); state.currentChunks = [...words[(i + 1 + words.length) % words.length].chunks]; state.lastClicked = null; renderBoard(); }
function randomWord() { const words = valid(); if (!words.length) return; state.currentChunks = [...words[Math.floor(Math.random() * words.length)].chunks]; state.lastClicked = null; renderBoard(); }
function startList() { const words = valid(); if (!words.length) return; state.currentChunks = [...words[0].chunks]; state.lastClicked = null; renderBoard(); }
function choose(index) { const item = state.words[index]; if (!item) return; state.soundMode = String(item.chunks.length); state.lessonMode = item.lessonTag; state.currentChunks = [...item.chunks]; state.lastClicked = null; render(); }
function removeWord(index) { state.words.splice(index, 1); const persisted = save(); ensureCurrent(); feedback(persisted ? 'Removed word.' : 'Removed for this session, but browser storage is unavailable.'); render(); }
function renderSegments(selector, selected, onChange) {
  const root = $(selector); root.replaceChildren();
  for (const [tag, label] of [['current','This lesson'],['previous','Review']]) {
    const button = document.createElement('button'); button.type = 'button'; button.className = selected === tag ? 'active' : ''; button.textContent = label;
    button.addEventListener('click', () => onChange(tag)); root.append(button);
  }
}
function renderTools() {
  $('#toolsBody').style.display = state.showTools ? 'flex' : 'none'; $('#toolsToggle').textContent = state.showTools ? 'Hide' : 'Show'; $('#promptToggle').textContent = state.showPrompt ? 'Hide' : 'Show';
  renderSegments('#singleTagSeg', state.singleTag, tag => { state.singleTag = tag; renderTools(); });
  renderSegments('#bulkTagSeg', state.bulkTag, tag => { state.bulkTag = tag; renderTools(); }); preview();
}
function preview() {
  const word = clean($('#singleWord').value); const root = $('#preview'); root.replaceChildren();
  if (!word) { root.style.display = 'none'; return; }
  root.style.display = 'block';
  const title = document.createElement('div'); title.className = 'label'; title.textContent = 'Preview'; root.append(title);
  const raw = $('#soundSplit').value.trim();
  const chunks = raw ? parse(raw, word) : autoChunk(word);
  const line = document.createElement('div'); line.className = 'split-preview'; line.textContent = chunks ? `${word}: ${chunks.join(' · ')}` : 'Invalid manual split. Chunks must use letters, join to the word, and contain 2–6 tiles.'; root.append(line);
  if (!raw && chunks?.length >= 2 && chunks.length <= 6) {
    const confirm = document.createElement('button'); confirm.type = 'button'; confirm.className = 'btn soft confirm-suggestion';
    const suggestionKey = `${word}|${chunkKey(chunks)}`; confirm.textContent = confirmedSuggestion === suggestionKey ? 'Suggested split confirmed' : 'Tutor: confirm suggested split';
    confirm.setAttribute('aria-pressed', String(confirmedSuggestion === suggestionKey));
    confirm.addEventListener('click', () => { confirmedSuggestion = suggestionKey; feedback(`Tutor confirmed the suggested spelling tiles: ${chunks.join(' · ')}.`); preview(); }); root.append(confirm);
  }
}
function addSingle() {
  const word = clean($('#singleWord').value); const raw = $('#soundSplit').value.trim();
  if (word.length < 2 || word.length > 12) { feedback('Add a word with 2 to 12 letters.'); return; }
  const chunks = raw ? parse(raw, word) : autoChunk(word);
  if (!chunks || chunks.length < 2 || chunks.length > 6) { feedback('Invalid spelling tile split. Check that 2–6 tiles join to the word.'); return; }
  if (!raw && confirmedSuggestion !== `${word}|${chunkKey(chunks)}`) { feedback('Review the suggested spelling tiles and confirm them before adding this word.'); return; }
  const key = `${word}|${chunkKey(chunks)}`; const existing = state.words.findIndex(item => `${item.word}|${chunkKey(item.chunks)}` === key);
  const item = { word, chunks, lessonTag: state.singleTag };
  if (existing >= 0) state.words[existing] = item; else state.words.push(item);
  const persisted = save(); state.currentChunks = [...chunks]; state.soundMode = String(chunks.length); state.lessonMode = state.singleTag;
  $('#singleWord').value = ''; $('#soundSplit').value = ''; confirmedSuggestion = '';
  feedback(`${existing >= 0 ? 'Updated' : 'Added'} ${word} with ${chunks.length} spelling tiles (${lessonLabel(state.singleTag)})${persisted ? '.' : ' for this session only; browser storage is unavailable.'}`); render();
}
function renderBulkPreview() {
  const root = $('#feedback'); root.replaceChildren(); root.style.display = pendingBulk.length ? 'block' : 'none';
  if (!pendingBulk.length) return;
  const text = document.createElement('p'); text.textContent = `Review these tutor-generated spelling tiles before adding: ${pendingBulk.map(item => `${item.word}: ${item.chunks.join(' · ')}`).join('; ')}`; root.append(text);
  $('#confirmBulk').hidden = false;
}
function addBulk() {
  const words = tokenizeBulkWords($('#bulkWords').value);
  pendingBulk = words.map(word => ({ word, chunks: autoChunk(word), lessonTag: state.bulkTag })).filter(item => item.chunks.length >= 2 && item.chunks.length <= 6);
  if (!pendingBulk.length) { feedback('No words with 2–6 suggested spelling tiles were found.'); $('#confirmBulk').hidden = true; return; }
  renderBulkPreview();
}
function confirmBulk() {
  let added = 0; let updated = 0;
  for (const item of pendingBulk) {
    const key = `${item.word}|${chunkKey(item.chunks)}`; const index = state.words.findIndex(word => `${word.word}|${chunkKey(word.chunks)}` === key);
    if (index >= 0) { state.words[index] = item; updated += 1; } else { state.words.push(item); added += 1; }
  }
  state.currentChunks = [...pendingBulk[0].chunks]; state.soundMode = String(state.currentChunks.length); state.lessonMode = state.bulkTag;
  pendingBulk = []; $('#bulkWords').value = ''; $('#confirmBulk').hidden = true; const persisted = save();
  feedback(`Tutor-confirmed and added ${added} ${added === 1 ? 'word' : 'words'}${updated ? `; updated ${updated}` : ''}${persisted ? '.' : ' for this session only; browser storage is unavailable.'}`); render();
}
function renderDictionary() {
  $('#dictionary').style.display = state.showDictionary ? 'block' : 'none'; $('#dictToggle').textContent = state.showDictionary ? 'Hide' : 'Show';
  $('#clearAll').style.display = state.words.length ? 'inline-block' : 'none'; if (!state.showDictionary) return;
  const groups = new Map();
  state.words.forEach((item, index) => { const count = item.chunks.length; if (!groups.has(count)) groups.set(count, []); groups.get(count).push({ item, index }); });
  const root = $('#dictionary'); root.replaceChildren();
  for (const count of [...groups.keys()].sort((a,b) => a-b)) {
    const group = document.createElement('div'); group.className = 'dict-group';
    const header = document.createElement('div'); header.className = 'dict-group-head'; const label = document.createElement('div'); label.className = 'label'; label.textContent = `${count} spelling tiles`; const total = document.createElement('div'); total.className = 'count'; total.textContent = String(groups.get(count).length); header.append(label,total); group.append(header);
    for (const { item, index } of groups.get(count)) {
      const row = document.createElement('div'); row.className = 'word-row'; const main = document.createElement('button'); main.type = 'button'; main.className = 'word-main';
      const wordLine = document.createElement('div'); wordLine.className = 'wordline'; const wrapper = document.createElement('div'); const word = document.createElement('div'); word.className = 'word'; word.textContent = item.word; const chunks = document.createElement('div'); chunks.className = 'chunks'; chunks.textContent = item.chunks.join(' · '); wrapper.append(word,chunks);
      const tag = document.createElement('span'); tag.className = `tag ${item.lessonTag}`; tag.textContent = lessonLabel(item.lessonTag); wordLine.append(wrapper,tag); main.append(wordLine); main.addEventListener('click', () => choose(index));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove ${item.word}`); remove.addEventListener('click', () => removeWord(index)); row.append(main,remove); group.append(row);
    }
    root.append(group);
  }
}
function clearAll() { state.words = []; state.currentChunks = []; state.lastClicked = null; const persisted = save(); feedback(persisted ? 'Cleared all words from the dictionary.' : 'Cleared for this session, but browser storage is unavailable.'); render(); }
function resetAll() { state.words = INITIAL_WORDS.map(item => ({ ...item, chunks: [...item.chunks] })); state.soundMode = '3'; state.lessonMode = 'current'; state.currentChunks = ['f','a','n']; state.singleTag = 'current'; state.bulkTag = 'current'; state.lastClicked = null; const persisted = save(); feedback(persisted ? 'Dictionary reset to the starter word list.' : 'Reset for this session, but browser storage is unavailable.'); render(); }
function render() { renderFilters(); renderBoard(); renderTools(); renderDictionary(); }

$('#nextBtn').addEventListener('click', nextWord); $('#randomBtn').addEventListener('click', randomWord); $('#startBtn').addEventListener('click', startList); $('#resetBtn').addEventListener('click', resetAll); $('#clearAll').addEventListener('click', clearAll);
$('#toolsToggle').addEventListener('click', () => { state.showTools = !state.showTools; renderTools(); }); $('#dictToggle').addEventListener('click', () => { state.showDictionary = !state.showDictionary; renderDictionary(); }); $('#promptToggle').addEventListener('click', () => { state.showPrompt = !state.showPrompt; renderTools(); renderBoard(); });
$('#addSingle').addEventListener('click', addSingle); $('#addBulk').addEventListener('click', addBulk); $('#confirmBulk').addEventListener('click', confirmBulk);
$('#singleWord').addEventListener('input', event => { event.target.value = clean(event.target.value).slice(0,12); confirmedSuggestion = ''; preview(); }); $('#soundSplit').addEventListener('input', preview); $('#singleWord').addEventListener('keydown', event => { if (event.key === 'Enter') addSingle(); });
if (context) {
  state.lessonMode = 'both'; state.soundMode = 'both';
  if (typeof context.settings.word === 'string') {
    const target = clean(context.settings.word); const item = state.words.find(entry => entry.word === target);
    if (item) state.currentChunks = [...item.chunks]; else feedback(`Lesson word “${target}” is not in this board's saved spelling tiles yet.`);
  }
}
ensureCurrent(); render();
