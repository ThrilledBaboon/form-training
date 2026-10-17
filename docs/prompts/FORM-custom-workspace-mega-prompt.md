# MASTER FEATURE-ADDITION PROMPT: FORM CUSTOM PAGES, WIDGETS, LAYOUT SHARING, OPTIONAL SYSTEMS AND TRAINING TOOLS

## 1. Your role and task

Act as a senior application engineer, product designer, data modeller and test engineer.

Extend my existing FORM application with a customisable workspace built from reusable widgets. Add shareable page layouts, independently switchable Gym and Food systems, remembered exercise/equipment setups, and reviewed imports of pasted workout notes.

This is an extension to a working application. Inspect the actual repository, preserve the product and its data, reuse its architecture, then implement and verify the features described below. Deliver working local software with appropriate tests and documentation.

Use this specification as an implementation brief. Complete the authorised local work without stopping at a plan, screenshots, a mock-up or decorative controls.

## 2. Product outcome

I want FORM to become a workspace I can arrange around how I use it.

The existing individual graphs, maps, summaries and useful actions should become widgets. I should be able to combine them into pages of my own, with each widget retaining its own settings. The main Overview must itself be a customisable page, starting from a useful template containing both training and food information.

I must also be able to share these page layouts with other people from the first implementation. They should see their own information in the imported layout.

People should be able to use FORM for Gym, Food, both, or temporarily neither. Switching a system off hides that part of the product while retaining its records and saved configuration.

The two accompanying training features are:

- Remember how I set up exercises and machines, including different gyms, load-entry conventions and weight increments.
- Turn pasted workout notes into reviewed, editable historical sessions or reusable routines.

## 3. Required scope and working defaults

These are first-release requirements, not optional future ideas:

1. A reusable widget system covering the existing analytics and primary summary cards.
2. A combined, editable Overview built with that same system.
3. Multiple user-created pages and a chosen home page.
4. Responsive arrangement, sizing and accessible editing controls.
5. Page-layout export and import, including missing-reference resolution.
6. Independent Gym and Food switches that preserve data and layouts.
7. Remembered exercise/equipment setups, available during workouts.
8. Pasted workout-note import with correction and confirmation before saving.
9. Complete backup coverage, compatible migrations and regression testing.

Use these reasonable defaults where a detail has not been decided:

- A tidy responsive grid with a small number of useful sizes, rather than arbitrary overlapping positioning.
- Named pages, one selectable as the home page.
- Both systems enabled for existing installations, preserving their current access.
- Page-wide date ranges with explicit per-widget overrides.
- Independent widget configuration even when the same widget type appears more than once.
- Layout imports create a new page by default.
- Existing domain pages remain available for detailed analysis and editing.
- Local file sharing without accounts or a public community service.

Document sensible implementation choices. Ask only about essential ambiguity that repository inspection cannot resolve safely. Do not ask me to choose routine library, CSS or database details.

## 4. Inspect the actual application first

Before editing, identify:

- Framework, routing, build system, styles and reusable UI controls.
- Persistent entities, database versions, migrations and transactions.
- Existing Gym and Food workflows and their shared dependencies.
- Every existing chart, map, calendar, summary card and useful dashboard action.
- Existing calculation functions, filtering rules and unit conventions.
- Exercise-library sharing, backup formats, category exports and restore behaviour.
- Active-session recovery, rest timers, drafts and save-error handling.
- Offline behaviour, service-worker updates and deployment configuration.
- Test commands, browser tooling, current branch and user-owned changes.

Run the existing appropriate tests and production build to establish a baseline. Record pre-existing failures separately from regressions introduced by this work.

Starting context to verify: FORM currently uses React, TypeScript, Vite, Dexie/IndexedDB, Zod and Recharts, with hash navigation and a static-host-compatible PWA. Relevant areas include `src/App.tsx`, `src/pages/Today.tsx`, `src/components/Chart.tsx`, `src/lib/model.ts`, `db.ts`, `actions.ts`, `calc.ts`, `backup.ts`, `library.ts` and the Food modules. At the time of writing, database and complete-backup versions are 3, while Gym library-sharing files use their own version 1. Verify these details before designing migrations.

Create an inventory mapping existing visualisations and summaries to their planned widgets. This prevents a superficial implementation that only converts two charts.

## 5. Preserve the working application and user data

Preserve workouts, sets, exercise identities, mappings, routines, programmes, plans, notes, streaks, progression suggestions, bodyweight, timers and existing Gym sharing.

Preserve ingredients, recipes, diary snapshots, targets, stock, movements, prepared portions, meal plans, shopping, purchases, receipt files, prices, budgets and drafts.

