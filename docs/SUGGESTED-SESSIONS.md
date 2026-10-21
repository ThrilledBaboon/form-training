# Suggested sessions

Open **Suggest session** in the Workout actions widget on Overview or the Training home. The preview offers three modes:

- **Progress a routine** keeps the selected routine/dated plan’s exercises and structure. It compares working targets with the last completed session of that routine. Extra accessories are off unless explicitly enabled.
- **Build full body** creates a new session from the exercise library. A compound push, compound pull and compound leg movement are protected. A missing required movement blocks starting, rather than replacing it with isolation work.
- **Cindy** creates a benchmark circuit: 20 minutes of repeating 5 pull-ups, 10 push-ups and 15 air squats. [Standard format reference](https://www.crossfit.com/benchmark/cindy).

Nothing is recorded as completed by generating or replacing a preview. Starting copies the displayed targets into a new active workout. Routine/plan targets and historical records retain their values. Generated sessions have no invented routine or plan identity. An existing active workout must be resumed or finished first.

## Full-body structure and accessories

A chest-oriented compound fills the push slot when an eligible one exists. When required, accessory selection reserves direct chest/shoulder work before other coverage gaps. A chest/shoulders/back preference preset is available under **Suggestion preferences → Priority muscles**. Priorities influence selection without removing the leg slot.

The remaining accessory slots use primary muscle mappings, priority choices, recent recorded coverage, familiarity and scheduling preferences. Coverage sums completed non-warm-up sets from completed conventional gym sessions, weighted by the existing primary/secondary contribution settings. Active, cancelled and future sessions, future set completions, planned targets and benchmark circuits are excluded. Removing or correcting history changes the next preview. This is recorded-work context, not a diagnosis of undertraining or measured recovery.

A 7-, 14- or 28-day window is available. The estimate includes selected exercises when ranking later accessories, so every accessory is not chosen from the same initial gap ranking. No universal target set count is prescribed.

FORM recognises the starter compound names. Custom exercises can explicitly set **Suggested-session role** in the exercise editor: compound push, pull, squat/lunge, hinge or accessory. Unknown exercises default to accessory eligibility; the engine does not classify a curl or fly as a compound merely because its movement label says Pull or Push. Archived and excluded exercises are unavailable.

## Preferences

The preferences panel starts collapsed. Changes affect the current preview; **Save suggestion defaults** persists them locally and includes them in preference backups. Time, mode and today’s readiness appear above the preview. Readiness is a temporary input, not a saved assessment.

- **Balance coverage:** enables recent-work ranking in accessory slots. The full-body foundation remains protected when this is off.
- **Priority muscles:** editable independently of coverage, with a chest/shoulders/back shortcut.
- **Accessory limit:** zero to five added exercises. For a routine this is an opt-in extension, not permission to remove its existing exercises.
- **Time available:** approximate set execution, rests and transitions. New full-body sessions can reduce new working targets to two sets per main movement and trim accessories first. Locked targets and saved routine structure are preserved. An impossible time target produces an explicit estimate/warning.
- **Equipment:** selecting nothing allows any equipment; selected labels are an allowlist. A saved routine that conflicts with equipment/exclusions is preserved and blocked for review rather than silently rewritten.
- **Familiarity:** prefers previously logged exercises, or gives more room to variety. This changes ranking rather than promising a different lift every time.
- **Schedule:** reduces preference for movements appearing in dated/weekly plans over the next three days. Plans are never counted as completed sets.
- **Climbing:** recent completed climbing (today/yesterday) and climbing planned within three days reduce pulling/grip emphasis. The preview explains this context; no attempts are converted into gym sets and no required full-body slot disappears.
- **Readiness:** low energy pauses automatic increases and uses two working sets on newly built exercises. Tired grip or sore legs reduce corresponding selection emphasis and show a review note. Routine exercises remain intact.
- **Progression:** normal uses the existing rep/load rules; conservative builds reps without automatic load increases; off repeats comparable targets. Missing effort information is still identified as unknown.
- **Supersets:** pairs newly suggested accessories. It does not regroup original routine exercises.
- **Warm-ups:** optionally adds warm-up sets to newly built compounds, leaving loads for the user to choose.
- **Explanations:** displays foundation/accessory roles, priority matches and recorded-work estimates. Progression reasons and constraint warnings always remain visible.

**Replace exercise** changes only that slot and keeps other reviewed exercises/targets intact. **Keep [exercise]** locks a choice during regeneration. Conflicting constraints and unavailable alternatives are explained. A replacement cannot turn a full-body compound slot into an accessory.

## Cindy scoring

Cindy uses a separate circuit screen with a persistent deadline-based timer, pause/resume, completed-round button, completed-round count and additional reps in sequence. Starting the timer is explicit. Timer state and score persist through reload/offline use. Score edits merge transactionally, including rapid edits to different fields. Scores can be corrected in history.

Finish saves the circuit with its score. A positive score counts toward the gym workout-day streak and completed-session totals. Circuit rounds do not create conventional strength sets or inflate muscle-coverage/strength progression calculations.

Standard format stays at 20 minutes and 5/10/15. A modified/scaled version has its own description, duration and rep sequence. Best scores compare only matching variant, normalized modification description, duration, rep sequence and exercise/tracking/setup/load snapshots. Modified scores do not replace standard Cindy records. These scores appear on the circuit/history screen; they are not ordinary per-set gym PRs.

Old backups and workouts without these optional fields remain valid. New optional fields live in the existing exercise, settings and routine/plan/session records; no IndexedDB migration or clearing is required. Sharing a circuit template removes scores, timer state and optional private notes. Completed benchmark results remain in complete/category workout backups.

## Validation

Calculation coverage: `tests/session-builder.test.ts`.
Persistence/backup/rollback coverage: `tests/suggestion-storage.test.ts`.
Phone/desktop, accessibility, start/reload/offline and score coverage: `e2e/session-builder.spec.ts` plus the existing suggestion/workout suites.

Run `pnpm test`, `pnpm build`, `pnpm test:e2e` and `pnpm format:check` with the configured Node runtime. Browser tests use isolated synthetic data, never the user’s browser database.
