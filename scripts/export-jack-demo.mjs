import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { createJackDemo } = await server.ssrLoadModule('/src/lib/demo-data.ts');
  const { parseBackup, serialise } = await server.ssrLoadModule('/src/lib/backup.ts');
  const data = createJackDemo(process.argv[2]);
  const json = serialise(data);
  parseBackup(json);
  await mkdir('.local/jack-demo', { recursive: true });
  await writeFile('.local/jack-demo/jack-six-month-demo.json', json);
  console.log(
    JSON.stringify(
      {
        path: '.local/jack-demo/jack-six-month-demo.json',
        workouts: data.sessions.length,
        sets: data.sets.length,
        weighIns: data.bodyweights.length,
        meals: data.food.foodEntries.length,
        recipes: data.food.recipes.length,
        ingredients: data.food.ingredients.length,
        purchases: data.food.purchases.length,
        plannedMeals: data.food.mealPlans.length,
        bytes: json.length,
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
