# Implementation and verification record

Verified locally on 15 October 2026, on macOS with Node.js 24 and pnpm 11. The production build is available locally. GitHub publication is now authorized and sign-in is complete. The initial push, hosted CI and first deployment are being prepared. No published URL has been verified yet.

Recorded checks: **54/54 unit and IndexedDB integration tests**, **36/36 production browser checks at the root path**, and **36/36 at the repository subpath**, with TypeScript/production builds and formatting checks passing. Each browser run comprises twelve checks across three browser/viewport projects; the accessibility check scans sixteen screen/theme combinations per project.

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

The same browser suite runs against `/` and a `/form-test/` production base to exercise repository-relative assets, hash routing, service-worker scope and offline reload. GitHub Actions configuration is provided for later CI and a manually triggered Pages deployment; neither workflow has been executed on GitHub.

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

## Blocked and deployment status

No missing permission or tool blocks local use. The initial local-first build is complete, and publication has been requested. GitHub sign-in is complete. The initial push, CI and Pages deployment are pending. Follow the exact Pages settings and hosted smoke checks in the deployment guide. Record the actual URL and hosted results after deployment; a local build does not establish that the public site works.

## Data durability

IndexedDB and local recovery snapshots share the same browser origin. Browser data can be removed or lost. Export JSON to an independent file regularly, especially before moving from this local address to a hosted site or another browser/device. A source-code push does not transfer personal workout history. See the [backup guide](BACKUPS.md).
