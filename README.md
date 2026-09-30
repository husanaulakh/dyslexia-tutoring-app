# Bright Steps — Dyslexia Tutoring Activities

Bright Steps is a static collection of tutor-led reading practice tools. It uses HTML, CSS, and JavaScript with no build step, server-side application, or runtime dependencies. Practice pages can be used on their own or assembled into a lesson in Lesson Builder.

## Activities

- **Lesson Builder** saves reusable templates, attaches scope concepts, and arranges an ordered sequence of available activities. A lesson keeps the learner selected at start, and the shared toolbar provides Back, Finish step, Next, and End lesson navigation.
- **Sound Boxes** uses tutor-provided phoneme annotations for 2–6 sounds. Phoneme counts are not inferred from the number of letters. Learners can use physical counters or on-screen counters; the written word is revealed after mapping.
- **Auditory Dictation** has the tutor say a sound or word. Learners respond on paper or type; the tutor reveals accepted spellings and records an outcome.
- **Word Workshop** includes silent-e transformations, FLOSS/ai/ay sorting, six syllable types, and explicitly annotated VC.CV practice.
- **Reading Words** practices tutor-managed word lists and brings missed words back once after three other words.
- **Paragraph Reading** practices tutor-managed passages with optional oral comprehension prompts and configurable rereading.
- **Tutor Suggestions** offers original, concept-linked word sets for tutor selection. A selected set can be saved as a Reading Words list.
- **Blending Board** supports 2–6 spelling tiles, tutor-defined words, and checked manual splits.
- **Trace, Copy, Cover, Close** guides tutor-set word practice with letter tracing, copying, covered spelling, and oral confirmation, including paper confirmation for Copy/Cover.
- **Visual Drill Cards** presents an original front/back keyword card collection with tutor-selected recall subsets and tutor-marked outcomes.
- **What’s Missing?** offers configurable letter-sequence practice.
- **Student Scope & Sequence** tracks tutor-controlled assessment statuses for Level 1, Level 2, and Level 3 concepts.
- **UFLI Virtual Blending Board** links to an externally hosted tool; internet access is required.

Reading and recall activities record tutor-confirmed Independent, With help, or Revisit outcomes. Initial responses and retries are counted separately. Practice summaries do not change assessment status; tutors control assessment updates in Student Scope & Sequence.

Shared presentation controls provide a learner view, text sizes of 100%, 125%, or 150%, and line spacing of 1.5, 1.8, or 2.0. This changes the current screen only; it does not create a private tutor view during screen sharing. The external UFLI activity keeps its own in-frame font controls. See [the activity guide](docs/activities.md) for the activity registry, local storage keys, lesson flow, and content details.

## Deploy to Vercel

1. Import this GitHub repository in Vercel.
2. Leave the framework preset as **Other** and leave the build and output directory fields empty.
3. Deploy. Vercel serves `index.html` at the site root, with activity pages linked from the landing page.

No environment variables are required. The static hosting setup and Content Security Policy do not require a build step or new services.

## Quality and security

- `npm run check` validates JavaScript syntax. `npm run test:unit` runs logic and storage tests, and `npm run test:e2e` runs Playwright interaction and axe accessibility tests. `npm test` runs both suites.
- CI uses its normal browser installation. If a local Playwright browser is unavailable, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chromium executable when running Playwright, for example: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium npx playwright test`.
- GitHub Actions runs checks on pushes and pull requests. The repository’s **Quality checks** status is the CI check; branch protection determines whether it is required before merging.
- Vercel responses include a restrictive Content Security Policy and standard security headers. The UFLI frame loads only after a tutor requests it.
- `robots.txt` and page metadata ask compliant crawlers not to index or fetch the site. They are not access control. Avoid putting sensitive learner information in public static content.

Student labels, aggregate activity summaries, assessment statuses, lesson templates, and presentation preferences remain in the current browser profile on the same origin. They are not backed up or synchronized to other devices. Use initials or non-identifying learner codes. Typed and spoken learner responses are not stored in session summaries. Tutor Suggestions saves selected word lists locally and opens them in Reading Words with a validated `?list=` ID; this does not start a lesson or select a learner.
