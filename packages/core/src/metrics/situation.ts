import type { MatchEvent, TeamSide } from '../events';

export const SUSPENSION_SECONDS = 120;
export const BASE_FIELD_PLAYERS = 6;

export interface Suspension {
  eventId: string;
  team: TeamSide;
  playerId: string | null;
  start: number;
  end: number;
  /** RED cards also cost the team two minutes. */
  kind: 'SUSPENSION_2MIN' | 'RED';
}

export interface GoalkeeperSpell {
  team: TeamSide;
  /** null = empty goal (7th field player). */
  playerId: string | null;
  from: number;
}

/**
 * Numerical-situation rules (explicit and unit-tested):
 *  - Every SUSPENSION_2MIN and every RED card removes one field player of that
 *    team for 120 game-clock seconds: active on [start, start + 120).
 *  - Suspensions are independent timers, so overlapping ones stack (6 -> 5 -> 4).
 *    In handball a suspension does NOT end when the opponent scores.
 *  - The clock is cumulative, so a suspension that starts late in a half carries
 *    its remaining time into the next half.
 *  - A GOALKEEPER_CHANGE with playerId = null means the team pulled its goalkeeper
 *    for a 7th field player (empty goal): +1 field player until the next
 *    GOALKEEPER_CHANGE for that team names a goalkeeper.
 *  - A team never has fewer than 0 field players (the engine does not enforce
 *    rule-book minimums; it reflects what the analyst recorded).
 */
export function collectSuspensions(events: readonly MatchEvent[]): Suspension[] {
  const out: Suspension[] = [];
  for (const e of events) {
    if ((e.type === 'SUSPENSION_2MIN' || e.type === 'RED') && e.team) {
      out.push({
        eventId: e.id,
        team: e.team,
        playerId: e.playerId,
        start: e.gameClockSeconds,
        end: e.gameClockSeconds + SUSPENSION_SECONDS,
        kind: e.type,
      });
    }
  }
  return out;
}

export function collectGoalkeeperSpells(events: readonly MatchEvent[]): GoalkeeperSpell[] {
  return events
    .filter((e) => e.type === 'GOALKEEPER_CHANGE' && e.team)
    .map((e) => ({ team: e.team!, playerId: e.playerId, from: e.gameClockSeconds }));
}

export function activeSuspensions(susp: readonly Suspension[], t: number): Suspension[] {
  return susp.filter((s) => s.start <= t && t < s.end);
}

/**
 * Goalkeeper of `team` at time t. Uses the spells in event order: the last
 * change at or before t wins. Returns undefined if never recorded.
 */
export function goalkeeperAt(
  spells: readonly GoalkeeperSpell[],
  team: TeamSide,
  t: number,
  inclusive = true,
): string | null | undefined {
  let gk: string | null | undefined = undefined;
  for (const s of spells) {
    if (s.team !== team) continue;
    if (inclusive ? s.from <= t : s.from < t) gk = s.playerId;
  }
  return gk;
}

export interface Situation {
  us: number;
  them: number;
  usEmptyGoal: boolean;
  themEmptyGoal: boolean;
}

export function situationAt(
  susp: readonly Suspension[],
  spells: readonly GoalkeeperSpell[],
  t: number,
): Situation {
  const active = activeSuspensions(susp, t);
  const usEmpty = goalkeeperAt(spells, 'us', t) === null;
  const themEmpty = goalkeeperAt(spells, 'them', t) === null;
  const count = (team: TeamSide, empty: boolean) =>
    Math.max(0, BASE_FIELD_PLAYERS - active.filter((s) => s.team === team).length + (empty ? 1 : 0));
  return { us: count('us', usEmpty), them: count('them', themEmpty), usEmptyGoal: usEmpty, themEmptyGoal: themEmpty };
}

/** "6v5" from the perspective of `team`. */
export function situationKey(s: Situation, team: TeamSide): string {
  return team === 'us' ? `${s.us}v${s.them}` : `${s.them}v${s.us}`;
}

export type SituationCategory = 'EVEN' | 'ADVANTAGE' | 'DISADVANTAGE';
export function situationCategory(s: Situation, team: TeamSide): SituationCategory {
  const mine = team === 'us' ? s.us : s.them;
  const theirs = team === 'us' ? s.them : s.us;
  return mine === theirs ? 'EVEN' : mine > theirs ? 'ADVANTAGE' : 'DISADVANTAGE';
}

export interface SituationSegment extends Situation {
  from: number;
  to: number;
}

/** Piecewise-constant numerical situation over [0, until). Adjacent equal segments are merged. */
export function situationTimeline(
  susp: readonly Suspension[],
  spells: readonly GoalkeeperSpell[],
  until: number,
): SituationSegment[] {
  const points = new Set<number>([0]);
  for (const s of susp) {
    points.add(s.start);
    points.add(s.end);
  }
  for (const g of spells) points.add(g.from);
  const sorted = [...points].filter((p) => p >= 0 && p < until).sort((a, b) => a - b);
  const segments: SituationSegment[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i]!;
    const to = sorted[i + 1] ?? until;
    const s = situationAt(susp, spells, from);
    const prev = segments[segments.length - 1];
    if (
      prev &&
      prev.us === s.us &&
      prev.them === s.them &&
      prev.usEmptyGoal === s.usEmptyGoal &&
      prev.themEmptyGoal === s.themEmptyGoal
    ) {
      prev.to = to;
    } else {
      segments.push({ ...s, from, to });
    }
  }
  return segments;
}
