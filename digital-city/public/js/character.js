// Blocky humanoid used for every player (you and everyone else online).
import * as THREE from '/vendor/three.module.js';
import { outfitById } from '/shared/world.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const GEO = {
  head: box(0.5, 0.5, 0.5),
  torso: box(0.7, 0.8, 0.38),
  arm: box(0.22, 0.7, 0.22),
  leg: box(0.26, 0.8, 0.26),
  hat: box(0.56, 0.16, 0.56),
  brim: box(0.6, 0.05, 0.3),
  eye: box(0.08, 0.08, 0.02),
};
GEO.arm.translate(0, -0.3, 0); // pivot at shoulder
GEO.leg.translate(0, -0.4, 0); // pivot at hip
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

export function buildCharacter(outfitId) {
  const group = new THREE.Group();
  const body = new THREE.Group(); // everything that animates; group itself only moves/turns
  group.add(body);
  const mats = {
    skin: new THREE.MeshLambertMaterial(),
    shirt: new THREE.MeshLambertMaterial(),
    pants: new THREE.MeshLambertMaterial(),
    hat: new THREE.MeshLambertMaterial(),
  };
  const mesh = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    body.add(m);
    return m;
  };
  const torso = mesh(GEO.torso, mats.shirt, 0, 1.2, 0);
  const head = mesh(GEO.head, mats.skin, 0, 1.85, 0);
  const eyes = [-0.11, 0.11].map((x) => {
    const e = new THREE.Mesh(GEO.eye, eyeMat);
    e.position.set(x, 0.05, 0.26);
    head.add(e);
    return e;
  });
  const hat = new THREE.Group();
  hat.add(new THREE.Mesh(GEO.hat, mats.hat));
  const brim = new THREE.Mesh(GEO.brim, mats.hat);
  brim.position.set(0, -0.05, 0.3);
  hat.add(brim);
  hat.position.set(0, 0.32, 0);
  head.add(hat);
  const armL = mesh(GEO.arm, mats.shirt, -0.47, 1.55, 0);
  const armR = mesh(GEO.arm, mats.shirt, 0.47, 1.55, 0);
  const legL = mesh(GEO.leg, mats.pants, -0.17, 0.8, 0);
  const legR = mesh(GEO.leg, mats.pants, 0.17, 0.8, 0);

  const c = {
    group, body, head, torso, armL, armR, legL, legR, hat, eyes, mats,
    action: null, actionUntil: 0, phase: 0,
    setOutfit(id) {
      const o = outfitById(id);
      mats.skin.color.set(o.skin);
      mats.shirt.color.set(o.shirt);
      mats.pants.color.set(o.pants);
      hat.visible = !!o.hat;
      if (o.hat) mats.hat.color.set(o.hat);
    },
    setOpacity(alpha) {
      for (const m of Object.values(mats)) {
        m.transparent = alpha < 1;
        m.opacity = alpha;
      }
    },
    dispose() {
      Object.values(mats).forEach((m) => m.dispose());
    },
  };
  c.setOutfit(outfitId);
  return c;
}

// Start a short one-shot animation (punch / kick / stun)
export function playAction(c, action, now) {
  const ms = action === 'kick' ? 350 : action === 'stun' ? 600 : 250;
  c.action = action;
  c.actionUntil = now + ms;
  c.actionStart = now;
}

// Pose the character. moving: 0..1 speed fraction; airborne: in the air.
export function animate(c, { moving, airborne, dead }, dt, now) {
  const { body, armL, armR, legL, legR } = c;
  if (dead) {
    body.rotation.x += (-Math.PI / 2 - body.rotation.x) * Math.min(1, dt * 8);
    body.position.y += (0.2 - body.position.y) * Math.min(1, dt * 8);
    return;
  }
  body.rotation.x *= 1 - Math.min(1, dt * 10);
  body.position.y *= 1 - Math.min(1, dt * 10);

  c.phase += dt * (moving > 0.05 ? 11 * moving + 2 : 0);
  const swing = moving > 0.05 ? Math.sin(c.phase) * 0.9 * Math.min(1, moving * 1.4) : 0;
  let aL = swing, aR = -swing, lL = -swing, lR = swing;
  if (airborne) {
    aL = aR = -2.6;
    lL = 0.6;
    lR = -0.3;
  }
  if (c.action && now < c.actionUntil) {
    const t = (now - c.actionStart) / (c.actionUntil - c.actionStart);
    const k = Math.sin(t * Math.PI);
    if (c.action === 'punch') aR = -Math.PI / 2 * (0.4 + 0.6 * k) - 0.1;
    if (c.action === 'kick') {
      lR = -1.5 * k;
      lL = 0.2 * k;
      aL = aR = 0.6 * k;
    }
    if (c.action === 'stun') body.rotation.z = Math.sin(t * Math.PI * 6) * 0.25;
  } else {
    c.action = null;
    body.rotation.z = 0;
  }
  const ease = Math.min(1, dt * 18);
  armL.rotation.x += (aL - armL.rotation.x) * ease;
  armR.rotation.x += (aR - armR.rotation.x) * ease;
  legL.rotation.x += (lL - legL.rotation.x) * ease;
  legR.rotation.x += (lR - legR.rotation.x) * ease;
}

// Text sprite (name tags, signs). Canvas text: user names are drawn as
// pixels, never parsed as HTML, so no XSS risk.
export function textSprite(text, { color = '#fff', bg = 'rgba(15,23,42,0.75)', size = 44, height = 0.45 } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = `bold ${size}px Vazirmatn, Tahoma, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + size;
  canvas.width = w;
  canvas.height = Math.ceil(size * 1.5);
  ctx.font = font;
  ctx.direction = 'rtl';
  ctx.fillStyle = bg;
  const r = canvas.height / 2;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, canvas.height, r);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, canvas.height / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.set((height * w) / canvas.height, height, 1);
  sprite.renderOrder = 10;
  return sprite;
}

// Small health bar that floats above other players
export function healthBar() {
  const group = new THREE.Group();
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x3f1d2b, depthWrite: false }));
  bg.scale.set(1, 0.1, 1);
  const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x22c55e, depthWrite: false }));
  fg.scale.set(1, 0.1, 1);
  fg.center.set(0, 0.5);
  fg.position.x = -0.5;
  bg.renderOrder = fg.renderOrder = 11;
  group.add(bg, fg);
  return {
    group,
    set(frac) {
      const f = Math.max(0, Math.min(1, frac));
      fg.scale.x = Math.max(0.001, f);
      fg.material.color.set(f > 0.5 ? 0x22c55e : f > 0.25 ? 0xf59e0b : 0xef4444);
    },
  };
}
