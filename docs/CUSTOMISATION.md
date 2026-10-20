# Make FORM yours

Each browser keeps its own records, pages and preferences. You and your friends can use the same application with different systems, routines and layouts. There are no accounts or automatic device synchronisation; people sharing one browser profile also share its data. Export a full backup before moving to a different browser or address.

## Personal settings

Open **Settings & data → Make FORM yours**. Expand the groups you want to change, then choose **Save customisation**.

- **Spacing, text & feedback:** comfortable, compact or minimal spacing; standard, large or larger text; stronger contrast; optional page descriptions/footer; quiet success feedback. Errors and Undo remain available in quiet mode.
- **Navigation & your words:** rename, reorder and hide navigation links. Settings remains reachable. Hidden links can still be opened directly; hiding a link does not disable a system.
- **Phone shortcuts:** choose up to four bottom-bar destinations. More opens the full navigation. Disabled systems and hidden destinations are omitted.
- **Chart defaults:** area, line or bar; axes, legend, caption and patterns; recorded points or weekly averages; an optional target line in the chart's displayed unit. A global target applies to every trend chart, so use a widget-specific target when charts measure different things.
- **Food display:** choose and order the macros shown in summaries, then show consumed, remaining or both in daily summaries with targets. All recorded macros remain stored. Calories retain their separate explicit opt-in in Food settings.
- **Logging defaults:** open exercise notes by default, choose RPE or RIR for unrated sets, and choose the usual climbing discipline, venue, grade scale and suggested tags. Existing ratings are not converted.
- **Climbing gym colour circuits:** associate an exact venue/grade/scale with a colour. These are personal labels, not numerical grade conversions. The original grade text stays visible.

**Use default customisation** resets the form's draft; save it to apply. It does not clear records, pages, enabled systems or your theme. Concurrent saves from another tab are reported instead of silently overwritten.

## Pages and widgets

Open **Page options → Customise page** on Overview, a system home or a custom page. Choose spacing for that page and create up to twelve named sections. Sections can be collapsible groups or a row of filtering buttons. Unassigned widgets remain at the beginning; **All** shows every section. Removing a section retains its widgets. The initial collapsed state is saved; expanding it while viewing the page is temporary.

Choose **Edit page → Configure widget** to assign its section, title, accent, visible subtitle/Explore link and phone width. Hiding the heading visually preserves the widget's accessible name. Trend widgets can override the chart defaults. Climbing widgets can filter the recorded discipline, venue and tag; use several copies to compare different views.

While editing, **Edit layout for** selects the current screen, Computer or Phone. Move widgets with their drag handles or arrow buttons and change their width. Phone order and widths save separately; section membership and section order are shared across devices. Moving a widget between sections changes that shared membership. **Reset phone layout** makes the phone arrangement follow the computer layout again. Page changes retain Undo.

**Save as new page** keeps the current filters, sections, presentation and both arrangements as another editable view. The existing home-page choice remains available in My pages.

- **My quick actions** holds up to six chosen destinations and uses your navigation names.
- **Personal milestone** shows a manually entered current value, target and unit. Update its progress in Configure widget; it does not infer progress or predict results from your history.

## Share a starting layout

**Page options → Share layout** exports a FORM page-layout file. Version 2 includes sections, both arrangements, widget appearance, filters and optional chart targets. **Include my theme, spacing and chart appearance** optionally adds a display preset. The recipient can import the page without applying that preset; the appearance checkbox starts off.

The file excludes workout, climbing, food and bodyweight records, local record IDs, navigation preferences, logging defaults and calorie visibility. Widget notes remain opt-in. Personal milestone progress resets to zero. Titles, section names, venue/tag filters, targets and reference names are visible in the preview, so review it before sending the file yourself.

Imports create an editable page with fresh identities and optional reference matching. They retain the recipient's navigation, logging and food-display choices. Applying a shared appearance preset changes theme, motion, spacing, text, contrast and chart display together; importing a page alone leaves those global preferences intact. Older version-1 layout files remain accepted. Older app builds that only understand version 1 cannot import a version-2 file and should be updated first.

Full backups include personal settings, pages and records. They are different from layout files and should not be used to share just an arrangement.

## Chart meanings

Weekly grouping averages the numeric points actually recorded in each Monday–Sunday week. It does not sum weekly totals, insert zeroes for missing days or convert grades. Charts without full dates fall back to recorded points and explain why. A target line is a display reference and never changes a saved training or food goal. See [calculation methods](CALCULATIONS.md).

The controls work offline after the app is cached. Phone-sized Chromium and WebKit tests cover the main flows; physical installed-PWA behaviour and a full screen-reader review remain separate checks.
