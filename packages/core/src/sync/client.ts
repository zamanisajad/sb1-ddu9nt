import type { MatchEvent, StoredEvent } from '../events';
import type { PullResponse, PushResponse, PushResult, ServerMessage, WriterInfo } from '../protocol';
import { ulid } from '../ids';

/**
 * Local persistence the sync engine needs. The web app implements it on
 * IndexedDB (Dexie); tests use MemorySyncStore.
 */
export interface SyncStore {
  /** Events created on this device that the server has not acknowledged (and has not rejected). */
  outbox(): Promise<MatchEvent[]>;
  /** Server accepted (or already had) these events. */
  ack(results: { id: string; serverSeq?: number }[]): Promise<void>;
  /** Server permanently rejected the event; it is kept locally but no longer retried. */
  reject(id: string, code: string, error: string): Promise<void>;
  /** Events received from the server (may include duplicates and our own events). */
  saveRemote(matchId: string, events: StoredEvent[]): Promise<void>;
  getCursor(matchId: string): Promise<number>;
  setCursor(matchId: string, cursor: number): Promise<void>;
}

export type SyncStatus = 'stopped' | 'connecting' | 'online' | 'polling' | 'offline';

export interface SyncClientOptions {
  /** e.g. wss://example.ir/ws */
  wsUrl: string;
  /** e.g. https://example.ir/api */
  httpBase: string;
  deviceId: string;
  getToken: () => string | null;
  WebSocketImpl?: typeof WebSocket;
  fetchImpl?: typeof fetch;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  pollIntervalMs?: number;
  ackTimeoutMs?: number;
  /** After this many consecutive socket failures, fall back to HTTP polling. */
  wsFailuresBeforePolling?: number;
  pingIntervalMs?: number;
  batchSize?: number;
  now?: () => number;
}

type Listener<T> = (v: T) => void;

export class SyncClient {
  private readonly o: Required<Omit<SyncClientOptions, 'WebSocketImpl' | 'fetchImpl'>> & {
    WebSocketImpl: typeof WebSocket;
    fetchImpl: typeof fetch;
  };
  private ws: WebSocket | null = null;
  private status: SyncStatus = 'stopped';
  private subs = new Set<string>();
  private inflight = new Map<string, { ids: string[]; timer: ReturnType<typeof setTimeout> }>();
  private inflightIds = new Set<string>();
  private blocked = new Set<string>();
  private fresh = new Map<string, number>();
  private failures = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastPong = 0;
  private flushing = false;
  private flushAgain = false;
  private serverOffset = 0;

  private statusL = new Set<Listener<SyncStatus>>();
  private eventsL = new Set<Listener<{ matchId: string; events: StoredEvent[]; live: boolean }>>();
  private writerL = new Set<Listener<WriterInfo & { conflict: boolean }>>();
  private rejectL = new Set<Listener<PushResult>>();
  private freshL = new Set<Listener<string>>();
  private authL = new Set<Listener<string>>();

  constructor(
    private readonly store: SyncStore,
    opts: SyncClientOptions,
  ) {
    this.o = {
      initialBackoffMs: 500,
      maxBackoffMs: 30_000,
      pollIntervalMs: 3_000,
      ackTimeoutMs: 15_000,
      wsFailuresBeforePolling: 3,
      pingIntervalMs: 10_000,
      batchSize: 100,
      now: () => Date.now(),
      ...opts,
      WebSocketImpl: opts.WebSocketImpl ?? globalThis.WebSocket,
      fetchImpl: opts.fetchImpl ?? globalThis.fetch.bind(globalThis),
    };
  }

  // ---- public API -------------------------------------------------------

  start(): void {
    if (this.status !== 'stopped') return;
    this.setStatus('connecting');
    this.connect();
  }

