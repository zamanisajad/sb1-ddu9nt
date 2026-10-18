// Client entry point: renders the shared city, sends our moves to the server
// and shows every other online player. The server decides score, health,
// hits, kills and money — this file only displays what it says.
import * as THREE from '/vendor/three.module.js';
import { io } from '/socket.io/socket.io.esm.min.js';
import {
  PLAYER, COMBAT, BANK, SHOP, BANK_NAME, OBSTACLE, SCORE, nearestBankDoor,
} from '/shared/world.js';
import { buildCharacter, animate, playAction, textSprite, healthBar } from './character.js';
import { City, collide, obstaclesNear, shopAt } from './city.js';
import {
  $, el, num, api, toast, showPrompt, modalOpen,
  openPlayerShop, openBrandShop, openMyShop, openOutfits, openRanks,
} from './ui.js';

const SEND_MS = 100;        // how often we report our position (10 Hz)
const GRAVITY = 26;
const JUMP_SPEED = 9.5;
const CAM_OFFSET = new THREE.Vector3(0, 13, 10);

// ------------------------------------------------------------ session
let me;
try {
  me = await api('GET', '/api/me');
} catch {
  throw new Error('not signed in'); // api() already redirected to the login page
}

// Everything the panels need to know about us
const state = {
  id: me.id,
  username: me.username,
  bank: me.bank,
  score: me.score,
  outfit: me.outfit,
  owned: me.owned,
  online: me.online,
  onWallet: (bank) => setBank(bank),
};

