# Bright Steps activity and data guide

Bright Steps is a collection of independent tutor-led activities. Any activity can still be opened and used without Lesson Builder. A lesson is an optional same-origin sequence of practice pages.

## Activity registry

`data/activity-registry.mjs` is the catalog source. Each entry has a stable `id`, display `label`, same-origin `path`, `kind`, `available` flag, validated scope `conceptIds`, and supported `screen`/`paper` modes. Lesson Builder must list only practice or reading descriptors whose `available` flag is true. Guidance, tracking, and external entries are not lesson steps.

| Stable ID | Page | Kind | Scope concept IDs |
|---|---|---|---|
| `whats-missing-cards` | `/activities/whats-missing-cards.html` | practice | `l1-consonants` |
| `blending-board` | `/activities/blending-board.html` | practice | `l1-short-vowels`, `l1-digraphs`, `l1-blends`, `l1-closed-syllable` |
| `trace-copy-cover-close` | `/activities/trace-copy-cover-close.html` | practice | `l1-short-vowel-spelling`, `l2-k-ck`, `l2-ch-tch`, `l2-ge-dge` |
| `visual-drill-cards` | `/activities/visual-drill-cards.html` | practice | `l1-consonants`, `l1-short-vowels`, `l1-digraphs`, `l1-blends`, `l2-vowel-teams`, `l2-vowel-r`, `l2-welded-sounds`, `l2-consonant-le` |
| `reading-words` | `/activities/reading-words.html` | reading | `l1-short-vowels`, `l1-digraphs`, `l1-blends`, `l2-vowel-teams` |
| `paragraph-reading` | `/activities/paragraph-reading.html` | reading | `l1-connected-text`, `l2-connected-text`, `l3-advanced-review` |
| `sound-boxes` | `/activities/sound-boxes.html` | practice | `l1-short-vowels`, `l1-digraphs`, `l1-blends` |
| `auditory-dictation` | `/activities/auditory-dictation.html` | practice | `l1-short-vowel-spelling`, `l1-digraphs`, `l1-blends` |
| `word-workshop` | `/activities/word-workshop.html` | practice | `l1-silent-e`, `l1-floss`, `l1-vccv`, `l1-closed-syllable`, `l2-open-syllable`, `l2-vowel-teams`, `l2-vowel-r`, `l2-consonant-le` |
| `tutor-suggestions` | `/activities/tutor-suggestions.html` | guidance | `l1-short-vowels`, `l1-closed-syllable`, `l1-digraphs`, `l1-blends`, `l1-floss`, `l1-silent-e`, `l1-vccv`, `l2-vowel-teams`, `l2-vowel-r`, `l2-consonant-le` |
| `student-progress` | `/activities/student-progress.html` | tracking | none |
| `ufli-blending-board` | `/activities/ufli-blending-board.html` | external | `l1-short-vowels`, `l1-digraphs`, `l1-blends` |

The concept IDs refer to the local assessment map in `data/assessment-scope-sequence.mjs`; they are not copies of the source map’s artwork or learner records.

## Tutor workflows

### Lesson Builder

Lesson Builder lets a tutor select a learner label, one or more scope concepts, and an ordered sequence of activities whose registry `available` flag is true. Steps store a response mode and validated activity settings, such as a saved reading list, a subset of visual drill cards, selected annotated Sound Boxes words, or one of the Word Workshop strands. An activity must read its matching lesson context for a stored setting to take effect.

Templates can be reused in the same browser. During a lesson, the learner is pinned; the toolbar provides **Back**, **Finish step**, **Next**, and **End lesson**. The current step’s settings and concept IDs are exposed to an activity only when its stable activity ID matches the active step. Lesson context survives ordinary page navigation and a reload in the same tab.

Lesson templates use local storage; the active lesson position uses session storage. The learner label should be initials or a non-identifying code. A tutor can also open any practice page directly without creating a lesson queue.

### New phonics activities

- **Sound Boxes** uses explicit tutor annotations for each phoneme in a word. A phoneme is a sound; it is not inferred from the number of letters or spelling tiles. The tutor can use physical counters on paper or accessible on-screen counters. The written word stays concealed until reveal, then the tutor records Independent, With help, or Revisit.
- **Auditory Dictation** has the tutor speak a sound or word. The learner may write on paper or enter a response on screen. Accepted spellings are an explicit content allowlist. The answer is revealed after the attempt and the tutor confirms the outcome; response text is not retained.
- **Word Workshop** includes the `silent-e`, `sort`, `syllables`, and `vccv` strands: silent-e transformations, FLOSS/ai/ay sorting, six syllable types, and tutor-annotated VC.CV divisions. VC.CV boundaries come from explicit instructional annotations and are never guessed from spelling. Items can be practiced on screen or on paper.

Starter examples for these activities are original content in `data/sound-boxes-words.mjs`, `data/auditory-dictation-items.mjs`, and `data/word-workshop.mjs`.

### Reading and visual practice

