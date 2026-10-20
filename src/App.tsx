import { WeeklyReviewPage } from './components/WeeklyReview';
import { MealSuggestions } from './components/MealSuggestions';
import { WeekPlanner } from './pages/WeekPlanner';
import { CustomPages } from './pages/CustomPages';
import { EquipmentSetups } from './pages/EquipmentSetups';
import { PasteWorkouts } from './pages/PasteWorkouts';
import { defaultWorkspace, routeSystems, pageRoute, systemNames } from './lib/workspace-model';
import { personalisation, navigationRows, linkName } from './lib/personalisation';
import { changeWorkspace, setSystemEnabled } from './lib/workspace';
import { Component, Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  Gamepad2,
  Target,
  Mountain,
  LayoutDashboard,
  Dumbbell,
  CalendarDays,
  Layers,
  BookOpen,
  TrendingUp,
  Activity,
  Scale,
  Trophy,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Menu,
  X,
  ArrowUpRight,
  ShieldCheck,
  Sun,
  Moon,
  Search,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  ChevronRight,
  Utensils,
  Refrigerator,
  ShoppingBasket,
} from 'lucide-react';
import { readData } from './lib/db';
import { saveSettings } from './lib/actions';
import { AppContext, go, type Run } from './lib/context';
import { Today } from './pages/Today';
import { Workout, History } from './pages/Workout';
import { Exercises } from './pages/Exercises';
import { Routines } from './pages/Routines';
import { Progress, Records } from './pages/Progress';
import { Muscles } from './pages/Muscles';
import { Calendar } from './pages/Calendar';
import { Weight } from './pages/Weight';
import { FoodMenu } from './pages/FoodMenu';
import { FoodIngredients } from './pages/FoodIngredients';
import { FoodDiary } from './pages/FoodDiary';
import { FoodKitchen } from './pages/FoodKitchen';
import { FoodPlanner } from './pages/FoodPlanner';
import { FoodShopping } from './pages/FoodShopping';
import { FoodBudget } from './pages/FoodBudget';
import { Button, Empty } from './components/ui';
import { RestTimer } from './components/Timer';
import {
  SystemStreakTrigger,
  WorkoutStreakDialog,
  useWorkoutStreak,
} from './components/WorkoutStreak';
const Climbing = lazy(() =>
  import('./pages/Climbing').then((module) => ({ default: module.Climbing })),
);
const Practice = lazy(() => import('./pages/Practice').then((m) => ({ default: m.Practice })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const navigation = [
  {
    label: 'YOUR WORKSPACE',
    items: [
      ['today', 'Overview', LayoutDashboard],
      ['pages', 'My pages', LayoutDashboard],
      ['week-planner', 'Week planner', CalendarDays],
      ['weekly-review', 'Weekly review', BookOpen],
    ],
  },
  {
    label: 'TRAIN',
    items: [
      ['training-home', 'Training overview', LayoutDashboard],
      ['workout', 'Active workout', Dumbbell],
      ['routines', 'Routines & plans', Layers],
      ['history', 'Workout history', HistoryIcon],
    ],
  },
  {
    label: 'FOOTBALL',
    items: [
      ['football-home', 'Football', Target],
      ['football-library', 'Drills & routines', Layers],
      ['football-session', 'Practice', Target],
      ['football-history', 'Practice history', HistoryIcon],
    ],
  },
  {
    label: 'ROCKET LEAGUE',
    items: [
      ['rocket-league-home', 'Rocket League', Gamepad2],
      ['rocket-league-library', 'Drills & routines', Layers],
      ['rocket-league-session', 'Practice', Gamepad2],
      ['rocket-league-history', 'Practice history', HistoryIcon],
    ],
  },
  {
    label: 'CLIMBING',
    items: [
      ['climbing-home', 'Climbing overview', Mountain],
      ['climbing-log', 'Climbing sessions', HistoryIcon],
      ['climbing-library', 'Climb library', BookOpen],
      ['climbing-projects', 'Climbing projects', Mountain],
    ],
  },
  {
    label: 'FOOD',
    items: [
      ['food-home', 'Food overview', Utensils],
      ['food-menu', 'Menu & recipes', Utensils],
      ['food-suggest', 'Suggest a meal', Utensils],
      ['food-diary', 'Food diary', BookOpen],
      ['food-kitchen', 'Kitchen', Refrigerator],
      ['food-planner', 'Meal planner', CalendarDays],
      ['food-shopping', 'Shopping', ShoppingBasket],
      ['food-budget', 'Food spending', TrendingUp],
      ['food-ingredients', 'Ingredients', Layers],
    ],
  },
  {
    label: 'UNDERSTAND',
    items: [
      ['progress', 'Exercise progress', TrendingUp],
      ['muscles', 'Muscle insights', Activity],
      ['calendar', 'Training calendar', CalendarDays],
      ['weight', 'Bodyweight', Scale],
      ['records', 'Personal records', Trophy],
    ],
  },
  {
    label: 'MANAGE',
    items: [
      ['setups', 'Equipment setups', Dumbbell],
      ['paste-workouts', 'Paste workout notes', BookOpen],
      ['exercises', 'Exercise library', BookOpen],
      ['settings', 'Settings & data', SettingsIcon],
    ],
  },
] as const;
export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: string }> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error)
      return (
        <div className="fatal-error">
          <h1>FORM needs a fresh start.</h1>
          <p>A display error occurred. Your saved database has not been cleared.</p>
          <pre>{this.state.error}</pre>
          <Button onClick={() => location.reload()}>Reload the app</Button>
        </div>
      );
    return this.props.children;
  }
}
export default function App() {
  const result = useLiveQuery(async () => {
    try {
      return { data: await readData(undefined, { includeFiles: false }), error: undefined };
    } catch (error) {
      return { data: undefined, error: String(error) };
    }
  }, []);
  const data = result?.data;
  const streak = useWorkoutStreak(data);
  const [streakOpen, setStreakOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const [hash, setHash] = useState(location.hash);
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    undo?: () => Promise<unknown>;
    error?: boolean;
  }>();
  const [online, setOnline] = useState(navigator.onLine);
  const toast = useCallback(
    (message: string, undo?: () => Promise<unknown>) => setNotice({ message, undo }),
    [],
  );
  const run: Run = useCallback(async function <T>(
    action: () => Promise<T>,
    success?: string,
  ): Promise<T | undefined> {
    setPending((n) => n + 1);
    try {
      const result = await action();
      if (success) setNotice({ message: success });
      return result;
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : String(error), error: true });
      return undefined;
    } finally {
      setPending((n) => n - 1);
    }
  }, []);
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const onHash = () => {
      setHash(location.hash);
      setMenu(false);
      setStreakOpen(false);
      window.scrollTo(0, 0);
    };
    const onNetwork = () => setOnline(navigator.onLine);
    window.addEventListener('hashchange', onHash);
    // A fast navigation can occur while the initial database read is still rendering.
    onHash();
    window.addEventListener('online', onNetwork);
    window.addEventListener('offline', onNetwork);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('online', onNetwork);
      window.removeEventListener('offline', onNetwork);
    };
  }, []);
  useEffect(() => {
    if (!notice || notice.error || notice.undo) return;
    const t = setTimeout(() => setNotice(undefined), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (!pending) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [pending]);
  useEffect(() => {
    if (!data) return;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        data.settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : data.settings.theme;
      document.documentElement.dataset.palette = data.settings.palette;
      const p = personalisation(data.settings);
      document.documentElement.dataset.density = p.density;
      document.documentElement.dataset.textSize = p.textSize;
      document.documentElement.dataset.contrast = p.highContrast ? 'high' : 'normal';
      document.documentElement.dataset.pageDescriptions = p.showPageDescription
        ? 'visible'
        : 'hidden';
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute(
          'content',
          getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
        );
      document.documentElement.classList.toggle('reduced-motion', data.settings.reducedMotion);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [
    data?.settings.theme,
    data?.settings.palette,
    data?.settings.reducedMotion,
    data?.settings.personalisation,
  ]);
  useEffect(() => {
    if (!menu) return;
    const previous = document.activeElement as HTMLElement;
    const aside = document.querySelector('.sidebar') as HTMLElement;
    const focusable = () =>
      [...aside.querySelectorAll<HTMLElement>('a,button')].filter(
        (el) => el.getClientRects().length,
      );
    focusable()[0]?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
      if (e.key === 'Tab') {
        const elements = focusable(),
          first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('keydown', close);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [menu]);

  if (result?.error)
    return (
      <div className="fatal-error">
        <AlertCircle size={32} />
        <h1>Your data store is unavailable.</h1>
        <p>
          FORM could not open browser storage. Check that storage is allowed and free space is
          available, then retry. No successful save is being claimed.
        </p>
        <pre>{result.error}</pre>
        <Button onClick={() => location.reload()}>Retry</Button>
      </div>
    );
  if (!data)
    return (
      <div className="app-loading">
        <span className="wordmark">
          FORM<span>●</span>
        </span>
        <p>Opening your training workspace…</p>
      </div>
    );
  const workspace = data.workspace ?? defaultWorkspace();
  const personal = personalisation(data.settings);
  const navRows = navigationRows(personal);
  const displayNavigation = personal.navigation.length
    ? [
        {
          label: 'YOUR LINKS',
          items: navRows
            .filter((r) => !r.hidden)
            .map((r) => {
              const original = navigation
                .flatMap((n) => [...n.items])
                .find((n) => n[0] === r.route)!;
              return [r.route, r.label, original[2]] as const;
            }),
        },
      ]
    : navigation;
  const homeRoute = pageRoute(workspace.homePageId);
  const effectiveHash = hash || '#/' + homeRoute;
  const route = effectiveHash.replace(/^#\/?/, '').split('?')[0] || 'today';
  const active = data.sessions.find((s) => s.status === 'active');
  const current = linkName(
    personal,
    route,
    navigation.flatMap((n) => [...n.items]).find((n) => n[0] === route)?.[1] || 'Page not found',
  );
  let page: ReactNode;
  switch (route) {
    case 'weekly-review':
      page = <WeeklyReviewPage key={effectiveHash} />;
      break;
    case 'week-planner':
      page = <WeekPlanner key={effectiveHash} />;
      break;
    case 'climbing-log':
    case 'climbing-library':
    case 'climbing-projects':
      page = (
        <Climbing
          key={effectiveHash}
          view={
            route === 'climbing-log' ? 'log' : route === 'climbing-library' ? 'library' : 'projects'
          }
        />
      );
      break;
    case 'football-library':
    case 'football-session':
    case 'football-history':
    case 'rocket-league-library':
    case 'rocket-league-session':
    case 'rocket-league-history':
      page = (
        <Suspense fallback={<p role="status">Opening practice…</p>}>
          <Practice
            system={route.startsWith('football-') ? 'football' : 'rocket-league'}
            view={
              route.endsWith('library')
                ? 'library'
                : route.endsWith('history')
                  ? 'history'
                  : 'session'
            }
          />
        </Suspense>
      );
      break;
    case 'football-home':
    case 'rocket-league-home':
    case 'climbing-home':
    case 'training-home':
    case 'food-home':
      page = <CustomPages key={route} pageId={route} />;
      break;
    case 'pages':
      page = (
        <CustomPages
          key={effectiveHash}
          pageId={new URLSearchParams(effectiveHash.split('?')[1]).get('page') ?? undefined}
        />
      );
      break;
    case 'setups':
      page = <EquipmentSetups key={effectiveHash} />;
      break;
    case 'paste-workouts':
      page = <PasteWorkouts />;
      break;
    case 'food-suggest':
      page = <MealSuggestions />;
      break;
    case 'food-menu':
      page = <FoodMenu key={hash} />;
      break;
    case 'food-ingredients':
      page = <FoodIngredients key={hash} />;
      break;
    case 'food-diary':
      page = <FoodDiary key={hash} />;
      break;
    case 'food-kitchen':
      page = <FoodKitchen key={hash} />;
      break;
    case 'food-planner':
      page = <FoodPlanner key={hash} />;
      break;
    case 'food-shopping':
      page = <FoodShopping key={hash} />;
      break;
    case 'food-budget':
      page = <FoodBudget key={hash} />;
      break;
    case 'today':
      page = <Today />;
      break;
    case 'workout':
      page = <Workout />;
      break;
    case 'routines':
      page = <Routines key={hash} />;
      break;
    case 'history':
      page = <History key={hash} />;
      break;
    case 'exercises':
      page = <Exercises />;
      break;
    case 'progress':
      page = <Progress key={hash} />;
      break;
    case 'muscles':
      page = <Muscles key={hash} />;
      break;
    case 'calendar':
      page = <Calendar key={hash} />;
      break;
    case 'weight':
      page = <Weight key={hash} />;
      break;
    case 'records':
      page = <Records />;
      break;
    case 'settings':
      page = <Settings />;
      break;
    default:
      page = (
        <Empty
          title="A little off track"
          action={<Button onClick={() => go('today')}>Back to overview</Button>}
        >
          This page does not exist. Your training workspace is one tap away.
        </Empty>
      );
  }
  const requestedPage =
    route === 'pages' ? new URLSearchParams(effectiveHash.split('?')[1]).get('page') : undefined;
  const disabled = routeSystems(requestedPage || route).filter((s) => !workspace.systems[s]);
  const streakSystem = routeSystems(requestedPage || route)[0] ?? 'gym';
  const mobileLinks = personal.mobileRoutes
    .map((id) => {
      const original = navigation.flatMap((n) => [...n.items]).find((n) => n[0] === id)!;
      const short =
        (
          { 'training-home': 'Train', 'food-home': 'Food', 'climbing-home': 'Climb' } as Record<
            string,
            string
          >
        )[id] ?? original[1];
      const renamed = personal.navigation.find((r) => r.route === id)?.label;
      return [id, renamed && renamed !== original[1] ? renamed : short, original[2]] as const;
    })
    .filter(
      ([id]) =>
        routeSystems(id).every((s) => workspace.systems[s]) &&
        !navRows.find((r) => r.route === id)?.hidden,
    );
  if (disabled.length)
    page = (
      <Empty
        title={disabled.map((s) => systemNames[s]).join(' and ') + ' is switched off'}
        action={
          <Button
            onClick={() =>
              void run(() => Promise.all(disabled.map((s) => setSystemEnabled(s, true))))
            }
          >
            Enable {disabled.join(' and ')}
          </Button>
        }
      >
        Your records, drafts and saved widgets are retained.{' '}
        <a href="#/today">Return to Overview</a> or <a href="#/settings">open system settings</a>.
      </Empty>
    );
  return (
    <AppContext.Provider
      value={{
        data,
        run,
        toast,
        pending: pending > 0,
        streak,
        openStreak: () => setStreakOpen(true),
      }}
    >
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      <div className="app-shell">
        {menu && (
          <button
            className="sidebar-overlay"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          />
        )}
        <aside
          role={menu ? 'dialog' : undefined}
          aria-modal={menu || undefined}
          aria-label={menu ? 'Navigation' : undefined}
          className={`sidebar ${menu ? 'open' : ''}`}
        >
          <a href="#/today" className="brand">
            <span className="brand-symbol">
              F<span />
            </span>
            <span className="wordmark">
              FORM<span>●</span>
            </span>
          </a>
          {menu && (
            <Button
              className="sidebar-close"
              variant="ghost"
              aria-label="Close navigation menu"
              onClick={() => setMenu(false)}
            >
              <X size={20} />
            </Button>
          )}
          <div className="workspace-label">
            <span className="workspace-dot" />
            YOUR ACTIVE LIFE
          </div>
          <nav aria-label="Main navigation">
            {displayNavigation
              .filter((section) =>
                section.items.some(([id]) => routeSystems(id).every((s) => workspace.systems[s])),
              )
              .map((section) => (
                <div className="nav-section" key={section.label}>
                  <span className="nav-label">{section.label}</span>
                  {section.items
                    .filter(([id]) => routeSystems(id).every((s) => workspace.systems[s]))
                    .map(([id, label, Icon]) => (
                      <a
                        key={id}
                        href={`#/${id}`}
                        aria-current={route === id ? 'page' : undefined}
                        className={route === id ? 'active' : ''}
                      >
                        <Icon size={18} />
                        <span>{label}</span>
                        {id === 'workout' && active && <i className="live-dot" />}
                      </a>
                    ))}
                </div>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="local-note">
              <ShieldCheck size={20} />
              <strong>Just you and your progress.</strong>
              <p>Your workouts stay on this device.</p>
              <a href="#/settings">
                Keep a backup <ArrowUpRight size={13} />
              </a>
            </div>
            <div className="sidebar-profile">
              <span>Y</span>
              <div>
                <strong>Your workspace</strong>
                <small>Personal · local storage</small>
              </div>
              <SettingsIcon size={16} />
            </div>
          </div>
        </aside>
        <div className="main-column" inert={menu}>
          <header className="topbar">
            <div className="topbar-location">
              <Button
                variant="ghost"
                className="mobile-menu"
                aria-label={menu ? 'Close menu' : 'Open menu'}
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
              >
                {menu ? <X size={20} /> : <Menu size={20} />}
              </Button>
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>{current}</strong>
            </div>
            <div className="topbar-actions">
              <span className="save-status">
                <i className={online ? '' : 'offline'} />
                {pending ? 'Saving…' : online ? 'On-device storage' : 'You’re offline'}
              </span>
              {workspace.systems.gym && (
                <button
                  className="icon-button"
                  aria-label="Open exercise search"
                  onClick={() => go('exercises')}
                >
                  <Search size={18} />
                </button>
              )}
              {streakSystem !== 'food' && workspace.systems[streakSystem] && (
                <SystemStreakTrigger key={streakSystem} system={streakSystem} />
              )}
              <button
                className="icon-button"
                aria-label="Toggle colour theme"
                onClick={() =>
                  void run(() =>
                    saveSettings({
                      theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark',
                    }),
                  )
                }
              >
                {document.documentElement.dataset.theme === 'dark' ? (
                  <Sun size={18} />
                ) : (
                  <Moon size={18} />
                )}
              </button>
              <span className="avatar">Y</span>
            </div>
          </header>
          <main id="main-content" tabIndex={-1} key={route}>
            <Suspense fallback={<p role="status">Opening this system…</p>}>{page}</Suspense>
          </main>
          {personal.showFooter && (
            <footer className="app-footer">
              <span>MADE FOR YOUR NEXT PERSONAL BEST.</span>
              <span>FORM · Your training, in focus.</span>
            </footer>
          )}
        </div>
      </div>
      <nav
        className="mobile-nav"
        aria-label="Mobile navigation"
        style={{
          gridTemplateColumns: `repeat(${mobileLinks.length + 1},minmax(0,1fr))`,
        }}
      >
        {mobileLinks.map(([id, label, Icon]) => {
          const I = Icon as typeof Dumbbell;
          return (
            <a key={id as string} className={route === id ? 'active' : ''} href={`#/${id}`}>
              <I size={21} />
              <span>{label as string}</span>
            </a>
          );
        })}
        <button onClick={() => setMenu(!menu)} aria-expanded={menu}>
          <Menu size={21} />
          <span>More</span>
        </button>
      </nav>
      {workspace.systems.gym && <RestTimer />}
      {workspace.systems.gym && streakOpen && (
        <WorkoutStreakDialog onClose={() => setStreakOpen(false)} />
      )}
      {notice && (personal.feedback !== 'quiet' || notice.error || notice.undo) && (
        <div
          className={`toast ${notice.error ? 'error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          {notice.error ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}
          <span>{notice.message}</span>
          {notice.undo && (
            <Button
              variant="ghost"
              onClick={() => {
                const undo = notice.undo!;
                setNotice(undefined);
                void run(undo, 'Change undone');
              }}
            >
              Undo
            </Button>
          )}
          <Button variant="ghost" aria-label="Dismiss message" onClick={() => setNotice(undefined)}>
            <X size={16} />
          </Button>
        </div>
      )}
      {needRefresh && (
        <div className="update-banner">
          <span>A new version is ready. Your records are saved.</span>
          <Button variant="secondary" onClick={() => void updateServiceWorker(true)}>
            Update & reload
          </Button>
        </div>
      )}
      {offlineReady && (
        <span className="sr-only" role="status">
          FORM is cached for offline use.
        </span>
      )}
    </AppContext.Provider>
  );
}
