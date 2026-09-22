import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
import { BalanceGame, ROUND_SECONDS, validSeed, encodeReplay, decodeReplay } from './engine.mjs';

const $ = id => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const canonical = 'https://wiki.body-all.co.kr/contents/center-balance/';
const storageKey = 'bodyall-center-balance-v2';
const els = Object.fromEntries(['scene','stage','loading','start-panel','start','start-copy','hud','timer','danger-fill','target','target-time','score','combo','challenge-banner','challenger-name','challenge-time','countdown','count','touch-guide','touch-origin','touch-dot','impact-flash','toast','pause','best','plays','wins','close-calls','sound','info','result-dialog','result-label','result-title','result-time','result-message','result-badges','retry','challenge','new-pattern','share-status','pause-dialog','resume','quit','info-dialog'].map(id => [id, $(id)]));

let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { saved = {}; }
let best = Number.isFinite(saved.best) ? clamp(saved.best, 0, ROUND_SECONDS) : 0;
let plays = Number.isFinite(saved.plays) ? Math.max(0, saved.plays | 0) : 0;
let wins = Number.isFinite(saved.wins) ? Math.max(0, saved.wins | 0) : 0;
let closeCalls = Number.isFinite(saved.closeCalls) ? Math.max(0, saved.closeCalls | 0) : 0;
let sound = saved.sound === true;
let currentSeed = dailySeed();
let challengeTarget = 0;
let challengeReplay = [];
let game = null;
let ghostGame = null;
let replaySamples = [];
let sampleAt = 0;
let control = { x: 0, z: 0 };
let mode = 'loading';
let countdownAt = 0;
let lastFrame = performance.now();
let toastTimer = 0;
let resultTimer = 0;
let audio = null;
let dragging = false;
let ragdoll = null;
let dragStart = { x: 0, y: 0 };
let hazardVisuals = [];
let firstTouch = false;

const params = new URLSearchParams(location.search);
const sharedSeed = params.get('c');
const sharedTarget = Number(params.get('t')) / 1000;
if (validSeed(sharedSeed)) currentSeed = sharedSeed;
if (Number.isFinite(sharedTarget) && sharedTarget > 0 && sharedTarget <= ROUND_SECONDS) challengeTarget = sharedTarget;
challengeReplay = decodeReplay(params.get('g') || '');

function dailySeed() {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '');
  return `bca-${day}`;
}
function randomSeed() {
  const value = new Uint32Array(1); crypto?.getRandomValues?.(value);
  return `bca-${Date.now().toString(36)}-${(value[0] || Math.random() * 1e8 | 0).toString(36)}`;
}
function persist() { try { localStorage.setItem(storageKey, JSON.stringify({ best, plays, wins, closeCalls, sound })); } catch { /* Optional local record only. */ } }
function track(event, extra = {}) { window.dispatchEvent(new CustomEvent('bodyall:game-event', { detail: { event, game: 'center-balance', version: '2.0.0', ...extra } })); }
function updateStats() {
  els.best.innerHTML = `${best.toFixed(2)}<small>초</small>`; els.plays.textContent = plays; els.wins.textContent = wins; els['close-calls'].textContent = closeCalls;
  els.sound.setAttribute('aria-pressed', String(sound)); els.sound.setAttribute('aria-label', sound ? '소리 끄기' : '소리 켜기'); els.sound.textContent = sound ? '♫' : '♪';
}
function configureChallenge() {
  const active = challengeTarget > 0;
  els['challenge-banner'].hidden = !active; els.target.hidden = !active;
  if (active) { els['challenge-time'].textContent = `${challengeTarget.toFixed(2)}초`; els['target-time'].textContent = `${challengeTarget.toFixed(2)}초`; }
}

