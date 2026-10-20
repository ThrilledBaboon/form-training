import { SuggestMealButton } from '../components/MealSuggestions';
import { useEffect, useState, lazy, Suspense, Fragment } from 'react';
import { personalisation } from '../lib/personalisation';
import { pageWidgets, movePageWidget, copyPage, widgetPresentation } from '../lib/page-design';
import { PageDesign } from '../components/PageDesign';
import { ChartOptionsContext } from '../components/ChartPreferences';
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Settings2,
  Download,
  Upload,
  Home,
  ChevronDown,
} from 'lucide-react';
import { useApp, go } from '../lib/context';
import {
  defaultWorkspace,
  makeWidget,
  overviewPage,
  pageRoute,
  systemForPage,
  systemHomePage,
  systemNames,
  systemHomeNeedsUpdate,
  type Widget,
  type WorkspacePage,
} from '../lib/workspace-model';
import { changeWorkspace, savePage, moveEntry, ensureSystemHomePage } from '../lib/workspace';
import {
  exportLayout,
  parseLayout,
  importLayout,
  referenceMatches,
  type SharedLayout,
} from '../lib/layout-sharing';
import { download } from '../lib/backup';
import {
  PageTitle,
  Card,
  SectionTitle,
  Button,
  AsyncButton,
  Field,
  Modal,
  Empty,
  Badge,
} from '../components/ui';
import {
  WIDGETS,
  widgetDefinition,
  WidgetContent,
  requiredSystems,
  rangeLabel,
  widgetDestination,
} from '../components/Widgets';
import { RangeControls, WidgetEditor } from '../components/WorkspaceControls';
import { FoodGoalBuilder, FoodDisplayPreference } from '../components/FoodGoals';
import { TrainingPlanBuilder } from '../components/TrainingPlanBuilder';
import { useWidgetDrag } from '../components/useWidgetDrag';
const ClimbingSetupButton = lazy(() =>
  import('../components/ClimbingWidgets').then((m) => ({ default: m.ClimbingSetupButton })),
);

