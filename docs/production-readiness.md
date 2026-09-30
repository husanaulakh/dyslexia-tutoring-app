# Production-readiness review

Reviewed September 30, 2026. Bright Steps is suitable for tutor-led use as a static application within the storage and privacy limits below. The review found and fixed concrete correctness and data-safety issues; automated checks do not establish that every possible browser or teaching scenario is covered.

## Findings fixed

| Issue | Fix and coverage |
|---|---|
| Vercel extensionless activity routes disabled Finish step | Match exact known activity paths with or without `.html`; test deployed-style redirects and suggestion query handoff. |
| Leaving or refreshing mid-practice could lose completed outcomes | Checkpoint completed outcomes across seven scored activities, using one updating run ID. Test partial practice, reload, early lesson completion, and save failures. |
| Repeated saves and failed End lesson retries could duplicate history | Reuse persisted run IDs and upsert summaries; stale checkpoints cannot decrease completion counts. |
| Failed saves had no reliable retry or reload recovery | Provide retry controls, guard lesson navigation and unload, and retain validated aggregate-only recovery in session storage. Test recovery without changing the learner or retaining response text. |
| Missing learner or unreadable data could allow misleading lesson completion | Keep the lesson active until its pinned learner can be verified and completion saved. |
| Malformed/newer learner data and unreadable tutor collections could be replaced | Preserve unsupported data, refuse destructive writes, and reject tutor-list saves if stored bytes changed since load. |
| Duplicate assessment entries retained older statuses | Select the latest timestamp, with the last source entry winning ties. |
| Repeated suggestions consumed saved-list capacity | Reuse an exact unchanged suggested list, including at the 12-list limit; preserve edited lists. |
| Board, card, and tracing rerenders lost keyboard focus | Restore relevant control focus and test repeated keyboard operation. |
| Covered spelling permitted unbounded retries | Allow one retry, then provide tutor-confirmed continuation; retain paper and reduced-motion paths. |
| Sound Box inputs beyond 40 annotations were silently truncated | Reject excessive nonblank entries explicitly; phoneme counts still depend on tutor annotations. |

## Maintainability

Repeated outcome validation, aggregate-session lifecycle, tutor-collection storage protection, and route comparison now live in shared modules. Activity-specific interaction and content remain in their own small modules, with unit tests for pure logic and browser tests for integration. Reading and Paragraph editor markup remains separate because their prompts and practice flows differ; a framework or build pipeline is unnecessary for the present scope.

The site has no runtime npm dependencies, backend, analytics, or added external scripts. Development dependencies are lockfile-managed. Continue running syntax, unit, browser, and accessibility checks for every change, and periodically review dependency updates and the audit report. New scored activities should use the shared session and outcome helpers.

## Validation

- JavaScript syntax checks passed.
- 78 unit tests passed.
- 85 Chromium browser tests passed, including axe accessibility checks, narrow screens, keyboard use, hostile input, reduced motion, paper/screen responses, answer concealment, storage migrations, retry bounds, failure recovery, and a mixed-level lesson.
- `npm audit`: zero reported vulnerabilities.
- Production route behavior is exercised locally using redirects matching the repository's `cleanUrls` setting. See [Vercel's configuration documentation](https://vercel.com/docs/project-configuration/vercel-json).
- GitHub Quality checks and Vercel deployment status are checked against the pushed commit; local Chromium uses the supported executable override, while CI installs its own browser.

## Operational limits

- Use initials or non-identifying learner codes. There is no server-side learner database, automatic backup, or cross-device synchronization.
- Completed aggregates survive ordinary reloads; unfinished answers and the current practice card position do not resume. Active lesson position does resume.
- Failed-save recovery is local to the current tab, bounded to 20 aggregate records, and requires session storage. If both storage mechanisms are unavailable, keep the page open and retry. Browser unload guards are best effort, and clearing site data or closing a tab can lose unsaved recovery data.
- Multi-tutor simultaneous editing is not supported. Tutor collection writes detect intervening changes and preserve the other version; learner-store writes are synchronous but are not a distributed transaction system.
- Automated browser coverage is Chromium. Separate Safari/Firefox and real tutor sessions remain useful compatibility checks.
- Learner presentation hides editing tools on the shared screen. A private synchronized tutor display remains a later extension.
