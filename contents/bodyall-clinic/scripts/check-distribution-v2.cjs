'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),D=require('../data-v2.js'),E=require('../engine-v2.js');
const counts=Object.fromEntries(D.people.map(p=>[p.id,0]));let minimum=10;
for(let n=0;n<4**10;n++){
 let k=n;const answers=Array(10);for(let q=9;q>=0;q--){answers[q]='ABCD'[k%4];k=Math.floor(k/4);}
 const r=E.rankAnswers(answers);counts[r.person.id]++;minimum=Math.min(minimum,r.count);
}
const family=f=>D.people.filter(p=>p.family===f).reduce((n,p)=>n+counts[p.id],0);
assert.equal(family('cool'),556636);assert.equal(family('fun'),491940);assert.equal(minimum,2);assert(Object.values(counts).every(n=>n>0));
const report={version:D.version,cases:4**10,cool:family('cool'),fun:family('fun'),coolPercent:100*family('cool')/4**10,funPercent:100*family('fun')/4**10,minimumMatchingAnswers:minimum,counts,meaning:'Uniform answer-combination coverage, not actual user distribution or psychometric validation.'};
fs.writeFileSync(path.join(__dirname,'../MATCHING-v2.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
