# Your backup and recovery guide

## Make an independent backup

1. Open **Settings & data**.
2. Choose **Export everything**.
3. Check your browser's download completed and keep the JSON file outside browser storage, for example in your normal backed-up documents folder.
4. Repeat regularly and before changing browser/device/site address or installing updates.

The app can start a download, but cannot verify that a file was actually retained on your disk. It therefore labels the timestamp **last file export requested**. Schema 7 includes all gym/climbing/practice/food records, preferences, timers, editor drafts and supported receipt/recipe/step images as embedded base64 data. A manifest records version, timestamp, categories and attachment count. Local recovery snapshots are not recursively included. CSV is for analysis and does not restore the complete database.

Your workouts belong to the browser origin: scheme + hostname + port. Development (`127.0.0.1:5173`), production preview (`127.0.0.1:4173`), `localhost`, GitHub Pages and another browser/device do not automatically share history. A GitHub push transfers source code only. Export locally and import on the hosted site when you move.

## Restore a JSON file

1. Choose a FORM JSON backup in Settings.
2. Review its schema version, export timestamp, per-table counts and existing identifiers.
3. Select **Merge** or **Replace** and confirm.
4. Check the restored workout history and any active workout.

**Merge** keeps existing IDs and preferences and adds new IDs. If a session ID already exists, that entire current session and its sets are retained; incoming edits and extra sets for that session are not grafted in. Current logical exercise/muscle mappings are retained. Repeated imports create no duplicate workouts. If two unrelated active workouts would result, the merge is rejected atomically; finish/cancel one first. Merge is not a conflict-aware synchronisation service. Use Replace to restore an authoritative complete edited snapshot.

**Replace** substitutes all application records/preferences/timer state from the file. The current data is captured as a recovery snapshot before replacement, in the same database transaction. Failure rolls back the import and snapshot together. Existing recovery snapshots are retained.

Invalid JSON, unsupported schemas, duplicate IDs/mappings, invalid fields and broken set/session/exercise/group relationships are rejected before writes. Files over 100 MB are rejected. A failure never displays successful import feedback.

## Supported versions

Schemas 2–6 remain supported. Schema 7 adds food programme definitions, schedule snapshots, unmeasured meal records and editor drafts; old files initialise empty programme arrays. Older app versions cannot read schema 7. Food programme library sharing uses its own version 1 format and excludes private schedules/history. See [food programmes](FOOD-PROGRAMMES.md).

Schema 2 gym backups remain supported; their missing food tables are initialised in memory. A merge preserves existing food data. Unsupported versions, missing referenced food records/files and attachment-count mismatches are rejected before writes. The retired optional workout nutrition metric is deliberately omitted from all new exports.

## Category files

In **Choose categories to export**, select gym history, exercises, routines, programmes, plans, bodyweight, recipes, ingredients, diary, meal plans, food programme libraries, personal food programmes/check-ins, stock/movements, shopping, purchases/prices, attachments/drafts or preferences. The JSON includes dependencies needed to reconnect selected records. Import through **Import selected categories** or the regular backup picker. Review per-table counts and duplicate IDs before confirming.

Category imports merge only. Existing IDs keep local values; there is no silent overwrite. Preferences, budgets, targets and timer restore only when their checkbox is explicitly selected. A conflicting relationship rejects the whole import. Quick export buttons create workout, food or financial category files. Arbitrary third-party CSV field mapping is not implemented; CSV reports are for analysis, while FORM JSON is the supported restorable format.

New consumption/movement records cannot be merged into an already-existing stock/batch/purchase
balance: keeping its old quantity would make the ledger inconsistent. That conflict rejects
the entire import atomically. Restore an authoritative complete file with Replace, or record
the change through the app. Repeated identical imports remain idempotent.

Images are stored within JSON rather than a separate ZIP, so files stay self-contained. Uploads support PNG, JPEG and WebP up to 5 MB per image. Imports and generated backups have a 100 MB JSON limit; oversized exports show an error rather than silently dropping files. Use category exports to split a large collection. Browser storage quotas still apply.

## Local recovery snapshots

