import type { MatchEvent, Period, TeamSide } from '../events';
import { other } from '../events';

export type PossessionEnd =
  | 'GOAL'
  | 'SHOT_LOST'
  | 'TURNOVER'
  | 'STEAL'
  | 'PERIOD_END'
  | 'IMPLICIT'
  | 'OPEN';

export interface Possession {
  team: TeamSide;
  period: Period;
  start: number;
  end: number;
  endReason: PossessionEnd;
  goal: boolean;
  shots: number;
  eventIds: string[];
}

/**
 * Possession rules (explicit and unit-tested). Events are processed in game order.
 *
 * Which team is attacking, per event:
 *   SHOT, TURNOVER, SEVEN_M_DRAWN  -> event.team
 *   SEVEN_M_CONCEDED, STEAL        -> the other team (event.team is the defender)
 *   everything else                -> no effect on possessions (BLOCK is a
 *                                    defensive stat; the matching SHOT/BLOCKED
 *                                    is what counts).
 *
 * A possession ENDS when:
 *   1. the attacking team scores (SHOT/GOAL)                      -> GOAL
 *   2. the attacking team turns the ball over (TURNOVER)          -> TURNOVER
 *   3. the defending team steals it (STEAL) while it is open      -> STEAL
 *   4. a non-goal shot (SAVED/MISSED/POST/BLOCKED) loses the ball:
 *      the shot puts the possession in a "pending" state; if the next
 *      attacking event belongs to the OTHER team (or the period ends), the
 *      possession ended with the shot -> SHOT_LOST. If the next attacking event
 *      is by the SAME team, it was an offensive rebound and the possession
 *      simply continues.
 *   5. PERIOD_END                                                  -> PERIOD_END
 *   6. an attacking event by the other team arrives while a
 *      possession is still open (nothing recorded the change)     -> IMPLICIT
 *
 * A possession still running at the end of the log is OPEN and is excluded
 * from efficiency counts (a pending one counts as SHOT_LOST, as the ball was
 * most likely lost).
 */
export function derivePossessions(events: readonly MatchEvent[]): Possession[] {
  const out: Possession[] = [];
  let cur: (Possession & { pending: boolean }) | null = null;

  const close = (reason: PossessionEnd, at: number) => {
    if (!cur) return;
    const { pending: _pending, ...p } = cur;
    out.push({ ...p, end: at, endReason: reason });
    cur = null;
  };
  const open = (team: TeamSide, e: MatchEvent) => {
    cur = {
      team,
      period: e.period,
      start: e.gameClockSeconds,
      end: e.gameClockSeconds,
      endReason: 'OPEN',
      goal: false,
      shots: 0,
      eventIds: [],
      pending: false,
    };
  };
  /** Make sure an open possession for `team` exists, closing the other side's. */
  const ensure = (team: TeamSide, e: MatchEvent) => {
    if (cur && cur.team !== team) close(cur.pending ? 'SHOT_LOST' : 'IMPLICIT', e.gameClockSeconds);
    if (cur && cur.team === team && cur.period !== e.period) close('PERIOD_END', e.gameClockSeconds);
    if (!cur) open(team, e);
    cur!.pending = false;
    cur!.eventIds.push(e.id);
    cur!.end = e.gameClockSeconds;
    return cur!;
  };

  for (const e of events) {
    switch (e.type) {
      case 'PERIOD_START':
        if (cur) close(cur.pending ? 'SHOT_LOST' : 'PERIOD_END', e.gameClockSeconds);
        break;
      case 'PERIOD_END':
        if (cur) close(cur.pending ? 'SHOT_LOST' : 'PERIOD_END', e.gameClockSeconds);
        break;
      case 'SHOT': {
        if (!e.team) break;
        const p = ensure(e.team, e);
        p.shots += 1;
        if (e.payload.outcome === 'GOAL') {
          p.goal = true;
          close('GOAL', e.gameClockSeconds);
        } else {
          p.pending = true;
        }
        break;
      }
      case 'TURNOVER':
        if (!e.team) break;
        ensure(e.team, e);
        close('TURNOVER', e.gameClockSeconds);
        break;
      case 'SEVEN_M_DRAWN':
        if (e.team) ensure(e.team, e);
        break;
      case 'SEVEN_M_CONCEDED':
        if (e.team) ensure(other(e.team), e);
        break;
      case 'STEAL': {
        if (!e.team) break;
        const victim = other(e.team);
        const c = cur as (Possession & { pending: boolean }) | null;
        if (c && c.team === victim) {
          c.eventIds.push(e.id);
          close(c.pending ? 'SHOT_LOST' : 'STEAL', e.gameClockSeconds);
        }
        break;
      }
      default:
        break;
    }
  }
  if (cur) {
    const c = cur as Possession & { pending: boolean };
    if (c.pending) close('SHOT_LOST', c.end);
    else close('OPEN', c.end);
  }
  return out;
}

export function countedPossessions(ps: readonly Possession[]): Possession[] {
  return ps.filter((p) => p.endReason !== 'OPEN');
}

/** The team with the ball right now (open possession), if known. */
export function currentPossession(ps: readonly Possession[]): TeamSide | null {
  const last = ps[ps.length - 1];
  if (!last) return null;
  if (last.endReason === 'OPEN') return last.team;
  if (last.endReason === 'PERIOD_END') return null;
  return other(last.team);
}
