import { db, type TrainingDB } from './db';
import { uid, now } from './model';
import {
  PracticeDataSchema,
  PracticeResultSchema,
  emptyPractice,
  timerSeconds,
  type PracticeData,
  type PracticeSystem,
  type PracticeRoutine,
  type PracticeResult,
} from './practice-model';
export async function changePractice(
  system: PracticeSystem,
  change: (p: PracticeData) => void,
  database: TrainingDB = db,
  expected?: number,
) {
  return database.transaction('rw', database.practice, async () => {
    const p = PracticeDataSchema.parse(
      (await database.practice.get(system)) ?? emptyPractice(system),
    );
    if (expected !== undefined && p.revision !== expected)
      throw Error('Practice changed in another tab. Review the latest version and try again.');
    change(p);
    p.revision++;
    const checked = PracticeDataSchema.parse(p);
    await database.practice.put(checked);
    return checked;
  });
}
export function savePracticeLibrary(
  system: PracticeSystem,
  library: Pick<PracticeData, 'drills' | 'routines' | 'goal' | 'focus'>,
  expected: number,
  database = db,
) {
  return changePractice(system, (p) => Object.assign(p, library), database, expected);
}
export async function startPractice(system: PracticeSystem, routineId: string, database = db) {
  let sessionId = '';
  await changePractice(
    system,
    (p) => {
      if (p.sessions.some((s) => s.status === 'active'))
        throw Error('Resume or discard your active session first.');
      const routine = p.routines.find((r) => r.id === routineId);
      if (!routine) throw Error('Routine no longer exists.');
      sessionId = uid();
      p.sessions.push({
        id: sessionId,
        name: routine.name,
        routineId,
        startAt: now(),
        status: 'active',
        notes: '',
        cursor: 0,
        entries: routine.blocks.flatMap((block) =>
          Array.from({ length: block.sets }, (_, i) => ({
            id: uid(),
            drill: structuredClone(p.drills.find((d) => d.id === block.drillId)!),
            block: structuredClone(block),
            set: i + 1,
            status: 'pending' as const,
            elapsedSeconds: 0,
          })),
        ),
        timer: {
          phase: 'work',
          elapsedSeconds: 0,
          targetSeconds: routine.blocks[0].seconds,
          runningSince: Date.now(),
        },
      });
    },
    database,
  );
  return sessionId;
}
export type PracticeCommand =
  'pause' | 'resume' | 'complete' | 'skip' | 'repeat' | 'next' | 'finish';
export function practiceCommand(
  system: PracticeSystem,
  sessionId: string,
  entryId: string,
  command: PracticeCommand,
  result?: PracticeResult,
  database = db,
  at = Date.now(),
) {
  return changePractice(
    system,
    (p) => {
      const session = p.sessions.find((s) => s.id === sessionId && s.status === 'active');
      if (!session || session.entries[session.cursor].id !== entryId)
        throw Error('This session moved on in another tab. Review the current block.');
      const entry = session.entries[session.cursor];
      const elapsed = timerSeconds(session, at);
      if (command === 'pause') {
        session.timer.elapsedSeconds = elapsed;
        delete session.timer.runningSince;
        return;
      }
      if (command === 'resume') {
        if (session.timer.runningSince === undefined) session.timer.runningSince = at;
        return;
      }
      if (command === 'finish') {
        if (!session.entries.some((e) => e.status === 'completed'))
          throw Error('Complete at least one block before finishing, or discard this session.');
        session.entries.forEach((e) => {
          if (e.status === 'pending') e.status = 'skipped';
        });
        session.status = 'completed';
        session.endAt = new Date(at).toISOString();
        delete session.timer.runningSince;
        return;
      }
      if (command === 'repeat') {
        if (entry.status === 'pending')
          throw Error('Complete or skip this set before repeating it.');
        const copy = structuredClone(entry);
        copy.id = uid();
        copy.status = 'pending';
        copy.elapsedSeconds = 0;
        delete copy.result;
        session.entries.splice(session.cursor + 1, 0, copy);
      }
      if (command === 'complete' || command === 'skip') {
        if (entry.status !== 'pending' || session.timer.phase !== 'work')
          throw Error('This set is already recorded.');
        entry.status = command === 'complete' ? 'completed' : 'skipped';
        entry.elapsedSeconds = Math.round(elapsed);
        if (command === 'complete') entry.result = PracticeResultSchema.parse(result ?? {});
        session.timer = {
          phase: 'rest',
          elapsedSeconds: 0,
          targetSeconds: entry.block.restSeconds,
          ...(entry.block.restSeconds > 0 ? { runningSince: at } : {}),
        };
        return;
      }
      if (entry.status === 'pending') throw Error('Complete or skip this set before moving on.');
      if (session.cursor + 1 >= session.entries.length)
        throw Error('This was the last block. Finish the session or repeat it.');
      session.cursor++;
      session.timer = {
        phase: 'work',
        elapsedSeconds: 0,
        targetSeconds: session.entries[session.cursor].block.seconds,
        runningSince: at,
      };
    },
    database,
  );
}
export async function deletePracticeSession(
  system: PracticeSystem,
  sessionId: string,
  database = db,
) {
  let removed: PracticeData['sessions'][number] | undefined;
  await changePractice(
    system,
    (p) => {
      removed = p.sessions.find((s) => s.id === sessionId);
      p.sessions = p.sessions.filter((s) => s.id !== sessionId);
    },
    database,
  );
  return async () =>
    changePractice(
      system,
      (p) => {
        if (!removed || p.sessions.some((s) => s.id === removed!.id)) return;
        if (removed.status === 'active' && p.sessions.some((s) => s.status === 'active'))
          throw Error('Finish the new session before restoring this active session.');
        p.sessions.push(removed);
      },
      database,
    );
}
export function quickRoutine(drillId: string, name: string): PracticeRoutine {
  return {
    id: uid(),
    name,
    notes: '',
    weekdays: [],
    blocks: [{ id: uid(), drillId, sets: 1, seconds: 180, target: 0, restSeconds: 0, cue: '' }],
  };
}
