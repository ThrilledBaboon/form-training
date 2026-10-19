# FORM · Personal Training

An original mobile-first, local-first training, climbing and food tracker built with React, TypeScript, Vite, Dexie/IndexedDB and Recharts. No account, backend, telemetry or paid API. Exercise and routine templates are included; **no workout history, nutrition or bodyweight measurements are fabricated**. Core features work offline after the app is cached. Optional English receipt OCR loads bundled files on demand and processes images on the device.

[Open FORM](https://thrilledbaboon.github.io/form-training/) · [Source repository](https://github.com/ThrilledBaboon/form-training)

## Run locally

On this Mac, double-click **Start FORM.command**, or run:

```sh
./scripts/start-local.sh
```

The launcher uses an installed Node or the Codex-bundled Node available on this Mac and opens **http://127.0.0.1:4173/**. It serves the production build, including offline support. Keep the terminal running; stop with Control-C. An already installed and cached app can continue offline, but initial loading needs the local server.

For a fresh development machine, install Node.js 24 and pnpm 11, then:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Development: **http://127.0.0.1:5173/**. Production:

```sh
pnpm build
pnpm preview --port 4173
```

If this network cannot connect to registry.npmjs.org, use `pnpm install --registry=https://registry.yarnpkg.com`. The committed lockfile contains package integrity hashes and does not depend on the temporary local transport used during the initial build.

**Use the same browser, host and port consistently.** `127.0.0.1`, `localhost`, development, production and the hosted domain are different browser origins with separate data. Before moving to another origin/device/browser, export JSON and import it there. Source-code pushes do not transfer workouts.

## What you can use

- Editable mixed Overview, reusable widgets, multiple custom pages/home choice, independent filters and responsive arrangement with keyboard/tap controls. Share private-data-free layouts with reference mapping and import previews.
- Independent Gym/Climbing/Food system switches, saved equipment setups with historical snapshots, and an offline pasted-workout review/import tool. See the [workspace guide](docs/WORKSPACE.md).

- [Climbing](docs/CLIMBING.md): indoor/outdoor bouldering, top rope, auto belay and lead; a personal climb/photo library, project beta, mixed session logs, saved drafts and separate grade-aware widgets.
- [Combined week planner](docs/WEEK-PLANNER.md), [meal suggestions](docs/MEAL-SUGGESTIONS.md), [workout session reminders](docs/SESSION-CONTINUITY.md) and an optional [weekly review](docs/WEEKLY-REVIEW.md).

- Dashboard with real training totals, weekly consistency, latest sessions, records, exercise progression highlights, bodyweight trends and muscle contributions.
- Workout-day streak with an earned rest-day bank, longest streak and a selectable monthly calendar. Open it from the flame in the top bar or the overview card.
- **Suggest session** on Overview reviews the next scheduled/weekly routine against its last completed session, shows proposed weight or rep increases and starts an editable copy after review. Saved routines and history remain intact.
- Blank workouts and routine-based workouts; persistent active session and immediately saved set edits; refresh recovery; idempotent set completion; previous-session copying; adding, reordering and substituting exercises; set duplication/deletion/undo; editable historical workouts; session and set notes and optional effort.
- Weighted, bodyweight, externally loaded bodyweight, assisted, timed and distance exercises; partial reps; warm-ups, working/failure/PR/custom set labels; optional RPE or RIR; canonical kg/metres/seconds.
- Global deadline-based timer with pause/resume, reset, skip and ±15 seconds; optional foreground sound/vibration and supported screen wake lock.
- Editable, duplicable, reorderable routines and programmes; targets per set; weekly schedules; dated plans with independent snapshots; groups for supersets, trisets, circuits, dropsets and custom arrangements; group rest rules.
- Searchable exercise library with custom exercises, aliases, equipment/category/movement, primary and secondary muscles, editable contribution multipliers, notes, tags and archiving.
- Share individual exercises, routines, whole programmes or your library as FORM library files. Preview imports, reuse matching exercises, keep existing records and opt into shared weekly schedules. Notes and target weights are excluded from exports unless selected; personal workout history, measurements and settings are always excluded.
- Exercise histories, real-data charts, rep/load/date filters, comparable tracking types, volume, effort context, conservative explainable recommendations, Epley/Brzycki estimated maxes, percentage tables and derived PRs.
- Multiple daily bodyweight entries, editing/undo, raw readings, trailing averages, weekly/monthly summaries and an optional goal.
- Original selectable front/back anatomical SVG, transparent muscle set contributions and relative volume scores, daily trends and equal-period comparisons, drill-down to source sets, configurable scales, separate recent-training/recovery estimate and accessible list alternative.
- Monthly calendar, day drill-down, planned/completed/rest states, adjustable intensity metric/threshold and consistency view.
- Ingredients with macro provenance, density/count conversions and distinct raw/cooked states; a searchable recipe menu, photos, steps, scaling, substitutions, favourites and ratings.
- Food diary, historical macro snapshots, independent optional macro targets, weekly summaries and shared training/bodyweight context. Nutrition uses protein, carbohydrates, fat and optional fibre only.
- Kitchen stock, storage locations, expiry, confidence, waste and movement history; explicit cooking deducts ingredients and creates prepared portions, which can then be eaten or discarded.
- Daily/weekly meal planning alongside training, stock-aware shopping with package rounding and preserved manual rows; reviewed receipt images, optional local OCR/manual fallback, purchases, recorded prices, budgets and estimated costs.
- **Export everything** includes gym, climbing and food records, pages, system choices, equipment setups, preferences, drafts and supported images. Category JSON files include dependencies and import previews; food and gym CSV reports support analysis.
- Validated JSON import preview/merge/replace; duplicate handling; atomic local recovery snapshots; complete JSON backups; separate CSV exports; light/dark/system themes; reduced motion; offline PWA shell and update prompts.
- Full data reset in **Settings & data → Start fresh**, with a backup export and typed `RESET` confirmation. Restores starter exercises/routines and removes personal records, custom content, preferences and recovery snapshots from this browser.

## First session

1. Choose **Start a workout**, or a starter routine in **Routines & plans**.
2. Add exercises. Enter load and reps (or duration/distance), then tap the check to complete a set.
3. Completed sets save to IndexedDB before the UI shows completion. The rest timer starts automatically. Review the previous-performance panel and notes as needed.
4. Finish the workout. Inspect its history, progress, records, muscle map and calendar.
5. Visit **Settings & data → Export everything** and keep that file somewhere independent of this browser.

For historical entries, use **History → Paste workout notes**, review the parsed sets and save date-only history or actual known times. You can also log a session, finish it and correct its dates/times in **Details**. Incomplete sets remain visible but do not count towards completed training analytics.

## Share and receive library content

Open **Exercise library** or **Routines & plans** for **Share library** and **Import to library**. Individual exercise/routine cards have a share icon; programmes have one inside **Programmes**. Review the content, optionally include library notes/descriptions or target weights, and choose **Download library file**. A **Share file** button also appears when the browser supports sharing files through the device's share sheet.

Send the downloaded file to another FORM user. They choose **Import to library**, select the file, review the additions and matches, then **Add to library**. Routine and programme exports include the exercises and muscle mappings they need. A single routine is shared independently of its programme; a programme includes all its routines. Shared schedules apply to newly added routines only when the recipient opts in.

Library imports add content without replacing existing data. Repeated files keep existing imports, including subsequent local edits. Matching exercise definitions are reused by normalised name/equipment and compatible tracking, unilateral and bodyweight settings; their existing mappings and notes are retained. Routines with identical content in the same programme are reused; different targets produce a separate routine. FORM library files are distinct from full backups. Other apps' exports need conversion; Apple Health integration and weight-file import are not implemented.

## Verification

```sh
pnpm test
pnpm build
pnpm exec playwright install chromium webkit
pnpm test:e2e
```

Tests cover calculations, transactions, migrations, recovery, duplicate logging/imports and important production browser flows. Browser projects run Chromium at desktop and iPhone-sized viewports and WebKit in an iPhone-sized viewport. Emulation does **not** establish physical iPhone/Safari or installed-PWA behaviour.

Verify a repository subpath:

```sh
BASE_PATH=/form-test/ pnpm build
TEST_SUBPATH=/form-test/ pnpm test:e2e
pnpm build  # restore a root production build afterwards
```

Formatting: `pnpm format`, `pnpm format:check`. See [verification notes](docs/VERIFICATION.md) for recorded results and limits.

## Documentation

- [Custom pages, layout sharing, systems, equipment and pasted workouts](docs/WORKSPACE.md)
- [Workspace implementation and verification](docs/WORKSPACE-IMPLEMENTATION.md)

- [Food guide and practical limits](docs/FOOD.md)
- [Food implementation and verification report](docs/FOOD-IMPLEMENTATION.md)
- [Data schema and invariants](docs/SCHEMA.md)
- [Calculation methods](docs/CALCULATIONS.md)
- [Backup and restore](docs/BACKUPS.md)
- [GitHub Pages deployment](docs/DEPLOYMENT.md)
- [Asset provenance and licences](docs/ASSETS.md)
- [Implemented features, verification and known limits](docs/VERIFICATION.md)
- [Implementation plan](docs/PLAN.md)

## Hosting and data

FORM can run locally or as a static GitHub Pages site. The included Pages workflow is **manual only**; a source push runs verification, and **Deploy FORM to Pages** publishes the selected branch. See the deployment guide for configuration and published-site checks. Hosting serves the app; workout history stays in each browser and moves between origins/devices through JSON export/import.

The application is independent of Setgraph and does not include its branding, artwork, source code or screenshots.
