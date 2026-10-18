// Live game world: who is online, where they are, and every rule that
// changes score or health. The server is the source of truth — clients only
// send intentions ("I moved here", "I punched", "I jumped obstacle X").
import {
  BLOCK, BRANDS, COMBAT, PLAYER, SCORE, BANK, BANK_NAME,
  blockOf, lotDoor, lotType, nearestBankDoor, parseObstacleKey, outfitById, hash,
} from '../shared/world.js';

export const TICK_MS = 100;           // snapshot broadcast rate (10 Hz)
const DISCONNECT_GRACE_MS = 5000;     // body stays in the world briefly after a drop (no instant combat-logging)
const MAX_SPEED_SLACK = 1.6;          // tolerated speed over PLAYER.speed (lag, knockback)
const MAX_EVENTS_PER_SEC = 60;        // per-socket flood guard
const MISSION_SKIP_COOLDOWN_MS = 30000;
const MAX_AIR_MS = 1500;               // longest believable jump

const ANIMS = new Set(['idle', 'run', 'jump', 'punch', 'kick', 'stun']);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const round2 = (v) => Math.round(v * 100) / 100;

export class Game {
  constructor(io, repo, { now = () => Date.now() } = {}) {
    this.io = io;
    this.repo = repo;
    this.now = now;
    this.players = new Map(); // userId -> player
    this.timers = new Set();
    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
    io.on('connection', (socket) => this.onConnect(socket));
  }

  stop() {
    this.stopped = true;
    clearInterval(this.tickTimer);
    for (const t of this.timers) clearTimeout(t);
    for (const p of this.players.values()) this.persist(p);
  }

