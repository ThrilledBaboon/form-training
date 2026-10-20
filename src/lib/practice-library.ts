import { z } from 'zod';
import {
  DrillSchema,
  PracticeRoutineSchema,
  PracticeDataSchema,
  PracticeSystemSchema,
  type PracticeData,
  type PracticeSystem,
  type PracticeDrill,
} from './practice-model';
import { changePractice } from './practice-actions';
import { type TrainingDB, db } from './db';
const LibrarySchema = z
  .object({
    app: z.literal('FORM'),
    type: z.literal('practice-library'),
    schemaVersion: z.literal(1),
    system: PracticeSystemSchema,
    drills: z.array(DrillSchema).max(2000),
    routines: z.array(PracticeRoutineSchema).max(1000),
  })
  .strict();
export type PracticeLibrary = z.infer<typeof LibrarySchema>;
export function sharePractice(p: PracticeData, routineIds: string[]) {
  const routines = p.routines.filter((r) => routineIds.includes(r.id));
  if (!routines.length) throw Error('Choose at least one routine to share.');
  const ids = new Set(routines.flatMap((r) => r.blocks.map((b) => b.drillId)));
  return JSON.stringify(
    LibrarySchema.parse({
      app: 'FORM',
      type: 'practice-library',
      schemaVersion: 1,
      system: p.id,
      drills: p.drills.filter((d) => ids.has(d.id)),
      routines,
    }),
    null,
    2,
  );
}
export function parsePracticeLibrary(input: string) {
  if (input.length > 5 * 1024 * 1024) throw Error('Practice library exceeds 5 MB.');
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw Error('This is not valid JSON.');
  }
  const file = LibrarySchema.parse(value);
  PracticeDataSchema.parse({
    id: file.system,
    drills: file.drills,
    routines: file.routines,
    sessions: [],
  });
  return file;
}
export async function importPracticeLibrary(
  file: PracticeLibrary,
  system: PracticeSystem,
  database: TrainingDB = db,
) {
  const checked = parsePracticeLibrary(JSON.stringify(file));
  if (checked.system !== system)
    throw Error(
      'This library belongs to the other practice system. Open its library to import it.',
    );
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(checked)),
  );
  const prefix =
    'shared-' + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  const ids = new Map(checked.drills.map((d, i) => [d.id, prefix + '-d' + i]));
  return changePractice(
    system,
    (p) => {
      checked.drills.forEach((d) => {
        const id = ids.get(d.id)!;
        if (!p.drills.some((l) => l.id === id)) p.drills.push({ ...d, id });
      });
      checked.routines.forEach((r, i) => {
        const id = prefix + '-r' + i;
        if (!p.routines.some((l) => l.id === id))
          p.routines.push({
            ...r,
            id,
            weekdays: [],
            blocks: r.blocks.map((b, n) => ({
              ...b,
              id: id + '-b' + n,
              drillId: ids.get(b.drillId)!,
            })),
          });
      });
    },
    database,
  );
}
export function rocketLeagueStarters(): Pick<PracticeData, 'drills' | 'routines'> {
  const drills = [
    {
      id: 'rl-control',
      name: 'Ball control',
      category: 'Ball control',
      cue: 'Keep the ball close. Reset and try again when you lose control.',
    },
    {
      id: 'rl-shooting',
      name: 'Shooting accuracy',
      category: 'Shooting',
      metric: 'accuracy',
      cue: 'Choose a consistent shot setup. Record attempts and clean hits.',
    },
    {
      id: 'rl-recovery',
      name: 'Recoveries',
      category: 'Recoveries',
      cue: 'Land on your wheels and keep momentum.',
    },
    {
      id: 'rl-aerial',
      name: 'Aerial practice',
      category: 'Aerials',
      cue: 'Choose your own aerial difficulty and repeat a consistent setup.',
    },
    {
      id: 'rl-playlist',
      name: 'Playlist focus',
      category: 'Playlist',
      cue: 'Play your chosen playlist with one specific practice objective.',
      setup: 'Choose playlist and objective before starting.',
    },
    {
      id: 'rl-dribble',
      name: 'Ground dribbling',
      category: 'Ball control',
      cue: 'Choose carrying or close ground touches. Reset after losing the ball and repeat.',
      setup: 'Freeplay; use the same starting position and dribble route each set.',
    },
    {
      id: 'rl-first-touch',
      name: 'First-touch control',
      category: 'Ball control',
      cue: 'Send the ball into a wall, receive the rebound and try to keep the next touch close.',
      setup: 'Freeplay; choose a wall and repeat from a consistent distance.',
    },
    {
      id: 'rl-defence',
      name: 'Defensive clears',
      category: 'Defence',
      metric: 'accuracy',
      cue: 'Choose a repeatable incoming ball. Count a hit when your clear reaches your chosen area.',
      setup: 'Use a defensive training shot of your choice. Set the destination before the set.',
    },
    {
      id: 'rl-boost-routes',
      name: 'Boost-pad routes',
      category: 'Movement',
      cue: 'Follow a chosen route of small pads, then repeat it in the other direction.',
      setup: 'Freeplay; turn off unlimited boost if you want to practise collecting pads.',
    },
  ].map((d) => DrillSchema.parse({ metric: 'time', ...d }));
  const routines = [5, 10, 20].map((minutes) =>
    PracticeRoutineSchema.parse({
      id: 'rl-warmup-' + minutes,
      name: minutes + '-minute warm-up',
      notes:
        'Editable timed template. Counts are optional; timings are targets, not a prescription.',
      blocks: [
        'rl-control',
        'rl-shooting',
        'rl-recovery',
        ...(minutes === 20 ? ['rl-aerial'] : []),
      ].map((drillId, i, ids) => ({
        id: 'rl-' + minutes + '-' + i,
        drillId,
        sets: 1,
        seconds: Math.floor((minutes * 60) / ids.length),
        restSeconds: 0,
        target: 0,
      })),
    }),
  );
  routines.push(
    ...[
      {
        id: 'rl-freeplay-control',
        name: '12-minute freeplay control',
        notes: 'Three four-minute blocks: close touches, first touches and ground dribbling.',
        blocks: [
          { drillId: 'rl-control', seconds: 240 },
          { drillId: 'rl-first-touch', seconds: 240 },
          { drillId: 'rl-dribble', seconds: 240 },
        ],
      },
      {
        id: 'rl-shooting-focus',
        name: 'Shooting consistency',
        notes: 'Three shooting sets with short breaks. Reuse one setup to compare your accuracy.',
        blocks: [{ drillId: 'rl-shooting', sets: 3, seconds: 180, restSeconds: 30 }],
      },
      {
        id: 'rl-aerial-focus',
        name: 'Aerial & recovery',
        notes: 'Repeat your chosen aerial setup, then finish with a recovery block.',
        blocks: [
          { drillId: 'rl-aerial', sets: 3, seconds: 180, restSeconds: 30 },
          { drillId: 'rl-recovery', seconds: 180 },
        ],
      },
      {
        id: 'rl-recovery-focus',
        name: 'Recoveries & boost routes',
        notes: 'Alternate recovery practice and deliberate routes through small boost pads.',
        blocks: [
          { drillId: 'rl-recovery', sets: 2, seconds: 180, restSeconds: 30 },
          { drillId: 'rl-boost-routes', sets: 2, seconds: 120, restSeconds: 30 },
        ],
      },
      {
        id: 'rl-ground-focus',
        name: 'Ground control & defence',
        notes: 'Controlled ground touches followed by repeatable defensive clears.',
        blocks: [
          { drillId: 'rl-dribble', sets: 2, seconds: 180, restSeconds: 30 },
          { drillId: 'rl-defence', sets: 2, seconds: 180, restSeconds: 30 },
        ],
      },
      {
        id: 'rl-playlist-prep',
        name: 'Playlist preparation',
        notes: 'Six minutes of freeplay, then a playlist block with one focus of your choice.',
        blocks: [
          { drillId: 'rl-control', seconds: 120 },
          { drillId: 'rl-shooting', seconds: 120 },
          { drillId: 'rl-recovery', seconds: 120 },
          {
            drillId: 'rl-playlist',
            seconds: 600,
            cue: 'Choose a playlist and focus. Finish this block after your match; the timer is only a guide.',
          },
        ],
      },
    ].map((r) =>
      PracticeRoutineSchema.parse({
        ...r,
        notes: r.notes + ' Editable example; adjust timings and difficulty to suit you.',
        blocks: r.blocks.map((b, i) => ({ sets: 1, ...b, id: r.id + '-b' + i })),
      }),
    ),
  );
  return { drills, routines };
}
export function footballStarters(): Pick<PracticeData, 'drills' | 'routines'> {
  const drills = [
    {
      id: 'fb-keepy',
      name: 'Keepy-ups',
      category: 'Ball control',
      metric: 'streak',
      cue: 'Record the best consecutive touches from this attempt. Choose your own target.',
      space: 'small',
      equipment: 'Ball',
      foot: 'alternating',
      setup: 'Alternating feet; restart each time the ball touches the ground.',
    },
    {
      id: 'fb-slalom',
      name: 'Cone slalom',
      category: 'Dribbling',
      metric: 'course',
      cue: 'Stay close to the ball. Use the same course and starting position for comparable times.',
      equipment: 'Ball, 5 cones',
      space: 'pitch',
      setup: '5 cones, 2 metres apart; out and back from the first cone.',
      cones: [
        { x: 20, y: 80 },
        { x: 35, y: 65 },
        { x: 50, y: 50 },
        { x: 65, y: 35 },
        { x: 80, y: 20 },
      ],
    },
    {
      id: 'fb-shoot',
      name: 'Target shooting',
      category: 'Shooting',
      metric: 'accuracy',
      cue: 'Choose a target zone before each shot and record hit or miss.',
      equipment: 'Ball, goal',
      space: 'pitch',
      setup: 'Stationary ball, 10 metres from goal. Aim at a chosen zone.',
    },
    {
      id: 'fb-pass',
      name: 'Wall passing',
      category: 'Passing',
      metric: 'accuracy',
      cue: 'Aim at the same marked target. Count controlled passes that reach it.',
      equipment: 'Ball, wall or rebounder',
      space: 'small',
      setup: '3 metres from a marked 1-metre target.',
    },
    {
      id: 'fb-partner',
      name: 'Partner passing',
      category: 'Passing',
      metric: 'accuracy',
      cue: 'Agree your target before the set.',
      equipment: 'Ball',
      space: 'pitch',
      partner: true,
      setup: '5-metre passing distance; agree what counts as a clean pass.',
    },
    {
      id: 'fb-mastery',
      name: 'Close-control touches',
      category: 'Ball control',
      metric: 'time',
      cue: 'Choose sole rolls, inside-outside touches or another familiar pattern. Keep the ball within your space.',
      equipment: 'Ball',
      space: 'small',
      setup: 'Clear, flat space; choose a touch pattern before each set.',
    },
    {
      id: 'fb-first-touch',
      name: 'First-touch return',
      category: 'Passing',
      metric: 'accuracy',
      cue: 'Pass to the wall, control the return and pass again. Count a hit when your first touch stays within your chosen area.',
      equipment: 'Ball, wall or rebounder',
      space: 'small',
      setup: '3 metres from the wall; mark a 1-metre control area in front of you.',
    },
    {
      id: 'fb-turns',
      name: 'Turns in a square',
      category: 'Dribbling',
      metric: 'time',
      cue: 'Dribble between corners and change direction using a turn of your choice.',
      equipment: 'Ball, 4 cones or markers',
      space: 'small',
      setup: 'Four markers in a 3-metre square. Adjust the space and note your chosen size.',
      cones: [
        { x: 20, y: 80 },
        { x: 20, y: 20 },
        { x: 80, y: 20 },
        { x: 80, y: 80 },
      ],
    },
    {
      id: 'fb-dribble-finish',
      name: 'Dribble into a finish',
      category: 'Shooting',
      metric: 'accuracy',
      cue: 'Dribble through your markers, choose a goal zone and shoot. Count the shots that reach your intended zone.',
      equipment: 'Ball, 3 cones or markers, goal',
      space: 'pitch',
      setup:
        'Three markers 2 metres apart, ending 10 metres from goal. Keep the route and shooting distance consistent.',
      cones: [
        { x: 35, y: 85 },
        { x: 65, y: 60 },
        { x: 50, y: 35 },
      ],
    },
  ].map((d) => DrillSchema.parse(d));
  const routines = [
    {
      id: 'fb-control',
      name: 'Ball control warm-up',
      blocks: [
        { drillId: 'fb-keepy', sets: 3, target: 20, seconds: 120, restSeconds: 30 },
        { drillId: 'fb-pass', sets: 2, target: 20, seconds: 120, restSeconds: 30 },
      ],
    },
    {
      id: 'fb-shooting',
      name: 'Shooting practice',
      blocks: [
        { drillId: 'fb-pass', sets: 1, target: 20, seconds: 180, restSeconds: 30 },
        { drillId: 'fb-shoot', sets: 3, target: 10, seconds: 0, restSeconds: 60 },
      ],
    },
    {
      id: 'fb-dribbling',
      name: 'Dribbling course',
      blocks: [
        { drillId: 'fb-keepy', sets: 1, target: 0, seconds: 180, restSeconds: 30 },
        { drillId: 'fb-slalom', sets: 3, target: 0, seconds: 0, restSeconds: 60 },
      ],
    },
    {
      id: 'fb-keepy-challenge',
      name: 'Keepy-up challenge',
      notes: 'Five short sets. Log each attempt to see your typical streak as well as your best.',
      blocks: [{ drillId: 'fb-keepy', sets: 5, target: 20, seconds: 90, restSeconds: 30 }],
    },
    {
      id: 'fb-small-space',
      name: 'Small-space ball mastery',
      notes: 'Solo touches, turns and keepy-ups using a ball and four markers.',
      blocks: [
        { drillId: 'fb-mastery', sets: 3, target: 0, seconds: 120, restSeconds: 30 },
        { drillId: 'fb-turns', sets: 2, target: 0, seconds: 120, restSeconds: 30 },
        { drillId: 'fb-keepy', sets: 1, target: 20, seconds: 120, restSeconds: 0 },
      ],
    },
    {
      id: 'fb-first-touch-passing',
      name: 'First touch & passing',
      notes: 'A solo wall or rebounder session for controlled returns and passing accuracy.',
      blocks: [
        { drillId: 'fb-mastery', sets: 1, target: 0, seconds: 120, restSeconds: 30 },
        { drillId: 'fb-pass', sets: 2, target: 20, seconds: 120, restSeconds: 30 },
        { drillId: 'fb-first-touch', sets: 3, target: 10, seconds: 120, restSeconds: 30 },
      ],
    },
    {
      id: 'fb-partner-session',
      name: 'Partner passing session',
      notes: 'Requires a partner. Agree a distance and a clean-pass target together.',
      blocks: [
        { drillId: 'fb-mastery', sets: 1, target: 0, seconds: 120, restSeconds: 30 },
        { drillId: 'fb-partner', sets: 4, target: 20, seconds: 180, restSeconds: 45 },
      ],
    },
    {
      id: 'fb-dribble-finish-session',
      name: 'Dribble & finish',
      notes: 'Requires markers, open space and a goal. Compare course times, then target accuracy.',
      blocks: [
        { drillId: 'fb-slalom', sets: 3, target: 0, seconds: 0, restSeconds: 45 },
        { drillId: 'fb-dribble-finish', sets: 3, target: 10, seconds: 0, restSeconds: 60 },
      ],
    },
    {
      id: 'fb-mixed-session',
      name: 'Touch, pass & shoot',
      notes: 'A mixed solo session. Requires a wall or rebounder and a goal.',
      blocks: [
        { drillId: 'fb-mastery', sets: 1, target: 0, seconds: 120, restSeconds: 30 },
        { drillId: 'fb-keepy', sets: 2, target: 20, seconds: 90, restSeconds: 30 },
        { drillId: 'fb-pass', sets: 2, target: 20, seconds: 120, restSeconds: 30 },
        { drillId: 'fb-shoot', sets: 3, target: 10, seconds: 0, restSeconds: 60 },
      ],
    },
  ].map((r) =>
    PracticeRoutineSchema.parse({
      ...r,
      notes:
        (r.notes ? r.notes + ' ' : '') +
        'Editable example. Adjust distance, difficulty, foot and targets to suit you.',
      blocks: r.blocks.map((b, i) => ({ ...b, id: r.id + '-b' + i })),
    }),
  );
  return { drills, routines };
}
export function addPracticeStarters(system: PracticeSystem, database: TrainingDB = db) {
  const starters = system === 'football' ? footballStarters() : rocketLeagueStarters();
  return changePractice(
    system,
    (p) => {
      starters.drills.forEach((d) => {
        if (!p.drills.some((existing) => existing.id === d.id)) p.drills.push(d);
      });
      starters.routines.forEach((r) => {
        if (!p.routines.some((existing) => existing.id === r.id)) p.routines.push(r);
      });
    },
    database,
  );
}
export const freshDrill = (): PracticeDrill =>
  DrillSchema.parse({
    id: crypto.randomUUID(),
    name: 'New drill',
    category: 'Custom',
    metric: 'time',
  });
