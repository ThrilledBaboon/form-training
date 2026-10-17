import { defaultWorkspace, type Workspace } from './workspace-model';
import Dexie, { type EntityTable } from 'dexie';
import { catalogue } from './catalogue';
import {
  emptyFood,
  foodTables,
  type Ingredient,
  type Recipe,
  type FoodEntry,
  type MealPlan,
  type Stock,
  type Movement,
  type Batch,
  type Purchase,
  type ShoppingList,
  type FoodSettings,
  type FoodFile,
  type FoodDraft,
  type FoodData,
} from './food-model';
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
  workspaces!: EntityTable<Workspace, 'id'>;
  ingredients!: EntityTable<Ingredient, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  foodEntries!: EntityTable<FoodEntry, 'id'>;
  mealPlans!: EntityTable<MealPlan, 'id'>;
  stock!: EntityTable<Stock, 'id'>;
  movements!: EntityTable<Movement, 'id'>;
  batches!: EntityTable<Batch, 'id'>;
  purchases!: EntityTable<Purchase, 'id'>;
  shoppingLists!: EntityTable<ShoppingList, 'id'>;
  foodSettings!: EntityTable<FoodSettings, 'id'>;
  foodFiles!: EntityTable<FoodFile, 'id'>;
  foodDrafts!: EntityTable<FoodDraft, 'id'>;
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
      await tx.table('workspaces').put(defaultWorkspace());
    });
    this.version(4)
      .stores({ workspaces: 'id' })
      .upgrade(async (tx) => {
        await tx.table('workspaces').put(defaultWorkspace());
      });
    this.version(3).stores({
      ingredients: 'id,name,category,updatedAt',
      recipes: 'id,name,category,updatedAt',
      foodEntries: 'id,date,recipeId,batchId',
      mealPlans: 'id,date,recipeId,batchId',
      stock: 'id,ingredientId,expires,location,purchaseId',
      movements: 'id,at,stockId,batchId,ingredientId',
      batches: 'id,recipeId,prepared,expires',
      purchases: 'id,date,retailer,fingerprint',
      shoppingLists: 'id,updatedAt',
      foodSettings: 'id',
      foodFiles: 'id',
      foodDrafts: 'id,kind',
    });
  }
}
export const db = new TrainingDB();
export async function readData(
  database: TrainingDB = db,
  options: { includeFiles?: boolean } = {},
): Promise<Data> {
  return database.transaction(
    'r',
    [
      database.workspaces,
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
      ...foodTables.map((key) => database.table(key)),
      database.foodSettings,
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
      const food = { ...structuredClone(emptyFood) };
      for (const key of foodTables)
        if (key !== 'foodFiles' || options.includeFiles !== false)
          Object.assign(food, { [key]: await database.table(key).toArray() });
      food.foodSettings =
        (await database.foodSettings.get('food-preferences')) ??
        structuredClone(emptyFood.foodSettings);
      return {
        workspace: (await database.workspaces.get('workspace')) ?? defaultWorkspace(),
        food,
        ...(options.includeFiles === false
          ? { foodFileIds: await database.foodFiles.toCollection().primaryKeys() }
          : {}),
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