Keep existing functionality unless a change is directly required by this feature. Do not recreate the application, replace its database, seed fabricated personal records, overwrite user changes or simplify away working features.

Use additive, tested migrations where possible. Existing data must remain usable without an export/re-import step. Preserve stable identities and historical snapshots.

Work from the actual current checkout. An unpublished Food extension may already exist locally; starting from an older remote branch must not remove it. Use an appropriate `codex/` branch if isolation is needed, preserving the current changes.

Test with isolated databases and browser profiles. Never clear, overwrite or use the user's normal browser database as a test fixture.

## 6. Local-first operation and delivery boundary

Core functionality must work locally and offline after the required app assets are cached. No account, backend, subscription or paid AI service is required.

Keep static-host and repository-subpath compatibility. Preserve the current deployment workflow and service-worker update safeguards.

Build and verify the work locally first. Do not push, merge, publish or deploy this feature unless I subsequently authorise that action. Produce a concrete local result for review before publication.

Preserve an established local preview origin where practical: a different port is a different data origin. If a separate preview is useful, explain its independent storage and use synthetic test data there. Do not imply that a source-code update moves browser records between origins or devices.

## 7. Shared architecture for pages, widgets and systems

Introduce a small, typed widget registry that fits the existing codebase.

Each widget definition should declare:

- Stable widget-type key and configuration version.
- Human-readable name, description and catalogue category.
- Required systems or shared capabilities.
- Default configuration and runtime validation.
- Supported sizes and minimum usable dimensions.
- Renderer and applicable data/filter selectors.
- Configuration editor where necessary.
- Optional detailed-view destination.
- Safe serialisation rules for backups and shared layouts.

A widget instance has its own stable identity and serialisable configuration. Page layouts reference instances, their order and supported dimensions.

Use existing domain calculations as the source of truth. Extract reusable selectors or UI components where necessary; do not build competing implementations of volume, macros, prices, streaks or muscle contributions inside widgets.

Keep calculations, persistent layout definitions and rendering separate enough to test. A registry and shared components are sufficient; avoid building an unnecessary general plugin platform.

## 8. Independent Gym and Food switches

Provide clear controls in Settings, such as **Systems → Gym** and **Systems → Food**.

Each switch changes availability and visibility, not ownership of data.

| Gym | Food | Expected experience                                                                      |
| --- | ---- | ---------------------------------------------------------------------------------------- |
| On  | On   | Combined Overview and both sets of tools                                                 |
| On  | Off  | Gym navigation, actions and eligible widgets                                             |
| Off | On   | Food navigation, actions and eligible widgets                                            |
| Off | Off  | Custom pages and shared settings remain reachable, with a helpful way to enable a system |

Apply the selection consistently to navigation, mobile navigation, quick actions, contextual panels, widget rendering and related entry points. Hiding only a sidebar link is insufficient.

Keep settings, custom pages, backup/restore and system controls available regardless of the enabled systems. Shared bodyweight records must remain a single data source; define their availability deliberately so Food-only users can still access relevant measurements without a duplicate store.

Do not change targets, schedules, historical records or permissions merely because a system is disabled.

## 9. Disabled-system behaviour and recovery

Widgets requiring a disabled system remain in the saved layout at their original positions, with their settings intact. Hide them in normal viewing mode. Explain them in the editor and allow deliberate removal or explicit system enabling.

For widgets needing both systems, declare that requirement and handle the missing system consistently. Avoid rendering an apparently complete combined result with half its inputs silently excluded.

Direct links into a disabled system should show a useful disabled-system state with an explicit enable action and a route back to the workspace. Do not silently reactivate the system.

Preserve an active workout if Gym is switched off. Explain that it remains saved; never finish, cancel or delete it automatically. Preserve timer deadlines and paused state without allowing hidden controls or unwanted alerts to undermine the disabled experience. Re-enabling Gym should recover the session and report elapsed timer state honestly.

Preserve Food drafts and pending records when Food is disabled. A preference change must not submit forms, consume inventory, receive purchases or delete drafts.

Complete backups always include data from disabled systems. Importing a layout or domain records must not silently change the system switches. Restoring preferences follows the existing explicit restore rules.

## 10. A combined, genuinely customisable Overview

Replace the fixed Overview composition with an instance of the same page model and widget renderer used by custom pages.

Provide a sensible mixed template containing a manageable selection such as:

- Start/resume workout or next suggested session.
- Weekly training consistency and selected training totals.
- Workout streak.
- Bodyweight trend.
- Today's recorded macros and planned meals.
- Kitchen items approaching their recorded expiry.
- Weekly food spending and budget progress.

Choose a balanced initial layout rather than showing every possible widget at once. Use real records and honest empty states.

