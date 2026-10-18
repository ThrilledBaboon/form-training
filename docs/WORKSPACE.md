# Your FORM workspace

This extension is local only on `codex/custom-workspace`. It includes the unpublished Food extension. The public GitHub Pages site has not been updated.

## Arrange a page

Open Overview and choose **Edit page**. Every card is a widget. **Add widget** searches 40 Gym, Food and Shared views; add copies with different exercises, metrics or ranges. Configure the title and filters, choose Compact/Half/Full width, and use the arrows or dedicated drag handle to reorder. Phone layouts stack in saved order. Changes save immediately; **Done editing** returns to viewing. The latest change has an **Undo** action.

**My pages → Create page** starts an empty page or a mixed Overview template. The page manager can rename the current page, duplicate, reorder, choose a home, delete, and recover the last 20 removed/replaced layouts. Deleting the home falls back to Overview. An explicit deep link wins over the home preference. **Restore default Overview** only changes its arrangement, after confirmation.

The page date range applies to historical widgets. Their configuration can override it; the card shows which range it uses. Daily, monthly and live views show their different time semantics. Exercise load bounds are stored in kg, so changing display units preserves the filter. **Add to page** on Exercise progress, Muscle insights, Bodyweight, Food diary and Food spending carries applicable selected filters into a new independent widget. **Explore** opens the detailed view.

## Share a layout

**Share layout** previews the exact file before **Download layout**. Send that file to another FORM user. They choose **Import layout**, review the arrangement and required systems, map exercises/ingredients to their library, and confirm. Unresolved references remain configurable. Unsupported widget types remain inert placeholders. A repeated import is blocked unless another copy is explicitly selected. Import creates a new page by default; replacement requires confirmation and retains a recoverable previous layout.

Layout files contain presentation settings, custom titles, reference names and explicit filter bounds. They exclude recorded workouts/sets, graph points, bodyweight readings, Food entries, receipts, stock, purchases, equipment profiles, drafts and source text. Personal note text is excluded unless **Include personal note-widget text** is checked. Titles, names and numeric filter bounds may themselves be personal: inspect the preview. Equipment contexts are selected locally after import; the recipient's measurements and profiles are used. Import does not change system switches or the home page.

Layouts (`type: page-layout`, `formatVersion: 1`), Gym libraries (`type: library`, `schemaVersion: 1`) and complete backups (`schemaVersion: 4`) have separate import tools. A wrong file produces an explanation without writing records. Known-format unsupported types are retained, while unsupported format/configuration versions and malformed settings are rejected. Imported content is plain data: no HTML, scripts, module loading or remote URLs execute.

## Choose systems

**Settings & your data → Systems** independently enables Gym and Food. Both start enabled after upgrade. Disabling hides the domain's navigation, actions, widgets and contextual panels. Hidden widgets stay at their saved positions and appear in the editor with an explanation. Direct links show an explicit enable action. Both systems may be off: pages, bodyweight, settings and backups remain available.

An active workout, timer deadline/paused remainder and Food/import drafts remain saved. Hidden timers have no foreground component or alerts. Re-enabling displays the remaining/elapsed state; a timer that expired while hidden is marked notified without a late sound. Complete backups include disabled-system records. Layout imports and record imports do not enable systems.

## Remember equipment

Open **More / Your workspace → Equipment setups**, or the exercise-library link. Create a profile for an exercise with optional gym, machine, settings, attachment, grip/stance and notes. Choose a recorded-load convention and, optionally, an increment. Profiles can be duplicated, archived and selected as an exercise's default.

A default is copied into future workouts, including newly added exercises. The workout selector applies a different setup to uncompleted sets. Completed sets retain their snapshot even after a profile edit, archive or mid-workout change. The displayed 15 kg **per dumbbell** stays 15 kg; FORM never doubles stored values or converts between machines. Historical unspecified records stay unspecified.

Suggestions and previous-set prefills use matching setup identity and load convention. An equipment increment is stored in kg and converted to the current display unit. Assistance is never increased as resistance progression. PRs are computed separately by setup/convention. Load-based exercise charts require a comparable context if records are mixed; filters are available in widgets and detailed progress. Bodyweight, time and distance tracking retain existing rules. Volume and muscle scores continue to use the recorded external load; they are not a normalised machine-to-machine comparison or measured activation.

## Import pasted workouts

Open **Paste workout notes** from History, Routines or the workspace menu. Parsing is offline and deterministic. Paste dated sections such as this synthetic example:

```text
13.10.26
Barbell bench press 30 kg 8 reps
1. 1
2. 2
3. 3, 35 kg instead
Note: could go slower

15.10.2026
Dumbbell incline press 15 kg per dumbbell 3 x 8
Rest: 1.5 minutes
```

