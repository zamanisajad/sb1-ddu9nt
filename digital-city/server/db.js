// SQLite data layer (better-sqlite3).
// All SQL lives in this one file and uses plain, portable SQL, so moving to
// Postgres later means rewriting only this module (see README).
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// Each entry runs once, in order; PRAGMA user_version remembers progress.
const MIGRATIONS = [
  `
  CREATE TABLE users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash   TEXT    NOT NULL,
    created_at      INTEGER NOT NULL,
    bank_fitcoin    INTEGER NOT NULL DEFAULT 0,   -- safe, only grows by deposit
    current_score   INTEGER NOT NULL DEFAULT 0,   -- un-banked, can be looted
    equipped_outfit TEXT    NOT NULL DEFAULT 'classic',
    owned_outfits   TEXT    NOT NULL DEFAULT '["classic"]',
    health          INTEGER NOT NULL DEFAULT 100,
    is_alive        INTEGER NOT NULL DEFAULT 1,
    respawn_at      INTEGER,
    last_x          REAL,
    last_y          REAL,                         -- map "y" = 3D z axis
    kills           INTEGER NOT NULL DEFAULT 0,
    deaths          INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE shops (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT    NOT NULL,
    logo          TEXT,                            -- data URL (validated, <= 300KB)
    logo_version  INTEGER NOT NULL DEFAULT 0,
    block_i       INTEGER NOT NULL,
    block_j       INTEGER NOT NULL,
    lot           INTEGER NOT NULL,
    x             REAL    NOT NULL,
    y             REAL    NOT NULL,
    created_at    INTEGER NOT NULL,
    UNIQUE (block_i, block_j, lot)
  );
  CREATE TABLE products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id       INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    title         TEXT    NOT NULL,
    image         TEXT,
    image_version INTEGER NOT NULL DEFAULT 0,
    price         INTEGER NOT NULL DEFAULT 0,
    payment_link  TEXT    NOT NULL,
    description   TEXT    NOT NULL DEFAULT '',
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );
  CREATE INDEX products_shop ON products(shop_id);
  CREATE TABLE kill_log (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    killer_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    victim_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_transferred INTEGER NOT NULL,
    created_at         INTEGER NOT NULL
  );
  CREATE INDEX kill_log_killer ON kill_log(killer_id);
  CREATE INDEX kill_log_victim ON kill_log(victim_id);
  `,
];

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 3000');
  const version = db.pragma('user_version', { simple: true });
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
  return makeRepo(db);
}

const USER_PUBLIC = `id, username, bank_fitcoin, current_score, equipped_outfit, owned_outfits,
  health, is_alive, last_x, last_y, kills, deaths`;
const SHOP_META = `s.id, s.owner_user_id, u.username AS owner, s.name, s.logo_version,
  (s.logo IS NOT NULL) AS has_logo, s.block_i, s.block_j, s.lot, s.x, s.y, s.created_at`;
const PRODUCT_META = `id, shop_id, title, price, payment_link, description, image_version,
  (image IS NOT NULL) AS has_image, created_at, updated_at`;