  stop(): void {
    this.setStatus('stopped');
    this.clearTimers();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onopen = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
    this.dropInflight();
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  /** Last time (local ms) the server confirmed this match is up to date. */
  freshAt(matchId: string): number | null {
    return this.fresh.get(matchId) ?? null;
  }

  /** Server time minus local time, estimated from the last server message. */
  get clockOffset(): number {
    return this.serverOffset;
  }

  isBlocked(matchId: string): boolean {
    return this.blocked.has(matchId);
  }

  subscribe(matchId: string): void {
    if (this.subs.has(matchId)) return;
    this.subs.add(matchId);
    if (this.status === 'online') void this.sendSub(matchId);
    else if (this.status === 'polling') void this.pollOnce();
  }

  unsubscribe(matchId: string): void {
    if (!this.subs.delete(matchId)) return;
    this.fresh.delete(matchId);
    this.send({ t: 'unsub', matchId });
  }

  /** Call after writing events locally. */
  kick(): void {
    void this.flush();
  }

  /** Explicitly take over the live-writer lock for a match (logged on the server). */
  async takeover(matchId: string): Promise<void> {
    if (this.status === 'online' && this.ws) {
      this.send({ t: 'takeover', matchId });
      return;
    }
    const res = await this.http(`/matches/${encodeURIComponent(matchId)}/writer`, {
      method: 'POST',
      body: JSON.stringify({ deviceId: this.o.deviceId }),
    });
    if (res.ok) {
      this.blocked.delete(matchId);
      void this.flush();
    }
  }

  onStatus(l: Listener<SyncStatus>) {
    this.statusL.add(l);
    return () => this.statusL.delete(l);
  }
  onEvents(l: Listener<{ matchId: string; events: StoredEvent[]; live: boolean }>) {
    this.eventsL.add(l);
    return () => this.eventsL.delete(l);
  }
  onWriter(l: Listener<WriterInfo & { conflict: boolean }>) {
    this.writerL.add(l);
    return () => this.writerL.delete(l);
  }
  onReject(l: Listener<PushResult>) {
    this.rejectL.add(l);
    return () => this.rejectL.delete(l);
  }
  onFresh(l: Listener<string>) {
    this.freshL.add(l);
    return () => this.freshL.delete(l);
  }
  onAuthError(l: Listener<string>) {
    this.authL.add(l);
    return () => this.authL.delete(l);
  }

  // ---- socket -------------------------------------------------------------

  private connect(): void {
    if (this.status === 'stopped') return;
    const token = this.o.getToken();
    if (!token) {
      this.setStatus('offline');
      this.scheduleReconnect();
      return;
    }
    let ws: WebSocket;
    try {
      ws = new this.o.WebSocketImpl(this.o.wsUrl);
    } catch {
      this.onSocketDown();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.send({ t: 'hello', token, deviceId: this.o.deviceId });
    };
    ws.onmessage = (ev: MessageEvent) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)) as ServerMessage;
      } catch {
        return;
      }
      void this.handle(msg);
    };
    ws.onerror = () => {
      /* onclose follows */
    };
    ws.onclose = () => {
      if (this.ws === ws) {
        this.ws = null;
        this.onSocketDown();
      }
    };
  }

  private onSocketDown(): void {
    if (this.status === 'stopped') return;
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.dropInflight();
    this.failures += 1;
    if (this.failures >= this.o.wsFailuresBeforePolling) {
      if (this.status !== 'polling') {
        this.setStatus('polling');
        void this.pollLoop();
      }
    } else {
      this.setStatus('offline');
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.status === 'stopped') return;
    const base = Math.min(this.o.maxBackoffMs, this.o.initialBackoffMs * 2 ** Math.max(0, this.failures - 1));
    const delay = base / 2 + Math.random() * (base / 2);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.status === 'stopped' || this.ws) return;
      this.connect();
    }, delay);
  }

  private send(msg: unknown): boolean {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1) return false;
    try {
      ws.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  private async sendSub(matchId: string): Promise<void> {
    const cursor = await this.store.getCursor(matchId);
    this.send({ t: 'sub', matchId, cursor });
  }

  private async handle(msg: ServerMessage): Promise<void> {
    switch (msg.t) {
      case 'hello_ok': {
        this.failures = 0;
        this.serverOffset = msg.serverNow - this.o.now();
        if (this.pollTimer) clearTimeout(this.pollTimer);
        this.pollTimer = null;
        this.setStatus('online');
        this.lastPong = this.o.now();
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
          if (this.o.now() - this.lastPong > this.o.pingIntervalMs * 2.5) {
            this.ws?.close();
            return;
          }
          this.send({ t: 'ping' });
        }, this.o.pingIntervalMs);
        for (const m of this.subs) await this.sendSub(m);
        void this.flush();
        break;
      }
      case 'events': {
        await this.store.saveRemote(msg.matchId, msg.events);
        const prev = await this.store.getCursor(msg.matchId);
        if (msg.cursor > prev) await this.store.setCursor(msg.matchId, msg.cursor);
        for (const l of this.eventsL) l({ matchId: msg.matchId, events: msg.events, live: !msg.backlog });
        if (!msg.backlog) this.markFresh(msg.matchId);
        break;
      }
      case 'synced':
        this.serverOffset = msg.serverNow - this.o.now();
        this.markFresh(msg.matchId);
        break;
      case 'ack':
        await this.handleAck(msg.reqId, msg.matchId, msg.results);
        break;
      case 'writer': {
        const mine = msg.writer.deviceId === this.o.deviceId;
        if (mine && this.blocked.delete(msg.writer.matchId)) void this.flush();
        for (const l of this.writerL) l({ ...msg.writer, conflict: false });
        break;
      }
      case 'hb':
      case 'pong':
        this.lastPong = this.o.now();
        this.serverOffset = msg.serverNow - this.o.now();
        for (const m of this.subs) this.markFresh(m);
        break;
      case 'error':
        if (msg.code === 'UNAUTHORIZED') for (const l of this.authL) l(msg.message);
        break;
    }
  }

  private markFresh(matchId: string) {
    this.fresh.set(matchId, this.o.now());
    for (const l of this.freshL) l(matchId);
  }

  // ---- outbox -------------------------------------------------------------

  private async flush(): Promise<void> {
    if (this.flushing) {
      this.flushAgain = true;
      return;
    }
    this.flushing = true;
    try {
      do {
        this.flushAgain = false;
        if (this.status === 'online') await this.flushSocket();
        else if (this.status === 'polling') await this.flushHttp();
      } while (this.flushAgain);
    } finally {
      this.flushing = false;
    }
  }

  private async pendingByMatch(): Promise<Map<string, MatchEvent[]>> {
    const pending = (await this.store.outbox()).filter(
      (e) => !this.inflightIds.has(e.id) && !this.blocked.has(e.matchId),
    );
    const groups = new Map<string, MatchEvent[]>();
    for (const e of pending) {
      const g = groups.get(e.matchId) ?? [];
      g.push(e);
      groups.set(e.matchId, g);
    }
    return groups;
  }

  private async flushSocket(): Promise<void> {
    const groups = await this.pendingByMatch();
    for (const [matchId, events] of groups) {
      for (let i = 0; i < events.length; i += this.o.batchSize) {
        const batch = events.slice(i, i + this.o.batchSize);
        const reqId = ulid();
        const ids = batch.map((e) => e.id);
        if (!this.send({ t: 'push', reqId, matchId, events: batch })) return;
        ids.forEach((id) => this.inflightIds.add(id));
        const timer = setTimeout(() => {
          // No ack: assume the socket is dead. Events stay in the outbox and are resent.
          this.releaseInflight(reqId);
          this.ws?.close();
        }, this.o.ackTimeoutMs);
        this.inflight.set(reqId, { ids, timer });
      }
    }
  }

  private releaseInflight(reqId: string) {
    const f = this.inflight.get(reqId);
    if (!f) return;
    clearTimeout(f.timer);
    f.ids.forEach((id) => this.inflightIds.delete(id));
    this.inflight.delete(reqId);
  }

  private dropInflight() {
    for (const reqId of [...this.inflight.keys()]) this.releaseInflight(reqId);
  }

  private async handleAck(reqId: string, matchId: string, results: PushResult[]): Promise<void> {
    this.releaseInflight(reqId);
    await this.applyResults(matchId, results);
    if (results.some((r) => r.status !== 'rejected')) void this.flush();
  }

  private async applyResults(matchId: string, results: PushResult[]): Promise<void> {
    const accepted = results.filter((r) => r.status === 'ok' || r.status === 'dup');
    if (accepted.length) await this.store.ack(accepted.map((r) => ({ id: r.id, serverSeq: r.serverSeq })));
    for (const r of results) {
      if (r.status !== 'rejected') continue;
      if (r.code === 'NOT_WRITER') {
        // Keep the event in the outbox; nothing is lost. Wait for an explicit takeover.
        if (!this.blocked.has(matchId)) {
          this.blocked.add(matchId);
          for (const l of this.writerL)
            l({ matchId, deviceId: null, userId: null, since: null, conflict: true });
        }
      } else {
        await this.store.reject(r.id, r.code ?? 'INVALID', r.error ?? '');
        for (const l of this.rejectL) l(r);
      }
    }
  }

  // ---- HTTP polling fallback ---------------------------------------------

  private async http(path: string, init: RequestInit = {}): Promise<Response> {
    const token = this.o.getToken();
    return this.o.fetchImpl(this.o.httpBase + path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        'x-device-id': this.o.deviceId,
        ...(init.headers ?? {}),
      },
    });
  }

  private async flushHttp(): Promise<void> {
    const groups = await this.pendingByMatch();
    for (const [matchId, events] of groups) {
      for (let i = 0; i < events.length; i += this.o.batchSize) {
        const batch = events.slice(i, i + this.o.batchSize);
        const res = await this.http(`/matches/${encodeURIComponent(matchId)}/events`, {
          method: 'POST',
          body: JSON.stringify({ events: batch }),
        });
        if (!res.ok) throw new Error(`push failed: ${res.status}`);
        const body = (await res.json()) as PushResponse;
        await this.applyResults(matchId, body.results);
      }
    }
  }

  private async pullHttp(matchId: string): Promise<void> {
    for (;;) {
      const cursor = await this.store.getCursor(matchId);
      const res = await this.http(`/matches/${encodeURIComponent(matchId)}/events?since=${cursor}`);
      if (!res.ok) throw new Error(`pull failed: ${res.status}`);
      const body = (await res.json()) as PullResponse;
      this.serverOffset = body.serverNow - this.o.now();
      if (body.events.length) {
        await this.store.saveRemote(matchId, body.events);
        for (const l of this.eventsL) l({ matchId, events: body.events, live: true });
      }
      if (body.cursor > cursor) await this.store.setCursor(matchId, body.cursor);
      if (!body.more) break;
    }
    this.markFresh(matchId);
  }

  private async pollOnce(): Promise<void> {
    try {
      await this.flush();
      for (const m of this.subs) await this.pullHttp(m);
    } catch {
      /* stay in polling; try again next tick */
    }
  }

  private async pollLoop(): Promise<void> {
    if (this.status !== 'polling') return;
    await this.pollOnce();
    if (this.status !== 'polling') return;
    this.pollTimer = setTimeout(() => void this.pollLoop(), this.o.pollIntervalMs);
  }

  // ---- misc -------------------------------------------------------------

  private setStatus(s: SyncStatus) {
    if (this.status === s) return;
    this.status = s;
    for (const l of this.statusL) l(s);
  }

  private clearTimers() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.reconnectTimer = this.pollTimer = this.pingTimer = null;
  }
}

