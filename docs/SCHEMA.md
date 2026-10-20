# Data schema and invariants

`src/lib/model.ts` defines runtime Zod schemas and inferred TypeScript types. `src/lib/db.ts` defines IndexedDB database `form-training`.

## Tables

| Table       | Identity and relationships                                                                                          | Behaviour                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| exercises   | stable UUID or original catalogue slug                                                                              | Renames retain identity. Archive is reversible. Normal UI never permanently deletes an exercise.                                     |
| mappings    | ID + exerciseId + named muscle; primary/secondary role and contribution                                             | One logical mapping per exercise/muscle. Configurable global role multipliers.                                                       |
| routines    | ID; optional programmeId; ordered exercise items, planned sets, groups and sort order                               | Reusable templates. Weekly schedule uses local weekdays 0–6.                                                                         |
| programmes  | ID, name, notes                                                                                                     | Organisation for several routines. Removing a programme detaches routines, preserving them.                                          |
| plans       | ID; optional source routine ID; local YYYY-MM-DD date; copied items/groups; status                                  | A dated training snapshot or rest day. Starting copies into an active workout and marks the plan started.                            |
| sessions    | ID; status, ISO start/end timestamps, copied items/groups, optional source IDs                                      | At most one active session. Historical items preserve the tracking method/name/settings in use. All session edits save to IndexedDB. |
| sets        | ID; sessionId, itemId, exerciseId; order; optional measurements/effort; label; completion/timestamp; optional group | Authoritative records. Planned values remain incomplete until explicitly checked. RPE and RIR are mutually exclusive.                |
| bodyweights | ID, timestamp, kg, notes                                                                                            | Multiple readings per day. Never interpolated into missing dates.                                                                    |
| settings    | singleton `preferences`                                                                                             | Canonical units/settings, contribution and progression assumptions, last file export request.                                        |
| timers      | singleton `rest`                                                                                                    | Millisecond deadline or paused remainder. Independent of navigation.                                                                 |
| backups     | UUID, timestamp, reason, versioned JSON                                                                             | Recovery snapshots in the same browser. Excluded from regular exports to avoid recursive backups.                                    |

PRs, charts and totals are derived, never a competing source of truth. Export/import metadata lives in the versioned JSON envelope, settings and recovery snapshot records.

The `workspaces` singleton (`id: workspace`) owns system preferences, home/page order, bounded widget definitions/configuration, equipment profiles, recoverable layouts and a private pasted-workout draft/import provenance. It does not own Gym/Food measurements. See [workspace behaviour, formats and limits](WORKSPACE.md).

Completed set/item `setup` snapshots retain profile identity, load convention and reminders. Profile edits do not rewrite snapshots. Optional `restUnknown`, set `partialReps`, session `dateOnly`/`importId`, and planned-set notes are additive. Date-only local timestamps are technical; duration is zero and factual times are omitted from CSV.

## Versions

- IndexedDB v1: core entities and indexes.
- IndexedDB v2: adds the recovery snapshot table and merges missing settings defaults without replacing existing preferences.
- IndexedDB v3: adds food stores without modifying or clearing gym tables.
- IndexedDB v4: adds singleton `workspaces` without rewriting Gym/Food records. Its validated page revisions detect stale editors.
- IndexedDB v5: adds the Climbing aggregate without modifying gym or food stores.
- IndexedDB v6: adds `practice`, with separate `rocket-league` and `football` aggregate rows. Both systems default off for missing workspace preferences. Each row owns its library, routines, goals, history and at most one active session.
- JSON envelope schema v6: `{app: "FORM", schemaVersion: 6, exportedAt, scope, manifest, data}`. Scope is `complete` or `categories`; the manifest records categories, format version and attachment count. Schema 2 gym backups migrate in memory with empty food stores; schema 3 Food and schema 4 Workspace and schema 5 Climbing backups also remain supported. Versions 2–5 initialize empty practice data. Versions 2–4 initialize empty Climbing data. Old backups omit workspace preferences: replacement creates one default Overview and merge preserves existing pages. Existing Food records survive a merge. Unsupported versions are rejected. Gym library-sharing files retain schema 1. Practice libraries also use schema 1 with a distinct `type: practice-library` and an explicit system.

Dexie upgrades run transactionally. The current migration is additive; it does not rewrite or discard training history. A future destructive migration must first preserve a recoverable snapshot and be covered by upgrade/rollback tests. Users should export an independent file before upgrades.

## Important invariants

