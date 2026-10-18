// Shared world rules — imported by BOTH the server (Node) and the browser.
// Everything here is deterministic, so every client and the server agree on
// where roads, buildings, banks, obstacles and cars are without sending them.

// ---------------------------------------------------------------- city grid
// The city is an infinite grid. Roads run along x = i*BLOCK and z = j*BLOCK.
// Each block (i, j) sits between roads and holds 4 lots (k = 0..3):
//   k = lx + 2*lz   (lx: west/east half, lz: north/south half)
// Lots with lz = 0 face the road at z = j*BLOCK, lz = 1 face z = (j+1)*BLOCK.
export const BLOCK = 48;
export const ROAD = 12;
export const LOT = (BLOCK - ROAD) / 2; // 18
export const BUILDING = 12;            // building footprint (square)

export const mod = (a, n) => ((a % n) + n) % n;

// Small deterministic hash -> [0, 1)
export function hash(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function lotCenter(i, j, k) {
  const lx = k & 1, lz = k >> 1;
  return {
    x: i * BLOCK + ROAD / 2 + LOT / 2 + lx * LOT,
    z: j * BLOCK + ROAD / 2 + LOT / 2 + lz * LOT,
  };
}

// Which way the front door faces along z: -1 (north road) or +1 (south road)
export const lotFacing = (k) => ((k >> 1) === 0 ? -1 : 1);

// Point on the sidewalk right in front of the door
export function lotDoor(i, j, k) {
  const c = lotCenter(i, j, k);
  return { x: c.x, z: c.z + lotFacing(k) * (BUILDING / 2 + 1.5) };
}

export const blockOf = (x, z) => ({ i: Math.floor(x / BLOCK), j: Math.floor(z / BLOCK) });

// Fixed brand shops (real links). Repeats every 8 blocks so the infinite city
// always has some nearby. Keyed by "i mod 8, j mod 8, lot".
export const BRANDS = {
  digikala: { name: 'دیجی‌کالا', url: 'https://www.digikala.com', color: '#ef394e' },
  khanoumi: { name: 'خانومی', url: 'https://www.khanoumi.com', color: '#e4007f' },
  alibaba: { name: 'علی‌بابا', url: 'https://www.alibaba.ir', color: '#fdb713' },
  snappfood: { name: 'اسنپ‌فود', url: 'https://snappfood.ir', color: '#ff00a6' },
  blubank: { name: 'بلوبانک', url: 'https://www.blubank.com', color: '#1e6bff' },
};
const BRAND_LOTS = {
  '0,0,1': 'digikala',
  '0,0,2': 'khanoumi',
  '0,0,3': 'alibaba',
  '1,0,0': 'snappfood',
  '7,0,1': 'blubank',
};

export const BANK_NAME = 'گلوبانک';

// 'bank' | 'brand' | 'free'. Free lots get procedural buildings or player shops.
export function lotType(i, j, k) {
  if (mod(i, 4) === 0 && mod(j, 4) === 0 && k === 0) return { type: 'bank' };
  const brand = BRAND_LOTS[`${mod(i, 8)},${mod(j, 8)},${k}`];
  if (brand) return { type: 'brand', brand };
  return { type: 'free' };
}

// Nearest Glowbank branch door to a point (banks sit on every 4th block).
export function nearestBankDoor(x, z) {
  const { i, j } = blockOf(x, z);
  let best = null;
  for (let bi = Math.floor(i / 4) * 4 - 4; bi <= i + 4; bi += 4) {
    for (let bj = Math.floor(j / 4) * 4 - 4; bj <= j + 4; bj += 4) {
      const d = lotDoor(bi, bj, 0);
      const dist = Math.hypot(d.x - x, d.z - z);
      if (!best || dist < best.dist) best = { ...d, i: bi, j: bj, dist };
    }
  }
  return best;
}

// Order in which free lots are handed out to new player shops: ring by ring
// around the city centre, so shops cluster where players start.
export function* shopSlotOrder(maxRing = 200) {
  for (let r = 0; r <= maxRing; r++) {
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        for (let k = 0; k < 4; k++) if (lotType(i, j, k).type === 'free') yield { i, j, k };
      }
    }
  }
}

// Procedural building height for a free lot
export const buildingHeight = (i, j, k) => 10 + Math.floor(hash(i, j, k + 11) * 28);

// ---------------------------------------------------------------- roads
// Every 3rd road is an "avenue" with traffic; other roads are "streets"
// which may hold a jumpable obstacle in the middle of each segment.
export const isAvenue = (n) => mod(n, 3) === 0;

