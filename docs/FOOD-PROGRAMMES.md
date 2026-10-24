# Food programmes

Food → Programmes adds reusable eating patterns to FORM's existing Menu, planner, diary,
shopping and custom pages. Programmes work locally and offline after the app shell is cached.
There is no account synchronisation. A different browser, origin, port or phone has separate data.

## Start the optional filling-bowl programme

1. Open **Food → Programmes → Review starter programme**. Review the reusable content and
   choose **Import programme**. This installs 18 meals, their ingredient choices and one
   programme. It does not start a diet, create diary entries or change your preferences.
2. **View programme** shows the source, food groups, portion guidance, seven-day rotation
   and meal alternatives. **Edit my version** creates a separate editable definition.
3. Choose **Start programme**, review the start date, duration, included meals, optional
   reminders and excluded ingredients. Expand **Preview dated meals** to check the dates.
4. **Start programme & fill empty slots** creates dated plans. The default is three meals
   over 30 inclusive days: 90 eligible plans, less any occupied or excluded slots. Days 29–30
   repeat cycle days 1–2. Existing meals remain intact; activation does not record eating.
5. Use **Swap** on a meal to change just that occurrence. The original definition and other
   days stay intact. **Plan this week** fills empty slots without replacing swaps or meals you
   deliberately deleted. If exclusions leave no choices, build a bowl or edit your version.

Only one active schedule can cover a particular date. Pause/end an overlapping schedule or
choose other dates. Under **My schedules**, pausing stops new generation and programme
reminders but retains already planned meals. Resuming uses the original calendar cycle.
Duration edits change the generation window; they retain existing plans. **Remove future
plans** explicitly removes this schedule's unchecked plans from today, preserving completed
check-ins and unrelated meals. It asks for confirmation. Plans removed deliberately do not
return during regeneration.

## Record what you actually ate

