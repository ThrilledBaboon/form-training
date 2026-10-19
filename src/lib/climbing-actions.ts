import { db, type TrainingDB } from './db';
import { now, uid } from './model';
import { foodDay } from './food-calc';
import {
  ClimbingDataSchema,
  emptyClimbing,
  type ClimbingData,
  type Climb,
  type ClimbingSession,
  type ClimbingPlan,
} from './climbing-model';

export async function changeClimbing(
  change: (data: ClimbingData) => void,
  database: TrainingDB = db,
) {
  await database.transaction('rw', database.climbing, async () => {
    const data = structuredClone((await database.climbing.get('climbing')) ?? emptyClimbing);
    change(data);
    data.revision++;
    await database.climbing.put(ClimbingDataSchema.parse(data));
  });
}
export async function saveClimbingRecord<K extends 'climbs' | 'sessions' | 'plans'>(
  key: K,
  value: ClimbingData[K][number],
  expectedUpdatedAt?: string,
  database: TrainingDB = db,
) {
  await changeClimbing((data) => {
    const rows = data[key] as (Climb | ClimbingSession | ClimbingPlan)[];
    const index = rows.findIndex((r) => r.id === value.id);
    if (expectedUpdatedAt && rows[index]?.updatedAt !== expectedUpdatedAt)
      throw Error('This record changed in another tab. Reopen it before saving.');
    if (key === 'sessions') {
      const session = value as ClimbingSession;
      if (session.status === 'completed' && session.date > foodDay())
        throw Error('Completed sessions cannot be in the future.');
    }
    const saved = {
      ...value,
      updatedAt: new Date(
        Math.max(Date.now(), index < 0 ? 0 : Date.parse(rows[index].updatedAt) + 1),
      ).toISOString(),
    };
    if (index < 0) rows.push(saved);
    else rows[index] = saved;
  }, database);
}
export async function deleteClimbingSession(
  id: string,
  expectedUpdatedAt: string,
  database: TrainingDB = db,
) {
  let removed: ClimbingSession | undefined;
  await changeClimbing((data) => {
    removed = data.sessions.find((s) => s.id === id);
    if (!removed || removed.updatedAt !== expectedUpdatedAt)
      throw Error('This session changed. Reopen it before deleting.');
    data.sessions = data.sessions.filter((s) => s.id !== id);
  }, database);
  return async () => {
    await changeClimbing((data) => {
      if (data.sessions.some((s) => s.id === id)) throw Error('This session already exists.');
      data.sessions.push(removed!);
    }, database);
  };
}
export const newClimb = (): Climb => ({
  id: uid(),
  name: '',
  venue: '',
  environment: 'indoor',
  type: 'bouldering',
  grade: '',
  gradeScale: '',
  project: 'none',
  notes: '',
  nextTry: '',
  archived: false,
  updatedAt: now(),
});
