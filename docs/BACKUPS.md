# Your backup and recovery guide

## Make an independent backup

1. Open **Settings & data**.
2. Choose **Export JSON backup**.
3. Check your browser's download completed and keep the JSON file outside browser storage, for example in your normal backed-up documents folder.
4. Repeat regularly and before changing browser/device/site address or installing updates.

The app can start a download, but cannot verify that a file was actually retained on your disk. It therefore labels the timestamp **last file export requested**. CSV is for analysis and does not restore the complete database.

Your workouts belong to the browser origin: scheme + hostname + port. Development (`127.0.0.1:5173`), production preview (`127.0.0.1:4173`), `localhost`, GitHub Pages and another browser/device do not automatically share history. A future GitHub push transfers source code only. Export locally and import on the hosted site when you move.

## Restore a JSON file

1. Choose a FORM JSON backup in Settings.
2. Review its schema version, export timestamp, per-table counts and existing identifiers.
3. Select **Merge** or **Replace** and confirm.
4. Check the restored workout history and any active workout.

**Merge** keeps existing IDs and preferences and adds new IDs. If a session ID already exists, that entire current session and its sets are retained; incoming edits and extra sets for that session are not grafted in. Current logical exercise/muscle mappings are retained. Repeated imports create no duplicate workouts. If two unrelated active workouts would result, the merge is rejected atomically; finish/cancel one first. Merge is not a conflict-aware synchronisation service. Use Replace to restore an authoritative complete edited snapshot.

**Replace** substitutes all application records/preferences/timer state from the file. The current data is captured as a recovery snapshot before replacement, in the same database transaction. Failure rolls back the import and snapshot together. Existing recovery snapshots are retained.

Invalid JSON, unsupported schemas, duplicate IDs/mappings, invalid fields and broken set/session/exercise/group relationships are rejected before writes. Files over 100 MB are rejected. A failure never displays successful import feedback.

## Recovery snapshots

Before each import, FORM saves a versioned snapshot in **Local recovery snapshots**. Download a snapshot and import the downloaded JSON to restore it. These snapshots are in the same IndexedDB storage as workouts; clearing browser/site data removes them too. They are not independent backups and do not survive all storage failures. Keep exported files.

## Accidental edits and deletion

Sets, archived exercises, bodyweight entries, routines, plans and removed sessions offer context-appropriate Undo. Destructive session, routine, measurement and replacement operations require visible confirmation. Session/exercise/set/measurement edits cause records and charts to recalculate. Archive exercises to retain their stable identity and full history.

## Offline and storage limitations

Browser storage can be cleared manually, evicted under storage pressure, removed by private browsing or lost with the browser profile. Requesting durable storage may reduce eviction risk where supported; it is not a separate copy. If storage fails, the app shows an error and does not claim the write succeeded.

Production files are cached after the first successful service-worker installation. Test offline mode only after loading the production app online and reloading once. Development mode does not register the production worker. An update prompt lets you reload deliberately. Data stays in IndexedDB rather than the service-worker cache.
