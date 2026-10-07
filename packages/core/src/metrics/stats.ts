import type { MatchEvent, MatchEventOf, Period, Phase, ShotOutcome, ShotZone, TeamSide } from '../events';
import { PHASES, SHOT_ZONES, other } from '../events';
import { resolveEvents } from '../resolve';
import type { FeatureFlags } from '../domain';
import { DEFAULT_FLAGS } from '../domain';
import {
  activeSuspensions,
  collectGoalkeeperSpells,
  collectSuspensions,
  goalkeeperAt,
  situationAt,
  situationCategory,
  situationKey,
  situationTimeline,
  type Situation,
  type SituationCategory,
  type SituationSegment,
  type Suspension,
} from './situation';
import { countedPossessions, currentPossession, derivePossessions, type Possession } from './possessions';

export interface Ratio {
  made: number;
  total: number;
  /** made / total, or null when total is 0. */
  pct: number | null;
}
const ratio = (made: number, total: number): Ratio => ({
  made,
  total,
  pct: total === 0 ? null : made / total,
});
const add = (r: Ratio, made: boolean): Ratio => ratio(r.made + (made ? 1 : 0), r.total + 1);
const zero = (): Ratio => ratio(0, 0);

export type ZoneKey = ShotZone | 'UNKNOWN';
export type PhaseKey = Phase | 'UNKNOWN';
const ZONE_KEYS: ZoneKey[] = [...SHOT_ZONES, 'UNKNOWN'];
const PHASE_KEYS: PhaseKey[] = [...PHASES, 'UNKNOWN'];
const zoneMap = (): Record<ZoneKey, Ratio> =>
  Object.fromEntries(ZONE_KEYS.map((z) => [z, zero()])) as Record<ZoneKey, Ratio>;
const phaseMap = (): Record<PhaseKey, Ratio> =>
  Object.fromEntries(PHASE_KEYS.map((z) => [z, zero()])) as Record<PhaseKey, Ratio>;

export interface GoalkeepingStats {
  /** saves / (saves + goals conceded); empty-goal goals excluded. */
  overall: Ratio;
  byZone: Record<ZoneKey, Ratio>;
}
const gkStats = (): GoalkeepingStats => ({ overall: zero(), byZone: zoneMap() });

export interface TeamStats {
  goals: number;
  shooting: Ratio;
  byZone: Record<ZoneKey, Ratio>;
  byPhase: Record<PhaseKey, Ratio>;
  sevenM: Ratio;
  fastbreakGoals: number;
  turnovers: number;
  turnoversByKind: Record<string, number>;
  steals: number;
  blocks: number;
  sevenMDrawn: number;
  sevenMConceded: number;
  suspensions: number;
  yellows: number;
  reds: number;
  timeouts: number;
  possessions: number;
  /** goals / possessions */
  attack: Ratio;
  attackBySituation: Record<string, Ratio>;
  attackByCategory: Record<SituationCategory, Ratio>;
  goalsByPeriod: Record<Period, number>;
  /** This team's goalkeeping (shots faced from the other team). */
  goalkeeping: GoalkeepingStats;
}

const teamStats = (): TeamStats => ({
  goals: 0,
  shooting: zero(),
  byZone: zoneMap(),
  byPhase: phaseMap(),
  sevenM: zero(),
  fastbreakGoals: 0,
  turnovers: 0,
  turnoversByKind: {},
  steals: 0,
  blocks: 0,
  sevenMDrawn: 0,
  sevenMConceded: 0,
  suspensions: 0,
  yellows: 0,
  reds: 0,
  timeouts: 0,
  possessions: 0,
  attack: zero(),
  attackBySituation: {},
  attackByCategory: { EVEN: zero(), ADVANTAGE: zero(), DISADVANTAGE: zero() },
  goalsByPeriod: { '1': 0, '2': 0, OT1: 0, OT2: 0 },
  goalkeeping: gkStats(),
});

export interface PlayerStats {
  playerId: string;
  team: TeamSide;
  goals: number;
  shooting: Ratio;
  byZone: Record<ZoneKey, Ratio>;
  sevenM: Ratio;
  turnovers: number;
  steals: number;
  blocks: number;
  assists: number;
  sevenMDrawn: number;
  sevenMConceded: number;
  suspensions: number;
  yellows: number;
  reds: number;
  /** Third 2-minute suspension or a red card. */
  disqualified: boolean;
  goalkeeping: GoalkeepingStats;
  /** Only with the substitutions feature flag. */
  secondsPlayed: number | null;
  plusMinus: number | null;
}

