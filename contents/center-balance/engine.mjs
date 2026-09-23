export const VERSION = '3.1.0';
export const FIXED_STEP = 1 / 60;
export const MAX_LOAD = 1;
export const RESCUE_SECONDS = 2.2;

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

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

export class TowerGame {
  constructor(seed) {
    if (!validSeed(seed)) throw new Error('Invalid challenge seed');
    this.seed = seed;
    this.random = randomFactory(seed);
    this.reset();
  }

  reset() {
    const slopeDirection = this.random() > .5 ? 1 : -1;
    this.initialSlope = slopeDirection * (.018 + this.random() * .016);
    this.baseSlope = this.initialSlope;
    this.transientLean = 0;
    this.time = 0;
    this.state = 'ready';
    this.reason = null;
    this.level = 0;
    this.score = 0;
    this.perfects = 0;
    this.combo = 0;
    this.recoveries = 0;
    this.maxLoad = 0;
    this.maxLean = Math.abs(this.baseSlope);
    this.overloadTime = 0;
    this.dangerActive = false;
    this.lean = this.baseSlope;
    this.leanVelocity = 0;
    this.targetLean = this.baseSlope;
    this.strain = 0;
    this.load = Math.abs(this.lean) * 2;
    this.previousLoad = this.load;
    this.blocks = [{ x: 0, width: 3.25, hue: 0, base: true }];
    this.mover = null;
    this.hazard = null;
    this.accumulator = 0;
    this.events = [];
    this.lockout = 0;
    this.spawnMover();
  }

  start() { if (this.state === 'ready' || this.state === 'paused') this.state = 'playing'; }
  pause() { if (this.state === 'playing') this.state = 'paused'; }

  spawnMover() {
    const direction = (this.level + (hashSeed(this.seed) & 1)) % 2 ? 1 : -1;
    const width = Math.max(1.34, 2.32 - this.level * .043);
    this.mover = {
      x: direction * 3.45,
      direction: -direction,
      width,
      speed: Math.min(5.15, 2.18 + this.level * .12),
      hue: (this.level * 47 + hashSeed(this.seed)) % 360
    };
    this.scheduleHazard();
  }

  scheduleHazard() {
    if (this.hazard || this.level < 4) return;
    const due = this.level === 4 || (this.level > 4 && (this.level - 4) % 3 === 0);
    if (!due) return;
    const sequence = Math.floor((this.level - 4) / 3);
    const kind = ['tilt', 'settle', 'gust'][sequence % 3];
    const direction = ((hashSeed(this.seed) + sequence * 13) & 1) ? 1 : -1;
    const tier = Math.floor(sequence / 3);
    this.hazard = {
      kind, direction, phase: 'warning', remaining: kind === 'tilt' && this.level === 4 ? 1.2 : .9,
      duration: kind === 'gust' ? 1.8 : .75,
      magnitude: kind === 'tilt' ? Math.min(.058 + tier * .009, .085) : kind === 'settle' ? Math.min(.13 + tier * .025, .22) : Math.min(.065 + tier * .012, .1),
      applied: false
    };
    this.events.push({ type: 'hazardWarning', kind, direction, level: this.level });
  }

  effectiveSlope() { return this.baseSlope + this.transientLean; }

  structuralLean(blocks = this.blocks) {
    let weightedX = 0;
    let totalWeight = 0;
    for (let i = 1; i < blocks.length; i++) {
      const weight = 1 + i * .22;
      weightedX += blocks[i].x * weight;
      totalWeight += weight;
    }
    const center = totalWeight ? weightedX / totalWeight : 0;
    const top = blocks.at(-1)?.x || 0;
    const lower = blocks.length > 2 ? blocks.at(-2).x : 0;
    const localKink = top - lower;
    return clamp(this.effectiveSlope() + center * .082 + localKink * .034, -.31, .31);
  }

  idealX() {
    const support = this.blocks.at(-1);
    let weightedX = 0;
    let totalWeight = 0;
    for (let i = 1; i < this.blocks.length; i++) {
      const weight = 1 + i * .22;
      weightedX += this.blocks[i].x * weight;
      totalWeight += weight;
    }
    const newWeight = 1 + this.blocks.length * .22;
    const desired = -(weightedX + this.effectiveSlope() / .082 * Math.max(1, totalWeight)) / newWeight;
    const reach = (support.width + this.mover.width) * .5 - .42;
    return clamp(clamp(desired, support.x - reach, support.x + reach), -3.42, 3.42);
  }

  place() {
    if (this.state !== 'playing' || this.lockout > 0 || !this.mover) return [];
    const support = this.blocks.at(-1);
    let x = this.mover.x;
    const distance = Math.abs(x - support.x);
    const overlap = (support.width + this.mover.width) * .5 - distance;
    if (overlap < .38) {
      this.finish('miss');
      return this.flushEvents();
    }

    const ideal = this.idealX();
    if (this.level < 2 && Math.abs(x - ideal) < .18) x = ideal;
    const before = this.load;
    const block = { x: +x.toFixed(4), width: this.mover.width, hue: this.mover.hue };
    this.blocks.push(block);
    this.level++;
    this.targetLean = this.structuralLean();
    const projected = clamp(Math.abs(this.targetLean) / .22, 0, 1.4);
    const accuracy = Math.abs(x - ideal);
    const perfect = accuracy < .085;
    if (perfect) { this.perfects++; this.combo++; }
    else this.combo = 0;
    const recovery = before >= .45 && projected <= before - .18;
    if (recovery) this.recoveries++;
    this.score += 100 + (perfect ? 120 + this.combo * 20 : 0) + (recovery ? 350 + Math.round(before * 300) : 0);
    this.events.push({ type: 'placed', block, level: this.level, perfect, accuracy, ideal, recovery, loadBefore: before, projectedLoad: projected });
    if (perfect) this.events.push({ type: 'perfect', combo: this.combo });
    if (recovery) this.events.push({ type: 'recovery', count: this.recoveries, from: before, to: projected });
    this.lockout = .26;
    this.spawnMover();
    return this.flushEvents();
  }

