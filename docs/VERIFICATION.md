# Implementation and verification record

Entries describe the commit and date reviewed; local-only statements in earlier entries are historical. The final entry records verification after removing development sample tools for integration into `main`.

## Balanced session suggestions — 21 October 2026, local

The `codex/session-suggestions` branch adds balanced full-body generation, saved suggestion preferences, individual replacements and locks, and a separate Cindy benchmark flow. Existing routine progression remains available. Full-body sessions keep compound push, pull and legs; recent recorded coverage and selected priorities guide accessories. See the [suggested-session guide](SUGGESTED-SESSIONS.md).

- All **257 unit/storage tests** pass. The 26 new checks cover protected movement roles, coverage windows, priorities, equipment and exclusions, schedule/climbing context, progression/readiness, immutable replacements, locks, routine preservation, benchmark validation, atomic score edits, rollback, sharing privacy and backward-compatible settings/backups. A final focused rerun passed all **74 relevant tests** after the last score-validation change.
- Across the complete **237-check production browser suite** and focused reruns, **236 checks pass**, with the existing WebKit touch-drag scenario skipped. The initial run's three failures were the same library export assertion using a hard-coded exercise count; adding Air squat increased the starter catalogue by one. That assertion now derives its expectation from the catalogue. The final **39-check focused run** passes in desktop Chromium, phone-sized Chromium and phone-sized WebKit, covering library export/import, suggestions, narrow widgets, accessibility, saved defaults, isolated replacements, offline Cindy timer/score persistence, history corrections and separate modified-format comparisons.
- TypeScript, production PWA build, formatting and diff whitespace checks pass. The 375 px suggestion preview was visually inspected; widget regressions also cover 320 px. Physical iPhone use remains unverified.
- The existing local preview at **http://127.0.0.1:4174/** was updated through **Update & reload**, then the new full-body preview was opened in the user's app without starting a workout or saving preference changes. The update uses additive optional record fields; it does not clear personal data or change the IndexedDB version. Automated tests use isolated synthetic records.
- This is a separate local feature commit. No push, merge into `main` or deployment was performed.

## Personal customisation — 20 October 2026, local

Settings now includes **Make FORM yours** for spacing, text, contrast, navigation names/order/visibility, phone shortcuts, chart defaults, macro display, logging defaults and personal climbing circuits/tags. Pages support sections or filtering tabs, density overrides, independent phone order/widths, configurable widget presentation, saved copies, quick actions and manual milestones. Layout format 2 carries those choices with an optional appearance preset; format 1 remains accepted. See the [customisation guide](CUSTOMISATION.md).

- All **200 unit/storage tests** pass. Seven new tests cover separate browser preferences, old backups, stale saves, transactional failure, independent phone ordering, duplicate identities, section/phone reference validation, layout privacy, appearance opt-in and rollback, historical climbing tags and recorded-point weekly averaging.
- Across the complete **183-scenario production browser suite** and focused reruns after corrections, **182 checks pass**, with the existing WebKit touch-drag scenario skipped. The six new scenarios pass in desktop Chromium, phone-sized Chromium and phone-sized WebKit. They cover real settings forms, accessible 320 px macro summaries, navigation safety, logging defaults, page sections/tabs/removal, phone ordering/widths, chart patterns and targets, layout export/import, private-progress exclusion, reload and offline charts. Eight WebKit regression scenarios that timed out in the initial long run pass on a focused single-worker rerun.
- Formatting, diff whitespace checks and the TypeScript/production PWA build pass. Settings and climbing modules are loaded on demand and precached. Weekly averages and target lines affect display only; no recorded history is recalculated or replaced.
- The existing local preview at **http://127.0.0.1:4174/** was updated through its PWA update control and the new Settings panel was inspected in the user's browser. Their saved data and preference values were preserved. Browser automation uses synthetic data in isolated contexts; physical installed-PWA and full screen-reader checks remain outstanding.
- This update is a separate local feature commit. No GitHub push or deployment was performed. Rocket League and football systems remain design ideas and are not part of this implementation.

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

## Local systems update — 19 October 2026

Climbing, combined week planning, saved-recipe meal suggestions, prior-session reminders and the optional weekly review are implemented locally in separate feature commits. No GitHub push or hosted deployment was performed.

- Formatting check and TypeScript/production PWA build pass. Climbing editor code is loaded on demand and included in the offline precache.
- All **184 unit/storage tests** pass, including a real v4 database upgrade, old backup migration, snapshot preservation, stale/concurrent edits, attachment round trips, merge/replace rollback, all eight system combinations and unknown macro/time/cost handling.
- The complete **177-scenario browser suite** covers desktop Chromium, mobile Chromium and iPhone-sized WebKit. **176 checks pass** after updating and rerunning the three export-format assertions for schema 5; one existing WebKit-only touch-drag check is skipped. Existing logging, streaks, reset, OCR, library sharing, themes, layouts and offline flows remain covered.
- An isolated populated preview at **320 px** passes accessibility checks with no horizontal overflow on Climbing home/library/projects/sessions, the combined planner, meal suggestions and weekly review. Offline reload/navigation to Climbing overview and the deferred library/editor module succeeds. This verification used synthetic records in a separate browser context and did not change the user's database.
- The local preview at **http://127.0.0.1:4174/** is running and its served index matches the current production build. Existing browser data stays on that origin; refresh and use Update & reload if an older worker prompts. Garmin, Griptonite and Apple Health connections remain outside this implementation.

