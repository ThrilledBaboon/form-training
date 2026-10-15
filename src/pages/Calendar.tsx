import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Play, CalendarDays, ArrowUpRight } from 'lucide-react';
import { useApp, go } from '../lib/context';
import {
  calendarDays,
  dateKey,
  dayStats,
  dateLabel,
  fmt,
  fromKg,
  sessionStats,
  heatColor,
} from '../lib/calc';
import { startSession, saveSettings } from '../lib/actions';
import { uid, type Routine } from '../lib/model';
import { db } from '../lib/db';
import {
  Card,
  PageTitle,
  SectionTitle,
  Button,
  AsyncButton,
  Empty,
  Modal,
  Field,
  Badge,
} from '../components/ui';
import { ScheduleForm } from './Routines';
export function Calendar() {
  const { data, run, toast } = useApp();
  const q = new URLSearchParams(location.hash.split('?')[1]);
  const initial = q.get('date') || dateKey(new Date());
  const [selected, setSelected] = useState(initial);
  const [month, setMonth] = useState(new Date(initial + 'T12:00:00'));
  const [schedule, setSchedule] = useState(false);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [restNote, setRestNote] = useState('');
  const days = calendarDays(month.getFullYear(), month.getMonth());
  const workouts = data.sessions.filter(
    (s) => s.status === 'completed' && dateKey(s.startAt) === selected,
  );
  const plans = data.plans.filter((p) => p.date === selected && p.status !== 'started');
  const suggestions = data.routines.filter((r) =>
    r.weekdays.includes(new Date(selected + 'T12:00:00').getDay()),
  );
  const stats = dayStats(data, selected);
  const metric = data.settings.calendarMetric;
  const changeMonth = (n: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  return (
    <>
      <PageTitle
        eyebrow="FIND YOUR RHYTHM"
        title="A calendar, with context."
        description="Training days. Rest days. Room for both."
        action={
          <Button onClick={() => setSchedule(true)}>
            <Plus size={17} />
            Plan a day
          </Button>
        }
      />
      <div className="calendar-layout">
        <Card className="calendar-card">
          <div className="calendar-heading">
            <h2>{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
            <div className="inline-actions">
              <Button variant="ghost" aria-label="Previous month" onClick={() => changeMonth(-1)}>
                <ChevronLeft size={19} />
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setMonth(new Date());
                  setSelected(dateKey(new Date()));
                }}
              >
                Today
              </Button>
              <Button variant="ghost" aria-label="Next month" onClick={() => changeMonth(1)}>
                <ChevronRight size={19} />
              </Button>
            </div>
          </div>
          <div className="calendar-controls">
            <Field label="Colour by">
              <select
                value={metric}
                onChange={(e) =>
                  void run(() => saveSettings({ calendarMetric: e.target.value as typeof metric }))
                }
              >
                <option value="sets">Working sets</option>
                <option value="volume">External volume</option>
                <option value="duration">Duration</option>
                <option value="consistency">Training consistency</option>
              </select>
            </Field>
            <Field
              label={`Full colour at (${metric === 'volume' ? 'kg' : metric === 'duration' ? 'minutes' : metric === 'sets' ? 'sets' : 'workouts'})`}
            >
              <input
                aria-label="Calendar colour threshold"
                type="number"
                min={1}
                defaultValue={data.settings.calendarMax}
                key={metric}
                onBlur={(e) => {
                  if (+e.target.value > 0)
                    void run(() => saveSettings({ calendarMax: +e.target.value }));
                }}
              />
            </Field>
          </div>
          <div className="calendar-grid calendar-weekdays">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {days.map((d) => {
              const key = dateKey(d);
              const s = dayStats(data, key);
              const rest = data.plans.some((p) => p.date === key && p.status === 'rest');
              const planned = data.plans.filter(
                (p) => p.date === key && p.status === 'planned',
              ).length;
              const intensity =
                metric === 'consistency'
                  ? s.count
                  : s[metric === 'duration' ? 'duration' : metric === 'volume' ? 'volume' : 'sets'];
              const opacity = Math.min(
                1,
                intensity / (metric === 'consistency' ? 1 : data.settings.calendarMax),
              );
              return (
                <button
                  key={key}
                  className={`calendar-day ${key === selected ? 'selected' : ''} ${d.getMonth() !== month.getMonth() ? 'outside' : ''} ${key === dateKey(new Date()) ? 'is-today' : ''}`}
                  style={
                    s.count
                      ? {
                          background: `color-mix(in srgb, var(--green) ${Math.round(8 + opacity * 35)}%, var(--surface))`,
                        }
                      : undefined
                  }
                  onClick={() => setSelected(key)}
                  aria-label={`${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}, ${s.count} completed workouts, ${planned} planned${rest ? ', rest day' : ''}`}
                  aria-pressed={key === selected}
                >
                  <strong>{d.getDate()}</strong>
                  <div className="day-indicators">
                    {s.count > 0 && (
                      <span className="complete-dot">
                        {s.count}{' '}
                        <span className="desktop-label">session{s.count === 1 ? '' : 's'}</span>
                      </span>
                    )}
                    {planned > 0 && <span className="plan-dot">{planned} planned</span>}
                    {rest && <small>Rest</small>}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="calendar-legend">
            <span>
              <i className="legend-complete" />
              Completed
            </span>
            <span>
              <i className="legend-plan" />
              Planned
            </span>
            <span>
              <i className="legend-rest" />
              Rest day
            </span>
            <span>
              <i />
              No recorded activity
            </span>
          </div>
          <p className="small-text muted">
            Intensity is capped at your threshold, so unusually large sessions do not flatten the
            scale. Volume uses kg internally. Rest days are neutral.
          </p>
        </Card>
        <Card className="calendar-day-detail">
          <span className="eyebrow">THE SELECTED DAY</span>
          <h2>
            {dateLabel(selected + 'T12:00:00', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h2>
          {stats.count > 0 && (
            <div className="day-stats">
              <strong>
                {stats.count}
                <small>workouts</small>
              </strong>
              <strong>
                {stats.sets}
                <small>sets</small>
              </strong>
              <strong>
                {fmt(stats.duration, 0)}
                <small>minutes</small>
              </strong>
            </div>
          )}
          {workouts.map((s) => (
            <a className="day-session" key={s.id} href={`#/history?session=${s.id}`}>
              <Badge>COMPLETED</Badge>
              <h3>{s.name}</h3>
              <p>
                {s.items.length} exercises ·{' '}
                {fmt(fromKg(sessionStats(data, s).volume, data.settings.unit), 0)}{' '}
                {data.settings.unit} external volume <ArrowUpRight size={14} />
              </p>
            </a>
          ))}
          {plans.map((p) => (
            <div className="day-session" key={p.id}>
              <Badge>{p.status === 'rest' ? 'REST DAY' : 'PLANNED'}</Badge>
              <h3>{p.name}</h3>
              <p>{p.notes}</p>
              <div className="inline-actions">
                {p.status === 'planned' && (
                  <AsyncButton
                    variant="secondary"
                    onAction={() =>
                      run(async () => {
                        await startSession(p);
                        go('workout');
                      })
                    }
                  >
                    <Play size={15} />
                    Start
                  </AsyncButton>
                )}
                <AsyncButton
                  variant="ghost"
                  onAction={() =>
                    run(async () => {
                      if (confirm('Remove this plan?')) {
                        await db.plans.delete(p.id);
                        toast('Plan removed', () => db.plans.put(p));
                      }
                    })
                  }
                >
                  Remove
                </AsyncButton>
              </div>
            </div>
          ))}
          {!workouts.length && !plans.length && (
            <Empty title="A little open space" compact>
              No recorded activity. Plan a session, enjoy a rest day, or leave it open.
            </Empty>
          )}
          {suggestions.length > 0 && (
            <div className="weekly-suggestions">
              <small>FROM YOUR WEEKLY SCHEDULE</small>
              {suggestions.map((r) => (
                <button key={r.id} onClick={() => setRoutine(r)}>
                  {r.name}
                  <Plus size={14} />
                </button>
              ))}
            </div>
          )}
          <Button variant="secondary" className="full-width" onClick={() => setSchedule(true)}>
            <Plus size={16} />
            Plan this day
          </Button>
        </Card>
      </div>
      {schedule && (
        <Modal
          title={`Plan ${dateLabel(selected + 'T12:00:00')}`}
          onClose={() => setSchedule(false)}
        >
          <Field label="Date">
            <input type="date" value={selected} onChange={(e) => setSelected(e.target.value)} />
          </Field>
          <h3>Choose a routine</h3>
          <div className="picker-list">
            {data.routines.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setRoutine(r);
                  setSchedule(false);
                }}
              >
                <span>
                  <strong>{r.name}</strong>
                  <small>{r.items.length} exercises</small>
                </span>
                <Plus size={18} />
              </button>
            ))}
          </div>
          <div className="rest-day-form">
            <Field label="Rest day note (optional)">
              <input
                placeholder="A walk, a stretch, a day off…"
                value={restNote}
                onChange={(e) => setRestNote(e.target.value)}
              />
            </Field>
            <AsyncButton
              variant="secondary"
              onAction={() =>
                run(async () => {
                  await db.plans.add({
                    id: uid(),
                    name: 'Rest day',
                    date: selected,
                    status: 'rest',
                    items: [],
                    groups: [],
                    notes: restNote,
                  });
                  setSchedule(false);
                }, 'Rest day planned')
              }
            >
              Plan a rest day
            </AsyncButton>
          </div>
        </Modal>
      )}
      {routine && (
        <ScheduleForm routine={routine} date={selected} onClose={() => setRoutine(null)} />
      )}
    </>
  );
}
