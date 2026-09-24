export const VERSION = '4.0.0';
export const FIXED_STEP = 1 / 60;
export const FATIGUE_SECONDS = 2.6;

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

export function validSeed(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{4,42}$/.test(value);
}

function massFor(index) { return 1 + index * .045; }

export class TowerGame {
  constructor(seed) {
    if (!validSeed(seed)) throw new Error('Invalid challenge seed');
    this.seed = seed;
    this.random = randomFactory(seed);
    this.reset();
  }

  reset() {
    this.time = 0;
    this.state = 'ready';
    this.reason = null;
    this.level = 0;
    this.score = 0;
    this.perfects = 0;
    this.combo = 0;
    this.recoveries = 0;
    this.maxLoad = 0;
    this.maxLean = 0;
    this.fatigueTime = 0;
    this.dangerActive = false;
    this.wobble = 0;
    this.wobbleVelocity = 0;
    this.settleLock = 0;
    this.load = 0;
    this.leftLoad = 0;
    this.rightLoad = 0;
    this.surfaceAngle = 0;
    this.stability = 1;
    this.blocks = [{
      x: 0, width: 3.35, hue: 0, base: true,
      angle: 0, y: .05, compressionLeft: 0, compressionRight: 0
    }];
    this.mover = null;
    this.accumulator = 0;
    this.events = [];
    this.lockout = 0;
    this.spawnMover();
    this.solveStack();
  }

  start() { if (this.state === 'ready' || this.state === 'paused') this.state = 'playing'; }
  pause() { if (this.state === 'playing') this.state = 'paused'; }

  spawnMover() {
    const direction = (this.level + (hashSeed(this.seed) & 1)) % 2 ? 1 : -1;
    const width = Math.max(1.28, 2.28 - this.level * .047);
    this.mover = {
      x: direction * 3.42,
      direction: -direction,
      width,
      speed: Math.min(4.75, 2.08 + this.level * .115),
      hue: (this.level * 47 + hashSeed(this.seed)) % 360
    };
  }

  analyze(candidate = null) {
    const source = candidate ? [...this.blocks, candidate] : this.blocks;
    const blocks = source.map(block => ({ ...block }));
    let minMargin = 1;
    let cumulativeAngle = 0;
    let y = .05;

    blocks[0].angle = 0;
    blocks[0].y = y;
    blocks[0].compressionLeft = 0;
    blocks[0].compressionRight = 0;

    for (let supportIndex = 0; supportIndex < blocks.length - 1; supportIndex++) {
      const support = blocks[supportIndex];
      const upper = blocks[supportIndex + 1];
      let totalMass = 0;
      let weightedX = 0;
      for (let j = supportIndex + 1; j < blocks.length; j++) {
        const mass = massFor(j);
        totalMass += mass;
        weightedX += blocks[j].x * mass;
      }
      const centerAbove = weightedX / Math.max(.001, totalMass);
      const contactHalf = Math.max(.32, Math.min(support.width, upper.width) * .5);
      const eccentricity = centerAbove - support.x;
      const normalized = eccentricity / contactHalf;
      const margin = 1 - Math.abs(normalized);
      minMargin = Math.min(minMargin, margin);

      const compliance = .0185 + Math.min(.009, totalMass * .0007);
      const localAngle = -clamp(normalized, -1.35, 1.35) * compliance;
      cumulativeAngle = clamp(cumulativeAngle + localAngle, -.235, .235);
      const compression = Math.min(.16, totalMass * .0042);
      const differential = clamp(normalized, -1, 1) * .052;
      support.compressionLeft = clamp(compression - differential, 0, .2);
      support.compressionRight = clamp(compression + differential, 0, .2);

      y += .49 - (support.compressionLeft + support.compressionRight) * .5;
      upper.angle = cumulativeAngle;
      upper.y = y;
      upper.compressionLeft = 0;
      upper.compressionRight = 0;
    }

    const torque = clamp(Math.abs(cumulativeAngle) / .11 + Math.max(0, .25 - minMargin) * .55, 0, 1.25);
    return { blocks, angle: cumulativeAngle, stability: minMargin, torque };
  }

  solveStack() {
    const solved = this.analyze();
    this.blocks = solved.blocks;
    this.surfaceAngle = solved.angle + this.wobble;
    this.stability = solved.stability;
    const physicalLoad = clamp(solved.torque + Math.abs(this.wobble) * 2.2, 0, 1.15);
    this.load += (physicalLoad - this.load) * .18;
    const rightDown = this.surfaceAngle < 0;
    const hot = clamp(this.load, 0, 1);
    const assist = hot * .3;
    this.leftLoad = rightDown ? hot : assist;
    this.rightLoad = rightDown ? assist : hot;
  }

