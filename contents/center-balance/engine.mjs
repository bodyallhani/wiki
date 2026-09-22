export const VERSION = '1.0.0';
export const ROUND_SECONDS = 30;
export const FIXED_STEP = 1 / 60;

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;

function hashSeed(value) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function randomFactory(seed) {
  let a = hashSeed(seed) || 0x9e3779b9;
  return () => {
    a |= 0; a = a + 0x6d2b79f5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function validSeed(value) { return typeof value === 'string' && /^[a-zA-Z0-9_-]{4,42}$/.test(value); }

export class BalanceGame {
  constructor(seed) {
    if (!validSeed(seed)) throw new Error('Invalid challenge seed');
    this.seed = seed; this.random = randomFactory(seed); this.reset();
  }
  reset() {
    this.time = 0; this.state = 'ready'; this.leanX = 0; this.leanZ = 0; this.velocityX = 0; this.velocityZ = 0;
    this.platformX = 0; this.platformZ = 0; this.controlX = 0; this.controlZ = 0; this.recoveries = 0;
    this.maxDanger = 0; this.wasDangerous = false; this.score = 0; this.reason = null; this.accumulator = 0;
    this.events = []; this.gusts = this.makeGusts(); this.nextGust = 0; this.lastPhase = -1;
  }
  makeGusts() {
    const result = []; let at = 4.8;
    while (at < ROUND_SECONDS) {
      const angle = this.random() * Math.PI * 2;
      result.push({ at, x: Math.cos(angle) * (.32 + this.random() * .32), z: Math.sin(angle) * (.24 + this.random() * .28), label: this.random() > .5 ? '급정거!' : '옆바람!' });
      at += 2.1 + this.random() * 1.8;
    }
    return result;
  }
  start() { if (this.state === 'ready' || this.state === 'paused') this.state = 'playing'; }
  pause() { if (this.state === 'playing') this.state = 'paused'; }
  setControl(x, z) { this.controlX = clamp(Number(x) || 0, -1, 1); this.controlZ = clamp(Number(z) || 0, -1, 1); }
  advance(delta) {
    if (this.state !== 'playing') return [];
    this.accumulator += clamp(delta, 0, .12);
    while (this.accumulator >= FIXED_STEP && this.state === 'playing') { this.step(FIXED_STEP); this.accumulator -= FIXED_STEP; }
    const events = this.events; this.events = []; return events;
  }
  step(dt) {
    this.time += dt;
    const progress = clamp(this.time / ROUND_SECONDS, 0, 1);
    const phase = Math.min(2, Math.floor(this.time / 10));
    if (phase !== this.lastPhase) { this.lastPhase = phase; this.events.push({ type: 'phase', phase }); }
    const amp = lerp(.032, .17, progress);
    this.platformX = Math.sin(this.time * 1.18 + .7) * amp + Math.sin(this.time * 2.47) * amp * .32;
    this.platformZ = Math.sin(this.time * .91 + 2.1) * amp * .82 + Math.sin(this.time * 2.13 + .4) * amp * .28;
    while (this.nextGust < this.gusts.length && this.time >= this.gusts[this.nextGust].at) {
      const gust = this.gusts[this.nextGust++]; this.velocityX += gust.x * (1 + progress * .55); this.velocityZ += gust.z * (1 + progress * .55);
      this.events.push({ type: 'gust', ...gust });
    }
    const instability = 1.35 + progress * 2.95;
    const controlPower = 3.25 - progress * .28;
    const damping = 1.42;
    const noiseX = Math.sin(this.time * 3.31 + hashSeed(this.seed) % 19) * .028 * progress;
    const noiseZ = Math.sin(this.time * 2.73 + hashSeed(this.seed) % 13) * .026 * progress;
    const accelX = this.leanX * instability + this.platformZ * 2.15 - this.controlX * controlPower + noiseX - this.velocityX * damping;
    const accelZ = this.leanZ * instability - this.platformX * 2.15 - this.controlZ * controlPower + noiseZ - this.velocityZ * damping;
    this.velocityX += accelX * dt; this.velocityZ += accelZ * dt;
    this.leanX += this.velocityX * dt; this.leanZ += this.velocityZ * dt;
    const danger = Math.hypot(this.leanX, this.leanZ) / .88;
    this.maxDanger = Math.max(this.maxDanger, danger);
    if (danger > .7) this.wasDangerous = true;
    if (this.wasDangerous && danger < .34) { this.wasDangerous = false; this.recoveries++; this.events.push({ type: 'recovery', count: this.recoveries }); }
    this.score = Math.floor(this.time * 100 + this.recoveries * 250);
    if (danger >= 1) this.finish('fall');
    else if (this.time >= ROUND_SECONDS) { this.time = ROUND_SECONDS; this.score += 1000; this.finish('clear'); }
  }
  finish(reason) { if (this.state === 'ended') return; this.state = 'ended'; this.reason = reason; this.events.push({ type: 'end', reason }); }
  snapshot() { return { version: VERSION, seed: this.seed, state: this.state, time: +this.time.toFixed(3), score: this.score, reason: this.reason, recoveries: this.recoveries, danger: Math.min(1, Math.hypot(this.leanX, this.leanZ) / .88), leanX: this.leanX, leanZ: this.leanZ, velocityX: this.velocityX, velocityZ: this.velocityZ, platformX: this.platformX, platformZ: this.platformZ }; }
}

export function encodeReplay(samples) {
  const bytes = new Uint8Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.round((clamp(samples[i][0], -1, 1) + 1) * 7.5);
    const z = Math.round((clamp(samples[i][1], -1, 1) + 1) * 7.5);
    bytes[i] = (x << 4) | z;
  }
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeReplay(value) {
  if (typeof value !== 'string' || !/^[\w-]{1,600}$/.test(value)) return [];
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    if (binary.length > 320) return [];
    return Array.from(binary, c => { const byte = c.charCodeAt(0); return [((byte >> 4) / 7.5) - 1, ((byte & 15) / 7.5) - 1]; });
  } catch { return []; }
}