Every Overview widget must be independently configurable and reusable elsewhere. Do not leave an uneditable fixed dashboard above a token widget area.

Create the default Overview once for new or upgraded installations. Reloading, switching systems or installing another app update must not recreate it, duplicate it or overwrite customisations.

Provide **Restore default layout** with a clear preview or confirmation. This resets layout configuration only. It must not reset records, targets, stock, routines or either system's data.

## 11. Multiple custom pages

Support:

- Creating a named page from an empty layout or starter template.
- Opening and switching pages from accessible desktop and phone navigation.
- Renaming, duplicating, reordering and deleting pages.
- Choosing a home page and switching back to the default Overview.
- Adding, configuring, duplicating, resizing, moving and removing widgets.
- Multiple instances of the same widget type with different settings.
- Saving and reopening pages across reloads and offline use.

Use stable page routes. Preserve existing domain routes and useful bookmarks. An explicit deep link should still open its intended page; the chosen home applies to the app's normal landing behaviour.

Deleting the current home page needs a safe fallback. Deleting a page must never delete source records. Provide an appropriate confirmation or undo for accidental page/widget removal.

If all a page's widgets are hidden or have missing references, show a helpful empty state and editing action instead of a blank screen. Keep the page available so enabling a system restores its view.

## 12. Layout and editing interaction

Use a responsive grid with a few useful width/size choices. Prevent overlaps and unreadable dimensions. On phones, stack widgets in a predictable order without rewriting the saved desktop arrangement.

Keep a clear distinction between **View page** and **Edit page**:

- Viewing supports reading, chart interaction and intended quick actions.
- Editing exposes arrangement, sizing, configuration and removal controls.
- Charts and forms must not become accidental drag handles.
- Provide a clear finish-editing action and reliable save status.

Support drag rearrangement where practical, with dedicated handles. Also provide keyboard and tap controls to move widgets and change size; precise dragging cannot be the only method.

Choose a coherent save model. If changes auto-save, provide useful undo and do not imply Cancel discards saved changes. If using Save/Cancel, persist a recoverable draft and guard against losing unsaved edits. Failed writes must leave the last saved layout intact and show an actionable error.

Handle reordering, resizing and page changes while charts are visible without clipping, stale chart sizes, lost focus or horizontal overflow.

## 13. Widget catalogue and configuration experience

Provide a searchable **Add widget** catalogue, grouped sensibly into Gym, Food and Shared categories.

Show what a widget does, which system it requires and what can be configured. Explain unavailable widgets and provide an explicit enable action rather than silently enabling a system.

Allow a preview or useful description before adding. Show real data if previewing recorded information; never invent personal chart points to make a preview attractive.

Each instance should support an optional custom title, size and applicable filters. Make configuration understandable to a user rather than exposing internal field names or raw JSON.

Expose **Add to page** from existing analytics views where it makes sense. Carry across the selected exercise, metric and filters so I can save a useful view without configuring it again.

Widgets should open the relevant detailed view with their filters retained where the existing route supports them. Preserve detailed analysis, record editing and full workflow pages outside the dashboard.

## 14. Gym widget coverage

Inventory and convert existing Gym visualisations and primary summaries, including:

- Workout count, working-set count, training volume and training duration.
- Weekly consistency/activity and training calendar.
- Active workout and routine/planned-session shortcuts.
- Existing explainable session suggestions.
- Workout streak and rest-day bank.
- Recent completed sessions and personal records.
- Exercise progression: load, reps, working sets, volume and estimated maximum where applicable.
- Duration/distance progression for compatible exercise types.
- Exercise comparison or progression highlights.
- Bodyweight raw readings, existing moving average and relevant summaries.
- Muscle contribution map, selected-muscle trends and contribution summaries.
- Existing recent-training/recovery estimates, clearly distinguished from contribution volume.
- Relevant equipment/setup reminders for the next selected session or exercise.

Use the existing calculation and comparability rules. Existing streak rules must survive: a new streak starts with 5 rest days; each additional distinct workout day earns 1 up to 7; protected rest days do not increase the workout-day count.

Do not reduce a detailed chart to a screenshot or embed an entire route inside an iframe. Extract the meaningful visualisation and its applicable settings into a reusable widget.

## 15. Food and Shared widget coverage

Make the existing Food summaries and visualisations reusable, including:

- Daily recorded macros and optional target progress.
- Weekly macro summaries/trends and logging context.
- Today's or selected-date planned meals and upcoming meal-plan summaries.
- Kitchen stock/expiry summaries and prepared portions.
- Shopping-list progress and shortages where supported by existing calculations.
- Actual weekly/monthly checkout spending and budget progress.
- Existing spending breakdowns, estimated stock value and consumption/waste summaries.
- Recorded ingredient-price history where the current data supports it.
- Existing combined training/Food/bodyweight context.

