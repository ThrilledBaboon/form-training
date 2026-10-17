# Food in FORM

Open **Food** in the sidebar, **More** on a phone, or the food links on Overview.
Ingredients, recipes, stock, purchases and meals start empty. Existing training history,
routines, streaks and bodyweight records remain in the same database.

## Get started

1. **Ingredients → Add ingredient**: enter the food state and macros per 100 g or 100 ml.
   Blank means unknown. Record whether the information is manual, estimated or verified;
   verified entries require your source. Add package sizes and density/count mass if needed.
2. **Menu → Create recipe**: choose ingredients and quantities for the whole recipe,
   set its serving count, then add instructions, times, equipment, photos and storage notes.
   Ingredient, recipe and purchase editor drafts save locally while editing. Wait for
   **On-device storage** before closing the browser. Save other forms with their Save button.
3. Open a recipe to scale it, inspect whole-recipe versus per-serving macros, and try a
   substitution. Check quantities, units and cooking behaviour, then save a separate
   variation before logging, planning or cooking it.
4. **Food diary** records actual meals. Choose a recipe, prepared batch or a manual meal;
   adjust servings, date, meal slot and notes. Protein, carbohydrate and fat targets can
   each be enabled independently. Batch-entry corrections return/reassign portions.
5. **Kitchen → Add stock** records quantities at home, location, expiry, opening date and
   confidence. **I cooked this recipe** explicitly deducts ingredients and creates prepared
   portions. Viewing, planning or logging an ordinary recipe does not deduct ingredients.
   Eat/discard prepared portions separately.
6. **Meal planner** shows daily/weekly meals alongside actual workouts, dated training
   plans and weekly routines. Copy, move or change meals without consuming stock. Overbooked
   prepared portions are flagged.
7. **Shop this week** aggregates ingredients, subtracts dated usable stock and rounds
   shortages to known package sizes. Manual additions survive regeneration. Edited generated
   items become manual overrides; delete an override and regenerate to resume calculation.
8. **Shopping → Record purchase / receipt**: photograph/upload a receipt, optionally recognise
   text, then correct every line, package size and ingredient match. Explicitly accept total
   differences/possible duplicates. Save the reviewed purchase, then separately **Receive
   purchase into kitchen**. Repeating that receive action does not add stock twice.
9. **Spending** separates checkout totals from estimated consumption, stock and waste costs.
   Ingredient prices are normalised to a common quantity. Budgets are optional; different
   currencies are never converted or totalled together.
10. **Settings & data → Export everything** downloads gym and food data, supported images
    and drafts. Keep a copy outside browser storage. See [backups](BACKUPS.md).

## Quantities and estimates

- Mass (g/kg), volume (ml/l) and count are separate. Cross-dimension conversion needs
  ingredient density or grams per item. There is no universal water-density assumption.
- Raw/cooked/as-sold states must match. There is no cooking-yield conversion. Missing
  nutrition or conversions remain unknown, not zero.
- Recipe amounts describe the whole original recipe. Scaling affects ingredients and totals;
  per-serving values remain per serving. Diary/batch snapshots preserve past macros and costs.
- Stock selection uses earliest expiry, then purchase date and stable ID. Expired or **needs
  checking** packages are excluded. Future plans cannot use stock expiring before their meal
  date. Dates use the browser timezone. Expiry is a planning aid, not a food-safety assessment.
- The app knows only recorded movements. Review stock after unrecorded consumption. Cooking
  fails atomically on insufficient stock and never creates negative balances.
- Estimates use your latest comparable recorded purchase, including recorded discounts.
  Checkout totals count full packages; recipe/stock costs prorate quantities. Missing costs
  stay unknown. Cooking uses actual package cost where complete, otherwise recorded-price estimates.
- Weekly averages use seven calendar days; unlogged days contribute zero **recorded** intake,
  not an assumption that you ate nothing. Unknown macros make affected totals unknown.
  Food/training/bodyweight comparisons describe records and do not establish causation.
- Menu filters cover macros, time, cost, equipment, dietary tags, favourites, usable stock
  and approaching expiry. Sort by missing ingredients for meals needing fewer purchases.
  Ingredient search helps reuse food across recipes. Category/stock substitution ideas are
  not guaranteed equivalent or suitable for an allergy.

## Receipt recognition and limits

English OCR uses bundled Tesseract.js 7 and a local language model. It starts on request.
Engine/model downloads come from the same site and images stay on-device. No paid service,
key or cloud OCR configuration is needed. Files cache after use; first use may need a
connection. Core food workflows work offline after the app shell is cached. Manual entry
remains available, and recognition can be cancelled.

OCR/parsing are suggestions. Abbreviations, discounts, multi-buy layouts and unclear photos
can be misread. Package counts default to one and missing sizes stay blank; review them.
Ingredient identity is never inferred. Duplicate checks use image fingerprints and receipt
signatures; different photos/edits can evade detection. Received purchases are immutable;
record a separate correction and adjust stock rather than rewriting their source.

Shopping rows can also be explicitly received without a receipt, with unknown cost. Use one
receiving path per purchase. A confirmation warns against receiving goods through both a list
and a receipt; these paths are not automatically linked.

Only versioned FORM JSON is restorable; CSV is for analysis. Images support PNG/JPEG/WebP up
to 5 MB each. Backups embed image data rather than ZIP and have a 100 MB limit. PDF/HEIC,
third-party format mapping, barcode lookup, external nutrition databases, a micronutrient
catalogue, live retailer prices/exchange rates, cloud sync, shared accounts and Apple Health
are not implemented. Nutrition/price data must be entered or imported from FORM JSON.
Browser storage can be cleared by the browser; exported files are the independent backup.

Automated Chromium/WebKit checks use synthetic records in isolated profiles. Physical iPhone
camera/install/storage-pressure behaviour and real supermarket OCR accuracy still need
device checks; browser emulation does not establish them.
