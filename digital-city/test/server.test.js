// End-to-end server test: two real accounts, real sockets, real REST calls.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io as connect } from 'socket.io-client';
import { createServer } from '../server/index.js';
import { nearestBankDoor, COMBAT, SHOP } from '../shared/world.js';

let srv, base, tmp;
const sockets = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-test-'));
  srv = createServer({ dbPath: path.join(tmp, 'test.db') });
  await new Promise((r) => srv.server.listen(0, r));
  base = `http://localhost:${srv.server.address().port}`;
});
after(async () => {
  sockets.forEach((s) => s.close());
  await srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

function client() {
  let cookie = '';
  const call = async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'content-type': 'application/json', cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
    return { status: res.status, data };
  };
  return {
    call,
    get cookie() { return cookie; },
    socket: null,
    async join() {
      this.socket = connect(base, { extraHeaders: { cookie }, transports: ['websocket'], forceNew: true });
      sockets.push(this.socket);
      this.welcome = await new Promise((resolve, reject) => {
        this.socket.once('welcome', resolve);
        this.socket.once('connect_error', reject);
      });
      this.seq = this.welcome.you.seq;
      this.pos = { x: this.welcome.you.x, z: this.welcome.you.z };
      this.socket.on('teleport', (t) => { this.seq = t.seq; this.pos = { x: t.x, z: t.z }; });
      return this.welcome;
    },
    // Walk in small legal steps (server rejects teleport-speed moves).
    async walkTo(x, z) {
      for (;;) {
        const dx = x - this.pos.x, dz = z - this.pos.z;
        const d = Math.hypot(dx, dz);
        const step = Math.min(d, 1.8);
        this.pos = { x: this.pos.x + (dx / (d || 1)) * step, z: this.pos.z + (dz / (d || 1)) * step };
        this.socket.emit('state', { ...this.pos, y: 0, a: Math.atan2(dx, dz), anim: 'run', seq: this.seq });
        await sleep(30);
        if (d <= 1.8) break;
      }
    },
    face(a) {
      this.socket.emit('state', { ...this.pos, y: 0, a, anim: 'idle', seq: this.seq });
    },
  };
}

test('accounts: validation, register, login, rate limits', async () => {
  const c = client();
  assert.equal((await c.call('POST', '/api/auth/register', { username: 'ab', password: 'password1' })).status, 400);
  assert.equal((await c.call('POST', '/api/auth/register', { username: 'tester', password: 'short' })).status, 400);
  assert.equal((await c.call('POST', '/api/auth/register', { username: '<script>', password: 'password1' })).status, 400);
  assert.equal((await c.call('POST', '/api/auth/register', { username: 'tester', password: 'password1' })).status, 201);
  assert.equal((await c.call('POST', '/api/auth/register', { username: 'TESTER', password: 'password1' })).status, 409);
  const me = await c.call('GET', '/api/me');
  assert.equal(me.data.username, 'tester');
  assert.equal(me.data.bank, 0);

  const d = client();
  assert.equal((await d.call('GET', '/api/me')).status, 401);
  assert.equal((await d.call('POST', '/api/auth/login', { username: 'tester', password: 'wrong-pass' })).status, 401);
  assert.equal((await d.call('POST', '/api/auth/login', { username: 'tester', password: 'password1' })).status, 200);
  assert.equal((await d.call('GET', '/api/me')).status, 200);

  // password is stored hashed
  const row = srv.repo.userAuthByName('tester');
  assert.match(row.password_hash, /^\$2[aby]\$12\$/);

  // brute force: 8 failures lock the username
  for (let i = 0; i < 8; i++) await d.call('POST', '/api/auth/login', { username: 'tester', password: 'nope' + i });
  assert.equal((await d.call('POST', '/api/auth/login', { username: 'tester', password: 'password1' })).status, 429);

  // non-JSON writes are refused (CSRF guard)
  const r = await fetch(base + '/api/auth/login', { method: 'POST', body: 'username=a&password=b',
    headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(r.status, 415);
});


test('multiplayer: presence, PvP loot transfer, bank, respawn, shop & products', async () => {
  const a = client(), b = client();
  await a.call('POST', '/api/auth/register', { username: 'alice', password: 'password1' });
  await b.call('POST', '/api/auth/register', { username: 'bob_ir', password: 'password1' });

  // unauthenticated sockets are refused
  const anon = connect(base, { transports: ['websocket'], forceNew: true });
  await assert.rejects(new Promise((res, rej) => { anon.on('connect', res); anon.on('connect_error', rej); }));
  anon.close();

  await a.join();
  const joined = new Promise((r) => a.socket.once('player:join', r));
  const wb = await b.join();
  assert.equal((await joined).username, 'bob_ir');
  assert.deepEqual(wb.players.map((p) => p.username), ['alice']);
  assert.equal(wb.you.immune, true, 'newcomers are protected');

  // Both walk away from the bank (no fighting at the bank door)
  const door = nearestBankDoor(a.pos.x, a.pos.z);
  const meet = { x: door.x + 14, z: door.z };
  await Promise.all([a.walkTo(meet.x, meet.z), b.walkTo(meet.x + 1.2, meet.z)]);

  // Bob earns some un-banked score by running back and forth
  await b.walkTo(meet.x + 40, meet.z);
  await b.walkTo(meet.x + 1.2, meet.z);
  await sleep(50);
  const bobScore = srv.game.players.get(wb.you.id).score;
  assert.ok(bobScore >= 6, `bob should have running score, got ${bobScore}`);

  // Teleport hack is rejected
  const tp = new Promise((r) => b.socket.once('teleport', r));
  b.socket.emit('state', { x: meet.x + 500, z: meet.z, y: 0, a: 0, anim: 'run', seq: b.seq });
  await tp;
  assert.ok(Math.abs(srv.game.players.get(wb.you.id).x - (meet.x + 1.2)) < 0.01);

  // Bob is still spawn-immune: punches do nothing
  a.face(Math.PI / 2); // facing +x, toward bob
  await sleep(30);
  let hits = 0;
  b.socket.on('hit', () => hits++);
  a.socket.emit('attack', { type: 'punch' });
  await sleep(100);
  assert.equal(hits, 0);

  // Drop the immunity (as if 10 s had passed) and fight: 3 punches
  for (const p of srv.game.players.values()) p.immuneUntil = 0;
  const died = new Promise((r) => b.socket.once('death', r));
  for (let i = 0; i < 6 && hits < 3; i++) {
    a.socket.emit('attack', { type: 'punch' });
    await sleep(COMBAT.punch.cooldownMs + 20);
  }
  // spamming faster than the cooldown doesn't add hits
  const death = await died;
  assert.equal(hits, 3);
  assert.equal(death.killerName, 'alice');
  assert.equal(death.amount, bobScore);

  const aliceP = srv.game.players.get(a.welcome.you.id);
  const bobP = srv.game.players.get(wb.you.id);
  assert.equal(bobP.score, 0, 'victim loses un-banked score');
  assert.ok(aliceP.score >= bobScore, 'killer gets the loot');
  assert.equal(srv.repo.user(wb.you.id).current_score, 0);
  assert.equal(srv.repo.raw.prepare('SELECT COUNT(*) n FROM kill_log').get().n, 1);

  // Respawn at a bank with immunity
  const resp = await new Promise((r) => b.socket.once('respawn', r));
  assert.equal(resp.hp, 100);
  assert.ok(nearestBankDoor(resp.x, resp.z).dist < 6);
  assert.ok(srv.game.isImmune(bobP));

  // Deposit: refused away from the bank, works at the bank door
  let dep = await a.call('POST', '/api/bank/deposit', {});
  assert.equal(dep.status, 403);
  await a.walkTo(door.x, door.z);
  await sleep(30);
  const loot = aliceP.score;
  dep = await a.call('POST', '/api/bank/deposit', {});
  assert.equal(dep.status, 200);
  assert.equal(dep.data.bank, loot);
  assert.equal(srv.repo.user(aliceP.id).bank_fitcoin, loot);
  assert.equal(srv.repo.user(aliceP.id).current_score, 0);

  // Shop: too poor -> 402; with enough bank -> unique lot
  assert.equal((await a.call('POST', '/api/shop', { name: 'مغازه آلیس' })).status, 402);
  srv.repo.setBank(aliceP.id, 1000);
  srv.repo.setBank(bobP.id, 1000);
  const shopA = await a.call('POST', '/api/shop', { name: '  مغازه‮ آلیس ' });
  assert.equal(shopA.status, 201);
  assert.equal(shopA.data.shop.name, 'مغازه آلیس');
  assert.equal(shopA.data.bank, 1000 - SHOP.price);
  assert.equal((await a.call('POST', '/api/shop', { name: 'دومی' })).status, 409);
  const shopB = await b.call('POST', '/api/shop', { name: 'Bob Store' });
  const key = (s) => `${s.block_i},${s.block_j},${s.lot}`;
  assert.notEqual(key(shopA.data.shop), key(shopB.data.shop));

  // Products: validation + image handling
  const png = 'data:image/png;base64,' + Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64');
  assert.equal((await a.call('POST', '/api/shop/products', { title: 'x', price: 10, payment_link: 'javascript:alert(1)' })).status, 400);
  assert.equal((await a.call('POST', '/api/shop/products', { title: 'x', price: 10, payment_link: 'https://pay.example/x',
    image: 'data:image/svg+xml;base64,PHN2Zz4=' })).status, 400);
  const prod = await a.call('POST', '/api/shop/products', {
    title: 'کتاب', price: 120000, payment_link: 'https://zarinp.al/test', description: 'یک کتاب خوب', image: png });
  assert.equal(prod.status, 201);
  assert.equal(prod.data.product.has_image, true);
  const img = await fetch(`${base}/api/img/product/${prod.data.product.id}`);
  assert.equal(img.headers.get('content-type'), 'image/png');

  // Bob can't edit Alice's product, but can see it
  assert.equal((await b.call('DELETE', `/api/shop/products/${prod.data.product.id}`)).status, 404);
  const view = await b.call('GET', `/api/shops/${shopA.data.shop.id}`);
  assert.equal(view.data.products[0].payment_link, 'https://zarinp.al/test');
  assert.equal(view.data.products[0].image, undefined, 'image bytes are not in the listing');

  // Outfit purchase uses the bank
  const buy = await b.call('POST', '/api/outfits/buy', { id: 'ninja' });
  assert.equal(buy.status, 200);
  assert.equal(buy.data.bank, 1000 - SHOP.price - 200);

  // Leaving removes the player after the grace period, data stays
  const left = new Promise((r) => a.socket.once('player:leave', r));
  b.socket.close();
  assert.equal((await left).id, wb.you.id);
  assert.equal(srv.repo.shopByOwner(wb.you.id).name, 'Bob Store');
  a.socket.close();
});
