# Practice systems

Rocket League is an optional local system. Enable it in **Settings → Systems**, then open its overview or **Drills & routines**. Existing users keep their enabled systems, navigation preferences, pages and history. This system starts off and adds no fabricated results.

**Add starter warm-ups** adds editable 5-, 10- and 20-minute templates once. Create drills with your own category, tracking metric, setup, focus cue and training pack code/link. Routine blocks support ordered sets, a work timer, an optional count target, rest and a playlist/focus cue. Optional weekdays appear in the combined planner. Practice goals hold sessions per week and your current focus.

Start a routine, pause/resume the persisted timer, record optional results, complete without results, skip, repeat, move on and finish. A timer reaching zero never invents a completion. A session snapshots its routine and drill setup, so library edits do not rewrite history. Work and rest timers continue while away unless paused. Counts are entered manually; no game telemetry or account connection is implied. Unsaved result form edits must be recorded before reloading. History supports result corrections, deletion and Undo.

Home widgets can be moved, removed, styled, used on custom pages and included in shared layouts. Practice balance is recorded work time by category, not an ability score. Progress separates drill, metric, setup, foot and course diagram. Missing scores are omitted. Course time uses lower-is-better; accuracy uses recorded hits/attempts. Weekly goals count completed sessions, rather than sets.

**Share routine** exports only that routine and its drill dependencies. Review instructions, setup and links before sharing. Personal results, sessions and goals are absent. Import shows a review, creates independent copies, removes scheduled weekdays and is idempotent for the exact same file. Updated files can create new copies. Full backups now use schema 6, accept schema 2–5 through migration, and preserve hidden systems. Category exports include practice data separately. Full replacement, merge conflict checks and reset include the new table.

## Validation

Unit/storage tests cover snapshots, timer reopen/pause/resume, repeated commands, skip/repeat/finish, invalid result rollback, stale edits, sharing, migration, category isolation, merge conflict rollback, goals and disabled systems. Browser checks exercise the actual mobile and desktop flow, accessibility and narrow-screen layout.