Supported patterns include day-first `DD.MM.YY`/`DD.MM.YYYY`, `DD/MM/YYYY` and ISO dates; names/aliases; `3 x 8`, `30 kg x 8`, numbered set markers; kg/lb; explicit per-set measurements; rest in minutes/seconds; session/exercise/set notes; and explicit partial-rep observations. Two-digit years mean 20YY. Matching suggestions require a unique name/alias; unmatched exercises require choosing a match or explicitly creating a definition with unconfigured muscle mappings. Numbered `1. 1 / 2. 2 / 3. 3` are set markers, not repetition counts. A third-set override affects only that set.

Review all observations. Correct dates/names, tracking, exercise/profile/load convention, set order/count/completion, measurements, labels, rest and notes. Split before an exercise or merge draft workouts to correct boundaries. A set with unknown required measurements can stay uncompleted; it is visible but excluded from completed-set analytics. Separate full/partial reps and inspect the retained note. Missing rest stays blank and is not a zero-rest prescription. Newly started routine sets with unknown rest do not start an automatic timer until rest is deliberately entered.

**Times unknown — date-only entry** records the local date with no duration. Technical local-midnight timestamps are storage details; details/history label the entry date-only and CSV exports omit factual times. Enter actual start/finish times only when known. Routines can be created without a known date; history requires a valid date. No historical bodyweight reading is invented. Historical items exclude bodyweight-inclusive estimates unless a reading is actually available through ordinary editing; future routine starts use the exercise's normal bodyweight setting.

Confirm each selected workout and choose **Completed historical sessions**, **Unscheduled reusable routines** or **Both**. Unselected workouts stay in the draft. Source and corrections save on this device across navigation/reload. Changed source must be parsed again. An import saves related records together, never starts/replaces the active workout and never starts a rest timer. Draft identities and per-workout fingerprints block repeat saves, including a repeated subset. A matching previous import is shown before an explicit additional copy is allowed. Identical targets on different dates remain legitimate.

The success notice offers **Undo** for that newly created batch. It refuses undo if those records were subsequently edited or an imported routine was used, directing you to individual edits/deletions instead. Newly created exercise definitions remain in the library. Failed saves keep the draft and roll back the batch. An imported text instruction is treated only as text.

## Backups, limits and local testing

Use **Export everything** for a private complete backup of records, files, pages, hidden widgets, preferences, setups, reviewed import drafts and provenance. The category export **Pages, systems, equipment & import drafts** includes setup exercise dependencies. This is personal backup content, not a privacy-limited shared layout.

IndexedDB v4 adds one workspace store to the existing v3 database; it does not rewrite Gym/Food records. Complete/category JSON version 4 accepts existing version 2 and 3 backups. An old-backup merge retains local pages/preferences; replacement supplies default pages and both systems on when the old file has none. Merge keeps existing page/profile identities; the existing explicit preference-restoration choice controls system/home/draft preferences. Page revisions reject stale editors rather than overwriting a newer page.

Practical limits: 50 pages, 40 widgets per page, 20 recoverable layouts, 2,000 equipment profiles; layout files up to 500 KB; pasted source up to 100,000 characters, 50 workouts, 100 exercises per workout and 100 sets per exercise. Complete backups keep the existing 100 MB restore limit. Ranges and repeated analytics are cached per saved dataset; dashboard reads exclude receipt/photo payloads. Very large archives still load into memory, as before.

The parser does not understand arbitrary prose, every third-party export or every exercise naming convention. Use manual corrections for ambiguous text. No account, sync, Apple Health, automatic weight import, public layout gallery or paid parser was introduced. Physical iPhone Safari, installed-PWA updates, native file picking and touch dragging still require device testing; automated WebKit uses an emulated phone viewport.

The established local preview is **http://127.0.0.1:4174/**. Its origin retains its own browser data; it does not share storage with the hosted app, localhost, port 4173 or another browser. Refresh and accept FORM's normal update prompt when a cached older version is present. Do not clear site storage to update. Run `pnpm build` then `pnpm preview --port 4174` if the preview is stopped. Use isolated test profiles for `pnpm test:e2e` on 4173.

### System home pages and editing

Overview lives in Your workspace and combines enabled systems. Train and Food each have an independent, editable home page, initialized once when first opened. Editing one never changes the others. My pages can set any saved page as the starting view. System home pages can be reset to their own template.

Choose Edit page to reveal Drag to move, arrow controls, resizing and a visible Remove button. Handles support mouse, pen and touch; Escape or dropping outside a card cancels a move. Remove affects the layout, and Undo restores the previous arrangement. Workout and food records are retained.

### First-use profile

New users can enter an optional name, birthday, height, starting weight and goal weight on Overview, or choose Skip for now. Existing users with history are not interrupted. Settings always provides Your profile. Starting weight creates one identifiable measurement; editing the same value or changing height never adds another. Birthday and profile fields are included in private full backups and excluded from shared page layouts. Preference restoration during a merge is explicit.
