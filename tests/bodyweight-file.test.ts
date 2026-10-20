import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TrainingDB, readData } from '../src/lib/db';
import { uid } from '../src/lib/model';
import { startSession } from '../src/lib/actions';
import {
  parseBodyweightFile,
  previewBodyweightImport,
  importBodyweightFile,
  type BodyweightFile,
} from '../src/lib/bodyweight-file';

let database: TrainingDB;
const measurement = {
  at: '2026-10-19T13:27:43+01:00',
  kg: 86.15,
  notes: 'Scale reading',
  tags: ['INSMART'],
};
const file = (measurements = [measurement]): BodyweightFile => ({
  app: 'FORM',
  type: 'bodyweight',
  schemaVersion: 1,
  measurements,
});
beforeEach(async () => {
  database = new TrainingDB('weight-import-' + uid());
  await database.open();
});
afterEach(async () => {
  await database.delete();
});

describe('reviewed bodyweight JSON imports', () => {
  it('validates units, dates, file versions, fields and limits without inventing measurements', () => {
    expect(parseBodyweightFile(JSON.stringify(file())).measurements[0]).toEqual(measurement);
    for (const invalid of [
      { ...file(), type: 'library' },
      { ...file(), schemaVersion: 2 },
      { ...file(), measurements: [] },
      { ...file(), settings: {} },
      file([{ ...measurement, at: '2026-02-30T08:00:00Z' }]),
      file([{ ...measurement, at: '2026-10-19T13:27:43' }]),
      file([{ ...measurement, kg: 0 }]),
      file([{ ...measurement, kg: 1001 }]),
      file([{ ...measurement, kg: '86.15kg' as unknown as number }]),
      file([{ ...measurement, tags: ['Fresh,Gym'] }]),
    ])
      expect(() => parseBodyweightFile(JSON.stringify(invalid))).toThrow();
    expect(() => parseBodyweightFile('not JSON')).toThrow('not valid JSON');
    expect(() => parseBodyweightFile(' '.repeat(10 * 1024 * 1024 + 1))).toThrow('10 MB');
  });

  it('normalises offsets and tags while keeping repeated-day measurements and source notes', () => {
    const incoming = file([
      measurement,
      { ...measurement, at: '2026-10-19T17:30:00+01:00', kg: 87 },
    ]);
    const preview = previewBodyweightImport(incoming, [], ['insmart', ' Fresh ']);
    expect(preview.map((r) => r.status)).toEqual(['new', 'new']);
    expect(preview[0].entry).toEqual({
      ...measurement,
      at: '2026-10-19T12:27:43.000Z',
      tags: ['INSMART', 'Fresh'],
    });
    expect(incoming.measurements[0]).toEqual(measurement);
  });

  it('skips duplicate instants with equivalent offsets and flags contradictory source or saved weights', () => {
    const saved = [
      {
        id: 'kept',
        ...measurement,
        at: '2026-10-19T12:27:43.000Z',
        notes: 'Edited locally',
        tags: ['Gym'],
      },
    ];
    expect(previewBodyweightImport(file(), saved)[0].status).toBe('duplicate');
    expect(previewBodyweightImport(file([{ ...measurement, kg: 90 }]), saved)[0].status).toBe(
      'conflict',
    );
    expect(
      previewBodyweightImport(file([measurement, { ...measurement }]), []).map((r) => r.status),
    ).toEqual(['new', 'duplicate']);
    expect(
      previewBodyweightImport(file([measurement, { ...measurement, kg: 90 }]), []).map(
        (r) => r.status,
      ),
    ).toEqual(['conflict', 'conflict']);
  });

  it('adds only new weights, retains local edits on repeat imports and leaves other records untouched', async () => {
    await startSession(undefined, database);
    const before = await readData(database);
    expect(await importBodyweightFile(file(), ['Fresh'], database)).toEqual({
      added: 1,
      duplicates: 0,
      conflicts: 0,
    });
    const entry = (await database.bodyweights.toArray())[0];
    expect(entry.tags).toEqual(['INSMART', 'Fresh']);
    await database.bodyweights.update(entry.id, { notes: 'My correction', tags: ['Morning'] });
    const edited = await database.bodyweights.get(entry.id);
    expect(await importBodyweightFile(file(), ['Gym'], database)).toEqual({
      added: 0,
      duplicates: 1,
      conflicts: 0,
    });
    expect(await database.bodyweights.get(entry.id)).toEqual(edited);
    expect(await importBodyweightFile(file([{ ...measurement, kg: 87 }]), [], database)).toEqual({
      added: 0,
      duplicates: 0,
      conflicts: 1,
    });
    const after = await readData(database);
    expect({ ...after, bodyweights: [] }).toEqual({ ...before, bodyweights: [] });
  });

  it('rechecks concurrent imports in the transaction and rolls back a partial storage failure', async () => {
    const results = await Promise.all([
      importBodyweightFile(file(), [], database),
      importBodyweightFile(file(), [], database),
    ]);
    expect(results.map((r) => r.added).sort()).toEqual([0, 1]);
    expect(await database.bodyweights.count()).toBe(1);
    let writes = 0;
    database.bodyweights.hook('creating', () => {
      if (++writes === 2) throw Error('Storage unavailable');
    });
    const incoming = file([
      { ...measurement, at: '2026-10-18T12:00:00Z' },
      { ...measurement, at: '2026-10-17T12:00:00Z' },
    ]);
    await expect(importBodyweightFile(incoming, [], database)).rejects.toThrow(
      'Storage unavailable',
    );
    expect(await database.bodyweights.count()).toBe(1);
  });
});
