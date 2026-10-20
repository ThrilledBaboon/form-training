import { type WorkspacePage, type Widget } from './workspace-model';
import { moveEntry } from './workspace';
export function pageWidgets(page: WorkspacePage, phone = false) {
  const order = phone
    ? [
        ...(page.phoneOrder ?? []),
        ...page.widgets.map((w) => w.id).filter((id) => !page.phoneOrder?.includes(id)),
      ]
    : page.widgets.map((w) => w.id);
  const widgets = order.map((id) => page.widgets.find((w) => w.id === id)!).filter(Boolean);
  return [undefined, ...(page.sections ?? []).map((s) => s.id)].flatMap((section) =>
    widgets.filter((w) => w.sectionId === section),
  );
}
export function movePageWidget(
  page: WorkspacePage,
  source: string,
  target: string,
  phone = false,
): WorkspacePage {
  const widgets = pageWidgets(page, phone);
  const from = widgets.findIndex((w) => w.id === source),
    to = widgets.findIndex((w) => w.id === target);
  if (from < 0 || to < 0) return page;
  const moved = moveEntry(widgets, from, to).map((w) =>
    w.id === source ? { ...w, sectionId: widgets[to].sectionId } : w,
  );
  return phone
    ? {
        ...page,
        phoneOrder: moved.map((w) => w.id),
        widgets: page.widgets.map((w) => moved.find((m) => m.id === w.id)!),
      }
    : { ...page, widgets: moved };
}
export function copyPage(page: WorkspacePage, name: string): WorkspacePage {
  const ids = new Map(page.widgets.map((w) => [w.id, crypto.randomUUID()]));
  return {
    ...structuredClone(page),
    id: crypto.randomUUID(),
    name: name.slice(0, 100),
    revision: 0,
    importedKey: undefined,
    widgets: page.widgets.map((w) => ({ ...structuredClone(w), id: ids.get(w.id)! })),
    phoneOrder: page.phoneOrder?.map((id) => ids.get(id)!),
  };
}
export function widgetPresentation(widget: Widget) {
  return {
    accent: 'theme',
    showTitle: true,
    showDescription: true,
    showExplore: true,
    ...widget.presentation,
  };
}