const playerStats = (playerId: string, team: TeamSide): PlayerStats => ({
  playerId,
  team,
  goals: 0,
  shooting: zero(),
  byZone: zoneMap(),
  sevenM: zero(),
  turnovers: 0,
  steals: 0,
  blocks: 0,
  assists: 0,
  sevenMDrawn: 0,
  sevenMConceded: 0,
  suspensions: 0,
  yellows: 0,
  reds: 0,
  disqualified: false,
  goalkeeping: gkStats(),
  secondsPlayed: null,
  plusMinus: null,
});

export interface ShotPoint {
  eventId: string;
  team: TeamSide;
  playerId: string | null;
  goalkeeperId: string | null;
  outcome: ShotOutcome;
  zone: ZoneKey;
  goalZone: number | null;
  phase: PhaseKey;
  clock: number;
  period: Period;
}

export interface TrendBucket {
  from: number;
  to: number;
  us: { goals: number; shots: number; turnovers: number };
  them: { goals: number; shots: number; turnovers: number };
}

export interface MatchStats {
  /** Effective events in game order. */
  events: MatchEvent[];
  score: { us: number; them: number };
  teams: Record<TeamSide, TeamStats>;
  players: Record<string, PlayerStats>;
  possessions: Possession[];
  currentPossession: TeamSide | null;
  suspensions: Suspension[];
  activeSuspensions: (Suspension & { remaining: number })[];
  situation: Situation;
  situationTimeline: SituationSegment[];
  goalkeepers: Record<TeamSide, string | null | undefined>;
  defenseSystem: Record<TeamSide, string | null>;
  shots: ShotPoint[];
  markers: MatchEventOf<'MARKER'>[];
  alerts: MatchEventOf<'ALERT'>[];
  trend: TrendBucket[];
  last5: TrendBucket;
  /** Game clock the "now" metrics were computed for. */
  now: number;
  /** Current period (from the last PERIOD_START) or null before kick-off. */
  period: Period | null;
}

export interface ComputeOptions {
  /** Current game clock; defaults to the last event's clock. */
  now?: number;
  flags?: FeatureFlags;
}

const onTargetMade = (o: ShotOutcome) => o === 'GOAL';
const TREND_BUCKET = 300;

