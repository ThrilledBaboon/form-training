import { foodNumber } from '../lib/food-calc';
import type { Recipe } from '../lib/food-model';
import { FoodImage, useFood } from './FoodUI';

const roleNames = {
  protein: 'Protein',
  volume: 'Fruit, vegetables & volume',
  fat: 'Fat choice',
  flavouring: 'Flavourings',
  other: 'Other foods',
};

/** The same usable recipe instructions wherever a meal is suggested or planned. */
export function MealRecipeGuide({
  recipe,
  servings,
  headingLevel = 'h3',
}: {
  recipe: Recipe;
  servings?: number;
  headingLevel?: 'h3' | 'h4' | 'h5';
}) {
  const food = useFood();
  const Heading = headingLevel;
  const scale = servings === undefined ? 1 : servings / recipe.servings;
  const lines = recipe.composition?.length
    ? recipe.composition.map((line) => ({
        ...line,
        note: line.guidance,
        optional: false,
        roleName: roleNames[line.role],
      }))
    : recipe.ingredients.map((line) => ({
        ...line,
        name: undefined,
        note: line.notes,
        roleName: undefined,
      }));
  const minutes = recipe.prepMinutes + recipe.cookMinutes;
  return (
    <div className="programme-composition meal-recipe-guide">
      {recipe.description && <p className="preserve-lines">{recipe.description}</p>}
      {minutes > 0 && (
        <p className="small-text preserve-lines">
          <strong>Approximate time:</strong> {foodNumber(minutes, 0)} min
          {recipe.prepMinutes > 0 &&
            recipe.cookMinutes > 0 &&
            ` (${foodNumber(recipe.prepMinutes, 0)} min preparation + ${foodNumber(recipe.cookMinutes, 0)} min cooking)`}
        </p>
      )}
      {recipe.equipment.some(Boolean) && (
        <p className="small-text preserve-lines">
          <strong>Equipment:</strong> {recipe.equipment.filter(Boolean).join(', ')}
        </p>
      )}
      <Heading>Ingredients</Heading>
      {servings !== undefined && !recipe.unmeasured && (
        <p className="small-text muted">
          For {foodNumber(servings)} serving{servings === 1 ? '' : 's'}.
        </p>
      )}
      {recipe.unmeasured && (
        <p className="small-text muted">
          Flexible portions; weighing is optional. Unrecorded quantities mean nutrition and stock
          coverage are unknown.
        </p>
      )}
      {lines.length ? (
        <ul>
          {lines.map((line, i) => (
            <li key={line.ingredientId + '-' + i}>
              <strong>
                {line.name ??
                  food.ingredients.find((ingredient) => ingredient.id === line.ingredientId)
                    ?.name ??
                  'Unavailable ingredient'}
              </strong>
              {line.quantity !== undefined && line.unit
                ? ` · ${foodNumber(line.quantity * scale)} ${line.unit}`
                : !line.note
                  ? ' · amount unmeasured'
                  : ''}
              {line.quantity !== undefined && line.state !== 'as sold' && ` (${line.state})`}
              {line.optional && ' (optional)'}
              {line.note && ` · ${line.note}`}
              {line.roleName && <span className="muted small-text"> ({line.roleName})</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No ingredients recorded yet.</p>
      )}
      <Heading>Method</Heading>
      {recipe.steps.some((step) => step.text.trim()) ? (
        <ol className="food-method">
          {recipe.steps
            .filter((step) => step.text.trim())
            .map((step) => (
              <li key={step.id}>
                <p className="preserve-lines">{step.text}</p>
                <FoodImage id={step.imageId} alt="Cooking step" className="food-step-image" />
              </li>
            ))}
        </ol>
      ) : (
        <p className="muted">No cooking steps recorded yet.</p>
      )}
      {[
        ['Notes', recipe.notes],
        ['Storage', recipe.storage],
        ['Reheating', recipe.reheating],
        ['Batch cooking', recipe.batchNotes],
      ]
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <p className="preserve-lines" key={label}>
            <strong>{label}:</strong> {value}
          </p>
        ))}
      {recipe.sourceUrl && (
        <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
          Recipe inspiration & source
        </a>
      )}
    </div>
  );
}
