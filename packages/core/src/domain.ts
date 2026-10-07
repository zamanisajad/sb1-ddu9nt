import { z } from 'zod';

export const POSITIONS = ['GK', 'LW', 'RW', 'LB', 'RB', 'CB', 'PV'] as const;
export type Position = (typeof POSITIONS)[number];
export const ROLES = ['ADMIN', 'COACH', 'ANALYST', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];
export const AGE_CATEGORIES = ['SENIOR', 'U21', 'U19', 'U17', 'U15', 'U13'] as const;
export const GENDERS = ['M', 'F'] as const;
export const HANDS = ['L', 'R'] as const;
export const MATCH_STATUSES = ['scheduled', 'live', 'finished'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

const id = z.string().min(1).max(64);
const name = z.string().trim().min(1).max(80);
const timestamps = { updatedAt: z.number().int().nonnegative(), deleted: z.boolean().default(false) };

export const TeamSchema = z.object({
  id,
  orgId: id,
  name,
  ageCategory: z.enum(AGE_CATEGORIES),
  gender: z.enum(GENDERS),
  ...timestamps,
});
export type Team = z.infer<typeof TeamSchema>;

/** A person. Deliberately minimal: players may be minors (no national id, no address, no medical data). */
export const PlayerSchema = z.object({
  id,
  orgId: id,
  name,
  birthYear: z.number().int().min(1940).max(2100).nullable(),
  dominantHand: z.enum(HANDS).nullable(),
  available: z.boolean().default(true),
  ...timestamps,
});
export type Player = z.infer<typeof PlayerSchema>;

/** Season membership of a player in a team. */
export const SquadMemberSchema = z.object({
  id,
  orgId: id,
  teamId: id,
  playerId: id,
  season: z.string().min(1).max(20),
  shirtNumber: z.number().int().min(0).max(99),
  position: z.enum(POSITIONS),
  ...timestamps,
});
export type SquadMember = z.infer<typeof SquadMemberSchema>;

export const OpponentPlayerSchema = z.object({
  id,
  shirtNumber: z.number().int().min(0).max(99),
  name: z.string().trim().max(80).nullable().default(null),
  position: z.enum(POSITIONS).nullable().default(null),
});
export type OpponentPlayer = z.infer<typeof OpponentPlayerSchema>;

export const OpponentSchema = z.object({
  id,
  orgId: id,
  name,
  players: z.array(OpponentPlayerSchema).max(60),
  ...timestamps,
});
export type Opponent = z.infer<typeof OpponentSchema>;

export const CompetitionSchema = z.object({
  id,
  orgId: id,
  name,
  season: z.string().min(1).max(20),
  ...timestamps,
});
export type Competition = z.infer<typeof CompetitionSchema>;

export const RosterEntrySchema = z.object({
  playerId: id,
  shirtNumber: z.number().int().min(0).max(99),
  position: z.enum(POSITIONS),
});
export type RosterEntry = z.infer<typeof RosterEntrySchema>;

export const MatchSchema = z.object({
  id,
  orgId: id,
  teamId: id,
  opponentId: id,
  competitionId: id.nullable(),
  season: z.string().min(1).max(20),
  /** Gregorian ISO date-time; displayed as Jalali. */
  date: z.string().min(10).max(40),
  venue: z.enum(['home', 'away']),
  halfLengthMin: z.union([z.literal(30), z.literal(25), z.literal(20)]),
  status: z.enum(MATCH_STATUSES),
  roster: z.array(RosterEntrySchema).max(30),
  /** Subset of opponent player ids dressed for this match (empty = all). */
  opponentRoster: z.array(id).max(30).default([]),
  ...timestamps,
});
export type Match = z.infer<typeof MatchSchema>;

export const ENTITY_KINDS = ['team', 'player', 'squad', 'opponent', 'competition', 'match'] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export const ENTITY_SCHEMAS = {
  team: TeamSchema,
  player: PlayerSchema,
  squad: SquadMemberSchema,
  opponent: OpponentSchema,
  competition: CompetitionSchema,
  match: MatchSchema,
} as const;

export type EntityByKind = {
  team: Team;
  player: Player;
  squad: SquadMember;
  opponent: Opponent;
  competition: Competition;
  match: Match;
};

export const EntityChangeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('team'), data: TeamSchema }),
  z.object({ kind: z.literal('player'), data: PlayerSchema }),
  z.object({ kind: z.literal('squad'), data: SquadMemberSchema }),
  z.object({ kind: z.literal('opponent'), data: OpponentSchema }),
  z.object({ kind: z.literal('competition'), data: CompetitionSchema }),
  z.object({ kind: z.literal('match'), data: MatchSchema }),
]);
export type EntityChange = z.infer<typeof EntityChangeSchema>;

export const ALERT_PRESETS = [
  'TIMEOUT_NOW',
  'CHANGE_DEFENSE',
  'GK_STRUGGLING',
  'HOT_SHOOTER',
  'WATCH_FASTBREAK',
  'TOO_MANY_TURNOVERS',
  'USE_7TH_PLAYER',
  'PIVOT_FREE',
] as const;
export type AlertPreset = (typeof ALERT_PRESETS)[number];

/** Feature flags. Substitution tracking is OFF by default. */
export interface FeatureFlags {
  substitutions: boolean;
}
export const DEFAULT_FLAGS: FeatureFlags = { substitutions: false };
