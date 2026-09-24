import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
import { TowerGame, validSeed, VERSION } from './engine.mjs';

const $ = id => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const canonical = 'https://wiki.body-all.co.kr/contents/center-balance/';
const storageKey = 'bodyall-mallow-tower-v4';
const ids = ['scene','stage','loading','start-panel','start','start-copy','hud','floor-count','load-state','load-percent','load-fill','load-left','load-right','score','combo','challenge-banner','challenge-score','countdown','count','touch-guide','rescue-alert','rescue-time','center-message','impact-flash','pause','best','plays','perfect-total','recovery-total','sound','info','result-dialog','result-label','result-title','result-floor','result-message','result-load','result-lean','result-recovery','result-badges','retry','challenge','new-pattern','share-status','pause-dialog','resume','quit','info-dialog'];
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
  const skin = material(0xf2c992), dark = material(0x263a36), cream = material(0xfff3dc), shoe = material(0xe86b43);
  const pelvis = mesh(new THREE.SphereGeometry(.38, 20, 14), dark);
  pelvis.scale.set(1, .68, .78); pelvis.position.y = .51; root.add(pelvis);

  const torsoShell = mesh(
    new THREE.CapsuleGeometry(.48, .72, 8, 18),
    material(0x2c896d, { transparent: true, opacity: .72, depthWrite: false })
  );
  torsoShell.position.set(0, 1.12, -.08); torsoShell.scale.z = .72; root.add(torsoShell);

  const spineRoot = new THREE.Group();
  spineRoot.position.set(0, .66, .39);
  root.add(spineRoot);
  const spinePivots = [], vertebrae = [], musclesLeft = [], musclesRight = [];
  let parent = spineRoot;
  for (let i = 0; i < 7; i++) {
    const pivot = new THREE.Group();
    pivot.position.y = i ? .185 : 0;
    parent.add(pivot);
    const vertebra = mesh(new THREE.SphereGeometry(.105 - i * .003, 14, 9), material(0xeaf8ed, { emissive: 0x3d9f80, emissiveIntensity: .5 }));
    vertebra.scale.set(1.12, .62, .72); pivot.add(vertebra);
    for (const side of [-1, 1]) {
      const muscleMat = material(0x58c69a, { emissive: 0x1d6e55, emissiveIntensity: .35, transparent: true, opacity: .65 });
      const muscle = mesh(new THREE.CapsuleGeometry(.035, .13, 4, 7), muscleMat);
      muscle.position.set(side * .16, .09, .015);
      pivot.add(muscle);
      (side < 0 ? musclesLeft : musclesRight).push(muscle);
    }
    spinePivots.push(pivot); vertebrae.push(vertebra); parent = pivot;
  }

  const shoulder = new THREE.Group(); shoulder.position.y = .2; parent.add(shoulder);
  const head = mesh(new THREE.SphereGeometry(.57, 24, 18), skin);
  head.scale.set(1, .96, .92); head.position.y = .56; shoulder.add(head);
  const hair = mesh(new THREE.SphereGeometry(.58, 22, 14, 0, Math.PI * 2, 0, Math.PI * .47), dark);
  hair.position.y = .66; shoulder.add(hair);
  const eyeMat = material(0x17352e);
  const eyes = [];
  for (const x of [-.2, .2]) {
    const eye = mesh(new THREE.SphereGeometry(.047, 10, 7), eyeMat);
    eye.position.set(x, .59, .53); eye.scale.y = 1.35; shoulder.add(eye); eyes.push(eye);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(.09, .022, 7, 18, Math.PI), material(0xaa513e));
  mouth.position.set(0, .39, .535); mouth.rotation.z = Math.PI; shoulder.add(mouth);
  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const armPivot = new THREE.Group(); armPivot.position.set(side * .46, .1, 0); shoulder.add(armPivot);
    const arm = mesh(new THREE.CapsuleGeometry(.105, .45, 5, 9), skin); arm.position.y = -.3; armPivot.add(arm); arms.push(armPivot);
    const legPivot = new THREE.Group(); legPivot.position.set(side * .21, .45, 0); root.add(legPivot);
    const leg = mesh(new THREE.CapsuleGeometry(.12, .42, 5, 9), cream); leg.position.y = -.3; legPivot.add(leg); legs.push(legPivot);
    const foot = mesh(new THREE.SphereGeometry(.17, 12, 9), shoe); foot.scale.set(1, .62, 1.55); foot.position.set(0, -.57, .09); legPivot.add(foot);
  }
  const stressHalo = new THREE.Mesh(new THREE.TorusGeometry(.76, .055, 10, 42), new THREE.MeshBasicMaterial({ color: 0xff594d, transparent: true, opacity: 0, depthWrite: false }));
  stressHalo.position.set(0, 1.17, -.25); root.add(stressHalo);
  const stressLight = new THREE.PointLight(0xff4a3d, 0, 3.8); stressLight.position.set(0, 1.05, .6); root.add(stressLight);
  root.userData.parts = { pelvis, torsoShell, spineRoot, spinePivots, vertebrae, musclesLeft, musclesRight, shoulder, head, eyes, mouth, arms, legs, stressHalo, stressLight };
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
    layer.position.set(block.x, block.y, 0);
    layer.rotation.z = block.angle || 0;
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
  const top = snapshot.blocks.at(-1);
  moverMesh.position.set(snapshot.mover.x, top.y + .49, 0);
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

