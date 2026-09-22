import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
import { TowerGame, validSeed, VERSION } from './engine.mjs';

const $ = id => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const canonical = 'https://wiki.body-all.co.kr/contents/center-balance/';
const storageKey = 'bodyall-mallow-tower-v3';
const ids = ['scene','stage','loading','start-panel','start','start-copy','hud','floor-count','load-state','load-percent','load-fill','load-left','load-right','score','combo','challenge-banner','challenge-score','countdown','count','touch-guide','center-message','impact-flash','pause','best','plays','perfect-total','recovery-total','sound','info','result-dialog','result-label','result-title','result-floor','result-message','result-load','result-lean','result-recovery','result-badges','retry','challenge','new-pattern','share-status','pause-dialog','resume','quit','info-dialog'];
const els = Object.fromEntries(ids.map(id => [id, $(id)]));

let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { saved = {}; }
let best = Number.isFinite(saved.best) ? Math.max(0, saved.best | 0) : 0;
let bestScore = Number.isFinite(saved.bestScore) ? Math.max(0, saved.bestScore | 0) : 0;
let plays = Number.isFinite(saved.plays) ? Math.max(0, saved.plays | 0) : 0;
let perfectTotal = Number.isFinite(saved.perfectTotal) ? Math.max(0, saved.perfectTotal | 0) : 0;
let recoveryTotal = Number.isFinite(saved.recoveryTotal) ? Math.max(0, saved.recoveryTotal | 0) : 0;
let sound = saved.sound === true;
let currentSeed = dailySeed();
let challengeFloor = 0;
let challengeTargetScore = 0;
let game = null;
let finalSnapshot = null;
let mode = 'loading';
let countdownAt = 0;
let lastFrame = performance.now();
let resultTimer = 0;
let messageTimer = 0;
let audio = null;
let collapse = null;
let blockAnimations = [];

const params = new URLSearchParams(location.search);
if (validSeed(params.get('c'))) currentSeed = params.get('c');
const sharedFloor = Number(params.get('f'));
const sharedScore = Number(params.get('s'));
if (Number.isFinite(sharedFloor) && sharedFloor > 0 && sharedFloor < 1000) challengeFloor = Math.floor(sharedFloor);
if (Number.isFinite(sharedScore) && sharedScore > 0 && sharedScore < 1e8) challengeTargetScore = Math.floor(sharedScore);

function dailySeed() {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '');
  return `mallow-${day}`;
}
function randomSeed() {
  const value = new Uint32Array(1);
  crypto?.getRandomValues?.(value);
  return `mallow-${Date.now().toString(36)}-${(value[0] || Math.random() * 1e8 | 0).toString(36)}`;
}
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify({ best, bestScore, plays, perfectTotal, recoveryTotal, sound })); } catch { /* local records are optional */ }
}
function track(event, extra = {}) {
  window.dispatchEvent(new CustomEvent('bodyall:game-event', { detail: { event, game: 'mallow-tower', version: VERSION, ...extra } }));
}
function updateStats() {
  els.best.innerHTML = `${best}<small>층</small>`;
  els.plays.textContent = plays;
  els['perfect-total'].textContent = perfectTotal;
  els['recovery-total'].textContent = recoveryTotal;
  els.sound.setAttribute('aria-pressed', String(sound));
  els.sound.setAttribute('aria-label', sound ? '소리 끄기' : '소리 켜기');
  els.sound.textContent = sound ? '♫' : '♪';
}
function configureChallenge() {
  els['challenge-banner'].hidden = challengeFloor < 1;
  if (challengeFloor) els['challenge-score'].textContent = `${challengeFloor}층 · ${challengeTargetScore.toLocaleString()}점`;
}