Provide a small set of useful Shared widgets: plain personal notes, chosen shortcuts and quick actions. Notes must be safely rendered as text or a tightly limited safe format.

Respect existing financial distinctions: actual spending, estimated consumption cost and stock value are different measures. Preserve currency boundaries, incomplete values and historical snapshots.

Nutrition remains macro-based. No calorie fields, totals, targets, tooltips, recommendations or exports are introduced. Retain the existing deliberate handling of any legacy calorie data.

## 16. Dates, filters and comparable data

Pages should support a shared date range. Widgets can inherit it or use an explicit override. Clearly display exceptions such as “All time” on an otherwise monthly page.

Support existing useful ranges and custom dates where appropriate. Respect the application's local-date conventions, inclusive end dates and timezone handling.

Not every widget is a historical range chart: today's macros, the next workout, a monthly calendar and a live timer have different time semantics. Make those semantics explicit instead of forcing every widget through a misleading common filter.

Exercise widgets should retain applicable exercise, tracking type, metric, warm-up inclusion, rep/load filters and equipment/setup context. Muscle widgets should retain their selected region, contribution/recovery mode and scale where applicable.

Store measurement filters with an explicit canonical unit. Switching display units must not reinterpret a saved 30 kg threshold as 30 lb. Shared layouts should adapt display units to the recipient while preserving meaningful explicit filters.

Avoid silent changes to chart meaning when an exercise, recipe, equipment profile or source record is edited or archived. Present missing references as resolvable states.

## 17. Accuracy, updates and widget independence

Widgets display current saved information through shared selectors; they do not own copies of workout history, nutrition history or inventory.

Relevant edits must update all instances consistently. Layout changes and widget removal never modify domain records.

Keep each instance's configuration independent. Two exercise graphs with different exercises, ranges or metrics must not overwrite each other's settings.

Handle repeated charts correctly, including unique SVG gradient/clip identifiers, unique control labels, responsive resizing and isolated chart interaction state.

Preserve honest missing/unknown states. Unlogged meals are not proof that no food was eaten; unknown costs or macros are not manufactured zeroes; missing dates are not invented measurements. Reuse existing transparent rules and document any needed corrections.

Keep maps and recovery estimates labelled according to what the recorded data can support. Do not turn combined charts into unsupported health or causal claims.

## 18. Layout sharing is part of the first implementation

Implement real **Export page layout** and **Import page layout** workflows. File-based sharing is sufficient; a backend, account or online gallery is outside this scope.

The exported layout should contain the information needed to recreate the page's structure:

- A distinct, versioned FORM layout-file identity.
- Page title and selected shareable presentation metadata.
- Widget types, supported sizes, order and safe display configuration.
- Explicit date/filter semantics and portable reference hints where needed.
- Required systems/capabilities and format/widget versions.

Share layout definitions, not the current data being displayed. Exclude workout records, recorded set measurements, graph-point arrays, bodyweight readings, diary entries, meals eaten, purchases, receipt images, balances, stock quantities and private drafts. Deliberately configured numeric filter bounds are view settings rather than historical records; show them in the export preview so the user can remove sensitive filters before sharing.

Personal note-widget text and equipment/setup notes are excluded by default. If offering an explicit include-notes option, preview precisely what it includes. Custom titles and reference labels may themselves be personal, so show the actual export content in an understandable preview.

Never export broad application objects and merely delete a few known private fields. Use an allowlist of layout-only fields and test for accidental data leakage.

## 19. Importing and resolving a shared layout

Before writing, show:

- Page name, widget types and approximate arrangement.
- Required systems and which are currently disabled.
- Missing references, unsupported widget types and configuration issues.
- The proposed destination and any duplicate/replacement decision.

Imported layouts use the recipient's records. Source-local exercise, recipe, routine or equipment IDs must not be blindly reused or treated as globally meaningful.

For exercise-specific widgets, provide an explicit mapping to the recipient's library, using portable names/compatible tracking as suggestions. Do not silently choose an ambiguous match or create unrelated domain records merely to make a graph look populated.

Provide equivalent resolution for other record-specific widgets. Allow unresolved widgets to remain safely unconfigured with a clear setup action. Importing can still be useful before the recipient has matching data.

Do not switch on disabled systems. Retain their widgets and explain that they will appear if the user explicitly enables the required system.

Create a new page by default. Replacing a page requires a deliberate destination choice and recoverable confirmation. Detect repeated imports and offer to keep the existing page or deliberately create another copy; repeated taps/retries must not create accidental duplicates.

Importing a layout must not replace the recipient's home-page choice or module preferences without an explicit choice.

## 20. File validation and compatibility