// Scene ---------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas: els.scene, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xdfece7); scene.fog = new THREE.Fog(0xdfece7, 9, 16);
const camera = new THREE.PerspectiveCamera(31, 1, .1, 40); camera.position.set(5.3, 4.25, 7.8); camera.lookAt(0, 1.3, 0);
scene.add(new THREE.HemisphereLight(0xfff8df, 0x61796f, 2.15));
const keyLight = new THREE.DirectionalLight(0xffe6bd, 3.2); keyLight.position.set(4, 7, 5); keyLight.castShadow = true; keyLight.shadow.mapSize.set(1024, 1024); scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x9ad9ff, 1.2); fillLight.position.set(-5, 3, 1); scene.add(fillLight);
const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.MeshStandardMaterial({ color: 0xe6cfac, roughness: .86 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.03; floor.receiveShadow = true; scene.add(floor);
const rings = new THREE.Mesh(new THREE.RingGeometry(3.7, 4.0, 64), new THREE.MeshBasicMaterial({ color: 0xc5aa80, transparent: true, opacity: .35, side: THREE.DoubleSide })); rings.rotation.x = -Math.PI / 2; rings.position.y = .005; scene.add(rings);

const platform = new THREE.Group(); platform.position.y = .3; scene.add(platform);
const platformBase = new THREE.Mesh(new THREE.CylinderGeometry(2.52, 2.68, .36, 48), new THREE.MeshStandardMaterial({ color: 0x1f5145, roughness: .72 })); platformBase.castShadow = platformBase.receiveShadow = true; platform.add(platformBase);
const platformTop = new THREE.Mesh(new THREE.CylinderGeometry(2.42, 2.42, .08, 48), new THREE.MeshStandardMaterial({ color: 0xfff4dd, roughness: .8 })); platformTop.position.y = .22; platformTop.receiveShadow = true; platform.add(platformTop);
for (let i = 0; i < 12; i++) {
  const dot = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xe46c45 : 0x4f9e82 }));
  const a = i / 12 * Math.PI * 2; dot.position.set(Math.cos(a) * 2.22, .275, Math.sin(a) * 2.22); platform.add(dot);
}

function mat(color, roughness = .68) { return new THREE.MeshStandardMaterial({ color, roughness }); }
function roundedPart(geometry, material) { const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }
function makeCharacter(ghost = false) {
  const root = new THREE.Group(); root.position.y = .56;
  const opacity = ghost ? .28 : 1;
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: .72, transparent: ghost, opacity, depthWrite: !ghost });
  const skin = material(0xf2c992), green = material(0x2c896d), dark = material(0x263a36), shoe = material(0xe86b43), cream = material(0xfff3dc);
  const pelvis = roundedPart(new THREE.SphereGeometry(.43, 22, 16), dark); pelvis.scale.set(1,.7,.75); pelvis.position.y = .98; root.add(pelvis);
  const torso = roundedPart(new THREE.SphereGeometry(.63, 24, 18), green); torso.scale.set(.9,1.12,.72); torso.position.y = 1.62; root.add(torso);
  const head = roundedPart(new THREE.SphereGeometry(.68, 28, 22), skin); head.scale.set(1,.96,.92); head.position.y = 2.57; root.add(head);
  const hair = roundedPart(new THREE.SphereGeometry(.69, 24, 16, 0, Math.PI * 2, 0, Math.PI * .48), dark); hair.position.set(0,2.7,0); root.add(hair);
  const parts = { arms: [], legs: [], eyes: [], mouth: null };
  const eyeMat = material(0x17352e);
  for (const x of [-.23,.23]) { const eye = roundedPart(new THREE.SphereGeometry(.055, 12, 8), eyeMat); eye.position.set(x,2.61,.625); eye.scale.y = 1.35; root.add(eye); parts.eyes.push(eye); }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(.105,.025,8,20,Math.PI), material(0xa84f3c)); mouth.position.set(0,2.38,.625); mouth.rotation.z = Math.PI; root.add(mouth);
  parts.mouth = mouth;
  const blushMat = material(0xea8773);
  for (const x of [-.38,.38]) { const blush = roundedPart(new THREE.SphereGeometry(.075,10,7),blushMat); blush.position.set(x,2.43,.59); blush.scale.set(1.5,.6,.35); root.add(blush); }
  for (const side of [-1,1]) {
    const armPivot = new THREE.Group(); armPivot.position.set(side * .55,1.88,0); root.add(armPivot);
    const arm = roundedPart(new THREE.CapsuleGeometry(.13,.55,5,10), skin); arm.position.y = -.37; armPivot.add(arm); armPivot.rotation.z = side * -.42; parts.arms.push(armPivot);
    const hand = roundedPart(new THREE.SphereGeometry(.16,14,10), skin); hand.position.y = -.72; arm.add(hand);
    const legPivot = new THREE.Group(); legPivot.position.set(side * .25,.9,0); root.add(legPivot);
    const leg = roundedPart(new THREE.CapsuleGeometry(.15,.52,5,10), cream); leg.position.y = -.37; legPivot.add(leg); parts.legs.push(legPivot);
    const foot = roundedPart(new THREE.SphereGeometry(.21,14,10), shoe); foot.scale.set(1,.65,1.65); foot.position.set(0,-.72,.12); legPivot.add(foot);
  }
  root.userData.parts = parts; root.traverse(object => { if (object.isMesh) object.renderOrder = ghost ? 2 : 1; });
  return root;
}
const character = makeCharacter(false); platform.add(character);
const ghostCharacter = makeCharacter(true); ghostCharacter.visible = false; ghostCharacter.position.z = -.08; ghostCharacter.scale.setScalar(1.015); platform.add(ghostCharacter);

