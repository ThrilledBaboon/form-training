import { useState } from 'react';
import { useApp } from '../lib/context';
import { climbingWeek, emptyClimbing } from '../lib/climbing-model';
import { saveClimbingGoal } from '../lib/climbing-actions';
import { Button, Field, Modal } from './ui';

function ClimbingGoalDialog({ onClose }: { onClose: () => void }) {
  const { data, run } = useApp();
  const goal = data.climbing?.goal;
  const [expected] = useState(goal?.updatedAt);
  const [target, setTarget] = useState(String(goal?.weeklySessions ?? 2));
  return (
    <Modal title="Your climbing goal" onClose={onClose}>
      <p>
        How often would you like to climb? Choose a weekly target that fits around the rest of your
        training.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await saveClimbingGoal(Number(target), expected);
            onClose();
          }, 'Climbing goal saved');
        }}
      >
        <Field label="Climbing sessions per week">
          <input
            type="number"
            min={1}
            max={14}
            step={1}
            required
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </Field>
        <p className="small-text muted">
          Bouldering, top rope, auto belay and lead all count. Your week runs Monday to Sunday. You
          can change this goal any time.
        </p>
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save climbing goal</Button>
        </div>
      </form>
    </Modal>
  );
}

export function ClimbingSetupButton({ label }: { label?: string }) {
  const { data } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {label ?? (data.climbing?.goal ? 'Edit climbing goal' : 'Set up climbing')}
      </Button>
      {open && <ClimbingGoalDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function ClimbingWeeklyGoal() {
  const { data } = useApp();
  const week = climbingWeek(data.climbing ?? emptyClimbing);
  return (
    <div className="climbing-week-goal">
      <p className="widget-number">
        {week.completed}
        <small>{week.target ? ` / ${week.target} sessions` : ' sessions this week'}</small>
      </p>
      {week.target ? (
        <>
          <progress
            aria-label="Weekly climbing goal"
            max={week.target}
            value={Math.min(week.completed, week.target)}
          />
          <p>
            {week.completed >= week.target
              ? 'Weekly goal reached.'
              : `${week.target - week.completed} more ${week.target - week.completed === 1 ? 'session' : 'sessions'} to reach your goal.`}
          </p>
        </>
      ) : (
        <p>Choose how many climbing sessions you’re aiming for each week.</p>
      )}
      <p className="small-text muted">
        {week.from} – {week.to} · completed sessions
      </p>
      <ClimbingSetupButton label={week.target ? 'Change weekly target' : 'Choose weekly target'} />
    </div>
  );
}
