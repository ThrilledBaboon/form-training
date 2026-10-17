import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useApp, go } from '../lib/context';
import { uid, now } from '../lib/model';
import { type Stock, type Batch, BatchSchema } from '../lib/food-model';
import { saveStock, wasteStock, wasteBatch, saveFoodSettings } from '../lib/food-actions';
import { foodDay, shiftDay, foodNumber, money, stockValue } from '../lib/food-calc';
import { db } from '../lib/db';
import {
  FoodNav,
  useFood,
  IngredientSelect,
  UnitSelect,
  FoodEmpty,
  MacroSummary,
  CookModal,
} from '../components/FoodUI';
import { IngredientEditor } from './FoodIngredients';
import {
  Card,
  PageTitle,
  SectionTitle,
  Button,
  AsyncButton,
  Field,
  Modal,
  Badge,
} from '../components/ui';
function StockEditor({ initial, onClose }: { initial?: Stock; onClose: () => void }) {
  const food = useFood();
  const { run } = useApp();
  const [newIngredient, setNewIngredient] = useState(false);
  const [value, set] = useState<Stock>(
    initial ?? {
      id: uid(),
      ingredientId: '',
      quantity: 0,
      originalQuantity: 0,
      unit: 'g',
      location: food.foodSettings.locations[0],
      expiryKind: 'best-before',
      confidence: 'confirmed',
      brand: '',
      notes: '',
      createdAt: now(),
    },
  );
  const patch = (p: Partial<Stock>) => set({ ...value, ...p });
  return (
    <Modal title={initial ? 'Check or adjust stock' : 'Add kitchen stock'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await saveStock({
              ...value,
              originalQuantity: initial?.originalQuantity ?? value.quantity,
              currency: initial?.currency ?? food.foodSettings.currency,
            });
            onClose();
          }, 'Kitchen stock saved');
        }}
      >
        <IngredientSelect
          food={food}
          value={value.ingredientId}
          disabled={!!initial}
          onChange={(ingredientId) => {
            const ingredient = food.ingredients.find((i) => i.id === ingredientId);
            patch({
              ingredientId,
              unit: ingredient?.defaultUnit ?? 'g',
              location: ingredient?.location ?? value.location,
              brand: ingredient?.brand ?? '',
              packageSize:
                ingredient?.package?.unit === ingredient?.defaultUnit
                  ? ingredient?.package?.quantity
                  : undefined,
            });
          }}
        />
        {!initial && (
          <Button type="button" variant="ghost" onClick={() => setNewIngredient(true)}>
            New ingredient
          </Button>
        )}
        <div className="form-grid">
          <Field label="Quantity remaining">
            <input
              type="number"
              required
              min={0}
              step="any"
              value={value.quantity}
              onChange={(e) => patch({ quantity: Number(e.target.value) })}
            />
          </Field>
          <UnitSelect
            value={value.unit}
            disabled={!!initial}
            onChange={(unit) => patch({ unit })}
          />
          <Field label="Package size (same unit)">
            <input
              type="number"
              min={0}
              step="any"
              value={value.packageSize ?? ''}
              onChange={(e) =>
                patch({ packageSize: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </Field>
          <Field label="Storage location">
            <select value={value.location} onChange={(e) => patch({ location: e.target.value })}>
              {[...new Set([...food.foodSettings.locations, value.location])].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Purchase date">
            <input
              type="date"
              value={value.purchased ?? ''}
              onChange={(e) => patch({ purchased: e.target.value || undefined })}
            />
          </Field>
          <Field label="Opened date (blank = unopened)">
            <input
              type="date"
              value={value.opened ?? ''}
              onChange={(e) => patch({ opened: e.target.value || undefined })}
            />
          </Field>
          <Field label="Expiry date">
            <input
              type="date"
              value={value.expires ?? ''}
              onChange={(e) => patch({ expires: e.target.value || undefined })}
            />
          </Field>
          <Field label="Date type">
            <select
              value={value.expiryKind}
              onChange={(e) => patch({ expiryKind: e.target.value as Stock['expiryKind'] })}
            >
              <option value="best-before">Best before</option>
              <option value="use-by">Use by</option>
            </select>
          </Field>
          <Field
            label={
              'Price paid for original quantity (' +
              (initial?.currency ?? food.foodSettings.currency) +
              ')'
            }
            hint={
              initial
                ? `Original recorded amount: ${foodNumber(initial.originalQuantity)} ${initial.unit}`
                : undefined
            }
          >
            <input
              type="number"
              min={0}
              step="0.01"
              value={value.price ?? ''}
              onChange={(e) =>
                patch({ price: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </Field>
          <Field label="Stock confidence">
            <select
              value={value.confidence}
              onChange={(e) => patch({ confidence: e.target.value as Stock['confidence'] })}
            >
              {['confirmed', 'estimated', 'needs checking'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Package brand">
            <input value={value.brand} onChange={(e) => patch({ brand: e.target.value })} />
          </Field>
        </div>
        <Field label="Stock notes">
          <textarea value={value.notes} onChange={(e) => patch({ notes: e.target.value })} />
        </Field>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save stock</Button>
        </div>
      </form>
      {newIngredient && (
        <IngredientEditor
          onClose={() => setNewIngredient(false)}
          onSaved={(i) => patch({ ingredientId: i.id, unit: i.defaultUnit, location: i.location })}
        />
      )}
    </Modal>
  );
}
function WasteEditor({
  stock,
  batch,
  onClose,
}: {
  stock?: Stock;
  batch?: Batch;
  onClose: () => void;
}) {
  const { run } = useApp();
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('');
  return (
    <Modal title="Record food waste" onClose={onClose}>
      <p>Discarding food reduces the recorded balance and adds a waste record.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (stock) await wasteStock(stock.id, quantity, reason);
            if (batch) await wasteBatch(batch.id, quantity, reason);
            onClose();
          }, 'Food waste recorded');
        }}
      >
        <Field label={'Amount discarded (' + (stock?.unit ?? 'portions') + ')'}>
          <input
            required
            type="number"
            min={0.001}
            max={stock?.quantity ?? batch?.remaining}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </Field>
        <Field label="Reason / waste notes">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger">
            Confirm discarded food
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function BatchEditor({ batch, onClose }: { batch: Batch; onClose: () => void }) {
  const food = useFood();
  const { run } = useApp();
  const [location, setLocation] = useState(batch.location);
  const [expires, setExpires] = useState(batch.expires ?? '');
  const [notes, setNotes] = useState(batch.notes);
  return (
    <Modal title="Prepared meal storage" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await db.transaction('rw', db.batches, async () => {
              const current = await db.batches.get(batch.id);
              if (!current) throw Error('Batch not found.');
              await db.batches.put(
                BatchSchema.parse({ ...current, location, expires: expires || undefined, notes }),
              );
            });
            onClose();
          }, 'Prepared meal storage updated');
        }}
      >
        <Field label="Batch location">
          <select value={location} onChange={(e) => setLocation(e.target.value)}>
            {[...new Set([...food.foodSettings.locations, location])].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Batch use-by date">
          <input
            type="date"
            min={batch.prepared}
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
        </Field>
        <Field label="Batch notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button type="submit">Save prepared meal storage</Button>
      </form>
    </Modal>
  );
}
export function FoodKitchen() {
  const food = useFood();
  const { run } = useApp();
  const [editor, setEditor] = useState<Stock | null | undefined>();
  const [waste, setWaste] = useState<{ stock?: Stock; batch?: Batch }>();
  const [batchEdit, setBatchEdit] = useState<Batch>();
  const [cook, setCook] = useState('');
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [expiry, setExpiry] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);
  const [locations, setLocations] = useState(false);
  const [locationName, setLocationName] = useState('');
  const today = foodDay();
  const rows = food.stock
    .filter(
      (s) =>
        (showEmpty || s.quantity > 0) &&
        (!location || s.location === location) &&
        (!expiry ||
          (!!s.expires &&
            (expiry === 'expired'
              ? s.expires < today
              : s.expires >= today && s.expires <= shiftDay(today, 3)))) &&
        (food.ingredients.find((i) => i.id === s.ingredientId)?.name ?? '')
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => (a.expires ?? '9999').localeCompare(b.expires ?? '9999'));
  const recipes = food.recipes.filter((r) => !r.archived && !r.draft);
  return (
    <>
      <FoodNav />
      <PageTitle
        eyebrow="KNOW WHAT YOU HAVE"
        title="Your kitchen"
        description="Stock, storage and prepared portions. Check quantities whenever you use food outside FORM."
        action={
          <Button onClick={() => setEditor(null)}>
            <Plus size={16} />
            Add stock
          </Button>
        }
      />
      <div className="food-filters">
        <Field label="Search kitchen">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <Field label="Filter storage">
          <select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">Every location</option>
            {[
              ...new Set([...food.foodSettings.locations, ...food.stock.map((s) => s.location)]),
            ].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="Filter expiry">
          <select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
            <option value="">All dates</option>
            <option value="soon">Next 3 days</option>
            <option value="expired">Past recorded date</option>
          </select>
        </Field>
        <label className="check-label">
          <input
            type="checkbox"
            checked={showEmpty}
            onChange={(e) => setShowEmpty(e.target.checked)}
          />
          Include empty packages
        </label>
        <Button variant="secondary" onClick={() => setLocations(true)}>
          Storage locations
        </Button>
      </div>
      <div className="food-grid">
        {rows.map((s) => {
          const ingredient = food.ingredients.find((i) => i.id === s.ingredientId);
          return (
            <Card key={s.id}>
              <div className="food-card-heading">
                <div>
                  <span className="eyebrow">
                    {s.location}
                    {ingredient?.staple ? ' · Staple' : ''}
                  </span>
                  <h2>{ingredient?.name}</h2>
                </div>
                <Badge>{s.confidence}</Badge>
              </div>
              <p className="food-stock-quantity">
                {foodNumber(s.quantity)} <small>{s.unit} remaining</small>
              </p>
              <p>
                {s.expires
                  ? `${s.expiryKind === 'use-by' ? 'Use by' : 'Best before'} ${s.expires}`
                  : 'No expiry date recorded'}
                {s.expires && s.expires < today ? ' · Check before use' : ''}
              </p>
              <p className="small-text muted">
                {s.opened ? 'Opened ' + s.opened : 'Unopened'} · Estimated remaining value{' '}
                {money(stockValue(s, food.foodSettings.currency), food.foodSettings.currency)}
              </p>
              <p>{s.notes}</p>
              <div className="food-actions">
                <Button variant="secondary" onClick={() => setEditor(s)}>
                  <Pencil size={15} />
                  Check / adjust
                </Button>
                <Button
                  variant="ghost"
                  disabled={!s.quantity}
                  onClick={() => setWaste({ stock: s })}
                >
                  <Trash2 size={15} />
                  Record waste
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      {!rows.length && (
        <FoodEmpty>
          No stock matches this view. Add a package manually or receive a reviewed purchase.
        </FoodEmpty>
      )}
      <Card>
        <SectionTitle
          title="Cook once, save the portions"
          sub="Planning and viewing recipes never deduct ingredients."
        />
        <div className="food-actions">
          <Field label="Recipe to prepare">
            <select value={cook} onChange={(e) => setCook(e.target.value)}>
              <option value="">Choose a recipe</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Button disabled={!cook} onClick={() => setCook('confirm:' + cook)}>
            I cooked this recipe
          </Button>
        </div>
      </Card>
      <SectionTitle
        title="Prepared meals & leftovers"
        sub="These ingredients were already deducted when cooking was confirmed."
      />
      <div className="food-grid">
        {food.batches
          .filter((b) => showEmpty || b.remaining > 0)
          .map((b) => (
            <Card key={b.id}>
              <div className="food-card-heading">
                <div>
                  <span className="eyebrow">
                    {b.location} · Prepared {b.prepared}
                  </span>
                  <h2>{b.name}</h2>
                </div>
                <Badge>
                  {foodNumber(b.remaining)} / {foodNumber(b.produced)} portions
                </Badge>
              </div>
              <p>{b.expires ? 'Use by ' + b.expires : 'No use-by date recorded'}</p>
              <p className="small-text muted">Macros per prepared portion</p>
              <MacroSummary macros={b.snapshot.macros} compact />
              <p>{b.notes}</p>
              <div className="food-actions">
                <Button
                  disabled={!b.remaining}
                  onClick={() => go('food-diary?batch=' + encodeURIComponent(b.id))}
                >
                  Eat a portion
                </Button>
                <Button variant="secondary" onClick={() => setBatchEdit(b)}>
                  Move / edit storage
                </Button>
                <Button
                  variant="ghost"
                  disabled={!b.remaining}
                  onClick={() => setWaste({ batch: b })}
                >
                  Discard portions
                </Button>
              </div>
            </Card>
          ))}
      </div>
      {!food.batches.length && (
        <FoodEmpty>Prepared portions appear here after you confirm cooking a recipe.</FoodEmpty>
      )}
      <Card>
        <SectionTitle title="Recent inventory changes" />
        {[...food.movements]
          .sort((a, b) => b.at.localeCompare(a.at))
          .slice(0, 30)
          .map((m) => (
            <div className="food-history-line" key={m.id}>
              <strong>
                {food.ingredients.find((i) => i.id === m.ingredientId)?.name ??
                  food.batches.find((b) => b.id === m.batchId)?.name ??
                  'Inventory'}
              </strong>
              <span>
                {m.quantity > 0 ? '+' : ''}
                {foodNumber(m.quantity)} {m.unit} · {m.kind}
              </span>
              <small>
                {new Date(m.at).toLocaleString('en-GB')} · {m.notes}
                {m.cost !== undefined
                  ? ' · Estimated cost ' + money(m.cost, m.currency ?? 'GBP')
                  : ''}
              </small>
            </div>
          ))}
        {!food.movements.length && <p className="muted">No inventory changes yet.</p>}
      </Card>
      {editor !== undefined && (
        <StockEditor initial={editor ?? undefined} onClose={() => setEditor(undefined)} />
      )}{' '}
      {waste && <WasteEditor {...waste} onClose={() => setWaste(undefined)} />}{' '}
      {batchEdit && <BatchEditor batch={batchEdit} onClose={() => setBatchEdit(undefined)} />}{' '}
      {cook.startsWith('confirm:') && food.recipes.find((r) => r.id === cook.slice(8)) && (
        <CookModal
          recipe={food.recipes.find((r) => r.id === cook.slice(8))!}
          onClose={() => setCook('')}
        />
      )}
      {locations && (
        <Modal title="Storage locations" onClose={() => setLocations(false)}>
          <p>
            Built-in and custom locations can be used for ingredients, packages and prepared meals.
          </p>
          <ul>
            {food.foodSettings.locations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (
                  food.foodSettings.locations.some(
                    (l) => l.toLowerCase() === locationName.trim().toLowerCase(),
                  )
                )
                  throw Error('That location already exists.');
                await saveFoodSettings({
                  ...food.foodSettings,
                  locations: [...food.foodSettings.locations, locationName.trim()],
                });
                setLocationName('');
              });
            }}
          >
            <Field label="New storage location">
              <input
                required
                maxLength={100}
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
              />
            </Field>
            <Button type="submit">Add location</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
