import { useApp } from '../lib/context';
import { emptyClimbing, climbingGradeGroups } from '../lib/climbing-model';
import { Button } from './ui';
import { go } from '../lib/context';
export function ClimbingWidget({ type, from, to }: { type: string; from: string; to: string }) {
  const { data } = useApp();
  const c = data.climbing ?? emptyClimbing;
  const sessions = c.sessions
    .filter((s) => s.status === 'completed' && s.date >= from && s.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date));
  const drafts = c.sessions.filter((s) => s.status === 'draft');
  if (type === 'climbing-start')
    return (
      <div className="widget-start">
        <Button onClick={() => go(drafts.length ? 'climbing-log' : 'climbing-log?new=1')}>
          {drafts.length ? 'Resume climbing draft' : 'Log climbing session'}
        </Button>
        <a href="#/climbing-library">Manage climb library</a>
        {drafts.length > 0 && <p>{drafts.length} saved drafts</p>}
      </div>
    );
  if (type === 'climbing-projects') {
    const projects = c.climbs.filter((c) => !c.archived && c.project === 'active');
    return (
      <>
        {projects.slice(0, 5).map((p) => (
          <a className="widget-row" href="#/climbing-projects" key={p.id}>
            <span>
              <strong>{p.name}</strong>
              <small>{p.nextTry || p.venue || 'Add beta for your next try'}</small>
            </span>
            <span>{p.grade || 'Ungraded'}</span>
          </a>
        ))}
        {!projects.length && <p>No active projects. Add one in your climb library.</p>}
      </>
    );
  }
  if (type === 'climbing-totals') {
    const entries = sessions.flatMap((s) => s.entries);
    return (
      <>
        <p className="widget-number">
          {sessions.length}
          <small> sessions</small>
        </p>
        <p>
          {entries.reduce((n, e) => n + e.attempts, 0)} attempts ·{' '}
          {entries.filter((e) => e.result === 'completed' || e.result === 'flash').length} clean
          completions · {entries.filter((e) => e.result === 'flash').length} flashes
        </p>
        <p className="small-text muted">
          {sessions
            .filter((s) => s.durationMinutes !== undefined)
            .reduce((n, s) => n + s.durationMinutes!, 0)}{' '}
          recorded minutes across {sessions.filter((s) => s.durationMinutes !== undefined).length}{' '}
          sessions. Missing durations stay unrecorded.
        </p>
      </>
    );
  }
  if (type === 'climbing-grades') {
    const groups = climbingGradeGroups(sessions);
    return (
      <>
        {groups.slice(0, 12).map((g, i) => (
          <div className="widget-row" key={i}>
            <span>
              <strong>{g.grade}</strong>
              <small>{g.label}</small>
            </span>
            <span>
              {g.completions} clean / {g.attempts} attempts
            </span>
          </div>
        ))}
        {!groups.length && <p>Log a session to see attempts and completions by recorded grade.</p>}
        <p className="small-text muted">
          Grouped by type, environment, venue and grade scale. Grades are never converted.
        </p>
      </>
    );
  }
  return (
    <>
      {sessions.slice(0, 5).map((s) => (
        <a href="#/climbing-log" className="widget-row" key={s.id}>
          <span>
            <strong>{s.name}</strong>
            <small>{s.date}</small>
          </span>
          <span>{s.entries.length} climbs</span>
        </a>
      ))}
      {!sessions.length && <p>No completed climbing sessions in this date range.</p>}
    </>
  );
}
