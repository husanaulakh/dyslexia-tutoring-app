const card = (grapheme, keyword, picture, sound, group, stage = 'Extension') => ({
  id: `${group}-${grapheme}-${keyword}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  grapheme, keyword, picture, sound, group, stage,
});

export const visualDrillCards = [
  // Staged single-letter review follows the SATPIN → MDGOCK → EURF → HBJVLW progression.
  card('s','sun','☀️','/s/','consonants','Stage 1 · SATPIN'), card('a','apple','🍎','/ă/','vowels','Stage 1 · SATPIN'),
  card('t','top','🔝','/t/','consonants','Stage 1 · SATPIN'), card('p','pan','🍳','/p/','consonants','Stage 1 · SATPIN'),
  card('i','insect','🐛','/ĭ/','vowels','Stage 1 · SATPIN'), card('n','nest','🪺','/n/','consonants','Stage 1 · SATPIN'),
  card('m','moon','🌙','/m/','consonants','Stage 2 · MDGOCK'), card('d','dog','🐕','/d/','consonants','Stage 2 · MDGOCK'),
  card('g','goat','🐐','/g/','consonants','Stage 2 · MDGOCK'), card('o','octopus','🐙','/ŏ/','vowels','Stage 2 · MDGOCK'),
  card('c','cat','🐈','/k/','consonants','Stage 2 · MDGOCK'), card('k','kite','🪁','/k/','consonants','Stage 2 · MDGOCK'),
  card('e','egg','🥚','/ĕ/','vowels','Stage 3 · EURF'), card('u','up','⬆️','/ŭ/','vowels','Stage 3 · EURF'),
  card('r','rat','🐀','/r/','consonants','Stage 3 · EURF'), card('f','fish','🐟','/f/','consonants','Stage 3 · EURF'),
  card('h','hat','🎩','/h/','consonants','Stage 4 · HBJVLW'), card('b','ball','⚽','/b/','consonants','Stage 4 · HBJVLW'),
  card('j','jam','🍓','/j/','consonants','Stage 4 · HBJVLW'), card('v','van','🚐','/v/','consonants','Stage 4 · HBJVLW'),
  card('l','lamp','💡','/l/','consonants','Stage 4 · HBJVLW'), card('w','web','🕸️','/w/','consonants','Stage 4 · HBJVLW'),
  card('x','box','📦','/ks/','consonants','Alphabet review'), card('y','yarn','🧶','/y/','consonants','Alphabet review'),
  card('z','zipper','🤐','/z/','consonants','Alphabet review'), card('qu','queen','👑','/kw/','digraphs','Alphabet review'),

  card('ch','chin','🙂','/ch/','digraphs'), card('sh','ship','🚢','/sh/','digraphs'),
  card('th','thumb','👍','/th/','digraphs'), card('wh','whale','🐋','/w/','digraphs'),
  card('ck','sock','🧦','/k/','digraphs'), card('ph','phone','📱','/f/','digraphs'),
  card('ng','ring','💍','/ng/','digraphs'),

  card('ai','train','🚂','/ā/','vowel teams'), card('ay','play','🛝','/ā/','vowel teams'),
  card('ee','feet','🦶','/ē/','vowel teams'), card('ea','leaf','🍃','/ē/','vowel teams'),
  card('igh','night','🌙','/ī/','vowel teams'), card('ie','pie','🥧','/ī/','vowel teams'),
  card('oa','boat','⛵','/ō/','vowel teams'), card('oe','toe','🦶','/ō/','vowel teams'),
  card('ow','snow','❄️','/ō/','vowel teams'), card('oo','moon','🌙','/oo/','vowel teams'),
  card('ew','chew','😋','/ū/','vowel teams'), card('oi','coin','🪙','/oi/','vowel teams'),
  card('oy','boy','🧒','/oi/','vowel teams'), card('ou','cloud','☁️','/ow/','vowel teams'),
  card('au','haul','🚚','/aw/','vowel teams'), card('aw','saw','🪚','/aw/','vowel teams'),

  card('ar','star','⭐','/ar/','r-controlled'), card('er','fern','🌿','/er/','r-controlled'),
  card('ir','bird','🐦','/er/','r-controlled'), card('or','corn','🌽','/or/','r-controlled'),
  card('ur','turn','↩️','/er/','r-controlled'),

  card('am','ham','🍖','/ăm/','welded sounds'), card('an','fan','🪭','/ăn/','welded sounds'),
  card('all','ball','⚽','/all/','welded sounds'), card('ang','sang','🎤','/ăng/','welded sounds'),
  card('ing','ring','💍','/ing/','welded sounds'), card('ong','song','🎵','/ŏng/','welded sounds'),
  card('ung','lung','🫁','/ŭng/','welded sounds'), card('ank','bank','🏦','/ăngk/','welded sounds'),
  card('ink','sink','🚰','/ĭngk/','welded sounds'), card('onk','honk','📯','/ŏngk/','welded sounds'),
  card('unk','trunk','🌳','/ŭngk/','welded sounds'), card('old','cold','🥶','/ōld/','welded sounds'),
  card('ild','wild','🦁','/īld/','welded sounds'), card('ind','find','🔎','/īnd/','welded sounds'),
  card('olt','colt','🐎','/ōlt/','welded sounds'), card('ost','cost','💲','/ŏst/','welded sounds'),

  card('ble','table','🪑','/bəl/','consonant-le'), card('cle','circle','⭕','/kəl/','consonant-le'),
  card('dle','candle','🕯️','/dəl/','consonant-le'), card('fle','raffle','🎟️','/fəl/','consonant-le'),
  card('gle','wiggle','🪱','/gəl/','consonant-le'), card('kle','pickle','🥒','/kəl/','consonant-le'),
  card('ple','apple','🍎','/pəl/','consonant-le'), card('tle','turtle','🐢','/təl/','consonant-le'),
  card('zle','puzzle','🧩','/zəl/','consonant-le'),

  card('bl','block','🧱','/b/ + /l/','blends'), card('br','brick','🧱','/b/ + /r/','blends'),
  card('cl','clock','🕒','/k/ + /l/','blends'), card('cr','crab','🦀','/k/ + /r/','blends'),
  card('dr','drum','🥁','/d/ + /r/','blends'), card('fl','flag','🚩','/f/ + /l/','blends'),
  card('fr','frog','🐸','/f/ + /r/','blends'), card('gl','glass','🥛','/g/ + /l/','blends'),
  card('gr','grass','🌱','/g/ + /r/','blends'), card('pl','plant','🪴','/p/ + /l/','blends'),
  card('pr','prize','🏆','/p/ + /r/','blends'), card('sl','slide','🛝','/s/ + /l/','blends'),
  card('sm','smile','😊','/s/ + /m/','blends'), card('sn','snail','🐌','/s/ + /n/','blends'),
  card('sp','spoon','🥄','/s/ + /p/','blends'), card('st','stop','🛑','/s/ + /t/','blends'),
  card('sw','swing','🎠','/s/ + /w/','blends'), card('tr','tree','🌳','/t/ + /r/','blends'),
  card('tw','twelve','🔢','/t/ + /w/','blends'),
];

export const visualDrillGroups = [
  { id: 'all', label: 'All cards' },
  { id: 'stage', label: 'Learning stages' },
  { id: 'vowels', label: 'Vowels' },
  { id: 'consonants', label: 'Consonants' },
  { id: 'digraphs', label: 'Digraphs' },
  { id: 'vowel teams', label: 'Vowel teams' },
  { id: 'r-controlled', label: 'R-controlled' },
  { id: 'welded sounds', label: 'Welded sounds' },
  { id: 'consonant-le', label: 'Consonant-le' },
  { id: 'blends', label: 'Blends' },
];
