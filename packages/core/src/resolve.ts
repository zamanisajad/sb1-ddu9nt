import type { MatchEvent } from './events';

/**
 * Turning the append-only log into the "effective" list of events.
 *
 * Rules (deliberately simple and order-independent):
 *  1. Events are de-duplicated by id.
 *  2. An event is dead if ANY event supersedes it. Edits are new events that
 *     supersede the previous version; deletes/undos are VOID events.
 *  3. VOID events are never effective themselves.
 *  4. Effective events are ordered by game clock, then by the creation time of
 *     the *root* of their edit chain (so an edit keeps the original's place among
 *     events in the same second), then by root id.
 *
 * Because every rule depends only on the set of events, any device that has the
 * same set computes exactly the same result, whatever order they arrived in.
 */
export interface Resolved {
  /** Effective events, in game order. */
  events: MatchEvent[];
  /** All unique events, by id. */
  byId: Map<string, MatchEvent>;
  /** Maps any version id (dead or alive) to the id of the current head of its chain, or null if deleted. */
  headOf: (id: string) => string | null;
  /** Root id of an event's edit chain. */
  rootOf: (id: string) => string;
}

export function dedupe<E extends { id: string }>(events: readonly E[]): E[] {
  const seen = new Map<string, E>();
  for (const e of events) if (!seen.has(e.id)) seen.set(e.id, e);
  return [...seen.values()];
}

export function resolveEvents(input: readonly MatchEvent[]): Resolved {
  const all = dedupe(input);
  const byId = new Map(all.map((e) => [e.id, e]));
  const supersededBy = new Map<string, MatchEvent[]>();
  for (const e of all) {
    if (e.supersedes) {
      const list = supersededBy.get(e.supersedes) ?? [];
      list.push(e);
      supersededBy.set(e.supersedes, list);
    }
  }

  const rootCache = new Map<string, string>();
  const rootOf = (id: string): string => {
    const cached = rootCache.get(id);
    if (cached) return cached;
    let cur = id;
    const seen = new Set<string>();
    for (;;) {
      const e = byId.get(cur);
      if (!e || !e.supersedes || seen.has(cur) || !byId.has(e.supersedes)) break;
      seen.add(cur);
      cur = e.supersedes;
    }
    rootCache.set(id, cur);
    return cur;
  };

  const headOf = (id: string): string | null => {
    let cur = id;
    const seen = new Set<string>();
    for (;;) {
      const next = supersededBy.get(cur);
      if (!next || next.length === 0) break;
      if (seen.has(cur)) return null;
      seen.add(cur);
      // Prefer the most recent superseding event when a chain forks.
      const latest = [...next].sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1))[0]!;
      if (latest.type === 'VOID') return null;
      cur = latest.id;
    }
    const e = byId.get(cur);
    return e && e.type !== 'VOID' ? cur : null;
  };

  const effective = all.filter((e) => e.type !== 'VOID' && !supersededBy.has(e.id));
  const key = (e: MatchEvent) => {
    const root = byId.get(rootOf(e.id)) ?? e;
    return { createdAt: root.createdAt, id: root.id };
  };
  effective.sort((a, b) => {
    if (a.gameClockSeconds !== b.gameClockSeconds) return a.gameClockSeconds - b.gameClockSeconds;
    const ka = key(a);
    const kb = key(b);
    if (ka.createdAt !== kb.createdAt) return ka.createdAt - kb.createdAt;
    return ka.id < kb.id ? -1 : ka.id > kb.id ? 1 : 0;
  });
  return { events: effective, byId, headOf, rootOf };
}
