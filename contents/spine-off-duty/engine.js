/* Bodyall Off Duty — deterministic, dependency-free game simulation. */
(function (root) {
  'use strict';
  const VERSION = '1';
  const W = 480, H = 580, PLAYER_Y = 437, STEP = 1 / 120;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function random(seed) {
    let h = 2166136261;
    for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return () => {
      h += 0x6D2B79F5;
      let t = Math.imul(h ^ h >>> 15, 1 | h);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function validSeed(seed) { return typeof seed === 'string' && /^v1-[a-z0-9]{1,16}$/.test(seed); }
  function schedule(seed) {
    const rng = random(seed), items = [], lanes = [64, 152, 240, 328, 416];
    let id = 0;
    const labels = [['업무톡 99+', '메일 도착', '잠깐 통화!'], ['회의 연장', '최종_진짜', '자료 좀요'], ['딱 5분만!', '긴급 수정', '퇴근 전 확인']];
    for (let at = 3; at < 57;) {
      const phase = at < 15 ? 0 : at < 40 ? 1 : 2;
      const lane = Math.floor(rng() * 5);
      items.push({ id: id++, at, x: lanes[lane], kind: 'work', label: labels[phase][Math.floor(rng() * 3)], speed: 145 + phase * 36, phase });
      if (phase === 2 && rng() > .52) {
        const other = (lane + 2 + Math.floor(rng() * 2)) % 5;
        items.push({ id: id++, at, x: lanes[other], kind: 'work', label: '참조 부탁!', speed: 217, phase });
      }
      at += (phase === 0 ? 2.8 : phase === 1 ? 2.15 : 1.8) + rng() * .45;
    }
    for (let at = 5; at < 57; at += 6) {
      let lane = Math.floor(rng() * 5);
      // A break arrives with a clear approach; never hide it inside a work card.
      const nearby = items.filter(o => Math.abs((o.at + (PLAYER_Y + 36) / o.speed) - (at + (PLAYER_Y + 36) / 170)) < .8);
      const open = lanes.filter(x => nearby.every(o => Math.abs(o.x - x) > 80));
      const x = open.length ? open[Math.floor(rng() * open.length)] : lanes[lane];
      items.push({ id: id++, at, x, kind: 'break', label: '쉬는 틈', speed: 170, phase: 0 });
    }
    return items.sort((a, b) => a.at - b.at || a.id - b.id);
  }
  class Game {
    constructor(seed) {
      if (!validSeed(seed)) throw new Error('Invalid challenge code');
      this.seed = seed; this.time = 0; this.x = W / 2; this.target = this.x;
      this.vx = 0; this.tilt = 0; this.tiltV = 0; this.fatigue = 12;
      this.cups = 3; this.score = 0; this.bonus = 0; this.breaks = 0;
      this.nearMisses = 0; this.dodges = 0; this.hits = 0; this.combo = 0;
      this.phase = 0; this.state = 'playing'; this.reason = null;
      this.invincible = 0; this.still = 0; this.accumulator = 0;
      this.items = []; this.queue = schedule(seed); this.cursor = 0; this.events = [];
    }
    setTarget(x) { if (Number.isFinite(x)) this.target = clamp(x, 44, W - 44); }
    pause() { if (this.state === 'playing') { this.state = 'paused'; this.accumulator = 0; } }
    resume() { if (this.state === 'paused') this.state = 'playing'; }
    advance(delta) {
      this.events = [];
      if (this.state !== 'playing' || !Number.isFinite(delta) || delta <= 0) return this.events;
      this.accumulator += Math.min(delta, .1);
      while (this.accumulator >= STEP && this.state === 'playing') {
        this.step(STEP); this.accumulator -= STEP;
      }
      return this.events;
    }
    step(dt) {
      this.time = Math.min(60, this.time + dt);
      const nextPhase = this.time < 15 ? 0 : this.time < 40 ? 1 : 2;
      if (nextPhase !== this.phase) { this.phase = nextPhase; this.events.push({ type: 'phase', phase: this.phase }); }
      this.invincible = Math.max(0, this.invincible - dt);
      const ax = (this.target - this.x) * 42 - this.vx * 12;
      this.vx = clamp(this.vx + ax * dt, -410, 410);
      this.x = clamp(this.x + this.vx * dt, 44, W - 44);
      this.tiltV += (-ax * .0007 - this.tilt * 40 - this.tiltV * 8) * dt;
      this.tilt = clamp(this.tilt + this.tiltV * dt, -.48, .48);
      this.still = Math.abs(this.vx) < 13 ? this.still + dt : 0;
      this.fatigue = clamp(this.fatigue + (1.15 + (this.still > 3 ? 1.7 : 0)) * dt, 0, 100);
      while (this.cursor < this.queue.length && this.queue[this.cursor].at - .8 <= this.time) {
        this.items.push({ ...this.queue[this.cursor++], y: -38, resolved: false });
      }
      for (const item of this.items) {
        if (item.at > this.time || item.resolved) continue;
        item.y = -36 + (this.time - item.at) * item.speed;
        const distance = Math.abs(item.x - this.x);
        if (Math.abs(item.y - PLAYER_Y) < 25) {
          if (item.kind === 'break' && distance < 47) {
            item.resolved = true; this.breaks++; this.combo++;
            const points = 150 + Math.min(this.combo, 5) * 20;
            this.bonus += points; this.fatigue = Math.max(0, this.fatigue - 25);
            this.events.push({ type: 'break', x: item.x, y: item.y, points, combo: this.combo });
          } else if (item.kind === 'work' && distance < 44 && this.invincible === 0) {
            item.resolved = true; this.hits++; this.cups--; this.combo = 0;
            this.fatigue = Math.min(100, this.fatigue + 9); this.invincible = 1.5;
            this.tiltV += item.x > this.x ? -1.1 : 1.1;
            this.events.push({ type: 'hit', x: item.x, y: item.y, cups: this.cups, label: item.label });
          }
        }
        if (!item.resolved && item.y > PLAYER_Y + 29) {
          item.resolved = true;
          if (item.kind === 'work') {
            this.dodges++; this.bonus += 15;
            if (distance >= 44 && distance < 82 && this.invincible === 0) {
              this.nearMisses++; this.bonus += 60;
              this.events.push({ type: 'near', x: this.x, y: PLAYER_Y, points: 75 });
            }
          }
        }
      }
      this.items = this.items.filter(i => !i.resolved && i.y < H + 60);
      this.score = Math.floor(this.time * 12) + this.bonus;
      if (this.cups <= 0) this.finish('coffee');
      else if (this.fatigue >= 100) this.finish('overload');
      else if (this.time >= 60) this.finish('clear');
    }
    finish(reason) {
      if (this.state !== 'playing') return;
      this.state = 'ended'; this.reason = reason;
      if (reason === 'clear') { this.bonus += 400 + this.cups * 100; this.score = 720 + this.bonus; }
      this.events.push({ type: 'end', reason });
    }
    snapshot() {
      return { version: VERSION, seed: this.seed, state: this.state, seconds: +this.time.toFixed(1), score: this.score, cups: this.cups, breaks: this.breaks, nearMisses: this.nearMisses, dodges: this.dodges, hits: this.hits, reason: this.reason };
    }
  }
  root.BodyallEngine = Object.freeze({ Game, VERSION, W, H, PLAYER_Y, validSeed, schedule });
})(globalThis);