export function CustomPages({ overview = false, pageId }: { overview?: boolean; pageId?: string }) {
  const { data, run, toast, pending } = useApp();
  const workspace = data.workspace ?? defaultWorkspace();
  const id = overview
    ? 'overview'
    : (pageId ??
      new URLSearchParams(location.hash.split('?')[1]).get('page') ??
      workspace.homePageId);
  const storedPage = workspace.pages.find((p) => p.id === id);
  const system = systemForPage(id);
  const updateSystemHome = !!storedPage && systemHomeNeedsUpdate(storedPage);
  const [openingFailed, setOpeningFailed] = useState(false);
  const openSystemHome = () => {
    if (system)
      void run(() => ensureSystemHomePage(system)).then((result) => setOpeningFailed(!result));
  };
  useEffect(() => {
    if (system && (!storedPage || updateSystemHome)) openSystemHome();
  }, [system, !!storedPage, updateSystemHome]);
  const [savedPage, setSavedPage] = useState<WorkspacePage>();
  const page =
    storedPage && savedPage?.id === id && savedPage.revision > storedPage.revision
      ? savedPage
      : storedPage;
  const [editing, setEditing] = useState(false),
    [catalog, setCatalog] = useState(false),
    [search, setSearch] = useState('');
  const [configuring, setConfiguring] = useState<Widget | null>(null),
    [manage, setManage] = useState(false),
    [sharing, setSharing] = useState(false);
  const [design, setDesign] = useState(false);
  const [phone, setPhone] = useState(() => matchMedia('(max-width:650px)').matches);
  const [editLayout, setEditLayout] = useState('auto');
  const [sectionTab, setSectionTab] = useState('all');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const phoneMode = editing ? (editLayout === 'auto' ? phone : editLayout === 'phone') : phone;
  useEffect(() => {
    const media = matchMedia('(max-width:650px)');
    const update = () => setPhone(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [layout, setLayout] = useState<SharedLayout | null>(null);
  const [naming, setNaming] = useState<'new' | 'rename' | null>(null),
    [name, setName] = useState(''),
    [template, setTemplate] = useState('empty');
  const commit = async (next: WorkspacePage, message = 'Page saved') => {
    if (!page) throw Error('Page no longer exists.');
    const result = await savePage(next, page.revision);
    const updated = result.pages.find((p) => p.id === page.id)!;
    setSavedPage(updated);
    toast(message, async () => {
      const restored = await savePage({ ...page }, updated.revision);
      setSavedPage(restored.pages.find((p) => p.id === page.id));
    });
  };
  const { drag, handleProps } = useWidgetDrag(editing && !pending, (source, target) => {
    if (!page) return;
    void run(() =>
      commit(
        {
          ...page,
          ...movePageWidget(page, source, target, phoneMode),
        },
        'Widget moved',
      ),
    );
  });
  if (!page)
    if (system)
      return openingFailed ? (
        <Empty
          title="Could not open your page"
          action={<Button onClick={openSystemHome}>Try again</Button>}
        >
          Your saved pages and records are retained. Try opening this page again.
        </Empty>
      ) : (
        <p role="status">Preparing your {system ? systemNames[system] : 'custom'} page…</p>
      );
  if (!page)
    return (
      <Empty
        title="Page unavailable"
        action={<Button onClick={() => go('today')}>Open Overview</Button>}
      >
        This page was removed or the link is incomplete.
      </Empty>
    );
  const visible = page.widgets.filter((w) => requiredSystems(w).every((s) => workspace.systems[s]));
  const ordered = pageWidgets(page, phoneMode).filter(
    (w) => editing || visible.some((v) => v.id === w.id),
  );
  const activeSectionTab = page.sections?.some((s) => s.id === sectionTab) ? sectionTab : 'all';
  const personal = personalisation(data.settings);
  return (
    <div className="personal-page" data-density={page.density ?? personal.density}>
      <PageTitle
        eyebrow={
          system === 'gym'
            ? 'YOUR TRAINING'
            : system === 'food'
              ? 'YOUR FOOD'
              : system === 'climbing'
                ? 'YOUR CLIMBING'
                : system
                  ? systemNames[system].toUpperCase()
                  : 'YOUR WORKSPACE, YOUR VIEW'
        }
        title={overview && page.name === 'Overview' ? 'Make room for progress.' : page.name}
        description={
          overview
            ? 'Your training, climbing and food, arranged around you.'
            : `${page.widgets.length} saved widgets · ${rangeLabel(page.range)}`
        }
        action={
          <div className="inline-actions workspace-actions">
            <Button variant="secondary" onClick={() => setManage(true)}>
              My pages
            </Button>
            <Button onClick={() => setEditing(!editing)}>
              <Pencil size={16} />
              {editing ? 'Done editing' : 'Edit page'}
            </Button>
          </div>
        }
      />
      {system === 'gym' && (
        <div className="food-actions">
          <TrainingPlanBuilder />
          <p className="small-text muted">
            New to training? Build an editable plan around your weekly schedule.
          </p>
        </div>
      )}
      {system === 'climbing' && (
        <div className="food-actions">
          <Suspense fallback={<p role="status">Opening climbing setup…</p>}>
            <ClimbingSetupButton />
          </Suspense>
          <a className="button primary" href="#/climbing-log?new=1">
            Log session
          </a>
          <a className="button secondary" href="#/climbing-library">
            Climb library
          </a>
          <a className="button secondary" href="#/climbing-projects">
            Projects
          </a>
        </div>
      )}
      {system === 'food' && (
        <div className="food-actions">
          <FoodGoalBuilder />
          {!page.widgets.some((w) => w.type === 'suggest-meal') && <SuggestMealButton />}
          <details>
            <summary>Food display</summary>
            <FoodDisplayPreference />
          </details>
        </div>
      )}
      <details className="workspace-page-options">
        <summary>
          <Settings2 size={16} aria-hidden="true" />
          Page options
          <ChevronDown className="page-options-chevron" size={16} aria-hidden="true" />
        </summary>
        <div className="workspace-toolbar">
          <Field label="Current page">
            <select value={page.id} onChange={(e) => go(pageRoute(e.target.value))}>
              {workspace.pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.id === workspace.homePageId ? ' · Home' : ''}
                </option>
              ))}
            </select>
          </Field>
          <RangeControls
            value={page.range}
            label="Page date range"
            onChange={(range) => void run(() => commit({ ...page, range }))}
          />
          <div className="inline-actions">
            <Button variant="secondary" onClick={() => setDesign(true)}>
              Customise page
            </Button>
            <AsyncButton
              variant="secondary"
              onAction={() =>
                run(async () => {
                  const copy = copyPage(page, page.name + ' copy');
                  await savePage(copy, -1);
                  go(pageRoute(copy.id));
                }, 'View saved as a new page')
              }
            >
              Save as new page
            </AsyncButton>
            <Button variant="secondary" onClick={() => setSharing(true)}>
              <Download size={15} />
              Share layout
            </Button>
            <label className="button secondary file-button">
              <Upload size={15} />
              Import layout
              <input
                type="file"
                accept=".json,application/json"
                aria-label="Choose a page layout"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void run(async () => {
                      if (file.size > 500000) throw Error('Layout files are limited to 500 KB.');
                      setLayout(parseLayout(await file.text()));
                    });
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
        {!editing && (
          <p className="workspace-edit-hint">
            Choose <strong>Edit page</strong> to move, resize or remove widgets.
          </p>
        )}
      </details>
      {editing && (
        <div className="workspace-edit-banner">
          <p>
            <strong>Editing {page.name}.</strong> Use <strong>Drag to move</strong> or the arrows to
            reorder. <strong>Remove</strong> takes a widget off this page. Changes save immediately;
            Undo restores the last change.
          </p>
          <Button
            onClick={() => {
              setSearch('');
              setCatalog(true);
            }}
          >
            <Plus size={16} />
            Add widget
          </Button>
        </div>
      )}
      {!visible.length && !editing && (
        <Empty
          title="Make this page your own"
          action={<Button onClick={() => setEditing(true)}>Edit this page</Button>}
        >
          Add widgets or enable Gym, Climbing or Food in Settings. Hidden widgets and all your
          records are retained.
        </Empty>
      )}
      {editing && (
        <div className="page-edit-layout">
          <Field label="Edit layout for">
            <select value={editLayout} onChange={(e) => setEditLayout(e.target.value)}>
              <option value="auto">Current screen</option>
              <option value="desktop">Computer</option>
              <option value="phone">Phone</option>
            </select>
          </Field>
          <p className="small-text muted">
            {phoneMode ? 'Phone' : 'Computer'} order and sizes save separately. Sections are shared
            across layouts; moving between sections changes both.
          </p>
          <AsyncButton
            variant="ghost"
            onAction={() =>
              run(() =>
                commit(
                  {
                    ...page,
                    phoneOrder: undefined,
                    widgets: page.widgets.map((w) => ({ ...w, phoneSize: undefined })),
                  },
                  'Phone layout now follows computer order',
                ),
              )
            }
          >
            Reset phone layout
          </AsyncButton>
        </div>
      )}
      {!!page.sections?.length && page.sectionMode === 'tabs' && !editing && (
        <div className="page-section-tabs" role="group" aria-label="Page sections">
          {[{ id: 'all', title: 'All' }, ...page.sections].map((s) => (
            <Button
              key={s.id}
              variant={activeSectionTab === s.id ? 'primary' : 'secondary'}
              aria-pressed={activeSectionTab === s.id}
              onClick={() => setSectionTab(s.id)}
            >
              {s.title}
            </Button>
          ))}
        </div>
      )}
      <div className={`widget-grid${editing && editLayout === 'phone' ? ' preview-phone' : ''}`}>
        {ordered.map((widget, index) => {
          const missing = requiredSystems(widget).filter((s) => !workspace.systems[s]);
          const meta = widgetDefinition(widget.type);
          const look = widgetPresentation(widget);
          const section = page.sections?.find((s) => s.id === widget.sectionId);
          const first = !!section && ordered[index - 1]?.sectionId !== section.id;
          const closed =
            !editing &&
            page.sectionMode !== 'tabs' &&
            section &&
            (collapsed[section.id] ?? section.collapsed);
          const tabHidden =
            !editing &&
            page.sectionMode === 'tabs' &&
            activeSectionTab !== 'all' &&
            widget.sectionId !== activeSectionTab;
          const move = (to: number) =>
            run(() =>
              commit(movePageWidget(page, widget.id, ordered[to].id, phoneMode), 'Widget moved'),
            );
          return (
            <Fragment key={widget.id}>
              {first && section && page.sectionMode !== 'tabs' && (
                <div className="widget-section">
                  <Button
                    variant="ghost"
                    aria-expanded={!closed}
                    onClick={() => setCollapsed((c) => ({ ...c, [section.id]: !closed }))}
                    disabled={editing}
                  >
                    {section.title}
                    <ChevronDown size={16} />
                  </Button>
                </div>
              )}
              <section
                hidden={!!closed || tabHidden}
                data-widget-id={widget.id}
                tabIndex={-1}
                className={`card workspace-widget widget-size-${widget.size} phone-size-${widget.phoneSize ?? 'full'} widget-accent-${look.accent}${missing.length ? ' widget-disabled' : ''}${drag?.id === widget.id ? ' widget-dragging' : ''}${drag?.target === widget.id && drag.id !== widget.id ? ' widget-drop-target' : ''}`}
                aria-label={widget.title || meta?.[1] || 'Unavailable widget'}
              >
                <div className="widget-heading">
                  <div>
                    <h2 className={!editing && !look.showTitle ? 'widget-title-hidden' : undefined}>
                      {widget.title || meta?.[1] || 'Unavailable widget'}
                    </h2>
                    {(editing || look.showDescription) && (
                      <p>
                        {meta?.[4] === 'range'
                          ? rangeLabel(widget.config.range ?? page.range)
                          : meta?.[4] === 'today'
                            ? (widget.config.date ??
                              (widget.type === 'spending' &&
                              widget.config.spendingPeriod === 'month'
                                ? 'Current month'
                                : widget.type === 'week' ||
                                    widget.type === 'spending' ||
                                    widget.type === 'context'
                                  ? 'Current week'
                                  : 'Today'))
                            : meta?.[4] === 'month'
                              ? 'Selected calendar month'
                              : 'Current saved records'}
                      </p>
                    )}
                  </div>
                  {!editing &&
                    look.showExplore &&
                    meta &&
                    !['start', 'suggestion', 'streak', 'notes', 'shortcut'].includes(
                      widget.type,
                    ) && (
                      <a
                        className="text-link"
                        aria-label={'Explore ' + (widget.title || meta[1])}
                        href={
                          '#/' +
                          widgetDestination({
                            ...widget,
                            config: { ...widget.config, range: widget.config.range ?? page.range },
                          })
                        }
                      >
                        Explore
                      </a>
                    )}
                </div>
                {editing && (
                  <div className="widget-editor-controls">
                    <Button
                      variant="ghost"
                      className="widget-drag-handle"
                      aria-label={'Drag ' + (widget.title || meta?.[1] || 'widget')}
                      title="Drag to reorder, or use the Move up and Move down buttons"
                      disabled={pending}
                      {...handleProps(widget.id)}
                    >
                      <GripVertical size={16} />
                      Drag to move
                    </Button>
                    <AsyncButton
                      variant="ghost"
                      aria-label="Move widget up"
                      title="Move widget up"
                      disabled={index === 0 || pending}
                      onAction={() => move(index - 1)}
                    >
                      <ArrowUp size={16} />
                    </AsyncButton>
                    <AsyncButton
                      variant="ghost"
                      aria-label="Move widget down"
                      title="Move widget down"
                      disabled={index === ordered.length - 1 || pending}
                      onAction={() => move(index + 1)}
                    >
                      <ArrowDown size={16} />
                    </AsyncButton>
                    <Button
                      variant="ghost"
                      aria-label="Configure widget"
                      title="Configure widget"
                      onClick={() => setConfiguring(widget)}
                    >
                      <Settings2 size={16} />
                    </Button>
                    <AsyncButton
                      variant="ghost"
                      aria-label="Duplicate widget"
                      title="Duplicate widget"
                      disabled={pending}
                      onAction={() =>
                        run(() =>
                          commit(
                            {
                              ...page,
                              widgets: [
                                ...page.widgets,
                                { ...structuredClone(widget), id: crypto.randomUUID() },
                              ],
                            },
                            'Widget duplicated',
                          ),
                        )
                      }
                    >
                      <Copy size={16} />
                    </AsyncButton>
                    <AsyncButton
                      variant="ghost"
                      aria-label="Remove widget"
                      className="widget-remove-button"
                      title="Remove this widget from the page; your records are retained"
                      disabled={pending}
                      onAction={() =>
                        run(async () => {
                          await commit(
                            { ...page, widgets: page.widgets.filter((w) => w.id !== widget.id) },
                            'Widget removed; source records retained',
                          );
                          requestAnimationFrame(() => {
                            const next = ordered[index + 1] ?? ordered[index - 1];
                            if (next)
                              document
                                .querySelector<HTMLElement>(
                                  '[data-widget-id="' + CSS.escape(next.id) + '"]',
                                )
                                ?.focus();
                            else
                              document
                                .querySelector<HTMLElement>('.workspace-edit-banner button')
                                ?.focus();
                          });
                        })
                      }
                    >
                      <Trash2 size={16} />
                      Remove
                    </AsyncButton>
                    <select
                      aria-label="Resize widget"
                      value={phoneMode ? (widget.phoneSize ?? 'full') : widget.size}
                      disabled={pending}
                      onChange={(e) =>
                        void run(() =>
                          commit({
                            ...page,
                            widgets: page.widgets.map((w) =>
                              w.id === widget.id
                                ? phoneMode
                                  ? { ...w, phoneSize: e.target.value as Widget['phoneSize'] }
                                  : { ...w, size: e.target.value as Widget['size'] }
                                : w,
                            ),
                          }),
                        )
                      }
                    >
                      {!phoneMode && <option value="compact">Compact</option>}
                      <option value="half">Half</option>
                      <option value={phoneMode ? 'full' : 'wide'}>Full width</option>
                    </select>
                  </div>
                )}
                {missing.length ? (
                  <div className="widget-hidden">
                    <Badge>{missing.join(' + ')} hidden</Badge>
                    <p>
                      This widget keeps its configuration and position. Enable its system in
                      Settings to show it.
                    </p>
                    <a href="#/settings">Open system settings</a>
                  </div>
                ) : (
                  <ChartOptionsContext.Provider value={look.charts}>
                    <WidgetContent widget={widget} range={page.range} />
                  </ChartOptionsContext.Provider>
                )}
              </section>
            </Fragment>
          );
        })}
      </div>
      {configuring && (
        <WidgetEditor
          widget={configuring}
          sections={page.sections}
          onClose={() => setConfiguring(null)}
          onSave={(w) =>
            commit({ ...page, widgets: page.widgets.map((old) => (old.id === w.id ? w : old)) })
          }
        />
      )}
      {catalog && (
        <Modal title="Add a widget" onClose={() => setCatalog(false)} wide>
          <Field label="Find a widget">
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Exercise, macros, shopping…"
            />
          </Field>
          <p>Up to 40 widgets per page. Each copy keeps its own settings.</p>
          <div className="widget-catalog">
            {WIDGETS.filter((w) => !system || w[3] === system || w[3] === 'shared')
              .filter((w) =>
                (w[1] + ' ' + w[2] + ' ' + w[3]).toLowerCase().includes(search.toLowerCase()),
              )
              .map((meta) => (
                <div key={meta[0]}>
                  <Badge>{meta[3]}</Badge>
                  <h3>{meta[1]}</h3>
                  <p>{meta[2]}</p>
                  {requiredSystems(makeWidget(meta[0])).some((s) => !workspace.systems[s]) && (
                    <p className="small-text muted">
                      System disabled; this widget will be hidden until enabled.
                    </p>
                  )}
                  <AsyncButton
                    variant="secondary"
                    disabled={page.widgets.length >= 40}
                    onAction={() =>
                      run(async () => {
                        const w = makeWidget(
                          meta[0],
                          meta[0] === 'macro-trend' ? { metric: 'protein' } : {},
                        );
                        await commit({ ...page, widgets: [...page.widgets, w] }, 'Widget added');
                        setCatalog(false);
                        setConfiguring(w);
                      })
                    }
                  >
                    Add {meta[1]}
                  </AsyncButton>
                </div>
              ))}
          </div>
        </Modal>
      )}
      {manage && (
        <Modal title="Your pages" onClose={() => setManage(false)} wide>
          <p>Choose a home page, arrange your pages, or create a different view.</p>
          {workspace.pages.map((p, index) => (
            <div key={p.id} className="page-manager-row">
              <a href={'#/' + pageRoute(p.id)} onClick={() => setManage(false)}>
                {p.name}
              </a>
              {p.id === workspace.homePageId && <Badge>Home</Badge>}
              <div className="inline-actions">
                <AsyncButton
                  variant="ghost"
                  aria-label={'Make ' + p.name + ' home'}
                  onAction={() =>
                    run(
                      () =>
                        changeWorkspace((w) => {
                          w.homePageId = p.id;
                        }),
                      'Home page saved',
                    )
                  }
                >
                  <Home size={16} />
                </AsyncButton>
                <AsyncButton
                  variant="ghost"
                  aria-label={'Move ' + p.name + ' up'}
                  disabled={index === 0}
                  onAction={() =>
                    run(() =>
                      changeWorkspace((w) => {
                        w.pages = moveEntry(w.pages, index, index - 1);
                      }),
                    )
                  }
                >
                  <ArrowUp size={16} />
                </AsyncButton>
                <AsyncButton
                  variant="ghost"
                  aria-label={'Move ' + p.name + ' down'}
                  disabled={index === workspace.pages.length - 1}
                  onAction={() =>
                    run(() =>
                      changeWorkspace((w) => {
                        w.pages = moveEntry(w.pages, index, index + 1);
                      }),
                    )
                  }
                >
                  <ArrowDown size={16} />
                </AsyncButton>
                <AsyncButton
                  variant="ghost"
                  aria-label={'Duplicate ' + p.name}
                  onAction={() =>
                    run(async () => {
                      const copy = copyPage(p, p.name + ' copy');
                      await savePage(copy, -1);
                    })
                  }
                >
                  <Copy size={16} />
                </AsyncButton>
                {p.id !== 'overview' && !systemForPage(p.id) && (
                  <AsyncButton
                    variant="ghost"
                    aria-label={'Delete ' + p.name}
                    onAction={() =>
                      run(async () => {
                        if (
                          !confirm(
                            'Delete this page? Its records will be retained, and the layout can be restored.',
                          )
                        )
                          return;
                        await changeWorkspace((w) => {
                          w.removedPages = [p, ...w.removedPages].slice(0, 20);
                          w.pages = w.pages.filter((row) => row.id !== p.id);
                          if (w.homePageId === p.id) w.homePageId = 'overview';
                        });
                        if (id === p.id) go('today');
                      }, 'Page removed')
                    }
                  >
                    <Trash2 size={16} />
                  </AsyncButton>
                )}
              </div>
            </div>
          ))}
          <div className="food-actions">
            <Button
              onClick={() => {
                setName('');
                setNaming('new');
                setManage(false);
              }}
            >
              Create page
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setName(page.name);
                setNaming('rename');
                setManage(false);
              }}
            >
              Rename current page
            </Button>
            <AsyncButton
              variant="secondary"
              onAction={() =>
                run(async () => {
                  if (
                    !confirm(
                      `Restore the default ${system === 'gym' ? 'Training overview' : system === 'food' ? 'Food overview' : system === 'climbing' ? 'Climbing overview' : 'Overview'} layout? Your records and other pages stay intact.`,
                    )
                  )
                    return;
                  const template = system ? systemHomePage(system) : overviewPage();
                  const old = workspace.pages.find((p) => p.id === template.id)!;
                  await savePage(template, old.revision);
                  toast('Page template restored', () => savePage(old, old.revision + 1));
                })
              }
            >
              Restore default{' '}
              {system === 'gym'
                ? 'Training overview'
                : system === 'food'
                  ? 'Food overview'
                  : 'Overview'}
            </AsyncButton>
          </div>
          {workspace.removedPages.length > 0 && (
            <details>
              <summary>Recover previous layouts</summary>
              {workspace.removedPages.map((p, index) => (
                <div className="widget-row" key={p.id + '-' + index}>
                  <span>{p.name}</span>
                  <AsyncButton
                    variant="secondary"
                    onAction={() =>
                      run(
                        () =>
                          changeWorkspace((w) => {
                            w.pages.push({
                              ...p,
                              id: crypto.randomUUID(),
                              name: (p.name + ' restored').slice(0, 100),
                              revision: 0,
                            });
                            w.removedPages.splice(index, 1);
                          }),
                        'Layout restored as a new page',
                      )
                    }
                  >
                    Restore
                  </AsyncButton>
                </div>
              ))}
            </details>
          )}
        </Modal>
      )}
      {naming && (
        <Modal
          title={naming === 'new' ? 'Create page' : 'Rename page'}
          onClose={() => setNaming(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (naming === 'rename') await commit({ ...page, name: name.trim() });
                else {
                  const next: WorkspacePage = {
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    range: { days: 30 },
                    revision: 0,
                    widgets:
                      template === 'overview'
                        ? overviewPage().widgets.map((w) => ({ ...w, id: crypto.randomUUID() }))
                        : [],
                  };
                  await savePage(next, -1);
                  go('pages?page=' + next.id);
                }
                setNaming(null);
              });
            }}
          >
            <Field label="Page name">
              <input
                autoFocus
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            {naming === 'new' && (
              <Field label="Start from">
                <select value={template} onChange={(e) => setTemplate(e.target.value)}>
                  <option value="empty">Empty page</option>
                  <option value="overview">Combined Overview template</option>
                </select>
              </Field>
            )}
            <Button type="submit">Save page</Button>
          </form>
        </Modal>
      )}
      {sharing && <ShareLayout page={page} onClose={() => setSharing(false)} />}
      {layout && <ImportLayout layout={layout} onClose={() => setLayout(null)} />}
      {design && (
        <PageDesign
          page={page}
          onClose={() => setDesign(false)}
          onSave={(next) => commit(next, 'Page design saved')}
        />
      )}
    </div>
  );
}
function ShareLayout({ page, onClose }: { page: WorkspacePage; onClose: () => void }) {
  const { data } = useApp();
  const [notes, setNotes] = useState(false);
  const [appearance, setAppearance] = useState(false);
  const text = exportLayout(page, data, notes, appearance);
  return (
    <Modal title="Share page layout" onClose={onClose} wide>
      <p>
        Shares the arrangement and display settings. Recorded workouts, chart points, measurements,
        Food records and equipment profiles are excluded. Titles, reference names and configured
        filter bounds are visible below.
      </p>
      <label className="check-label">
        <input type="checkbox" checked={notes} onChange={(e) => setNotes(e.target.checked)} />
        Include personal note-widget text (off by default)
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={appearance}
          onChange={(e) => setAppearance(e.target.checked)}
        />
        Include my theme, spacing and chart appearance
      </label>
      <p className="small-text muted">
        Personal milestone progress resets to zero for the recipient. Navigation, logging defaults
        and calorie visibility are excluded.
      </p>
      <Field label="Layout file preview">
        <textarea className="layout-json" readOnly rows={12} value={text} />
      </Field>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button onClick={() => download(text, 'form-page-layout.json')}>Download layout</Button>
      </div>
    </Modal>
  );
}
function ImportLayout({ layout, onClose }: { layout: SharedLayout; onClose: () => void }) {
  const { data, run } = useApp();
  const workspace = data.workspace ?? defaultWorkspace();
  const [mappings, setMappings] = useState(() => referenceMatches(layout, data));
  const [copy, setCopy] = useState(false),
    [replace, setReplace] = useState('');
  const [applyAppearance, setApplyAppearance] = useState(false);
  return (
    <Modal title="Review shared layout" onClose={onClose} wide>
      <h3>{layout.page.name}</h3>
      <p>
        {layout.page.widgets.length} widgets · {rangeLabel(layout.page.range)}. This page will show
        your saved records. No domain records or system switches are changed.
      </p>
      {layout.page.widgets.map((widget, index) => {
        const missing = requiredSystems(makeWidget(widget.type, widget.config)).filter(
          (s) => !workspace.systems[s],
        );
        return (
          <div className={'layout-preview-row widget-size-' + widget.size} key={index}>
            <strong>{widget.title || widgetDefinition(widget.type)?.[1] || widget.type}</strong>
            <small>
              {widget.size}
              {!widgetDefinition(widget.type)
                ? ' · unavailable type; retained as a placeholder'
                : ''}
              {missing.length ? ' · ' + missing.join(' + ') + ' disabled; retained hidden' : ''}
            </small>
            {widget.exercise && (
              <Field label={'Match exercise: ' + widget.exercise.name}>
                <select
                  value={mappings[index] ?? ''}
                  onChange={(e) => setMappings({ ...mappings, [index]: e.target.value })}
                >
                  <option value="">Leave unconfigured</option>
                  {data.exercises
                    .filter(
                      (e) => !widget.exercise?.tracking || e.tracking === widget.exercise.tracking,
                    )
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} · {e.equipment}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            {widget.ingredient && (
              <Field label={'Match ingredient: ' + widget.ingredient.name}>
                <select
                  value={mappings[index] ?? ''}
                  onChange={(e) => setMappings({ ...mappings, [index]: e.target.value })}
                >
                  <option value="">Leave unconfigured</option>
                  {data.food?.ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        );
      })}
      <Field label="Import destination">
        <select value={replace} onChange={(e) => setReplace(e.target.value)}>
          <option value="">New page (recommended)</option>
          {workspace.pages.map((p) => (
            <option key={p.id} value={p.id}>
              Replace {p.name}
            </option>
          ))}
        </select>
      </Field>
      {layout.appearance && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={applyAppearance}
            onChange={(e) => setApplyAppearance(e.target.checked)}
          />
          Also use the shared theme and display preferences ({layout.appearance.palette},{' '}
          {layout.appearance.density})
        </label>
      )}
      <label className="check-label">
        <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} />
        Create another copy if this layout was previously imported
      </label>
      <AsyncButton
        onAction={() =>
          run(async () => {
            if (
              replace &&
              !confirm(
                'Replace this page layout? Its previous arrangement will be recoverable. Source records are retained.',
              )
            )
              return;
            const page = await importLayout(layout, mappings, {
              copy,
              applyAppearance,
              replaceId: replace || undefined,
              expectedRevision: workspace.pages.find((p) => p.id === replace)?.revision,
            });
            onClose();
            go(page.id === 'overview' ? 'today' : 'pages?page=' + page.id);
          }, 'Layout imported')
        }
      >
        Import reviewed layout
      </AsyncButton>
    </Modal>
  );
}
