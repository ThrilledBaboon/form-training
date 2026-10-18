# Custom workspace implementation

Starting point: `6e4e9a0` on `codex/food-management`, preserving the untracked requested prompt. Work proceeds on `codex/custom-workspace`, locally only.

Baseline: 129 unit/storage tests and all 93 production browser checks passed; TypeScript and production build passed. There were no pre-existing test failures.

Plan: additive workspace persistence and backup compatibility; reusable widget registry and mixed Overview; page editor and layout-file sharing; complete system visibility controls; equipment snapshots and reviewed pasted workouts; regression, migration, privacy, accessibility, offline/subpath and browser checks.

The workspace uses a bounded singleton record for page definitions, module preferences, equipment profiles and import provenance. Workout/Food records stay authoritative in their existing stores. Page revisions detect stale editors. A database upgrade adds storage without rewriting Gym/Food records.

## Widget inventory

| Existing view                 | Reusable widgets                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Overview                      | start/resume, suggestions, weekly consistency, streak, totals, routines, recent sessions, records, progression highlights    |
| Exercise progress             | exercise graph with metric/tracking/rep/load/warm-up/setup filters and previous-session comparison                           |
| Bodyweight                    | raw/trailing-average graph, latest/weekly/monthly/goal summaries                                                             |
| Muscle insights               | map, selected-region trend, totals/source details and equal-window comparison; contribution/relative score/recent-load modes |
| Calendar                      | monthly completed/planned/rest activity and day links                                                                        |
| Food diary                    | daily macro/target summary, weekly macro chart, training/food context                                                        |
| Meal planner/Kitchen/Shopping | planned meals, expiry, prepared portions, stock and shopping summaries                                                       |
| Food spending                 | actual spending/budgets, spending breakdown/trend, stock value, consumption/waste and ingredient prices                      |
| Shared                        | private notes, safe quick links/actions, bodyweight                                                                          |

Detailed domain pages remain available. No domain data is stored in layout definitions or shared layout files.

## Delivered locally — 18 October 2026

The implementation is on `codex/custom-workspace`, based on the existing Food branch. Nothing was pushed, merged, published or deployed. The established preview origin is **http://127.0.0.1:4174/**; its browser records were not used for testing or cleared. Open Overview and choose **Edit page**, or **My pages**, to begin. See the [workspace guide](WORKSPACE.md) for everyday use, supported import syntax and limits.

Implemented and tested:

- A registry of 40 reusable widgets, an editable combined Overview, independent saved pages/home selection, per-page and per-widget ranges, compact/half/full widths, configuration, duplicate, reorder, removal/undo and recoverable deleted/replaced layouts. Existing detailed views retain their workflows and provide applicable **Add to page** actions. Repeated charts have unique SVG identifiers; shared selectors cache expensive exercise, muscle and bodyweight calculations.
- First-release layout sharing with an exact file preview, optional note-widget text, portable exercise/ingredient mapping, fresh identities, duplicate detection, explicit replacement recovery, unknown-widget placeholders and atomic writes. The export serializer explicitly selects presentation fields. It excludes histories, measurements, equipment profiles, images, source text and drafts; titles/reference names/filter bounds remain visible in the preview. Layout import never changes system switches or home selection.
- Independent Gym and Food switches, including both off, across desktop/mobile navigation, direct links, actions, widgets and contextual panels. Records, hidden-widget order, active workouts and drafts are preserved. Shared bodyweight/settings/backups remain available. Hidden Gym timers cannot alert; re-enabling preserves the deadline and suppresses a late completion sound.
- Equipment profiles with defaults, duplication/archive, reminders, load convention and unit-aware increments. Future items receive a snapshot; completed sets retain theirs through profile edits and mid-session changes. Prefills, progression, personal records and load-based charts respect setup identity and recorded-load convention. Existing unspecified context stays unspecified; recorded values are never silently doubled.
- An offline pasted-workout parser with a durable, editable review. It supports multiple sessions, day-first dates, aliases, common prescriptions/numbered markers, kg/lb, rest durations, per-set overrides, partial reps and scoped notes. Users explicitly select history/routines/both, resolve exercise matches and accept the review. Missing values stay unknown; date-only history records no duration, and routines stay unscheduled. Saves are atomic, retain unresolved drafts, detect repeated imports, preserve active workouts/timers and offer batch undo that refuses to erase later edits.
- Complete/category backup support, older backup compatibility, reset coverage and an additive real-database migration. Existing Gym/Food calculation, library sharing, logging, cooking, stock, purchase and OCR tests remain passing.

## Persistence and data protection

