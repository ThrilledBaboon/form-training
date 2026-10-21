import { useEffect, useState } from 'react';
import { useApp } from '../lib/context';
import { updateBenchmark } from '../lib/actions';
import type { Session } from '../lib/model';
import type { Benchmark } from '../lib/suggestion-preferences';
import {
  benchmarkElapsed,
  benchmarkFormat,
  benchmarkScore,
  benchmarkScoreLabel,
} from '../lib/benchmark';
import { AsyncButton, Badge, Field } from './ui';

export function BenchmarkSession({ session }: { session: Session }) {
  const { data, run } = useApp();
  const b = session.benchmark!;
  const active = session.status === 'active';
  const [at, setAt] = useState(Date.now);
  useEffect(() => {
    if (!active || !b.timerStartedAt) return;
    const tick = setInterval(() => setAt(Date.now()), 500);
    return () => clearInterval(tick);
  }, [active, b.timerStartedAt]);
  const remaining = Math.max(
    0,
    b.durationSeconds -
      Math.floor(
        benchmarkElapsed(b, Math.max(at, b.timerStartedAt ? Date.parse(b.timerStartedAt) : 0)),
      ),
  );
  const best = data.sessions
    .filter(
      (s) =>
        s.id !== session.id &&
        s.status === 'completed' &&
        s.benchmark &&
        benchmarkFormat(s) === benchmarkFormat(session) &&
        Date.parse(s.startAt) <= Date.now() &&
        (!s.endAt || Date.parse(s.endAt) <= Date.now()),
    )
    .sort((a, c) => benchmarkScore(c.benchmark!) - benchmarkScore(a.benchmark!))[0];
  const patch = (next: Partial<Benchmark> | ((value: Benchmark) => Partial<Benchmark>)) =>
    run(() => updateBenchmark(session.id, next));
  return (
    <section className="card benchmark-session" aria-label="Cindy circuit">
      <Badge>{b.variant === 'standard' ? 'STANDARD CINDY' : 'MODIFIED CINDY'}</Badge>
      <h2>{Math.round(b.durationSeconds / 60)}-minute AMRAP</h2>
      <ol>
        {session.items.map((item, index) => (
          <li key={item.id}>
            <strong>{b.reps[index]}</strong> {item.name}
          </li>
        ))}
      </ol>
      <p className="small-text muted">
        Repeat in order. Circuit scores stay separate from strength working sets and automatic
        progression.
      </p>
      {active && (
        <>
          <p className="benchmark-timer" role="timer" aria-label="Cindy time remaining">
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
          </p>
          <div className="inline-actions">
            <AsyncButton
              variant="secondary"
              disabled={remaining === 0}
              onAction={() =>
                patch(
                  b.timerStartedAt
                    ? {
                        elapsedSeconds: Math.min(b.durationSeconds, benchmarkElapsed(b)),
                        timerStartedAt: undefined,
                      }
                    : { timerStartedAt: new Date().toISOString() },
                )
              }
            >
              {b.timerStartedAt
                ? 'Pause circuit timer'
                : b.elapsedSeconds
                  ? 'Resume circuit timer'
                  : 'Start circuit timer'}
            </AsyncButton>
            <AsyncButton
              variant="secondary"
              onAction={() => patch((current) => ({ rounds: current.rounds + 1, extraReps: 0 }))}
            >
              Log completed round
            </AsyncButton>
          </div>
          {remaining === 0 && (
            <p className="callout" role="status">
              Time is up. Check your score, then finish the workout to save it to history.
            </p>
          )}
        </>
      )}
      <p className="benchmark-score">{benchmarkScoreLabel(b)}</p>
      <div className="form-grid">
        <Field label="Completed rounds">
          <input
            type="number"
            min={0}
            max={10000}
            step={1}
            value={b.rounds}
            onChange={(e) => {
              const n = +e.target.value;
              if (Number.isInteger(n) && n >= 0 && n <= 10000) void patch({ rounds: n });
            }}
          />
        </Field>
        <Field
          label="Additional reps"
          hint={`Reps after the last full round, in sequence (0–${b.reps.reduce((a, n) => a + n, 0) - 1}).`}
        >
          <input
            type="number"
            min={0}
            max={b.reps.reduce((a, n) => a + n, 0) - 1}
            step={1}
            value={b.extraReps}
            onChange={(e) => {
              const n = +e.target.value;
              if (Number.isInteger(n) && n >= 0 && n < b.reps.reduce((a, n) => a + n, 0))
                void patch({ extraReps: n });
            }}
          />
        </Field>
      </div>
      <p>
        {best
          ? `Best matching format: ${benchmarkScoreLabel(best.benchmark!)}.`
          : 'No earlier score for this exact format yet.'}
      </p>
      <details>
        <summary>Modified version & comparison</summary>
        <p className="small-text muted">
          Use a modified version if you change the movements, assistance or rep format. Only scores
          with the same version, description, duration and rep sequence are compared.
        </p>
        {active ? (
          <>
            <Field label="Cindy version">
              <select
                value={b.variant}
                onChange={(e) =>
                  void patch(
                    e.target.value === 'standard'
                      ? {
                          variant: 'standard',
                          modification: undefined,
                          durationSeconds: 1200,
                          reps: [5, 10, 15],
                          extraReps: Math.min(29, b.extraReps),
                          elapsedSeconds: 0,
                          timerStartedAt: undefined,
                        }
                      : { variant: 'modified' },
                  )
                }
              >
                <option value="standard">Standard</option>
                <option value="modified">Modified / scaled</option>
              </select>
            </Field>
            {b.variant === 'modified' && (
              <>
                <Field
                  label="Modification description"
                  hint="For example: assisted pull-ups and knee push-ups. Use the same description to compare future attempts."
                >
                  <input
                    maxLength={150}
                    value={b.modification ?? ''}
                    onChange={(e) => void patch({ modification: e.target.value })}
                  />
                </Field>
                <Field label="Circuit minutes">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={b.durationSeconds / 60}
                    onChange={(e) => {
                      const n = +e.target.value;
                      if (Number.isInteger(n) && n >= 1 && n <= 120)
                        void patch({
                          durationSeconds: n * 60,
                          elapsedSeconds: 0,
                          timerStartedAt: undefined,
                        });
                    }}
                  />
                </Field>
                <div className="form-grid">
                  {session.items.map((item, index) => (
                    <Field key={item.id} label={`${item.name} reps per round`}>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={b.reps[index]}
                        onChange={(e) => {
                          const n = +e.target.value;
                          if (!Number.isInteger(n) || n < 1 || n > 100) return;
                          const reps = [...b.reps] as Benchmark['reps'];
                          reps[index] = n;
                          void patch({
                            reps,
                            extraReps: Math.min(b.extraReps, reps.reduce((a, v) => a + v, 0) - 1),
                          });
                        }}
                      />
                    </Field>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <p>
            {b.modification ||
              (b.variant === 'standard'
                ? 'Standard format.'
                : 'Modified format; no description recorded.')}
          </p>
        )}
      </details>
    </section>
  );
}
