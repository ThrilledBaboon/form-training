import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Pencil, Trash2, Camera } from 'lucide-react';
import { useApp } from '../lib/context';
import { uid, now } from '../lib/model';
import { type Purchase, type ShoppingList, type ShoppingItem } from '../lib/food-model';
import {
  savePurchase,
  receivePurchase,
  saveShoppingList,
  regenerateShopping,
  receiveShopping,
  imageFile,
  saveFoodFile,
  saveFoodDraft,
} from '../lib/food-actions';
import { foodDay, foodNumber, money, weekDays, purchaseSignature } from '../lib/food-calc';
import {
  receiptFingerprint,
  recogniseReceipt,
  parseReceiptText,
  reviewableReceiptText,
} from '../lib/receipts';
import {
  FoodNav,
  useFood,
  IngredientSelect,
  UnitSelect,
  FoodImage,
  FoodEmpty,
  useFoodDraft,
} from '../components/FoodUI';
import { IngredientEditor } from './FoodIngredients';
import { db } from '../lib/db';
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

function emptyPurchase(currency: string): Purchase {
  return {
    id: uid(),
    retailer: '',
    date: foodDay(),
    currency,
    lines: [],
    total: 0,
    notes: '',
    reviewed: true,
    createdAt: now(),
  };
}
export function PurchaseEditor({ initial, onClose }: { initial?: Purchase; onClose: () => void }) {
  const food = useFood();
  const { run, toast } = useApp();
  const [value, set] = useFoodDraft(
    'purchase',
    initial ?? emptyPurchase(food.foodSettings.currency),
    !!initial,
  );
  const [text, setText] = useState(() => {
    try {
      const saved = JSON.parse(
        food.foodDrafts.find((d) => d.id === 'purchase-text-editor')?.json ?? '{}',
      );
      return saved.purchaseId === value.id && typeof saved.text === 'string'
        ? reviewableReceiptText(saved.text)
        : '';
    } catch {
      return '';
    }
  });
  const saveText = (next: string) => {
    const text = reviewableReceiptText(next);
    setText(text);
    void run(() =>
      saveFoodDraft({
        id: 'purchase-text-editor',
        kind: 'purchase',
        json: JSON.stringify({ purchaseId: value.id, text }),
        updatedAt: now(),
      }),
    );
  };
  const [progress, setProgress] = useState('');
  const [scanning, setScanning] = useState(false);
  const [newIngredient, setNewIngredient] = useState<number>();
  const [reviewed, setReviewed] = useState(false);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [allowDiscrepancy, setAllowDiscrepancy] = useState(false);
  const abort = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => abort.current?.abort(), []);
  const patch = (p: Partial<Purchase>) => {
    set({ ...value, ...p });
    setReviewed(false);
  };
  const patchLine = (index: number, p: Partial<Purchase['lines'][number]>) =>
    patch({ lines: value.lines.map((l, i) => (i === index ? { ...l, ...p } : l)) });
  const sum = value.lines.reduce((n, l) => n + l.paid, 0),
    discrepancy = Math.abs(sum - value.total) > 0.011;
  const duplicate = food.purchases.find(
    (p) =>
      p.id !== value.id &&
      ((value.fingerprint && p.fingerprint === value.fingerprint) ||
        purchaseSignature(p) === purchaseSignature(value)),
  );
  const image = useLiveQuery(
    () => (value.imageId ? db.foodFiles.get(value.imageId) : undefined),
    [value.imageId],
  );
  const addImage = async (file: File) => {
    const image = await imageFile(file);
    await saveFoodFile(image);
    patch({ imageId: image.id, fingerprint: await receiptFingerprint(image.data) });
  };
  return (
    <Modal title={initial ? 'Review purchase' : 'Record purchase / receipt'} onClose={onClose} wide>
      <p>
        Check every description, match and package quantity. Saving a reviewed purchase does not add
        stock until you explicitly receive it.
      </p>
      <div className="form-grid">
        <Field label="Photograph receipt">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            capture="environment"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void run(() => addImage(file));
              e.target.value = '';
            }}
          />
        </Field>
        <Field label="Upload receipt image" hint="PNG, JPEG or WebP, up to 5 MB.">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void run(() => addImage(file));
              e.target.value = '';
            }}
          />
        </Field>
      </div>
      <FoodImage id={value.imageId} alt="Original purchase receipt" className="receipt-image" />
      <div className="food-ocr-panel">
        <strong>Optional on-device text recognition</strong>
        <p>
          No receipt data is sent to an external service. Recognition uses bundled English OCR
          files; it may need a connection to load these files. Manual entry below works without OCR.
        </p>
        <Button
          variant="secondary"
          disabled={!image || scanning}
          onClick={() => {
            abort.current = new AbortController();
            setScanning(true);
            void run(async () => {
              try {
                saveText(await recogniseReceipt(image!.data, setProgress, abort.current?.signal));
                toast('Text recognised. Review and extract draft lines below.');
              } finally {
                setScanning(false);
              }
            }, '').then(() => setScanning(false));
          }}
        >
          Read receipt text
        </Button>
        {scanning && (
          <Button
            variant="ghost"
            onClick={() => {
              abort.current?.abort();
              setScanning(false);
              setProgress('Cancelled; manual entry is available.');
            }}
          >
            Cancel recognition
          </Button>
        )}
        <p className="small-text muted" role="status">
          {progress}
        </p>
        <Field label="Receipt text (editable)">
          <textarea rows={5} value={text} onChange={(e) => saveText(e.target.value)} />
        </Field>
        <Button
          variant="secondary"
          disabled={!text.trim() || scanning}
          onClick={() => {
            if (
              value.lines.length &&
              !confirm('Replace the current draft lines with these extracted suggestions?')
            )
              return;
            const result = parseReceiptText(text);
            patch(result);
            toast(
              'Draft suggestions extracted. Product matches and package sizes need your review.',
            );
          }}
        >
          Extract draft purchase lines
        </Button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!reviewed) return;
          void run(async () => {
            await savePurchase(value, { allowDuplicate, allowDiscrepancy });
            onClose();
          }, 'Reviewed purchase saved. Receive it separately to add stock.');
        }}
      >
        <div className="form-grid">
          <Field label="Retailer">
            <input
              required
              value={value.retailer}
              onChange={(e) => patch({ retailer: e.target.value })}
            />
          </Field>
          <Field label="Purchase date">
            <input
              required
              type="date"
              value={value.date}
              onChange={(e) => patch({ date: e.target.value })}
            />
          </Field>
          <Field label="Purchase currency">
            <select value={value.currency} onChange={(e) => patch({ currency: e.target.value })}>
              {[...new Set(['GBP', 'EUR', 'USD', value.currency, food.foodSettings.currency])].map(
                (c) => (
                  <option key={c}>{c}</option>
                ),
              )}
            </select>
          </Field>
          <Field label="Total paid at checkout">
            <input
              required
              type="number"
              min={0}
              step="0.01"
              value={value.total}
              onChange={(e) => patch({ total: Number(e.target.value) })}
            />
          </Field>
        </div>
        <SectionTitle
          title="Review purchase lines"
          sub="Net line paid includes any discounts already applied. Package quantity is the amount in one package; package count is how many you bought."
        />
        {value.lines.map((line, index) => (
          <fieldset className="food-editor-row" key={line.id}>
            <legend>Purchase line {index + 1}</legend>
            <Field label={'Product description ' + (index + 1)}>
              <input
                required
                value={line.description}
                onChange={(e) => patchLine(index, { description: e.target.value })}
              />
            </Field>
            <IngredientSelect
              food={food}
              label={'Match ingredient ' + (index + 1)}
              value={line.ingredientId ?? ''}
              onChange={(ingredientId) =>
                patchLine(index, {
                  ingredientId: ingredientId || undefined,
                  location:
                    food.ingredients.find((i) => i.id === ingredientId)?.location ?? line.location,
                })
              }
            />
            {!line.ingredientId && (
              <p className="small-text muted">
                Unmatched. Stock cannot be added until you choose or create an ingredient.
              </p>
            )}
            <Button variant="ghost" type="button" onClick={() => setNewIngredient(index)}>
              New ingredient for this product
            </Button>
            <div className="form-grid">
              <Field
                label={'Package quantity ' + (index + 1)}
                hint="Leave blank if unknown. Confirm before receiving."
              >
                <input
                  type="number"
                  min={0.001}
                  step="any"
                  value={line.quantity ?? ''}
                  onChange={(e) =>
                    patchLine(index, {
                      quantity: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </Field>
              <UnitSelect
                label={'Package unit ' + (index + 1)}
                value={line.unit}
                onChange={(unit) => patchLine(index, { unit })}
              />
              <Field label={'Package count ' + (index + 1)}>
                <input
                  type="number"
                  required
                  min={0.001}
                  step="any"
                  value={line.packages}
                  onChange={(e) => patchLine(index, { packages: Number(e.target.value) })}
                />
              </Field>
              <Field label={'Net line paid ' + (index + 1)}>
                <input
                  type="number"
                  required
                  min={0}
                  step="0.01"
                  value={line.paid}
                  onChange={(e) => patchLine(index, { paid: Number(e.target.value) })}
                />
              </Field>
              <Field label={'Discount already included ' + (index + 1)}>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.discount}
                  onChange={(e) => patchLine(index, { discount: Number(e.target.value) })}
                />
              </Field>
              <Field label={'Receive into ' + (index + 1)}>
                <select
                  value={line.location}
                  onChange={(e) => patchLine(index, { location: e.target.value })}
                >
                  {[...new Set([...food.foodSettings.locations, line.location])].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label={'Package expiry ' + (index + 1)}>
                <input
                  type="date"
                  value={line.expires ?? ''}
                  onChange={(e) => patchLine(index, { expires: e.target.value || undefined })}
                />
              </Field>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => patch({ lines: value.lines.filter((_, i) => i !== index) })}
            >
              Remove purchase line
            </Button>
          </fieldset>
        ))}
        <Button
          variant="secondary"
          type="button"
          onClick={() =>
            patch({
              lines: [
                ...value.lines,
                {
                  id: uid(),
                  description: '',
                  unit: 'g',
                  packages: 1,
                  paid: 0,
                  discount: 0,
                  received: false,
                  location: 'Cupboard',
                },
              ],
            })
          }
        >
          Add purchase line
        </Button>
        <p className={discrepancy ? 'callout' : 'small-text muted'}>
          Lines add up to {money(sum, value.currency)} · Checkout total{' '}
          {money(value.total, value.currency)} · Difference{' '}
          {money(value.total - sum, value.currency)}.
        </p>
        {discrepancy && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={allowDiscrepancy}
              onChange={(e) => setAllowDiscrepancy(e.target.checked)}
            />
            I have reviewed and accept this difference (explain in notes).
          </label>
        )}
        {duplicate && (
          <div className="callout">
            <p>
              Possible duplicate: {duplicate.retailer}, {duplicate.date},{' '}
              {money(duplicate.total, duplicate.currency)}.
            </p>
            <label className="check-label">
              <input
                type="checkbox"
                checked={allowDuplicate}
                onChange={(e) => setAllowDuplicate(e.target.checked)}
              />
              This is a separate purchase; save it anyway.
            </label>
          </div>
        )}
        <Field label="Purchase notes">
          <textarea value={value.notes} onChange={(e) => patch({ notes: e.target.value })} />
        </Field>
        <label className="check-label">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
          />
          I have reviewed the date, product lines, quantities and prices.
        </label>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close editor
          </Button>
          <Button
            type="submit"
            disabled={
              !reviewed ||
              scanning ||
              (!!duplicate && !allowDuplicate) ||
              (discrepancy && !allowDiscrepancy)
            }
          >
            Save reviewed purchase
          </Button>
        </div>
      </form>
      {newIngredient !== undefined && (
        <IngredientEditor
          onClose={() => setNewIngredient(undefined)}
          onSaved={(ingredient) =>
            patchLine(newIngredient, {
              ingredientId: ingredient.id,
              unit: ingredient.defaultUnit,
              location: ingredient.location,
            })
          }
        />
      )}
    </Modal>
  );
}
function ShoppingItemEditor({
  list,
  item,
  onClose,
}: {
  list: ShoppingList;
  item?: ShoppingItem;
  onClose: () => void;
}) {
  const food = useFood();
  const { run } = useApp();
  const [value, set] = useState<ShoppingItem>(
    item ?? {
      id: uid(),
      name: '',
      quantity: 1,
      unit: 'count',
      generated: false,
      checked: false,
      received: false,
      notes: '',
    },
  );
  return (
    <Modal title={item ? 'Edit shopping item' : 'Add shopping item'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await db.transaction('rw', db.shoppingLists, async () => {
              const current = await db.shoppingLists.get(list.id);
              if (!current) throw Error('List no longer exists.');
              await saveShoppingList({
                ...current,
                items: [
                  ...current.items.filter((i) => i.id !== value.id),
                  {
                    ...value,
                    generated: false,
                    overridesRequirement: item?.generated || item?.overridesRequirement,
                  },
                ],
              });
            });
            onClose();
          }, 'Shopping item saved as a manual entry');
        }}
      >
        <Field label="Shopping item name">
          <input
            required
            value={value.name}
            onChange={(e) => set({ ...value, name: e.target.value })}
          />
        </Field>
        <IngredientSelect
          food={food}
          value={value.ingredientId ?? ''}
          onChange={(ingredientId) => {
            const ingredient = food.ingredients.find((i) => i.id === ingredientId);
            set({
              ...value,
              ingredientId: ingredientId || undefined,
              name: ingredient?.name ?? value.name,
              unit: ingredient?.defaultUnit ?? value.unit,
            });
          }}
        />
        <div className="form-grid">
          <Field label="Shopping quantity">
            <input
              type="number"
              min={0}
              required
              step="any"
              value={value.quantity}
              onChange={(e) => set({ ...value, quantity: Number(e.target.value) })}
            />
          </Field>
          <UnitSelect value={value.unit} onChange={(unit) => set({ ...value, unit })} />
        </div>
        <Field label="Shopping notes">
          <textarea
            value={value.notes}
            onChange={(e) => set({ ...value, notes: e.target.value })}
          />
        </Field>
        <p className="small-text muted">
          Edited requirements become manual overrides so regeneration keeps your changes without
          adding the same requirement again.
        </p>
        <Button type="submit">Save shopping item</Button>
      </form>
    </Modal>
  );
}
export function FoodShopping() {
  const food = useFood();
  const { run } = useApp();
  const [purchase, setPurchase] = useState<Purchase | null | undefined>();
  const [item, setItem] = useState<{ list: ShoppingList; item?: ShoppingItem }>();
  const [tab, setTab] = useState('lists');
  const [search, setSearch] = useState('');
  const toggle = async (listId: string, itemId: string) => {
    await db.transaction('rw', db.shoppingLists, async () => {
      const list = await db.shoppingLists.get(listId);
      if (list)
        await saveShoppingList({
          ...list,
          items: list.items.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i)),
        });
    });
  };
  return (
    <>
      <FoodNav />
      <PageTitle
        eyebrow="SHOP WITH A PLAN"
        title="Shopping & purchases"
        description="From meal requirements to a reviewed receipt. Prices come from your own recorded purchases."
        action={
          <Button onClick={() => setPurchase(null)}>
            <Camera size={16} />
            Record purchase / receipt
          </Button>
        }
      />
      <div className="food-actions">
        <Button variant={tab === 'lists' ? 'primary' : 'secondary'} onClick={() => setTab('lists')}>
          Shopping lists
        </Button>
        <Button
          variant={tab === 'purchases' ? 'primary' : 'secondary'}
          onClick={() => setTab('purchases')}
        >
          Purchase history
        </Button>
      </div>
      {tab === 'lists' ? (
        <>
          <div className="food-actions food-section">
            <AsyncButton
              variant="secondary"
              onAction={() =>
                run(() =>
                  saveShoppingList({
                    id: uid(),
                    name: 'Shopping ' + foodDay(),
                    items: [],
                    createdAt: now(),
                    updatedAt: now(),
                  }),
                )
              }
            >
              <Plus size={16} />
              New manual list
            </AsyncButton>
            <AsyncButton
              variant="secondary"
              onAction={() =>
                run(async () => {
                  const days = weekDays(foodDay()),
                    id = uid();
                  await saveShoppingList({
                    id,
                    name: 'Weekly meals ' + days[0],
                    from: days[0],
                    to: days[6],
                    items: [],
                    createdAt: now(),
                    updatedAt: now(),
                  });
                  await regenerateShopping(id);
                })
              }
            >
              Generate from this week’s plan
            </AsyncButton>
          </div>
          {food.shoppingLists.map((list) => {
            const estimates = list.items.filter((i) => !i.received).map((i) => i.estimatedCost);
            const total =
              estimates.length && estimates.every((n) => n !== undefined)
                ? estimates.reduce<number>((sum, n) => sum + n!, 0)
                : undefined;
            return (
              <Card key={list.id}>
                <SectionTitle
                  title={list.name}
                  sub={
                    list.from
                      ? `${list.from} to ${list.to} · ${list.items.filter((i) => i.generated).length} generated requirements`
                      : 'Editable shopping list'
                  }
                  action={
                    <Button variant="secondary" onClick={() => setItem({ list })}>
                      Add item
                    </Button>
                  }
                />
                <p className="small-text muted">
                  Estimated checkout cost: {money(total, food.foodSettings.currency)}. Generated
                  quantities round shortages to your recorded package sizes. Unknown prices stay
                  unknown.
                </p>
                {[
                  ...new Set(
                    list.items.map(
                      (i) =>
                        food.ingredients.find((x) => x.id === i.ingredientId)?.category ?? 'Other',
                    ),
                  ),
                ]
                  .sort()
                  .map((category) => (
                    <div key={category}>
                      <h3>{category}</h3>
                      {list.items
                        .filter(
                          (i) =>
                            (food.ingredients.find((x) => x.id === i.ingredientId)?.category ??
                              'Other') === category,
                        )
                        .map((row) => (
                          <div
                            className={'shopping-row ' + (row.checked ? 'checked' : '')}
                            key={row.id}
                          >
                            <label className="check-label">
                              <input
                                type="checkbox"
                                checked={row.checked}
                                disabled={row.received}
                                onChange={() => void run(() => toggle(list.id, row.id))}
                              />
                              <span>
                                <strong>{row.name}</strong>
                                <small>
                                  {foodNumber(row.quantity)} {row.unit}
                                  {row.shortage !== undefined
                                    ? ` · Shortage ${foodNumber(row.shortage)} ${row.unit}`
                                    : ''}
                                  {row.packages ? ` · ${row.packages} packages` : ''} ·{' '}
                                  {row.received
                                    ? 'Received'
                                    : row.generated
                                      ? 'Generated'
                                      : 'Manual'}
                                </small>
                                <small>
                                  {money(row.estimatedCost, food.foodSettings.currency)} est.{' '}
                                  {row.notes}
                                </small>
                              </span>
                            </label>
                            <div className="food-actions">
                              <Button
                                variant="ghost"
                                disabled={row.received}
                                aria-label={'Edit shopping ' + row.name}
                                onClick={() => setItem({ list, item: row })}
                              >
                                <Pencil size={15} />
                              </Button>
                              <AsyncButton
                                variant="ghost"
                                aria-label={'Remove shopping ' + row.name}
                                onAction={() =>
                                  run(async () => {
                                    if (!confirm('Remove this shopping item?')) return;
                                    await db.transaction('rw', db.shoppingLists, async () => {
                                      const current = await db.shoppingLists.get(list.id);
                                      if (current)
                                        await saveShoppingList({
                                          ...current,
                                          items: current.items.filter((i) => i.id !== row.id),
                                        });
                                    });
                                  })
                                }
                              >
                                <Trash2 size={15} />
                              </AsyncButton>
                            </div>
                          </div>
                        ))}
                    </div>
                  ))}
                {!list.items.length && (
                  <p className="muted">
                    No shopping items. Your plan may already be covered by stock; you can add manual
                    entries.
                  </p>
                )}
                <div className="food-actions">
                  {(list.from || list.recipeId) && (
                    <AsyncButton
                      variant="secondary"
                      onAction={() =>
                        run(
                          () => regenerateShopping(list.id),
                          'Generated requirements updated; manual entries kept',
                        )
                      }
                    >
                      Regenerate requirements
                    </AsyncButton>
                  )}
                  <AsyncButton
                    variant="secondary"
                    onAction={() =>
                      run(async () => {
                        if (
                          confirm(
                            'Receive checked items into inventory? Only use this if they have NOT already been received through a purchase receipt. This records quantities without inventing spending.',
                          )
                        )
                          await receiveShopping(list.id);
                      }, 'Checked items received')
                    }
                  >
                    Receive checked items without receipt
                  </AsyncButton>
                  <AsyncButton
                    variant="ghost"
                    onAction={() =>
                      run(async () => {
                        if (
                          confirm(
                            'Delete this shopping list? Inventory and purchase history will be kept.',
                          )
                        )
                          await db.shoppingLists.delete(list.id);
                      })
                    }
                  >
                    Delete list
                  </AsyncButton>
                </div>
              </Card>
            );
          })}
          {!food.shoppingLists.length && (
            <FoodEmpty>
              Generate a list from Meal planner, shop for one recipe from Menu, or create a manual
              list.
            </FoodEmpty>
          )}
        </>
      ) : (
        <>
          <Field label="Search purchases">
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </Field>
          {[...food.purchases]
            .filter((p) =>
              [p.retailer, p.notes, ...p.lines.map((l) => l.description)].some((s) =>
                s.toLowerCase().includes(search.toLowerCase()),
              ),
            )
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((p) => (
              <Card key={p.id}>
                <SectionTitle
                  title={p.retailer}
                  sub={p.date + ' · ' + money(p.total, p.currency)}
                  action={
                    <Badge>
                      {p.lines.length && p.lines.every((l) => l.received)
                        ? 'Received'
                        : 'Reviewed purchase'}
                    </Badge>
                  }
                />
                {p.imageId && (
                  <details>
                    <summary>Original receipt image</summary>
                    <FoodImage id={p.imageId} alt="Original receipt" className="receipt-image" />
                  </details>
                )}
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Reviewed purchase lines"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Product / match</th>
                        <th>Package quantity</th>
                        <th>Net paid</th>
                        <th>State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.lines.map((l) => (
                        <tr key={l.id}>
                          <td>
                            {l.description}
                            <small className="block muted">
                              {food.ingredients.find((i) => i.id === l.ingredientId)?.name ??
                                'Unmatched'}
                            </small>
                          </td>
                          <td>
                            {l.quantity === undefined
                              ? 'Unknown'
                              : `${foodNumber(l.quantity)} ${l.unit} × ${l.packages}`}
                          </td>
                          <td>
                            {money(l.paid, p.currency)}
                            {l.discount > 0 && (
                              <small className="block muted">
                                Includes {money(l.discount, p.currency)} discount
                              </small>
                            )}
                          </td>
                          <td>{l.received ? 'Received' : 'Not received'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>{p.notes}</p>
                <div className="food-actions">
                  <Button
                    variant="secondary"
                    disabled={p.lines.some((l) => l.received)}
                    onClick={() => setPurchase(p)}
                  >
                    Review / correct
                  </Button>
                  <AsyncButton
                    disabled={!p.lines.length || p.lines.every((l) => l.received)}
                    onAction={() =>
                      run(() => receivePurchase(p.id), 'Purchase received into kitchen stock')
                    }
                  >
                    Receive purchase into kitchen
                  </AsyncButton>
                </div>
              </Card>
            ))}
          {!food.purchases.length && (
            <FoodEmpty>
              No purchases recorded yet. Add a receipt image or enter a purchase manually.
            </FoodEmpty>
          )}
        </>
      )}
      {purchase !== undefined && (
        <PurchaseEditor
          initial={purchase ?? undefined}
          onClose={() => {
            setPurchase(undefined);
            setTab('purchases');
          }}
        />
      )}{' '}
      {item && <ShoppingItemEditor {...item} onClose={() => setItem(undefined)} />}
    </>
  );
}
