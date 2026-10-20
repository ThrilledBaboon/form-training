# Independent activity streaks

Gym, Climbing, Rocket League and Football each have a separate streak calendar, longest streak and rest-day bank. Food has no streak. On a system’s pages, the header flame opens that system’s calendar. Shared pages keep the existing gym shortcut when Gym is enabled.

Each system has a movable, removable streak widget. New system home templates include it. An exact untouched earlier home template gains it once; customised pages keep their layout. Add it manually through **Edit page → Add widget** by searching for **Climbing streak**, **Rocket League streak** or **Football streak**. These widgets can also go on custom pages and travel in shared layouts. They use the full relevant history regardless of the page’s date range.

## Qualifying records

- Gym: a finished workout with at least one completed set, using the local start date.
- Climbing: a completed session with at least one recorded attempt, using its recorded date. Attempts count even without a clean completion. All climbing disciplines contribute to the same climbing streak.
- Rocket League and Football: a finished session with at least one completed drill set, using the local start date. Results and scores are optional.

Multiple sessions on the same day give one streak day and one opportunity to earn rest credit. Active sessions, drafts, skipped-only sessions, planned activities and future sessions give no credit. Each system is calculated from its own history, so editing or removing a session recalculates only the relevant streak. Hiding a system preserves its history.

## Rest days

The previously agreed gym rules apply independently to each system. The first activity day starts a bank of five rest days. Each additional activity day earns one rest day, capped at seven. A completed day without activity spends one rest day; today stays open until local midnight. Protected rest days preserve the streak without increasing its activity-day count. An uncovered full day ends the streak, while the longest streak and past calendar remain visible.

The calendar marks activity, protected rest and today, supports previous/next month and selecting a day, and links to the relevant history. Counts refresh when history changes, at local midnight and when the app regains focus. No streak records or new database migration are needed.

## Verification

Unit/storage coverage checks independent banks, duplicate same-day visits, qualifying and excluded records, corrections, deletion, restart, local-date boundaries, template upgrades and preservation of customised pages. Existing gym tests cover daylight-saving changes, month/year/leap-day boundaries and midnight expiry. Browser coverage checks each calendar and widget, month navigation, protected rest, focus restoration, narrow screens, accessibility, reload persistence, absence on Food and practice-bank expiry without reloading.