// 3D scene ------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas: els.scene, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdcece6);
scene.fog = new THREE.Fog(0xdcece6, 12, 31);
const camera = new THREE.PerspectiveCamera(32, 1, .1, 60);
camera.position.set(6.3, 5.1, 10.8);
camera.lookAt(0, 2.6, 0);
scene.add(new THREE.HemisphereLight(0xfff8df, 0x58786d, 2.1));
const keyLight = new THREE.DirectionalLight(0xffe9c4, 3.1);
keyLight.position.set(5, 9, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x9ddcff, 1.1);
fillLight.position.set(-5, 4, 2);
scene.add(fillLight);
const floor = new THREE.Mesh(new THREE.CircleGeometry(11, 64), new THREE.MeshStandardMaterial({ color: 0xe7cfaa, roughness: .88 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -.32;
floor.receiveShadow = true;
scene.add(floor);
const floorRing = new THREE.Mesh(new THREE.RingGeometry(4.1, 4.32, 64), new THREE.MeshBasicMaterial({ color: 0xc5aa80, transparent: true, opacity: .3, side: THREE.DoubleSide }));
floorRing.rotation.x = -Math.PI / 2;
floorRing.position.y = -.305;
scene.add(floorRing);

const structure = new THREE.Group();
scene.add(structure);
const placedGroup = new THREE.Group();
structure.add(placedGroup);
const moverGroup = new THREE.Group();
structure.add(moverGroup);
const guideMaterial = new THREE.MeshBasicMaterial({ color: 0x36866d, transparent: true, opacity: .16 });
const centerLine = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, 10, 8), guideMaterial);
centerLine.position.z = -.7;
structure.add(centerLine);

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: .68, ...options });
}
function mesh(geometry, mat) {
  const result = new THREE.Mesh(geometry, mat);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}
function layerColor(index, hue = 0) {
  const palette = [0xf4c77b, 0x77baa2, 0xe98665, 0x8ba9d5, 0xd8a6c8, 0xaacb78];
  return palette[(index + Math.floor(hue / 60)) % palette.length];
}
function createLayer(block, index, moving = false) {
  const radius = .29;
  const geometry = new THREE.CapsuleGeometry(radius, Math.max(.25, block.width - radius * 2), 7, 15);
  geometry.rotateZ(Math.PI / 2);
  const mat = material(moving ? 0xfff5d7 : layerColor(index, block.hue), { emissive: moving ? 0x2d5d4c : 0x000000, emissiveIntensity: moving ? .14 : 0 });
  const result = mesh(geometry, mat);
  result.scale.z = 1.52;
  result.userData.block = block;
  return result;
}

function makeCharacter() {
  const root = new THREE.Group();
  const skin = material(0xf2c992), green = material(0x2c896d), dark = material(0x263a36), cream = material(0xfff3dc), shoe = material(0xe86b43);
  const pelvis = mesh(new THREE.SphereGeometry(.38, 20, 14), dark);
  pelvis.scale.set(1, .68, .78); pelvis.position.y = .58; root.add(pelvis);
  const torsoPivot = new THREE.Group(); torsoPivot.position.y = .68; root.add(torsoPivot);
  const torso = mesh(new THREE.SphereGeometry(.55, 22, 16), green);
  torso.scale.set(.88, 1.12, .75); torso.position.y = .55; torsoPivot.add(torso);
  const head = mesh(new THREE.SphereGeometry(.57, 24, 18), skin);
  head.scale.set(1, .96, .92); head.position.y = 1.48; torsoPivot.add(head);
  const hair = mesh(new THREE.SphereGeometry(.58, 22, 14, 0, Math.PI * 2, 0, Math.PI * .47), dark);
  hair.position.y = 1.58; torsoPivot.add(hair);
  const eyeMat = material(0x17352e);
  const eyes = [];
  for (const x of [-.2, .2]) {
    const eye = mesh(new THREE.SphereGeometry(.047, 10, 7), eyeMat);
    eye.position.set(x, 1.51, .53); eye.scale.y = 1.35; torsoPivot.add(eye); eyes.push(eye);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(.09, .022, 7, 18, Math.PI), material(0xaa513e));
  mouth.position.set(0, 1.31, .535); mouth.rotation.z = Math.PI; torsoPivot.add(mouth);
  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const armPivot = new THREE.Group(); armPivot.position.set(side * .48, 1.15, 0); torsoPivot.add(armPivot);
    const arm = mesh(new THREE.CapsuleGeometry(.105, .45, 5, 9), skin); arm.position.y = -.3; armPivot.add(arm); arms.push(armPivot);
    const legPivot = new THREE.Group(); legPivot.position.set(side * .21, .52, 0); root.add(legPivot);
    const leg = mesh(new THREE.CapsuleGeometry(.12, .42, 5, 9), cream); leg.position.y = -.3; legPivot.add(leg); legs.push(legPivot);
    const foot = mesh(new THREE.SphereGeometry(.17, 12, 9), shoe); foot.scale.set(1, .62, 1.55); foot.position.set(0, -.57, .09); legPivot.add(foot);
  }
  const makeBand = x => {
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x59c39b, emissive: 0x174c3d, emissiveIntensity: .25, roughness: .45, transparent: true, opacity: .15 });
    const band = mesh(new THREE.CapsuleGeometry(.052, .72, 5, 9), bandMat);
    band.position.set(x, .52, .515); torsoPivot.add(band); return band;
  };
  const bands = [makeBand(-.27), makeBand(.27)];
  root.userData.parts = { torsoPivot, torso, head, eyes, mouth, arms, legs, bands };
  root.scale.setScalar(.82);
  return root;
}
const character = makeCharacter();
structure.add(character);
let moverMesh = null;

