# Food extension implementation record

## Audit and protection

Starting point: `ed5fe0f`, clean `main`; work is isolated on `codex/food-management`.
React 19 / TypeScript / Vite, hash routing, Dexie IndexedDB version 2, Zod validation,
shared native-dialog controls, CSS themes, and a GitHub Pages manual deployment workflow.
The existing training module includes sessions, sets, timers, exercise definitions and muscle
mappings, routines/programmes/plans, history, progression, streaks, bodyweight and analytics.
No personal history is seeded. Baseline: 99/99 unit/storage tests, production build and all
66/66 existing desktop/phone browser checks passed before editing.

## Implementation sequence

1. Introduce versioned food schemas, pure unit/macro/cost calculations, additive database
   stores and complete backups before any new writes. Existing gym tables stay in place.
2. Add Ingredients, Menu and food diary with provenance, recipe scaling and saved drafts.
3. Add inventory movements, explicit cooking/leftovers, meal planning and stock-aware shopping.
4. Add reviewed purchases, local receipt attachments, optional OCR, prices, budgets and waste.
5. Integrate summaries into Overview and a combined meal/workout planner; add complete and
   category backup previews, transactional restore, migration and regression coverage.

## Architecture and safeguards

- Food records reference stable ingredient/recipe IDs. Diary/prepared-batch records hold
  historical macro and ingredient snapshots. Archiving never deletes historical records.
- New IndexedDB stores are additive. Quantity-changing commands re-read stock in a single
  transaction. Use earliest dated usable stock first, then purchase date and ID; insufficient
  stock prevents cooking, rather than producing negative balances.
- Grams, kilograms, millilitres, litres and count are distinct. Cross-dimension conversions
  need ingredient density/count mass. Raw/cooked mismatches remain unknown. Missing macros
  and prices are reported as incomplete, not manufactured zero values.
- Complete JSON backups include a manifest, all persistent food stores and embedded image
  data. Category files include relationship dependencies; import adds new IDs, keeps existing
  values and validates the resulting graph. Full replace requires confirmation and recovery.
- Retire the old optional session calorie input and CSV column. Legacy values remain in
  existing browser storage for migration compatibility, but are deliberately excluded from
  all new exported backups and reports. Food schemas contain only the supported macros.
- No backend, credentials, live retailer prices, health integration or cloud sync. Receipt
  entry/review always works manually. Any OCR asset download must be explicit, free of secret
  keys, and disclose connectivity needs; images must be processed locally.
- Hash routing and base-relative assets retain Pages compatibility. No production deployment
  is performed while developing this branch; verify both root and repository subpaths locally.

## Verification strategy

Extend Vitest with real v2-to-v3 migration, macro/conversion/substitution, shopping rounding,
stock/batch/receipt transactions, backup round trips and rollback tests. Extend Playwright
for desktop Chromium, phone Chromium and phone WebKit: food CRUD, diary, cooking, shopping,
purchase review, files, backup, reload/offline, accessibility, themes and narrow layouts.
Run existing gym regressions and a production subpath build. Record actual results and
remaining limits here when complete.

## Implemented

The food system is functional UI backed by IndexedDB, rather than mocked data:

- Ingredients: creation/edit/duplicate/archive/search, macro provenance and per-100 basis,
  raw/cooked/as-sold states, package/density/count metadata, brand/barcode/aliases/storage.
- Menu/editor: images and step photos, ordered ingredient lines/instructions, quantities,
  servings/scaling, time/equipment/dietary/cost/macro/stock/expiry filters, favourites/ratings,
  substitutions with recalculation and separate saved variations, storage/reheating/batch notes.
- Diary: recipes/manual meals/prepared portions, serving counts, edit/delete/copy, historical
  snapshots, daily/meal/weekly summaries and individually optional macro targets.
- Kitchen: package dates/prices/confidence/location, movements, expiry, waste, explicit atomic
  cooking, prepared portions, portion consumption/correction/waste, custom storage locations.
- Planner/shopping: daily/weekly meals with gym context, copies/moves/replacements, prepared
  food, planned macros/costs/shortages, stock-aware combined lists/package rounding, manual
  items and overrides, checking/receiving, automatic linked-list regeneration after plan edits.
- Purchases: camera/uploaded receipt images, real optional local English OCR, editable text
  extraction, mandatory review/matching, total/duplicate acknowledgements, explicit receipt
  receiving, recorded unit-price history, weekly/monthly budgets, checkout/estimated cost/waste.
- Overview/Progress: daily macro/meal/expiry context and weekly food/training/shared bodyweight
  records. Existing training routes, suggestions, streaks and library sharing remain available.
- Portability: schema 3 complete and dependency-aware category JSON, gym/food CSV analysis,
  preview counts, existing-ID retention, optional preference restore, confirmed complete
  replacement, recovery snapshots and rollback, images/drafts, supported schema 2 gym files.

The legacy workout calorie control and export column were removed to meet the supplied
requirement. Existing stored legacy values are not destructively rewritten, but are omitted
from new backups/reports. Food records expose only protein/carbohydrates/fat/fibre.

## Files and migration

New domain modules: `src/lib/food-model.ts`, `food-calc.ts`, `food-actions.ts`, `receipts.ts`
and `category-backup.ts`. New UI: seven `src/pages/Food*.tsx` pages and shared
`FoodUI`, `FoodOverview`, `CategoryPortability` components. New tests use the existing
Vitest/fake-indexeddb/Playwright setup. OCR assets/notices are pinned in `public/ocr`.