const windBits = [];
for (let i = 0; i < 9; i++) { const bit = new THREE.Mesh(new THREE.CapsuleGeometry(.025,.35,3,7), mat(i % 2 ? 0xffffff : 0xf5b463)); bit.visible = false; bit.rotation.z = Math.PI / 2; scene.add(bit); windBits.push(bit); }

function clearHazards() {
  for (const item of hazardVisuals) { scene.remove(item.mesh); item.mesh.geometry.dispose(); item.mesh.material.dispose(); }
  hazardVisuals = [];
}
function warnHazard(event) {
  toast(`⚠ ${event.label}`); beep('warning');
  if (event.kind === 'gust') return;
  const length = Math.max(.001, Math.hypot(event.x,event.z));
  const nx=event.x/length,nz=event.z/length;
  const geometry = event.kind==='ball' ? new THREE.SphereGeometry(.48,22,16) : event.kind==='capsule' ? new THREE.CapsuleGeometry(.3,.65,7,14) : new THREE.BoxGeometry(.78,.55,.78);
  const colors = {ball:0xec6a42,capsule:0xd7a637,stomp:0x557a70};
  const mesh=roundedPart(geometry,new THREE.MeshStandardMaterial({color:colors[event.kind]||0xec6a42,roughness:.62,transparent:true,opacity:1}));
  mesh.position.set(-nx*5.5,1.05,-nz*5.5);mesh.rotation.set(.35,event.id*.7,.4);scene.add(mesh);
  hazardVisuals.push({mesh,event,nx,nz});
}
function impactHazard(event) {
  if(event.kind==='gust')windBits.forEach((bit,i)=>{bit.visible=true;bit.position.set(-event.x*7-i*.18,1.15+(i%3)*.42,-event.z*7+(i%2)*.6);});
  els.stage.classList.remove('hit');void els.stage.offsetWidth;els.stage.classList.add('hit');
  els['impact-flash'].classList.remove('flash');void els['impact-flash'].offsetWidth;els['impact-flash'].classList.add('flash');
  navigator.vibrate?.(event.kind==='stomp'?[35,25,50]:35);beep('impact');
}

