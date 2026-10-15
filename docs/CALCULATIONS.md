# Transparent calculation methods

All values derive from actual saved records. Incomplete sets, cancelled/active sessions and future sessions are excluded from completed-history charts. Warm-ups are excluded unless an analysis explicitly includes them. Exercise histories compare the stored tracking type; use the tracking-type filter to inspect an earlier method after editing an exercise.

## Units and volume

- 1 kg = 2.2046226218487757 lb. Conversion occurs at the input/display boundary, once.
- Conventional external volume = external kg × completed repetitions. Partial reps are supported. Working weighted-rep and loaded-bodyweight sets are included; assistance, bodyweight-only, time and distance are excluded from this kg total.
- Loaded-bodyweight external volume includes external load only. It does not include bodyweight unless separately calculating a clearly labelled relative muscle score for an exercise configured to do so.
- Session volume adds included set volumes once. Repeated exercise identities and superset/circuit membership do not multiply records.
- Volume is a bookkeeping measure, not a scientifically equivalent stimulus across exercises or people.

## Estimated maxes

For weighted external-load sets of 1–12 reps:

- Epley: load × (1 + reps / 30).
- Brzycki: load × 36 / (37 − reps).
- A single repetition returns the actual lifted load for either formula.
- Zero/invalid loads or reps and estimates above 12 reps are withheld. Estimates remain approximate within the accepted range.
- Percentage tables use estimate × percentage / 100, rounded to the display-unit load increment. The reverse calculator accepts a custom percentage.

The selected default formula is configurable. System load and assistance are not silently fed into external-load 1RM estimates.

## Progression and records

Comparison shows changes in external load, repetitions, estimated max, working sets and external volume. A percentage delta is only meaningful if the old denominator is nonzero.

Suggestions use the last comparable session. If at least the planned number of working sets meet the upper rep target, with recorded RPE no higher than the configured threshold and recorded RIR at least 1, a small increase may be suggested for weighted/external-load exercises. If effort was not logged it is unknown, not a measurement. An increase is at least one configured increment, or the configured percentage, rounded to the increment. A >15% repetition drop at the same/lower load suggests maintaining the load. Exercise types without a sensible load increase receive maintain/baseline guidance.

Recommendations are editable suggestions; no plan or recorded result is changed automatically. In the active exercise's notes panel, **Use suggested targets** applies suggested reps, load and rest only to remaining incomplete working sets. Completed sets, warm-ups and saved routines stay intact. A blank planned load may prefill the previous comparable load. An explicit zero target remains zero.

### Suggest a complete session

On Overview, **Your next session → Suggest session** opens a preview before creating a workout. Dated plans and the next weekly routine occurrences are ordered by date, with dated plans first on ties. Weekly suggestions skip planned rest days and occurrences already planned, started or completed for that routine. Past plans are ignored. Other routines remain selectable when they have no upcoming schedule. If no routines contain exercises, the preview links to creating one. A future session can be reviewed early; its start button explicitly says **Start now with these targets**.

The preview compares with the latest completed session of the same routine identity, whether it was last week or another date. Plans without a routine identity require the same ordered exercise identities and tracking types. Cancelled, active and future sessions/sets are excluded. Different occurrences of the same exercise stay separate. Newly added exercises receive their planned baseline rather than borrowing another routine's history.

For repetition exercises with complete working-set history, meeting every upper rep target permits a load increase for weighted/loaded-bodyweight tracking, using the configured percentage and minimum display-unit increment, then returning to the lower rep target. Otherwise, with sufficient completed sets and acceptable recorded effort, reps increase by the configured rep increment up to the upper target while preserving each set's load/assistance. Recorded failure, excessive RPE, zero RIR, or a repetition drop greater than 15% versus the previous matching routine session at the same/lower loads gives hold/review guidance. A decline comparison requires equal set counts. Missing effort ratings are identified as unknown. Incomplete histories retain the routine targets for review. Bodyweight/assisted exercises do not receive automatic load increases; warm-ups, time/distance targets, group membership and rest rules are preserved.

The preview shows the comparison date, previous working sets, proposed sets and the reason for each decision. **Start suggested session** atomically creates a new active workout from the reviewed copy and marks a dated plan started. It does not overwrite saved routine/plan targets or completed history. Unspecified loads remain for the user to choose, without a hidden fill from unrelated history. An existing active workout must be resumed or finished first. The existing exercise-level notes-panel suggestion remains available independently and uses comparable exercise history across routines.

