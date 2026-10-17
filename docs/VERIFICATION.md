# Implementation and verification record

## Custom workspace — 18 October 2026, local

The custom workspace builds on the unpublished Food extension on `codex/custom-workspace`. It adds 40 reusable widgets, an editable mixed Overview and custom pages, first-release layout sharing, independent Gym/Food switches, equipment snapshots and reviewed offline workout-note imports. Its widget inventory, migration/privacy boundaries, exact commands/results and outstanding physical-device checks are in the [workspace implementation report](WORKSPACE-IMPLEMENTATION.md). The [workspace guide](WORKSPACE.md) explains how to use it. This update is local only; the public GitHub Pages site has not changed.

## Food extension — 17 October 2026, local

The food extension is isolated on `codex/food-management` and is not deployed. Its audit,
migration, implemented features, final test results, limitations and exact commands are in
the [food implementation report](FOOD-IMPLEMENTATION.md). The new unit/storage coverage
includes nutrition/conversions/scaling, atomic inventory and prepared portions, receipts,
shopping, complete/category backups and files, rollback, a real v2 database upgrade, and
a 7300-entry food archive. Browser checks include actual local OCR, manual fallback/cancel,
offline food/purchase persistence, image restoration, responsive layouts and accessibility.

The deployment records below describe earlier gym releases.

