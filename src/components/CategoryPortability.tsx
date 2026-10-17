import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useApp } from '../lib/context';
import { download, parseBackup, type Backup } from '../lib/backup';
import {
  dataCategories,
  gymCategories,
  foodCategories,
  categoryExport,
  foodCsv,
  foodCsvKinds,
  type DataCategory,
} from '../lib/category-backup';
import { emptyFood } from '../lib/food-model';
import { db, readData } from '../lib/db';
import { Card, SectionTitle, Button, Field } from './ui';
export function CategoryPortability({ onImport }: { onImport: (backup: Backup) => void }) {
  const { data, run, toast } = useApp();
  const [selected, setSelected] = useState<DataCategory[]>(['ingredients', 'recipes']);
  const exportSelected = (categories = selected) =>
    void run(async () => {
      download(
        categoryExport(await readData(db), categories),
        'form-categories-' + new Date().toISOString().slice(0, 10) + '.json',
      );
      toast('Category download started, including required relationships and images.');
    });
  return (
    <Card>
      <SectionTitle
        title="Export & import selected categories"
        sub="Versioned JSON preserves nested records, stable IDs, units and required dependencies. Existing IDs are kept during category imports."
      />
      <div className="food-actions">
        <Button variant="secondary" onClick={() => exportSelected(gymCategories)}>
          Export workout data
        </Button>
        <Button variant="secondary" onClick={() => exportSelected(foodCategories)}>
          Export food data
        </Button>
        <Button variant="secondary" onClick={() => exportSelected(['purchases', 'inventory'])}>
          Export financial records
        </Button>
      </div>
      <div className="food-data-categories">
        {Object.entries(dataCategories).map(([key, label]) => (
          <label className="check-label" key={key}>
            <input
              type="checkbox"
              checked={selected.includes(key as DataCategory)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, key as DataCategory]
                    : selected.filter((s) => s !== key),
                )
              }
            />
            {label}
          </label>
        ))}
      </div>
      <p className="small-text muted">
        Dependencies travel with the selected records. For example, a recipe includes its
        ingredients and images; a prepared-batch diary entry also includes its batch and recipe.
        Unrelated workout history is excluded from food-only exports.
      </p>
      <div className="food-actions">
        <Button disabled={!selected.length} onClick={() => exportSelected()}>
          <Download size={15} />
          Export selected categories
        </Button>
        <label className="button secondary file-button">
          <Upload size={15} />
          Import selected categories
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Import selected categories"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void run(async () => {
                  if (file.size > 100 * 1024 * 1024) throw Error('Files must be below 100 MB.');
                  onImport(parseBackup(await file.text()));
                });
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <details className="food-section">
        <summary>Food CSV exports for spreadsheets</summary>
        <p className="small-text muted">
          CSV contains readable flat rows. Use the JSON category files above for complete import and
          restore, including nested details and images.
        </p>
        <div className="food-actions">
          {foodCsvKinds.map((kind) => (
            <Button
              key={kind}
              variant="secondary"
              onClick={() => {
                download(
                  foodCsv(data.food ?? emptyFood, kind),
                  'form-food-' + kind + '.csv',
                  'text/csv',
                );
                toast('CSV download started');
              }}
            >
              {kind === 'diary'
                ? 'Food diary'
                : kind === 'mealPlans'
                  ? 'Meal plans'
                  : kind[0].toUpperCase() + kind.slice(1)}{' '}
              CSV
            </Button>
          ))}
        </div>
      </details>
    </Card>
  );
}