function resize() {
  const rect = els.stage.getBoundingClientRect(); renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(els.stage); resize();

// Ragdoll -------------------------------------------------------------------
class Ragdoll {
  constructor(snapshot) {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) }); this.world.allowSleep = true;
    this.material = new CANNON.Material('doll'); this.floorMaterial = new CANNON.Material('floor');
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.material, this.floorMaterial, { friction: .72, restitution: .12 }));
    this.entries = [];
    this.floorBody = new CANNON.Body({ mass: 0, material: this.floorMaterial, shape: new CANNON.Plane() }); this.floorBody.quaternion.setFromEuler(-Math.PI / 2,0,0); this.world.addBody(this.floorBody);
    this.platformBody = new CANNON.Body({ mass: 0, material: this.floorMaterial, shape: new CANNON.Cylinder(2.5,2.5,.35,32) }); this.platformBody.position.set(0,.3,0); this.world.addBody(this.platformBody);
    const leanQuat = new CANNON.Quaternion(); leanQuat.setFromEuler(snapshot.leanZ, 0, -snapshot.leanX);
    const colors = { skin:0xf2c992, green:0x2c896d, dark:0x263a36, cream:0xfff3dc, shoe:0xe86b43 };
    const add = (name, shape, mass, position, color, scale) => {
      const body = new CANNON.Body({ mass, material:this.material, shape }); body.position.set(...position); body.quaternion.copy(leanQuat); body.linearDamping=.04; body.angularDamping=.2; this.world.addBody(body);
      let geometry; if (shape instanceof CANNON.Sphere) geometry = new THREE.SphereGeometry(shape.radius,18,13); else geometry = new THREE.BoxGeometry(shape.halfExtents.x*2,shape.halfExtents.y*2,shape.halfExtents.z*2);
      const mesh = roundedPart(geometry, mat(colors[color])); if (scale) mesh.scale.set(...scale); scene.add(mesh); this.entries.push({name,body,mesh}); return body;
    };
    const head=add('head',new CANNON.Sphere(.56),1.1,[0,3.05,0],'skin',[1,.96,.92]);
    const torso=add('torso',new CANNON.Box(new CANNON.Vec3(.48,.55,.34)),2.2,[0,2.05,0],'green');
    const pelvis=add('pelvis',new CANNON.Box(new CANNON.Vec3(.37,.29,.3)),1.3,[0,1.25,0],'dark');
    const arms=[],legs=[];
    for(const side of [-1,1]){ arms.push(add('arm',new CANNON.Box(new CANNON.Vec3(.14,.42,.14)),.55,[side*.68,2.04,0],'skin')); legs.push(add('leg',new CANNON.Box(new CANNON.Vec3(.17,.48,.18)),.85,[side*.26,.62,0],'cream')); }
    const link=(a,b,pa,pb,maxForce=2e5)=>this.world.addConstraint(new CANNON.PointToPointConstraint(a,new CANNON.Vec3(...pa),b,new CANNON.Vec3(...pb),maxForce));
    link(torso,head,[0,.54,0],[0,-.5,0]); link(torso,pelvis,[0,-.52,0],[0,.28,0]); link(torso,arms[0],[-.47,.35,0],[0,.4,0]); link(torso,arms[1],[.47,.35,0],[0,.4,0]); link(pelvis,legs[0],[-.23,-.27,0],[0,.46,0]); link(pelvis,legs[1],[.23,-.27,0],[0,.46,0]);
    const push = new CANNON.Vec3(snapshot.velocityX*2.2+.5,snapshot.reason==='clear'?1.1:.25,snapshot.velocityZ*2.2+.2); torso.applyImpulse(push,torso.position); head.angularVelocity.set(snapshot.velocityZ*2.5,1,snapshot.velocityX*-2.5);
  }
  updatePlatform(snapshot) { this.platformBody.quaternion.setFromEuler(snapshot.platformZ,0,-snapshot.platformX); }
  step(dt) { this.world.step(1/60,dt,3); for(const {body,mesh} of this.entries){ mesh.position.copy(body.position); mesh.quaternion.copy(body.quaternion); } }
  dispose() { for(const {mesh} of this.entries){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();} this.entries=[]; }
}

function setCharacterPose(target, snap, elapsed) {
  target.rotation.z = -snap.leanX; target.rotation.x = snap.leanZ;
  const danger = snap.danger;
  const parts = target.userData.parts;
  parts.arms[0].rotation.z = -.42 - snap.leanX * 1.25 - Math.sin(elapsed*8)*danger*.22;
  parts.arms[1].rotation.z = .42 - snap.leanX * 1.25 + Math.sin(elapsed*8)*danger*.22;
  parts.arms[0].rotation.x = snap.leanZ*.85; parts.arms[1].rotation.x = snap.leanZ*.85;
  parts.legs[0].rotation.z = snap.leanX*.25; parts.legs[1].rotation.z = snap.leanX*.25;
  for(const eye of parts.eyes)eye.scale.y=Math.max(.28,1.35-danger*.85);
  parts.mouth.scale.setScalar(1+danger*.9);
}
function visualUpdate(dt) {
  const snap = game?.snapshot();
  if (snap) {
    platform.rotation.z += (-snap.platformX - platform.rotation.z) * Math.min(1,dt*8);
    platform.rotation.x += (snap.platformZ - platform.rotation.x) * Math.min(1,dt*8);
    if (character.visible) setCharacterPose(character,snap,snap.time);
    if (ghostGame && ghostCharacter.visible) setCharacterPose(ghostCharacter,ghostGame.snapshot(),snap.time);
    if(ragdoll){ragdoll.updatePlatform(snap);ragdoll.step(dt);}
  } else { platform.rotation.z=Math.sin(performance.now()/1300)*.025; platform.rotation.x=Math.sin(performance.now()/1700)*.02; character.rotation.z=Math.sin(performance.now()/900)*.025; }
  windBits.forEach((bit,i)=>{ if(bit.visible){bit.position.x+=dt*5.5;if(bit.position.x>5)bit.visible=false;bit.rotation.x+=dt*(i+1);}});
  if(snap)for(const item of hazardVisuals){const age=snap.time-item.event.warnAt;const p=clamp(age/.72,0,1);const after=clamp((age-.72)/.55,0,1);item.mesh.position.set(-item.nx*5.5*(1-p)+item.nx*4*after,1.05+Math.sin(p*Math.PI)*.55,-item.nz*5.5*(1-p)+item.nz*4*after);item.mesh.rotation.x+=dt*5;item.mesh.rotation.z+=dt*4;item.mesh.material.opacity=1-after;}
  hazardVisuals=hazardVisuals.filter(item=>{if(item.mesh.material.opacity>.02)return true;scene.remove(item.mesh);item.mesh.geometry.dispose();item.mesh.material.dispose();return false;});
  renderer.render(scene,camera);
}

