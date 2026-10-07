import type { MatchEvent } from '../events';
import type { FeatureFlags, Match } from '../domain';
import { computeMatch, type Ratio } from './stats';

export const SMALL_SAMPLE_SHOTS = 10;

export interface PlayerMatchLine {
  matchId: string;
  date: string;
  opponentId: string;
  competitionId: string | null;
  goals: number;
  shots: number;
  pct: number | null;
  turnovers: number;
  steals: number;
  assists: number;
  suspensions: number;
  saves: number;
  faced: number;
  teamPossessions: number;
  secondsPlayed: number | null;
}

export interface PlayerSeason {
  playerId: string;
  matches: number;
  goals: number;
  shooting: Ratio;
  turnovers: number;
  steals: number;
  assists: number;
  suspensions: number;
  saves: Ratio;
  teamPossessions: number;
  secondsPlayed: number | null;
  /** goals per 100 team possessions */
  goalsPer100Poss: number | null;
  /** per 60 minutes, only when minutes are tracked */
  goalsPer60: number | null;
  smallSample: boolean;
  lines: PlayerMatchLine[];
  /** last five matches (most recent last) */
  last5: PlayerMatchLine[];
}

const r = (made: number, total: number): Ratio => ({ made, total, pct: total ? made / total : null });

/** Accumulate a player's lines over matches (each with its own event log). */
export function playerSeason(
  playerId: string,
  matches: readonly { match: Match; events: readonly MatchEvent[] }[],
  flags?: FeatureFlags,
): PlayerSeason {
  const lines: PlayerMatchLine[] = [];
  const sorted = [...matches].sort((a, b) => a.match.date.localeCompare(b.match.date));
  for (const { match, events } of sorted) {
    const inRoster = match.roster.some((x) => x.playerId === playerId);
    const stats = computeMatch(events, { flags });
    const p = stats.players[playerId];
    if (!p && !inRoster) continue;
    lines.push({
      matchId: match.id,
      date: match.date,
      opponentId: match.opponentId,
      competitionId: match.competitionId,
      goals: p?.goals ?? 0,
      shots: p?.shooting.total ?? 0,
      pct: p?.shooting.pct ?? null,
      turnovers: p?.turnovers ?? 0,
      steals: p?.steals ?? 0,
      assists: p?.assists ?? 0,
      suspensions: p?.suspensions ?? 0,
      saves: p?.goalkeeping.overall.made ?? 0,
      faced: p?.goalkeeping.overall.total ?? 0,
      teamPossessions: stats.teams[p?.team ?? 'us'].possessions,
      secondsPlayed: p?.secondsPlayed ?? null,
    });
  }
  const sum = (f: (l: PlayerMatchLine) => number) => lines.reduce((s, l) => s + f(l), 0);
  const goals = sum((l) => l.goals);
  const shots = sum((l) => l.shots);
  const poss = sum((l) => l.teamPossessions);
  const tracked = lines.every((l) => l.secondsPlayed !== null) && lines.length > 0;
  const seconds = tracked ? sum((l) => l.secondsPlayed ?? 0) : null;
  return {
    playerId,
    matches: lines.length,
    goals,
    shooting: r(goals, shots),
    turnovers: sum((l) => l.turnovers),
    steals: sum((l) => l.steals),
    assists: sum((l) => l.assists),
    suspensions: sum((l) => l.suspensions),
    saves: r(sum((l) => l.saves), sum((l) => l.faced)),
    teamPossessions: poss,
    secondsPlayed: seconds,
    goalsPer100Poss: poss ? (goals / poss) * 100 : null,
    goalsPer60: seconds ? (goals / seconds) * 3600 : null,
    smallSample: shots < SMALL_SAMPLE_SHOTS,
    lines,
    last5: lines.slice(-5),
  };
}
