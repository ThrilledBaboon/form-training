# Local implementation plan

Build FORM, an original personal training app. No personal records are seeded. No server, telemetry, accounts or external runtime requests. Complete local development and verification first, then publish the reviewed source and static build to GitHub Pages. Hosting does not move workout history out of the browser.

1. Foundation: React + TypeScript + Vite; versioned Dexie database; typed operations, calculations, original design system and exercise catalogue.
2. Training: durable active sessions and set edits, previous performance, timer timestamps, group membership, history editing and undo.
3. Planning: editable routines, programmes, scheduled sessions, routine snapshots and exercise management.
4. Analysis: real-data charts, recommendations, PRs, bodyweight trends, original selectable SVG anatomy, contribution/recovery views and calendar.
5. Reliability: validated transactional imports, recovery snapshots, JSON/CSV exports, update prompts and offline caching.
6. Verification: calculation and storage tests, mobile/desktop browser flows, offline/reload checks, repository-subpath production build, documentation.
7. Publication: review source, create the GitHub repository, run hosted CI, configure Pages, deploy and check the actual HTTPS site.

## Structure

- `src/lib`: schema, database, commands, calculations, backup validation.
- `src/components`: accessible reusable controls, anatomy and charts.
- `src/pages`: Today, workout, routines, exercises, progress, muscles, calendar, bodyweight, settings.
- `tests`: unit and IndexedDB integration tests.
- `e2e`: production-browser tests.
- `docs`: schema, methods, backup, deployment and limitations.

## Main risks and approach

- Data durability: await IndexedDB writes; show errors; stable IDs; atomic multi-table writes; versioned schema and migration tests; never auto-load example workouts.
- Fast phone logging: large controls, immediate field persistence, idempotent completion and persistent timers. Desktop and phone browser checks.
- Analytics: one canonical unit (kg/metres/seconds); only completed sets; transparent exclusions and independently inspectable muscle contributions.
- Anatomy: original SVG with selectable named regions and equivalent accessible list; training contribution separated from estimated recovery.
- Static hosting: hash navigation, configurable base, precached app shell and local assets; verify subpath offline. Prompt before service worker updates so active work is preserved.
- Backups: validate every entity and relationship, preview duplicate IDs, merge without overwriting existing IDs, replacement only after confirmation and recovery snapshot. Browser snapshots are not independent backups.