  advance(delta) {
    if (this.state !== 'playing') return [];
    this.accumulator += clamp(delta, 0, .12);
    while (this.accumulator >= FIXED_STEP && this.state === 'playing') {
      this.step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
    return this.flushEvents();
  }

  stepHazard(dt) {
    if (!this.hazard) { this.transientLean *= Math.max(0, 1 - dt * 5); return; }
    const hazard = this.hazard;
    hazard.remaining -= dt;
    if (hazard.phase === 'warning') {
      if (hazard.remaining <= 0) {
        hazard.phase = 'active';
        hazard.remaining = hazard.duration;
        this.events.push({ type: 'hazardStart', kind: hazard.kind, direction: hazard.direction });
        if (hazard.kind === 'tilt') {
          this.baseSlope = clamp(this.baseSlope + hazard.direction * hazard.magnitude, -.13, .13);
          hazard.applied = true;
        } else if (hazard.kind === 'settle') {
          const top = this.blocks.at(-1);
          top.x = +(top.x + hazard.direction * hazard.magnitude).toFixed(4);
          hazard.applied = true;
          this.events.push({ type: 'settled', x: top.x, direction: hazard.direction });
        }
      }
      return;
    }
    if (hazard.kind === 'gust') {
      const progress = 1 - Math.max(0, hazard.remaining) / hazard.duration;
      this.transientLean = hazard.direction * hazard.magnitude * Math.sin(progress * Math.PI);
    }
    if (hazard.remaining <= 0) {
      const ended = hazard.kind;
      this.transientLean = 0;
      this.hazard = null;
      this.events.push({ type: 'hazardEnd', kind: ended });
    }
  }

  step(dt) {
    this.time += dt;
    this.lockout = Math.max(0, this.lockout - dt);
    this.stepHazard(dt);
    if (this.lockout <= 0 && this.mover) {
      this.mover.x += this.mover.direction * this.mover.speed * dt;
      if (this.mover.x > 3.48) { this.mover.x = 3.48; this.mover.direction = -1; }
      if (this.mover.x < -3.48) { this.mover.x = -3.48; this.mover.direction = 1; }
    }

    this.targetLean = this.structuralLean();
    const spring = (this.targetLean - this.lean) * 10.5;
    this.leanVelocity += (spring - this.leanVelocity * 5.1) * dt;
    this.lean += this.leanVelocity * dt;
    const instant = Math.abs(this.lean) / .22;
    if (instant > .19) this.strain += (instant - .16) * dt * .21;
    else this.strain -= dt * .14;
    this.strain = clamp(this.strain, 0, 1);
    this.previousLoad = this.load;
    this.load = clamp(instant * .72 + this.strain * .67, 0, 1.15);
    const wasDanger = this.dangerActive;
    if (this.load > .72) this.overloadTime += dt;
    else if (this.load < .61) this.overloadTime = Math.max(0, this.overloadTime - dt * 2.35);
    this.dangerActive = this.overloadTime > .03;
    if (!wasDanger && this.dangerActive) this.events.push({ type: 'rescueStart', seconds: RESCUE_SECONDS });
    if (wasDanger && !this.dangerActive) this.events.push({ type: 'rescueClear' });
    this.maxLoad = Math.max(this.maxLoad, this.load);
    this.maxLean = Math.max(this.maxLean, Math.abs(this.lean));
    this.score += dt * (8 + this.level * .55);
    if (this.overloadTime >= RESCUE_SECONDS) this.finish('overload');
    else if (Math.abs(this.lean) >= .305) this.finish('collapse');
  }

  finish(reason) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.reason = reason;
    this.events.push({ type: 'end', reason });
  }

  flushEvents() { const events = this.events; this.events = []; return events; }

  snapshot() {
    return {
      version: VERSION, seed: this.seed, state: this.state, reason: this.reason,
      time: +this.time.toFixed(3), level: this.level, score: Math.floor(this.score),
      perfects: this.perfects, combo: this.combo, recoveries: this.recoveries,
      lean: this.lean, targetLean: this.targetLean, load: Math.min(1, this.load),
      strain: this.strain, maxLoad: Math.min(1, this.maxLoad), maxLean: this.maxLean,
      overloadTime: this.overloadTime, dangerActive: this.dangerActive,
      dangerRemaining: Math.max(0, RESCUE_SECONDS - this.overloadTime), baseSlope: this.baseSlope,
      hazard: this.hazard ? { ...this.hazard } : null,
      mover: this.mover ? { ...this.mover } : null,
      blocks: this.blocks.map(block => ({ ...block })), idealX: this.mover ? this.idealX() : 0
    };
  }
}