// ------------------------------------------------------------ three.js
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('scene').append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fd3f5');
scene.fog = new THREE.Fog('#9fd3f5', 70, 150);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 400);
scene.add(new THREE.HemisphereLight('#e0f2fe', '#475569', 1.6));
const sun = new THREE.DirectionalLight('#fff7e6', 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
scene.add(sun, sun.target);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const city = new City(scene);
api('GET', '/api/shops').then((shops) => city.setShops(shops)).catch(() => {});

// ------------------------------------------------------------ local player
const self = {
  x: 0, z: 0, y: 0, vy: 0, a: 0,
  hp: PLAYER.maxHealth, alive: true, immune: true,
  seq: 1, stunUntil: 0, knock: { x: 0, z: 0 },
  char: buildCharacter(me.outfit),
  ready: false,
};
const myTag = textSprite(me.username, { color: '#fde047' });
myTag.position.y = 2.55;
self.char.group.add(myTag);
scene.add(self.char.group);

// ------------------------------------------------------------ other players
// Every human you see is a real, logged-in player. With nobody else online
// the city is simply empty — that's intended.
const others = new Map();

function addOther(info) {
  if (info.id === state.id || others.has(info.id)) return;
  const char = buildCharacter(info.outfit);
  const tag = textSprite(info.username);
  tag.position.y = 2.6;
  const bar = healthBar();
  bar.group.position.y = 2.25;
  bar.group.scale.set(0.9, 1, 1);
  char.group.add(tag, bar.group);
  char.group.position.set(info.x, info.y, info.z);
  char.group.rotation.y = info.a;
  scene.add(char.group);
  const o = {
    id: info.id, username: info.username, char, bar, tag,
    target: { x: info.x, y: info.y, z: info.z, a: info.a },
    prev: { x: info.x, z: info.z },
    hp: info.hp, alive: info.alive, immune: info.immune, anim: info.anim, speed: 0,
  };
  bar.set(info.hp / PLAYER.maxHealth);
  others.set(info.id, o);
}

function removeOther(id) {
  const o = others.get(id);
  if (!o) return;
  scene.remove(o.char.group);
  o.char.dispose();
  o.tag.material.map.dispose();
  others.delete(id);
}

const updateOnline = () => {
  state.online = others.size + 1;
  $('online').textContent = `👥 ${num(state.online)}`;
};

// ------------------------------------------------------------ HUD
function setScore(v, flash = true) {
  state.score = v;
  $('score').textContent = num(v);
  if (flash) {
    const c = $('score').parentElement;
    c.classList.remove('flash');
    void c.offsetWidth;
    c.classList.add('flash');
  }
}
function setBank(v) {
  state.bank = v;
  $('bank').textContent = num(v);
}
function setHealth(hp) {
  self.hp = hp;
  $('health-fill').style.width = `${Math.max(0, (hp / PLAYER.maxHealth) * 100)}%`;
}
setScore(me.score, false);
setBank(me.bank);

let mission = null;
function setMission(m) {
  mission = m;
  const text = {
    run: () => `بدو: ${num(m.goal)} متر`,
    jump: () => `از ${num(m.goal)} مانع بپر`,
    defeat: () => 'یک بازیکن دیگر را شکست بده',
    reach: () => `برو جلوی فروشگاه ${m.label}`,
  }[m.type]?.() ?? '';
  $('mission-text').textContent = `🎯 ${text} — جایزه: ${num(m.reward)} امتیاز`;
  $('mission-fill').style.width = `${(m.progress / m.goal) * 100}%`;
  $('mission-pointer').hidden = m.type !== 'reach';
}
$('mission-skip').addEventListener('click', () => socket.emit('mission:skip'));

// ------------------------------------------------------------ network
const socket = io({ transports: ['websocket', 'polling'] });
let clockOffset = 0; // serverTime - Date.now()
const serverSec = () => (Date.now() + clockOffset) / 1000;

function syncClock() {
  const t0 = Date.now();
  socket.emit('ping:time', (serverNow) => {
    const rtt = Date.now() - t0;
    clockOffset = serverNow + rtt / 2 - Date.now();
  });
}

socket.on('connect_error', (err) => {
  if (err.message === 'unauthorized') location.replace('/');
});
socket.on('disconnect', () => {
  $('loading').hidden = false;
  $('loading').querySelector('h2').textContent = 'اتصال قطع شد؛ در حال اتصال دوباره…';
});
socket.on('kicked', ({ reason }) => {
  socket.io.opts.reconnection = false;
  $('loading').hidden = false;
  $('loading').querySelector('h2').textContent = reason;
});

socket.on('welcome', (w) => {
  clockOffset = w.serverTime - Date.now();
  syncClock();
  const y = w.you;
  Object.assign(self, { x: y.x, z: y.z, y: 0, vy: 0, a: y.a, seq: y.seq, alive: y.alive, immune: y.immune, ready: true });
  setHealth(y.hp);
  setScore(y.score, false);
  setBank(y.bank);
  state.owned = y.owned;
  for (const id of [...others.keys()]) removeOther(id);
  w.players.forEach(addOther);
  updateOnline();
  setMission(w.mission);
  $('loading').hidden = true;
  if (y.immune) toast(`🛡️ چند ثانیه مصونیت داری. امتیازت را در ${BANK_NAME} امن کن!`, 'good');
});

socket.on('player:join', (p) => {
  addOther(p);
  updateOnline();
  toast(`👋 ${p.username} وارد شهر شد`);
});
socket.on('player:leave', ({ id }) => {
  const o = others.get(id);
  if (o) toast(`${o.username} از شهر رفت`);
  removeOther(id);
  updateOnline();
});
socket.on('player:outfit', ({ id, outfit }) => {
  if (id === state.id) {
    state.outfit = outfit;
    self.char.setOutfit(outfit);
  } else others.get(id)?.char.setOutfit(outfit);
});

socket.on('snap', ({ p }) => {
  for (const [id, x, y, z, a, anim, hp, immune, alive] of p) {
    if (id === state.id) {
      setHealth(hp);
      self.immune = !!immune;
      continue;
    }
    const o = others.get(id);
    if (!o) continue;
    Object.assign(o.target, { x, y, z, a });
    o.anim = anim;
    o.hp = hp;
    o.immune = !!immune;
    o.alive = !!alive;
    o.bar.set(hp / PLAYER.maxHealth);
  }
});

socket.on('anim', ({ id, type }) => {
  const o = others.get(id);
  if (o) playAction(o.char, type, performance.now());
});

socket.on('hit', ({ attacker, victim, hp, type }) => {
  const now = performance.now();
  if (victim === state.id) {
    setHealth(hp);
    playAction(self.char, 'stun', now);
    const o = others.get(attacker);
    if (o) {
      // knock back away from the attacker
      const dx = self.x - o.target.x, dz = self.z - o.target.z, d = Math.hypot(dx, dz) || 1;
      const force = type === 'kick' ? 4 : 2.5; // small shove; distance ≈ force / 6
      self.knock = { x: (dx / d) * force, z: (dz / d) * force };
    }
    flashScreen();
  } else {
    const o = others.get(victim);
    if (o) {
      o.hp = hp;
      o.bar.set(hp / PLAYER.maxHealth);
      playAction(o.char, 'stun', now);
    }
  }
});

socket.on('death', ({ killer, victim, killerName, victimName, amount }) => {
  if (victim === state.id) {
    self.alive = false;
    setHealth(0);
    $('death-text').textContent = amount > 0
      ? `${killerName} تو را شکست داد و ${num(amount)} امتیاز بانک‌نشده‌ات را برد.`
      : `${killerName} تو را شکست داد. خوشبختانه امتیاز بانک‌نشده‌ای نداشتی.`;
    $('death').hidden = false;
  } else if (killer === state.id) {
    toast(amount > 0 ? `🥊 ${victimName} را شکست دادی و ${num(amount)} امتیازش را گرفتی!` : `🥊 ${victimName} را شکست دادی!`, 'gold');
  } else {
    toast(`⚔️ ${killerName} ${victimName} را شکست داد${amount > 0 ? ` (+${num(amount)})` : ''}`);
  }
  const o = others.get(victim);
  if (o) o.alive = false;
});

socket.on('respawn', ({ id, x, z, hp }) => {
  if (id === state.id) {
    self.alive = true;
    setHealth(hp);
    $('death').hidden = true;
    toast('دوباره برگشتی. چند ثانیه مصونیت داری 🛡️', 'good');
  } else {
    const o = others.get(id);
    if (!o) return;
    o.alive = true;
    o.hp = hp;
    o.bar.set(1);
    Object.assign(o.target, { x, z });
    o.char.group.position.set(x, 0, z); // snap, don't slide across the city
  }
});

socket.on('teleport', ({ x, z, seq }) => {
  Object.assign(self, { x, z, seq, y: 0, vy: 0 });
});

const REASONS = { jump: 'پرش از مانع', mission: 'مأموریت', run: null, kill: null, death: null, deposit: null };
socket.on('score', ({ score, delta, reason }) => {
  setScore(score, delta > 1 || delta < 0);
  if (REASONS[reason]) toast(`+${num(delta)} امتیاز — ${REASONS[reason]}`, 'good');
});
socket.on('wallet', ({ bank }) => setBank(bank));
socket.on('mission', setMission);
socket.on('mission:done', ({ reward }) => toast(`🎯 مأموریت انجام شد! +${num(reward)}`, 'gold'));
socket.on('shop:changed', (shop) => shop && city.upsertShop(shop));

// ------------------------------------------------------------ input
const keys = new Set();
const joy = { x: 0, z: 0, active: false };
const typing = () => modalOpen() || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);