IndexedDB version **4** adds the `workspaces` store. Its bounded singleton contains page definitions, system/home preferences, setup profiles, import draft/provenance and removed-layout recovery. Version 3 Gym/Food records are not rewritten. Defaults are added once, including one mixed Overview and both systems enabled. Workout schemas gain optional setup snapshots, partial-rep, unknown-rest, import and date-only fields. Prior records remain valid.

Complete/category backups use schema **4**. Supported schema 2/3 backups are validated and upgraded in memory; merge preserves existing local workspace content when an older backup has none. Full replacement includes the workspace and recovery snapshots. Preference restoration explicitly controls systems/home/draft during a merge. Gym library files remain schema **1**; page layouts use their own strict `type: page-layout`, `formatVersion: 1`. Sharing a routine strips private equipment context.

Page writes use validated read-modify-write transactions and page revisions to reject stale editors, including a page deleted elsewhere. Layout mapping is checked again inside the transaction. Import fingerprints and provenance prevent repeated save actions from silently duplicating accepted workouts. Save/restore failures do not report success, and failed imports retain the reviewed draft. All new tests use synthetic data and isolated databases/browser profiles.

## Verification

Commands use Node.js 24 and pnpm 11.25 on macOS:

| Command                                  | Result                                                        |
| ---------------------------------------- | ------------------------------------------------------------- |
| `pnpm test`                              | 147/147 unit and IndexedDB integration tests passed           |
| `pnpm build`                             | TypeScript and root production/PWA build passed               |
| `pnpm test:e2e`                          | 114/114 root production browser checks passed                 |
| `BASE_PATH=/form-test/ pnpm build`       | TypeScript and repository-subpath production/PWA build passed |
| `TEST_SUBPATH=/form-test/ pnpm test:e2e` | 114/114 repository-subpath production browser checks passed   |
| `pnpm format:check`                      | Passed                                                        |

The browser suite uses desktop Chromium, phone-sized Chromium and phone-sized WebKit. New flows cover page editing/home fallback, all four system combinations, layout preview/import/privacy, persistent pasted-note review/history/routines, equipment profiles, transferred filters, 320px layouts/keyboard controls/accessibility, repeated populated charts, history corrections and offline page editing/reload. Existing offline logging, persistent browser reopening, OCR/manual fallback, Food snapshots, complete/category imports, themes and accessibility checks also run.

After the subpath suite, `pnpm build` restored the root artifact for port 4174. A final `pnpm exec playwright test e2e/workspace.spec.ts` passed **21/21** checks against that artifact. HTTP checks confirmed the established preview serves that exact root HTML, with successful asset/icon/manifest/worker responses and manifest start URL/scope resolving to its origin root. No user browser records were accessed by these checks.

New storage tests cover a real v3 database upgrade with existing data, page conflicts/recovery, all-system preservation, mapping/unsupported widgets, private-data exclusion, malformed/oversized/future layout files, import rollback, schema 2/3 compatibility, category dependencies, immutable setup history, load-context comparisons, parser uncertainty, selected-batch retries/undo, date-only duration and suppressed expired timers. Browser screenshots were inspected for populated desktop and narrow layouts; they contain synthetic records only.

## Implemented but not verified on physical devices

Physical iPhone Safari/home-screen installation, native file-picker/share delivery, virtual keyboards, touch dragging, storage eviction and long-term PWA updates remain unverified. WebKit automation is browser emulation, not a physical iPhone test. Accessible arrow controls provide a touch/keyboard alternative to the desktop drag handle. Automated axe checks do not replace a full manual screen-reader audit. Real disk-full, abrupt OS shutdown and arbitrary archive sizes were not induced.

## Known limitations and scope

The deterministic parser documents supported common formats; arbitrary prose, ambiguous dates and exercise matches require review. It is not a general AI interpreter. Duplicate detection compares normalised reviewed imports, not every possible rewording of the same workout. Undo intentionally retains exercise definitions created during an import, and protects later edits/uses of imported routines.

Practical limits include 50 pages, 40 widgets per page, 20 recoverable removed layouts, 2,000 setup profiles, a 500 KB layout file, 100,000 source characters per parse and the existing 100 MB backup restore limit. Analytics use the existing in-memory local dataset with selector caching; this is not a physical-phone performance benchmark. Muscle scores and consumption forecasts keep their documented estimate semantics.

No requested feature has been deferred to a future implementation. Accounts/cloud sync, a community marketplace, Apple Health, automatic weight import, paid AI parsing and external retailer/nutrition APIs remain outside the authorised scope. Publication requires a separate instruction. Personal data stays in its browser origin; source control does not move records between the local preview and the hosted app.

The later onboarding request adds optional private profile setup, reviewed training-plan generation and food-goal estimates. It explicitly supersedes the original prompt's macro-only restriction: food energy is derived in the background and displayed only after an explicit opt-in. Workout calories remain retired. See [onboarding and methods](ONBOARDING.md).
