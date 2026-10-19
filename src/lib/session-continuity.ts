import { dateKey, working } from './calc';
import type { Data, Item, Session } from './model';
const setupKey = (item: Item) =>
  JSON.stringify([
    item.exerciseId,
    item.tracking,
    item.includeBodyweight ?? false,
    item.setup?.id ?? '',
    item.setup?.basis ?? 'unspecified',
  ]);
export function precedesSession(previous: Session, current: Session) {
  if (previous.id === current.id || previous.status !== 'completed') return false;
  // Date-only imports have no trustworthy intra-day order.
  if (previous.dateOnly || current.dateOnly)
    return dateKey(previous.startAt) < dateKey(current.startAt);
  return (
    Date.parse(previous.endAt ?? previous.startAt) <= Date.parse(current.startAt) &&
    Date.parse(previous.startAt) < Date.parse(current.startAt)
  );
}
/** Match discipline, equipment, load convention and repeated exercise occurrence. */
export function previousExerciseSession(data: Data, current: Session, item: Item) {
  const key = setupKey(item);
  const occurrence = current.items
    .filter((i) => setupKey(i) === key)
    .findIndex((i) => i.id === item.id);
  if (occurrence < 0) return undefined;
  const sessions = data.sessions
    .filter((s) => precedesSession(s, current))
    .sort((a, b) => b.startAt.localeCompare(a.startAt));
  for (const session of sessions) {
    const previousItem = session.items.filter((i) => setupKey(i) === key)[occurrence];
    if (!previousItem) continue;
    const noteSets = data.sets
      .filter(
        (s) =>
          s.sessionId === session.id &&
          s.itemId === previousItem.id &&
          s.completed &&
          (s.setup?.id ?? '') === (item.setup?.id ?? '') &&
          (s.setup?.basis ?? 'unspecified') === (item.setup?.basis ?? 'unspecified'),
      )
      .sort((a, b) => a.order - b.order);
    const sets = noteSets.filter(working);
    if (sets.length) return { session, item: previousItem, sets, noteSets };
  }
}