addEventListener('keydown', (e) => {
  if (typing()) return;
  const k = e.key.toLowerCase();
  keys.add(k);
  if (e.repeat) return;
  if (k === ' ') jump();
  else if (k === 'j' || k === 'f') attack('punch');
  else if (k === 'k' || k === 'g') attack('kick');
  else if (k === 'e' || k === 'enter') interact();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

// joystick (touch & mouse)
{
  const pad = $('joystick'), knob = $('knob');
  let pid = null;
  const move = (e) => {
    const r = pad.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const max = r.width / 2 - 10;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    joy.x = dx / max;
    joy.z = dy / max;
  };
  pad.addEventListener('pointerdown', (e) => {
    pid = e.pointerId;
    pad.setPointerCapture(pid);
    joy.active = true;
    move(e);
  });
  pad.addEventListener('pointermove', (e) => e.pointerId === pid && move(e));
  const end = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    joy.active = false;
    joy.x = joy.z = 0;
    knob.style.transform = '';
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
}
document.querySelectorAll('.act').forEach((b) => {
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.classList.add('pressed');
    const act = b.dataset.act;
    if (act === 'jump') jump();
    else attack(act);
  });
  const up = () => b.classList.remove('pressed');
  b.addEventListener('pointerup', up);
  b.addEventListener('pointerleave', up);
});