Keep page-layout files distinct from complete backups and existing Gym library files. Route a wrong file to the appropriate workflow or give a clear explanation; never guess and write partial records.

Validate file size, format version, object structure, page/widget counts, identifiers, numeric limits, strings, filters, sizes, references and configuration versions before committing.

Document practical limits suitable for a local personal app. Reject malformed or unsupported future-format files without changing the database. Known-format unknown widget types can remain bounded, non-executable placeholders with an explanation; do not claim to render them successfully.

Treat imported names, notes and configuration as data. Never execute scripts, arbitrary modules, HTML, evaluation expressions or remote fetch instructions from a layout file. No imported layout may initiate a hidden external request or install code.

Regenerate destination instance identities appropriately. Preserve import provenance sufficient for duplicate detection without publishing private installation identifiers.

Use transactional commits or equivalent rollback guarantees. A failed import must not leave a half-created page, overwrite source data or change system preferences.

## 21. Remembered exercise and equipment setups

Add reusable setup profiles associated with an exercise and, optionally, a gym/location or particular machine.

Useful fields include:

- Profile name and optional gym/location.
- Exercise identity and optional machine/equipment label.
- Seat, backrest, pin, pulley, bench-angle or other setup settings.
- Attachment, grip, stance and technique reminders.
- How load is entered: total load, per dumbbell, per side or another explicitly supported convention.
- Available load increment and optional supported load range.
- Optional rest/default preferences when genuinely relevant.
- Personal notes, archive state and timestamps.

Allow creation, editing, duplication, selecting a default and archiving. Keep optional fields optional; a simple note-only setup should be easy.

Make setups available from exercise details and the active workout. Show the relevant reminders without requiring a separate navigation trip between every set. Allow routine/session selection of the appropriate profile where helpful.

Different machines or gyms must be distinguishable while retaining the underlying exercise identity. Do not fragment the entire exercise library into accidental duplicates.

## 22. Setup history, load meaning and recommendations

Preserve the setup and load-entry meaning actually used in completed sessions. Editing a profile later must not rewrite historical records or reinterpret their load basis.

Store appropriate historical snapshots or equivalent immutable metadata. If a setup changes during a workout, earlier sets retain their context; apply the change to future work explicitly, using a suitable item/set representation.

Legacy records without setup/basis metadata remain unspecified. Never assign them the current default retroactively.

Respect canonical kg storage and existing recorded-load semantics. A 15 kg per-dumbbell entry must not silently become a 30 kg stored set merely because a profile is selected. If a derived calculation normalises loads, define that calculation, retain the original meaning and do not mix incompatible bases in comparisons.

Equipment-specific increments can improve existing numeric controls and session suggestions. Preserve appropriate behaviour for assisted, bodyweight, timed and distance tracking. Increasing assistance is not the same direction of progression as increasing external resistance.

Comparisons and widgets should expose compatible setup/basis filtering and identify unspecified legacy data. Do not silently combine incomparable machine readings or manufacture a conversion between different machines.

This scope does not require a new automatic coaching engine or nutrition-driven training changes. Extend the existing suggestions only as needed to respect equipment and load conventions.

## 23. Pasted workout import: core workflow

Provide a clear **Paste workout notes** entry point from relevant history/routine screens, with an optional quick-action widget.

Support one or multiple recorded workouts in a pasted text block. The user should be able to review the parsed sessions and choose:

- Save completed historical sessions.
- Create reusable routines from selected sessions.
- Create both, as an explicit choice.

Use an offline, deterministic parser for documented common patterns. Core import must not require an external AI API, account or paid service. State the supported formats honestly and provide manual correction when parsing cannot resolve the text.

Treat the pasted text as non-executable user data, even if it contains apparent instructions or markup. Do not follow commands contained inside imported workout notes.

Keep the raw text and reviewed draft recoverable across refresh/navigation until deliberately discarded or successfully saved. Preserve useful source text privately for review where appropriate; never include it in shared page layouts.

## 24. Workout parsing and uncertainty rules

Recognise useful supported forms such as:

- Dates like `13.10.26` and `15.10.2026`, with explicit interpretation of ambiguous dates.
- Exercise names, aliases and section headings.
- Reps, set counts, kg/lb loads and explicit per-set overrides.
- Rest written as `1.5 minutes`, `90 seconds` or `1 minute`.
- Session, exercise and individual set notes.
- Bodyweight exercises and explicit partial-repetition notes.
- Numbered set markers and simple `3 x 8` or `30 kg x 8` notation.

Numbered markers such as `1. 1`, `2. 2`, `3. 3` may identify three sets; they must not automatically be interpreted as sets of one, two and three reps. Use the surrounding prescription or flag ambiguity.