Open **Ingredients & method** on a meal suggestion, or **View meal** on a planned meal, to see
the full ingredient list and numbered cooking steps. The 18 starter meals include individual
preparation directions, optional household portion ideas, equipment and estimated cooking times.
These are independently developed home-cooking guides, not tested publisher recipes. Optional
portion suggestions are not recorded as measured nutrition. Cooking checks follow the
[Food Standards Agency guidance](https://www.food.gov.uk/safety-hygiene/cooking-your-food).

The app refreshes the original generic starter cooking guides automatically. It matches the
original recipe content and ingredient names before updating; edited recipes and separate
copies stay intact. Personal notes, photos, ratings and favourites are retained. Plans and diary
snapshots are not rewritten, and a fresh profile does not receive starter content automatically.

**Ate this** opens a quick check-in: confirm the meal actually eaten, date, slot and optional
notes. Amounts are not required. A quick check-in produces one ordinary diary entry with an
unmeasured flag and a snapshot of the composition. It does not assume a bowl weighs a fixed
amount, calculate calories from guessed portions or deduct kitchen stock.

Unknown nutrition stays unknown. Daily summaries explain that unmeasured meals make totals
incomplete. Calories retain the existing explicit **Show calories** preference; a programme
never enables it or changes macro targets. There is no food streak or compliance score.

For a quantified recipe, explicitly check **I confirm the recipe and portion eaten** and enter
actual servings to count its known recipe nutrition. Changing the recipe/portion updates the
same check-in. Repeated save taps do not add more entries. **Edit check-in** corrects notes,
date, meal or portions. **Undo** removes the diary entry and leaves the plan. Existing recorded
names, composition and nutrition snapshots survive later recipe changes and notes-only edits.
Prepared-batch consumption remains the Kitchen/diary's explicit portion workflow.

## Make your own meals and programmes

**Build a bowl** groups ingredient choices into protein, fruit/vegetables/volume, fat,
flavourings and other foods. Add existing ingredients or create one. All quantities are optional;
leave unknown amounts blank. Guidance such as “half an avocado” can stay text. Enter every
amount with its unit and food state to save a quantified recipe. No universal spoon-to-gram
or raw-to-cooked conversion is assumed. Saved bowls are real Menu meals and can be edited,
photographed, planned and selected in programme rotations.

**Create programme / Edit** controls the name, explanation, source, duration, cycle length,
food groups, optional reminders, default meals and alternate meals for every cycle day/slot.
Leave unwanted slots empty. A programme may use ordinary quantified recipes as well as bowls.
Edits save into local editor drafts while typing. Closing/reloading retains the draft; saving
commits the library entry and clears that editor's draft. Active schedules retain a definition
snapshot, so editing a programme does not silently rewrite their rotation or your diary.
Archiving a definition hides it from the normal library without deleting history.

**Suggest meal** can filter to a programme's collection, including unmeasured meals. Active
programme exclusions apply. Missing amounts, nutrition, cost and time are not scored as zero,
free, instant or fully covered by stock. Programme food lists are guidance, not allergy checks.

## Shopping and widgets

Generate a list through Meal planner or **Shopping → Generate from this week's plan**.
Known amounts use existing shortage/package calculations. Unmeasured ingredients appear in
**Unmeasured ingredients — review quantities**, a separate checklist without invented weights,
prices or receivable stock. An ingredient can have a known requirement plus additional
unmeasured demand. Checklist ticks survive regeneration and reload and do not receive stock.
Manual shopping additions/overrides retain their existing behaviour.

Add **Food programme** using **Edit page → Add widget** on Overview, Food home or a custom
page. It includes the day's meal actions. Configure a specific date or leave it blank to follow
today, and use full/half width and the existing phone settings. New Food home templates include
it; existing personalised layouts are not rewritten. Layout sharing references the recipient's
own programme, without exporting the sender's private schedule. Disabling Food hides its
programme routes/widgets and retains all records for re-enabling and backup.

## Sharing, AI-assisted imports and backups

**Share programme** exports only the selected reusable definitions and required meals,
ingredients and supported embedded images. The file contains no activation, diary, check-ins,
stock, purchases, bodyweight, profile or settings. Choose **Import programme** to review a file.
Exact repeat imports add nothing; conflicting IDs are kept intact unless you explicitly choose
**Import a separate copy**, which remaps the incoming graph. Cancelling/invalid files write nothing.

**Get prompt** copies/downloads the actual schema, synthetic example and reference/unknown-value
rules for an external AI tool. FORM sends nothing to an AI service. Review its generated JSON
through the same importer. Names, guidance and source URLs are treated as data, never commands.

The dedicated envelope is:

```json
{
  "app": "FORM",
  "type": "food-programme-library",
  "schemaVersion": 1,
  "title": "My food programme",
  "exportedAt": "2026-10-24T12:00:00Z",
  "ingredients": [],
  "recipes": [],
  "programmes": [],
  "files": []
}
```

This illustrates the envelope; a valid library requires at least one programme and all referenced
records. Get prompt supplies a complete importable example. Limits include 20 MB/file, 100
programmes, 2,000 meals/ingredients, 28 cycle days and 366 scheduled days. References must resolve
within the file. Unsupported versions are rejected. Supported images retain existing 5 MB limits.

**Export everything** uses backup schema 7, including private schedules/check-ins, archived
programmes and drafts. Category export offers **Food programme library** and **Personal food
programmes & check-ins** with required dependencies. Category files merge; complete replacement
uses the existing transactional recovery snapshot. Versions 2–6 remain readable with missing
programme arrays initialised empty. Older applications reject version 7; keep the app updated
when transferring a new backup. Sharing a programme does not transfer personal history. Diary and meal-plan CSV reports mark
unmeasured rows explicitly and leave their servings blank; JSON retains its internal record multiplier.

## Starter sources and interpretation

The optional starter is independently adapted from [Jeremy Ethier's video](https://www.youtube.com/watch?v=z9cd8jJqELw)
and the supplied [30-Day Filling Diet guide](https://hs-21065354.f.hubspotemail.net/hubfs/21065354/30-Day%20Filling%20Diet%20Final.pdf).
It includes the guide's tuna, tilapia, cabbage, lettuce and spinach alongside the user's chosen
foods. Meals use original preparation notes, not copied publisher photographs or full recipes.
Generic product nutrition is deliberately unrecorded. UK aliases include courgette/zucchini and
prawns/shrimp. Fat portions remain per-choice guidance and include cooking/dressing fats.

This is a flexible user-chosen pattern. The starter explains its restrictive food list and can
be edited to include other foods. Fullness is not evidence of complete nutrition or a guaranteed
weight change. Sparkling drinks, slower eating and broth are optional reminders, unchecked by
default. No litre-of-broth requirement, forced bowl finishing, supplement prescription or
mandatory calorie target is built in. The source does not establish bone broth as equivalent
to the vegetable soup used in its cited study. A particular bowl size is not prescribed.