document.querySelectorAll('[data-open]').forEach((b) =>
  b.addEventListener('click', () => {
    const which = b.dataset.open;
    if (which === 'myshop') openMyShop(state).catch((e) => toast(e.message, 'bad'));
    if (which === 'outfits') {
      api('GET', '/api/me')
        .then((m) => {
          setBank(m.bank);
          state.owned = m.owned;
          openOutfits(state);
        })
        .catch((e) => toast(e.message, 'bad'));
    }
    if (which === 'ranks') openRanks(state.online).catch((e) => toast(e.message, 'bad'));
  }));
$('logout').addEventListener('click', async () => {
  if (!confirm('از حساب خارج شوی؟ امتیاز بانک‌نشده‌ات تا ورود بعدی سر جایش می‌ماند.')) return;
  await api('POST', '/api/auth/logout', {});
  socket.disconnect();
  location.replace('/');
});

// ------------------------------------------------------------ actions
const canAct = () => self.ready && self.alive && performance.now() > self.stunUntil;

function jump() {
  if (!canAct() || self.y > 0.01) return;
  self.vy = JUMP_SPEED;
}

const lastAttack = { punch: 0, kick: 0 };
function attack(type) {
  if (!canAct()) return;
  const now = performance.now();
  if (now - lastAttack[type] < COMBAT[type].cooldownMs) return;
  lastAttack[type] = now;
  // Auto-face the nearest player in reach (easier on touch screens)
  let best = null, bestD = COMBAT[type].range + 0.6;
  for (const o of others.values()) {
    if (!o.alive) continue;
    const d = Math.hypot(o.target.x - self.x, o.target.z - self.z);
    if (d < bestD) {
      best = o;
      bestD = d;
    }
  }
  if (best) {
    const dx = best.target.x - self.x, dz = best.target.z - self.z;
    self.a = Math.atan2(dx, dz);
    // small lunge so a target that got shoved back is still in reach
    const step = Math.min(0.7, bestD - 1.3);
    if (step > 0) {
      const c = collide(self.x + (dx / bestD) * step, self.z + (dz / bestD) * step, self.y, PLAYER.radius);
      self.x = c.x;
      self.z = c.z;
    }
  }
  playAction(self.char, type, now);
  sendState(true);
  socket.emit('attack', { type });
  // Punching a shop door with nobody to fight opens the shop
  if (!best && type === 'punch') interact(true);
}

function interact(fromPunch = false) {
  if (!self.ready || modalOpen()) return;
  const shop = shopAt(self.x, self.z, city.shopsByLot, SHOP.interactRadius);
  if (shop) {
    if (shop.kind === 'brand') openBrandShop(shop);
    else openPlayerShop(shop.shop, state.id);
    return;
  }
  if (!fromPunch && nearestBankDoor(self.x, self.z).dist <= BANK.depositRadius) deposit();
}

async function deposit() {
  if (state.score <= 0) return toast('امتیازی برای واریز نداری', 'bad');
  try {
    const out = await api('POST', '/api/bank/deposit', {});
    setBank(out.bank);
    toast(`🏦 ${num(out.amount)} امتیاز به فیت‌کوین تبدیل و امن شد`, 'gold');
  } catch (e) {
    toast(e.message, 'bad');
  }
}