Records include best load, load for a rep count, reps at a load, estimated max, exercise-session external volume, total session reps, completed working-set count, and appropriate duration/distance records. Records derive from history on demand, exclude warm-ups, recalculate after edits/deletions and give the earliest tied achievement ownership of the record. Current records attached to a workout summary are not a fabricated achievement feed.

## Muscle contributions

Each exercise has one mapping per relevant muscle with primary/secondary role and an editable multiplier. For each completed working set:

`muscle set contribution = mapping multiplier × global role factor`

Defaults: primary = 1, secondary = 0.5. Each muscle is calculated independently. A bench set can contribute 1 chest set and 0.5 triceps sets; adding all muscle totals would not represent a unique set count.

The relative volume score uses set magnitude:

- weighted and loaded bodyweight with bodyweight inclusion off: external load × reps; bodyweight and assisted modes without bodyweight inclusion use repetitions;
- bodyweight/loaded/assisted with inclusion explicitly enabled: saved bodyweight + external load, or saved bodyweight − assistance, multiplied by reps;
- duration: seconds; distance: metres.

`relative contribution = clamp(magnitude / exercise median magnitude, 0.25, 3) × muscle set contribution`

Zero magnitude contributes zero relative points. The baseline uses nonzero completed working sets in that exercise, tracking type and bodyweight-inclusion method across the stored history. Adding or correcting history can change the baseline. A duration score and a load score are dimensionless relative measures, not kilograms of physiological muscle stimulus.

The map supports a fixed configurable scale or a scale relative to the largest muscle contribution in the selected period. Grey indicates zero; subsequent bins progress red → orange → yellow → light green → dark green. Numeric totals and individual source sets are available independently of colour.

The selected region also shows daily totals on recorded training days and comparison with the preceding equal-length period. Both periods use the same current mapping factors and full-history median baselines. Frequency counts distinct local training dates. Percentage change is withheld when the previous contribution is zero. All-time mode has no preceding comparison window. In recovery mode the trend remains recorded relative volume before decay, explicitly separate from the recent-load estimate.

## Recent training / estimated recovery

`recent load = relative contribution × 0.5^(hours since session end / configurable half-life)`

Default half-life: 48 hours. Larger/more recent logged contributions raise the estimate. It fades continuously and does not imply a definite recovery state. It ignores sleep, nutrition, illness, injury, individual adaptation and other unrecorded influences. Green means more recent training in this view, not readiness. Use it as a rough planning cue.

## Bodyweight and calendar

Raw bodyweight records are shown individually. A trailing seven-day average includes available records up to the reading, from local midnight six calendar days earlier through the current timestamp; multiple daily readings count individually. No points are invented. Weekly/monthly summary cards use readings in the preceding 7/30 days. Goal distance is absolute kg difference, converted for display. No goal-date prediction is made.

Calendar dates use the browser's local timezone; stored timestamps retain their ISO instant. Counts, working sets, duration or external volume determine daily intensity with an editable cap. Consistency view uses completed-workout presence. A separate planned rest day is neutral. Planned sessions and weekly template suggestions are distinct from actual completed workouts.

## Workout streak and rest-day bank

The streak counts distinct local workout start dates. A finished session must contain at least one completed set; active, cancelled, empty and future sessions/sets do not qualify. Multiple qualifying workouts on one date count once and do not earn extra rest credit. A session crossing midnight belongs to its local start date, consistently with the training calendar.

A new streak starts with 5 rest days. Each additional workout day in the same streak adds 1 rest day, capped at a balance of 7. At local midnight, a day without a qualifying workout spends 1 rest day. Rest protects the streak but does not increase its workout-day count. Today remains open: when the balance reaches zero, a workout today can still extend the streak. If an uncovered day ends, the next workout starts a new streak with the initial allowance.

The monthly view shows green workout days, purple automatically protected rest days, and a today marker. Planned rest days do not bypass the bank or add credit. The longest streak and all historical segments derive from current records. Edits, deletions, undo and imports recalculate them rather than maintaining a separate counter. Calendar-day arithmetic uses local date components and UTC ordinals so daylight-saving days are not assumed to be 24 hours. The display refreshes at local midnight and when the app regains focus or visibility.
