import type { MatchEvent } from './events';
import { resolveEvents } from './resolve';
import { collectGoalkeeperSpells, collectSuspensions, situationAt } from './metrics/situation';
import { formatClock } from './clock';

export interface CsvPlayerInfo {
  shirtNumber: number | null;
  name: string | null;
}

const CSV_HEADER = [
  'event_id',
  'match_id',
  'period',
  'clock',
  'game_clock_seconds',
  'position_ms',
  'duration_ms',
  'team',
  'player_id',
  'shirt_number',
  'player_name',
  'type',
  'outcome',
  'shot_zone',
  'goal_zone',
  'phase',
  'goalkeeper_id',
  'detail',
  'numerical_situation',
  'score_us',
  'score_them',
  'created_at',
];

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Effective events as CSV (one row per event, UTF-8 with BOM so Excel shows Persian names).
 * `position_ms`/`duration_ms` let Dartfish-style tools import rows as tags on the game clock.
 */
export function eventsToCsv(
  raw: readonly MatchEvent[],
  playerInfo: (id: string) => CsvPlayerInfo | undefined = () => undefined,
): string {
  const { events } = resolveEvents(raw);
  const susp = collectSuspensions(events);
  const spells = collectGoalkeeperSpells(events);
  let us = 0;
  let them = 0;
  const rows = [CSV_HEADER.join(',')];
  for (const e of events) {
    if (e.type === 'CLOCK') continue;
    if (e.type === 'SHOT' && e.payload.outcome === 'GOAL') {
      if (e.team === 'us') us += 1;
      else if (e.team === 'them') them += 1;
    }
    const s = situationAt(susp, spells, e.gameClockSeconds);
    const info = e.playerId ? playerInfo(e.playerId) : undefined;
    const p = e.payload as Record<string, unknown>;
    const detail =
      e.type === 'TURNOVER'
        ? p.kind
        : e.type === 'DEFENSE_SYSTEM_CHANGE'
          ? p.system
          : e.type === 'ALERT'
            ? [p.preset, p.text].filter(Boolean).join(': ')
            : e.type === 'MARKER'
              ? p.note
              : e.type === 'ASSIST'
                ? p.goalEventId
                : '';
    rows.push(
      [
        e.id,
        e.matchId,
        e.period,
        formatClock(e.gameClockSeconds),
        e.gameClockSeconds,
        e.gameClockSeconds * 1000,
        e.type === 'SUSPENSION_2MIN' ? 120000 : 5000,
        e.team ?? '',
        e.playerId ?? '',
        info?.shirtNumber ?? '',
        info?.name ?? '',
        e.type,
        p.outcome ?? '',
        p.shotZone ?? '',
        p.goalZone ?? '',
        p.phase ?? '',
        p.goalkeeperId ?? '',
        detail ?? '',
        `${s.us}v${s.them}`,
        us,
        them,
        new Date(e.createdAt).toISOString(),
      ]
        .map(cell)
        .join(','),
    );
  }
  return '﻿' + rows.join('\r\n') + '\r\n';
}