/** The one entry point: raw (possibly duplicated, unordered) log in, every derived metric out. */
export function computeMatch(rawEvents: readonly MatchEvent[], opts: ComputeOptions = {}): MatchStats {
  const flags = opts.flags ?? DEFAULT_FLAGS;
  const { events } = resolveEvents(rawEvents);
  const lastClock = events.reduce((m, e) => Math.max(m, e.gameClockSeconds), 0);
  const now = opts.now ?? lastClock;

  const teams: Record<TeamSide, TeamStats> = { us: teamStats(), them: teamStats() };
  const players: Record<string, PlayerStats> = {};
  const P = (id: string | null, team: TeamSide | null): PlayerStats | null => {
    if (!id || !team) return null;
    return (players[id] ??= playerStats(id, team));
  };

  const suspensions = collectSuspensions(events);
  const spells = collectGoalkeeperSpells(events);
  const shots: ShotPoint[] = [];
  const markers: MatchEventOf<'MARKER'>[] = [];
  const alerts: MatchEventOf<'ALERT'>[] = [];
  const defenseSystem: Record<TeamSide, string | null> = { us: null, them: null };
  const suspCount = new Map<string, number>();
  let period: Period | null = null;

  for (const e of events) {
    const T = e.team ? teams[e.team] : null;
    const pl = P(e.playerId, e.team);
    switch (e.type) {
      case 'SHOT': {
        if (!T || !e.team) break;
        const { outcome } = e.payload;
        const zone: ZoneKey = e.payload.shotZone ?? 'UNKNOWN';
        const phase: PhaseKey = e.payload.phase ?? 'UNKNOWN';
        const made = onTargetMade(outcome);
        T.shooting = add(T.shooting, made);
        T.byZone[zone] = add(T.byZone[zone], made);
        T.byPhase[phase] = add(T.byPhase[phase], made);
        if (zone === '7M') T.sevenM = add(T.sevenM, made);
        if (made) {
          T.goals += 1;
          T.goalsByPeriod[e.period] += 1;
          if (phase === 'FASTBREAK' || zone === 'FASTBREAK') T.fastbreakGoals += 1;
        }
        if (pl) {
          pl.shooting = add(pl.shooting, made);
          pl.byZone[zone] = add(pl.byZone[zone], made);
          if (zone === '7M') pl.sevenM = add(pl.sevenM, made);
          if (made) pl.goals += 1;
        }
        // Goalkeeping of the defending team. Only on-target shots count.
        const defending = other(e.team);
        const gkId =
          e.payload.goalkeeperId !== undefined && e.payload.goalkeeperId !== null
            ? e.payload.goalkeeperId
            : goalkeeperAt(spells, defending, e.gameClockSeconds);
        const emptyGoal = zone === 'EMPTY_GOAL' || gkId === null;
        if ((outcome === 'GOAL' || outcome === 'SAVED') && !emptyGoal) {
          const saved = outcome === 'SAVED';
          const G = teams[defending].goalkeeping;
          G.overall = add(G.overall, saved);
          G.byZone[zone] = add(G.byZone[zone], saved);
          const gp = gkId ? P(gkId, defending) : null;
          if (gp) {
            gp.goalkeeping.overall = add(gp.goalkeeping.overall, saved);
            gp.goalkeeping.byZone[zone] = add(gp.goalkeeping.byZone[zone], saved);
          }
        }
        shots.push({
          eventId: e.id,
          team: e.team,
          playerId: e.playerId,
          goalkeeperId: gkId ?? null,
          outcome,
          zone,
          goalZone: e.payload.goalZone ?? null,
          phase,
          clock: e.gameClockSeconds,
          period: e.period,
        });
        break;
      }
      case 'TURNOVER':
        if (T) {
          T.turnovers += 1;
          T.turnoversByKind[e.payload.kind] = (T.turnoversByKind[e.payload.kind] ?? 0) + 1;
        }
        if (pl) pl.turnovers += 1;
        break;
      case 'STEAL':
        if (T) T.steals += 1;
        if (pl) pl.steals += 1;
        break;
      case 'BLOCK':
        if (T) T.blocks += 1;
        if (pl) pl.blocks += 1;
        break;
      case 'SEVEN_M_DRAWN':
        if (T) T.sevenMDrawn += 1;
        if (pl) pl.sevenMDrawn += 1;
        break;
      case 'SEVEN_M_CONCEDED':
        if (T) T.sevenMConceded += 1;
        if (pl) pl.sevenMConceded += 1;
        break;
      case 'SUSPENSION_2MIN':
        if (T) T.suspensions += 1;
        if (pl) {
          pl.suspensions += 1;
          const n = (suspCount.get(pl.playerId) ?? 0) + 1;
          suspCount.set(pl.playerId, n);
          if (n >= 3) pl.disqualified = true;
        }
        break;
      case 'YELLOW':
        if (T) T.yellows += 1;
        if (pl) pl.yellows += 1;
        break;
      case 'RED':
        if (T) T.reds += 1;
        if (pl) {
          pl.reds += 1;
          pl.disqualified = true;
        }
        break;
      case 'TIMEOUT':
        if (T) T.timeouts += 1;
        break;
      case 'ASSIST':
        if (pl) pl.assists += 1;
        break;
      case 'DEFENSE_SYSTEM_CHANGE':
        if (e.team) defenseSystem[e.team] = e.payload.system;
        break;
      case 'MARKER':
        markers.push(e);
        break;
      case 'ALERT':
        alerts.push(e);
        break;
      case 'PERIOD_START':
        period = e.period;
        break;
      default:
        break;
    }
  }

  // Possessions and attack efficiency.
  const possessions = derivePossessions(events);
  for (const p of countedPossessions(possessions)) {
    const T = teams[p.team];
    T.possessions += 1;
    T.attack = add(T.attack, p.goal);
    const s = situationAt(suspensions, spells, p.start);
    const key = situationKey(s, p.team);
    T.attackBySituation[key] = add(T.attackBySituation[key] ?? zero(), p.goal);
    const cat = situationCategory(s, p.team);
    T.attackByCategory[cat] = add(T.attackByCategory[cat], p.goal);
  }

  // Trend: 5-minute buckets and the last 5 minutes.
  const bucket = (from: number, to: number): TrendBucket => {
    const b: TrendBucket = {
      from,
      to,
      us: { goals: 0, shots: 0, turnovers: 0 },
      them: { goals: 0, shots: 0, turnovers: 0 },
    };
    for (const e of events) {
      if (!e.team || e.gameClockSeconds < from || e.gameClockSeconds >= to) continue;
      if (e.type === 'SHOT') {
        b[e.team].shots += 1;
        if (e.payload.outcome === 'GOAL') b[e.team].goals += 1;
      } else if (e.type === 'TURNOVER') b[e.team].turnovers += 1;
    }
    return b;
  };
  const trend: TrendBucket[] = [];
  for (let from = 0; from <= Math.max(0, now - 1); from += TREND_BUCKET) trend.push(bucket(from, from + TREND_BUCKET));
  const last5 = bucket(Math.max(0, now - TREND_BUCKET), now + 1);

  // Optional: minutes and +/- from substitutions.
  if (flags.substitutions) applySubstitutions(events, players, now);

  const situation = situationAt(suspensions, spells, now);
  return {
    events,
    score: { us: teams.us.goals, them: teams.them.goals },
    teams,
    players,
    possessions,
    currentPossession: currentPossession(possessions),
    suspensions,
    activeSuspensions: activeSuspensions(suspensions, now).map((s) => ({ ...s, remaining: s.end - now })),
    situation,
    situationTimeline: situationTimeline(suspensions, spells, Math.max(now, 1)),
    goalkeepers: {
      us: goalkeeperAt(spells, 'us', now),
      them: goalkeeperAt(spells, 'them', now),
    },
    defenseSystem,
    shots,
    markers,
    alerts,
    trend,
    last5,
    now,
    period,
  };
}