Before each full-backup import, FORM saves a versioned snapshot in **Local recovery snapshots**. Download a snapshot and import the downloaded JSON to restore it. These snapshots are in the same IndexedDB storage as workouts; clearing browser/site data removes them too. They are not independent backups and do not survive all storage failures. Keep exported files.

## Library sharing files

Use **Share library** / **Import to library** in Exercise library or Routines & plans to exchange templates with other FORM users. These version 1 library files contain only exercises, muscle mappings, routines and programmes. They cannot restore workout history, measurements, preferences or timers, and are not full backups. Notes/descriptions and target weights are opt-in export choices.

Library imports validate file structure, identifiers, references and compatible metrics before adding anything. The 10 MB limit and collection limits reject oversized files. Matching definitions and repeated imports are kept without overwriting local edits; new identifiers and references are mapped together. New routine schedules are optional. All additions happen in one transaction and roll back together on failure. Existing personal records, settings and recovery snapshots are retained; additive library imports do not create a full-backup recovery snapshot.

## Accidental edits and deletion

Sets, archived exercises, bodyweight entries, routines, plans and removed sessions offer context-appropriate Undo. Destructive session, routine, measurement and replacement operations require visible confirmation. Session/exercise/set/measurement edits cause records and charts to recalculate. Archive exercises to retain their stable identity and full history.

## Reset all FORM data

For a single mistaken workout, open it in **Workout history** and use **Delete session**. Use the following full reset when you want a fresh start:

1. Open **Settings & data → Start fresh → Reset all data**.
2. Choose **Export backup before resetting** if you want an independent copy, and check the download completed.
3. Type the exact word **RESET**. Until then, **Permanently reset FORM** is disabled. Cancel closes the dialog without changing records.
4. Select **Permanently reset FORM**. A success message appears after the database transaction completes.

Reset removes climbing climbs/projects/sessions/plans/photos, workouts, sets, measurements, custom exercises/mappings, routines/programmes/plans, all food records/images/drafts, preferences, timers and **all local recovery snapshots**. It restores the original starter exercises/routines and default preferences, without sample workouts or meals. Streaks and analytics return to empty states. If any reset write fails, the entire transaction rolls back.

This affects the FORM database at the current browser origin. Other browser profiles, devices and origins have separate data; downloaded files are retained. Offline application files are retained. Reset has no Undo or hidden recovery copy: use an exported JSON file with **Replace** to restore previous records.

## Offline and storage limitations

Browser storage can be cleared manually, evicted under storage pressure, removed by private browsing or lost with the browser profile. Requesting durable storage may reduce eviction risk where supported; it is not a separate copy. If storage fails, the app shows an error and does not claim the write succeeded.

Production files are cached after the first successful service-worker installation. Test offline mode only after loading the production app online and reloading once. Development mode does not register the production worker. An update prompt lets you reload deliberately. Data stays in IndexedDB rather than the service-worker cache.

## Workspace and Climbing format 5

Complete backups now include the singleton workspace: pages/widget configurations, optional personal profile, systems/home, equipment profiles, recoverable layouts and private import draft/provenance. Existing version 2/3/4 files remain accepted with empty Climbing data. Merge preserves existing page/profile identities; system/home/draft preference restoration remains explicit. An older file does not erase local pages during merge. Replacement of an older file supplies one mixed Overview and enables all systems. The new workspace category includes setup exercise dependencies.

Page layout files (`page-layout`, format 1) and Gym libraries (schema 1) have separate preview/import tools and privacy rules. A complete/category workspace backup intentionally includes birthday, height, private notes and drafts; use Share layout to send a presentation without measurements. See the [workspace guide](WORKSPACE.md).

Food preferences now include fibre and optional background energy targets, goal setup and the calorie visibility opt-in. Older files default visibility to off. Merge restores these only when preference restoration is selected; ordinary additive imports preserve the local display choice. The profile and plan-generation save ledger are additive workspace fields and need no destructive database migration.

Climbing category exports include the personal library, session snapshots, project notes, dated plans and embedded climb photos. Complete replacements restore this singleton atomically with Gym, Food and workspace records. Additive imports keep local records with the same identity; no history or stock event is silently overwritten.
