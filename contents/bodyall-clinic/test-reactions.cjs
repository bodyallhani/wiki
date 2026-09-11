'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const D=require('./data-v2.js'),R=require('./reactions-v2.js'),A=require('./actor.js');
let checked=0;
for(let i=0;i<D.questions.length;i++)for(const a of D.questions[i].answers){
 const answers=Array(10).fill('A');answers[i]=a.code;
 const response=R.forAnswer(i,a.code,answers);
 assert(response.line.length>5&&response.line.length<=32);
 assert(R.expressions.includes(response.expression));
 assert(['nod','tilt','lean','recoil','chuckle'].includes(response.gesture));checked++;
}
assert.notEqual(R.forAnswer(1,'A').expression,R.forAnswer(1,'B').expression);
assert.notEqual(R.forAnswer(6,'A').line,R.forAnswer(6,'B').line);
assert.notEqual(R.forAnswer(3,'N',['N','N','N','N']).line,R.forAnswer(3,'N',['A','A','A','N']).line);
assert(R.forAnswer(9,'N',Array(10).fill('N')).line.includes('거울'));
// The real performance controller, with a deterministic clock: no browser is simulated.
let now=0,serial=0,active=true,reduce=false;const pending=new Map();
const clock={setTimeout(fn,delay){const id=++serial;pending.set(id,{at:now+delay,fn});return id;},clearTimeout(id){pending.delete(id);}};
function advance(ms){const end=now+ms;for(;;){const next=[...pending.entries()].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;pending.delete(next[0]);now=next[1].at;next[1].fn();}now=end;}
const face={style:{}},gesture={dataset:{},offsetWidth:1};
const actor=A.create({face,gesture,canAnimate:()=>active,reduced:()=>reduce,clock,random:()=>0});
actor.start();actor.start();assert.equal(pending.size,1);
advance(1100);assert.equal(face.style.backgroundPosition,'0% 100%');
advance(145);assert.equal(face.style.backgroundPosition,'0% 0%');
actor.react('surprised','recoil');assert.equal(face.style.backgroundPosition,'100% 0%');assert.equal(gesture.dataset.motion,'recoil');
advance(530);assert.equal(face.style.backgroundPosition,'100% 100%');
actor.react('thoughtful','tilt');assert(face.style.backgroundPosition.endsWith('% 0%'));assert.equal(gesture.dataset.motion,'tilt');
advance(2450);assert.equal(face.style.backgroundPosition,'0% 0%');
active=false;actor.stop();assert.equal(pending.size,0);advance(10000);assert.equal(gesture.dataset.motion,'rest');
active=true;actor.start();advance(1100);assert.equal(face.style.backgroundPosition,'0% 100%');
actor.reset();assert.equal(pending.size,0);assert.equal(face.style.backgroundPosition,'0% 0%');
reduce=true;actor.start();assert.equal(pending.size,0);actor.react('warm','chuckle');assert.equal(gesture.dataset.motion,'rest');advance(2450);assert.equal(pending.size,0);
actor.stop();
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
assert(html.indexOf('reactions-v2.js')<html.indexOf('app.js'));
assert(html.indexOf('actor.js')<html.indexOf('app.js'));
for(const source of [html,fs.readFileSync(path.join(__dirname,'style.css'),'utf8'),fs.readFileSync(path.join(__dirname,'app.js'),'utf8')]){
 for(const m of source.matchAll(/assets\/[a-z0-9-]+\.webp/g))assert(fs.existsSync(path.join(__dirname,m[0])),'Missing '+m[0]);
}
console.log(JSON.stringify({answerReactions:checked,blinkAndExpressionTiming:true,repeatedStartNoDuplicateLoop:true,pauseAndRestart:true,reducedMotion:true,localAssets:true,browserTested:false},null,2));