- Weight is kg internally. Distances are metres and durations seconds. Display conversions do not rewrite sets.
- A session item has its own unique identity, even if its exercise appears twice. Session creation replaces template item IDs with fresh IDs; source exercise identities remain stable.
- Existing exercise names may be displayed next to historical data, while the session retains the recorded name and tracking type. Analytics compare compatible tracking types; changing an exercise does not convert historical measurements.
- An incomplete set never contributes to completed analytics. Warm-ups are excluded by default. Cancelled sessions remain available on request but do not count as completed training.
- Completion is idempotent inside one database transaction. Repeated taps neither create additional records nor restart the deadline.
- Session completion and timer clearing are atomic. Deleting a session removes its sets atomically; undo restores the snapshot. A second active workout cannot be restored over an existing active workout.
- Set and item groups are scoped to their owning session/template. A set-level group overrides its exercise group. Membership never duplicates a set.
- Routine/plan edits cannot mutate sessions that already copied them. Removing a routine preserves planned/completed snapshots; retained source IDs may refer to a removed template.
- Import validates IDs, logical muscle mappings and set/session/exercise/group relationships before writes. Replacement and its recovery snapshot commit atomically. Merge keeps existing identifiers; it never grafts imported sets into an existing session snapshot.
- Save errors are shown. Success feedback occurs after awaited writes; a browser closed during an unfinished write cannot be guaranteed to complete that write. Wait for saving indicators to finish.

## Scale

Food schemas live in `src/lib/food-model.ts`; `food-actions.ts` performs multi-record changes
transactionally; `food-calc.ts` is the shared calculation source. UI reads skip binary file
payloads, loading images by ID; backup reads explicitly include all files.

| Food table    | Relationships and behaviour                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ingredients   | Stable ID, aliases/brand/category/state, per-100 macros, provenance, conversions, package/storage metadata, archive            |
| recipes       | Ingredient references, servings, ordered steps/image IDs, tags, times, notes, ratings, draft/archive                           |
| foodEntries   | Date/meal, recipe/batch refs, servings, frozen per-serving macro/cost/ingredient snapshot                                      |
| mealPlans     | Date/meal, recipe/optional batch ref; never implicitly consumes stock                                                          |
| stock         | Ingredient, quantity/unit, original quantity/price/currency, dates/location/confidence, source purchase/line                   |
| movements     | Signed changes, stock/batch/ingredient refs, kind, timestamp, historical cost/currency                                         |
| batches       | Recipe, produced/remaining portions, preparation/expiry/location, per-serving snapshot                                         |
| purchases     | Reviewed receipt header, net total/currency, product-line IDs and ingredient/package/paid/received metadata, image/fingerprint |
| shoppingLists | Date range or recipe, generated/manual rows, shortage/package estimate, override/checked/received states                       |
| foodSettings  | Singleton `food-preferences`: independent macro targets, budgets, currency, locations                                          |
| foodFiles     | Raster-file ID, original name, MIME, base64 data, timestamp                                                                    |
| foodDrafts    | Editor kind/JSON/timestamp; unsafe shapes are exportable but not resumed                                                       |

Imports check IDs, dates, numeric ranges, units, references, recipe/batch and purchase-line
compatibility, and attachments. Merge validates the combined graph before commit. Replace
and its recovery snapshot roll back together. Historical food snapshots deliberately preserve
past values after recipe edits.

Muscle analytics index session items and mappings and visit completed sets in linear passes, with per-exercise median sorting. Exercise history groups relevant sets before comparing sessions. A regression fixture exercises 30,000 sets across 1,500 sessions. Records are memoised in views until underlying data changes. The app still loads the local dataset into memory; archive pagination/worker-based aggregation may be useful for substantially larger datasets.

## Climbing (IndexedDB version 5)

The `climbing` store contains one validated singleton with a revision and ID-addressed climb, session and dated-plan arrays. Climb photos are embedded raster attachments. Session entries preserve literal name, grade/scale, environment, discipline and venue snapshots; library edits and archives do not rewrite history. Session results distinguish attempts, clean completions, rests and flashes. New records use date-only dates and optional recorded minutes. Writes are transactional and stale record editors are rejected. Complete/category backups include Climbing and count its photos in the attachment manifest. The workspace Climbing system flag defaults to enabled for older preferences.

## Practice data

`src/lib/practice-model.ts` validates independent system rows and library relationships. Routines snapshot ordered drills, sets, targets, cues and setup into active sessions. Result corrections use aggregate revisions; stale block commands cannot complete or skip a different block. Counts and timer work time are separate. A timer records elapsed work from a saved timestamp and paused elapsed time; expiry never fabricates a result. Skipped and pending entries are excluded from performance summaries. Course diagrams, setup and foot define comparable series. Shot target counts and keepy-up bests must agree with recorded attempts. Practice library sharing excludes sessions and goals, uses content-derived import identities and removes schedules on import. Full backups include hidden systems, and conflicting active-session merges roll back with their pre-import recovery snapshot.