/** In-memory SyncStore for tests and for server-side tooling. */
export class MemorySyncStore implements SyncStore {
  readonly local = new Map<string, MatchEvent>();
  readonly pending = new Set<string>();
  readonly rejected = new Map<string, { code: string; error: string }>();
  readonly remote = new Map<string, Map<string, StoredEvent>>();
  readonly cursors = new Map<string, number>();

  /** Record an event created on this device. */
  add(e: MatchEvent): void {
    this.local.set(e.id, e);
    this.pending.add(e.id);
  }
  async outbox(): Promise<MatchEvent[]> {
    return [...this.pending]
      .map((id) => this.local.get(id)!)
      .sort((a, b) => a.seq - b.seq);
  }
  async ack(results: { id: string }[]): Promise<void> {
    for (const r of results) this.pending.delete(r.id);
  }
  async reject(id: string, code: string, error: string): Promise<void> {
    this.pending.delete(id);
    this.rejected.set(id, { code, error });
  }
  async saveRemote(matchId: string, events: StoredEvent[]): Promise<void> {
    const m = this.remote.get(matchId) ?? new Map<string, StoredEvent>();
    for (const e of events) m.set(e.id, e);
    this.remote.set(matchId, m);
  }
  async getCursor(matchId: string): Promise<number> {
    return this.cursors.get(matchId) ?? 0;
  }
  async setCursor(matchId: string, cursor: number): Promise<void> {
    this.cursors.set(matchId, cursor);
  }
  /** Everything this device knows about a match: own events plus received ones. */
  all(matchId: string): MatchEvent[] {
    const map = new Map<string, MatchEvent>();
    for (const e of this.local.values()) if (e.matchId === matchId) map.set(e.id, e);
    for (const e of this.remote.get(matchId)?.values() ?? []) map.set(e.id, e);
    return [...map.values()];
  }
}