Verified locally and published on 15 October 2026. Local checks used macOS, Node.js 24 and pnpm 11. The public [source repository](https://github.com/ThrilledBaboon/form-training) and live HTTPS app at **[FORM](https://thrilledbaboon.github.io/form-training/)** are available. GitHub CI and Pages deployment succeeded, followed by checks against the actual hosted site.

Initial-release checks: **54/54 unit and IndexedDB integration tests**, **36/36 production browser checks at the root path**, and **36/36 at the repository subpath**, with TypeScript/production builds and formatting checks passing. Each initial browser run comprises twelve checks across three browser/viewport projects; the accessibility check scans sixteen screen/theme combinations per project.

## Library sharing update

Sharing is available for individual exercises, routines, programmes and the complete active library. Programme/routine dependencies are included; full history and measurements are excluded by the file schema. Notes/descriptions and target loads are opt-in. Imports preview matches and additions, retain existing definitions, remap dependencies, preserve local edits on repeated import and apply shared weekly schedules only on request. Device file sharing is offered where the browser reports support, with a downloadable-file fallback.

Local verification passed **99/99 unit/storage tests**, **66/66 production browser checks at the root path**, formatting and the TypeScript/production build. Thirteen new unit/storage checks cover private-data exclusion, opt-in notes/loads, exercise/routine/programme dependency selection, malformed files/references/metrics, duplicate matching, schedule choices, remapped groups/items, preservation of active/history/measurements/preferences/timers, repeated imports after local edits and transaction rollback on storage failure. Nine new browser checks exercise preview/cancel/import/reload/start, all four export scopes, downloaded-file contents, repeat/invalid-file handling, both accessible themes, focus restoration and 320px layouts across desktop/mobile Chromium and phone-sized WebKit.

[GitHub CI](https://github.com/ThrilledBaboon/form-training/actions/runs/38815664084) passed formatting, all **99 unit/storage tests**, the repository-subpath build and all **66 browser checks** on Linux. The [Pages deployment](https://github.com/ThrilledBaboon/form-training/actions/runs/38816098389) published application commit `52537599d7bc658167aaf417fb4647a8a166ec34` on 15 October 2026. **8/8 targeted checks passed against the live HTTPS site** in desktop Chromium and phone-sized WebKit: programme preview/cancel/import/start/reload, all export scopes and optional fields, repeated and invalid imports, themes/focus/narrow layouts and offline workout persistence. Separate HTTP/browser checks confirmed root/assets/icons/manifest/worker responses and `/form-training/` manifest/service-worker scope.

Tests use synthetic templates and isolated databases/browser profiles; no personal records are shared or cleared. Native share-sheet delivery needs a physical-device check. Apple Health integration and weight-file import remain outside this update.

## Scheduled-session suggestions update

The **Suggest session** card on Overview previews the next scheduled or weekly routine, compares its targets with the last completed session of that routine, explains weight/rep/hold decisions and starts a reviewed copy. The saved routine, planned targets and historical sets remain intact. The calculation rules and matching boundaries are documented in [calculations](CALCULATIONS.md#suggest-a-complete-session).

Local verification passed **86/86 unit/storage tests**, **57/57 production browser checks at the root path**, formatting and the TypeScript/production build. Fifteen new calculation tests cover plan/weekly selection, rest days, completion status, matching routine/tracking/duplicate exercise occurrences, weight and rep progression, effort/failure/decline holds, incomplete history, units, timestamp offsets, future completions and recalculation after corrections. Two additional storage tests verify reviewed-session creation, active-workout exclusion, preservation of original records and absence of hidden history prefills. The nine new browser checks cover the review/start/reload/resume flow, both accessible themes, Escape/focus restoration, weekly rest-day handling, first-session baselines and an empty routine library across Chromium and WebKit.

[GitHub CI](https://github.com/ThrilledBaboon/form-training/actions/runs/38809759416) passed formatting, all **86 unit/storage tests**, the repository-subpath build and all **57 browser checks** on Linux. The [Pages deployment](https://github.com/ThrilledBaboon/form-training/actions/runs/38810274123) published application commit `44f44bdb9d34d62e4f14896ce83f5e3106a99485` on 15 October 2026. After deployment, **16/16 targeted checks passed against the live HTTPS site** in isolated desktop Chromium and phone-sized WebKit profiles: six new session-suggestion checks and ten streak/reset/offline checks. Separate live checks confirmed successful root/asset/manifest/icon/worker responses and the correct `/form-training/` manifest and service-worker scope. Personal browser data was not used or cleared.

## Workout streak and reset update

Local verification for the streak/reset update passed **69/69 unit/storage tests** and **48/48 production browser checks at the root path**, plus formatting and TypeScript/production builds.

[GitHub CI for this update](https://github.com/ThrilledBaboon/form-training/actions/runs/38805197566) passed formatting, all **69 unit/storage tests**, the production repository-subpath build and all **48 browser checks** on Linux. The [Pages deployment](https://github.com/ThrilledBaboon/form-training/actions/runs/38805692280) published application commit `ca0f80549f6ce10f343d19cc90e7439cfa8d6d62` successfully on 15 October 2026.

After deployment, **10/10 targeted browser checks passed against the live HTTPS site**, using desktop Chromium and phone-sized WebKit in isolated profiles. Each browser exercised completed-workout streak counting and reload, the protected-rest calendar and history corrections, both accessible themes, midnight expiry, confirmed reset with export/restore, and cached offline logging. Separate live checks confirmed HTTP 200 responses for the root, current app scripts/CSS, icons, manifest and service worker, with the manifest start URL/scope and active worker under `/form-training/`. No personal browser data was cleared or used for these checks.

- Streaks count distinct finished-workout dates, start with 5 rest days, earn 1 per additional workout day and cap the rest bank at 7. Tests cover duplicate same-day workouts, empty/unfinished/future records, rest exhaustion, historical corrections, leap days, year boundaries and both daylight-saving transitions.
- Browser checks exercise the flame/dashboard entry points, protected-rest calendar, month navigation, selected-day history links, deletion/undo recalculation, both accessible themes, Escape/focus restoration and midnight updates without reloading.
- Reset requires the exact word `RESET`, can be cancelled, offers an independent JSON export and restores the starter library/default preferences. Storage tests verify every table is cleared, including timer/recovery data, and a failed reset rolls back all changes. Browser checks reset an isolated profile, reopen it and restore its exported backup.

The database schema remains version 2. Streaks are derived from existing history, so this update does not require a data migration or reset. Test records and screenshots are isolated from personal browser profiles and are not committed as production history.

## Implemented and tested

The connected application includes all eleven main sections: overview, active workout, history, routines/plans/programmes, exercise library, exercise progress, personal records, muscle insights/recovery, calendar, bodyweight, and settings/backups. It uses one versioned IndexedDB database. Templates contain exercises and target sets only; the production seed contains no workout or bodyweight history.

Automated calculation and storage checks cover:

- Exercise creation, renaming, archiving, stable identity and editable mappings.
- Concurrent session starts, immediate set edits, database reopening, idempotent completion, invalid measurements, duplicate sets, session completion and historical edits.
- Routine snapshots, grouped exercises and sets, between-exercise/round/drop-set rest rules, explicit zero targets and canonical unit handling.
- Atomic exercise substitution with completed-history protection; session deletion/undo including timer and plan status; active-workout restore conflicts.
- Conservative progression and explicit acceptance of suggestions for pending working sets only, with completed and warm-up sets preserved.
- Epley/Brzycki estimates, partial reps, volume exclusions, comparable tracking types, PR recalculation and tied record ownership.
- Bodyweight readings/averages, muscle mapping and relative scores, recovery decay, date windows, calendar and intensity scales.
- JSON round trips, validation, malformed files and broken relationships, repeated imports, merge conflict rollback, CSV escaping and the v1-to-v2 additive database migration.
- A 30,000-set / 1,500-session fixture for muscle aggregation. This is a regression check, not a benchmark of a physical phone or a promise about arbitrary dataset sizes.

Production browser checks run in desktop Chromium, phone-sized Chromium and phone-sized WebKit. They exercise honest empty states, creating and scheduling a grouped routine, set logging, timers, reload recovery, finishing, linked analytics/calendar/records, substitution, suggested targets, bodyweight/goal/dashboard charts, JSON replacement and repeated merge, and duration/distance/assistance inputs. A separate temporary persistent browser profile is closed and reopened to verify active-workout recovery beyond a simple page refresh.

The suite also tests offline navigation and set completion after service-worker caching, makes no external network requests during private logging, visits every main route at narrow widths, and checks the unknown route. Automated axe WCAG A/AA checks cover eight core screens in both light and dark themes. These checks are useful coverage, not a complete accessibility certification.

The same browser suite runs against `/` and a `/form-test/` production base to exercise repository-relative assets, hash routing, service-worker scope and offline reload. For the initial release, [GitHub CI](https://github.com/ThrilledBaboon/form-training/actions/runs/38800587905) passed formatting, all **54 unit/storage tests**, the production subpath build and all **36 browser checks** on Linux. The manually triggered [Pages deployment](https://github.com/ThrilledBaboon/form-training/actions/runs/38800980991) also succeeded.

After the initial deployment, **14/14 targeted browser checks passed against the public HTTPS URL**, using desktop Chromium and phone-sized WebKit in isolated profiles. These cover empty states, browser close/reopen recovery, logging/timer/finish/analytics, JSON replacement and repeated merge, offline reload/logging, all routes and dark/narrow layouts, and absence of external requests during logging. Separate HTTP/browser checks confirmed successful responses for the root, app script/CSS, manifest, icons and service worker; manifest start URL/scope and the active worker resolve under `/form-training/`. No personal browser data was used or transferred by these checks.

For exact commands, see the [README](../README.md) and [deployment guide](DEPLOYMENT.md). Playwright produces its ignored HTML report and failure traces locally. Screenshots are test fixtures, not personal records.

## Implemented but not fully tested

- Installable PWA manifest, offline caching and update prompts are implemented. Physical iPhone/Android home-screen installation, real mobile virtual keyboards, storage eviction and long-term installed-PWA updates need testing on those devices. WebKit automation is not a physical Safari test.
- Optional foreground sound/vibration and screen wake lock depend on browser support, user interaction, permissions and power state. They are implemented, but physical-device behaviour is unverified. The timer deadline survives reload/background suspension; native background notifications are not promised.
- Keyboard navigation, modal focus, visible labels/focus, textual chart summaries, selectable muscle regions and the list alternative are implemented. Automated checks and browser interaction do not replace a full manual screen-reader review.
- Programme organisation, custom mapping edits, all fine-grained planner/settings combinations, durable-storage requests and local recovery-snapshot downloads are implemented. Automated coverage is strongest for the main logging/planning/import paths, rather than every possible combination of controls.
- Quota/storage failures are surfaced and failed writes do not claim success. Real disk-full, browser-crash and OS shutdown scenarios were not induced. Close/reopen checks occur after acknowledged writes.

## Not implemented

- Accounts, cloud sync, a backend, multi-device live data sharing, native notifications, lock-screen controls, wearables and background audio. These are outside this local-first build.
- Optional lateral anatomical views, per-exercise illustration assets, arbitrary custom metric definitions, incline/speed fields, goal-date predictions and custom exercise colours.
- Per-programme automated progression rules; conservative recommendation rules are configurable globally and targets remain editable per routine/set.
- Virtualised or paginated archive storage and worker-based analytics. The app loads its dataset into memory; substantially larger histories need further profiling and possibly a storage/query redesign.
- Real-world measurement of physiological muscle activation, recovery or growth. The app deliberately provides transparent contribution and recent-training estimates instead.

## Deployment status

The app is published through GitHub Pages with HTTPS enforced. Source code is public; workout history remains in each browser's IndexedDB and is not committed or uploaded by the app. No deployment blocker remains. Updates require a push followed by a manual **Deploy FORM to Pages** run, as described in the deployment guide. Physical-device checks listed above remain outstanding.

## Data durability

IndexedDB and local recovery snapshots share the same browser origin. Browser data can be removed or lost. Export JSON to an independent file regularly, especially before moving from this local address to a hosted site or another browser/device. A source-code push does not transfer personal workout history. See the [backup guide](BACKUPS.md).
