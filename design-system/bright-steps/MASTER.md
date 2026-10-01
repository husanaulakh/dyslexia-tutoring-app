# Bright Steps interface direction

## Audience and priorities

The tutor prepares a lesson, then guides a learner through practice. Planning needs clear choices and recoverable changes. Practice needs readable material with quiet tutor controls. Selected words, cards, lists, and supported settings carry from the plan to each activity; concepts annotate the lesson rather than generate material.

## Visual system

Use the existing navy, green, mint, and warm orange palette in `assets/css/theme.css`. Navy anchors the planning header. Mint groups the ordered practice sequence. Warm orange remains a spelling-tile cue on the Board. Do not change instructional colors merely to decorate the page.

Use local system sans-serif fonts. Separate groups with space; apply borders to controls and soft surface shapes to related content. Show one main action for the current task, with quieter secondary actions. Keep actions in normal document flow so enlarging text does not hide controls under fixed chrome.

The planner uses four numbered stages. Larger screens show the activity editor alongside the sequence; smaller screens retain the same reading order in one column. Avoid fixed heights on content or truncating learner codes and activity names.

## Interaction

- Order activities from a grip on the leading edge. Support pointer dragging, keyboard arrows, and a tap/click disclosure with move actions. Escape cancels an in-progress pointer drag. Keep body text selectable.
- Keep display settings in a labeled disclosure. Leave the learner/tutor-view toggle visible.
- Prioritize Finish step during a lesson. Put Review lesson plan and End lesson under Lesson options. Back and Next navigate without completing a step.
- Put word editing and the dictionary behind labeled Board disclosures. Next word stays near the spelling tiles.
- Preserve native form controls and their visible labels. Do not require hovering or dragging to access an action.

## Accessibility and verification

Use 44 CSS-pixel targets, visible focus, normal-text contrast of at least 4.5:1, and explicit status text. Honor reduced motion. Check keyboard operation, narrow screens, enlarged reading text, 200% browser zoom equivalents, and mirrored layout. Run the existing syntax, unit, browser, and axe checks before publishing changes.

## Guidance sources and adaptations

The requested [UI/UX Pro Max skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) supplied education-app and interaction guidance. Its generic landing-page structure, playful 3D effects, and remote font suggestions do not fit this tutor workspace; the existing branding and static hosting constraints govern the implementation. Its dragging-movements guidance requires a single-pointer alternative as well as keyboard operation.

[UI Skills' better-layout](https://www.ui-skills.com/skills/jakubkrehel/better-layout), selected through the requested Codex catalog, guides grouping, reading order, progressive disclosure, and responsive wrapping. No runtime dependencies or external font/script requests are introduced.