// The whole 3D stage is the controller. Drag from any point like grabbing the character.
function setControl(x,z){ control.x=clamp(x,-1,1);control.z=clamp(z,-1,1);game?.setControl(control.x,control.z); }
function moveTouch(event){
  const dx=event.clientX-dragStart.x,dy=event.clientY-dragStart.y;setControl(dx/72,dy/72);
  const length=Math.hypot(dx,dy),scale=length>46?46/length:1;els['touch-dot'].style.transform=`translate(${dx*scale}px,${dy*scale}px)`;
}
els.stage.addEventListener('pointerdown',event=>{
  if((mode!=='playing'&&mode!=='countdown')||event.target.closest?.('button'))return;event.preventDefault();dragging=true;firstTouch=true;els['touch-guide'].hidden=true;
  dragStart={x:event.clientX,y:event.clientY};const r=els.stage.getBoundingClientRect();els['touch-origin'].style.left=`${event.clientX-r.left}px`;els['touch-origin'].style.top=`${event.clientY-r.top}px`;els['touch-dot'].style.transform='translate(0,0)';els['touch-origin'].hidden=false;els.stage.setPointerCapture(event.pointerId);
});
els.stage.addEventListener('pointermove',event=>{if(dragging){event.preventDefault();moveTouch(event);}});
for(const type of ['pointerup','pointercancel','lostpointercapture'])els.stage.addEventListener(type,()=>{if(!dragging)return;dragging=false;setControl(0,0);els['touch-origin'].hidden=true;});
const keys=new Set();document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d','W','A','S','D'].includes(e.key)){e.preventDefault();keys.add(e.key);keyboardControl();}if((e.key==='p'||e.key==='P'||e.key==='Escape')&&mode==='playing')pause();});document.addEventListener('keyup',e=>{keys.delete(e.key);keyboardControl();});
function keyboardControl(){let x=0,z=0;if(keys.has('ArrowLeft')||keys.has('a')||keys.has('A'))x--;if(keys.has('ArrowRight')||keys.has('d')||keys.has('D'))x++;if(keys.has('ArrowUp')||keys.has('w')||keys.has('W'))z--;if(keys.has('ArrowDown')||keys.has('s')||keys.has('S'))z++;setControl(x,z);}