// Obstacle on a road segment. dir 'h': road z = j*BLOCK between x = i*B .. (i+1)*B
//                             dir 'v': road x = i*BLOCK between z = j*B .. (j+1)*B
export const OBSTACLE = { len: 1.2, width: 9, height: 1.1 };
export function obstacleAt(dir, i, j) {
  if (dir === 'h' && isAvenue(j)) return null;
  if (dir === 'v' && isAvenue(i)) return null;
  const r = hash(i, j, dir === 'h' ? 3 : 7);
  if (r > 0.6) return null;
  const along = BLOCK / 2 + (hash(i, j, dir === 'h' ? 5 : 9) - 0.5) * 18;
  return dir === 'h'
    ? { key: `h:${i}:${j}`, dir, x: i * BLOCK + along, z: j * BLOCK }
    : { key: `v:${i}:${j}`, dir, x: i * BLOCK, z: j * BLOCK + along };
}
export function parseObstacleKey(key) {
  const m = /^([hv]):(-?\d{1,7}):(-?\d{1,7})$/.exec(String(key));
  if (!m) return null;
  return obstacleAt(m[1], Number(m[2]), Number(m[3]));
}

// ---------------------------------------------------------------- traffic
// Cars loop along each avenue with a fixed period, as a pure function of
// time, so all clients see the same cars without any network traffic.
export const CAR_PERIOD = BLOCK * 6;
export const CARS_PER_LANE = 3;
export const CAR = { len: 4.4, width: 2, height: 1.6 };
const LANE_OFFSET = 3;

// Cars on one avenue near `center` (coordinate along the avenue).
// axis 'x': avenue z = line*BLOCK, cars move along x. axis 'z' likewise.
export function carsOnAvenue(axis, line, tSec, center, range) {
  const out = [];
  for (let lane = 0; lane < 2; lane++) {
    const dirSign = lane === 0 ? 1 : -1;
    for (let c = 0; c < CARS_PER_LANE; c++) {
      const seed = axis === 'x' ? 1 : 2;
      const speed = 9 + hash(line, c + lane * 10, seed) * 7;
      const offset = hash(line, c + lane * 10, seed + 2) * CAR_PERIOD;
      const base = mod(offset + dirSign * speed * tSec, CAR_PERIOD);
      const nMin = Math.floor((center - range - base) / CAR_PERIOD);
      const nMax = Math.ceil((center + range - base) / CAR_PERIOD);
      for (let n = nMin; n <= nMax; n++) {
        const along = base + n * CAR_PERIOD;
        if (Math.abs(along - center) > range) continue;
        const across = line * BLOCK + dirSign * LANE_OFFSET;
        out.push({
          id: `${axis}${line}:${lane}:${c}:${n}`,
          x: axis === 'x' ? along : across,
          z: axis === 'x' ? across : along,
          axis, dir: dirSign,
          color: Math.floor(hash(line, c + lane * 10, seed + 4) * 6),
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- player
export const PLAYER = {
  speed: 8,            // units / second
  maxHealth: 100,
  radius: 0.5,
};

// Combat (server-validated). Same feel as the single-player version:
// 3 punches or 2 kicks knock someone out.
export const COMBAT = {
  punch: { damage: 34, range: 2.6, cooldownMs: 400 },
  kick: { damage: 50, range: 2.8, cooldownMs: 700 },
  maxAngle: (80 * Math.PI) / 180, // target must be roughly in front
  respawnDelayMs: 3000,
  respawnImmunityMs: 5000,  // after respawn: can't be hit
  spawnImmunityMs: 10000,   // after logging in: can't be hit (stops spawn-camping newcomers)
  bankSafeRadius: 6,        // no fighting right at a bank door (stops bank camping)
  regenDelayMs: 6000,       // health regenerates after this long without damage
  regenPerSec: 5,
};

export const BANK = { depositRadius: 8 };
export const SHOP = { price: 300, maxProducts: 30, interactRadius: 4.5 };

// Score sources (all granted by the server)
export const SCORE = {
  perDistance: 10,   // +1 score per this many units run
  obstacleJump: 5,
  obstacleCooldownMs: 20000, // same obstacle can't be farmed back-to-back
};

// ---------------------------------------------------------------- outfits
export const OUTFITS = [
  { id: 'classic', name: 'کلاسیک', price: 0, shirt: '#3b82f6', pants: '#1f2937', skin: '#f1c27d', hat: null },
  { id: 'street', name: 'خیابونی', price: 50, shirt: '#ef4444', pants: '#111827', skin: '#e0ac69', hat: '#111827' },
  { id: 'forest', name: 'جنگلی', price: 80, shirt: '#16a34a', pants: '#3f3f46', skin: '#c68642', hat: '#14532d' },
  { id: 'royal', name: 'سلطنتی', price: 150, shirt: '#7c3aed', pants: '#facc15', skin: '#f1c27d', hat: '#facc15' },
  { id: 'ninja', name: 'نینجا', price: 200, shirt: '#0f172a', pants: '#0f172a', skin: '#8d5524', hat: '#dc2626' },
  { id: 'gold', name: 'طلایی', price: 400, shirt: '#eab308', pants: '#a16207', skin: '#ffdbac', hat: '#fde047' },
];
export const outfitById = (id) => OUTFITS.find((o) => o.id === id) || OUTFITS[0];

// ---------------------------------------------------------------- validation
export const USERNAME_RE = /^[\p{L}\p{N}_]{3,20}$/u;
