import type { MatchEvent, Period } from './events';
import { PERIODS } from './events';

export const OT_PERIOD_SECONDS = 5 * 60;

/**
 * The game clock is cumulative across periods, as on a handball scoreboard:
 * period 1 runs 0..H, period 2 runs H..2H, OT1 2H..2H+5min, OT2 ..2H+10min.
 * Suspensions therefore carry naturally across the half-time break.
 */
export function periodBounds(period: Period, halfLengthMin: number): { start: number; end: number } {
  const h = halfLengthMin * 60;
  switch (period) {
    case '1':
      return { start: 0, end: h };
    case '2':
      return { start: h, end: 2 * h };
    case 'OT1':
      return { start: 2 * h, end: 2 * h + OT_PERIOD_SECONDS };
    case 'OT2':
      return { start: 2 * h + OT_PERIOD_SECONDS, end: 2 * h + 2 * OT_PERIOD_SECONDS };
  }
}

export function nextPeriod(p: Period): Period | null {
  const i = PERIODS.indexOf(p);
  return PERIODS[i + 1] ?? null;
}

export const periodIndex = (p: Period): number => PERIODS.indexOf(p);

export interface ClockState {
  period: Period;
  /** Clock value when last set. */
  baseSeconds: number;
  /** Device time (ms) when last set. */
  baseAt: number;
  running: boolean;
  /** True between PERIOD_START and PERIOD_END. */
  inPeriod: boolean;
  periodEnd: number;
  periodStart: number;
}

const CLOCK_TYPES = new Set(['CLOCK', 'PERIOD_START', 'PERIOD_END']);

/**
 * Derive the clock from clock-control events. They are applied in real-time
 * (createdAt) order, since they describe what the analyst did and when.
 */
export function deriveClock(events: readonly MatchEvent[], halfLengthMin: number): ClockState {
  const controls = events
    .filter((e) => CLOCK_TYPES.has(e.type))
    .sort((a, b) => a.createdAt - b.createdAt || a.seq - b.seq);
  const b1 = periodBounds('1', halfLengthMin);
  let state: ClockState = {
    period: '1',
    baseSeconds: 0,
    baseAt: 0,
    running: false,
    inPeriod: false,
    periodStart: b1.start,
    periodEnd: b1.end,
  };
  for (const e of controls) {
    const b = periodBounds(e.period, halfLengthMin);
    if (e.type === 'PERIOD_START') {
      state = {
        period: e.period,
        baseSeconds: e.gameClockSeconds,
        baseAt: e.createdAt,
        running: true,
        inPeriod: true,
        periodStart: b.start,
        periodEnd: b.end,
      };
    } else if (e.type === 'PERIOD_END') {
      state = { ...state, period: e.period, baseSeconds: e.gameClockSeconds, baseAt: e.createdAt, running: false, inPeriod: false, periodStart: b.start, periodEnd: b.end };
    } else if (e.type === 'CLOCK') {
      state = {
        ...state,
        period: e.period,
        baseSeconds: e.gameClockSeconds,
        baseAt: e.createdAt,
        running: e.payload.running,
        periodStart: b.start,
        periodEnd: b.end,
      };
    }
  }
  return state;
}

export function clockAt(state: ClockState, now: number): number {
  if (!state.running) return state.baseSeconds;
  const elapsed = Math.max(0, Math.floor((now - state.baseAt) / 1000));
  return Math.min(state.periodEnd, state.baseSeconds + elapsed);
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
