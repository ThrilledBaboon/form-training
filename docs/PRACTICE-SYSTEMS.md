# Practice systems

Rocket League is an optional local system. Enable it in **Settings → Systems**, then open its overview or **Drills & routines**. Existing users keep their enabled systems, navigation preferences, pages and history. This system starts off and adds no fabricated results.

**Add starter routines** adds nine editable Rocket League routines: 5-, 10- and 20-minute warm-ups, 12-minute freeplay control, Shooting consistency, Aerial & recovery, Recoveries & boost routes, Ground control & defence and Playlist preparation. Create drills with your own category, tracking metric, setup, focus cue and training pack code/link. Routine blocks support ordered sets, a work timer, an optional count target, rest and a playlist/focus cue. Optional weekdays appear in the combined planner. Practice goals hold sessions per week and your current focus.

The same button adds newly available templates to an existing library. Repeated additions keep each starter once and preserve personal edits, custom routines, goals and sessions. Templates arrive unscheduled and create no practice history. Timings, targets and setups are examples to edit; no external training pack codes are supplied.

Start a routine, pause/resume the persisted timer, record optional results, complete without results, skip, repeat, move on and finish. A timer reaching zero never invents a completion. A session snapshots its routine and drill setup, so library edits do not rewrite history. Work and rest timers continue while away unless paused. Counts are entered manually; no game telemetry or account connection is implied. Unsaved result form edits must be recorded before reloading. History supports result corrections, deletion and Undo.

Home widgets can be moved, removed, styled, used on custom pages and included in shared layouts. Practice balance is recorded work time by category, not an ability score. Progress separates drill, metric, setup, foot and course diagram. Missing scores are omitted. Course time uses lower-is-better; accuracy uses recorded hits/attempts. Weekly goals count completed sessions, rather than sets.

Each practice system also has an independent streak calendar and widget, using finished sessions with at least one completed drill set. Its header flame opens the relevant calendar. Counts, longest streaks and protected rest banks stay separate from gym and climbing; Food has none. See [System streaks](SYSTEM-STREAKS.md) for qualification and rest-day rules.

**Share routine** exports only that routine and its drill dependencies. Review instructions, setup and links before sharing. Personal results, sessions and goals are absent. Import shows a review, creates independent copies, removes scheduled weekdays and is idempotent for the exact same file. Updated files can create new copies. Full backups now use schema 6, accept schema 2–5 through migration, and preserve hidden systems. Category exports include practice data separately. Full replacement, merge conflict checks and reset include the new table.

## Validation

Unit/storage tests cover snapshots, timer reopen/pause/resume, repeated commands, skip/repeat/finish, invalid result rollback, stale edits, sharing, migration, category isolation, merge conflict rollback, goals and disabled systems. Browser checks exercise the actual mobile and desktop flow, accessibility and narrow-screen layout.

## Football

Football has its own independent switch, home, drill library, routines, goals, runner and history. **Add starter routines** adds nine routines: Ball control warm-up, Shooting practice, Dribbling course, Keepy-up challenge, Small-space ball mastery, First touch & passing, Partner passing session, Dribble & finish and Touch, pass & shoot. Every template and target is editable. Routine notes identify space, goal, wall and partner requirements. Search equipment and filter small-space/open-space or solo drills. Each drill stores the foot, equipment, partner requirement and course setup. Cone diagrams support tap-to-add, keyboard Add cone, numbered paths and editable coordinates; enter actual distances in setup because the diagram is a sketch.

Keepy-ups accept individual attempt streaks or a single best. The latest-session summary shows median recorded attempt length and best; missing attempts never become zeros. Shooting and passing accept totals or an optional target map: select the intended zone, then record hit or miss, with Undo. The map represents intended target zones, not tracked ball positions. Left/right summaries only combine the same saved drill and setup; accuracy is weighted by attempts. Course time personal bests use the exact same cone layout, setup and foot.
