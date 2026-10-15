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

## Versions

- IndexedDB v1: core entities and indexes.
- IndexedDB v2: adds the recovery snapshot table and merges missing settings defaults without replacing existing preferences.
- JSON envelope schema v2: `{app: "FORM", schemaVersion: 2, exportedAt, data}`. Unsupported versions are rejected. Additive optional fields remain compatible with v2; defaults are applied by the parser where defined.

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

Muscle analytics index session items and mappings and visit completed sets in linear passes, with per-exercise median sorting. Exercise history groups relevant sets before comparing sessions. A regression fixture exercises 30,000 sets across 1,500 sessions. Records are memoised in views until underlying data changes. The app still loads the local dataset into memory; archive pagination/worker-based aggregation may be useful for substantially larger datasets.
