import { useState } from 'react';
import { CircuitGrade } from './ClimbingLabels';
import {
  climbingWallSummary,
  wallStyleName,
  type ClimbingSession,
  type WallStyle,
} from '../lib/climbing-model';

const walls: Record<WallStyle, { path: string; holds: [number, number][]; description: string }> = {
  slab: {
    path: 'M18 180 78 30H126V180Z',
    holds: [
      [31, 155],
      [42, 126],
      [53, 97],
      [65, 66],
      [75, 40],
    ],
    description: 'A wall that leans away from you.',
  },
  vertical: {
    path: 'M62 30H126V180H62Z',
    holds: [
      [62, 155],
      [62, 127],
      [62, 99],
      [62, 71],
      [62, 42],
    ],
    description: 'An upright wall.',
  },
  overhang: {
    path: 'M24 30H126V180H94Z',
    holds: [
      [82, 155],
      [69, 127],
      [55, 99],
      [42, 71],
      [30, 42],
    ],
    description: 'A wall that leans out towards you.',
  },
  roof: {
    path: 'M16 30H126V180H98V66H16Z',
    holds: [
      [98, 155],
      [98, 125],
      [98, 93],
      [77, 66],
      [48, 66],
      [23, 66],
    ],
    description: 'Climbing beneath a horizontal ceiling.',
  },
};

export function ClimbingWallMap({ sessions }: { sessions: ClimbingSession[] }) {
  const [selected, select] = useState<WallStyle>('slab');
  const { rows, untagged } = climbingWallSummary(sessions);
  const max = Math.max(1, ...rows.map((r) => r.attempts));
  const row = rows.find((r) => r.style === selected)!;
  const entries = sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((s) =>
      s.entries
        .filter((e) => e.snapshot.wallStyle === selected)
        .map((e) => ({ session: s, entry: e })),
    );
  return (
    <div className="climbing-wall-map">
      <p className="small-text muted">
        {rows.filter((r) => r.attempts > 0).length} of 4 wall styles explored. Stronger shading
        means more recorded attempts.
      </p>
      <div className="climbing-wall-grid" role="group" aria-label="Choose a wall style">
        {rows.map((r) => (
          <button
            key={r.style}
            type="button"
            className="climbing-wall-button"
            aria-pressed={selected === r.style}
            onClick={() => select(r.style)}
          >
            <svg viewBox="0 0 144 206" aria-hidden="true" focusable="false">
              <path d="M8 182H136" fill="none" stroke="var(--line)" strokeWidth="2" />
              <path
                d={walls[r.style].path}
                fill="var(--surface-alt)"
                stroke="var(--anatomy-stroke)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d={walls[r.style].path}
                fill="var(--green)"
                fillOpacity={r.attempts ? 0.14 + (r.attempts / max) * 0.6 : 0}
              />
              {walls[r.style].holds.map(([x, y], i) => (
                <ellipse
                  key={i}
                  cx={x}
                  cy={y}
                  rx={4}
                  ry={2.7}
                  fill="var(--ink)"
                  opacity={r.attempts ? 0.8 : 0.25}
                />
              ))}
            </svg>
            <strong>{wallStyleName[r.style]}</strong>
            <span>{r.attempts} attempts</span>
          </button>
        ))}
      </div>
      <div className="climbing-wall-detail" aria-live="polite" aria-atomic="true">
        <h3>{wallStyleName[selected]}</h3>
        <p className="small-text muted">{walls[selected].description}</p>
        <p>
          {row.climbs} {row.climbs === 1 ? 'climb' : 'climbs'} · {row.attempts} attempts ·{' '}
          {row.completions} clean completions · {row.flashes} flashes
        </p>
        {entries.slice(0, 5).map(({ session, entry }) => (
          <a
            className="widget-row"
            key={session.id + entry.id}
            href={'#/climbing-log?session=' + encodeURIComponent(session.id)}
          >
            <span>
              <strong>{entry.snapshot.name}</strong>
              <small>
                {session.date} · {entry.snapshot.venue || 'Venue unspecified'} ·{' '}
                <CircuitGrade climb={entry.snapshot} /> {entry.snapshot.gradeScale}
              </small>
            </span>
            <span>
              {entry.attempts} {entry.attempts === 1 ? 'try' : 'tries'}
            </span>
          </a>
        ))}
        {!entries.length && (
          <p>
            No completed sessions with {wallStyleName[selected].toLowerCase()} climbs in this date
            range.
          </p>
        )}
        {entries.length > 5 && (
          <p className="small-text muted">
            Showing the 5 most recent entries across {row.sessions} sessions.
          </p>
        )}
      </div>
      {untagged > 0 && (
        <p className="small-text muted">
          {untagged} {untagged === 1 ? 'entry has' : 'entries have'} no wall style recorded. Edit
          those session entries to include them on the map.
        </p>
      )}
      <a href="#/climbing-library">Tag climbs in your library</a>
    </div>
  );
}