let flashEl = null;
function flashScreen() {
  if (!flashEl) {
    flashEl = el('div', { style: 'position:fixed;inset:0;background:rgba(244,63,94,.25);pointer-events:none;z-index:9;transition:opacity .35s' });
    document.body.append(flashEl);
  }
  flashEl.style.opacity = '1';
  requestAnimationFrame(() => requestAnimationFrame(() => (flashEl.style.opacity = '0')));
}

// ------------------------------------------------------------ networking out
let lastSent = 0;
let lastSentPos = null;
function sendState(force = false) {
  const now = performance.now();
  if (!force && now - lastSent < SEND_MS) return;
  const anim = self.y > 0.05 ? 'jump' : self.char.action === 'stun' ? 'stun' : self.speed > 0.1 ? 'run' : 'idle';
  const msg = { x: self.x, y: self.y, z: self.z, a: self.a, anim, seq: self.seq };
  // idle and unchanged: send a heartbeat only twice a second
  if (!force && lastSentPos && lastSentPos.x === msg.x && lastSentPos.z === msg.z && lastSentPos.a === msg.a
    && lastSentPos.y === msg.y && now - lastSent < 500) return;
  lastSent = now;
  lastSentPos = msg;
  socket.emit('state', msg);
}

// ------------------------------------------------------------ obstacle jumps
const obstacleSide = new Map(); // key -> which side of the barrier we were on
const obstacleClaimed = new Map();
function checkObstacles() {
  for (const o of obstaclesNear(self.x, self.z)) {
    const along = o.dir === 'h' ? self.x - o.x : self.z - o.z;
    const across = o.dir === 'h' ? self.z - o.z : self.x - o.x;
    const side = Math.sign(along);
    const prev = obstacleSide.get(o.key);
    obstacleSide.set(o.key, side);
    if (prev === undefined || prev === side || Math.abs(across) > OBSTACLE.width / 2 + 0.5) continue;
    if (self.y < 0.3) continue;
    const now = performance.now();
    const last = obstacleClaimed.get(o.key);
    if (last !== undefined && now - last < SCORE.obstacleCooldownMs) continue;
    obstacleClaimed.set(o.key, now);
    sendState(true); // make sure the server knows we're right there
    socket.emit('obstacle', { key: o.key });
  }
  if (obstacleSide.size > 100) obstacleSide.clear();
}

// ------------------------------------------------------------ prompts & pointers
function updatePrompts() {
  if (!self.ready || !self.alive) return showPrompt(null);
  const bank = nearestBankDoor(self.x, self.z);
  if (bank.dist <= BANK.depositRadius) {
    return showPrompt({
      key: `bank:${state.score}`,
      nodes: [
        el('span', { text: `🏦 ${BANK_NAME} — ${num(state.score)} امتیاز روی هوا داری` }),
        el('button', { type: 'button', class: 'btn gold small', text: 'واریز (E)', disabled: state.score <= 0, onclick: deposit }),
      ],
    });
  }
  const shop = shopAt(self.x, self.z, city.shopsByLot, SHOP.interactRadius);
  if (shop) {
    const name = shop.kind === 'brand' ? shop.name : shop.shop.name;
    return showPrompt({
      key: `shop:${name}`,
      nodes: [
        el('span', { text: `🏪 ${name}` }),
        el('button', { type: 'button', class: 'btn primary small', text: 'ورود (E / مشت)', onclick: () => interact() }),
      ],
    });
  }
  showPrompt(null);
}

function pointTo(arrowEl, distEl, tx, tz) {
  // camera looks toward -z, so screen right = +x and screen down = +z
  const ang = Math.atan2(tz - self.z, tx - self.x);
  arrowEl.style.transform = `rotate(${ang}rad)`;
  distEl.textContent = `${num(Math.hypot(tx - self.x, tz - self.z))} م`;
}

