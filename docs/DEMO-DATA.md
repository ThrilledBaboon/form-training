# Jack's local demo data

Open [Load Jack's demo](http://127.0.0.1:4174/?demo=jack#/today) in the same browser used for FORM. If an older offline version appears, choose **Update & reload**. Alternatively use **Settings & data → Jack demo data → Load Jack’s demo data**. The loader is available only on loopback hosts. It runs in the visiting browser; it does not fill another browser's database.

Loading saves the original complete database in a local recovery snapshot, merges the samples in an atomic transaction, and returns to Overview. Repeated loads do not duplicate data. Normal visits never load samples automatically. Existing records, calorie visibility, layouts and configured goals stay intact. If no name, food targets or budgets exist, illustrative demo defaults fill those gaps. Jack's birthday and height are not invented.

For a load on 18 October 2026, the generated history covers 18 April–18 October 2026:

| Example data                                            |      Count |
| ------------------------------------------------------- | ---------: |
| Completed workouts                                      |        100 |
| Completed sets                                          |      1,537 |
| Weigh-ins                                               |         93 |
| Food diary entries                                      |        726 |
| Routines / programmes                                   |      4 / 1 |
| Recipes / ingredients                                   |    14 / 25 |
| Weekly purchases                                        |         27 |
| Upcoming meal plans                                     |         21 |
| Current stock lines / prepared batches / shopping lists | 18 / 3 / 1 |

The examples include an upper/lower split, gradual load and rep progression, lighter weeks, a holiday, missed sessions, varied meal portions, sample macro targets and fictional GBP prices. Weigh-ins trend from about 84 to 78 kg. These values are synthetic and are not personalised training, nutrition or weight recommendations. Food nutrition is marked estimated. No birth date, health connection or real external prices are used.

**My pages → Jack · six months [Demo]** includes full-period training volume, bench progression, bodyweight, protein and spending charts. Existing Overview and system-home layouts are preserved and also show the added data using their configured ranges.

## Removing samples

Use **Settings & data → Jack demo data → Remove Jack’s demo data**. A snapshot is saved before removal. Removal deletes sample records, including edits to sample records, while keeping original records and subsequently created personal records. Demo library dependencies now used by personal records are retained to keep those records valid. Defaults introduced by the demo are restored only if they have not since been edited. Recovery snapshots remain available for download in Settings.

The loader identifies records by the stable `demo-jack-v1-` namespace, rather than dates or names. It never clears the database. New sessions created from demo routines have their own identifiers and are kept when samples are removed. An import failure rolls back the records, preferences and recovery markers together.

## Export and verification

Run `node scripts/export-jack-demo.mjs 2026-10-18` to generate `.local/jack-demo/jack-six-month-demo.json`, or omit the date for a fresh six-month period ending today. The ignored `.local` folder keeps generated data out of source commits. The Settings panel can also download the generated complete backup. Prefer the demo loader when adding these records to an existing browser, because it also registers the reversible demo load; a manual backup merge does not register that removal information.

Validation: all 164 unit/IndexedDB checks pass, including deterministic generation, schema and reference checks, month-end/DST boundaries, preservation of original and new data, repeated loads, removal and transaction rollback. Production TypeScript/Vite/PWA build passes. Demo load/chart/reload/removal checks pass in desktop Chromium, mobile Chromium and mobile WebKit. Streak/calendar/accessibility and system-toggle browser checks also pass. Screenshots of the populated charts were inspected. These automated checks use isolated browser contexts; they do not establish whether a queued loader tab has executed in the user's browser.

## Compact widgets

The workout action widget keeps Start/Resume and Choose a routine, without the motivational headline or nested hero panel. The streak widget shows workout-day count, remaining rest days and best streak. Clicking it opens the existing larger streak calendar. The two UI changes have separate local commits from the demo loader.