function clearGroup(group) {
  while (group.children.length) {
    const object = group.children[0];
    group.remove(object);
    object.geometry?.dispose();
    object.material?.dispose();
  }
}
function rebuildTower(snapshot) {
  clearGroup(placedGroup);
  snapshot.blocks.forEach((block, index) => {
    const layer = createLayer(block, index, false);
    layer.position.set(block.x, .05 + index * .49, 0);
    if (block.base) layer.scale.set(1, 1.22, 1.68);
    placedGroup.add(layer);
  });
  updateMover(snapshot);
}
function updateMover(snapshot) {
  if (!snapshot.mover) return;
  if (!moverMesh || moverMesh.userData.block?.width !== snapshot.mover.width) {
    clearGroup(moverGroup);
    moverMesh = createLayer(snapshot.mover, snapshot.level + 1, true);
    moverGroup.add(moverMesh);
  }
  moverMesh.userData.block = snapshot.mover;
  moverMesh.position.set(snapshot.mover.x, .05 + (snapshot.level + 1) * .49, 0);
}
function addPlacedLayer(event) {
  const layer = createLayer(event.block, event.level, false);
  layer.position.set(event.block.x, .05 + event.level * .49, 0);
  layer.scale.y = .18;
  placedGroup.add(layer);
  blockAnimations.push({ mesh: layer, age: 0 });
  clearGroup(moverGroup);
  moverMesh = null;
}

