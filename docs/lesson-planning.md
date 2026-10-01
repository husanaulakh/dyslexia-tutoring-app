# Planning a Bright Steps lesson

Lesson Builder supports a guided plan and a quick-edit view. **Build a lesson** on the home page and **Plan a lesson** in an activity open the four-stage wizard. Open `/activities/lesson-builder.html?wizard=1` to begin with that wizard, or open `/activities/lesson-builder.html` for the quick-edit view. The “Use planning wizard” and “Use quick edit” control switches views without clearing the current plan.

## Guided stages

1. **Learner and plan** — select a learner’s initials or code, name the plan, and optionally load a saved template. “New plan” clears the current draft without changing saved templates.
2. **Concepts** — select the concepts the tutor plans to practise. This adds context to progress summaries; it does not change tutor-controlled assessment status.
3. **Activities** — choose an available activity, response mode, starter list or saved items, and supported activity settings. Add steps, reorder them with the grip beside each step, edit them in place, or remove them. The grip also supports keyboard arrows and a click/tap menu for moving without dragging. Editing keeps the step ID and sequence position. A step with an explicitly empty item selection cannot be added; restore at least one selected item first.
4. **Review and start** — check the learner, concepts, order, response modes, and configured practice details before starting. Save a template, save as a new template, or start the lesson.

The review stage displays the configured tutor word for Trace, Copy, Cover, Close; paragraph comprehension prompts and rereading choice; What's Missing card count and missing-letter position; blending-board spelling-tile count; selected visual cards, words, or activity items; and the selected Word Workshop strand. Word and paragraph list links open their same-origin activity pages in the same tab so the tutor can manage material and return to the saved draft.

**Does the plan fill the activities automatically?** Yes: starting a step applies its selected material, response mode, and supported settings. Activities with starter content begin with that content when the tutor leaves the defaults selected. Choose a saved list or add tutor material before starting when you need a specific set. Choosing a concept alone does not generate words or passages. Responses and assessment decisions remain tutor-led.

Before starting, the builder checks that explicit saved list and item selections still exist. If a word list, Board word, or Workshop annotation was removed—or a Board tile count has no matching words—it keeps the plan and asks the tutor to edit that step or restore the material.

## Drafts, templates, and active lessons

Reusable templates are stored in local storage. The in-progress builder draft uses the `bright-steps-lesson-builder-draft` local-storage key and contains plan configuration only: its name, concept IDs, ordered activity settings, selected template ID, current wizard stage, and current activity-form settings. It does not store learner labels, learner response text, or assessment statuses. Draft recovery is best effort if browser storage is unavailable.

An active lesson is stored separately in session storage. Its learner is pinned for the whole sequence. Returning to Lesson Builder restores the valid planning draft and exposes Resume. If the draft is unavailable, the builder uses the active lesson template as a starting point. Edits in the builder apply to a future plan, survive reloads, and do not alter the running sequence. Templates and active lesson state are local to the browser profile and current tab session, respectively.

“Save template” updates a template only after it has been loaded or explicitly saved under its ID. “Save as new template” creates another template and leaves the selected source template unchanged.

## Navigation and completion

The activity toolbar provides Back, Finish step, and Next, with Review lesson plan and End lesson under **Lesson options**. Back and Next only move through the sequence; they do not mark a step complete. The tutor uses Finish step to record completion. End lesson records the lesson-level aggregate, then returns to the builder. On returning, a validated completion link can show the aggregate step count. Individual learner responses are not stored in the plan or completion summary.

**Display options** holds text size and line spacing. The learner-view toggle stays visible. Learner view hides editing controls on the current screen; everyone viewing a screen share sees that same screen. The Blending Board opens with editing tools and its dictionary folded away; expand their labeled sections to manage practice words.

Direct activity links remain available for practice outside a lesson queue. The planning wizard prepares a tutor-led sequence; it does not infer diagnoses or automatically change concept assessment status.