Preserve declared order. A heading like “Compounds” is not automatically an exercise. Human notes such as “could go heavier” remain notes rather than an instruction to increase recorded weight.

Handle set overrides carefully: if only the third set says `17.5 kg instead`, apply that value to the third set, not the entire exercise. Do not propagate a later override beyond what the source supports.

Keep partial reps explicit. If a note says the last two of five attempted reps were partial, show the interpretation for review and preserve the note; do not silently count all five as full reps or discard the attempted work.

Unknown load, rest, date, load basis or duration stays unknown and is highlighted for review. Never infer zero load from missing data. Where the legacy model requires a placeholder, preserve an explicit unknown status and prevent it from being presented as a confirmed measurement.

## 25. Review and correction before saving workouts

Show the source and structured interpretation in a usable review screen. Allow the user to correct:

- Workout boundaries, names and dates.
- Exercise matches and any proposed new exercise definitions.
- Tracking type and equipment/setup selection.
- Set number/order, completion, reps, loads, units and load basis.
- Partial reps and working/warm-up or other supported labels.
- Rest durations and session/exercise/set notes.
- Any missing or uncertain fields.

Use names/aliases to suggest existing exercises, but require resolution of ambiguous matches. Creating a new exercise must be explicit and validated, with an honest unconfigured mapping where appropriate.

If exact times are unknown, support a clearly labelled date-only historical entry with no fabricated workout duration. Internal technical timestamps must not appear as factual start/end times or affect duration summaries misleadingly. Use safe local-date and daylight-saving handling.

When creating a routine, retain exercises, set targets, loads and notes, but do not automatically schedule it on the historical weekday or change an existing programme. Unknown rest is not a prescription for zero rest.

The review must support saving well-resolved sessions while leaving other sessions as drafts, with a clear selected-record summary. Never save partially reviewed ambiguous records without explicit acceptance.

## 26. Atomic saving and duplicate handling for pasted imports

Saving reviewed history must use normal validated domain actions or an equally safe transactional path. Related exercises, session items, sets and metadata must commit consistently.

Do not start a live workout, replace the active session or trigger rest timers when importing completed historical sessions.

Use stable draft/import identities and appropriate fingerprints so repeated taps, reload recovery and retries cannot duplicate the same accepted records. Detect probable previously imported workouts and show a useful comparison before the user deliberately keeps another copy.

Legitimate identical workouts on different days must remain possible. Do not reject records merely because their loads and reps match.

Keep imported completed sessions distinct from planned targets. Analytics include only the records the user reviewed as completed, under existing calculation rules.

After a successful save, update history, calendars, streaks, exercise progress, PRs, muscle summaries and all relevant widgets. Editing or undoing an import should recalculate them consistently.

If any part fails, retain the draft and source, show the failure and avoid false success. Provide an appropriate way to undo an accidental newly imported batch without deleting unrelated data.

## 27. Persistent model, migration and full portability

Design persistent records for pages, widget instances/configuration, system switches, home selection, setup profiles, historical setup context and import drafts/provenance as needed.

Use stable identities and runtime validation. Document relationships, deletion behaviour and version evolution. Keep layout/config migrations separate from the meaning of historical measurements.

Extend **Export everything** and full restore to cover every new persistent category, including page arrangements, per-widget settings, disabled-system widgets, module preferences, setups and recoverable import drafts.

Keep complete backups separate from privacy-limited layout sharing. A complete personal backup intentionally carries personal data; a shared layout does not.

Add appropriate category-level portability for pages/setups where useful. Existing supported complete backups and Gym library files must continue to import correctly. When an older backup has no pages or module flags, apply documented defaults without erasing newer local pages during a merge.

Preserve existing merge/replace and preference-restoration semantics. Backups can reference records directly because they restore relationships; shared layouts need portable mappings instead.

Maintain transactional restore, validation, recovery snapshots and rollback. A full reset should deliberately include the new categories under the existing explicit reset workflow; restoring only the Overview template must not use that destructive path.

## 28. Interface, accessibility and everyday use

Follow FORM's existing visual language, themes, dialogs, typography and feedback patterns.

Ensure:

- Readable phone, tablet and desktop layouts, including narrow screens.
- Comfortable touch targets and sensible mobile keyboard behaviour.
- Proper labels, visible focus, keyboard editing and screen-reader announcements for moves.
- Textual chart summaries and an accessible alternative to muscle-map colour.
- Non-colour indicators for unavailable systems, incomplete data and import warnings.
- Clear loading, empty, missing-reference, save-error and success states.
- Reduced-motion support and sensible behaviour when the viewport changes.
- Focus restoration after dialogs and predictable focus after moving/removing widgets.

