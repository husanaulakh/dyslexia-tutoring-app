# Bright Steps — Dyslexia Tutoring Activities

A small, static collection of tutor-led reading practice activities. The site is plain HTML, CSS, and JavaScript; it has no build step or runtime dependencies.

## Activities

- **What’s Missing?** Letter sequence practice with configurable card count and missing-letter position.
- **Blending Board** Sound-by-sound word blending with editable lesson word lists.
- **Trace, Copy, Cover, Close** Tutor-set word practice with animated letter tracing and oral tutor checks.
- **UFLI Virtual Blending Board** An embedded link to the UF Literacy Institute’s externally hosted board; internet access is required.
- **Visual Drill Cards** An original front/back keyword deck with staged single-letter cards and later phonics patterns.

## Deploy to Vercel

1. Import this GitHub repository in Vercel.
2. Leave the framework preset as **Other** and leave the build and output directory fields empty.
3. Deploy. Vercel serves `index.html` at the site root, and each activity is linked from the landing page.

No environment variables are required.

## Quality and security

- `npm run check` validates JavaScript syntax. `npm run test:unit` runs the pure-logic unit tests, and `npm run test:e2e` runs Playwright interaction and axe accessibility tests. `npm test` runs both suites.
- GitHub Actions runs these checks on each push and pull request. To make CI a hard gate before merging, configure the repository to require the **Quality checks** status check and protect `main`; this repository is currently configured for pushes directly to `main`.
- Vercel responses include a restrictive Content Security Policy and standard security headers. The UFLI frame is requested only after a tutor clicks its load button.
- `robots.txt` and the page metadata ask compliant crawlers not to index or fetch the site. `AGENTS.md` gives coding assistants repository-specific handling rules. Neither mechanism can prevent a determined scraper from copying public static pages; avoid putting private learner information here.
