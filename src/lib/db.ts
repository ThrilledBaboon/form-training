import Dexie, { type EntityTable } from 'dexie';
import { catalogue } from './catalogue';
import {
  defaults,
  type Exercise,
  type Mapping,
  type Routine,
  type Programme,
  type Plan,
  type Session,
  type WorkoutSet,
  type Bodyweight,
  type Settings,
  type Timer,
  type Data,
} from './model';
export interface RecoveryBackup {
  id: string;
  createdAt: string;
  reason: string;
  json: string;
}
export class TrainingDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  mappings!: EntityTable<Mapping, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  programmes!: EntityTable<Programme, 'id'>;
  plans!: EntityTable<Plan, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  sets!: EntityTable<WorkoutSet, 'id'>;
  bodyweights!: EntityTable<Bodyweight, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  timers!: EntityTable<Timer, 'id'>;
  backups!: EntityTable<RecoveryBackup, 'id'>;
  constructor(name = 'form-training') {
    super(name);
    this.version(1).stores({
      exercises: 'id,name,archived',
      mappings: 'id,exerciseId,muscle',
      routines: 'id,name',
      programmes: 'id',
      plans: 'id,date,status',
      sessions: 'id,status,startAt',
      sets: 'id,sessionId,exerciseId,itemId',
      bodyweights: 'id,at',
      settings: 'id',
      timers: 'id',
    });
    this.version(2)
      .stores({ backups: 'id,createdAt' })
      .upgrade(async (tx) => {
        await tx
          .table('settings')
          .toCollection()
          .modify((s) => {
            Object.assign(s, { ...defaults, ...s });
          });
      });
    this.on('populate', async (tx) => {
      const c = catalogue();
      await tx.table('exercises').bulkAdd(c.exercises);
      await tx.table('mappings').bulkAdd(c.mappings);
      await tx.table('routines').bulkAdd(c.routines);
      await tx.table('settings').put(defaults);
    });
  }
}
export const db = new TrainingDB();
export async function readData(database: TrainingDB = db): Promise<Data> {
  return database.transaction(
    'r',
    [
      database.exercises,
      database.mappings,
      database.routines,
      database.programmes,
      database.plans,
      database.sessions,
      database.sets,
      database.bodyweights,
      database.settings,
      database.timers,
    ],
    async () => {
      const [
        exercises,
        mappings,
        routines,
        programmes,
        plans,
        sessions,
        sets,
        bodyweights,
        preferences,
        timer,
      ] = await Promise.all([
        database.exercises.toArray(),
        database.mappings.toArray(),
        database.routines.toArray(),
        database.programmes.toArray(),
        database.plans.toArray(),
        database.sessions.toArray(),
        database.sets.toArray(),
        database.bodyweights.toArray(),
        database.settings.get('preferences'),
        database.timers.get('rest'),
      ]);
      routines.sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAt.localeCompare(b.createdAt),
      );
      return {
        exercises,
        mappings,
        routines,
        programmes,
        plans,
        sessions,
        sets,
        bodyweights,
        settings: { ...defaults, ...preferences },
        timer,
      };
    },
  );
}
