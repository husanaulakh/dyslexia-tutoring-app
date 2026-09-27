import { visualDrillCards, visualDrillGroups } from '../../data/visual-drill-cards.mjs';

const stageFilter = document.getElementById('stageFilter');
const groupFilter = document.getElementById('groupFilter');
const stage = document.getElementById('stage');
const count = document.getElementById('cardCount');
const flipButton = document.getElementById('flipBtn');
let currentIndex = 0;
let isFlipped = false;
let visibleCards = [...visualDrillCards];

const stages = [...new Set(visualDrillCards.map(card => card.stage))];
stageFilter.innerHTML = ['all', ...stages].map(value =>
  `<option value="${value}">${value === 'all' ? 'All stages' : value}</option>`).join('');
groupFilter.innerHTML = visualDrillGroups.map(({ id, label }) =>
  `<option value="${id}">${label}</option>`).join('');

function filteredCards() {
  const selectedStage = stageFilter.value;
  const selectedGroup = groupFilter.value;
  return visualDrillCards.filter(card => {
    const matchesStage = selectedStage === 'all' || card.stage === selectedStage;
    const matchesGroup = selectedGroup === 'all'
      || (selectedGroup === 'stage' ? card.stage !== 'Extension' : card.group === selectedGroup);
    return matchesStage && matchesGroup;
  });
}

function render() {
  if (currentIndex >= visibleCards.length) currentIndex = 0;
  const card = visibleCards[currentIndex];
  count.textContent = card ? `Card ${currentIndex + 1} of ${visibleCards.length}` : 'No cards in this set';
  if (!card) {
    stage.innerHTML = '<div class="empty">Choose a different stage or card type to see cards.</div>';
    flipButton.disabled = true;
    return;
  }
  flipButton.disabled = false;
  const frontLabel = `Front of card: ${card.grapheme}`;
  const backLabel = `Back of card: ${card.picture} ${card.keyword}, ${card.sound}`;
  stage.innerHTML = `<button class="nav-btn" id="previousBtn" type="button" aria-label="Previous card">‹</button>
    <div class="card-wrap"><button class="flash-card ${isFlipped ? 'flipped' : ''}" id="flashCard" type="button" aria-label="${isFlipped ? `Flip back to ${card.grapheme}` : `Flip to reveal ${card.keyword} and ${card.sound}`}" aria-pressed="${isFlipped}">
    <span class="face front" aria-label="${frontLabel}" aria-hidden="${isFlipped}"><span class="face-label">Front · grapheme</span><span class="grapheme">${card.grapheme}</span><span class="tap-hint">Tap to reveal keyword</span></span>
    <span class="face back" aria-label="${backLabel}" aria-hidden="${!isFlipped}"><span class="face-label">Back · keyword and sound</span><span class="picture" aria-hidden="true">${card.picture}</span><span class="keyword">${card.keyword}</span><span class="sound">${card.sound}</span><span class="meta">${card.stage} · ${card.group}</span></span>
    </button></div><button class="nav-btn" id="nextBtn" type="button" aria-label="Next card">›</button>`;
  document.getElementById('flashCard').addEventListener('click', flip);
  document.getElementById('previousBtn').addEventListener('click', () => move(-1));
  document.getElementById('nextBtn').addEventListener('click', () => move(1));
  flipButton.textContent = isFlipped ? 'Show grapheme' : 'Show keyword';
}

function flip() { isFlipped = !isFlipped; render(); }
function move(step) {
  if (!visibleCards.length) return;
  currentIndex = (currentIndex + step + visibleCards.length) % visibleCards.length;
  isFlipped = false;
  render();
}

stageFilter.addEventListener('change', () => { visibleCards = filteredCards(); currentIndex = 0; isFlipped = false; render(); });
groupFilter.addEventListener('change', () => { visibleCards = filteredCards(); currentIndex = 0; isFlipped = false; render(); });
document.getElementById('flipBtn').addEventListener('click', flip);
document.getElementById('shuffleBtn').addEventListener('click', () => {
  const shuffled = [...visibleCards];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  visibleCards = shuffled;
  currentIndex = 0;
  isFlipped = false;
  render();
});
window.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) return;
  if (event.code === 'Space') { event.preventDefault(); flip(); }
  if (event.key === 'ArrowRight') move(1);
  if (event.key === 'ArrowLeft') move(-1);
});
render();
