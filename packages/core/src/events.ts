import { z } from 'zod';
import { ALERT_PRESETS } from './domain';

export const PERIODS = ['1', '2', 'OT1', 'OT2'] as const;
export type Period = (typeof PERIODS)[number];
export const TEAMS = ['us', 'them'] as const;
export type TeamSide = (typeof TEAMS)[number];
export const other = (t: TeamSide): TeamSide => (t === 'us' ? 'them' : 'us');

export const SHOT_OUTCOMES = ['GOAL', 'SAVED', 'MISSED', 'POST', 'BLOCKED'] as const;
export type ShotOutcome = (typeof SHOT_OUTCOMES)[number];
export const SHOT_ZONES = [
  '6M_LEFT',
  '6M_CENTER',
  '6M_RIGHT',
  '9M_LEFT',
  '9M_CENTER',
  '9M_RIGHT',
  'WING_LEFT',
  'WING_RIGHT',
  '7M',
  'FASTBREAK',
  'EMPTY_GOAL',
] as const;
export type ShotZone = (typeof SHOT_ZONES)[number];
export const PHASES = ['POSITIONAL', 'FASTBREAK', 'SECOND_WAVE'] as const;
export type Phase = (typeof PHASES)[number];
export const TURNOVER_KINDS = [
  'TECHNICAL_FAULT',
  'BAD_PASS',
  'OFFENSIVE_FOUL',
  'STEPS',
  'PASSIVE',
  'OTHER',
] as const;
export const DEFENSE_SYSTEMS = ['6-0', '5-1', '3-2-1', '4-2', 'OTHER'] as const;
export type DefenseSystem = (typeof DEFENSE_SYSTEMS)[number];

const empty = z.object({}).strict();

export const PAYLOAD_SCHEMAS = {
  SHOT: z
    .object({
      outcome: z.enum(SHOT_OUTCOMES),
      shotZone: z.enum(SHOT_ZONES).optional(),
      goalZone: z.number().int().min(1).max(9).optional(),
      phase: z.enum(PHASES).optional(),
      goalkeeperId: z.string().max(64).nullable().optional(),
    })
    .strict(),
  TURNOVER: z.object({ kind: z.enum(TURNOVER_KINDS).default('OTHER') }).strict(),
  STEAL: empty,
  BLOCK: empty,
  SEVEN_M_DRAWN: empty,
  SEVEN_M_CONCEDED: empty,
  SUSPENSION_2MIN: empty,
  YELLOW: empty,
  RED: empty,
  TIMEOUT: empty,
  /** playerId = new goalkeeper; playerId null = empty goal (7th field player). */
  GOALKEEPER_CHANGE: empty,
  ASSIST: z.object({ goalEventId: z.string().max(64) }).strict(),
  PERIOD_START: empty,
  PERIOD_END: empty,
  DEFENSE_SYSTEM_CHANGE: z.object({ system: z.enum(DEFENSE_SYSTEMS) }).strict(),
  MARKER: z.object({ note: z.string().max(140).optional() }).strict(),
  ALERT: z.object({ preset: z.enum(ALERT_PRESETS), text: z.string().max(140).optional() }).strict(),
  /** Clock control (start/pause/adjust). gameClockSeconds is the clock value at that instant. */
  CLOCK: z.object({ running: z.boolean() }).strict(),
  /** Removes the event named in `supersedes` (used by Undo and timeline delete). */
  VOID: empty,
  /** Only used when the substitutions feature flag is on. */
  SUBSTITUTION: z
    .object({ in: z.array(z.string().max(64)).max(7), out: z.array(z.string().max(64)).max(7) })
    .strict(),
} as const;

export type EventType = keyof typeof PAYLOAD_SCHEMAS;
export const EVENT_TYPES = Object.keys(PAYLOAD_SCHEMAS) as EventType[];
export type PayloadOf<T extends EventType> = z.infer<(typeof PAYLOAD_SCHEMAS)[T]>;

/** Events whose team does not matter. */
export const TEAMLESS_TYPES: ReadonlySet<EventType> = new Set([
  'PERIOD_START',
  'PERIOD_END',
  'MARKER',
  'ALERT',
  'CLOCK',
  'VOID',
]);

/** Event types any coach may add even when they are not the live writer. */
export const NON_WRITER_TYPES: ReadonlySet<EventType> = new Set(['MARKER']);

const baseShape = {
  id: z.string().min(10).max(64),
  matchId: z.string().min(1).max(64),
  deviceId: z.string().min(1).max(64),
  seq: z.number().int().nonnegative(),
  period: z.enum(PERIODS),
  gameClockSeconds: z.number().int().min(0).max(4 * 3600),
  /** Epoch milliseconds on the creating device. */
  createdAt: z.number().int().nonnegative(),
  team: z.enum(TEAMS).nullable(),
  playerId: z.string().max(64).nullable(),
  supersedes: z.string().max(64).nullable(),
};

type Variant<T extends EventType> = z.ZodObject<
  typeof baseShape & { type: z.ZodLiteral<T>; payload: (typeof PAYLOAD_SCHEMAS)[T] }
>;

const variants = EVENT_TYPES.map((type) =>
  z.object({ ...baseShape, type: z.literal(type), payload: PAYLOAD_SCHEMAS[type] }),
) as unknown as [Variant<'SHOT'>, Variant<'TURNOVER'>, ...Variant<EventType>[]];

export const EventSchema = z.discriminatedUnion('type', variants).superRefine((e, ctx) => {
  if (e.type === 'VOID' && !e.supersedes) {
    ctx.addIssue({ code: 'custom', message: 'VOID requires supersedes' });
  }
  if (!TEAMLESS_TYPES.has(e.type) && e.team === null) {
    ctx.addIssue({ code: 'custom', message: `${e.type} requires team` });
  }
  if (e.supersedes === e.id) {
    ctx.addIssue({ code: 'custom', message: 'event cannot supersede itself' });
  }
});

type EventBase = {
  id: string;
  matchId: string;
  deviceId: string;
  seq: number;
  period: Period;
  gameClockSeconds: number;
  createdAt: number;
  team: TeamSide | null;
  playerId: string | null;
  supersedes: string | null;
};

export type MatchEventOf<T extends EventType> = EventBase & { type: T; payload: PayloadOf<T> };
export type MatchEvent = { [T in EventType]: MatchEventOf<T> }[EventType];

/** Event as stored/returned by the server, with the server-assigned cursor. */
export type StoredEvent = MatchEvent & { serverSeq?: number; createdBy?: string | null };

export function isType<T extends EventType>(e: MatchEvent, t: T): e is MatchEventOf<T> {
  return e.type === t;
}

export function parseEvent(input: unknown): MatchEvent {
  return EventSchema.parse(input) as MatchEvent;
}

export function safeParseEvent(
  input: unknown,
): { ok: true; event: MatchEvent } | { ok: false; error: string } {
  const r = EventSchema.safeParse(input);
  if (r.success) return { ok: true, event: r.data as MatchEvent };
  return { ok: false, error: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
}
