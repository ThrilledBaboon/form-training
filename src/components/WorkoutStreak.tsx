import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Flame, Leaf, Trophy, ArrowUpRight } from 'lucide-react';
import { useApp, go } from '../lib/context';
import { calendarDays, dateKey, dateLabel } from '../lib/calc';
import { emptyData, type Data } from '../lib/model';
import { STREAK_RULES, systemStreak, type StreakSystem, type WorkoutStreak } from '../lib/streak';
import { systemNames } from '../lib/workspace-model';
import { Button, Modal } from './ui';

export function useWorkoutStreak(data: Data | undefined) {
  return useActivityStreak(data, 'gym');
}

function useActivityStreak(data: Data | undefined, system: StreakSystem) {
  const [tick, setTick] = useState(Date.now);
  useEffect(() => {
    let timer: number;
    const refresh = () => {
      setTick(Date.now());
      clearTimeout(timer);
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 50);
      timer = window.setTimeout(refresh, midnight.getTime() - Date.now());
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  return useMemo(() => systemStreak(data || emptyData, system), [data, system, tick]);
}

export function SystemStreakTrigger({ system }: { system: StreakSystem }) {
  return system === 'gym' ? <StreakTrigger /> : <ActivityStreak system={system} compact />;
}

export function ActivityStreak({
  system,
  compact = false,
}: {
  system: Exclude<StreakSystem, 'gym'>;
  compact?: boolean;
}) {
  const { data } = useApp();
  const streak = useActivityStreak(data, system);
  const [open, setOpen] = useState(false);
  const label = systemNames[system];
  const days = system === 'climbing' ? 'climbing' : 'practice';
  return (
    <>
      <button
        className={compact ? `streak-trigger ${streak.current ? 'has-streak' : ''}` : 'streak-card'}
        aria-label={`Open ${label} streak, ${streak.current} ${days} day${streak.current === 1 ? '' : 's'}`}
        aria-haspopup="dialog"
        title={label + ' streak'}
        onClick={(e) => {
          e.currentTarget.focus();
          setOpen(true);
        }}
      >
        <span className={compact ? undefined : 'streak-card-icon'}>
          <Flame size={compact ? 19 : 23} aria-hidden="true" />
        </span>
        {compact ? (
          <span>{streak.current}</span>
        ) : (
          <>
            <span className="streak-card-copy">
              <strong>
                {streak.current} {days} day{streak.current === 1 ? '' : 's'}
              </strong>
              <span>
                {streak.restDaysLeft} rest day{streak.restDaysLeft === 1 ? '' : 's'} left · best{' '}
                {streak.longest} days
              </span>
            </span>
            <span className="streak-card-link">
              View streak <ArrowUpRight size={17} aria-hidden="true" />
            </span>
          </>
        )}
      </button>
      {open && (
        <ActivityStreakDialog system={system} streak={streak} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

export function StreakTrigger() {
  const { streak, openStreak } = useApp();
  return (
    <button
      className={`streak-trigger ${streak.current ? 'has-streak' : ''}`}
      aria-label={`Open workout streak, ${streak.current} workout day${streak.current === 1 ? '' : 's'}`}
      aria-haspopup="dialog"
      onClick={(e) => {
        e.currentTarget.focus();
        openStreak();
      }}
      title="Workout streak"
    >
      <Flame size={19} aria-hidden="true" />
      <span>{streak.current}</span>
    </button>
  );
}

export function StreakCard() {
  const { streak, openStreak } = useApp();
  return (
    <button
      className="streak-card"
      onClick={(e) => {
        e.currentTarget.focus();
        openStreak();
      }}
      aria-haspopup="dialog"
      aria-label={`View workout streak, ${streak.current} workout days`}
    >
      <span className="streak-card-icon">
        <Flame size={23} aria-hidden="true" />
      </span>
      <span className="streak-card-copy">
        <strong>
          {streak.current} workout day{streak.current === 1 ? '' : 's'}
        </strong>
        <span>
          {streak.restDaysLeft} rest day{streak.restDaysLeft === 1 ? '' : 's'} left · best{' '}
          {streak.longest} days
        </span>
      </span>
      <span className="streak-card-link">
        View streak <ArrowUpRight size={17} aria-hidden="true" />
      </span>
    </button>
  );
}

export function WorkoutStreakDialog({ onClose }: { onClose: () => void }) {
  const { streak } = useApp();
  return <ActivityStreakDialog system="gym" streak={streak} onClose={onClose} />;
}

function ActivityStreakDialog({
  system,
  streak,
  onClose,
}: {
  system: StreakSystem;
  streak: WorkoutStreak;
  onClose: () => void;
}) {
  const title = system === 'gym' ? 'Workout streak' : systemNames[system] + ' streak';
  const sessionName =
    system === 'gym' ? 'workout' : system === 'climbing' ? 'climbing session' : 'practice session';
  const dayName = system === 'gym' ? 'workout' : system === 'climbing' ? 'climbing' : 'practice';
  const dayHeading =
    system === 'gym' ? 'Workout days' : system === 'climbing' ? 'Climbing days' : 'Practice days';
  const [month, setMonth] = useState(() => new Date(streak.today + 'T12:00:00'));
  const [selected, setSelected] = useState(streak.today);
  const grid = calendarDays(month.getFullYear(), month.getMonth());
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const days = grid.slice(0, Math.ceil((offset + last) / 7) * 7);
  const selectedDay = streak.days.get(selected);
  const trainedToday = streak.days.get(streak.today)?.kind === 'workout';
  const changeMonth = (n: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const status = !streak.latestWorkout
    ? `Finish your first ${sessionName} to start your streak.`
    : !streak.current
      ? 'Fresh start. Your longest streak is kept.'
      : trainedToday
        ? `${system === 'gym' ? 'Workout' : 'Session'} logged. Rest is part of your rhythm.`
        : streak.restDaysLeft
          ? 'Streak protected. Today stays open until midnight.'
          : system === 'gym'
            ? 'No rest days left. Train today to keep your streak.'
            : 'Your rest bank is empty. Today stays open until midnight.';
  return (
    <Modal title={title} onClose={onClose} className="streak-modal">
      <div className="streak-summary">
        <div className="streak-stat">
          <span className="streak-stat-icon">
            <Flame size={24} aria-hidden="true" />
          </span>
          <div>
            <strong data-testid="streak-count">{streak.current}</strong>
            <span>{dayHeading}</span>
          </div>
        </div>
        <div className="streak-stat rest">
          <span className="streak-stat-icon">
            <Leaf size={24} aria-hidden="true" />
          </span>
          <div>
            <strong data-testid="streak-rest-balance">
              {streak.restDaysLeft}
              {streak.earnedToday > 0 && <small>+{streak.earnedToday} today</small>}
            </strong>
            <span>Rest days left</span>
          </div>
        </div>
      </div>
      <p className="streak-status" role="status">
        {status}
      </p>
      <div className="streak-calendar" role="group" aria-label="Streak calendar">
        <div className="streak-month-heading">
          <h3 aria-live="polite">
            {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </h3>
          <div>
            <Button
              variant="ghost"
              aria-label="Previous streak month"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft size={20} />
            </Button>
            <Button variant="ghost" aria-label="Next streak month" onClick={() => changeMonth(1)}>
              <ChevronRight size={20} />
            </Button>
          </div>
        </div>
        <div className="streak-weekdays" aria-hidden="true">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
            <span key={i}>{day}</span>
          ))}
        </div>
        <div className="streak-days">
          {days.map((date, i) => {
            const key = dateKey(date);
            const day = streak.days.get(key);
            const previous = i % 7 ? streak.days.get(dateKey(days[i - 1])) : undefined;
            const next = i % 7 < 6 ? streak.days.get(dateKey(days[i + 1])) : undefined;
            const continuesBefore = day && previous?.streakId === day.streakId;
            const continuesAfter = day && next?.streakId === day.streakId;
            const label =
              day?.kind === 'workout'
                ? `${day.workouts} completed ${sessionName}${day.workouts === 1 ? '' : 's'}`
                : day?.kind === 'rest'
                  ? 'protected rest day'
                  : key === streak.today
                    ? `today, no completed ${sessionName} yet`
                    : key > streak.today
                      ? 'future day'
                      : 'no streak activity';
            return (
              <div
                key={key}
                className={`streak-cell ${day ? 'in-streak' : ''} ${continuesBefore ? 'joins-before' : ''} ${continuesAfter ? 'joins-after' : ''}`}
              >
                <button
                  className={`streak-day ${day?.kind || ''} ${date.getMonth() !== month.getMonth() ? 'outside' : ''} ${key === streak.today ? 'is-today' : ''}`}
                  aria-label={`${dateLabel(date.toISOString(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${label}`}
                  aria-current={key === streak.today ? 'date' : undefined}
                  aria-pressed={key === selected}
                  onClick={() => setSelected(key)}
                >
                  <span>{date.getDate()}</span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="streak-legend">
          <span>
            <i className="workout" />
            {dayHeading.replace(' days', ' day')}
          </span>
          <span>
            <i className="rest" />
            Protected rest
          </span>
          <span>
            <i className="today" />
            Today
          </span>
        </div>
      </div>
      <div className="streak-selected" aria-live="polite">
        <div>
          <strong>{dateLabel(selected + 'T12:00:00', { day: 'numeric', month: 'long' })}</strong>
          <p>
            {selectedDay?.kind === 'workout'
              ? `${selectedDay.workouts} finished ${sessionName}${selectedDay.workouts === 1 ? '' : 's'} · counts as 1 streak day`
              : selectedDay?.kind === 'rest'
                ? '1 rest day used to protect your streak'
                : selected > streak.today
                  ? 'No streak activity counted in advance'
                  : selected === streak.today
                    ? 'Today is still open'
                    : 'No recorded streak activity'}
          </p>
        </div>
        {selectedDay?.kind === 'workout' && (
          <Button
            variant="ghost"
            onClick={() => {
              onClose();
              go(
                system === 'gym'
                  ? 'calendar?date=' + selected
                  : system === 'climbing'
                    ? 'climbing-log'
                    : system + '-history',
              );
            }}
            aria-label={
              system === 'gym'
                ? 'View workouts on selected streak day'
                : `View ${systemNames[system]} history`
            }
          >
            <ArrowUpRight size={20} />
          </Button>
        )}
      </div>
      <div className="streak-best">
        <Trophy size={16} aria-hidden="true" />
        <span>Longest streak</span>
        <strong>
          {streak.longest} {dayName} day{streak.longest === 1 ? '' : 's'}
        </strong>
      </div>
      <details className="streak-rules">
        <summary>How your streak works</summary>
        <p>
          {system === 'gym'
            ? 'Finish a workout with at least one completed set to count a day. Multiple workouts on the same day count once, using the workout’s local start date.'
            : system === 'climbing'
              ? 'Finish a climbing session with at least one recorded attempt to count a day. All climbing types count, including sessions without a clean completion. Multiple sessions on the same recorded date count once.'
              : 'Finish a practice session with at least one completed drill set to count a day. Multiple sessions on the same local start date count once. Scores are optional; active sessions and skipped sets do not count.'}
        </p>
        <p>
          Start each streak with {STREAK_RULES.startingRestDays} rest days. Each additional{' '}
          {dayName}
          day earns {STREAK_RULES.earnedPerWorkoutDay} more, up to {STREAK_RULES.maxRestDays} saved
          days. A day without a {sessionName} uses one at midnight. Rest protects your streak; it
          does not increase its count.
        </p>
        <p>
          If the bank is empty and a day ends without a {sessionName}, the next session starts a new
          streak. Past streaks stay on the calendar. Plans and future sessions do not add credit.
          Editing or removing history recalculates the streak. Each system has its own count and
          rest bank.
        </p>
      </details>
    </Modal>
  );
}
