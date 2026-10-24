import { useEffect, useRef } from 'react';
import { go } from '../lib/context';
import { Button, Card } from './ui';
import './FoodGuide.css';

const steps = [
  {
    title: 'Choose a programme',
    description:
      'Open Manage programmes. For the filling-bowl plan, choose Review starter programme, then Import programme. This adds meals to your library; it does not record eating.',
    tip: 'Already have a programme? You can use that one instead.',
    action: 'Open Manage programmes',
    route: 'food-programmes',
  },
  {
    title: 'Preview and start',
    description:
      'Choose View programme to look through the menu. Then choose Start programme, check the date and included meals, and review Foods I avoid. Expand Preview dated meals before confirming Start programme & fill empty slots.',
    tip: 'The starter repeats a seven-day menu for 30 days. Existing planned meals are kept.',
    action: 'Open programme setup',
    route: 'food-programmes',
  },
  {
    title: 'View a meal or make a swap',
    description:
      'Today shows your breakfast, lunch and dinner. Open View meal for ingredients and cooking steps. Choose Swap if you would prefer another meal. Changing the plan does not record it as eaten.',
    tip: 'More contains your saved Menu, Meal planner, shopping and other optional food tools.',
    action: 'Open today’s meals',
    route: 'food-home',
  },
  {
    title: 'Record what you ate',
    description:
      'After eating, choose Ate this, check the meal and save the check-in. Notes and quantities are optional. Your Food diary keeps the record; Edit check-in or Undo lets you correct a mistake.',
    tip: '“Unmeasured” is a valid quick check-in. It means you recorded the meal without weighing it, so its nutrition totals are unknown.',
    action: 'Go to today’s meals',
    route: 'food-home',
  },
];

export function FoodGuide({
  step,
  onStep,
  onClose,
}: {
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const current = steps[step];
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  return (
    <div className="food-guide" role="region" aria-labelledby="food-guide-title">
      <Card>
        <div className="food-guide-heading">
          <span className="eyebrow">
            FOOD GUIDE · {step + 1} OF {steps.length}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Skip guide
          </Button>
        </div>
        <h2 id="food-guide-title" ref={heading} tabIndex={-1}>
          {current.title}
        </h2>
        <p>{current.description}</p>
        <p className="small-text muted">{current.tip}</p>
        <div className="food-guide-actions">
          <Button variant="secondary" onClick={() => go(current.route)}>
            {current.action}
          </Button>
          <div className="inline-actions">
            {step > 0 && (
              <Button variant="ghost" onClick={() => onStep(step - 1)}>
                Back
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button onClick={() => onStep(step + 1)}>Next step</Button>
            ) : (
              <Button onClick={onClose}>Finish guide</Button>
            )}
          </div>
        </div>
        <p className="small-text muted">
          Follow along at your own pace. Show me how restarts this guide whenever you need it.
        </p>
      </Card>
    </div>
  );
}
