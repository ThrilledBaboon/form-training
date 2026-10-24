import { IngredientSchema, RecipeSchema, FoodProgrammeSchema } from './food-model';
import { parseFoodProgrammeLibrary } from './food-programme-library';
const stamp = '2026-10-24T12:00:00Z';
const source = 'https://www.youtube.com/watch?v=z9cd8jJqELw';
const groups = {
  protein: [
    'Chicken breast',
    'Prawns',
    'Egg whites',
    'Tuna',
    'Tilapia',
    '0% Greek yoghurt',
    '0% cottage cheese',
  ],
  volume: [
    'Broccoli',
    'Cabbage',
    'Lettuce',
    'Spinach',
    'Mushrooms',
    'Cucumber',
    'Cauliflower',
    'Courgette',
    'Kimchi',
    'Pumpkin',
    'Carrots',
    'Squash',
    'Strawberries',
    'Watermelon',
    'Cantaloupe',
    'Konjac noodles',
    'Sugar-free jelly',
  ],
  fat: [
    'Olive oil',
    'Sesame oil',
    'Light mayonnaise',
    'Chia seeds',
    'Olives',
    'Avocado',
    'Whole eggs',
    'Almonds',
    'Light cream cheese',
  ],
  flavouring: [
    'Lemon',
    'Dill',
    'Garlic',
    'Soy sauce',
    'Fish sauce',
    'Sriracha',
    'Salsa',
    'Mustard',
    'Tomato sauce',
    'Herbs and spices',
    'Sweetener',
    'Sugar-free syrup',
  ],
} as const;
const slug = (s: string) => 'filling-v1-' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const guidance: Record<string, string> = {
  'Olive oil': '1 tbsp',
  'Sesame oil': '1 tbsp',
  'Light mayonnaise': '1 tbsp half-fat mayonnaise',
  'Chia seeds': '2 tbsp',
  Olives: '20 olives',
  Avocado: '½ avocado',
  'Whole eggs': '2 whole eggs',
  Almonds: '20 almonds',
  'Light cream cheese': '2 tbsp',
};
export function fillingBowlStarter() {
  const ingredients = Object.entries(groups).flatMap(([role, names]) =>
    names.map((name) =>
      IngredientSchema.parse({
        id: slug(name),
        name,
        category:
          role === 'protein'
            ? 'Protein'
            : role === 'volume'
              ? 'Volume foods'
              : role === 'fat'
                ? 'Fat choices'
                : 'Flavourings',
        aliases: name === 'Courgette' ? ['Zucchini'] : name === 'Prawns' ? ['Shrimp'] : [],
        source: 'Filling-bowl food choice; product nutrition not supplied.',
        notes: guidance[name] ?? '',
        createdAt: stamp,
        updatedAt: stamp,
      }),
    ),
  );
  const meals = [
    [
      'Yoghurt, strawberries & chia',
      'Breakfast',
      ['0% Greek yoghurt'],
      ['Strawberries'],
      ['Chia seeds'],
    ],
    [
      'Chicken cucumber bowl',
      'Lunch',
      ['Chicken breast', '0% Greek yoghurt'],
      ['Cucumber', 'Lettuce'],
      ['Light mayonnaise'],
      ['Lemon', 'Dill'],
    ],
    [
      'Prawn broccoli konjac bowl',
      'Dinner',
      ['Prawns'],
      ['Broccoli', 'Konjac noodles'],
      ['Sesame oil'],
      ['Soy sauce'],
    ],
    [
      'Egg, mushroom & spinach bowl',
      'Breakfast',
      ['Egg whites'],
      ['Mushrooms', 'Spinach'],
      ['Whole eggs'],
    ],
    [
      'Tuna kimchi bowl',
      'Lunch',
      ['Tuna', '0% Greek yoghurt'],
      ['Cucumber', 'Carrots', 'Kimchi', 'Lettuce'],
      ['Light mayonnaise'],
    ],
    [
      'Chicken courgette bowl',
      'Dinner',
      ['Chicken breast'],
      ['Courgette', 'Cauliflower'],
      ['Olive oil'],
    ],
    [
      'Cottage cheese & cantaloupe',
      'Breakfast',
      ['0% cottage cheese'],
      ['Cantaloupe'],
      ['Almonds'],
    ],
    ['Chicken cabbage bowl', 'Lunch', ['Chicken breast'], ['Cabbage', 'Cucumber'], ['Olives']],
    ['Tilapia pumpkin bowl', 'Dinner', ['Tilapia'], ['Pumpkin', 'Broccoli'], ['Olive oil']],
    [
      'Strawberry jelly yoghurt bowl',
      'Breakfast',
      ['0% Greek yoghurt'],
      ['Strawberries', 'Sugar-free jelly'],
      ['Chia seeds'],
    ],
    ['Prawn avocado salad bowl', 'Lunch', ['Prawns'], ['Lettuce', 'Cucumber'], ['Avocado']],
    [
      'Chicken konjac vegetable bowl',
      'Dinner',
      ['Chicken breast'],
      ['Konjac noodles', 'Broccoli', 'Carrots', 'Cauliflower'],
      ['Sesame oil'],
      ['Soy sauce', 'Garlic'],
    ],
    [
      'Egg, mushroom & pumpkin bowl',
      'Breakfast',
      ['Egg whites'],
      ['Mushrooms', 'Pumpkin'],
      ['Whole eggs'],
    ],
    [
      'Creamy chicken cauliflower bowl',
      'Dinner',
      ['Chicken breast'],
      ['Cauliflower', 'Carrots'],
      ['Light cream cheese'],
    ],
    [
      'Cottage cheese & watermelon',
      'Breakfast',
      ['0% cottage cheese'],
      ['Watermelon'],
      ['Almonds'],
    ],
    [
      'Chicken avocado salad bowl',
      'Lunch',
      ['Chicken breast'],
      ['Lettuce', 'Cucumber'],
      ['Avocado'],
    ],
    [
      'Prawn courgette cabbage bowl',
      'Dinner',
      ['Prawns'],
      ['Courgette', 'Cabbage'],
      ['Sesame oil'],
    ],
    ['Tilapia squash bowl', 'Dinner', ['Tilapia'], ['Squash', 'Broccoli'], ['Olive oil']],
  ] as const;
  const recipes = meals.map(([name, category, protein, volume, fat, flavouring]) =>
    RecipeSchema.parse({
      id: slug(name),
      name,
      category,
      servings: 1,
      unmeasured: true,
      ingredients: [],
      composition: [
        ...protein.map((n) => ({ ingredientId: slug(n), role: 'protein', guidance: '' })),
        ...volume.map((n) => ({ ingredientId: slug(n), role: 'volume', guidance: '' })),
        ...fat.map((n) => ({ ingredientId: slug(n), role: 'fat', guidance: guidance[n] })),
        ...(flavouring ?? []).map((n) => ({
          ingredientId: slug(n),
          role: 'flavouring',
          guidance: '',
        })),
      ],
      description:
        'A flexible bowl idea. Choose amounts that suit you; quantities and product nutrition are unrecorded. The listed fat choice is included, not an extra portion.',
      steps: [
        {
          id: 'prepare',
          text:
            category === 'Breakfast' && !protein.some((name) => name === 'Egg whites')
              ? 'Prepare the fruit, add yoghurt or cottage cheese, then add the selected seed or nut choice. Prepare jelly according to its package if used.'
              : 'Prepare the vegetables and cook any meat, fish, seafood or eggs appropriately. Combine in your bowl with the selected fat choice and flavourings. Check product instructions; cooking time is not recorded.',
        },
      ],
      sourceUrl: source,
      dietary: ['Filling bowls'],
      createdAt: stamp,
      updatedAt: stamp,
    }),
  );
  const index = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [9, 10, 11],
    [12, 4, 13],
    [14, 15, 16],
    [0, 1, 17],
  ];
  const programme = FoodProgrammeSchema.parse({
    id: 'filling-bowls-programme-v1',
    name: 'Filling bowls — 30 days',
    description:
      'An editable seven-day rotation inspired by the supplied filling-diet video. Build meals from protein, volume foods and one listed fat choice. No weighing is required. The source food list is restrictive; edit your own version to add foods that suit your needs. Fullness does not demonstrate complete nutrition. Eat comfortably rather than forcing a bowl to be finished.',
    sourceName:
      'Inspired by Jeremy Ethier / Built With Science filling-diet video and guide; independently adapted, not affiliated.',
    sourceUrl: source,
    groups: Object.entries(groups).map(([role, names]) => ({
      id: role,
      name:
        role === 'volume'
          ? 'Volume foods'
          : role === 'fat'
            ? 'Fat choices'
            : role === 'protein'
              ? 'Protein choices'
              : 'Flavourings',
      role,
      ingredientIds: names.map(slug),
      guidance:
        role === 'fat'
          ? 'Choose one of the listed portions per meal. Choices are not nutritionally equivalent; include fats used in cooking and dressings.'
          : role === 'flavouring'
            ? 'Use flavourings to taste. Low-energy does not mean zero energy or sodium; check product labels.'
            : 'Unmeasured choices within your preferred bowl; add quantities only if useful.',
    })),
    habits: [
      {
        id: 'drink',
        name: 'Preferred drink with meals',
        notes:
          'Optional sparkling water or a preferred low/no-sugar drink; still water is also fine.',
      },
      {
        id: 'broth',
        name: 'Broth with one meal',
        notes:
          'Optional. The transcript mentions one to two cups, not a compulsory litre. No amount is prescribed by this programme.',
      },
      {
        id: 'pace',
        name: 'Take your time eating',
        notes:
          'Optional smaller utensil or a comfortable slower pace. Stop when comfortably satisfied.',
      },
    ],
    rotation: index.flatMap((row, day) =>
      row.map((i, slot) => ({
        day,
        slot: ['Breakfast', 'Lunch', 'Dinner'][slot],
        recipeIds: [
          recipes[i].id,
          ...recipes
            .filter((r) => r.category === recipes[i].category && r.id !== recipes[i].id)
            .map((r) => r.id),
        ],
      })),
    ),
    createdAt: stamp,
    updatedAt: stamp,
  });
  return parseFoodProgrammeLibrary(
    JSON.stringify({
      app: 'FORM',
      type: 'food-programme-library',
      schemaVersion: 1,
      title: programme.name,
      exportedAt: stamp,
      ingredients,
      recipes,
      programmes: [programme],
      files: [],
    }),
  );
}
