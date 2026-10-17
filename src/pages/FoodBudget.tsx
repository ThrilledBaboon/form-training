import { AddToPage } from '../components/WorkspaceControls';
import { useState } from 'react';
import { useApp } from '../lib/context';
import { saveFoodSettings } from '../lib/food-actions';
import {
  foodDay,
  weekDays,
  shiftDay,
  money,
  foodNumber,
  stockValue,
  plannedNutrition,
  convertQuantity,
  recipeNutrition,
} from '../lib/food-calc';
import { FoodNav, useFood, IngredientSelect, FoodEmpty } from '../components/FoodUI';
import { Card, PageTitle, SectionTitle, Button, Field, Modal } from '../components/ui';
function BudgetSettings({ onClose }: { onClose: () => void }) {
  const food = useFood();
  const { run } = useApp();
  const [weekly, setWeekly] = useState(String(food.foodSettings.weeklyBudget ?? ''));
  const [monthly, setMonthly] = useState(String(food.foodSettings.monthlyBudget ?? ''));
  const [currency, setCurrency] = useState(food.foodSettings.currency);
  return (
    <Modal title="Food spending budgets" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await saveFoodSettings({
              ...food.foodSettings,
              currency,
              weeklyBudget: weekly ? Number(weekly) : undefined,
              monthlyBudget: monthly ? Number(monthly) : undefined,
            });
            onClose();
          }, 'Food budgets saved');
        }}
      >
        <Field label="Spending currency">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {[...new Set(['GBP', 'EUR', 'USD', currency])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <p className="small-text muted">
          Only records in this currency are totalled. Currency conversion and live exchange rates
          are not used.
        </p>
        <Field label="Weekly grocery budget (optional)">
          <input
            type="number"
            min={0.01}
            step="0.01"
            value={weekly}
            onChange={(e) => setWeekly(e.target.value)}
          />
        </Field>
        <Field label="Monthly grocery budget (optional)">
          <input
            type="number"
            min={0.01}
            step="0.01"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
          />
        </Field>
        <Button type="submit">Save food budgets</Button>
      </form>
    </Modal>
  );
}
export function FoodBudget() {
  const food = useFood();
  const [settings, setSettings] = useState(false);
  const today = foodDay(),
    week = weekDays(today),
    month = today.slice(0, 7) + '-01';
  const query = new URLSearchParams(location.hash.split('?')[1]);
  const [from, setFrom] = useState(query.get('from') ?? month),
    [to, setTo] = useState(query.get('to') ?? today);
  const [ingredientId, setIngredientId] = useState(query.get('ingredient') ?? '');
  const currency = food.foodSettings.currency;
  const purchases = food.purchases.filter((p) => p.currency === currency);
  const weekSpend = purchases
      .filter((p) => p.date >= week[0] && p.date <= week[6])
      .reduce((n, p) => n + p.total, 0),
    monthSpend = purchases
      .filter((p) => p.date.slice(0, 7) === today.slice(0, 7))
      .reduce((n, p) => n + p.total, 0);
  const selected = purchases.filter((p) => p.date >= from && p.date <= to);
  const retailer = [...new Set(selected.map((p) => p.retailer))]
    .map((name) => ({
      name,
      total: selected.filter((p) => p.retailer === name).reduce((n, p) => n + p.total, 0),
    }))
    .sort((a, b) => b.total - a.total);
  const stock = food.stock.filter((s) => s.quantity > 0),
    values = stock.map((s) => stockValue(s, currency)),
    knownValue = values.reduce<number>((n, v) => n + (v ?? 0), 0),
    unknownStock = values.filter((n) => n === undefined).length;
  const waste = food.movements.filter(
      (m) => m.kind === 'waste' && m.at.slice(0, 10) >= from && m.at.slice(0, 10) <= to,
    ),
    wasteCosts = waste.filter((m) => (m.currency ?? 'GBP') === currency && m.cost !== undefined);
  const wasteCost = wasteCosts.reduce((n, m) => n + m.cost!, 0);
  const meals = food.foodEntries.filter((e) => e.date >= from && e.date <= to),
    costed = meals.filter(
      (e) => e.snapshot.cost !== undefined && (e.snapshot.currency ?? 'GBP') === currency,
    );
  const totalServings = costed.reduce((n, e) => n + e.servings, 0),
    consumptionCost = costed.reduce((n, e) => n + e.snapshot.cost! * e.servings, 0);
  const planned = food.mealPlans.filter((p) => p.date >= today && p.date <= shiftDay(today, 6)),
    forecast = planned.map((p) => plannedNutrition(food, p).cost);
  const forecastTotal =
    forecast.length && forecast.every((n) => n !== undefined)
      ? forecast.reduce<number>((n, c) => n + c!, 0)
      : undefined;
  const ingredient = food.ingredients.find((i) => i.id === ingredientId);
  const prices = purchases
    .flatMap((p) =>
      p.lines
        .filter((l) => l.ingredientId === ingredientId)
        .map((l) => {
          const quantity =
            l.quantity &&
            convertQuantity(
              l.quantity * l.packages,
              l.unit,
              ingredient?.defaultUnit ?? l.unit,
              ingredient,
            );
          return {
            purchase: p,
            line: l,
            quantity,
            unit: ingredient?.defaultUnit ?? l.unit,
            normalised: quantity ? l.paid / quantity : undefined,
          };
        }),
    )
    .sort((a, b) => b.purchase.date.localeCompare(a.purchase.date));
  const dates = [...new Set(selected.map((p) => p.date))].sort();
  return (
    <>
      <FoodNav />
      <PageTitle
        eyebrow="FOOD & FINANCES"
        title="Spending, with context."
        description="Confirmed checkout spending alongside estimates of the food you use."
        action={
          <Button variant="secondary" onClick={() => setSettings(true)}>
            Set budgets & currency
          </Button>
        }
      />
      <div className="food-grid">
        <Card>
          <SectionTitle title="This week’s checkout spending" />
          <p className="food-money">{money(weekSpend, currency)}</p>
          {food.foodSettings.weeklyBudget ? (
            <>
              <p>of {money(food.foodSettings.weeklyBudget, currency)} weekly budget</p>
              <progress
                aria-label="Weekly food budget used"
                value={Math.min(weekSpend, food.foodSettings.weeklyBudget)}
                max={food.foodSettings.weeklyBudget}
              />
              <p>{money(food.foodSettings.weeklyBudget - weekSpend, currency)} remaining</p>
            </>
          ) : (
            <p className="muted">Weekly budget disabled</p>
          )}
        </Card>
        <Card>
          <SectionTitle title="This month’s checkout spending" />
          <p className="food-money">{money(monthSpend, currency)}</p>
          {food.foodSettings.monthlyBudget ? (
            <>
              <p>of {money(food.foodSettings.monthlyBudget, currency)} monthly budget</p>
              <progress
                aria-label="Monthly food budget used"
                value={Math.min(monthSpend, food.foodSettings.monthlyBudget)}
                max={food.foodSettings.monthlyBudget}
              />
              <p>{money(food.foodSettings.monthlyBudget - monthSpend, currency)} remaining</p>
            </>
          ) : (
            <p className="muted">Monthly budget disabled</p>
          )}
        </Card>
        <Card>
          <SectionTitle title="Estimated stock value" />
          <p className="food-money">{money(knownValue, currency)}</p>
          <p className="small-text muted">
            Known-price stock only. {unknownStock} packages have unknown or different-currency
            costs.
          </p>
        </Card>
      </div>
      <div className="food-filters">
        <Field label="Spending period from">
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Spending period to">
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <div className="two-col">
        <Card>
          <SectionTitle
            title="Checkout spending by retailer"
            sub="Actual reviewed purchases in the selected period."
            action={<AddToPage type="spending-trend" config={{ range: { days: 0, from, to } }} />}
          />
          {retailer.map((r) => (
            <div className="food-history-line" key={r.name}>
              <strong>{r.name}</strong>
              <span>{money(r.total, currency)}</span>
            </div>
          ))}
          {!retailer.length && <p className="muted">No purchases in this period and currency.</p>}
          <h3>Spending over time</h3>
          {dates.map((d) => (
            <div className="food-history-line" key={d}>
              <span>{d}</span>
              <strong>
                {money(
                  selected.filter((p) => p.date === d).reduce((n, p) => n + p.total, 0),
                  currency,
                )}
              </strong>
            </div>
          ))}
        </Card>
        <Card>
          <SectionTitle title="Consumption & waste estimates" />
          <p>
            Recorded food ingredient cost:{' '}
            <strong>{money(costed.length ? consumptionCost : undefined, currency)}</strong> across{' '}
            {costed.length}/{meals.length} costed entries.
          </p>
          <p>
            Estimated average per meal entry:{' '}
            <strong>
              {money(costed.length ? consumptionCost / costed.length : undefined, currency)}
            </strong>
          </p>
          <p>
            Estimated cost per serving:{' '}
            <strong>
              {money(totalServings ? consumptionCost / totalServings : undefined, currency)}
            </strong>
          </p>
          <p>
            Recorded waste: <strong>{waste.length} events</strong>; known estimated waste cost{' '}
            <strong>{money(wasteCost, currency)}</strong> ({wasteCosts.length}/{waste.length}{' '}
            costed).
          </p>
          <p>
            Next 7 days’ planned ingredient cost: <strong>{money(forecastTotal, currency)}</strong>{' '}
            across {planned.length} planned meals.
          </p>
          <p className="small-text muted">
            Consumption estimates use saved meal snapshots. They do not add purchases or change
            actual checkout spending. Forecasts omit no unknown costs: incomplete totals stay
            unknown.
          </p>
        </Card>
      </div>
      <Card>
        <SectionTitle
          title="Ingredient price history"
          action={
            <AddToPage type="prices" config={{ ingredientId, range: { days: 0, from, to } }} />
          }
          sub="Normalised from your recorded package quantities and net paid amounts, in the selected currency."
        />
        <IngredientSelect food={food} value={ingredientId} onChange={setIngredientId} />
        <p className="small-text muted">
          Comparisons use the same ingredient record. Keep separate ingredients for materially
          different products or brands; these are your historical prices, not live retailer offers.
        </p>
        {prices.length ? (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Recorded ingredient price history"
          >
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Retailer</th>
                  <th>Product</th>
                  <th>Paid</th>
                  <th>Normalised price</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p) => (
                  <tr key={p.purchase.id + p.line.id}>
                    <td>{p.purchase.date}</td>
                    <td>{p.purchase.retailer}</td>
                    <td>{p.line.description}</td>
                    <td>{money(p.line.paid, currency)}</td>
                    <td>
                      {p.normalised === undefined
                        ? 'Unknown'
                        : `${money(p.normalised * 100, currency)} / 100 ${p.unit}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            Choose an ingredient with recorded purchases to compare its price history.
          </p>
        )}
      </Card>
      <Card>
        <SectionTitle title="Recorded food waste" />
        {waste.map((m) => (
          <div className="food-history-line" key={m.id}>
            <strong>
              {food.ingredients.find((i) => i.id === m.ingredientId)?.name ??
                food.batches.find((b) => b.id === m.batchId)?.name ??
                'Food'}
            </strong>
            <span>
              {foodNumber(-m.quantity)} {m.unit} ·{' '}
              {(m.currency ?? 'GBP') === currency ? money(m.cost, currency) : 'Other currency'}
            </span>
            <small>
              {m.at.slice(0, 10)} · {m.notes}
            </small>
          </div>
        ))}
        {!waste.length && <p className="muted">No waste recorded in the selected period.</p>}
      </Card>
      {settings && <BudgetSettings onClose={() => setSettings(false)} />}
    </>
  );
}
