// Renders the infinite city around the player, block by block, from the
// shared deterministic rules. Player shops come from the server.
import * as THREE from '/vendor/three.module.js';
import {
  BLOCK, ROAD, BUILDING, OBSTACLE, CAR, BRANDS, BANK_NAME, BANK,
  lotCenter, lotFacing, lotDoor, lotType, buildingHeight, obstacleAt, carsOnAvenue, isAvenue, hash, blockOf,
} from '/shared/world.js';

const VIEW_BLOCKS = 3;      // load blocks within this many blocks of the player
const UNLOAD_BLOCKS = 4;
const SHOP_HEIGHT = 8;

// ------------------------------------------------------------ textures
function canvasTexture(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const groundTex = canvasTexture(512, 512, (g, w) => {
  const u = w / BLOCK; // pixels per world unit
  const half = (ROAD / 2) * u;
  g.fillStyle = '#9ca3af'; // sidewalk / plaza
  g.fillRect(0, 0, w, w);
  g.fillStyle = '#a8b0bb';
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) if ((i + j) % 2) g.fillRect(i * 32, j * 32, 32, 32);
  g.fillStyle = '#374151'; // asphalt at the tile edges (roads at multiples of BLOCK)
  g.fillRect(0, 0, w, half);
  g.fillRect(0, w - half, w, half);
  g.fillRect(0, 0, half, w);
  g.fillRect(w - half, 0, half, w);
  g.fillStyle = '#e5e7eb'; // curbs
  g.fillRect(half, half - 3, w - 2 * half, 3);
  g.fillRect(half, w - half, w - 2 * half, 3);
  g.fillRect(half - 3, half, 3, w - 2 * half);
  g.fillRect(w - half, half, 3, w - 2 * half);
  g.fillStyle = '#facc15'; // dashed centre lines (split across both tile edges)
  for (let p = half + 10; p < w - half - 10; p += 34) {
    g.fillRect(p, 0, 20, 2);
    g.fillRect(p, w - 2, 20, 2);
    g.fillRect(0, p, 2, 20);
    g.fillRect(w - 2, p, 2, 20);
  }
  g.fillStyle = '#f8fafc'; // crosswalks
  for (let s = -half + 4; s < half - 4; s += 9) {
    for (const edge of [half + 4, w - half - 18]) {
      g.fillRect(edge, (s + w) % w, 14, 5);
      g.fillRect((s + w) % w, edge, 5, 14);
    }
  }
});

const windowTex = canvasTexture(128, 128, (g) => {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 2; x++)
    for (let y = 0; y < 2; y++) {
      g.fillStyle = (x + y) % 3 ? '#1e3a5f' : '#2b4c7e';
      g.fillRect(x * 64 + 14, y * 64 + 12, 36, 40);
    }
});
const stripeTex = canvasTexture(64, 64, (g) => {
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? '#f8fafc' : '#dc2626';
    g.fillRect(i * 16, 0, 16, 64);
  }
});

const WALL_COLORS = ['#e2e8f0', '#fde68a', '#fecaca', '#bfdbfe', '#c7d2fe', '#d9f99d', '#fed7aa', '#e9d5ff'];
const wallMats = WALL_COLORS.map((c) => new THREE.MeshLambertMaterial({ color: c, map: windowTex }));
const roofMat = new THREE.MeshLambertMaterial({ color: '#475569' });
const doorMat = new THREE.MeshLambertMaterial({ color: '#1f2937' });
const glassMat = new THREE.MeshLambertMaterial({ color: '#7dd3fc', emissive: '#0c4a6e', emissiveIntensity: 0.25 });
const bankMat = new THREE.MeshLambertMaterial({ color: '#fef3c7' });
const brandWallMat = new THREE.MeshLambertMaterial({ color: '#f1f5f9' });
const pillarMat = new THREE.MeshLambertMaterial({ color: '#fbbf24' });
const ringMat = new THREE.MeshBasicMaterial({ color: '#facc15', transparent: true, opacity: 0.55, side: THREE.DoubleSide });
const obstacleMat = new THREE.MeshLambertMaterial({ map: stripeTex });
// Buildings between the camera and the player are swapped to this so you can see yourself.
const fadeMat = new THREE.MeshLambertMaterial({ color: '#cbd5e1', transparent: true, opacity: 0.22, depthWrite: false });
const CAR_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#f8fafc', '#8b5cf6'].map(
  (c) => new THREE.MeshLambertMaterial({ color: c }));
