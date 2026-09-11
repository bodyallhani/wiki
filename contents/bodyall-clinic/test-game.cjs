'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const D=require('./data.js'),E=require('./engine.js');
assert.equal(D.questions.length,10);assert.equal(D.people.length,12);
D.questions.forEach(q=>{assert.equal(q.answers.filter(a=>a.code==='N').length,1);assert(q.text.length<35);});
const allUnknown=Array(10).fill('N');assert.equal(E.getResult(allUnknown).id,'horse');
assert.equal(E.getResult(['A',...allUnknown.slice(1)]).id,'fog');
assert.equal(E.getResult(['N','N','E',...allUnknown.slice(3)]).id,'fog');
for(let i=0;i<10;i++){const answers=[...allUnknown];answers[i]='A';assert.notEqual(E.getResult(answers).id,'horse');}
for(const p of D.people){assert.equal(E.getResult(['A','D','E',...p.pattern]).id,p.id);}
const distribution=Object.fromEntries(D.people.map(p=>[p.id,0]));let minEvidence=10;
for(let n=0;n<4**7;n++){
 let k=n;const selected=[];for(let i=0;i<7;i++){selected.push('ABCD'[k%4]);k=Math.floor(k/4);}
 const answers=['A','D','E',...selected],r=E.getResult(answers);distribution[r.id]++;
 minEvidence=Math.min(minEvidence,r.analysis.length);
 assert(r.evidence.every(e=>answers[e.question]===e.code));assert(r.analysis.every(text=>r.evidence.some(e=>e.text===text)));
 const changed=E.getResult(['B','A','C',...selected]);assert.equal(changed.id,r.id);assert.deepEqual(changed.analysis,r.analysis);
 const url=new URL(E.shareURL(r));assert.deepEqual([...url.searchParams.keys()],['r','from','v']);assert.equal(url.searchParams.get('r'),r.id);
}
assert.equal(minEvidence,2);Object.values(distribution).forEach(count=>assert(count>0));
const faint=E.getResult(['A','D','E','A','N','N','N','N','N','N']);assert(faint.faint);assert.equal(faint.analysis.length,1);
assert.equal(E.friend('<script>'),null);assert.throws(()=>E.getResult([]));
assert(E.shareText(E.friend('cao')).includes('조조였대'));
assert(E.shareText(E.friend('zhuge')).includes('제갈량이었대'));
const source=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
assert(!source.includes('localStorage'));assert(!source.includes('fetch('));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
for(const m of source.matchAll(/\$\('([^']+)'\)/g))assert(ids.includes(m[1]),'Missing DOM id '+m[1]);
for(const name of ['data.js','engine.js','app.js','style.css'])assert(html.includes(name));
console.log(JSON.stringify({cases:4**7,people:12,distribution,allUnknownHorse:true,noSymptomsInMatching:true,allEvidenceFromAnswers:true,shareOnlyResult:true,domTargetsValid:true,browserTested:false},null,2));