Avoid an obstructive onboarding flow. Existing users should immediately recognise the app, with a discoverable way to customise the Overview.

Keep implementation metadata out of normal product flows. Explain uncertainty or compatibility in terms of the user's page, records and choices rather than raw database identifiers.

## 29. Performance and reliability

Several widgets may request the same underlying analytics. Share/memoise expensive calculations rather than recomputing full history for every card and keystroke.

Keep images and receipt payloads out of routine dashboard reads. Avoid serialising domain history into page state. Use efficient queries and selectors that fit the existing persistence architecture.

Test a realistic page containing multiple graphs, repeated widget types, muscle information and Food summaries. Define and document practical page/widget limits that protect mobile usability without artificially restricting normal use.

Do not load inactive system widgets, attach duplicate subscriptions or leave timer/resize handlers behind after navigation. Disabled systems retain data without causing unwanted foreground actions.

Handle interrupted writes, storage errors, multiple tabs and stale editors deliberately. At minimum, avoid silently overwriting a newer saved page from a stale editor; provide detection/reload or another documented conflict strategy.

Keep local assets and routes base-relative. Opening a custom page directly, reloading it and reopening it offline must work under both root and project-subpath production builds.

## 30. Automated verification requirements

Use the existing unit, IndexedDB integration and browser-test frameworks. Add tests for meaningful data and interaction behaviour, rather than assertions that merely repeat implementation details.

### Baseline and regression

- Existing Gym/Food suites and production build.
- Active-session persistence, timer behaviour and existing sharing.
- Inventory, cooking, purchase receiving and historical Food snapshots remain unchanged by layout operations.
- Existing unit, muscle, progression, macro and financial calculations remain authoritative.

### Pages and widgets

- Idempotent creation of the initial mixed Overview.
- Page creation, rename, duplicate, reorder, deletion and home fallback.
- Widget add/configure/duplicate/move/resize/remove and recovery/undo.
- Multiple instances with independent exercise, metric and range settings.
- Correct use of shared ranges, overrides, local dates and display-unit changes.
- Underlying record edits update every relevant widget.
- Missing/archived references and honest empty/unknown states.
- Repeated charts have unique identifiers and resize correctly.
- Reload/offline persistence and storage-failure behaviour.

### System switches

- All four Gym/Food combinations across desktop and mobile navigation.
- Direct routes, quick actions, cross-system summaries and hidden widgets.
- Off/on cycles preserve records, drafts, positions and configuration exactly.
- Switching Gym off with an active workout preserves it and handles timer state safely.
- Backup and restore include disabled-system data.
- Layout import cannot silently enable a system or replace module preferences.

### Layout sharing

- Export/import round trips recreate arrangement and safe settings.
- Privacy tests inspect the actual exported file for forbidden personal records and values.
- Different recipient IDs, units, available exercises and enabled systems.
- Ambiguous/missing mappings and unsupported widget handling.
- Malformed, oversized, wrong-format and unsupported-version files cause no writes.
- Duplicate imports, rapid taps, deliberate copies and explicit replacement recovery.
- Import rollback and escaped untrusted text/configuration.

### Equipment setups

- Profile CRUD/default/archive and workout selection.
- Per-dumbbell/total/per-side basis stays explicit and is not silently doubled.
- Unit conversion and equipment increments.
- Profile edits do not rewrite completed history.
- Mid-session changes preserve earlier set context.
- Legacy unspecified context and incompatible comparison handling.

### Pasted workouts

- Multiple dates/workouts, aliases, headings and numbered set markers.
- Common set notation, kg/lb, decimal loads and rest conversion.
- Per-set overrides, partials and notes at the correct scope.
- Unknown load/basis/rest/times stay unresolved rather than becoming invented facts.
- Review changes survive refresh; cancel/discard makes no domain writes.
- Save history, save routine and explicit save-both modes.
- Date-only sessions do not fabricate duration; routines remain unscheduled.
- Atomic failures, retries, duplicate detection and batch undo.
- Imports do not disturb an active workout or start timers.

### Migration, backups and UI

- Upgrade an actual prior-version database containing both systems and an active session.
- Complete/category round trips preserve new records and relationships.
- Older supported backups and existing library files still work.
- Root and repository-subpath production builds, navigation, reload and offline use.
- Desktop Chromium, phone-sized Chromium and WebKit where available.
- Light/dark themes, keyboard operation, automated accessibility and narrow-layout overflow.

Use synthetic fixtures. Never commit my private database, pasted history, receipt images or backups as test/demo assets. Report browser emulation separately from physical iPhone/PWA testing.

## 31. Implementation phases

Implement in working increments, with relevant checks after each phase:

