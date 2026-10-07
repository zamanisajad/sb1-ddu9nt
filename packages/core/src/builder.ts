import type { EventType, MatchEvent, MatchEventOf, PayloadOf, Period, TeamSide } from './events';
import { ulid } from './ids';

export interface EventContext {
  matchId: string;
  deviceId: string;
  nextSeq: () => number;
  now?: () => number;
}

export interface EventFields<T extends EventType> {
  type: T;
  payload: PayloadOf<T>;
  period: Period;
  gameClockSeconds: number;
  team?: TeamSide | null;
  playerId?: string | null;
  supersedes?: string | null;
}

export function buildEvent<T extends EventType>(ctx: EventContext, f: EventFields<T>): MatchEventOf<T> {
  const createdAt = (ctx.now ?? Date.now)();
  return {
    id: ulid(createdAt),
    matchId: ctx.matchId,
    deviceId: ctx.deviceId,
    seq: ctx.nextSeq(),
    period: f.period,
    gameClockSeconds: Math.max(0, Math.round(f.gameClockSeconds)),
    createdAt,
    team: f.team ?? null,
    playerId: f.playerId ?? null,
    type: f.type,
    payload: f.payload,
    supersedes: f.supersedes ?? null,
  } as MatchEventOf<T>;
}

/** A VOID event deleting `target` (which should be the head of its edit chain). */
export function voidEvent(ctx: EventContext, target: MatchEvent): MatchEventOf<'VOID'> {
  return buildEvent(ctx, {
    type: 'VOID',
    payload: {},
    period: target.period,
    gameClockSeconds: target.gameClockSeconds,
    team: null,
    supersedes: target.id,
  });
}

/** A new version of `target` with some fields changed. */
export function editEvent<E extends MatchEvent>(
  ctx: EventContext,
  target: E,
  changes: Partial<Pick<E, 'payload' | 'playerId' | 'team' | 'gameClockSeconds' | 'period'>>,
): E {
  return buildEvent(ctx, {
    type: target.type,
    payload: (changes.payload ?? target.payload) as never,
    period: changes.period ?? target.period,
    gameClockSeconds: changes.gameClockSeconds ?? target.gameClockSeconds,
    team: changes.team !== undefined ? changes.team : target.team,
    playerId: changes.playerId !== undefined ? changes.playerId : target.playerId,
    supersedes: target.id,
  }) as unknown as E;
}