function startRound(seed=currentSeed){
  if(!validSeed(seed)||mode==='loading')return;
  currentSeed=seed;if(ragdoll){ragdoll.dispose();ragdoll=null;}clearHazards();game=new BalanceGame(seed);ghostGame=challengeReplay.length?new BalanceGame(seed):null;replaySamples=[];sampleAt=0;setControl(0,0);character.visible=true;ghostCharacter.visible=!!ghostGame;firstTouch=false;
  els.score.textContent='0';els.combo.hidden=true;els['touch-guide'].hidden=false;els['touch-origin'].hidden=true;
  mode='countdown';countdownAt=3;els['start-panel'].hidden=true;els.hud.hidden=false;els.pause.hidden=false;els.countdown.hidden=false;els.count.textContent='3';els['result-dialog'].close();beep('count');track('game_start',{challenge:challengeTarget>0});
}
function pause(){if(mode!=='playing'&&mode!=='countdown')return;mode=mode==='playing'?'paused':'countdown-paused';game?.pause();els['pause-dialog'].showModal();}
function resume(){if(!mode.includes('paused'))return;const wasCountdown=mode==='countdown-paused';mode=wasCountdown?'countdown':'playing';if(!wasCountdown)game?.start();els['pause-dialog'].close();lastFrame=performance.now();}
function home(){mode='home';game=null;ghostGame=null;clearHazards();if(ragdoll){ragdoll.dispose();ragdoll=null;}character.visible=true;ghostCharacter.visible=false;platform.rotation.set(0,0,0);setControl(0,0);els['start-panel'].hidden=false;els.hud.hidden=true;els.pause.hidden=true;els.countdown.hidden=true;els['touch-guide'].hidden=true;els['touch-origin'].hidden=true;els['pause-dialog'].close();}
function toast(message){els.toast.textContent=message;els.toast.classList.add('show');toastTimer=1.5;}
function finishRound(){
  const snap=game.snapshot();mode='ending';dragging=false;setControl(0,0);els['touch-origin'].hidden=true;els['touch-guide'].hidden=true;plays++;closeCalls+=snap.recoveries;const previousBest=best;if(snap.time>best)best=snap.time;const won=challengeTarget>0&&(challengeTarget>=ROUND_SECONDS-.005?snap.reason==='clear':snap.time>challengeTarget+.004);if(won)wins++;persist();updateStats();
  character.visible=false;ghostCharacter.visible=false;ragdoll=new Ragdoll(snap);resultTimer=1.15;beep(snap.reason==='clear'?'clear':'fall');track('game_complete',{seconds:+snap.time.toFixed(2),reason:snap.reason,recoveries:snap.recoveries,challenge_won:won});
  els['result-time'].textContent=snap.time.toFixed(2);els['result-badges'].replaceChildren();
  const badges=[];if(snap.reason==='clear')badges.push('20초 생존');if(snap.recoveries)badges.push(`기적의 회복 ${snap.recoveries}회`);if(snap.score>=2500)badges.push(`${snap.score.toLocaleString()}점`);if(snap.time>previousBest)badges.push('새로운 최고기록');if(won)badges.push('친구 기록 격파');if(snap.time<5)badges.push('순식간에 퇴장');
  badges.forEach(label=>{const span=document.createElement('span');span.textContent=label;els['result-badges'].append(span);});
  if(snap.reason==='clear'){els['result-label'].textContent='생존 성공';els['result-title'].textContent='난장판에서 살아남았습니다!';els['result-message'].textContent=`${snap.score.toLocaleString()}점 · 회복 ${snap.recoveries}회. 이제 친구에게 같은 난장판을 보내보세요.`;}
  else if(won){els['result-label'].textContent='도전 성공';els['result-title'].textContent='친구 기록을 넘어섰습니다.';els['result-message'].textContent=`${(snap.time-challengeTarget).toFixed(2)}초 차이로 승리했습니다. 다시 도전장을 보낼 차례입니다.`;}
  else if(challengeTarget>0){els['result-label'].textContent='아슬아슬한 패배';els['result-title'].textContent='친구가 아직 앞서 있습니다.';els['result-message'].textContent=`앞으로 ${(challengeTarget-snap.time).toFixed(2)}초. 같은 패턴으로 다시 도전할 수 있습니다.`;}
  else{els['result-label'].textContent='이번 기록';els['result-title'].textContent=snap.time>15?'거의 다 왔는데!':'한 번만 더 하면 넘을 수 있습니다.';els['result-message'].textContent=`${snap.score.toLocaleString()}점 · 오늘 내 최고기록은 ${best.toFixed(2)}초입니다. 같은 난장판은 익숙해질수록 유리합니다.`;}
}
function showResult(){if(!els['result-dialog'].open){els['share-status'].textContent='';els['result-dialog'].showModal();}}