**Phase 0 — Audit and protection:** inspect the repository, establish baseline, inventory visualisations, document data/migration risks and plan the implementation.

**Phase 1 — Persistence and system foundations:** introduce validated page/widget/system/setup models, compatible defaults, migrations and backup protection before substantial new writes.

**Phase 2 — Widget engine and Overview:** build shared renderers, extract existing visualisations, introduce the editable mixed Overview, catalogue and consistent data selectors.

**Phase 3 — Custom pages and editing:** multiple pages, home selection, responsive grid, accessible move/size controls, saved configuration, recovery and detailed-view links.

**Phase 4 — Layout sharing:** export/import previews, portable reference mapping, privacy allowlists, duplicates, compatibility and disabled-system handling. This phase is mandatory before the first release is considered complete.

**Phase 5 — Full system-switch integration:** apply toggles consistently across routes, navigation, widgets and actions; verify preservation and active-workout recovery.

**Phase 6 — Training additions:** equipment/setup integration and the full pasted-workout parse/review/save workflow, including historical semantics and widgets.

**Phase 7 — Hardening and delivery:** complete widget coverage, migrations/backups, regressions, accessibility, offline/subpath checks, visual inspection and documentation.

Reorder dependencies when sensible, especially building backup safeguards and layout-share serialisation rules early. Do not postpone sharing to a future release or silently drop either training addition.

If interrupted by execution/context limits, leave a working state and an exact continuation record. Do not label a partial phase as the complete feature.

## 32. Acceptance scenarios

The implementation must support these end-to-end examples:

1. I open my upgraded app with all existing records intact. The Overview contains editable Gym and Food widgets. Changing its layout survives refresh.
2. I create “My progress”, add two different exercise graphs, a bodyweight trend and a muscle map, then make it my home page. Each widget keeps its own configuration.
3. I change the page range to the last month while one exercise graph stays on All time. The labels and values explain the difference.
4. I turn Food off. Its navigation/actions/widgets disappear, but its records and widget positions remain. Turning it on restores the same layout and data.
5. I turn Gym off during an active workout without losing that workout. Re-enabling it recovers the session and honest timer state.
6. I share a page. A second isolated user imports it, maps exercises from their own library and sees their own records. My historical measurements and private notes do not leak through the layout file; any intentionally shared filter settings are visible in the export preview.
7. That recipient has Food off. Import preserves Food widgets as hidden configuration without enabling Food. They can explicitly enable it later.
8. I save a machine setup and select it during a workout. Changing the profile next week does not alter the setup or load meaning attached to last week's sets.
9. I paste several dated workout notes with set-specific load changes and exercise notes. I correct uncertain fields, confirm per-dumbbell loads and save date-only history without invented duration.
10. I create an unscheduled routine from a reviewed session. It preserves the source order and confirmed targets without altering an existing routine or active workout.
11. Repeating an import action does not duplicate data. A failed save leaves the source and review available for recovery.
12. I export everything and restore into a fresh isolated profile. Records, files, layouts, hidden widgets, system selections, setups and supported drafts survive with their relationships intact.

These are acceptance requirements, not production demo data to seed.

## 33. Deliverables and completion standard

Deliver:

- Working source integrated with the current app.
- A local production build and usable preview instructions.
- Widget-coverage inventory showing where existing visualisations now live.
- Automated tests and recorded results for the applicable scenarios.
- Updated README and schema/migration/backup documentation.
- Documented layout-sharing format, privacy rules and compatibility behaviour.
- Equipment/load-basis and supported pasted-note syntax documentation.
- A short guide to creating/sharing pages and switching systems.
- Clear known limitations and physical-device checks still needed.

Completion requires functional persistence and real workflows, not just a build that succeeds. Layout sharing, the editable combined Overview and independent system switches are release requirements. Each accompanying training addition must also be implemented and verified within its stated scope.

The final report should distinguish implemented/tested, implemented/unverified and incomplete items. State actual test commands/results, migrations, data-protection measures, significant changes and local run instructions. Never claim tests, device behaviour, privacy properties or deployment were verified without evidence.

## 34. Scope boundaries and final execution instruction

Preserve the existing macro-only product requirement. Apple Health, automatic weight import, cloud sync, accounts, a community layout marketplace, a paid AI parser, retailer/nutrition APIs and a new meal-planning/coaching engine are outside this feature.

Do not add unrelated brainstorm ideas to expand the project. Keep existing Gym/Food workflows independently usable and retain existing full-reset/export tools under their current explicit safeguards.

Begin by inspecting the actual project and establishing its baseline. Produce a concise implementation plan, then carry the authorised local implementation through testing, documentation and a reviewable result.

Use sensible defaults, preserve data and make errors recoverable. Keep all publication work for a separately authorised step.
