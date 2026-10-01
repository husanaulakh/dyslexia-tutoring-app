# Tutor experience review — 1 October 2026

The completed Lesson Builder, Blending Board, and shared controls received an independent review by a GPT-6.1 Sol worker with high reasoning effort. The reviewer inspected source, exercised the current pages in Chromium, and supplied findings before the changes were pushed.

## Lesson Builder

The four numbered stages and grouped activity editor make the plan easier to scan. The sequence uses a leading drag grip with keyboard arrows and a click/tap move menu. Practice material and supported settings carry into activities; selecting concepts does not generate content.

Two correctness issues were addressed with regression coverage:

- Edit and Remove resolve the current step by stable ID after dragging, so they cannot act on its former position.
- Future-plan edits survive reload during an active lesson. The running lesson remains unchanged, with its original learner, order, position, and settings. A valid empty draft also survives; an unreadable draft falls back to the running template.

The reviewer independently checked mouse and emulated touch dragging, move menus, cancellation, lost pointer capture, keyboard order recovery, draft recovery, and Resume.

## Blending Board

The full-width tile stage gives practice priority. Filters, word editing, the dictionary, and tutor prompts have labeled disclosures. Next word is the main practice action. Spelling chunks remain distinct from phoneme counts.

The reviewer found that moving editing below the board could leave bulk split previews offscreen while confirmation was visible. The preview now sits immediately before confirmation; single-word feedback appears near the inputs. General practice and storage notices remain beside the board. The reviewer rechecked the preview and confirmation together at 375 × 812.

## Shared controls

Display options contains text size, spacing, and the shared-screen explanation. The learner-view toggle stays visible. Lesson options holds Review lesson plan and End lesson; Back, Next, and Finish step remain available.

The reviewer confirmed that Back/Next navigate without marking completion, Finish marks only the current step, End clears the active run after saving, and the desktop toolbar reflows across narrow widths. Editing tools are hidden in learner view; this remains the same view for everyone watching a screen share.

## Verification scope

Release checks include JavaScript syntax, logic/storage unit tests, Playwright user flows, and axe scans, including a complete mixed-level paper/screen lesson. Dedicated checks cover stable reorder IDs, touch emulation, edge scrolling, reduced motion, draft recovery, 375–1440px planning layouts, enlarged reading text, a 200% zoom equivalent, and mirrored planning layout.

Browser checks use installed Chromium locally. Physical phones, Safari, Firefox, and human screen-reader use were not verified. Chromium touch emulation showed a possible first-tap suppression immediately after a native drag; the following tap opened the menu, and the app received no click for the suppressed tap. This needs a real-device check. The completed fixes introduce no runtime packages or external font/script requests.
