// REST API: accounts, bank, outfits, player shops and products.
import express from 'express';
import bcrypt from 'bcryptjs';
import {
  RateLimiter, InputError, cleanText, cleanUrl, cleanPrice, cleanImage, decodeImage,
} from './security.js';
import { OUTFITS, SHOP, USERNAME_RE, lotDoor, shopSlotOrder } from '../shared/world.js';

const BCRYPT_ROUNDS = 12;
// Compared against when a username doesn't exist, so the response takes the
// same time either way (doesn't leak which usernames exist).
let dummyHash = null;

export function apiRouter({ repo, auth, game }) {
  const r = express.Router();
  const loginByIp = new RateLimiter(30, 10 * 60 * 1000);
  const loginFailsByName = new RateLimiter(8, 10 * 60 * 1000);
  const registerByIp = new RateLimiter(10, 60 * 60 * 1000);
  const writesByUser = new RateLimiter(60, 60 * 1000);
  r.limiters = [loginByIp, loginFailsByName, registerByIp, writesByUser];

  // State-changing requests must be JSON: an HTML form on another site can't
  // send that without a CORS preflight, which we never allow (CSRF guard).
  r.use((req, res, next) => {
    if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && !req.is('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
    next();
  });

  const writeLimit = (req, res, next) =>
    writesByUser.hit(req.uid) ? next() : res.status(429).json({ error: 'درخواست‌ها بیش از حد مجاز است؛ کمی صبر کنید' });

  // ------------------------------------------------------------ auth
  r.post('/auth/register', async (req, res) => {
    if (!registerByIp.hit(req.ip)) return res.status(429).json({ error: 'تعداد ثبت‌نام از این آدرس زیاد است' });
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
      return res.status(400).json({ error: 'نام کاربری ۳ تا ۲۰ کاراکتر و فقط حروف، عدد و _ باشد' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: 'رمز عبور باید ۸ تا ۷۲ کاراکتر باشد' });
    }
    if (repo.userAuthByName(username)) return res.status(409).json({ error: 'این نام کاربری قبلاً گرفته شده' });
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    let id;
    try {
      id = Number(repo.createUser(username, hash));
    } catch (e) {
      if (String(e.code).startsWith('SQLITE_CONSTRAINT')) return res.status(409).json({ error: 'این نام کاربری قبلاً گرفته شده' });
      throw e;
    }
    auth.setCookie(res, id);
    res.status(201).json({ ok: true });
  });

  r.post('/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || password.length > 200) {
      return res.status(400).json({ error: 'نام کاربری و رمز عبور لازم است' });
    }
    const nameKey = username.toLowerCase();
    if (!loginByIp.hit(req.ip) || loginFailsByName.blocked(nameKey)) {
      return res.status(429).json({ error: 'تلاش‌های ناموفق زیاد بود؛ ۱۰ دقیقه دیگر امتحان کنید' });
    }
    const u = repo.userAuthByName(username);
    dummyHash ??= await bcrypt.hash('not-a-real-password', BCRYPT_ROUNDS);
    const ok = await bcrypt.compare(password, u ? u.password_hash : dummyHash);
    if (!u || !ok) {
      loginFailsByName.hit(nameKey);
      return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }
    loginFailsByName.reset(nameKey);
    auth.setCookie(res, u.id);
    res.json({ ok: true });
  });

  r.post('/auth/logout', (req, res) => {
    auth.clearCookie(res);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------ me
  r.get('/me', auth.requireUser, (req, res) => {
    const u = repo.user(req.uid);
    if (!u) {
      auth.clearCookie(res);
      return res.status(401).json({ error: 'حساب پیدا نشد' });
    }
    res.json({
      id: u.id, username: u.username, bank: u.bank_fitcoin, score: u.current_score,
      outfit: u.equipped_outfit, owned: u.owned_outfits, kills: u.kills, deaths: u.deaths,
      shop: repo.shopByOwner(u.id) || null, online: game.onlineCount(),
    });
  });

  r.get('/leaderboard', (req, res) => res.json(repo.leaderboard()));

  // ------------------------------------------------------------ bank
  r.post('/bank/deposit', auth.requireUser, writeLimit, (req, res) => {
    const out = game.deposit(req.uid);
    if (out.error) return res.status(out.status).json({ error: out.error });
    res.json(out);
  });

  // ------------------------------------------------------------ outfits
  r.post('/outfits/buy', auth.requireUser, writeLimit, (req, res) => {
    const outfit = OUTFITS.find((o) => o.id === req.body?.id);
    if (!outfit) return res.status(400).json({ error: 'لباس پیدا نشد' });
    const result = repo.tx(() => {
      const u = repo.user(req.uid);
      if (u.owned_outfits.includes(outfit.id)) return { error: 'این لباس را قبلاً خریده‌اید', status: 409 };
      if (u.bank_fitcoin < outfit.price) return { error: 'فیت‌کوین بانکی کافی نیست', status: 402 };
      const bank = u.bank_fitcoin - outfit.price;
      repo.setBank(u.id, bank);
      repo.setOutfits(u.id, [...u.owned_outfits, outfit.id], outfit.id);
      return { bank, owned: [...u.owned_outfits, outfit.id], outfit: outfit.id };
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    game.bankChanged(req.uid, result.bank);
    game.outfitChanged(req.uid, result.outfit);
    res.json(result);
  });

  r.post('/outfits/equip', auth.requireUser, writeLimit, (req, res) => {
    const u = repo.user(req.uid);
    const id = req.body?.id;
    if (!u.owned_outfits.includes(id)) return res.status(403).json({ error: 'این لباس را ندارید' });
    repo.setOutfits(u.id, u.owned_outfits, id);
    game.outfitChanged(u.id, id);
    res.json({ outfit: id });
  });

  // ------------------------------------------------------------ shops (public)
  r.get('/shops', (req, res) => res.json(repo.allShops()));

  r.get('/shops/:id', (req, res) => {
    const shop = repo.shopById(Number(req.params.id));
    if (!shop) return res.status(404).json({ error: 'مغازه پیدا نشد' });
    res.json({ shop, products: repo.products(shop.id) });
  });

  // Images are stored as data URLs but served as real image responses.
  const sendImage = (res, dataUrl) => {
    const img = decodeImage(dataUrl);
    if (!img) return res.status(404).end();
    res.set('Content-Type', img.type);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Content-Security-Policy', "default-src 'none'");
    res.send(img.buf);
  };
  r.get('/img/shop/:id', (req, res) => sendImage(res, repo.shopLogo(Number(req.params.id))));
  r.get('/img/product/:id', (req, res) => sendImage(res, repo.productImage(Number(req.params.id))));

  // ------------------------------------------------------------ my shop
  const myShop = (req, res) => {
    const shop = repo.shopByOwner(req.uid);
    if (!shop) res.status(404).json({ error: 'هنوز مغازه‌ای نخریده‌اید' });
    return shop;
  };
  const broadcastShop = (id) => game.io.emit('shop:changed', repo.shopById(id));

  r.post('/shop', auth.requireUser, writeLimit, (req, res) => {
    const name = cleanText(req.body?.name, { min: 2, max: 30, field: 'نام مغازه' });
    const logo = cleanImage(req.body?.logo);
    const result = repo.tx(() => {
      if (repo.shopByOwner(req.uid)) return { error: 'شما قبلاً یک مغازه دارید', status: 409 };
      const u = repo.user(req.uid);
      // Paid from the bank only: un-banked score is not real money yet.
      if (u.bank_fitcoin < SHOP.price) return { error: `برای خرید مغازه ${SHOP.price} فیت‌کوین بانکی لازم است`, status: 402 };
      const taken = repo.takenLots();
      let slot = null;
      for (const s of shopSlotOrder()) {
        if (!taken.has(`${s.i},${s.j},${s.k}`)) {
          slot = s;
          break;
        }
      }
      if (!slot) return { error: 'جای خالی در شهر نمانده', status: 503 };
      const door = lotDoor(slot.i, slot.j, slot.k);
      const id = Number(repo.createShop({ owner: req.uid, name, logo, ...slot, x: door.x, y: door.z }));
      const bank = u.bank_fitcoin - SHOP.price;
      repo.setBank(req.uid, bank);
      return { id, bank };
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    game.bankChanged(req.uid, result.bank);
    broadcastShop(result.id);
    res.status(201).json({ shop: repo.shopById(result.id), bank: result.bank });
  });

  r.put('/shop', auth.requireUser, writeLimit, (req, res) => {
    const shop = myShop(req, res);
    if (!shop) return;
    if (req.body?.name !== undefined) repo.renameShop(shop.id, cleanText(req.body.name, { min: 2, max: 30, field: 'نام مغازه' }));
    if (req.body?.logo !== undefined) repo.setShopLogo(shop.id, cleanImage(req.body.logo));
    broadcastShop(shop.id);
    res.json({ shop: repo.shopById(shop.id) });
  });

  const productFields = (b) => ({
    title: cleanText(b?.title, { min: 1, max: 60, field: 'عنوان محصول' }),
    price: cleanPrice(b?.price),
    payment_link: cleanUrl(b?.payment_link),
    description: cleanText(b?.description, { max: 300, field: 'توضیحات' }),
  });

  r.post('/shop/products', auth.requireUser, writeLimit, (req, res) => {
    const shop = myShop(req, res);
    if (!shop) return;
    if (repo.productCount(shop.id) >= SHOP.maxProducts) {
      return res.status(400).json({ error: `حداکثر ${SHOP.maxProducts} محصول مجاز است` });
    }
    const fields = productFields(req.body);
    const image = cleanImage(req.body?.image);
    const id = Number(repo.createProduct({ shop_id: shop.id, ...fields, image }));
    res.status(201).json({ product: repo.product(id) });
  });

  const ownProduct = (req, res) => {
    const shop = myShop(req, res);
    if (!shop) return null;
    const product = repo.product(Number(req.params.id));
    if (!product || product.shop_id !== shop.id) {
      res.status(404).json({ error: 'محصول پیدا نشد' });
      return null;
    }
    return product;
  };

  r.put('/shop/products/:id', auth.requireUser, writeLimit, (req, res) => {
    const product = ownProduct(req, res);
    if (!product) return;
    repo.updateProduct({ id: product.id, ...productFields(req.body) });
    if (req.body?.image !== undefined) repo.setProductImage(product.id, cleanImage(req.body.image));
    res.json({ product: repo.product(product.id) });
  });

  r.delete('/shop/products/:id', auth.requireUser, writeLimit, (req, res) => {
    const product = ownProduct(req, res);
    if (!product) return;
    repo.deleteProduct(product.id);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------ errors
  r.use((err, req, res, next) => {
    if (err instanceof InputError) return res.status(400).json({ error: err.message });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'حجم درخواست زیاد است' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON نامعتبر' });
    console.error('[api]', err);
    res.status(500).json({ error: 'خطای سرور' });
  });

  return r;
}
