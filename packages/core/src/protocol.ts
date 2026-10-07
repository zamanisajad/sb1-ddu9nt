import { z } from 'zod';
import type { StoredEvent } from './events';

/** Client -> server WebSocket messages. Events are validated separately with EventSchema. */
export const ClientMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hello'), token: z.string().min(1).max(200), deviceId: z.string().min(1).max(64) }),
  z.object({ t: z.literal('sub'), matchId: z.string().min(1).max(64), cursor: z.number().int().nonnegative() }),
  z.object({ t: z.literal('unsub'), matchId: z.string().min(1).max(64) }),
  z.object({
    t: z.literal('push'),
    reqId: z.string().min(1).max(64),
    matchId: z.string().min(1).max(64),
    events: z.array(z.unknown()).max(500),
  }),
  z.object({ t: z.literal('takeover'), matchId: z.string().min(1).max(64) }),
  z.object({ t: z.literal('ping') }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export type PushStatus = 'ok' | 'dup' | 'rejected';
export type RejectCode = 'INVALID' | 'FORBIDDEN' | 'NOT_WRITER' | 'WRONG_MATCH';
export interface PushResult {
  id: string;
  status: PushStatus;
  serverSeq?: number;
  code?: RejectCode;
  error?: string;
}

export interface WriterInfo {
  matchId: string;
  deviceId: string | null;
  userId: string | null;
  since: number | null;
}

export type ServerMessage =
  | { t: 'hello_ok'; userId: string; serverNow: number }
  | { t: 'events'; matchId: string; events: StoredEvent[]; cursor: number; backlog: boolean }
  | { t: 'synced'; matchId: string; cursor: number; serverNow: number }
  | { t: 'ack'; reqId: string; matchId: string; results: PushResult[] }
  | { t: 'writer'; writer: WriterInfo }
  | { t: 'hb'; serverNow: number }
  | { t: 'pong'; serverNow: number }
  | { t: 'error'; code: string; message: string; matchId?: string };

/** HTTP fallback shapes (same semantics as the socket). */
export interface PullResponse {
  events: StoredEvent[];
  cursor: number;
  more: boolean;
  serverNow: number;
}
export interface PushResponse {
  results: PushResult[];
}

export const BACKLOG_PAGE = 500;