function update(dt){
  if(mode==='countdown'){countdownAt-=dt;const n=Math.max(1,Math.ceil(countdownAt));if(els.count.textContent!==String(n)){els.count.textContent=String(n);beep('count');}if(countdownAt<=0){mode='playing';els.countdown.hidden=true;game.start();ghostGame?.start();toast('화면을 누르고 끌어 붙잡기!');beep('start');}}
  if(mode==='playing'){
    game.setControl(control.x,control.z);for(const event of game.advance(dt)){if(event.type==='warning')warnHazard(event);if(event.type==='impact')impactHazard(event);if(event.type==='recovery'){toast(`살았다! 회복 콤보 ×${event.combo}`);navigator.vibrate?.(18);beep('recover');}if(event.type==='end')finishRound();}
    if(ghostGame){const index=Math.min(challengeReplay.length-1,Math.floor(ghostGame.time*10));const sample=challengeReplay[index]||[0,0];ghostGame.setControl(sample[0],sample[1]);ghostGame.advance(dt);}
    const snap=game.snapshot();while(snap.time>=sampleAt&&replaySamples.length<300){replaySamples.push([control.x,control.z]);sampleAt+=.1;}
    els.timer.textContent=snap.time.toFixed(2);els.score.textContent=snap.score.toLocaleString();els['danger-fill'].style.width=`${Math.round(snap.danger*100)}%`;els.combo.hidden=snap.combo<1;els.combo.textContent=`COMBO ×${Math.max(1,snap.combo)}`;
  }
  if(mode==='ending'){resultTimer-=dt;if(resultTimer<=0){mode='result';showResult();}}
  if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)els.toast.classList.remove('show');}
}
function frame(now){const dt=clamp((now-lastFrame)/1000,0,.1);lastFrame=now;update(dt);visualUpdate(dt);requestAnimationFrame(frame);}requestAnimationFrame(frame);

// Sound, sharing and dialogs ------------------------------------------------
function unlockAudio(){if(!sound)return;const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audio ||= new Audio();if(audio.state==='suspended')audio.resume().catch(()=>{});}
function beep(kind){if(!sound)return;unlockAudio();if(!audio||audio.state!=='running')return;const sets={count:[370],start:[390,560,790],warning:[720,610],impact:[150,95],recover:[630,850,1040],fall:[240,160,100],clear:[500,650,820,1050]}[kind]||[460];sets.forEach((frequency,i)=>{const osc=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+i*.075;osc.type=kind==='impact'||kind==='fall'?'triangle':'sine';osc.frequency.setValueAtTime(frequency,at);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.07,at+.01);gain.gain.exponentialRampToValueAtTime(.0001,at+.15);osc.connect(gain).connect(audio.destination);osc.start(at);osc.stop(at+.17);});}
function challengeUrl(){const url=new URL(canonical);url.searchParams.set('c',currentSeed);url.searchParams.set('t',String(Math.round((game?.time||best)*1000)));const encoded=encodeReplay(replaySamples);if(encoded)url.searchParams.set('g',encoded);return url.href;}
async function shareChallenge(){const seconds=(game?.time||best).toFixed(2);const url=challengeUrl();const text=`나는 《중심잡아!》에서 ${seconds}초 생존했습니다. 같은 난장판에서 내 기록을 넘겨보세요.`;try{if(navigator.share){await navigator.share({title:'중심잡아! 생존 도전',text,url});els['share-status'].textContent='도전장을 보냈습니다.';}else{await navigator.clipboard.writeText(`${text}\n${url}`);els['share-status'].textContent='도전 링크를 복사했습니다.';}track('challenge_share',{seconds:Number(seconds)});}catch(error){if(error?.name!=='AbortError'){try{await navigator.clipboard.writeText(url);els['share-status'].textContent='도전 링크를 복사했습니다.';}catch{els['share-status'].textContent=url;}}}}
els.start.addEventListener('click',()=>startRound(currentSeed));els.retry.addEventListener('click',()=>startRound(currentSeed));els['new-pattern'].addEventListener('click',()=>{challengeTarget=0;challengeReplay=[];currentSeed=randomSeed();configureChallenge();startRound(currentSeed);});els.challenge.addEventListener('click',shareChallenge);els.pause.addEventListener('click',pause);els.resume.addEventListener('click',resume);els.quit.addEventListener('click',home);els.info.addEventListener('click',()=>{if(mode==='playing'||mode==='countdown'){pause();return;}els['info-dialog'].showModal();});
els.sound.addEventListener('click',()=>{sound=!sound;persist();updateStats();unlockAudio();if(sound)beep('recover');});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
els['result-dialog'].addEventListener('cancel',event=>{event.preventDefault();home();els['result-dialog'].close();});els['result-dialog'].addEventListener('close',()=>{if(mode==='result')home();});els['pause-dialog'].addEventListener('cancel',event=>{event.preventDefault();resume();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(mode==='playing'||mode==='countdown'))pause();});window.addEventListener('blur',()=>{keys.clear();if(mode==='playing')pause();});

updateStats();configureChallenge();
setTimeout(()=>{mode='home';els.loading.hidden=true;els.start.disabled=false;els['start-copy'].textContent=challengeTarget?'친구 기록에 도전':'20초 생존 시작';resize();},350);
