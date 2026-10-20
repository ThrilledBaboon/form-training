import { useApp, go } from '../lib/context';
import { foodDay, weekDays, dailyMacros, foodNumber, shiftDay } from '../lib/food-calc';
import { useFood, MacroSummary } from './FoodUI';
import { MacroProgress } from '../pages/FoodDiary';
import { Card, SectionTitle, Button, LinkButton } from './ui';
import { fromKg } from '../lib/calc';
import { filterWeights, allWeights } from '../lib/weight-tags';
import { saveSettings } from '../lib/actions';
import { WeightTagFilter } from './WeightTagFilter';
export function FoodOverview() {
  const food = useFood(),
    today = foodDay();
  const meals = food.mealPlans.filter((p) => p.date === today);
  const expiring = food.stock.filter(
    (s) => s.quantity > 0 && s.expires && s.expires >= today && s.expires <= shiftDay(today, 3),
  );
  return (
    <Card>
      <SectionTitle
        title="Food, alongside your training"
        sub="Today’s recorded macros and planned meals."
        action={<LinkButton to="food-menu">Open your menu</LinkButton>}
      />
      <div className="food-overview">
        <div>
          <MacroProgress date={today} />
          <div className="food-actions">
            <Button variant="secondary" onClick={() => go('food-diary')}>
              Open food diary
            </Button>
          </div>
        </div>
        <div>
          <h3>Today’s meal plan</h3>
          {meals.length ? (
            meals.map((p) => (
              <a className="food-planned-line" key={p.id} href={'#/food-planner?date=' + today}>
                <span>
                  {p.slot} · {food.recipes.find((r) => r.id === p.recipeId)?.name}
                </span>
                <small>{foodNumber(p.servings)} servings</small>
              </a>
            ))
          ) : (
            <p className="muted">No meals planned. Add just the meals you want to organise.</p>
          )}
          <p className="small-text muted">
            {expiring.length
              ? `${expiring.length} kitchen packages approach their recorded expiry date. Check Kitchen and use the Menu’s stock filters to plan around them.`
              : 'No kitchen packages with a recorded expiry in the next 3 days.'}
          </p>
          <div className="food-actions">
            <Button variant="secondary" onClick={() => go('food-planner')}>
              Plan a meal
            </Button>
            <Button variant="ghost" onClick={() => go('food-kitchen')}>
              Check the kitchen
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
export function FoodTrainingContext() {
  const food = useFood();
  const { data, run, pending } = useApp();
  const days = weekDays(foodDay());
  if (data.workspace && (!data.workspace.systems.gym || !data.workspace.systems.food)) return null;
  return (
    <Card>
      <SectionTitle
        title="Training & food context"
        sub="The same workout and bodyweight records, alongside your food diary. These observations do not establish cause and effect."
        action={<LinkButton to="food-diary">Weekly macros</LinkButton>}
      />
      <WeightTagFilter
        disabled={pending}
        entries={data.bodyweights}
        value={data.settings.weightFilter ?? allWeights}
        onChange={(filter) => {
          void run(() => saveSettings({ weightFilter: filter }));
        }}
      />
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Weekly food, training and bodyweight records"
      >
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>Completed workouts</th>
              <th>Recorded protein (g)</th>
              <th>Bodyweight ({data.settings.unit})</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const weighIns = filterWeights(data.bodyweights, data.settings.weightFilter)
                .filter((w) => foodDay(new Date(w.at)) === day)
                .sort((a, b) => b.at.localeCompare(a.at));
              return (
                <tr key={day}>
                  <td>{day}</td>
                  <td>
                    {
                      data.sessions.filter(
                        (s) => s.status === 'completed' && foodDay(new Date(s.startAt)) === day,
                      ).length
                    }
                  </td>
                  <td>
                    {food.foodEntries.some((e) => e.date === day)
                      ? foodNumber(dailyMacros(food, day).protein)
                      : 'Not logged'}
                  </td>
                  <td>
                    {weighIns[0]
                      ? foodNumber(fromKg(weighIns[0].kg, data.settings.unit))
                      : 'Not recorded'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
