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
