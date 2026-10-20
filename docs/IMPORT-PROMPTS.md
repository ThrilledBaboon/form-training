# Local import tools

## Workout notes and rules

Open **Routines & plans → Paste workout notes** (also available from workout history). Expand **Note parsing rules** to import, edit, apply or export a rules file. Importing a file only loads its preview; **Apply rules** activates it on this device. **Restore standard rules** returns to the original day-first note format. Rules are also retained by complete and workspace category backups.

Rules files use `app: "FORM"`, `type: "workout-note-rules"`, `schemaVersion: 1`, a name and a rules object. Rules support numeric date order, a default load unit for templates, note prefixes, exact ignored lines, literal replacements, exercise aliases and line templates. Templates match complete trimmed lines with literal separators, for example `{exercise} | {load} | {reps} | {sets}` or `{load} x {reps}`. They cannot execute scripts or regular expressions. Imported rules are size-limited and validated; invalid rules leave the active rules unchanged. Source text remains in the draft for comparison.

**Get prompt** describes all supported fields, limits, placeholder meanings and execution order using the current validator. Supply a representative sample of your notes to an AI tool after that prompt. Review its rules, apply them, then parse your notes. The resulting workouts still require human review, exercise matching and confirmation. Unknown exercise creation remains explicit, duplicate import protection remains active and saving retains Undo.

For a format that does not fit the available templates, expand **Import or export workout JSON**. Its separate **Get prompt** describes a `workout-draft` version 1 file. AI output imports into the same review screen; it cannot pre-confirm workouts or provide local exercise/setup IDs. Exports preserve draft session, exercise and set notes, measurements and load conventions, and omit local mapping and approval fields. Export is unavailable while changed source needs reparsing. Unknown measurements remain blank for review; incomplete history cannot bypass the existing completion checks. Times can remain date-only.

## Other Get prompt buttons

- Gym **Import to library**: exercises, routines and programmes, with relationship and unit rules.
- Football and Rocket League **Drills & routines**: practice library files for that system.
- **Page options** beside Import layout: portable page layouts and the supported widget catalogue.
- **Settings → Export & import selected categories**: food, climbing, bodyweight and other category files. Use merge and review the imported categories and conflicts. Generated files should never require replacing the database.

Prompts contain schema definitions and synthetic examples, without reading your records into the prompt. FORM does not contact an AI service. Copy the prompt or download it as text, then decide what source information to share with your chosen tool. AI-generated files are validated using the same importers as other files; valid JSON alone does not guarantee accurate information.

The schemas are generated from the application's Zod validators; extra instructions explain cross-record references and semantic checks that JSON Schema cannot express. No external AI account or API key is required by FORM.
