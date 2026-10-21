import {
  now,
  type Exercise,
  type Mapping,
  type Muscle,
  type Routine,
  type Item,
  type trackingTypes,
} from './model';
type Entry = [string, string, Muscle[], Muscle[], (typeof trackingTypes)[number]?, string?];
const entries: Entry[] = [
  ['Barbell bench press', 'Barbell', ['chest'], ['triceps', 'front_delts']],
  ['Incline bench press', 'Barbell', ['chest'], ['front_delts', 'triceps']],
  ['Dumbbell bench press', 'Dumbbell', ['chest'], ['triceps', 'front_delts']],
  ['Overhead press', 'Barbell', ['front_delts', 'side_delts'], ['triceps', 'traps']],
  ['Lateral raise', 'Dumbbell', ['side_delts'], ['traps']],
  ['Cable fly', 'Cable', ['chest'], ['front_delts']],
  ['Pull-up', 'Pull-up bar', ['lats'], ['biceps', 'upper_back', 'forearms'], 'bodyweight'],
  ['Weighted pull-up', 'Pull-up bar', ['lats'], ['biceps', 'upper_back'], 'loaded_bodyweight'],
  ['Assisted pull-up', 'Machine', ['lats'], ['biceps', 'upper_back'], 'assisted'],
  ['Lat pulldown', 'Cable', ['lats'], ['biceps', 'upper_back']],
  ['Barbell row', 'Barbell', ['upper_back', 'lats'], ['biceps', 'rear_delts', 'erectors']],
  ['Seated cable row', 'Cable', ['upper_back', 'lats'], ['biceps', 'rear_delts']],
  ['Face pull', 'Cable', ['rear_delts'], ['upper_back', 'traps']],
  ['Biceps curl', 'Dumbbell', ['biceps'], ['forearms']],
  ['Hammer curl', 'Dumbbell', ['biceps', 'forearms'], []],
  ['Triceps pushdown', 'Cable', ['triceps'], []],
  ['Back squat', 'Barbell', ['quads', 'glutes'], ['adductors', 'erectors', 'abs']],
  ['Leg press', 'Machine', ['quads'], ['glutes', 'adductors']],
  ['Romanian deadlift', 'Barbell', ['hamstrings', 'glutes'], ['erectors', 'forearms']],
  [
    'Conventional deadlift',
    'Barbell',
    ['glutes', 'erectors'],
    ['hamstrings', 'quads', 'traps', 'forearms'],
  ],
  ['Leg extension', 'Machine', ['quads'], []],
  ['Leg curl', 'Machine', ['hamstrings'], []],
  ['Standing calf raise', 'Machine', ['calves'], []],
  ['Hip thrust', 'Barbell', ['glutes'], ['hamstrings']],
  ['Walking lunge', 'Dumbbell', ['quads', 'glutes'], ['adductors', 'abductors']],
  ['Cable hip abduction', 'Cable', ['abductors'], ['glutes']],
  ['Adductor machine', 'Machine', ['adductors'], []],
  ['Push-up', 'Bodyweight', ['chest'], ['triceps', 'front_delts', 'abs'], 'bodyweight'],
  ['Air squat', 'Bodyweight', ['quads', 'glutes'], ['adductors', 'abs'], 'bodyweight'],
  ['Hanging leg raise', 'Pull-up bar', ['abs'], ['obliques'], 'bodyweight'],
  ['Plank', 'Bodyweight', ['abs', 'obliques'], ['front_delts'], 'duration'],
  ['Side plank', 'Bodyweight', ['obliques'], ['abs', 'abductors'], 'duration'],
  ['Running', 'Treadmill', ['quads', 'calves'], ['hamstrings', 'glutes'], 'distance'],
  ['Farmers carry', 'Dumbbell', ['forearms', 'traps'], ['abs', 'obliques'], 'distance'],
  ['Dumbbell shrug', 'Dumbbell', ['traps'], ['forearms']],
  ['Back extension', 'Bodyweight', ['erectors'], ['glutes', 'hamstrings'], 'bodyweight'],
];
const slug = (s: string) =>
  s
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/-$/, '');
export function catalogue() {
  const t = now();
  const mappings: Mapping[] = [];
  const exercises: Exercise[] = entries.map(
    ([name, equipment, primary, secondary, tracking = 'weighted']) => {
      const id = 'exercise-' + slug(name);
      primary.forEach((muscle) =>
        mappings.push({
          id: `${id}:${muscle}`,
          exerciseId: id,
          muscle,
          role: 'primary',
          contribution: 1,
        }),
      );
      secondary.forEach((muscle) =>
        mappings.push({
          id: `${id}:${muscle}`,
          exerciseId: id,
          muscle,
          role: 'secondary',
          contribution: 1,
        }),
      );
      return {
        id,
        name,
        aliases: [],
        equipment,
        category: tracking === 'distance' ? 'Conditioning' : 'Strength',
        movement: /press|push|fly/.test(name)
          ? 'Push'
          : /row|pull|curl/.test(name)
            ? 'Pull'
            : /squat|leg press|lunge/.test(name)
              ? 'Squat'
              : /deadlift|thrust/.test(name)
                ? 'Hinge'
                : 'Isolation / other',
        unilateral: /lunge|Side plank/.test(name),
        tracking,
        restSeconds: /squat|deadlift|bench|Overhead/.test(name) ? 150 : 90,
        repMin: 8,
        repMax: 12,
        defaultSets: 3,
        notes: '',
        tags: [],
        archived: false,
        includeBodyweight: false,
        createdAt: t,
        updatedAt: t,
      };
    },
  );
  const makeItem = (name: string): Item => {
    const e = exercises.find((x) => x.name === name)!;
    return {
      id: `template-${slug(name)}`,
      exerciseId: e.id,
      name: e.name,
      tracking: e.tracking,
      includeBodyweight: e.includeBodyweight,
      notes: '',
      sets: Array.from({ length: 3 }, () =>
        e.tracking === 'duration'
          ? { durationSeconds: 45, label: 'working' as const }
          : { reps: 8, label: 'working' as const },
      ),
      repMin: e.repMin,
      repMax: e.repMax,
      restSeconds: e.restSeconds,
    };
  };
  const routines: Routine[] = [
    ['Full body A', ['Back squat', 'Barbell bench press', 'Seated cable row', 'Plank'], '#597e69'],
    [
      'Upper body',
      ['Barbell bench press', 'Lat pulldown', 'Overhead press', 'Biceps curl', 'Triceps pushdown'],
      '#7585a7',
    ],
    [
      'Lower body',
      ['Back squat', 'Romanian deadlift', 'Leg extension', 'Leg curl', 'Standing calf raise'],
      '#ba8d66',
    ],
  ].map(([name, names, color], i) => ({
    id: `starter-${i}`,
    sortOrder: i,
    name: name as string,
    description: 'Starter template · adjust loads and targets to your own training.',
    color: color as string,
    weekdays: [],
    items: (names as string[]).map(makeItem),
    groups: [],
    createdAt: t,
    updatedAt: t,
  }));
  return { exercises, mappings, routines };
}
