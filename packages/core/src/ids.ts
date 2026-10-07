// ULID: 48-bit millisecond timestamp + 80 bits of randomness, Crockford base32.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

let lastTime = -1;
let lastRandom: number[] = [];

function randomDigits(): number[] {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b % 32);
}

/** Monotonic ULID: ids created in the same millisecond still sort in creation order. */
export function ulid(now: number = Date.now()): string {
  let random: number[];
  if (now === lastTime) {
    random = [...lastRandom];
    for (let i = random.length - 1; i >= 0; i--) {
      if (random[i]! < 31) {
        random[i]! += 1;
        break;
      }
      random[i] = 0;
    }
  } else {
    random = randomDigits();
  }
  lastTime = now;
  lastRandom = random;
  let time = '';
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  return time + random.map((d) => ALPHABET[d]).join('');
}

export const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Short human-friendly code (no ambiguous characters) for invites. */
export function shortCode(length = 8): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