const tireMat = new THREE.MeshLambertMaterial({ color: '#111827' });
const cabinMat = new THREE.MeshLambertMaterial({ color: '#bae6fd' });

// Box with UVs scaled to world size so window texture tiles every 4 units.
function texturedBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const idx = f * 4 + v;
      uv.setXY(idx, uv.getX(idx) * (sizes[f][0] / 4), uv.getY(idx) * (sizes[f][1] / 4));
    }
  return g;
}

// Sign board drawn on a canvas (text is pixels — safe for user content)
function signMesh(text, { bg = '#0f172a', fg = '#fff', width = 10, height = 2.2, logo = null } = {}) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.round((512 * height) / width);
  const g = c.getContext('2d');
  const draw = (img) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = 'rgba(255,255,255,.35)';
    g.lineWidth = 6;
    g.strokeRect(3, 3, c.width - 6, c.height - 6);
    let textCenter = c.width / 2;
    if (img) {
      const s = c.height - 20;
      g.drawImage(img, c.width - s - 10, 10, s, s);
      textCenter = (c.width - s - 10) / 2;
    }
    g.fillStyle = fg;
    g.direction = 'rtl';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = Math.round(c.height * 0.5);
    do {
      g.font = `bold ${size}px Vazirmatn, Tahoma, sans-serif`;
      size -= 2;
    } while (g.measureText(text).width > (img ? c.width - c.height - 30 : c.width - 30) && size > 10);
    g.fillText(text, textCenter, c.height / 2 + 3);
  };
  draw(null);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (logo) {
    const img = new Image();
    img.onload = () => {
      draw(img);
      tex.needsUpdate = true;
    };
    img.src = logo;
  }
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  m.userData.disposeMaps = true;
  return m;
}

function disposeTree(obj, city) {
  obj.traverse((o) => {
    if (city) {
      city.solids.delete(o);
      city.faded.delete(o);
    }
    if (o.geometry && o.geometry.userData.owned) o.geometry.dispose();
    if (o.userData.disposeMaps && o.material) {
      o.material.map?.dispose();
      o.material.dispose();
    }
  });
}
const owned = (g) => {
  g.userData.owned = true;
  return g;
};

// ------------------------------------------------------------ City
export class City {
  constructor(scene) {
    this.scene = scene;
    this.blocks = new Map();      // "i,j" -> Group
    this.shopsByLot = new Map();  // "i,j,k" -> shop meta from server
    this.center = { i: NaN, j: NaN };

    const size = BLOCK * 15;
    groundTex.repeat.set(15, 15);
    groundTex.offset.set(0.5, 0.5); // tile edges (roads) land on multiples of BLOCK
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ map: groundTex }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    scene.add(this.ground);