// End-of-round physics -------------------------------------------------------
class CollapseWorld {
  constructor(snapshot) {
    structure.visible = false;
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.allowSleep = true;
    const groundMat = new CANNON.Material('ground');
    const bodyMat = new CANNON.Material('mallow');
    this.world.addContactMaterial(new CANNON.ContactMaterial(bodyMat, groundMat, { friction: .72, restitution: .18 }));
    const ground = new CANNON.Body({ mass: 0, material: groundMat, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); ground.position.y = -.31; this.world.addBody(ground);
    this.entries = [];
    const slope = -snapshot.baseSlope;
    const transform = (x, y) => [x * Math.cos(slope) - y * Math.sin(slope), x * Math.sin(slope) + y * Math.cos(slope)];
    snapshot.blocks.forEach((block, index) => {
      const width = block.width;
      const [x, y] = transform(block.x, .05 + index * .49);
      const body = new CANNON.Body({ mass: index ? 1 + index * .06 : 0, material: bodyMat, shape: new CANNON.Box(new CANNON.Vec3(width * .5, .255, .44)) });
      body.position.set(x, y, 0); body.quaternion.setFromEuler(0, 0, slope); body.linearDamping = .02; body.angularDamping = .12; this.world.addBody(body);
      const visual = createLayer(block, index, false); visual.position.set(x, y, 0); visual.quaternion.copy(body.quaternion); scene.add(visual);
      this.entries.push({ body, mesh: visual });
    });
    const top = snapshot.blocks.at(-1);
    const [cx, cy] = transform(top.x, .05 + (snapshot.blocks.length - 1) * .49 + 1.18);
    const doll = [
      { r: .47, mass: 1, pos: [cx, cy + .63, 0], color: 0xf2c992 },
      { box: [.38, .48, .3], mass: 2, pos: [cx, cy, 0], color: 0x2c896d },
      { box: [.31, .23, .27], mass: 1, pos: [cx, cy - .55, 0], color: 0x263a36 }
    ];
    doll.forEach(part => {
      const shape = part.r ? new CANNON.Sphere(part.r) : new CANNON.Box(new CANNON.Vec3(...part.box));
      const body = new CANNON.Body({ mass: part.mass, material: bodyMat, shape }); body.position.set(...part.pos); this.world.addBody(body);
      const geometry = part.r ? new THREE.SphereGeometry(part.r, 18, 13) : new THREE.BoxGeometry(part.box[0] * 2, part.box[1] * 2, part.box[2] * 2);
      const visual = mesh(geometry, material(part.color)); scene.add(visual); this.entries.push({ body, mesh: visual });
      body.applyImpulse(new CANNON.Vec3(Math.sign(snapshot.lean || 1) * 1.2, .8, .15), body.position);
    });
  }
  step(dt) {
    this.world.step(1 / 60, dt, 3);
    for (const entry of this.entries) { entry.mesh.position.copy(entry.body.position); entry.mesh.quaternion.copy(entry.body.quaternion); }
  }
  dispose() {
    for (const entry of this.entries) { scene.remove(entry.mesh); entry.mesh.geometry?.dispose(); entry.mesh.material?.dispose(); }
    this.entries = [];
    structure.visible = true;
  }
}

function resize() {
  const rect = els.stage.getBoundingClientRect();
  renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
  camera.aspect = rect.width / Math.max(1, rect.height);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(els.stage);

// Game flow -----------------------------------------------------------------
function startRound(seed = currentSeed) {
  if (!validSeed(seed) || mode === 'loading') return;
  currentSeed = seed;
  mode = 'countdown';
  collapse?.dispose(); collapse = null;
  structure.visible = true;
  finalSnapshot = null;
  game = new TowerGame(seed);
  rebuildTower(game.snapshot());
  blockAnimations = [];
  els['floor-count'].textContent = '0';
  els.score.textContent = '0';
  els.combo.hidden = true;
  els['touch-guide'].hidden = false;
  els['start-panel'].hidden = true;
  els.hud.hidden = false;
  els.pause.hidden = false;
  els.countdown.hidden = false;
  els.count.textContent = '3';
  els['result-dialog'].close();
  countdownAt = 2.45;
  beep('count');
  track('game_start', { challenge: challengeFloor > 0 });
}
function pause() {
  if (mode !== 'playing' && mode !== 'countdown') return;
  mode = mode === 'playing' ? 'paused' : 'countdown-paused';
  game?.pause();
  els['pause-dialog'].showModal();
}
function resume() {
  if (!mode.includes('paused')) return;
  const wasCountdown = mode === 'countdown-paused';
  mode = wasCountdown ? 'countdown' : 'playing';
  if (!wasCountdown) game?.start();
  els['pause-dialog'].close();
  lastFrame = performance.now();
}
function home() {
  mode = 'home';
  collapse?.dispose(); collapse = null;
  finalSnapshot = null;
  game = new TowerGame(currentSeed);
  rebuildTower(game.snapshot());
  structure.visible = true;
  els.stage.classList.remove('overload');
  els['start-panel'].hidden = false;
  els.hud.hidden = true;
  els.pause.hidden = true;
  els.countdown.hidden = true;
  els['touch-guide'].hidden = true;
  if (els['pause-dialog'].open) els['pause-dialog'].close();
}
function showMessage(text, type = '') {
  els['center-message'].textContent = text;
  els['center-message'].className = `center-message ${type}`;
  void els['center-message'].offsetWidth;
  els['center-message'].classList.add('show');
  messageTimer = 1.05;
}
function flashRecovery() {
  els['impact-flash'].classList.remove('flash');
  void els['impact-flash'].offsetWidth;
  els['impact-flash'].classList.add('flash');
}
function handleEvents(events) {
  for (const event of events) {
    if (event.type === 'placed') {
      addPlacedLayer(event);
      navigator.vibrate?.(event.perfect ? 18 : 8);
      beep(event.perfect ? 'perfect' : 'place');
    }
    if (event.type === 'perfect') showMessage(event.combo > 1 ? `척! 정확한 정렬 ×${event.combo}` : '척! 정확한 정렬');
    if (event.type === 'recovery') {
      showMessage('중심 회복! 몸이 힘을 뺍니다', 'recovery');
      flashRecovery();
      navigator.vibrate?.([25, 25, 45]);
      beep('recover');
    }
    if (event.type === 'end') finishRound();
  }
}
function placeBlock() {
  if (mode !== 'playing') return;
  handleEvents(game.place());
  els['touch-guide'].hidden = true;
}
function finishRound() {
  if (mode === 'ending' || mode === 'result') return;
  finalSnapshot = game.snapshot();
  mode = 'ending';
  plays++;
  perfectTotal += finalSnapshot.perfects;
  recoveryTotal += finalSnapshot.recoveries;
  const previousBest = best;
  const won = challengeFloor > 0 && (finalSnapshot.level > challengeFloor || (finalSnapshot.level === challengeFloor && finalSnapshot.score > challengeTargetScore));
  if (finalSnapshot.level > best || (finalSnapshot.level === best && finalSnapshot.score > bestScore)) {
    best = finalSnapshot.level; bestScore = finalSnapshot.score;
  }
  persist();
  updateStats();
  els.pause.hidden = true;
  els['touch-guide'].hidden = true;
  els.stage.classList.remove('overload');
  collapse = new CollapseWorld(finalSnapshot);
  resultTimer = 1.35;
  beep('fall');
  track('game_complete', { level: finalSnapshot.level, score: finalSnapshot.score, reason: finalSnapshot.reason, recoveries: finalSnapshot.recoveries, challenge_won: won });

  els['result-floor'].textContent = finalSnapshot.level;
  els['result-load'].textContent = `${Math.round(finalSnapshot.maxLoad * 100)}%`;
  els['result-lean'].textContent = `${(finalSnapshot.maxLean * 180 / Math.PI).toFixed(1)}°`;
  els['result-recovery'].textContent = `${finalSnapshot.recoveries}회`;
  els['result-badges'].replaceChildren();
  const badges = [];
  if (finalSnapshot.perfects) badges.push(`정확한 정렬 ${finalSnapshot.perfects}회`);
  if (finalSnapshot.recoveries) badges.push(`중심 회복 ${finalSnapshot.recoveries}회`);
  if (finalSnapshot.level > previousBest) badges.push('새로운 최고 높이');
  if (won) badges.push('친구 기록 격파');
  if (finalSnapshot.maxLoad >= .9) badges.push('한계에서 버팀');
  badges.forEach(label => { const span = document.createElement('span'); span.textContent = label; els['result-badges'].append(span); });

  if (won) {
    els['result-label'].textContent = '도전 성공';
    els['result-title'].textContent = '친구의 중심탑을 넘어섰습니다.';
  } else if (finalSnapshot.reason === 'overload') {
    els['result-label'].textContent = '근육 부하 한계';
    els['result-title'].textContent = '탑은 서 있었지만, 몸이 먼저 지쳤습니다.';
  } else if (finalSnapshot.reason === 'miss') {
    els['result-label'].textContent = '아슬아슬한 착지';
    els['result-title'].textContent = '말랑 분절이 탑을 스쳐 갔습니다.';
  } else {
    els['result-label'].textContent = '중심 붕괴';
    els['result-title'].textContent = '몸이 더는 기울기를 보상하지 못했습니다.';
  }
  els['result-message'].textContent = `${finalSnapshot.level}층 · ${finalSnapshot.score.toLocaleString()}점. 몸이 버티는 힘이 커지기 전에 반대쪽으로 중심을 되찾아보세요.`;
}
function showResult() {
  if (!els['result-dialog'].open) { els['share-status'].textContent = ''; els['result-dialog'].showModal(); }
}

// Animation -----------------------------------------------------------------
function updateHud(snapshot) {
  const percent = Math.round(snapshot.load * 100);
  els['floor-count'].textContent = snapshot.level;
  els.score.textContent = snapshot.score.toLocaleString();
  els['load-percent'].textContent = `${percent}%`;
  els['load-fill'].style.width = `${percent}%`;
  let state = '편안';
  if (percent >= 82) state = '한계!';
  else if (percent >= 62) state = '과부하';
  else if (percent >= 35) state = '버티는 중';
  else if (percent >= 15) state = '보상 시작';
  els['load-state'].textContent = state;
  els.combo.hidden = snapshot.combo < 2;
  els.combo.textContent = `척! ×${snapshot.combo}`;
  const active = snapshot.lean > .012 ? els['load-left'] : snapshot.lean < -.012 ? els['load-right'] : null;
  for (const zone of [els['load-left'], els['load-right']]) zone.className = '';
  if (active) active.className = percent >= 70 ? 'active hot' : 'active';
  els.stage.classList.toggle('overload', percent >= 82);
}
function updateCharacter(snapshot, dt) {
  const top = snapshot.blocks.at(-1);
  const topY = .05 + (snapshot.blocks.length - 1) * .49;
  character.position.x += (top.x - character.position.x) * Math.min(1, dt * 10);
  character.position.y += (topY + .51 - character.position.y) * Math.min(1, dt * 10);
  const compensate = -snapshot.lean * 2.65;
  character.rotation.z += (compensate - character.rotation.z) * Math.min(1, dt * 7);
  const parts = character.userData.parts;
  parts.torsoPivot.rotation.z = -snapshot.lean * 1.7;
  parts.head.rotation.z = snapshot.lean * .55;
  parts.arms[0].rotation.z = -.35 - snapshot.lean * 2.1;
  parts.arms[1].rotation.z = .35 - snapshot.lean * 2.1;
  parts.legs[0].rotation.z = snapshot.lean * .7;
  parts.legs[1].rotation.z = snapshot.lean * .7;
  const stress = snapshot.load;
  const pulse = 1 + Math.sin(snapshot.time * 12) * stress * .07;
  for (const eye of parts.eyes) eye.scale.y = Math.max(.22, 1.35 - stress * .98);
  parts.mouth.scale.setScalar(1 + stress * 1.15);
  const hotIndex = snapshot.lean >= 0 ? 0 : 1;
  parts.bands.forEach((band, index) => {
    const intensity = stress * (index === hotIndex ? 1 : .52);
    const color = intensity > .72 ? 0xe53f3f : intensity > .42 ? 0xef8b3e : intensity > .18 ? 0xf0c24f : 0x57c29a;
    band.material.color.setHex(color);
    band.material.emissive.setHex(color);
    band.material.emissiveIntensity = .25 + intensity * 1.7;
    band.material.opacity = .12 + intensity * .88;
    band.scale.setScalar(index === hotIndex ? pulse : 1);
  });
}
function updateCamera(snapshot, dt) {
  const towerHeight = .05 + snapshot.blocks.length * .49 + 1.5;
  const targetY = clamp(towerHeight * .54 + 1.2, 3.1, 11.5);
  const targetZ = clamp(10.8 + snapshot.level * .095, 10.8, 15.5);
  camera.position.y += (targetY + 2.1 - camera.position.y) * Math.min(1, dt * 2.2);
  camera.position.z += (targetZ - camera.position.z) * Math.min(1, dt * 2.2);
  camera.lookAt(0, targetY, 0);
  centerLine.scale.y = Math.max(1, towerHeight / 5);
  centerLine.position.y = towerHeight * .5;
}
function visualUpdate(dt) {
  const snapshot = game?.snapshot();
  if (snapshot && structure.visible) {
    structure.rotation.z += (-snapshot.baseSlope - structure.rotation.z) * Math.min(1, dt * 5);
    updateMover(snapshot);
    updateCharacter(snapshot, dt);
    updateCamera(snapshot, dt);
  }
  for (const item of blockAnimations) {
    item.age += dt;
    item.mesh.scale.y = 1 + Math.sin(Math.min(1, item.age / .32) * Math.PI) * .28 * (1 - Math.min(1, item.age / .32));
  }
  blockAnimations = blockAnimations.filter(item => item.age < .34);
  collapse?.step(dt);
  renderer.render(scene, camera);
}
function update(dt) {
  if (mode === 'countdown') {
    countdownAt -= dt;
    const number = Math.max(1, Math.ceil(countdownAt));
    if (els.count.textContent !== String(number)) { els.count.textContent = String(number); beep('count'); }
    if (countdownAt <= 0) {
      mode = 'playing';
      els.countdown.hidden = true;
      game.start();
      showMessage('움직이는 분절을 탭해 놓으세요');
      beep('start');
    }
  }
  if (mode === 'playing') {
    handleEvents(game.advance(dt));
    if (mode === 'playing') updateHud(game.snapshot());
  }
  if (mode === 'ending') {
    resultTimer -= dt;
    if (resultTimer <= 0) { mode = 'result'; showResult(); }
  }
  if (messageTimer > 0) messageTimer -= dt;
}
function frame(now) {
  const dt = clamp((now - lastFrame) / 1000, 0, .1);
  lastFrame = now;
  update(dt);
  visualUpdate(dt);
  requestAnimationFrame(frame);
}

// Input, audio and sharing ---------------------------------------------------
els.stage.addEventListener('pointerdown', event => {
  if (event.target.closest?.('button') || mode !== 'playing') return;
  event.preventDefault();
  placeBlock();
});
document.addEventListener('keydown', event => {
  if (['INPUT','TEXTAREA'].includes(event.target.tagName)) return;
  if ((event.code === 'Space' || event.code === 'Enter') && mode === 'playing') { event.preventDefault(); placeBlock(); }
  if ((event.key === 'p' || event.key === 'P' || event.key === 'Escape') && mode === 'playing') pause();
});
function unlockAudio() {
  if (!sound) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  audio ||= new Audio();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
}
function beep(kind) {
  if (!sound) return;
  unlockAudio();
  if (!audio || audio.state !== 'running') return;
  const sets = {
    count: [360], start: [430, 620], place: [220], perfect: [520, 740], recover: [540, 760, 1040], fall: [230, 155, 95]
  }[kind] || [430];
  sets.forEach((frequency, index) => {
    const oscillator = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime + index * .075;
    oscillator.type = kind === 'fall' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(.065, at + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, at + .14);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(at); oscillator.stop(at + .16);
  });
}
function challengeUrl() {
  const snap = finalSnapshot || game?.snapshot();
  const url = new URL(canonical);
  url.searchParams.set('c', currentSeed);
  url.searchParams.set('f', String(snap?.level || best));
  url.searchParams.set('s', String(snap?.score || bestScore));
  return url.href;
}
async function shareChallenge() {
  const snap = finalSnapshot || game?.snapshot();
  const floorCount = snap?.level || best;
  const score = snap?.score || bestScore;
  const url = challengeUrl();
  const text = `나는 《말랑 중심탑》에서 ${floorCount}층 · ${score.toLocaleString()}점을 기록했습니다. 몸이 버티기 전에 중심을 되찾아보세요.`;
  try {
    if (navigator.share) {
      await navigator.share({ title: '말랑 중심탑 도전', text, url });
      els['share-status'].textContent = '도전장을 보냈습니다.';
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      els['share-status'].textContent = '도전 링크를 복사했습니다.';
    }
    track('challenge_share', { level: floorCount, score });
  } catch (error) {
    if (error?.name !== 'AbortError') {
      try { await navigator.clipboard.writeText(url); els['share-status'].textContent = '도전 링크를 복사했습니다.'; }
      catch { els['share-status'].textContent = url; }
    }
  }
}

els.start.addEventListener('click', () => startRound(currentSeed));
els.retry.addEventListener('click', () => startRound(currentSeed));
els['new-pattern'].addEventListener('click', () => { challengeFloor = 0; challengeTargetScore = 0; currentSeed = randomSeed(); configureChallenge(); startRound(currentSeed); });
els.challenge.addEventListener('click', shareChallenge);
els.pause.addEventListener('click', pause);
els.resume.addEventListener('click', resume);
els.quit.addEventListener('click', home);
els.info.addEventListener('click', () => {
  if (mode === 'playing' || mode === 'countdown') { pause(); return; }
  els['info-dialog'].showModal();
});
els.sound.addEventListener('click', () => { sound = !sound; persist(); updateStats(); unlockAudio(); if (sound) beep('perfect'); });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
els['result-dialog'].addEventListener('cancel', event => { event.preventDefault(); home(); els['result-dialog'].close(); });
els['result-dialog'].addEventListener('close', () => { if (mode === 'result') home(); });
els['pause-dialog'].addEventListener('cancel', event => { event.preventDefault(); resume(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && (mode === 'playing' || mode === 'countdown')) pause(); });
window.addEventListener('blur', () => { if (mode === 'playing') pause(); });

updateStats();
configureChallenge();
resize();
game = new TowerGame(currentSeed);
rebuildTower(game.snapshot());
requestAnimationFrame(frame);
setTimeout(() => {
  mode = 'home';
  els.loading.hidden = true;
  els.start.disabled = false;
  els['start-copy'].textContent = challengeFloor ? '친구 중심탑에 도전' : '말랑 탑 쌓기';
}, 350);
