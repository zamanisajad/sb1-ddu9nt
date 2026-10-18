// Auth tokens, rate limiting and input validation.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { parseCookie } from 'cookie';

export const COOKIE_NAME = 'dc_session';
const TOKEN_TTL_SEC = 7 * 24 * 3600;

// JWT secret: JWT_SECRET env var in production. Otherwise a random secret is
// generated once and kept next to the database so restarts don't log everyone out.
export function loadSecret(dataDir) {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(dataDir, '.jwt-secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    const s = crypto.randomBytes(48).toString('hex');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, s, { mode: 0o600 });
    return s;
  }
}

export function makeAuth(secret, { secureCookies }) {
  const sign = (uid) => jwt.sign({ uid }, secret, { expiresIn: TOKEN_TTL_SEC, algorithm: 'HS256' });
  const verify = (token) => {
    try {
      const p = jwt.verify(token, secret, { algorithms: ['HS256'] });
      return Number.isInteger(p.uid) ? p.uid : null;
    } catch {
      return null;
    }
  };
  const uidFromCookieHeader = (header) => {
    if (!header) return null;
    const token = parseCookie(header)[COOKIE_NAME];
    return token ? verify(token) : null;
  };
  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies,
    maxAge: TOKEN_TTL_SEC * 1000,
    path: '/',
  };
  return {
    sign,
    uidFromCookieHeader,
    setCookie: (res, uid) => res.cookie(COOKIE_NAME, sign(uid), cookieOpts),
    clearCookie: (res) => res.clearCookie(COOKIE_NAME, { ...cookieOpts, maxAge: undefined }),
    requireUser: (req, res, next) => {
      const uid = uidFromCookieHeader(req.headers.cookie);
      if (!uid) return res.status(401).json({ error: 'ابتدا وارد حساب شوید' });
      req.uid = uid;
      next();
    },
  };
}

// Fixed-window counter: allows `max` hits per `windowMs` per key.
export class RateLimiter {
  constructor(max, windowMs) {
    this.max = max;
    this.windowMs = windowMs;
    this.hits = new Map();
    this.timer = setInterval(() => this.sweep(), windowMs).unref();
  }
  sweep() {
    const now = Date.now();
    for (const [k, v] of this.hits) if (v.reset <= now) this.hits.delete(k);
  }
  hit(key) {
    const now = Date.now();
    let e = this.hits.get(key);
    if (!e || e.reset <= now) {
      e = { n: 0, reset: now + this.windowMs };
      this.hits.set(key, e);
    }
    e.n++;
    return e.n <= this.max;
  }
  blocked(key) {
    const e = this.hits.get(key);
    return !!e && e.reset > Date.now() && e.n >= this.max;
  }
  reset(key) {
    this.hits.delete(key);
  }
  stop() {
    clearInterval(this.timer);
  }
}

// ---------------------------------------------------------------- validation
export class InputError extends Error {}

// Trim, strip control/bidi-override characters, and enforce length.
export function cleanText(v, { min = 0, max, field }) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') throw new InputError(`${field} نامعتبر است`);
  const s = v.replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length < min) throw new InputError(`${field} باید حداقل ${min} کاراکتر باشد`);
  if (s.length > max) throw new InputError(`${field} حداکثر ${max} کاراکتر است`);
  return s;
}

export function cleanUrl(v) {
  if (typeof v !== 'string' || v.length > 500) throw new InputError('لینک پرداخت نامعتبر است');
  let u;
  try {
    u = new URL(v.trim());
  } catch {
    throw new InputError('لینک پرداخت باید یک آدرس کامل باشد (با https://)');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new InputError('لینک پرداخت فقط http یا https می‌تواند باشد');
  return u.toString();
}

export function cleanPrice(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 1e12) throw new InputError('قیمت باید یک عدد صحیح مثبت باشد');
  return n;
}

// Images arrive as data URLs already resized on the client (max 256px).
// Accept only JPEG/PNG/WebP, check magic bytes, cap at 300KB decoded.
export const MAX_IMAGE_BYTES = 300 * 1024;
const MAGIC = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};
export function cleanImage(v) {
  if (v === undefined || v === null || v === '') return null;
  const m = typeof v === 'string' && /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(v);
  if (!m) throw new InputError('فقط عکس JPEG، PNG یا WebP پذیرفته می‌شود');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_IMAGE_BYTES) throw new InputError('حجم عکس حداکثر ۳۰۰ کیلوبایت است');
  if (!MAGIC[m[1]](buf)) throw new InputError('فایل عکس معتبر نیست');
  return `data:${m[1]};base64,${m[2]}`;
}
export function decodeImage(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || '');
  return m ? { type: m[1], buf: Buffer.from(m[2], 'base64') } : null;
}
