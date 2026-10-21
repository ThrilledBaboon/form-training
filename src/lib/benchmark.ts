import type { Session } from './model';
import type { Benchmark } from './suggestion-preferences';

export const benchmarkScore = (b: Benchmark) =>
  b.rounds * b.reps.reduce((a, n) => a + n, 0) + b.extraReps;
export const benchmarkFormat = (s: Session) =>
  JSON.stringify([
    s.benchmark?.kind,
    s.benchmark?.variant,
    s.benchmark?.modification?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '',
    s.benchmark?.durationSeconds,
    s.benchmark?.reps,
    s.items.map((i) => [
      i.exerciseId,
      i.tracking,
      i.setup?.id,
      i.setup?.basis,
      i.sets.map((set) => set.loadKg),
    ]),
  ]);
export const benchmarkScoreLabel = (b: Benchmark) =>
  `${b.rounds} ${b.rounds === 1 ? 'round' : 'rounds'} + ${b.extraReps} reps`;
export const benchmarkElapsed = (b: Benchmark, at = Date.now()) =>
  b.elapsedSeconds +
  (b.timerStartedAt ? Math.max(0, (at - Date.parse(b.timerStartedAt)) / 1000) : 0);