  idealX() {
    const support = this.blocks.at(-1);
    if (!this.mover) return support.x;
    const reach = (support.width + this.mover.width) * .5 - .4;
    const low = Math.max(-3.38, support.x - reach);
    const high = Math.min(3.38, support.x + reach);
    let bestX = clamp(support.x, low, high);
    let bestCost = Infinity;
    for (let i = 0; i <= 48; i++) {
      const x = low + (high - low) * i / 48;
      const result = this.analyze({ x, width: this.mover.width, hue: this.mover.hue });
      const cost = Math.abs(result.angle) * 5 + Math.max(0, .3 - result.stability) * 2.4;
      if (cost < bestCost) { bestCost = cost; bestX = x; }
    }
    return bestX;
  }

  place() {
    if (this.state !== 'playing' || this.lockout > 0 || !this.mover) return [];
    const support = this.blocks.at(-1);
    let x = this.mover.x;
    const overlap = (support.width + this.mover.width) * .5 - Math.abs(x - support.x);
    if (overlap < .34) {
      this.finish('miss');
      return this.flushEvents();
    }

    const ideal = this.idealX();
    if (this.level < 2 && Math.abs(x - ideal) < .16) x = ideal;
    const before = this.load;
    const block = {
      x: +x.toFixed(4), width: this.mover.width, hue: this.mover.hue,
      angle: 0, y: 0, compressionLeft: 0, compressionRight: 0
    };
    const projected = this.analyze(block);
    this.blocks.push(block);
    this.level++;
    this.wobbleVelocity += clamp((x - support.x) * -.036, -.075, .075);
    this.settleLock = .58;
    this.solveStack();

    const accuracy = Math.abs(x - ideal);
    const perfect = accuracy < .082;
    if (perfect) { this.perfects++; this.combo++; } else this.combo = 0;
    const recovery = before >= .36 && projected.torque <= before - .14;
    if (recovery) this.recoveries++;
    this.score += 100 + (perfect ? 120 + this.combo * 20 : 0) + (recovery ? 380 + Math.round(before * 320) : 0);
    this.events.push({
      type: 'placed', block: { ...block }, level: this.level, perfect, accuracy, ideal,
      recovery, loadBefore: before, projectedLoad: projected.torque
    });
    if (perfect) this.events.push({ type: 'perfect', combo: this.combo });
    if (recovery) this.events.push({ type: 'recovery', count: this.recoveries, from: before, to: projected.torque });
    this.lockout = .25;
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

  step(dt) {
    this.time += dt;
    this.lockout = Math.max(0, this.lockout - dt);
    this.settleLock = Math.max(0, this.settleLock - dt);
    if (this.lockout <= 0 && this.mover) {
      this.mover.x += this.mover.direction * this.mover.speed * dt;
      if (this.mover.x > 3.46) { this.mover.x = 3.46; this.mover.direction = -1; }
      if (this.mover.x < -3.46) { this.mover.x = -3.46; this.mover.direction = 1; }
    }

    const spring = -this.wobble * 31;
    this.wobbleVelocity += (spring - this.wobbleVelocity * 6.4) * dt;
    this.wobble += this.wobbleVelocity * dt;
    if (Math.abs(this.wobble) < .00005 && Math.abs(this.wobbleVelocity) < .0001) {
      this.wobble = 0;
      this.wobbleVelocity = 0;
    }

    const wasDanger = this.dangerActive;
    this.solveStack();
    if (this.load > .8) this.fatigueTime += dt;
    else if (this.load < .64) this.fatigueTime = Math.max(0, this.fatigueTime - dt * 2);
    this.dangerActive = this.fatigueTime > .04;
    if (!wasDanger && this.dangerActive) this.events.push({ type: 'rescueStart', seconds: FATIGUE_SECONDS });
    if (wasDanger && !this.dangerActive) this.events.push({ type: 'rescueClear' });

    this.maxLoad = Math.max(this.maxLoad, this.load);
    this.maxLean = Math.max(this.maxLean, Math.abs(this.surfaceAngle));
    this.score += dt * (8 + this.level * .55);

    if (this.settleLock <= 0 && this.stability < -.02) this.finish('collapse');
    else if (Math.abs(this.surfaceAngle) >= .24) this.finish('collapse');
    else if (this.fatigueTime >= FATIGUE_SECONDS) this.finish('overload');
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
      lean: this.surfaceAngle, surfaceAngle: this.surfaceAngle, load: Math.min(1, this.load),
      leftLoad: this.leftLoad, rightLoad: this.rightLoad,
      maxLoad: Math.min(1, this.maxLoad), maxLean: this.maxLean,
      fatigueTime: this.fatigueTime, dangerActive: this.dangerActive,
      dangerRemaining: Math.max(0, FATIGUE_SECONDS - this.fatigueTime),
      stability: this.stability, wobble: this.wobble,
      mover: this.mover ? { ...this.mover } : null,
      blocks: this.blocks.map(block => ({ ...block })),
      idealX: this.mover ? this.idealX() : 0
    };
  }
}
