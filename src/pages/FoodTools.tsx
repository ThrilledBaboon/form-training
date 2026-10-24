import { ChevronRight } from 'lucide-react';
import { FoodNav } from '../components/FoodUI';
import { FoodDisplayPreference, FoodGoalBuilder } from '../components/FoodGoals';
import { Button, Card, PageTitle } from '../components/ui';

const groups = [
  {
    title: 'Meals & planning',
    links: [
      {
        route: 'food-menu',
        name: 'Menu',
        description: 'Your saved recipes and bowls. View ingredients, cooking steps or add a meal.',
      },
      {
        route: 'food-planner',
        name: 'Meal planner',
        description: 'See upcoming meals and choose what to eat on particular dates.',
      },
    ],
  },
  {
    title: 'Food tools',
    links: [
      {
        route: 'food-shopping',
        name: 'Shopping',
        description: 'Create a shopping list yourself or build one from your planned meals.',
      },
      {
        route: 'food-kitchen',
        name: 'Kitchen stock',
        description: 'Keep track of ingredients, expiry dates and prepared food you have at home.',
      },
      {
        route: 'food-budget',
        name: 'Spending',
        description: 'Review recorded grocery costs and set an optional food budget.',
      },
      {
        route: 'food-ingredients',
        name: 'Ingredients',
        description: 'Manage the ingredients and product nutrition used in your recipes.',
      },
    ],
  },
];

export function FoodTools({ onShowHelp }: { onShowHelp?: () => void }) {
  return (
    <>
      <PageTitle
        eyebrow="YOUR FOOD"
        title="More food tools"
        description="Saved meals, planning and tools to use whenever you need them."
        action={
          onShowHelp && (
            <Button variant="secondary" onClick={onShowHelp}>
              Show me how
            </Button>
          )
        }
      />
      <FoodNav />
      <div className="food-grid">
        {groups.map((group) => (
          <Card key={group.title}>
            <h2>{group.title}</h2>
            {group.links.map((link) => (
              <a className="widget-row" href={'#/' + link.route} key={link.route}>
                <span>
                  <strong>{link.name}</strong>
                  <small>{link.description}</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </a>
            ))}
          </Card>
        ))}
      </div>
      <details>
        <summary>Food preferences</summary>
        <p className="small-text muted">Optional nutrition goals and display choices.</p>
        <FoodGoalBuilder />
        <FoodDisplayPreference />
      </details>
    </>
  );
}
