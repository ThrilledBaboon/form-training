import { useState } from 'react';
import { useApp } from '../lib/context';
import { weeklyReview } from '../lib/weekly-review';
import { foodDay, foodNumber } from '../lib/food-calc';
import { macroKeys } from '../lib/food-model';
import { Button, Card, Empty, Field, PageTitle } from './ui';
export function WeeklyReviewView({
  date,
  standalone = false,
}: {
  date?: string;
  standalone?: boolean;
}) {
  const Heading = standalone ? 'h2' : 'h3';
  const { data } = useApp(),
    r = weeklyReview(data, date);
  if (!Object.values(r.systems).some(Boolean))
    return <p>Enable a system in Settings to see its recorded week.</p>;
  if (!r.recordedDays)
    return (
      <Empty title="This week hasn’t started">
        Choose this week or a previous week to review saved records.
      </Empty>
    );
  return (
    <div className="weekly-review">
      <p className="small-text muted">
        {r.from} – {r.to}
        {r.to < r.through ? ' · Week so far' : ''}
      </p>
      {(r.systems.gym || r.systems.climbing) && (
        <>
          <p className="widget-number">
            {r.activityDays}
            <small> activity days recorded</small>
          </p>
          <p>
            {foodNumber(r.knownMinutes, 0)} recorded minutes
            {r.unknownDurations > 0
              ? ` · ${r.unknownDurations} sessions with unknown duration`
              : ''}
          </p>
        </>
      )}
      {r.systems.gym && (
        <section>
          <Heading>Training</Heading>
          <p>
            {r.gym.length} completed workouts · {r.gymSets} working sets
          </p>
          <p className="small-text muted">
            {r.previousGym} workouts in the equivalent days of the previous week.
          </p>
          <a href={'#/history?from=' + r.from + '&to=' + r.to}>Review workout history</a>
        </section>
      )}
      {r.systems.climbing && (
        <section>
          <Heading>Climbing</Heading>
          <p>
            {r.climbing.length} completed sessions · {r.climbingAttempts} attempts ·{' '}
            {r.climbingCompletions} clean completions
          </p>
          <p className="small-text muted">
            {r.previousClimbing} sessions in the equivalent days of the previous week.
          </p>
          <a href="#/climbing-log">Review climbing sessions</a>
        </section>
      )}
      {r.systems.food && (
        <section>
          <Heading>Food</Heading>
          <p>
            {r.foodDates.length} of {r.recordedDays} days with food logged. Unlogged days stay
            unknown.
          </p>
          {macroKeys.map((key) => {
            const m = r.macros[key];
            return (
              <div className="widget-row" key={key}>
                <span>
                  {key === 'carbs' ? 'Carbs' : key[0].toUpperCase() + key.slice(1)}
                  <small>
                    {m.knownDays} logged days with known totals
                    {m.unknownDays ? ` · ${m.unknownDays} incomplete` : ''}
                  </small>
                </span>
                <strong>
                  {m.average === undefined ? 'Unknown' : foodNumber(m.average) + ' g average'}
                </strong>
              </div>
            );
          })}
          <p className="small-text muted">
            Averages use known totals on logged days only. A logged day may still be incomplete.
          </p>
          <a href={'#/food-diary?date=' + r.to}>Review food diary</a>
        </section>
      )}
      <p className="small-text muted">
        These are observations from saved records. No recovery score or relationship between food
        and performance is inferred.
      </p>
    </div>
  );
}
export function WeeklyReviewPage() {
  const params = new URLSearchParams(location.hash.split('?')[1]);
  const raw = params.get('date');
  const [date, setDate] = useState(
    raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !isNaN(Date.parse(raw)) ? raw : foodDay(),
  );
  return (
    <>
      <PageTitle
        eyebrow="YOUR WORKSPACE"
        title="Weekly review"
        description="A view of your recorded week, with missing information left visible."
      />
      <Field label="Review week containing">
        <input
          type="date"
          value={date}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
        />
      </Field>
      <Card>
        <WeeklyReviewView date={date} standalone />
        <Button
          variant="secondary"
          onClick={() => {
            location.hash = '/week-planner?date=' + date;
          }}
        >
          Open this week in planner
        </Button>
      </Card>
    </>
  );
}