    this.carGeo = {
      body: new THREE.BoxGeometry(CAR.width, 0.8, CAR.len),
      cabin: new THREE.BoxGeometry(CAR.width * 0.85, 0.65, CAR.len * 0.5),
      tire: new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12).rotateZ(Math.PI / 2),
    };
    this.carPool = [];
    this.cars = [];
    this.solids = new Set();   // building bodies (for camera see-through)
    this.faded = new Set();
    this.ray = new THREE.Raycaster();
  }

  // Fade buildings that hide the player from the camera.
  updateOcclusion(camPos, target) {
    const dir = camPos.clone().sub(target);
    const far = dir.length();
    this.ray.set(target, dir.normalize());
    this.ray.far = far;
    const hits = new Set(this.ray.intersectObjects([...this.solids], false).map((h) => h.object));
    // also fade a building the camera itself is inside
    for (const m of this.solids) {
      const b = m.userData.box;
      if (b && b.containsPoint(camPos)) hits.add(m);
    }
    for (const m of this.faded) if (!hits.has(m)) {
      m.material = m.userData.mat;
      m.userData.attached?.forEach((a) => (a.visible = true));
      this.faded.delete(m);
    }
    for (const m of hits) if (!this.faded.has(m)) {
      m.material = fadeMat;
      m.userData.attached?.forEach((a) => (a.visible = false));
      this.faded.add(m);
    }
  }

  addSolid(mesh) {
    mesh.userData.mat = mesh.material;
    this.solids.add(mesh);
  }

  setShops(list) {
    const before = new Set(this.shopsByLot.keys());
    this.shopsByLot.clear();
    for (const s of list) this.shopsByLot.set(`${s.block_i},${s.block_j},${s.lot}`, s);
    // rebuild visible blocks whose shops changed
    const touched = new Set();
    for (const k of new Set([...before, ...this.shopsByLot.keys()])) touched.add(k.split(',').slice(0, 2).join(','));
    for (const key of touched) this.rebuildBlock(key);
  }

  upsertShop(shop) {
    for (const [k, s] of this.shopsByLot) if (s.id === shop.id) this.shopsByLot.delete(k);
    this.shopsByLot.set(`${shop.block_i},${shop.block_j},${shop.lot}`, shop);
    this.rebuildBlock(`${shop.block_i},${shop.block_j}`);
  }

  rebuildBlock(key) {
    const g = this.blocks.get(key);
    if (!g) return;
    this.scene.remove(g);
    disposeTree(g, this);
    this.blocks.delete(key);
    const [i, j] = key.split(',').map(Number);
    this.loadBlock(i, j);
  }

  update(px, pz, tSec) {
    // ground follows the player in whole-block steps so the texture lines up
    this.ground.position.set(Math.round(px / BLOCK) * BLOCK, 0, Math.round(pz / BLOCK) * BLOCK);
    const { i, j } = blockOf(px, pz);
    if (i !== this.center.i || j !== this.center.j) {
      this.center = { i, j };
      for (let bi = i - VIEW_BLOCKS; bi <= i + VIEW_BLOCKS; bi++)
        for (let bj = j - VIEW_BLOCKS; bj <= j + VIEW_BLOCKS; bj++)
          if (!this.blocks.has(`${bi},${bj}`)) this.loadBlock(bi, bj);
      for (const [key, g] of this.blocks) {
        const [bi, bj] = key.split(',').map(Number);
        if (Math.abs(bi - i) > UNLOAD_BLOCKS || Math.abs(bj - j) > UNLOAD_BLOCKS) {
          this.scene.remove(g);
          disposeTree(g, this);
          this.blocks.delete(key);
        }
      }
    }
    this.updateCars(px, pz, tSec);
  }

  loadBlock(i, j) {
    const g = new THREE.Group();
    for (let k = 0; k < 4; k++) g.add(this.buildLot(i, j, k));
    // obstacles on this block's north road segment and west road segment
    for (const dir of ['h', 'v']) {
      const o = obstacleAt(dir, i, j);
      if (!o) continue;
      const geo = dir === 'h'
        ? new THREE.BoxGeometry(OBSTACLE.len, OBSTACLE.height, OBSTACLE.width)
        : new THREE.BoxGeometry(OBSTACLE.width, OBSTACLE.height, OBSTACLE.len);
      const m = new THREE.Mesh(owned(geo), obstacleMat);
      m.position.set(o.x, OBSTACLE.height / 2, o.z);
      m.castShadow = true;
      g.add(m);
    }
    this.scene.add(g);
    g.updateMatrixWorld(true);
    g.traverse((o) => {
      if (o.userData.solid) {
        this.addSolid(o);
        o.userData.box = new THREE.Box3().setFromObject(o);
      }
    });
    this.blocks.set(`${i},${j}`, g);
  }

  buildLot(i, j, k) {
    const g = new THREE.Group();
    const c = lotCenter(i, j, k);
    const face = lotFacing(k);
    g.position.set(c.x, 0, c.z);
    const front = (BUILDING / 2) * face; // local z of the front wall
    // Front sign over the door, plus a rooftop copy that always faces the
    // camera (which looks toward -z), so north-facing shops are readable too.
    const addSign = (makeSign, y, roofY, body) => {
      const sign = makeSign();
      sign.position.set(0, y, front + face * 0.06);
      if (face < 0) sign.rotation.y = Math.PI;
      g.add(sign);
      const roof = makeSign();
      roof.position.set(0, roofY + 1.4, 1);
      roof.rotation.x = -0.35;
      g.add(roof);
      body.userData.attached = [roof]; // hidden while the building is see-through
    };
    const addDoor = (w = 2.2, h = 3) => {
      const d = new THREE.Mesh(owned(new THREE.PlaneGeometry(w, h)), doorMat);
      d.position.set(0, h / 2, front + face * 0.05);
      if (face < 0) d.rotation.y = Math.PI;
      g.add(d);
    };
    const shopBody = (mat, h) => {
      const m = new THREE.Mesh(owned(texturedBox(BUILDING, h, BUILDING)), [mat, mat, roofMat, roofMat, mat, mat]);
      m.position.y = h / 2;
      m.castShadow = m.receiveShadow = true;
      m.userData.solid = true;
      g.add(m);
      const glass = new THREE.Mesh(owned(new THREE.PlaneGeometry(BUILDING - 2, 3.2)), glassMat);
      glass.position.set(0, 2, front + face * 0.04);
      if (face < 0) glass.rotation.y = Math.PI;
      g.add(glass);
      return m;
    };

    const type = lotType(i, j, k);
    const playerShop = this.shopsByLot.get(`${i},${j},${k}`);
    if (type.type === 'bank') {
      const body = shopBody(bankMat, 12);
      addSign(() => signMesh(`🏦 ${BANK_NAME}`, { bg: '#78350f', fg: '#fde047', width: 11, height: 2.4 }), 7.6, 12, body);
      for (const x of [-4.5, -1.5, 1.5, 4.5]) {
        const p = new THREE.Mesh(owned(new THREE.CylinderGeometry(0.35, 0.35, 6, 10)), pillarMat);
        p.position.set(x, 3, front + face * 0.9);
        g.add(p);
        body.userData.attached.push(p);
      }
      addDoor(3, 3.6);
      const ring = new THREE.Mesh(owned(new THREE.RingGeometry(BANK.depositRadius - 0.6, BANK.depositRadius - 0.2, 48)), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.03, front + face * 1.5);
      g.add(ring);
    } else if (type.type === 'brand') {
      const b = BRANDS[type.brand];
      const body = shopBody(brandWallMat, SHOP_HEIGHT);
      addSign(() => signMesh(b.name, { bg: b.color, width: 10, height: 2.2 }), SHOP_HEIGHT - 2, SHOP_HEIGHT, body);
      addDoor();
    } else if (playerShop) {
      const body = shopBody(wallMats[playerShop.id % wallMats.length], SHOP_HEIGHT);
      const logo = playerShop.has_logo ? `/api/img/shop/${playerShop.id}?v=${playerShop.logo_version}` : null;
      addSign(() => signMesh(playerShop.name, { bg: '#0f766e', width: 10, height: 2.2, logo }), SHOP_HEIGHT - 2, SHOP_HEIGHT, body);
      addDoor();
    } else {
      const h = buildingHeight(i, j, k);
      const mat = wallMats[Math.floor(hash(i, j, k) * wallMats.length)];
      const m = new THREE.Mesh(owned(texturedBox(BUILDING, h, BUILDING)), [mat, mat, roofMat, roofMat, mat, mat]);
      m.position.y = h / 2;
      m.castShadow = m.receiveShadow = true;
      m.userData.solid = true;
      g.add(m);
    }
    return g;
  }

  // ------------------------------------------------------------ traffic
  makeCar(colorIdx) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.carGeo.body, CAR_COLORS[colorIdx]);
    body.position.y = 0.75;
    body.castShadow = true;
    const cabin = new THREE.Mesh(this.carGeo.cabin, cabinMat);
    cabin.position.set(0, 1.45, -0.2);
    g.add(body, cabin);
    for (const [x, z] of [[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]]) {
      const t = new THREE.Mesh(this.carGeo.tire, tireMat);
      t.position.set(x * (CAR.width / 2), 0.38, z);
      g.add(t);
    }
    g.userData.body = body;
    return g;
  }

  updateCars(px, pz, tSec) {
    const range = BLOCK * VIEW_BLOCKS;
    const { i, j } = blockOf(px, pz);
    const list = [];
    for (let n = i - VIEW_BLOCKS; n <= i + VIEW_BLOCKS + 1; n++)
      if (isAvenue(n)) list.push(...carsOnAvenue('z', n, tSec, pz, range));
    for (let n = j - VIEW_BLOCKS; n <= j + VIEW_BLOCKS + 1; n++)
      if (isAvenue(n)) list.push(...carsOnAvenue('x', n, tSec, px, range));
    while (this.carPool.length < list.length) {
      const car = this.makeCar(0);
      this.scene.add(car);
      this.carPool.push(car);
    }
    this.carPool.forEach((car, idx) => {
      const c = list[idx];
      car.visible = !!c;
      if (!c) return;
      car.position.set(c.x, 0, c.z);
      car.rotation.y = c.axis === 'x' ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : c.dir > 0 ? 0 : Math.PI;
      car.userData.body.material = CAR_COLORS[c.color];
    });
    this.cars = list;
  }

  // Car overlapping a point? returns the car (for knockback) or null
  carHit(x, z, y) {
    if (y > CAR.height) return null;
    for (const c of this.cars) {
      const hx = (c.axis === 'x' ? CAR.len : CAR.width) / 2 + 0.4;
      const hz = (c.axis === 'x' ? CAR.width : CAR.len) / 2 + 0.4;
      if (Math.abs(x - c.x) < hx && Math.abs(z - c.z) < hz) return c;
    }
    return null;
  }
}

