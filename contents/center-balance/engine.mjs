export const VERSION = '2.1.0';
export const ROUND_SECONDS = 20;
export const FIXED_STEP = 1 / 60;
const FALL_LIMIT = 1.05;

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
    this.nearMissTime = 0; this.combo = 0; this.events = []; this.hazards = this.makeHazards();
    this.nextWarning = 0; this.nextHazard = 0; this.lastPhase = -1;
  }
  makeHazards() {
    const result = []; let at = 3.8; let index = 0;
    const kinds = [
      { kind: 'ball', label: '큰 공이 온다!', power: .3 },
      { kind: 'gust', label: '옆바람!', power: .27 },
      { kind: 'stomp', label: '발판 충격!', power: .34 },
      { kind: 'capsule', label: '데굴데굴!', power: .31 }
    ];
    while (at < ROUND_SECONDS - .45) {
      const angle = this.random() * Math.PI * 2;
      const kind = kinds[(index + Math.floor(this.random() * kinds.length)) % kinds.length];
      const power = kind.power + this.random() * .13;
      result.push({ id: index++, at, warnAt: at - .72, x: Math.cos(angle) * power, z: Math.sin(angle) * power, ...kind });
      at += Math.max(2.35, 3.15 - index * .08 + this.random() * .55);
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
    const phase = Math.min(3, Math.floor(this.time / 5));
    if (phase !== this.lastPhase) { this.lastPhase = phase; this.events.push({ type: 'phase', phase }); }
    const amp = lerp(.014, .07, progress);
    const autoX = Math.sin(this.time * 1.35 + .7) * amp + Math.sin(this.time * 2.83) * amp * .3;
    const autoZ = Math.sin(this.time * 1.03 + 2.1) * amp * .82 + Math.sin(this.time * 2.37 + .4) * amp * .25;
    this.platformX = autoX - this.controlX * .2;
    this.platformZ = autoZ - this.controlZ * .17;
    while (this.nextWarning < this.hazards.length && this.time >= this.hazards[this.nextWarning].warnAt) {
      this.events.push({ type: 'warning', ...this.hazards[this.nextWarning++] });
    }
    while (this.nextHazard < this.hazards.length && this.time >= this.hazards[this.nextHazard].at) {
      const hazard = this.hazards[this.nextHazard++]; this.velocityX += hazard.x * (1 + progress * .48); this.velocityZ += hazard.z * (1 + progress * .48);
      this.events.push({ type: 'impact', ...hazard });
    }
    const instability = .58 + progress * 1.35;
    const controlPower = 2.65;
    const damping = 2.08;
    const noiseX = Math.sin(this.time * 3.31 + hashSeed(this.seed) % 19) * .015 * progress;
    const noiseZ = Math.sin(this.time * 2.73 + hashSeed(this.seed) % 13) * .014 * progress;
    const accelX = this.leanX * instability + autoZ * 1.45 - this.controlX * controlPower + noiseX - this.velocityX * damping;
    const accelZ = this.leanZ * instability - autoX * 1.45 - this.controlZ * controlPower + noiseZ - this.velocityZ * damping;
    this.velocityX += accelX * dt; this.velocityZ += accelZ * dt;
    this.leanX += this.velocityX * dt; this.leanZ += this.velocityZ * dt;
    const danger = Math.hypot(this.leanX, this.leanZ) / FALL_LIMIT;
    this.maxDanger = Math.max(this.maxDanger, danger);
    if (danger > .63) { this.wasDangerous = true; this.nearMissTime += dt; }
    if (this.wasDangerous && danger < .32) { this.wasDangerous = false; this.recoveries++; this.combo++; this.events.push({ type: 'recovery', count: this.recoveries, combo: this.combo }); }
    this.score = Math.floor(this.time * 100 + this.recoveries * 350 + this.nearMissTime * 130);
    if (danger >= 1) this.finish('fall');
    else if (this.time >= ROUND_SECONDS) { this.time = ROUND_SECONDS; this.score += 1000; this.finish('clear'); }
  }
  finish(reason) { if (this.state === 'ended') return; this.state = 'ended'; this.reason = reason; this.events.push({ type: 'end', reason }); }
  snapshot() { return { version: VERSION, seed: this.seed, state: this.state, time: +this.time.toFixed(3), score: this.score, reason: this.reason, recoveries: this.recoveries, combo: this.combo, danger: Math.min(1, Math.hypot(this.leanX, this.leanZ) / FALL_LIMIT), leanX: this.leanX, leanZ: this.leanZ, velocityX: this.velocityX, velocityZ: this.velocityZ, platformX: this.platformX, platformZ: this.platformZ }; }
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