function makeRepo(db) {
  const q = (sql) => db.prepare(sql);
  const st = {
    createUser: q(`INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)`),
    userByName: q(`SELECT * FROM users WHERE username = ?`),
    userById: q(`SELECT ${USER_PUBLIC} FROM users WHERE id = ?`),
    setScore: q(`UPDATE users SET current_score = ? WHERE id = ?`),
    setBank: q(`UPDATE users SET bank_fitcoin = ? WHERE id = ?`),
    savePos: q(`UPDATE users SET last_x = ?, last_y = ?, health = ?, is_alive = ? WHERE id = ?`),
    setLife: q(`UPDATE users SET health = ?, is_alive = ?, respawn_at = ? WHERE id = ?`),
    addKill: q(`UPDATE users SET kills = kills + 1 WHERE id = ?`),
    addDeath: q(`UPDATE users SET deaths = deaths + 1 WHERE id = ?`),
    logKill: q(`INSERT INTO kill_log (killer_id, victim_id, amount_transferred, created_at) VALUES (?, ?, ?, ?)`),
    setOutfits: q(`UPDATE users SET owned_outfits = ?, equipped_outfit = ? WHERE id = ?`),
    leaderboard: q(`SELECT username, bank_fitcoin, kills FROM users ORDER BY bank_fitcoin DESC, id ASC LIMIT 10`),

    shopByOwner: q(`SELECT ${SHOP_META} FROM shops s JOIN users u ON u.id = s.owner_user_id WHERE s.owner_user_id = ?`),
    shopById: q(`SELECT ${SHOP_META} FROM shops s JOIN users u ON u.id = s.owner_user_id WHERE s.id = ?`),
    allShops: q(`SELECT ${SHOP_META} FROM shops s JOIN users u ON u.id = s.owner_user_id ORDER BY s.id`),
    takenLots: q(`SELECT block_i, block_j, lot FROM shops`),
    createShop: q(`INSERT INTO shops (owner_user_id, name, logo, logo_version, block_i, block_j, lot, x, y, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    renameShop: q(`UPDATE shops SET name = ? WHERE id = ?`),
    setShopLogo: q(`UPDATE shops SET logo = ?, logo_version = logo_version + 1 WHERE id = ?`),
    shopLogo: q(`SELECT logo FROM shops WHERE id = ?`),

    products: q(`SELECT ${PRODUCT_META} FROM products WHERE shop_id = ? ORDER BY id`),
    productCount: q(`SELECT COUNT(*) AS n FROM products WHERE shop_id = ?`),
    productById: q(`SELECT ${PRODUCT_META} FROM products WHERE id = ?`),
    productImage: q(`SELECT image FROM products WHERE id = ?`),
    createProduct: q(`INSERT INTO products (shop_id, title, image, image_version, price, payment_link, description, created_at, updated_at)
                      VALUES (@shop_id, @title, @image, @image_version, @price, @payment_link, @description, @now, @now)`),
    updateProduct: q(`UPDATE products SET title = @title, price = @price, payment_link = @payment_link,
                      description = @description, updated_at = @now WHERE id = @id`),
    setProductImage: q(`UPDATE products SET image = ?, image_version = image_version + 1 WHERE id = ?`),
    deleteProduct: q(`DELETE FROM products WHERE id = ?`),
  };

  const parseUser = (u) => u && { ...u, owned_outfits: JSON.parse(u.owned_outfits), is_alive: !!u.is_alive };
  const shopOut = (s) => s && { ...s, has_logo: !!s.has_logo };
  const prodOut = (p) => p && { ...p, has_image: !!p.has_image };

  return {
    raw: db,
    tx: (fn) => db.transaction(fn)(),
    close: () => db.close(),

    createUser: (username, hash) => st.createUser.run(username, hash, Date.now()).lastInsertRowid,
    userAuthByName: (username) => st.userByName.get(username),
    user: (id) => parseUser(st.userById.get(id)),
    setScore: (id, v) => st.setScore.run(v, id),
    setBank: (id, v) => st.setBank.run(v, id),
    savePos: (id, x, y, hp, alive) => st.savePos.run(x, y, hp, alive ? 1 : 0, id),
    setLife: (id, hp, alive, respawnAt) => st.setLife.run(hp, alive ? 1 : 0, respawnAt ?? null, id),
    recordKill(killerId, victimId, amount) {
      st.addKill.run(killerId);
      st.addDeath.run(victimId);
      st.logKill.run(killerId, victimId, amount, Date.now());
    },
    setOutfits: (id, owned, equipped) => st.setOutfits.run(JSON.stringify(owned), equipped, id),
    leaderboard: () => st.leaderboard.all(),

    shopByOwner: (uid) => shopOut(st.shopByOwner.get(uid)),
    shopById: (id) => shopOut(st.shopById.get(id)),
    allShops: () => st.allShops.all().map(shopOut),
    takenLots: () => new Set(st.takenLots.all().map((r) => `${r.block_i},${r.block_j},${r.lot}`)),
    createShop: (s) =>
      st.createShop.run(s.owner, s.name, s.logo, s.logo ? 1 : 0, s.i, s.j, s.k, s.x, s.y, Date.now()).lastInsertRowid,
    renameShop: (id, name) => st.renameShop.run(name, id),
    setShopLogo: (id, logo) => st.setShopLogo.run(logo, id),
    shopLogo: (id) => st.shopLogo.get(id)?.logo,

    products: (shopId) => st.products.all(shopId).map(prodOut),
    productCount: (shopId) => st.productCount.get(shopId).n,
    product: (id) => prodOut(st.productById.get(id)),
    productImage: (id) => st.productImage.get(id)?.image,
    createProduct: (p) =>
      st.createProduct.run({ ...p, image: p.image ?? null, image_version: p.image ? 1 : 0, now: Date.now() }).lastInsertRowid,
    updateProduct: (p) => st.updateProduct.run({ ...p, now: Date.now() }),
    setProductImage: (id, image) => st.setProductImage.run(image, id),
    deleteProduct: (id) => st.deleteProduct.run(id),
  };
}