// ------------------------------------------------------------ collisions
// Push a circle (player) out of buildings and (when on the ground) obstacles.
export function collide(x, z, y, r = 0.5) {
  const { i, j } = blockOf(x, z);
  const half = BUILDING / 2 + r;
  for (let bi = i - 1; bi <= i + 1; bi++)
    for (let bj = j - 1; bj <= j + 1; bj++)
      for (let k = 0; k < 4; k++) {
        const c = lotCenter(bi, bj, k);
        const dx = x - c.x, dz = z - c.z;
        if (Math.abs(dx) < half && Math.abs(dz) < half) {
          const px = half - Math.abs(dx), pz = half - Math.abs(dz);
          if (px < pz) x += Math.sign(dx || 1) * px;
          else z += Math.sign(dz || 1) * pz;
        }
      }
  if (y < OBSTACLE.height - 0.1) {
    for (const o of obstaclesNear(x, z)) {
      const hx = (o.dir === 'h' ? OBSTACLE.len : OBSTACLE.width) / 2 + r;
      const hz = (o.dir === 'h' ? OBSTACLE.width : OBSTACLE.len) / 2 + r;
      const dx = x - o.x, dz = z - o.z;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
        if (o.dir === 'h') x = o.x + Math.sign(dx || 1) * hx;
        else z = o.z + Math.sign(dz || 1) * hz;
      }
    }
  }
  return { x, z };
}

export function obstaclesNear(x, z) {
  const { i, j } = blockOf(x, z);
  const out = [];
  for (let bi = i - 1; bi <= i + 1; bi++)
    for (let bj = j - 1; bj <= j + 1; bj++)
      for (const dir of ['h', 'v']) {
        const o = obstacleAt(dir, bi, bj);
        if (o && Math.abs(o.x - x) < 12 && Math.abs(o.z - z) < 12) out.push(o);
      }
  return out;
}

// Shop door the player is standing at, if any: { kind: 'brand'|'player', ... }
export function shopAt(x, z, shopsByLot, radius) {
  const { i, j } = blockOf(x, z);
  for (let bi = i - 1; bi <= i + 1; bi++)
    for (let bj = j - 1; bj <= j + 1; bj++)
      for (let k = 0; k < 4; k++) {
        const d = lotDoor(bi, bj, k);
        if (Math.hypot(d.x - x, d.z - z) > radius) continue;
        const t = lotType(bi, bj, k);
        if (t.type === 'brand') return { kind: 'brand', brand: t.brand, ...BRANDS[t.brand] };
        const s = shopsByLot.get(`${bi},${bj},${k}`);
        if (s) return { kind: 'player', shop: s };
      }
  return null;
}