Integration edits are confined to App navigation/routing, model/database/backup support,
Overview/Progress/Settings, removal of the old workout field, shared CSS and optional OCR
PWA caching. Package dependencies, lockfile and GitHub workflows are unchanged.

IndexedDB **v2 → v3 adds 12 stores** without rewriting or removing gym tables. No export/reimport
is required on upgrade. Migration tests open an actual v2 database and verify workout/routine/
preference preservation. Tests use isolated synthetic databases/profiles, never personal data.

Complete backup reads include all persisted food files, rather than UI projections. JSON embeds
supported raster images, preserves stable IDs/relationships/quantities and includes a manifest.
Category files carry dependencies and permit merge only. Unsafe additions to existing inventory
balances are rejected, rather than grafted into a stale remaining quantity. Complete Replace
is explicit and atomic with its recovery snapshot. See [backup rules](BACKUPS.md).

## Limits and external configuration

No external service configuration or secret key is required. Tesseract/model assets are
vendored, base-relative and used on-device after an explicit request; first loading may need
connectivity. Actual recognition is tested with a synthetic receipt, not a claim of general
supermarket-receipt accuracy. Every extraction still requires corrections/review.

Implemented within stated limits: self-contained JSON rather than ZIP; PNG/JPEG/WebP uploads
up to 5 MB, 100 MB backup limit; FORM JSON imports rather than arbitrary external CSV mapping;
received purchases immutable; shopping/receipt receiving paths require manual duplicate avoidance.
Nutrition/price sources are user recorded. Auxiliary forms save on submission; ingredient,
recipe and purchase editors have durable drafts, including reviewed receipt text.
The UI still loads record metadata into memory; images load separately, and import/export
relationship checks use maps/sets. A synthetic 7300-entry archive is covered by a backup round-trip
test; physical-device performance with very large food datasets has not been profiled.

Not implemented: Apple Health, cloud sync/accounts, barcode/nutrition/retailer APIs, live prices,
currency conversion, a micronutrient catalogue, PDF/HEIC receipt import, refunds/reconciliation
automation. See [the food guide](FOOD.md) for operational details. Physical iPhone camera,
installed-PWA behaviour and storage pressure still need device checks.

## Final verification — 17 October 2026

| Check                                                     | Result                                     |
| --------------------------------------------------------- | ------------------------------------------ |
| Original baseline, before edits                           | 99 unit/storage + 66 browser checks passed |
| Final Vitest / real IndexedDB migrations and transactions | **129/129 passed**                         |
| Production browser suite at `/`                           | **93/93 passed**                           |
| Same production suite at `/form-test/`                    | **93/93 passed**                           |
| TypeScript and production builds at both paths            | Passed; root build restored afterwards     |
| Prettier and Git whitespace checks                        | Passed                                     |
| Pinned OCR source/hash/size checks                        | All 9 assets/notices verified              |

Each browser run uses desktop Chromium, phone Chromium and phone WebKit. It includes all
66 original gym checks plus 27 food checks. New coverage exercises real ingredient/recipe
forms and durable drafts, scaling/substitution, diary/targets, cooking/portions/waste, plan
changes/shopping, actual image OCR without external requests, cancellation/manual fallback,
receipt-text reload, complete/category exports and fresh-profile image/history restore,
offline records/images/purchases, light/dark accessibility, keyboard scrolling and 320px layouts.

The final suite exposed and verified fixes for keyboard access to the new weekly table and
an initial hash-navigation race. Desktop and phone screenshots were visually inspected.
The synthetic 7300-entry food archive round trip passed in the unit suite; this is not a
physical-device performance benchmark or proof of real receipt recognition accuracy.

A separate local review preview can run at `http://127.0.0.1:4174/#/food-menu` with
`pnpm preview --port 4174 --strictPort`. That port has independent browser storage, so it
starts without personal history. Use full JSON export/import to transfer records deliberately.
The normal launcher below uses the established port 4173 and upgrades its database additively.

## Run, test and deploy

This Mac: double-click **Start FORM.command** or run `./scripts/start-local.sh` to build and
serve at `http://127.0.0.1:4173/`. On a fresh machine use Node 24/pnpm 11:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Development uses port 5173. For the production/offline app and all checks:

```sh
pnpm format:check
pnpm test
pnpm build
pnpm exec playwright install chromium webkit
pnpm test:e2e
BASE_PATH=/form-test/ pnpm build
TEST_SUBPATH=/form-test/ pnpm test:e2e
pnpm build
pnpm preview --port 4173
```

This feature has **not been pushed or deployed**. Review the local `codex/food-management`
branch. To publish later, push that branch, review/merge it to `main`, wait for Verify FORM,
then dispatch the unchanged manual Pages workflow:

```sh
git push -u origin codex/food-management
# Review and merge to main, then wait for successful CI.
gh workflow run pages.yml --ref main
gh run list --workflow pages.yml --limit 1
```

The GitHub CLI must already be signed in on the machine running those commands. Opening the
successful job's URL and repeating the hosted checks in [deployment](DEPLOYMENT.md) is still
required; a local subpath check is not a deployment. Export personal data before moving
origins; Git/source publication does not move browser records.
