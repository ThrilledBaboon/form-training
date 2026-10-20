import { useEffect, useState } from 'react';
import { useApp } from '../lib/context';
import { ageOn } from '../lib/profile-model';
import { filterWeights } from '../lib/weight-tags';
import { fromKg, toKg } from '../lib/calc';
import {
  activityNames,
  estimateFoodGoals,
  applyFoodGoals,
  setCalorieVisibility,
  type FoodGoalInputs,
  type FoodGoalPreview,
} from '../lib/food-goals';
import { macroKeys, macroNames } from '../lib/food-model';
import { foodNumber } from '../lib/food-calc';
import { useFood } from './FoodUI';
import { Card, SectionTitle, Button, AsyncButton, Field, Modal } from './ui';
export function FoodDisplayPreference({ card = false }: { card?: boolean }) {
  const food = useFood();
  const { run, pending } = useApp();
  const [visible, setVisible] = useState(!!food.foodSettings.showCalories);
  const [saving, setSaving] = useState(false);
  useEffect(() => setVisible(!!food.foodSettings.showCalories), [food.foodSettings.showCalories]);
  const content = (
    <>
      {card && (
        <SectionTitle title="Food preferences" sub="Choose what appears in your food summaries." />
      )}
      <label className="check-label">
        <input
          type="checkbox"
          role="switch"
          checked={visible}
          disabled={pending || saving}
          onChange={(e) => {
            const value = e.target.checked;
            setVisible(value);
            setSaving(true);
            void run(async () => {
              await setCalorieVisibility(value);
              return true;
            }).then((saved) => {
              if (!saved) setVisible(!value);
              setSaving(false);
            });
          }}
        />
        Show calories
      </label>
      <p className="small-text muted">
        Hidden by default. Food energy is estimated from recorded macros in the background. Changing
        this display choice keeps your food history and goals.
      </p>
    </>
  );
  return card ? <Card>{content}</Card> : content;
}
export function FoodGoalBuilder() {
  const { data, run, pending } = useApp();
  const food = useFood();
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState<FoodGoalInputs['goal']>(
    food.foodSettings.goalSetup?.goal ?? 'maintain',
  );
  const [age, setAge] = useState(
    data.workspace?.profile?.birthday ? String(ageOn(data.workspace.profile.birthday)) : '',
  );
  const [height, setHeight] = useState(String(data.workspace?.profile?.heightCm ?? ''));
  const latest = filterWeights(data.bodyweights, data.settings.weightFilter).sort((a, b) =>
    b.at.localeCompare(a.at),
  )[0];
  const [weight, setWeight] = useState(
    latest ? String(Number(fromKg(latest.kg, data.settings.unit).toFixed(2))) : '',
  );
  const [equation, setEquation] = useState<FoodGoalInputs['equation'] | ''>('');
  const [activity, setActivity] = useState<FoodGoalInputs['activity']>('light');
  const [show, setShow] = useState(!!food.foodSettings.showCalories);
  const [applicable, setApplicable] = useState(false);
  const [preview, setPreview] = useState<FoodGoalPreview>();
  const [error, setError] = useState('');
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setShow(!!food.foodSettings.showCalories);
          setOpen(true);
        }}
      >
        {food.foodSettings.goalSetup ? 'Review food goals' : 'Set food goals'}
      </Button>
      {open && (
        <Modal
          title={preview ? 'Review your food goals' : 'Set up your food goals'}
          wide
          onClose={() => setOpen(false)}
        >
          {!preview ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                try {
                  if (!applicable || !equation) throw Error('Complete the estimate details first.');
                  setPreview(
                    estimateFoodGoals({
                      goal,
                      age: Number(age),
                      heightCm: Number(height),
                      weightKg: toKg(Number(weight), data.settings.unit),
                      equation,
                      activity,
                    }),
                  );
                  setError('');
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : 'Check your details.');
                }
              }}
            >
              <p>
                Generate an editable starting estimate for a healthy adult. These details are used
                for this estimate; changing them here does not add a weigh-in or edit your profile.
              </p>
              <div className="form-grid">
                <Field label="Your food goal">
                  <select value={goal} onChange={(e) => setGoal(e.target.value as typeof goal)}>
                    <option value="maintain">Maintain weight</option>
                    <option value="lose">Lose weight</option>
                    <option value="gain">Gain weight</option>
                  </select>
                </Field>
                <Field label="Age (years)">
                  <input
                    required
                    type="number"
                    min={18}
                    max={80}
                    step={1}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </Field>
                <Field label="Height for estimate (cm)">
                  <input
                    required
                    type="number"
                    min={120}
                    max={230}
                    step="any"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                  />
                </Field>
                <Field label={`Current weight for estimate (${data.settings.unit})`}>
                  <input
                    required
                    type="number"
                    min={fromKg(30, data.settings.unit)}
                    max={fromKg(350, data.settings.unit)}
                    step="any"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                </Field>
                <Field
                  label="Equation coefficient"
                  hint="Mifflin–St Jeor uses a sex-based coefficient. If neither suits you, use manual macro targets in the Food diary."
                >
                  <select
                    required
                    value={equation}
                    onChange={(e) => setEquation(e.target.value as typeof equation)}
                  >
                    <option value="">Choose a coefficient</option>
                    <option value="female">Female equation</option>
                    <option value="male">Male equation</option>
                  </select>
                </Field>
                <Field label="Typical activity">
                  <select
                    value={activity}
                    onChange={(e) => setActivity(e.target.value as typeof activity)}
                  >
                    {Object.entries(activityNames).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Would you like to see calories?">
                  <select
                    value={show ? 'yes' : 'no'}
                    onChange={(e) => setShow(e.target.value === 'yes')}
                  >
                    <option value="no">No · show macros only</option>
                    <option value="yes">Yes · show estimated calories</option>
                  </select>
                </Field>
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  required
                  checked={applicable}
                  onChange={(e) => setApplicable(e.target.checked)}
                />
                I’m an adult, not pregnant or breastfeeding, and do not need a medically prescribed
                diet.
              </label>
              <p className="small-text muted">
                For other needs, use targets agreed with a qualified professional. You can enter
                your own gram targets in the Food diary.
              </p>
              {error && <p role="alert">{error}</p>}
              <div className="modal-actions">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Preview food goals</Button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await applyFoodGoals(preview, show);
                  setOpen(false);
                  setPreview(undefined);
                }, 'Food goals saved');
              }}
            >
              <p>
                Daily starting targets for{' '}
                {preview.goal === 'maintain'
                  ? 'maintenance'
                  : preview.goal === 'lose'
                    ? 'gradual weight loss'
                    : 'gradual weight gain'}
                . Estimates vary between people; review and adjust them as you learn what suits you.
              </p>
              <div className="form-grid">
                {macroKeys.map((key) => (
                  <Field key={key} label={`${macroNames[key]} target (g)`}>
                    <input
                      required
                      type="number"
                      min={0.1}
                      step="any"
                      value={preview.targets[key] ?? ''}
                      onChange={(e) =>
                        setPreview({
                          ...preview,
                          targets: {
                            ...preview.targets,
                            [key]: e.target.value === '' ? undefined : Number(e.target.value),
                          },
                        })
                      }
                    />
                  </Field>
                ))}
                {show && (
                  <Field label="Estimated daily calories (kcal)">
                    <input
                      required
                      type="number"
                      min={1}
                      max={20000}
                      step={1}
                      value={preview.calorieTarget}
                      onChange={(e) =>
                        setPreview({ ...preview, calorieTarget: Number(e.target.value) })
                      }
                    />
                  </Field>
                )}
              </div>
              <p className="small-text muted">
                Based on the Mifflin–St Jeor equation, your activity choice and a modest adjustment
                for your goal. Protein starts at 1.6 g/kg, limited to 30% of estimated energy; fat
                uses 30%, carbohydrates the remainder, and fibre 30 g.
              </p>
              <p>
                {show
                  ? `Estimated energy target: ${foodNumber(preview.calorieTarget, 0)} kcal. Calories will be visible.`
                  : 'Calories will stay hidden. You can change this in Food preferences.'}
              </p>
              <p>
                <a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noreferrer">
                  Estimate method
                </a>{' '}
                ·{' '}
                <a
                  href="https://www.nhs.uk/live-well/eat-well/digestive-health/how-to-get-more-fibre-into-your-diet/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Fibre guidance
                </a>
              </p>
              <div className="modal-actions">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setPreview(undefined)}
                >
                  Back to details
                </Button>
                <Button type="submit" disabled={pending}>
                  Apply food goals
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
