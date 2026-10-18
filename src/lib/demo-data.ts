import { catalogue } from './catalogue';
import { emptyData, type Data, type Item, type Routine } from './model';
import { emptyFood, IngredientSchema, RecipeSchema, type Recipe, type Unit } from './food-model';
import { foodDay, shiftDay, recipeNutrition } from './food-calc';
import { defaultWorkspace, makeWidget } from './workspace-model';

export const DEMO_PREFIX = 'demo-jack-v1-';
export const demoId = (value: string) => DEMO_PREFIX + value;
const note = 'DEMO: fictional data for Jack; not a real personal record or recommendation.';
const round = (n: number) => Math.round(n * 10) / 10;

/** Deterministic, date-relative examples; never infer or alter the user's real history. */
export function createJackDemo(today = foodDay()): Data {
  const end = new Date(today + 'T12:00:00');
  if (isNaN(end.getTime()) || foodDay(end) !== today) throw Error('Invalid demo date.');
  const first = new Date(end);
  first.setDate(1);
  first.setMonth(first.getMonth() - 6);
  first.setDate(
    Math.min(end.getDate(), new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()),
  );
  const from = foodDay(first);
  const stamp = (day: string, hour = 12) =>
    new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).toISOString();
  const at = stamp(today);
  const c = catalogue();
  c.exercises.forEach((e) => {
    e.createdAt = stamp(from);
    e.updatedAt = at;
  });
  const food = structuredClone(emptyFood);
  const workspace = defaultWorkspace();
  const data: Data = { ...structuredClone(emptyData), ...c, routines: [], workspace, food };
  data.settings = { ...data.settings, weekTarget: 4, goalKg: 78 };
  workspace.profile = { name: 'Jack', onboarding: 'completed', updatedAt: at };
  food.foodSettings = {
    ...food.foodSettings,
    targets: { protein: 150, carbs: 260, fat: 75, fibre: 30 },
    weeklyBudget: 70,
    monthlyBudget: 300,
  };
  const programmeId = demoId('programme');
  data.programmes = [{ id: programmeId, name: 'Jack · upper / lower [Demo]', notes: note }];
  type Lift = [string, number, number];
  const splits: { name: string; day: number; color: string; lifts: Lift[] }[] = [
    {
      name: 'Upper A',
      day: 1,
      color: '#597e69',
      lifts: [
        ['Barbell bench press', 30, 2.5],
        ['Lat pulldown', 35, 2.5],
        ['Overhead press', 20, 1.25],
        ['Seated cable row', 30, 2.5],
        ['Biceps curl', 6, 0.5],
        ['Triceps pushdown', 15, 1.25],
      ],
    },
    {
      name: 'Lower A',
      day: 2,
      color: '#ba8d66',
      lifts: [
        ['Back squat', 40, 3.75],
        ['Romanian deadlift', 35, 3.75],
        ['Leg curl', 25, 2.5],
        ['Standing calf raise', 30, 2.5],
        ['Plank', 30, 2.5],
      ],
    },
    {
      name: 'Upper B',
      day: 4,
      color: '#7585a7',
      lifts: [
        ['Dumbbell bench press', 12.5, 1.25],
        ['Seated cable row', 30, 2.5],
        ['Pull-up', 4, 0],
        ['Lateral raise', 5, 0.5],
        ['Face pull', 15, 1.25],
        ['Hammer curl', 6, 0.5],
      ],
    },
    {
      name: 'Lower B',
      day: 6,
      color: '#8b77a8',
      lifts: [
        ['Leg press', 70, 5],
        ['Romanian deadlift', 35, 3.75],
        ['Leg extension', 25, 2.5],
        ['Leg curl', 25, 2.5],
        ['Hanging leg raise', 6, 0],
      ],
    },
  ];
  function items(
    split: (typeof splits)[number],
    key: string,
    week: number,
    deload = false,
  ): Item[] {
    return split.lifts.map(([name, base, step], index) => {
      const e = c.exercises.find((entry) => entry.name === name)!;
      const load = Math.round((base + Math.floor(week / 2) * step) * (deload ? 0.85 : 1) * 2) / 2;
      return {
        id: demoId(`${key}-item-${index}`),
        exerciseId: e.id,
        name,
        tracking: e.tracking,
        includeBodyweight: false,
        notes: e.equipment === 'Dumbbell' ? 'DEMO · load is per dumbbell.' : '',
        repMin: 8,
        repMax: 12,
        restSeconds: index < 2 ? 120 : 90,
        sets: Array.from({ length: deload || week < 2 ? 2 : 3 }, (_, order) => ({
          label: 'working' as const,
          ...(e.tracking === 'duration'
            ? { durationSeconds: 30 + week }
            : e.tracking === 'bodyweight'
              ? { reps: Math.min(15, base + Math.floor(week / 4)) }
              : { loadKg: load, reps: Math.max(8, 10 + (week % 3) - (order === 2 ? 1 : 0)) }),
        })),
      };
    });
  }
  data.routines = splits.map((split, index): Routine => ({
    id: demoId(`routine-${index}`),
    name: `${split.name} [Demo]`,
    description: note,
    programmeId,
    weekdays: [split.day],
    color: split.color,
    items: items(split, `routine-${index}`, 26),
    groups: [],
    createdAt: stamp(from),
    updatedAt: at,
  }));
  const days: string[] = [];
  for (let date = from; date <= today; date = shiftDay(date, 1)) days.push(date);
  days.forEach((date, index) => {
    const week = Math.floor(index / 7);
    const progress = index / Math.max(1, days.length - 1);
    const kg = round(84 - 6 * progress + 0.35 * Math.sin(index * 1.7));
    if (index % 2 === 0 || date === today)
      data.bodyweights.push({
        id: demoId('weight-' + date),
        at: stamp(date, 7),
        kg,
        notes: note + ' Morning weigh-in.',
      });
    const splitIndex = splits.findIndex((s) => s.day === new Date(date + 'T12:00:00').getDay());
    // A holiday and occasional missed sessions make the history less mechanical.
    if (splitIndex < 0 || week === 12 || [43, 96, 137].includes(index)) return;
    const split = splits[splitIndex];
    const deload = week > 0 && week % 6 === 0;
    const id = demoId('session-' + date);
    const startAt = stamp(date, 8);
    const endAt = new Date(Date.parse(startAt) + (48 + (index % 20)) * 60000).toISOString();
    const sessionItems = items(split, date, week, deload);
    data.sessions.push({
      id,
      name: `${split.name} [Demo]`,
      routineId: data.routines[splitIndex].id,
      startAt,
      endAt,
      status: 'completed',
      items: sessionItems,
      groups: [],
      notes:
        note +
        (deload
          ? ' Lighter deload week.'
          : [
              ' Felt strong; controlled the lowering.',
              ' Solid session, kept one or two reps in reserve.',
              ' A little tired today; longer rests helped.',
            ][index % 3]),
      rpe: deload ? 6 : 7 + (index % 3) * 0.5,
      energy: 3 + (index % 3),
      updatedAt: endAt,
    });
    sessionItems.forEach((item, itemIndex) =>
      item.sets.forEach((set, order) =>
        data.sets.push({
          ...set,
          id: demoId(`set-${date}-${itemIndex}-${order}`),
          sessionId: id,
          itemId: item.id,
          exerciseId: item.exerciseId,
          order,
          bodyweightKg: item.tracking === 'bodyweight' ? kg : undefined,
          restSeconds: item.restSeconds,
          completed: true,
          completedAt: new Date(
            Date.parse(startAt) + (itemIndex * 8 + order * 2 + 2) * 60000,
          ).toISOString(),
          rir: deload ? 4 : 1 + ((index + order) % 3),
          notes:
            order === 2 && index % 9 === 0
              ? 'DEMO · last reps felt challenging; technique stayed controlled.'
              : '',
        }),
      ),
    );
  });
  for (let offset = 0; offset < 14; offset++) {
    const date = shiftDay(today, offset);
    const index = splits.findIndex((s) => s.day === new Date(date + 'T12:00:00').getDay());
    if (index >= 0)
      data.plans.push({
        id: demoId('plan-' + date),
        routineId: data.routines[index].id,
        name: data.routines[index].name,
        date,
        status: 'planned',
        items: structuredClone(data.routines[index].items),
        groups: [],
        notes: note,
      });
  }
  type FoodSpec = [string, string, number, number, number, number, number, number, string?];
  const ingredients: FoodSpec[] = [
    ['oats', 'Rolled oats', 13, 60, 7, 10, 1000, 1.5],
    ['milk', 'Semi-skimmed milk', 3.6, 4.8, 1.8, 0, 2000, 1.65, 'ml'],
    ['yogurt', 'Greek yogurt', 10, 4, 2, 0, 500, 1.75],
    ['banana', 'Banana', 1.1, 23, 0.3, 2.6, 700, 1.1],
    ['berries', 'Frozen berries', 1, 9, 0.5, 4, 500, 2.4],
    ['whey', 'Whey protein', 78, 8, 6, 0, 1000, 22],
    ['chicken', 'Chicken breast', 23, 0, 2, 0, 650, 4.5],
    ['rice', 'Basmati rice', 8, 78, 1, 1, 1000, 1.8],
    ['broccoli', 'Broccoli', 3, 4, 0.4, 3, 500, 0.85],
    ['oil', 'Olive oil', 0, 0, 100, 0, 500, 4.5, 'ml'],
    ['salmon', 'Salmon fillets', 20, 0, 13, 0, 250, 4.2],
    ['potato', 'Potatoes', 2, 17, 0.1, 2.2, 2000, 1.65],
    ['peas', 'Frozen peas', 5, 10, 0.5, 5, 900, 1.25],
    ['pasta', 'Wholewheat pasta', 13, 64, 2.5, 8, 500, 0.85],
    ['turkey', 'Turkey mince', 22, 0, 7, 0, 500, 3.6],
    ['tomato', 'Chopped tomatoes', 1, 4, 0.2, 1.5, 400, 0.45],
    ['beans', 'Kidney beans', 7, 15, 0.5, 6, 400, 0.55],
    ['lentils', 'Red lentils', 24, 52, 1.5, 11, 500, 1.5],
    ['bread', 'Wholemeal bread', 10, 42, 3, 7, 800, 0.8],
    ['eggs', 'Eggs', 13, 1, 10, 0, 360, 1.65],
    ['peanut', 'Peanut butter', 26, 12, 49, 7, 340, 1.6],
    ['apple', 'Apples', 0.3, 12, 0.2, 2.4, 600, 1.25],
    ['wrap', 'Wholemeal wraps', 8, 49, 7, 6, 360, 1.1],
    ['pepper', 'Mixed peppers', 1, 5, 0.3, 2, 450, 1.6],
    ['tofu', 'Firm tofu', 13, 2, 8, 1, 400, 2],
  ];
  food.ingredients = ingredients.map(([key, name, protein, carbs, fat, fibre, quantity, , unit]) =>
    IngredientSchema.parse({
      id: demoId('ingredient-' + key),
      name: name + ' [Demo]',
      category: ['rice', 'oats', 'pasta', 'bread', 'wrap'].includes(key) ? 'Grains' : 'Other',
      basisUnit: unit ?? 'g',
      defaultUnit: unit ?? 'g',
      state: 'as sold',
      macros: { protein, carbs, fat, fibre },
      nutritionStatus: 'estimated',
      source: 'Synthetic demo nutrition per 100 g/ml; not a verified food label.',
      package: { quantity, unit: unit ?? 'g' },
      location: ['milk', 'yogurt', 'chicken', 'salmon', 'turkey', 'tofu'].includes(key)
        ? 'Fridge'
        : ['berries', 'peas'].includes(key)
          ? 'Freezer'
          : 'Cupboard',
      staple: ['oats', 'rice', 'oil', 'pasta'].includes(key),
      notes: note,
      createdAt: stamp(from),
      updatedAt: at,
    }),
  );
  type MealSpec = [string, Recipe['category'], [string, number][]];
  const meals: MealSpec[] = [
    [
      'Protein overnight oats',
      'Breakfast',
      [
        ['oats', 70],
        ['milk', 200],
        ['whey', 25],
        ['berries', 80],
      ],
    ],
    [
      'Eggs on wholemeal toast',
      'Breakfast',
      [
        ['eggs', 150],
        ['bread', 100],
        ['tomato', 100],
      ],
    ],
    [
      'Banana yogurt bowl',
      'Breakfast',
      [
        ['yogurt', 250],
        ['oats', 60],
        ['banana', 120],
        ['peanut', 15],
      ],
    ],
    [
      'Chicken rice bowl',
      'Lunch',
      [
        ['chicken', 180],
        ['rice', 100],
        ['broccoli', 150],
        ['oil', 10],
      ],
    ],
    [
      'Turkey pasta',
      'Lunch',
      [
        ['turkey', 170],
        ['pasta', 110],
        ['tomato', 200],
        ['pepper', 100],
      ],
    ],
    [
      'Chicken wraps',
      'Lunch',
      [
        ['chicken', 170],
        ['wrap', 120],
        ['pepper', 120],
        ['yogurt', 60],
      ],
    ],
    [
      'Tofu rice bowl',
      'Lunch',
      [
        ['tofu', 220],
        ['rice', 100],
        ['broccoli', 150],
        ['oil', 10],
      ],
    ],
    [
      'Salmon with potatoes',
      'Dinner',
      [
        ['salmon', 180],
        ['potato', 350],
        ['peas', 150],
        ['oil', 10],
      ],
    ],
    [
      'Turkey and bean chilli',
      'Dinner',
      [
        ['turkey', 180],
        ['beans', 150],
        ['tomato', 200],
        ['rice', 90],
      ],
    ],
    [
      'Lentil and tomato dal',
      'Dinner',
      [
        ['lentils', 100],
        ['rice', 90],
        ['tomato', 200],
        ['oil', 15],
      ],
    ],
    [
      'Chicken tray bake',
      'Dinner',
      [
        ['chicken', 200],
        ['potato', 350],
        ['pepper', 150],
        ['oil', 15],
      ],
    ],
    [
      'Yogurt, berries and apple',
      'Snacks',
      [
        ['yogurt', 250],
        ['berries', 100],
        ['apple', 150],
      ],
    ],
    [
      'Protein shake and banana',
      'Snacks',
      [
        ['whey', 35],
        ['milk', 300],
        ['banana', 120],
      ],
    ],
    [
      'Peanut butter toast',
      'Snacks',
      [
        ['bread', 90],
        ['peanut', 30],
        ['milk', 200],
      ],
    ],
  ];
  food.recipes = meals.map(([name, category, lines], index) =>
    RecipeSchema.parse({
      id: demoId('recipe-' + index),
      name: name + ' [Demo]',
      category,
      description: note,
      servings: 1,
      ingredients: lines.map(([key, quantity], i) => ({
        id: demoId(`recipe-${index}-line-${i}`),
        ingredientId: demoId('ingredient-' + key),
        quantity,
        unit: food.ingredients.find((x) => x.id === demoId('ingredient-' + key))!.basisUnit,
        state: 'as sold',
        optional: false,
        notes: '',
      })),
      steps: [
        {
          id: demoId(`recipe-${index}-step`),
          text: 'Demo recipe for exploring the meal planner. Add your own preparation instructions before cooking.',
        },
      ],
      prepMinutes: 5 + (index % 4) * 5,
      cookMinutes: category === 'Lunch' || category === 'Dinner' ? 25 : 0,
      favourite: index % 3 === 0,
      rating: 3 + (index % 3),
      notes: note,
      createdAt: stamp(from),
      updatedAt: at,
    }),
  );
  // Fictional weekly checkouts, with totals calculated from their line items.
  days
    .filter((_, i) => i % 7 === 0)
    .forEach((date, index) => {
      const lines = ingredients
        .filter(([key]) => !['whey', 'oil', 'peanut'].includes(key) || index % 4 === 0)
        .map(([key, name, , , , , quantity, price, unit], i) => ({
          id: demoId(`purchase-${date}-line-${i}`),
          description: name + ' [Demo]',
          ingredientId: demoId('ingredient-' + key),
          quantity,
          unit: (unit ?? 'g') as Unit,
          packages: 1,
          paid: round(price * (0.94 + (index % 5) * 0.025)),
          discount: 0,
          received: true,
          location: food.ingredients.find((x) => x.id === demoId('ingredient-' + key))!.location,
        }));
      food.purchases.push({
        id: demoId('purchase-' + date),
        retailer: ['Aldi', 'Tesco', 'Lidl'][index % 3] + ' [Demo]',
        date,
        currency: 'GBP',
        lines,
        total: round(lines.reduce((sum, l) => sum + l.paid, 0)),
        notes: note,
        reviewed: true,
        createdAt: stamp(date, 10),
      });
    });
  days.forEach((date, index) => {
    for (const slot of ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const) {
      if (index % 19 === 7 && slot === 'Snacks') continue;
      const options = food.recipes.filter((r) => r.category === slot);
      const recipe = options[(index + (slot === 'Dinner' ? 2 : 0)) % options.length];
      food.foodEntries.push({
        id: demoId(`meal-${date}-${slot}`),
        date,
        slot,
        name: recipe.name,
        recipeId: recipe.id,
        servings: [0.9, 1, 1.1, 1.2][index % 4],
        snapshot: recipeNutrition(food, recipe, 1),
        notes: note + (index % 13 === 0 ? ' Meal prep made today easier.' : ''),
        createdAt: stamp(
          date,
          slot === 'Breakfast' ? 7 : slot === 'Lunch' ? 12 : slot === 'Dinner' ? 18 : 15,
        ),
      });
    }
  });
  for (let offset = 0; offset < 7; offset++)
    for (const slot of ['Breakfast', 'Lunch', 'Dinner'] as const) {
      const options = food.recipes.filter((r) => r.category === slot);
      food.mealPlans.push({
        id: demoId(`meal-plan-${offset}-${slot}`),
        date: shiftDay(today, offset),
        slot,
        recipeId: options[offset % options.length].id,
        servings: 1,
        notes: note,
        createdAt: at,
      });
    }
  const latest = food.purchases.at(-1)!;
  latest.lines.slice(0, 18).forEach((line, index) => {
    const quantity = Math.round(line.quantity! * [0.2, 0.5, 0.75, 1][index % 4]);
    const stockId = demoId('stock-' + index);
    food.stock.push({
      id: stockId,
      ingredientId: line.ingredientId!,
      quantity,
      originalQuantity: line.quantity!,
      unit: line.unit,
      purchased: latest.date,
      expires: shiftDay(today, index % 7),
      expiryKind: line.location === 'Fridge' ? 'use-by' : 'best-before',
      location: line.location,
      price: line.paid,
      purchaseId: latest.id,
      purchaseLineId: line.id,
      currency: 'GBP',
      brand: '',
      confidence: 'estimated',
      notes: note,
      createdAt: stamp(latest.date),
    });
    food.movements.push({
      id: demoId('stock-added-' + index),
      stockId,
      ingredientId: line.ingredientId,
      quantity: line.quantity!,
      unit: line.unit,
      kind: 'added',
      at: stamp(latest.date),
      notes: note,
      cost: line.paid,
      currency: 'GBP',
    });
    food.movements.push({
      id: demoId('stock-used-' + index),
      stockId,
      ingredientId: line.ingredientId,
      quantity: quantity - line.quantity!,
      unit: line.unit,
      kind: 'adjusted',
      at,
      notes: note + ' Example remaining cupboard balance.',
    });
  });
  [3, 8, 9].forEach((recipeIndex, index) => {
    const recipe = food.recipes[recipeIndex];
    const id = demoId('batch-' + index);
    const prepared = shiftDay(today, -3);
    const eaten = shiftDay(today, -index - 1);
    food.batches.push({
      id,
      recipeId: recipe.id,
      name: recipe.name,
      prepared,
      expires: shiftDay(today, index === 2 ? 30 : 2),
      location: index === 2 ? 'Freezer' : 'Fridge',
      produced: 4,
      remaining: 3,
      snapshot: recipeNutrition(food, recipe, 1),
      notes: note,
      createdAt: stamp(prepared),
    });
    food.movements.push({
      id: demoId('batch-made-' + index),
      batchId: id,
      quantity: 4,
      unit: 'portion',
      kind: 'cooked',
      at: stamp(prepared),
      notes: note,
    });
    food.movements.push({
      id: demoId('batch-eaten-' + index),
      batchId: id,
      quantity: -1,
      unit: 'portion',
      kind: 'eaten',
      at: stamp(eaten, 18),
      notes: note,
    });
    food.foodEntries = food.foodEntries.filter(
      (entry) => entry.date !== eaten || entry.slot !== recipe.category,
    );
    food.foodEntries.push({
      id: demoId('batch-meal-' + index),
      date: eaten,
      slot: recipe.category,
      name: recipe.name,
      recipeId: recipe.id,
      batchId: id,
      servings: 1,
      snapshot: recipeNutrition(food, recipe, 1),
      notes: note + ' Prepared portion.',
      createdAt: stamp(eaten, 18),
    });
  });
  food.shoppingLists.push({
    id: demoId('shopping'),
    name: 'Jack’s weekly shop [Demo]',
    from: today,
    to: shiftDay(today, 6),
    items: food.ingredients.slice(0, 8).map((ingredient, index) => ({
      id: demoId('shopping-item-' + index),
      name: ingredient.name,
      ingredientId: ingredient.id,
      quantity: ingredient.package!.quantity,
      unit: ingredient.package!.unit,
      generated: false,
      checked: index < 2,
      received: false,
      notes: note,
    })),
    createdAt: at,
    updatedAt: at,
  });
  workspace.pages.push({
    id: demoId('page'),
    name: 'Jack · six months [Demo]',
    range: { from, to: today, days: 0 },
    revision: 0,
    widgets: [
      makeWidget(
        'notes',
        {
          note: 'Fictional demo data for Jack: six months of training, food and weigh-ins. Sample loads, nutrition and prices are illustrative. Remove it in Settings & data → Jack demo data.',
        },
        demoId('widget-note'),
      ),
      makeWidget('training-trend', { metric: 'volume' }, demoId('widget-training')),
      makeWidget(
        'exercise',
        { exerciseId: 'exercise-barbell-bench-press', metric: 'bestLoad' },
        demoId('widget-bench'),
      ),
      makeWidget('bodyweight', {}, demoId('widget-weight')),
      makeWidget('macro-trend', { metric: 'protein' }, demoId('widget-macros')),
      makeWidget('spending-trend', {}, demoId('widget-spending')),
      makeWidget('context', {}, demoId('widget-context')),
    ],
  });
  return data;
}