  later(fn, ms) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
    return t;
  }

  // ------------------------------------------------------------ connect
  onConnect(socket) {
    if (this.stopped) return socket.disconnect(true);
    const uid = socket.data.uid;
    const user = this.repo.user(uid);
    if (!user) return socket.disconnect(true);
    const now = this.now();

    let p = this.players.get(uid);
    if (p) {
      // Same account again: a reconnect within the grace period, or a second tab.
      if (p.socket && p.socket !== socket) {
        p.socket.emit('kicked', { reason: 'این حساب از جای دیگری وارد بازی شد' });
        p.socket.disconnect(true);
      }
      if (p.leaveTimer) {
        clearTimeout(p.leaveTimer);
        this.timers.delete(p.leaveTimer);
        p.leaveTimer = null;
      }
      p.socket = socket;
    } else {
      p = this.createPlayer(user, socket, now);
      this.players.set(uid, p);
      socket.broadcast.emit('player:join', this.publicInfo(p));
    }

    socket.emit('welcome', {
      serverTime: now,
      you: { ...this.publicInfo(p), score: p.score, bank: p.bank, seq: p.seq, owned: user.owned_outfits },
      players: [...this.players.values()].filter((o) => o !== p).map((o) => this.publicInfo(o)),
      mission: p.mission,
    });

    socket.data.budget = { n: 0, reset: now + 1000 };
    const on = (ev, fn) =>
      socket.on(ev, (...args) => {
        if (!this.spend(socket)) return;
        if (p.socket !== socket) return; // stale tab
        try {
          fn(...args);
        } catch (e) {
          console.error(`[game] ${ev} handler failed`, e);
        }
      });
    on('state', (m) => this.onState(p, m));
    on('attack', (m) => this.onAttack(p, m));
    on('obstacle', (m) => this.onObstacle(p, m));
    on('mission:skip', () => this.skipMission(p));
    on('ping:time', (cb) => typeof cb === 'function' && cb(this.now()));
    socket.on('disconnect', () => this.onDisconnect(p, socket));
  }

  spend(socket) {
    const b = socket.data.budget;
    const now = this.now();
    if (now >= b.reset) {
      b.n = 0;
      b.reset = now + 1000;
    }
    if (++b.n > MAX_EVENTS_PER_SEC) {
      socket.emit('kicked', { reason: 'ارسال پیام بیش از حد مجاز' });
      socket.disconnect(true);
      return false;
    }
    return true;
  }

  createPlayer(user, socket, now) {
    let x = user.last_x, z = user.last_y;
    let hp = user.health;
    if (!finite(x) || !finite(z) || !user.is_alive || hp <= 0) {
      // New player, or logged out while dead: start at a bank.
      const spawn = this.spawnPoint(finite(x) ? x : 0, finite(z) ? z : 0, user.id);
      x = spawn.x;
      z = spawn.z;
      hp = PLAYER.maxHealth;
    }
    const p = {
      id: user.id,
      username: user.username,
      outfit: user.equipped_outfit,
      socket,
      x, z, y: 0, a: 0, anim: 'idle',
      hp, alive: true,
      immuneUntil: now + COMBAT.spawnImmunityMs,
      lastHitAt: 0,
      cooldown: { punch: 0, kick: 0 },
      score: user.current_score,
      bank: user.bank_fitcoin,
      seq: 1, // bumps on every server-forced position (respawn / correction)
      lastStateAt: now,
      airSince: 0,
      distAcc: 0,
      obstacleClaims: new Map(),
      mission: null,
      missionSkipAt: 0,
      leaveTimer: null,
    };
    this.repo.setLife(p.id, hp, true, null);
    p.mission = this.newMission(p);
    return p;
  }

  spawnPoint(x, z, salt) {
    const door = nearestBankDoor(x, z);
    // spread people along the sidewalk so they don't stack
    const off = (hash(salt, Math.floor(this.now() / 1000)) - 0.5) * 8;
    return { x: door.x + off, z: door.z };
  }

  publicInfo(p) {
    return {
      id: p.id, username: p.username, outfit: p.outfit,
      x: round2(p.x), y: round2(p.y), z: round2(p.z), a: round2(p.a),
      anim: p.anim, hp: p.hp, alive: p.alive, immune: this.isImmune(p),
    };
  }

  isImmune(p) {
    return this.now() < p.immuneUntil;
  }

  onDisconnect(p, socket) {
    if (this.stopped || p.socket !== socket) return;
    p.socket = null;
    this.persist(p);
    p.leaveTimer = this.later(() => {
      if (p.socket) return;
      this.persist(p);
      this.players.delete(p.id);
      this.io.emit('player:leave', { id: p.id });
    }, DISCONNECT_GRACE_MS);
  }

  persist(p) {
    this.repo.savePos(p.id, p.x, p.z, Math.round(p.hp), p.alive);
    this.repo.setScore(p.id, p.score);
  }

  emitTo(p, ev, data) {
    if (p.socket) p.socket.emit(ev, data);
  }

  // ------------------------------------------------------------ movement
  onState(p, m) {
    if (!m || typeof m !== 'object' || !p.alive) return;
    if (m.seq !== p.seq) return; // update from before a teleport
    const { x, z } = m;
    if (!finite(x) || !finite(z) || !finite(m.y) || !finite(m.a)) return;
    const now = this.now();
    const dt = Math.min(Math.max((now - p.lastStateAt) / 1000, 0.05), 2);
    p.lastStateAt = now;

    const dist = Math.hypot(x - p.x, z - p.z);
    const allowed = PLAYER.speed * MAX_SPEED_SLACK * dt + 1.5;
    if (dist > allowed) {
      // Too fast: snap the client back to where the server thinks it is.
      p.seq++;
      this.emitTo(p, 'teleport', { x: p.x, z: p.z, seq: p.seq });
      return;
    }
    p.x = x;
    p.z = z;
    // A jump lasts under a second; a client claiming to hover (to dodge hits)
    // is treated as standing on the ground.
    const y = Math.min(Math.max(m.y, 0), 4);
    if (y > 0.3) p.airSince ||= now;
    else p.airSince = 0;
    p.y = p.airSince && now - p.airSince > MAX_AIR_MS ? 0 : y;
    p.a = m.a;
    p.anim = ANIMS.has(m.anim) ? m.anim : 'idle';

    // Running score: +1 per SCORE.perDistance units actually travelled.
    p.distAcc += dist;
    if (p.distAcc >= SCORE.perDistance) {
      const pts = Math.floor(p.distAcc / SCORE.perDistance);
      p.distAcc -= pts * SCORE.perDistance;
      this.missionProgress(p, 'run', pts * SCORE.perDistance);
      this.addScore(p, pts, 'run');
    }
    this.missionProgress(p, 'reach');
  }

  onObstacle(p, m) {
    if (!p.alive || !m) return;
    const o = parseObstacleKey(m.key);
    if (!o) return;
    if (Math.hypot(o.x - p.x, o.z - p.z) > 6) return;
    const now = this.now();
    const last = p.obstacleClaims.get(o.key) || 0;
    if (now - last < SCORE.obstacleCooldownMs) return;
    p.obstacleClaims.set(o.key, now);
    if (p.obstacleClaims.size > 200) {
      for (const [k, t] of p.obstacleClaims) if (now - t > SCORE.obstacleCooldownMs) p.obstacleClaims.delete(k);
    }
    this.addScore(p, SCORE.obstacleJump, 'jump');
    this.missionProgress(p, 'jump', 1);
  }

  addScore(p, delta, reason) {
    p.score += delta;
    this.repo.setScore(p.id, p.score);
    this.emitTo(p, 'score', { score: p.score, delta, reason });
  }

  // ------------------------------------------------------------ combat
  inBankSafeZone(p) {
    return nearestBankDoor(p.x, p.z).dist < COMBAT.bankSafeRadius;
  }

  onAttack(p, m) {
    const type = m && m.type;
    const spec = COMBAT[type];
    if (!p.alive || (type !== 'punch' && type !== 'kick')) return;
    const now = this.now();
    if (now < p.cooldown[type]) return;
    p.cooldown[type] = now + spec.cooldownMs;
    p.anim = type;
    p.socket?.broadcast.emit('anim', { id: p.id, type });

    if (this.inBankSafeZone(p)) return;
    // Pick the closest valid victim in front of the attacker.
    let target = null, best = Infinity;
    for (const o of this.players.values()) {
      if (o === p || !o.alive || this.isImmune(o)) continue;
      if (Math.abs(o.y - p.y) > 1.5) continue;
      const dx = o.x - p.x, dz = o.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > spec.range || d >= best) continue;
      // facing: a = 0 looks toward +z, angles measured with atan2(dx, dz)
      let diff = Math.atan2(dx, dz) - p.a;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (d > 0.8 && Math.abs(diff) > COMBAT.maxAngle) continue;
      if (this.inBankSafeZone(o)) continue;
      target = o;
      best = d;
    }
    if (!target) return;

    p.immuneUntil = 0; // fighting ends your own protection
    target.hp = Math.max(0, target.hp - spec.damage);
    target.lastHitAt = now;
    this.io.emit('hit', { attacker: p.id, victim: target.id, type, damage: spec.damage, hp: target.hp });
    if (target.hp <= 0) this.kill(p, target);
  }

  kill(killer, victim) {
    const now = this.now();
    const loot = victim.score;
    victim.alive = false;
    victim.anim = 'idle';
    victim.score = 0;
    victim.distAcc = 0;
    killer.score += loot;
    // Banked fitcoin is never touched: only un-banked score changes hands.
    this.repo.tx(() => {
      this.repo.setScore(victim.id, 0);
      this.repo.setScore(killer.id, killer.score);
      this.repo.setLife(victim.id, 0, false, now + COMBAT.respawnDelayMs);
      this.repo.recordKill(killer.id, victim.id, loot);
    });
    this.io.emit('death', {
      killer: killer.id, victim: victim.id,
      killerName: killer.username, victimName: victim.username, amount: loot,
    });
    this.emitTo(killer, 'score', { score: killer.score, delta: loot, reason: 'kill' });
    this.emitTo(victim, 'score', { score: 0, delta: -loot, reason: 'death' });
    this.missionProgress(killer, 'defeat', 1);
    this.later(() => this.respawn(victim), COMBAT.respawnDelayMs);
  }

  respawn(p) {
    if (this.players.get(p.id) !== p) return; // left the game; respawns on next login
    const s = this.spawnPoint(p.x, p.z, p.id);
    p.x = s.x;
    p.z = s.z;
    p.y = 0;
    p.hp = PLAYER.maxHealth;
    p.alive = true;
    p.immuneUntil = this.now() + COMBAT.respawnImmunityMs;
    p.seq++;
    p.lastStateAt = this.now();
    this.repo.setLife(p.id, p.hp, true, null);
    this.io.emit('respawn', { id: p.id, x: p.x, z: p.z, hp: p.hp });
    this.emitTo(p, 'teleport', { x: p.x, z: p.z, seq: p.seq });
  }

  // ------------------------------------------------------------ bank
  // Called from the REST API. Requires the player to be online and standing
  // at a Glowbank door (position as the server knows it).
  deposit(uid) {
    const p = this.players.get(uid);
    if (!p || !p.socket) return { error: 'برای واریز باید داخل بازی باشید', status: 409 };
    if (!p.alive) return { error: 'در حال حاضر شکست خورده‌اید', status: 409 };
    if (nearestBankDoor(p.x, p.z).dist > BANK.depositRadius) {
      return { error: `برای واریز باید جلوی یکی از شعبه‌های ${BANK_NAME} باشید`, status: 403 };
    }
    const amount = p.score;
    if (amount <= 0) return { error: 'امتیازی برای واریز ندارید', status: 400 };
    p.score = 0;
    p.bank += amount;
    this.repo.tx(() => {
      this.repo.setScore(p.id, 0);
      this.repo.setBank(p.id, p.bank);
    });
    this.emitTo(p, 'score', { score: 0, delta: -amount, reason: 'deposit' });
    this.emitTo(p, 'wallet', { bank: p.bank });
    return { amount, bank: p.bank, score: 0 };
  }

  // Bank balance changed by a REST purchase: keep the live copy in sync.
  bankChanged(uid, bank) {
    const p = this.players.get(uid);
    if (!p) return;
    p.bank = bank;
    this.emitTo(p, 'wallet', { bank });
  }

  outfitChanged(uid, outfit) {
    const p = this.players.get(uid);
    if (!p) return;
    p.outfit = outfit;
    this.io.emit('player:outfit', { id: uid, outfit });
  }

  // ------------------------------------------------------------ missions
  newMission(p) {
    const r = hash(p.id, Math.floor(this.now() / 7), 42);
    if (r < 0.3) return { type: 'run', goal: 300, progress: 0, reward: 20 };
    if (r < 0.55) return { type: 'jump', goal: 3, progress: 0, reward: 25 };
    if (r < 0.75) return { type: 'defeat', goal: 1, progress: 0, reward: 60 };
    // reach a nearby brand shop
    const { i, j } = blockOf(p.x, p.z);
    const options = [];
    for (let bi = i - 3; bi <= i + 3; bi++)
      for (let bj = j - 3; bj <= j + 3; bj++)
        for (let k = 0; k < 4; k++) {
          const t = lotType(bi, bj, k);
          if (t.type !== 'brand') continue;
          const d = lotDoor(bi, bj, k);
          if (Math.hypot(d.x - p.x, d.z - p.z) > BLOCK * 0.6) options.push({ ...d, label: BRANDS[t.brand].name });
        }
    if (!options.length) return { type: 'run', goal: 300, progress: 0, reward: 20 };
    const t = options[Math.floor(hash(p.id, this.now() % 9973) * options.length)];
    return { type: 'reach', goal: 1, progress: 0, reward: 30, x: round2(t.x), z: round2(t.z), label: t.label };
  }

  missionProgress(p, type, amount = 0) {
    const m = p.mission;
    if (!m || m.type !== type) return;
    if (type === 'reach') {
      if (Math.hypot(m.x - p.x, m.z - p.z) > 5) return;
      m.progress = 1;
    } else {
      m.progress = Math.min(m.goal, m.progress + amount);
    }
    if (m.progress >= m.goal) {
      this.emitTo(p, 'mission:done', { reward: m.reward });
      p.mission = this.newMission(p);
      this.addScore(p, m.reward, 'mission');
      this.emitTo(p, 'mission', p.mission);
    } else if (type !== 'reach') {
      this.emitTo(p, 'mission', m);
    }
  }

  skipMission(p) {
    const now = this.now();
    if (now < p.missionSkipAt) return;
    p.missionSkipAt = now + MISSION_SKIP_COOLDOWN_MS;
    p.mission = this.newMission(p);
    this.emitTo(p, 'mission', p.mission);
  }

  // ------------------------------------------------------------ tick
  tick() {
    const now = this.now();
    const snap = [];
    for (const p of this.players.values()) {
      if (p.alive && p.hp < PLAYER.maxHealth && now - p.lastHitAt > COMBAT.regenDelayMs) {
        p.hp = Math.min(PLAYER.maxHealth, p.hp + (COMBAT.regenPerSec * TICK_MS) / 1000);
      }
      // [id, x, y, z, angle, anim, hp, immune, alive]
      snap.push([p.id, round2(p.x), round2(p.y), round2(p.z), round2(p.a), p.anim, Math.round(p.hp),
        this.isImmune(p) ? 1 : 0, p.alive ? 1 : 0]);
      if (p.anim === 'punch' || p.anim === 'kick') p.anim = 'idle';
    }
    // MVP: everyone gets everyone. For big crowds, filter by distance (area of interest).
    if (snap.length) this.io.emit('snap', { t: now, p: snap });
  }

  onlineCount() {
    return this.players.size;
  }
}
