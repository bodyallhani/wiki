import assert from 'node:assert/strict';
import { BalanceGame, ROUND_SECONDS, validSeed, encodeReplay, decodeReplay } from './engine.mjs';

assert.equal(validSeed('bca-20260922'), true);
assert.equal(validSeed('../bad'), false);
const a = new BalanceGame('bca-deterministic');
const b = new BalanceGame('bca-deterministic');
a.start(); b.start();
for (let i=0;i<1800 && a.state==='playing';i++) { const x=Math.sin(i/80)*.6,z=Math.cos(i/95)*.4;a.setControl(x,z);b.setControl(x,z);a.advance(1/60);b.advance(1/60); }
assert.deepEqual(a.snapshot(),b.snapshot(),'same seed and input must produce the same result');
const encoded=encodeReplay([[0,0],[1,-1],[-.5,.5]]);const decoded=decodeReplay(encoded);
assert.equal(decoded.length,3);assert.ok(Math.abs(decoded[1][0]-1)<.01);assert.ok(Math.abs(decoded[1][1]+1)<.01);
const idle=new BalanceGame('bca-idle-test');idle.start();let sawWarning=false,sawImpact=false;for(let i=0;i<1800&&idle.state==='playing';i++){for(const event of idle.advance(1/60)){if(event.type==='warning')sawWarning=true;if(event.type==='impact')sawImpact=true;}}assert.equal(idle.state,'ended');assert.ok(idle.time>0&&idle.time<=ROUND_SECONDS);assert.ok(sawWarning&&sawImpact,'hazards must warn before impact');
const guided=new BalanceGame('bca-20260922');guided.start();for(let i=0;i<1805&&guided.state==='playing';i++){const s=guided.snapshot();guided.setControl(s.leanX*1.7+s.velocityX*.35,s.leanZ*1.7+s.velocityZ*.35);guided.advance(1/60);}assert.equal(guided.reason,'clear','a responsive player/controller must be able to clear the round');
console.log('center-balance engine tests passed',a.snapshot());
