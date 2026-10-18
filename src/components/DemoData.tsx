import { useState } from 'react';
import { useApp } from '../lib/context';
import { loadJackDemo, removeJackDemo, isDemo, localDemoAvailable } from '../lib/demo';
import { createJackDemo } from '../lib/demo-data';
import { serialise, download } from '../lib/backup';
import { Card, SectionTitle, AsyncButton, Button } from './ui';

export function DemoDataSettings() {
  const { data, run, toast } = useApp();
  const [loaded, setLoaded] = useState(false);
  if (!localDemoAvailable()) return null;
  const count = data.sessions.filter((s) => isDemo(s.id)).length;
  return (
    <Card>
      <SectionTitle
        title="Jack demo data"
        sub="Six months of fictional examples. Available only on localhost."
      />
      <p>
        Explore training progression, weigh-ins, food logs, recipes, kitchen stock, meal plans and
        spending. Existing records, page layouts and calorie visibility are preserved. A recovery
        snapshot is saved before loading or removing samples.
      </p>
      {(count > 0 || loaded) && (
        <p role="status">
          {count} sample workouts loaded. Find the full-period charts in My pages → Jack · six
          months [Demo].
        </p>
      )}
      <div className="inline-actions">
        <AsyncButton
          onAction={() =>
            run(async () => {
              const added = await loadJackDemo();
              setLoaded(true);
              toast(
                added
                  ? 'Jack’s six months of demo data are ready.'
                  : 'Jack’s demo data is already loaded; no duplicates added.',
              );
            })
          }
        >
          Load Jack’s demo data
        </AsyncButton>
        <AsyncButton
          variant="secondary"
          disabled={!count && !loaded}
          onAction={() =>
            run(async () => {
              const retained = await removeJackDemo();
              setLoaded(false);
              toast(
                retained
                  ? 'Sample history removed. Sample library items used by your own records were kept.'
                  : 'Jack’s demo data removed. Your own records were kept.',
              );
            })
          }
        >
          Remove Jack’s demo data
        </AsyncButton>
        <Button
          variant="secondary"
          onClick={() => download(serialise(createJackDemo()), 'jack-six-month-demo.json')}
        >
          Download demo backup
        </Button>
      </div>
      <p className="small-text muted">
        All sample records are labelled [Demo]. Values and nutrition are illustrative. Removal also
        removes edits to sample records; any sample library items referenced by your own new records
        are kept. Recovery snapshots remain in Settings.
      </p>
    </Card>
  );
}