- **Reading Words** uses local tutor lists. A missed word returns once after three other words; the retry is shown separately from first presentations.
- **Paragraph Reading** uses local tutor passage lists and returns each passage for rereading after three others.
- Both reading activities ask the tutor to record Independent, With help, or Revisit. First-response counts and retry counts are stored separately as `outcomeCounts` and `retryOutcomeCounts`; typed responses are transient. Paragraph lists can include oral comprehension prompts. Rereading defaults to all paragraphs; tutors may choose needs-practice only.
- **Tutor Suggestions** offers original word sets grouped from foundational patterns to more complex patterns. Each set names a tutor-observable reading behavior, gives a short pattern reminder, and includes explicit mapped concept IDs. The page suggests practice; it does not infer a diagnosis or change assessment status. A tutor may copy a set into Reading Words. This creates a local tutor list and navigates to `/activities/reading-words.html?list=<safe-list-id>`; Reading Words validates the ID and does not automatically start practice or select a learner. During an active lesson, this transfer is disabled so the current template and list stay fixed.
- **Visual Drill Cards** uses the original Bright Steps keyword-card collection in `data/visual-drill-cards.mjs`. Tutors can choose a subset for recall practice, reveal the card, and mark Independent, With help, or Revisit.
- **What’s Missing?** practices alphabet sequence recall with configurable card count and missing-letter position.
- **Blending Board** uses 2–6 spelling chunks as tiles and stores tutor-authored words in the browser. Suggested splits require tutor confirmation; manual splits are checked against the word. These are written chunks, not phoneme counts.
- **Trace, Copy, Cover, Close** guides oral reading, tracing, copying, covered recall, and spoken spelling. The tutor can confirm Copy/Cover on paper or screen. Reduced-motion settings skip timed tracing animation.
- **Student Scope & Sequence** keeps assessment status changes tutor-controlled; practice results do not automatically mark an assessment concept secure.

### Presentation controls

Local Bright Steps activity pages share presentation controls. **Show learner view** hides editing tools in the current screen. Text size options are 100%, 125%, and 150%; line spacing options are 1.5, 1.8, and 2.0. Preferences persist in the current browser. This is a shared-screen view: anyone looking at the same display sees the same page. A private tutor view paired with a separate synchronized learner view is deferred. The external UFLI page retains its own in-frame font controls.

## Browser storage

Bright Steps has no server-side learner database. These local browser keys are origin-specific and are not synchronized or backed up:

| Key | Storage | Purpose |
|---|---|---|
| `bright-steps-student-progress` | `localStorage` | Student labels, activity summaries, aggregate outcomes, and assessment statuses. Schema version 3 migrates unversioned version 0, version 1, and version 2 data. |
| `bright-steps-lesson-templates` | `localStorage` | Reusable lesson templates, including activity IDs, selected concept IDs, response modes, and allowlisted settings. |
| `bright-steps-lesson-builder-draft` | `localStorage` | In-progress plan configuration, selected template ID and wizard stage; no learner labels or responses. |
| `bright-steps-pending-outcomes` | `sessionStorage` | Up to 20 failed aggregate checkpoints retained for same-tab recovery; no learner response text. |
| `bright-steps-active-lesson` | `sessionStorage` | Active template snapshot, pinned learner ID, current step index, completed step IDs, and start time for the current tab session. |
| `bright-steps-presentation` | `localStorage` | Text size and line spacing preferences. |
| `bright-steps-reading-word-lists` | `localStorage` | Tutor-authored Reading Words lists. |
| `bright-steps-paragraph-reading-lists` | `localStorage` | Tutor-authored paragraph lists. |
| `bright-steps-word-workshop-v1` | `localStorage` | Tutor-authored VC.CV annotations. |
| `blending-board-words-standalone` | `localStorage` | Tutor-authored blending board words and spelling chunks. |

Student-store version 3 session summaries retain counts, optional concept IDs, aggregate outcomes (`independent`, `supported`, `revisit`), and separate `retryOutcomeCounts` where a reading activity has retries. Raw learner answers, dictated spelling text, and paragraph responses are not part of the supported session schema. Use initials or non-identifying codes for learner labels; anyone with access to the browser profile may see locally stored data.

The private paired tutor/learner display remains a later extension.

## Content and hosting

Starter reading examples, word sets, prompts, and card artwork are original or common instructional examples. VC.CV boundaries are explicit tutor annotations, not inferred from spelling. The BC Scottish Rite Learning Centre scope map is an internal reference for the concept sequence; do not add its scans, proprietary artwork, or photographed learner work. The UFLI board is an independently linked external activity and requires internet access.

The project remains static HTML, CSS, and JavaScript. No build step, deployment setting, external service, or Content Security Policy change is required for local features.

## Shared persistence and maintenance

`practice-outcomes.mjs` defines the accepted outcomes and immutable count updates. `practice-session.mjs` manages a stable practice run ID, checkpoints, save retries, navigation guards, and aggregate recovery. `collection-storage.mjs` reads and writes tutor collections without overwriting unreadable data or a collection changed in another tab. `activity-routing.mjs` matches each known activity on both `.html` and extensionless hosting routes.

Completed tutor outcomes checkpoint immediately. Reloading preserves completed aggregates, but the activity's current card position and unfinished typed work reset. Failed checkpoints use the same ID on retry and are recovered from session storage when possible. Recovery writes only the original learner's aggregate, even if another learner is now selected. Active lessons have a persisted run ID; delayed snapshots cannot decrease a stored completion count. End lesson retains its active state when the learner cannot be verified or a save fails.

If both local storage and session storage are unavailable, keep the activity open and retry after restoring storage. Browser unload protection is best effort; clearing site data or closing a tab with unsaved session-only recovery can still lose those outcomes. Stored data from a newer schema and malformed stored collections are preserved for manual recovery. Cross-device synchronization, automatic backup, and multi-tutor concurrent editing are outside the current static application's scope.

Lesson Builder’s guided stages, draft recovery, step editing, saved material selection, and completion flow are described in [the tutor planning guide](lesson-planning.md). The homepage **Build a lesson** link starts the wizard; direct activity access stays available.
