import { CircleHelp } from 'lucide-react';
import { useState } from 'react';
import { FoodNav } from '../components/FoodUI';
import { SuggestMealButton } from '../components/MealSuggestions';
import { Button, Card, PageTitle } from '../components/ui';
import { foodDay } from '../lib/food-calc';
import type { MealPlan } from '../lib/food-model';
import { CustomPages } from './CustomPages';
import { ProgrammeDay } from './FoodProgrammes';
import { PlanEditor } from './FoodPlanner';
import './FoodHome.css';

export function FoodHome({ onShowHelp }: { onShowHelp?: () => void }) {
  const today = foodDay();
  const [planSlot, setPlanSlot] = useState<MealPlan['slot']>();
  const dayLabel = new Date(today + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return (
    <>
      <FoodNav />
      <PageTitle
        eyebrow="YOUR FOOD"
        title="Today’s food"
        description="View your meals, make a swap and record what you ate."
        action={
          onShowHelp && (
            <Button variant="secondary" onClick={onShowHelp}>
              <CircleHelp size={16} aria-hidden="true" />
              Show me how
            </Button>
          )
        }
      />
      <div data-food-guide="daily-meals" className="food-home-daily">
        <Card>
          <div className="food-home-day-heading">
            <div>
              <h2>Today’s meals</h2>
              <p className="small-text muted">{dayLabel}</p>
            </div>
            <SuggestMealButton />
          </div>
          <ProgrammeDay date={today} includeAllPlans showEmptySlots onPlanSlot={setPlanSlot} />
          <p className="small-text muted food-home-check-in-hint">
            Planned meals become diary entries only when you save an “Ate this” check-in. Quantities
            are optional.
          </p>
        </Card>
      </div>
      <details className="food-home-widgets">
        <summary>My food widgets</summary>
        <p className="small-text muted">
          Your saved graphs and widgets are here. Edit the page to arrange your own view.
        </p>
        <CustomPages pageId="food-home" embedded />
      </details>
      {planSlot && (
        <PlanEditor date={today} defaultSlot={planSlot} onClose={() => setPlanSlot(undefined)} />
      )}
    </>
  );
}