/**
 * Minutes played and +/- from SUBSTITUTION events (feature-flagged).
 * Time only accrues while a period is being played (between PERIOD_START and
 * PERIOD_END, or `now` for the running period). A goal at clock t counts for
 * players on court at t.
 */
function applySubstitutions(events: readonly MatchEvent[], players: Record<string, PlayerStats>, now: number) {
  const played: [number, number][] = [];
  let periodStart: number | null = null;
  for (const e of events) {
    if (e.type === 'PERIOD_START') periodStart = e.gameClockSeconds;
    if (e.type === 'PERIOD_END' && periodStart !== null) {
      played.push([periodStart, e.gameClockSeconds]);
      periodStart = null;
    }
  }
  if (periodStart !== null) played.push([periodStart, now]);

  const stints = new Map<string, { team: TeamSide; from: number; to: number | null }[]>();
  const onCourt = new Map<string, TeamSide>();
  for (const e of events) {
    if (e.type !== 'SUBSTITUTION' || !e.team) continue;
    for (const id of e.payload.out) {
      const list = stints.get(id);
      const last = list?.[list.length - 1];
      if (last && last.to === null) last.to = e.gameClockSeconds;
      onCourt.delete(id);
    }
    for (const id of e.payload.in) {
      if (onCourt.has(id)) continue;
      onCourt.set(id, e.team);
      const list = stints.get(id) ?? [];
      list.push({ team: e.team, from: e.gameClockSeconds, to: null });
      stints.set(id, list);
    }
  }
  const overlap = (a: number, b: number) =>
    played.reduce((sum, [s, f]) => sum + Math.max(0, Math.min(b, f) - Math.max(a, s)), 0);
  const goals = events.filter(
    (e): e is MatchEventOf<'SHOT'> => e.type === 'SHOT' && e.payload.outcome === 'GOAL' && !!e.team,
  );
  for (const [id, list] of stints) {
    const team = list[0]!.team;
    const p = (players[id] ??= playerStats(id, team));
    p.secondsPlayed = 0;
    p.plusMinus = 0;
    for (const s of list) {
      const to = s.to ?? now;
      p.secondsPlayed += overlap(s.from, to);
      for (const g of goals) {
        const t = g.gameClockSeconds;
        if (t >= s.from && (s.to === null ? t <= now : t < s.to)) p.plusMinus += g.team === team ? 1 : -1;
      }
    }
  }
  for (const p of Object.values(players)) {
    if (p.secondsPlayed === null) {
      p.secondsPlayed = 0;
      p.plusMinus = 0;
    }
  }
}