function updatePlacedPhysics(snapshot) {
  snapshot.blocks.forEach((block, index) => {
    const layer = placedGroup.children[index];
    if (!layer) return;
    layer.position.x += (block.x - layer.position.x) * .35;
    layer.position.y += (block.y - layer.position.y) * .35;
    const wobbleShare = index / Math.max(1, snapshot.blocks.length - 1);
    const visibleAngle = (block.angle || 0) + snapshot.wobble * wobbleShare;
    layer.rotation.z += (visibleAngle - layer.rotation.z) * .28;
    const compression = ((block.compressionLeft || 0) + (block.compressionRight || 0)) * .5;
    const baseY = block.base ? 1.22 : 1;
    layer.scale.y += ((baseY - compression * 1.9) - layer.scale.y) * .28;
  });
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
    snapshot.blocks.forEach((block, index) => {
      const width = block.width;
      const body = new CANNON.Body({ mass: index ? 1 + index * .06 : 0, material: bodyMat, shape: new CANNON.Box(new CANNON.Vec3(width * .5, .255, .44)) });
      body.position.set(block.x, block.y, 0); body.quaternion.setFromEuler(0, 0, block.angle || 0); body.linearDamping = .02; body.angularDamping = .12; this.world.addBody(body);
      const visual = createLayer(block, index, false); visual.position.set(block.x, block.y, 0); visual.quaternion.copy(body.quaternion); scene.add(visual);
      this.entries.push({ body, mesh: visual });
    });
    const top = snapshot.blocks.at(-1);
    const cx = top.x, cy = top.y + 1.18;
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
  els['rescue-alert'].hidden = true;
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
  els['rescue-alert'].hidden = true;
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
      if (event.level === 1) showMessage('치우친 하중이 말랑층 한쪽을 누릅니다');
      if (event.level === 2) showMessage('골반은 기울고, 척추는 머리를 세웁니다');
      if (event.level === 3) showMessage('붉게 수축한 근육 반대편에 놓으세요');
    }
    if (event.type === 'perfect' && event.combo > 3) showMessage(`척! 정확한 정렬 ×${event.combo}`);
    if (event.type === 'recovery') {
      showMessage('중심 회복! 몸이 힘을 뺍니다', 'recovery');
      flashRecovery();
      navigator.vibrate?.([25, 25, 45]);
      beep('recover');
    }
    if (event.type === 'rescueStart') {
      showMessage('척추 주변 근육 과부하! 반대편에 놓으세요', 'danger');
      beep('danger');
    }
    if (event.type === 'rescueClear') {
      showMessage('긴장이 풀리고 있습니다', 'recovery');
      flashRecovery();
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
  for (const zone of [els['load-left'], els['load-right']]) zone.className = '';
  if (snapshot.leftLoad > .14) els['load-left'].className = snapshot.leftLoad >= .7 ? 'active hot' : 'active';
  if (snapshot.rightLoad > .14) els['load-right'].className = snapshot.rightLoad >= .7 ? 'active hot' : 'active';
  els.stage.classList.toggle('overload', percent >= 82);
  els['rescue-alert'].hidden = !snapshot.dangerActive;
  els['rescue-time'].textContent = snapshot.dangerRemaining.toFixed(1);
}
function updateCharacter(snapshot, dt) {
  const top = snapshot.blocks.at(-1);
  const topY = top.y;
  character.position.x += (top.x - character.position.x) * Math.min(1, dt * 10);
  character.position.y += (topY + .51 - character.position.y) * Math.min(1, dt * 10);
  const stress = snapshot.load;
  const surface = snapshot.surfaceAngle;
  character.rotation.z += (0 - character.rotation.z) * Math.min(1, dt * 8);
  const parts = character.userData.parts;
  const shake = stress > .58 ? Math.sin(snapshot.time * 31) * (stress - .58) * .035 : 0;
  parts.pelvis.rotation.z += (surface - parts.pelvis.rotation.z) * Math.min(1, dt * 9);
  parts.spineRoot.rotation.z += (surface - parts.spineRoot.rotation.z) * Math.min(1, dt * 9);
  parts.torsoShell.rotation.z += ((surface * .16 + shake) - parts.torsoShell.rotation.z) * Math.min(1, dt * 8);
  const weights = [.24, .23, .2, .16, .11, .04, -.05];
  let correction = 0;
  parts.spinePivots.forEach((pivot, index) => {
    const target = -surface * weights[index] + shake * (index % 2 ? -.5 : .5);
    pivot.rotation.z += (target - pivot.rotation.z) * Math.min(1, dt * 10);
    correction += pivot.rotation.z;
  });
  const headCorrection = -(parts.spineRoot.rotation.z + correction);
  parts.shoulder.rotation.z += (headCorrection - parts.shoulder.rotation.z) * Math.min(1, dt * 10);
  parts.arms[0].rotation.z = -.35 - surface * 2.2 - stress * .52;
  parts.arms[1].rotation.z = .35 - surface * 2.2 + stress * .52;
  parts.legs[0].rotation.z = surface - stress * .08;
  parts.legs[1].rotation.z = surface + stress * .08;
  const pulse = 1 + Math.sin(snapshot.time * 12) * stress * .07;
  for (const eye of parts.eyes) eye.scale.y = Math.max(.22, 1.35 - stress * .98);
  parts.mouth.scale.setScalar(1 + stress * 1.15);
  const paintMuscles = (muscles, intensity) => muscles.forEach((muscle, index) => {
    const color = intensity > .72 ? 0xe53f3f : intensity > .42 ? 0xef8b3e : intensity > .18 ? 0xf0c24f : 0x57c29a;
    muscle.material.color.setHex(color);
    muscle.material.emissive.setHex(color);
    muscle.material.emissiveIntensity = .3 + intensity * 1.8;
    muscle.material.opacity = .5 + intensity * .5;
    const swell = 1 + intensity * .45 + (index % 2 ? 0 : Math.sin(snapshot.time * 12) * intensity * .06);
    muscle.scale.set(swell, pulse, swell);
  });
  paintMuscles(parts.musclesLeft, snapshot.leftLoad);
  paintMuscles(parts.musclesRight, snapshot.rightLoad);
  parts.torsoShell.material.opacity = .7 - stress * .53;
  parts.vertebrae.forEach(vertebra => { vertebra.material.emissiveIntensity = .45 + stress * 1.1; });
  parts.stressHalo.material.opacity = Math.max(0, (stress - .35) * .72);
  parts.stressHalo.scale.setScalar(.9 + stress * .22 + Math.sin(snapshot.time * 10) * stress * .035);
  parts.stressLight.intensity = Math.max(0, stress - .42) * 4.2;
}
function updateCamera(snapshot, dt) {
  const topY = snapshot.blocks.at(-1).y;
  const towerHeight = topY + 2.1;
  const targetY = topY + .48;
  const targetZ = clamp(10.35 + snapshot.load * 1.75 + snapshot.level * .025, 10.35, 13.9);
  camera.position.y += (topY + 3.35 - camera.position.y) * Math.min(1, dt * 3.1);
  camera.position.z += (targetZ - camera.position.z) * Math.min(1, dt * 2.2);
  camera.position.x += ((6.3 + snapshot.lean * 1.2) - camera.position.x) * Math.min(1, dt * 2.2);
  camera.lookAt(0, targetY, 0);
  centerLine.scale.y = Math.max(1, towerHeight / 5);
  centerLine.position.y = towerHeight * .5;
}
function visualUpdate(dt) {
  const snapshot = game?.snapshot();
  if (snapshot && structure.visible) {
    structure.rotation.z += (0 - structure.rotation.z) * Math.min(1, dt * 8);
    updateMover(snapshot);
    updatePlacedPhysics(snapshot);
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
    count: [360], start: [430, 620], place: [220], perfect: [520, 740], recover: [540, 760, 1040], warning: [310, 310], danger: [190, 150], fall: [230, 155, 95]
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
