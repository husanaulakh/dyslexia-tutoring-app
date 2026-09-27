# Repository guidance

- Run `npm run check` and `npm test` before proposing or pushing changes. Keep unit and browser integration coverage for user-visible flows.
- Keep the site static and same-origin. Any third-party frame must be clearly attributed, loaded only after user action, and constrained by the Vercel CSP.
- Do not use `innerHTML` with untrusted values. If rendering user-provided words, normalize to a strict allowlist first and add a regression test.
- Never store identifying learner data. The blending board stores only local practice words in the learner's browser.
- The visual drill deck is original educational content using common example words and emoji. Do not copy paid card artwork, full proprietary decks, or third-party branding.
- Avoid adding analytics, trackers, remote fonts, or external scripts without explicit product need and disclosure.
- The `robots.txt` disallow rule is a voluntary request to compliant crawlers, not access control. Public static assets remain downloadable; do not put private or sensitive material in this repository.