## Climbing wall map and weekly setup — 19 October 2026

Climbing overview now offers optional weekly-goal setup, a current-week progress widget and an interactive wall-style map. Both widgets can be added to custom pages and shared through layout exports. Untouched older climbing home templates are upgraded; customised layouts are preserved.

- All **193 unit/storage tests** pass. Added coverage includes historical snapshot aggregation, missing styles, Monday–Sunday goal counts, future/draft exclusions, validation and conflicting edits, goal/tag backup round trips and default-layout compatibility.
- **15/15 targeted production browser checks** pass across desktop Chromium, mobile Chromium and phone-sized WebKit. These cover goal saving/reloading/cancelling, wall tags, source-session links, populated maps, keyboard selection, system toggles, shared chart pages and offline navigation.
- An additional isolated preview passes axe checks at **1440 px and 320 px**, with no horizontal overflow or page errors. The map and saved goal setup reopen offline after caching.
- Formatting and the TypeScript/production PWA build pass. The deferred climbing widget module is precached for offline use. The existing schema-5 backup format remains compatible with records that have no goal or wall style.
- The local browser shows the populated map and setup button. Its weekly climbing target remains unset for the user to choose. This feature is saved in a separate local commit; no GitHub push or deployment was performed.

## Compact page options — 19 October 2026

Overview, system home pages and custom pages now group the current-page selector, page date range, layout sharing/import and edit hint in a native disclosure labelled **Page options**, closed by default. Page editing remains directly available in the header.

- Formatting and the TypeScript/production PWA build pass.
- **9/9 targeted browser checks** pass across desktop Chromium, mobile Chromium and phone-sized WebKit, covering independent system home layouts, sharing/import validation and narrow-screen widget editing with accessibility checks.
- The populated local Overview shows a closed panel approximately **46 px** high without horizontal overflow. Expanding reveals all four controls; Return collapses it through the native keyboard interaction. Saved layouts, date ranges and records are unchanged.
- This change is saved in a separate local commit and is not deployed to GitHub Pages.

## Rocket League, football and whole-branch review — 20 October 2026

- Separate local commits `74ad873` and `f53549b` implement the practice systems. Both default off and preserve existing records, enabled systems and layouts. Full backup schema 6 accepts schemas 2–5; data stores upgrade additively to version 6.
- **210 unit/storage tests pass** across 21 files, including version-5 upgrade preservation, session snapshots, timers, stale edits, invalid results, sharing/import idempotency, category isolation and merge rollback. TypeScript and production build pass.
- The full production browser run has **188 passes and 1 existing WebKit touch-drag skip** across 189 scenarios on desktop Chromium, phone Chromium and phone WebKit. No browser tests failed.
- After strengthening the new Rocket League flow with explicit offline reload and offline recording/finishing, its **three additional browser runs pass**, one per project. Football uses the same runner/storage and is independently tested for course/foot persistence, keepy-ups, target hits/misses/Undo and routine sharing.
- Automated accessibility checks and narrow-screen overflow assertions pass for the new forms and pages. Formatting and `git diff --check` pass. The local 4174 browser received the update through the normal PWA prompt; the new switches are visible and off, while the existing three enabled systems and preferences remain.
- [Whole-branch review](LOCAL-VS-MAIN-REVIEW.md) compares `ed5fe0f` and `f53549b` using identical fictional gym history in isolated contexts, plus local mixed-system examples. Screenshots and metrics use no personal browser data. The report prioritizes scoped navigation, an explicit edit mode, lean default pages and a shorter Settings index. Existing custom pages were not rearranged.
- All changes remain local. No push, deployment, HealthKit or game account connection was performed.

## Sample removal and main integration — 20 October 2026

The user approved integration of the systems expansion into `main` with development samples removed. Commit `adcc240` removes the local sample loader, startup query handler, Settings controls, six-month generator, export script and their feature-only tests. Meal suggestions now use a small test-only food fixture imported through the normal reviewed backup flow. Historical Settings images containing the removed tools are no longer included.

- **210 unit/storage tests pass across 21 files.** The ten tests for the deleted sample feature were removed with that feature.
- TypeScript, the root production/PWA build and a separate `/form-test/` production/PWA build pass. Production JavaScript contains no sample loader or fictional personal-history generator.
- The **complete repository-subpath browser suite passes 200 checks**, with one existing WebKit-only injected-touch skip, across desktop Chromium, mobile Chromium and phone-sized WebKit. The new retired-link regression verifies empty workout, weight, climbing, practice and food histories, no invented profile name and no sample controls.
- **Nine additional root-path browser checks pass** for clean startup and meal suggestions across the same three browser projects. Formatting and Git whitespace checks pass.
- The local preview's sample history was removed using the existing dependency-aware remover before deleting that tool. The remover saved a recovery snapshot and preserved the user's own records and changed preferences. The updated preview visibly shows an empty workout history. No local database, recovery snapshot or personal export is included in Git.

Earlier release-review findings remain recommendations; this integration does not claim to resolve them. The existing manual Pages workflow remains separate: pushing `main` triggers verification and does not update the hosted app. Physical iPhone/PWA checks remain distinct from browser emulation.
