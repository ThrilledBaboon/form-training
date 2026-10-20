import { useApp } from '../lib/context';
import { combinedWeek } from '../lib/week-planner';
import { defaultWorkspace } from '../lib/workspace-model';
export function CombinedWeekWidget({ date }: { date?: string }) {
  const { data } = useApp();
  if (!Object.values((data.workspace ?? defaultWorkspace()).systems).some(Boolean))
    return <p>Enable a system in Settings to plan your week.</p>;
  return (
    <>
      {combinedWeek(data, date).map((d) => {
        const plans =
          d.plans.filter(
            (p) => p.status === 'planned' && !d.workouts.some((s) => s.planId === p.id),
          ).length +
          d.routines.length +
          d.climbingPlans.length +
          d.practice.reduce((n, p) => n + p.routines.length, 0);
        const completed =
          d.workouts.length +
          d.climbs.length +
          d.practice.reduce((n, p) => n + p.completed.length, 0);
        return (
          <a className="widget-row" key={d.day} href={'#/week-planner?date=' + d.day}>
            <span>
              <strong>
                {new Date(d.day + 'T12:00:00').toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                })}
              </strong>
              <small>
                {plans} session plans · {d.meals.length} meals planned
              </small>
            </span>
            <span>
              {completed} sessions done{d.foodEntries.length ? ' · food logged' : ''}
            </span>
          </a>
        );
      })}
      <a className="text-link" href="#/week-planner">
        Open week planner
      </a>
    </>
  );
}