// ------------------------------------------------------------ main loop
const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();
self.speed = 0;
let promptTimer = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();

  if (self.ready) {
    // movement input: screen up = -z, screen right = +x
    let ix = joy.x, iz = joy.z;
    if (keys.has('w') || keys.has('arrowup')) iz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) iz += 1;
    if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
    if (keys.has('d') || keys.has('arrowright')) ix += 1;
    const mag = Math.min(1, Math.hypot(ix, iz));
    const stunned = now < self.stunUntil;
    self.speed = self.alive && !stunned ? mag : 0;
    if (self.alive) {
      if (mag > 0.08 && !stunned) {
        const d = Math.hypot(ix, iz);
        self.x += (ix / d) * PLAYER.speed * mag * dt;
        self.z += (iz / d) * PLAYER.speed * mag * dt;
        self.a = Math.atan2(ix, iz);
      }
      // knockback decays quickly
      self.x += self.knock.x * dt;
      self.z += self.knock.z * dt;
      self.knock.x *= Math.max(0, 1 - dt * 6);
      self.knock.z *= Math.max(0, 1 - dt * 6);
      // jump physics
      if (self.y > 0 || self.vy > 0) {
        self.vy -= GRAVITY * dt;
        self.y = Math.max(0, self.y + self.vy * dt);
        if (self.y === 0) self.vy = 0;
      }
      const c = collide(self.x, self.z, self.y, PLAYER.radius);
      self.x = c.x;
      self.z = c.z;
      // traffic: cars bump you aside (no damage)
      const car = city.carHit(self.x, self.z, self.y);
      if (car && now > self.stunUntil) {
        const side = car.axis === 'x' ? Math.sign(self.z - car.z || 1) : Math.sign(self.x - car.x || 1);
        self.knock = car.axis === 'x' ? { x: car.dir * 10, z: side * 14 } : { x: side * 14, z: car.dir * 10 };
        self.stunUntil = now + 600;
        playAction(self.char, 'stun', now);
        toast('🚗 مراقب ماشین‌ها باش!', 'bad');
      }
      checkObstacles();
      sendState();
    }

    const g = self.char.group;
    g.position.set(self.x, self.y, self.z);
    g.rotation.y = self.a;
    animate(self.char, { moving: self.speed, airborne: self.y > 0.05, dead: !self.alive }, dt, now);
    self.char.setOpacity(self.immune ? 0.55 + 0.25 * Math.sin(now / 120) : 1);

    // camera
    camTarget.set(self.x, 1, self.z);
    const want = camTarget.clone().add(CAM_OFFSET);
    camera.position.lerp(want, 1 - Math.exp(-dt * 6));
    camera.lookAt(camera.position.clone().sub(CAM_OFFSET).setY(1));
    sun.position.set(self.x + 25, 45, self.z + 15);
    sun.target.position.set(self.x, 0, self.z);

    city.update(self.x, self.z, serverSec());
    city.updateOcclusion(camera.position, camTarget.set(self.x, 1.2, self.z));

    if ((promptTimer += dt) > 0.15) {
      promptTimer = 0;
      updatePrompts();
      const bank = nearestBankDoor(self.x, self.z);
      pointTo($('bank-pointer').querySelector('.arrow'), $('bank-dist'), bank.x, bank.z);
      if (mission?.type === 'reach') pointTo($('mission-pointer').querySelector('.arrow'), $('mission-dist'), mission.x, mission.z);
    }
  }

  // other players: smooth toward the latest server position
  const k = 1 - Math.exp(-dt * 12);
  for (const o of others.values()) {
    const g = o.char.group;
    const px = g.position.x, pz = g.position.z;
    g.position.x += (o.target.x - g.position.x) * k;
    g.position.y += (o.target.y - g.position.y) * k;
    g.position.z += (o.target.z - g.position.z) * k;
    let da = o.target.a - g.rotation.y;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    g.rotation.y += da * k;
    const v = Math.hypot(g.position.x - px, g.position.z - pz) / Math.max(dt, 1e-3);
    o.speed += (Math.min(1, v / PLAYER.speed) - o.speed) * Math.min(1, dt * 10);
    animate(o.char, { moving: o.speed, airborne: g.position.y > 0.05, dead: !o.alive }, dt, now);
    o.char.setOpacity(o.immune ? 0.5 : 1);
    o.bar.group.visible = o.alive && o.hp < PLAYER.maxHealth;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
