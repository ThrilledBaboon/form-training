# Profile and starter plans

Overview offers optional first-use profile setup. Settings → Your profile edits the same details. Birthday, height and starting weight remain private; page-layout sharing excludes them. Goal weight uses the existing bodyweight goal. Saving a starting weight creates one stable weigh-in; editing height does not add measurements. Skip for now is remembered.

Training overview → Generate a plan asks for 1–6 days, a compatible full-body, upper/lower or push/pull/legs split, experience and exact weekdays. Review the exercises, swap any exercise for another with the same tracking type, then save. A new programme and its routines are added together. Existing routines and completed or active sessions stay intact. Previewing and cancelling save nothing. Repeated saves of the same preview add it once, and a storage failure rolls the whole save back.

These are FORM starter templates, not individual coaching. Beginner templates use two working sets; regular templates use three. Repetition exercises use an 8–12 target, comfortable holds use 30 seconds, and rests are 90–120 seconds. No working load is invented. Adjust the template for your equipment and ability. The general set and repetition range is informed by [ACSM resistance training guidance](https://www.acsm.org/docs/default-source/files-for-resource-library/resistance-training-for-health.pdf); the split layouts and exercise selections are app defaults.

Automated checks cover schedule combinations, missing or changed exercises, idempotent saving, storage rollback, profile backup privacy and browser flows in desktop Chromium, mobile Chromium and mobile WebKit. Physical iPhone touch behaviour still needs a device check.

## Food goals and calorie visibility

Food overview → Set food goals asks whether to maintain, lose or gain, then uses age, height, current weight, a chosen equation coefficient and activity level to generate an editable preview. Profile details and the latest weigh-in prefill known values. Missing values remain blank. Changing estimation inputs does not edit the profile or log a new weight. Manual macro targets remain available in Food diary → Set macro targets.

The calorie question defaults to **No**. Only choosing Yes or switching on **Settings → Food preferences → Show calories** reveals energy values. Food overview also has Food display for the same preference. With visibility off, diary cards, recipes, ingredients, meal plans and widgets contain no calorie numbers or calorie target fields. Turning visibility off keeps the background target, macro snapshots and history. Targets can be edited or disabled in the diary; calorie target controls appear only when visibility is on.

Background energy is derived locally from each saved meal snapshot and serving count: protein × 4 + carbohydrates × 4 + fat × 9. Missing any of these makes that entry's energy unknown. Daily and range summaries label any known subtotal as incomplete. This estimate excludes alcohol, fibre and label-specific conversion factors and may differ from packaging. No old food entry is rewritten, and no calorie number is added to workout tracking. Private full backups carry visibility and target preferences; shared page layouts do not.

### Estimate method and limits

FORM uses the simplified [Mifflin–St Jeor resting-energy equation](https://pubmed.ncbi.nlm.nih.gov/2305711/): 10 × kg + 6.25 × cm − 5 × years, plus 5 for the male equation or minus 161 for the female equation. Activity multipliers 1.2, 1.375, 1.55 and 1.725 are broad app defaults, not measured expenditure. Maintenance uses that estimate; loss/gain adjust it by −10%/+10%, with a floor at estimated resting energy. These adjustments do not predict a particular rate of weight change.

Protein starts at 1.6 g/kg (within the exercising-adult range discussed in the [ISSN review](https://link.springer.com/article/10.1186/s12970-018-0242-y)), capped at 30% of estimated energy. Fat uses 30%; carbohydrates receive the remainder. These proportions are editable app defaults. Fibre starts at the [NHS adult guideline of 30 g](https://www.nhs.uk/live-well/eat-well/digestive-health/how-to-get-more-fibre-into-your-diet/). The background 4/4/9 conversion uses the general factors described by [FAO](https://www.fao.org/4/y5686e/y5686e04.htm). Rounding grams can create a small difference between the energy target and energy implied by target macros.

Automatic estimation supports adults aged 18–80 within the form's height/weight bounds and asks whether the general-adult estimate applies. It is not for pregnancy, breastfeeding or prescribed clinical diets. Automatic loss targets are unavailable below BMI 18.5. These checks do not establish that a diet is suitable for an individual; targets remain a starting estimate to review, not a prescription.
