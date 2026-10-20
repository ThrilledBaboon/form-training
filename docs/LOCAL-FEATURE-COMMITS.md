# Local feature commits

The systems expansion was developed on `codex/custom-workspace` in separate commits for integration into `main`; the manual Pages deployment remains separate. The established local preview remains [FORM on port 4174](http://127.0.0.1:4174/). Refresh it and choose **Update & reload** if the update banner appears. Hosted GitHub Pages remains on its published version.

Each feature has its own commit, starting with the original Food system. Later corrections and their regression tests are included with the feature they concern.

| Commit    | Scope                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| `6e4e9a0` | Original local Food, kitchen and shopping system                                                           |
| `404ef76` | Custom workspace, reusable widgets, layout sharing and reviewed workout imports                            |
| `178fe1e` | Pointer dragging for mouse/touch/pen, visible Remove controls, cancellation, keyboard alternative and Undo |
| `ae9f5fd` | Shared Overview outside Train; independent editable Training overview and Food overview                    |
| `d37ed86` | Optional first-use profile and editable birthday, height, starting weight and goal weight                  |
| `07dcd50` | Reviewed training-plan generator with days, splits, weekdays and exercise substitutions                    |
| `4b45093` | Reviewed maintain/lose/gain food goals, fibre targets and explicit calorie display opt-in                  |
| `f766fe7` | Simplify workout action widget and remove the motivational banner                                          |
| `ad6850d` | Compact clickable streak statistics; keep the larger streak calendar                                       |

A separate development-only sample loader was removed before integration into `main`. The app no longer generates or loads fictional personal history. Standard editable exercise and practice routine libraries remain available.

The five new feature commits were individually typechecked from isolated Git snapshots. Their final combined file contents also match the verified production build. The separate documentation commit records these results.

## Where to find the features

- **Overview → Edit page:** Drag to move, arrows, resizing and Remove; Undo restores the previous arrangement. Removing a widget retains its source records.
- **Train → Training overview** and **Food → Food overview:** independent layouts with system-specific widgets and shared bodyweight tools. Both support page editing and layout sharing. Overview remains the combined page.
- **First-use Overview** or **Settings → Your profile:** optional profile details. Skip for now saves no typed measurements. A starting weigh-in is not duplicated by later profile edits; corrections made on Bodyweight are retained.
- **Training overview → Generate a plan:** choose 1–6 days, a compatible split, experience and weekdays, review or swap exercises, then save a new programme and routines. No working loads or completed sessions are invented.
- **Food overview → Set food goals:** review editable macro estimates for maintenance, loss or gain before applying. Details already recorded in the profile/bodyweight history prefill known values.
- **Settings → Food preferences** or **Food overview → Food display:** Show calories defaults to off. The goal questionnaire asks explicitly too. Opting in reveals estimated energy and optional target controls; turning it off preserves history and background targets.

See [onboarding and calculation methods](ONBOARDING.md), [workspace controls and layout sharing](WORKSPACE.md), and [backup rules](BACKUPS.md). Background food energy uses saved macro snapshots and serving counts; incomplete entries remain unknown and known subtotals are labelled. The estimate may differ from packaging.

## Verification

| Check                                                                            | Result                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------- |
| Unit and IndexedDB integration suite                                             | 158 passed                                   |
| TypeScript and root production/PWA build                                         | Passed                                       |
| Independent typecheck of each new feature commit                                 | All 5 passed                                 |
| Root production feature suite: workspace, profile, training plans and food goals | 53 passed, 1 intentional skip                |
| Full production suite at `/form-test/`                                           | 146 passed, 1 intentional skip               |
| Final profile checks with unsaved typed values before Skip, root and subpath     | 6 passed on each path                        |
| Formatting and Git whitespace checks                                             | Passed                                       |
| Established preview, root assets, manifest and worker                            | Successful responses; root artifact retained |

The original full root run also passed 143 checks with one skip before the additional food-portion history regression was added. The final feature runs cover that regression and the profile corrections. The skipped case is Chromium DevTools touch injection under WebKit; mouse, keyboard and other mobile WebKit flows run normally. Trusted touch sequences pass in desktop and mobile Chromium. Phone-width screenshots of all new forms were inspected.

Tests use synthetic records and isolated browser contexts/databases. The user’s browser records were not read or reset. Repository-path builds were served from a temporary output directory so port 4174 kept its root build. Physical iPhone Safari/home-screen use, virtual keyboards and native touch behaviour still require a device check. No Apple Health or automatic weight import was added.
