/**
 * Tutor-facing assessment concepts transcribed and condensed from the supplied
 * BC Scottish Rite Learning Centre Scope & Sequence (updated January 2024).
 * This list tracks concept progress; it does not reproduce the source PDF.
 */
export const ASSESSMENT_LEVELS = [
  {
    id: 'level-1',
    label: 'Level 1 · Basic OG',
    strands: [
      { title: 'Foundational code', items: [
        { id: 'l1-consonants', title: 'Consonant sounds and keywords', detail: 'Recognize and produce taught consonant sounds; use keywords when a sound has more than one spelling or pronunciation.' },
        { id: 'l1-short-vowels', title: 'Short vowel sounds', detail: 'Identify and produce short a, e, i, o, and u sounds with their taught keywords.' },
        { id: 'l1-multiple-sounds', title: 'Multiple sounds for c, g, and s', detail: 'Read the taught hard and soft sounds and use keywords where needed.' },
        { id: 'l1-digraphs', title: 'Consonant digraphs', detail: 'Read and spell th, ch, sh, and wh.' },
        { id: 'l1-blends', title: 'Consonant blends', detail: 'Read and spell taught beginning and ending blends in words.' },
        { id: 'l1-closed-syllable', title: 'Closed syllable', detail: 'Use the closed-syllable pattern to read and spell short-vowel words.' },
        { id: 'l1-floss', title: 'FLOSS rule', detail: 'Apply the f, l, s doubling pattern after a short vowel in one-syllable words.' },
        { id: 'l1-short-vowel-spelling', title: 'Long spelling after a short vowel', detail: 'Choose taught spellings including k/ck, ch/tch, and ge/dge.' },
      ] },
      { title: 'Syllables and longer words', items: [
        { id: 'l1-silent-e', title: 'Silent-e syllable (VCe)', detail: 'Read and spell taught a-e, e-e, i-e, o-e, and u-e patterns, including the ruler pattern.' },
        { id: 'l1-vccv', title: 'Detached syllables: VC.CV', detail: 'Divide and read two-syllable words using the VC.CV pattern.' },
        { id: 'l1-vccve', title: 'Detached syllables: VC.CV-e', detail: 'Divide and read two-syllable words that include a silent-e syllable.' },
        { id: 'l1-vcccv', title: 'Detached syllables: VCCCV', detail: 'Apply the taught VCCCV division pattern.' },
        { id: 'l1-compounds', title: 'Compound words', detail: 'Read, spell, and identify the parts of taught compound words.' },
      ] },
      { title: 'Learned words and connected text', items: [
        { id: 'l1-learned-words', title: 'Level 1 learned words', detail: 'Assess the current taught set, including: the, a, said, are, was, were, to, do, of, put, love, who.' },
        { id: 'l1-connected-text', title: 'Little stories and basic writing', detail: 'Apply taught patterns in short stories, sentences, and optional basic grammar and paragraph work.' },
      ] },
    ],
  },
  {
    id: 'level-2',
    label: 'Level 2 · Intermediate OG',
    strands: [
      { title: 'Syllable patterns and spelling', items: [
        { id: 'l2-open-syllable', title: 'Open syllable', detail: 'Read open-syllable vowels, including vowel sounds in examples such as baby, secret, spider, pony, music, ruby, and fly.' },
        { id: 'l2-welded-sounds', title: 'Welded sounds', detail: 'Read taught ang/ing/ong/ung and ank/ink/onk/unk patterns and wild/old patterns.' },
        { id: 'l2-vowel-r', title: 'Vowel-r syllable', detail: 'Read and spell ar, or, er, ir, and ur patterns, including advanced schwa examples as taught.' },
        { id: 'l2-consonant-le', title: 'Consonant-le syllable', detail: 'Identify, divide, read, and spell consonant-le words.' },
        { id: 'l2-final-y', title: 'Final y in multisyllabic words', detail: 'Read final y as /ē/ or /ī/ in taught multisyllabic words.' },
        { id: 'l2-k-ck', title: 'k/ck spelling pattern', detail: 'Choose k or ck using the taught spelling generalization.' },
        { id: 'l2-ch-tch', title: 'ch/tch spelling pattern', detail: 'Choose ch or tch using the taught spelling generalization and exceptions.' },
        { id: 'l2-ge-dge', title: 'ge/dge spelling pattern', detail: 'Choose ge or dge using the taught spelling generalization.' },
        { id: 'l2-drop-e', title: 'Silent-e drop-e rule', detail: 'Drop final e before adding a vowel suffix when the rule applies.' },
        { id: 'l2-cvc-doubling', title: 'CVC doubling rule', detail: 'Double the final consonant before a vowel suffix in taught one-syllable CVC words.' },
      ] },
      { title: 'Sounds, endings, and affixes', items: [
        { id: 'l2-s-z', title: 's as /z/', detail: 'Read and spell s as /z/ between vowels and in taught plurals and possessives.' },
        { id: 'l2-x-qu', title: 'x and qu', detail: 'Read x as /ks/ and qu as /kw/ in taught words.' },
        { id: 'l2-ed-endings', title: '-ed endings', detail: 'Read -ed as /əd/, /t/, or /d/ in taught words.' },
        { id: 'l2-anglo-prefixes', title: 'Anglo-Saxon prefixes', detail: 'Read and explain taught prefixes such as a-, fore-, mis-, out-, un-, under-, and for-.' },
        { id: 'l2-anglo-suffixes', title: 'Anglo-Saxon suffixes', detail: 'Read and spell taught vowel suffixes (-er, -ing, -est, -y, -ed) and consonant suffixes (-ly, -ful, -less, -ness, -hood).' },
        { id: 'l2-c-g-soft', title: 'Soft c and g', detail: 'Apply the taught c=/s/ and g=/j/ patterns before e, i, and y.' },
      ] },
      { title: 'Vowel teams and advanced patterns', items: [
        { id: 'l2-vowel-teams', title: 'Vowel team syllable', detail: 'Read and spell taught teams: ai/ay, ee/ea, oa/ow, ue/ew, oi/oy, ou/ow, au/aw, oo/oo, and igh.' },
        { id: 'l2-ea-variations', title: 'ea spelling variations', detail: 'Distinguish taught ea pronunciations, including eat, bread, and less-common patterns.' },
        { id: 'l2-tion', title: '-tion', detail: 'Read and spell taught -tion words with /shun/.' },
        { id: 'l2-sion', title: '-sion', detail: 'Read and spell taught -sion patterns, including /shun/ and /zhun/.' },
      ] },
      { title: 'Learned words and connected text', items: [
        { id: 'l2-learned-words', title: 'Level 2 learned words', detail: 'Assess the current taught set, including: one, two, once, come, some, does, done, gone, they.' },
        { id: 'l2-connected-text', title: 'Phrases, clauses, and paragraphs', detail: 'Apply taught skills in phrases, clauses, compound/complex sentences, and basic paragraph writing.' },
      ] },
    ],
  },
  {
    id: 'level-3',
    label: 'Level 3 · Advanced OG',
    strands: [
      { title: 'Advanced spelling patterns', items: [
        { id: 'l3-y-rule', title: 'Y spelling rule', detail: 'Keep or change y according to the taught suffixing rule.' },
        { id: 'l3-rare-vowels', title: 'Rare vowel spellings', detail: 'Assess taught patterns such as ei, ie, eigh, oe, ew, ue, ui, eu, ey, and y-e; teach as needed.' },
        { id: 'l3-odd-spellings', title: 'Odd spellings', detail: 'Recognize and apply uncommon spellings when needed for a learner’s word reading.' },
        { id: 'l3-silent-letters', title: 'Silent letters', detail: 'Read and spell taught words containing silent letters.' },
        { id: 'l3-cv-vc', title: 'CV/VC syllable division', detail: 'Divide and read taught CV/VC words, including patterns such as li.on.' },
        { id: 'l3-doubling', title: 'Extended CVC doubling', detail: 'Apply extended doubling rules to multisyllabic words and suffixes.' },
      ] },
      { title: 'Greek, French, and morphology', items: [
        { id: 'l3-greek-code', title: 'Greek code', detail: 'Read taught Greek patterns, including ch=/k/, ph=/f/, and y=/ĭ/.' },
        { id: 'l3-french-code', title: 'French code', detail: 'Read taught French patterns, including ch=/sh/, que=/k/, and ou=/ōō/.' },
        { id: 'l3-latin-prefixes-a', title: 'Latin prefixes: de-, dis-, inter-, re-', detail: 'Read and explain these prefixes in taught words.' },
        { id: 'l3-latin-roots-a', title: 'Latin roots: rupt, port, ject, press, sist, tract', detail: 'Recognize and use the taught roots in related words.' },
        { id: 'l3-suffixes', title: 'Advanced suffixes', detail: 'Read and spell taught -ed, -ing, -ive, -y, -ment, and -ly patterns.' },
        { id: 'l3-chameleon-prefixes', title: 'Chameleon prefixes', detail: 'Recognize taught assimilated forms such as in-/im-/ir-/il-, con-/com-/cor-, and related forms.' },
        { id: 'l3-prefixes-b', title: 'Latin prefixes: ob-, pro-, trans-, sub-', detail: 'Read and explain taught prefixes and their related forms.' },
        { id: 'l3-latin-roots-b', title: 'Latin roots: form, tort, struct, sect, gress, spect', detail: 'Recognize and use the taught roots in related words.' },
        { id: 'l3-connectives', title: 'Latin connectives and advanced suffixes', detail: 'Apply taught connectives (i, u, ul, ol) and endings such as -ate, -al, -ture, -age, and -ative.' },
        { id: 'l3-word-choices', title: 'Advanced spelling choices', detail: 'Choose among taught endings such as -or/-er, -ar, -tion/-sion/-ion, and -able/-ible.' },
        { id: 'l3-greek-roots', title: 'Greek roots and number prefixes', detail: 'Recognize taught Greek roots and Latin/Greek number prefixes.' },
      ] },
      { title: 'Learned words and review', items: [
        { id: 'l3-learned-words', title: 'Level 3 learned words', detail: 'Assess the current taught set, including: sure, sugar, friend, build, buy, though, enough, their, people, talk, walk, chalk, fruit, business.' },
        { id: 'l3-other-learned-words', title: 'Additional learned words', detail: 'Track other individually taught words from the tutor’s selected word lists.' },
        { id: 'l3-advanced-review', title: 'Advanced word attack review', detail: 'Apply advanced syllable, spelling, morphology, and learned-word strategies in connected reading and spelling.' },
      ] },
    ],
  },
];

export const ASSESSMENT_ITEMS = ASSESSMENT_LEVELS.flatMap(level =>
  level.strands.flatMap(strand => strand.items.map(item => ({ ...item, levelId: level.id, levelLabel: level.label, strand: strand.title }))),
);

export const ASSESSMENT_ITEM_IDS = new Set(ASSESSMENT_ITEMS.map(item => item.id));
