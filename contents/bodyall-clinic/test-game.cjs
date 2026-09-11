/* Run: node test-game.cjs — no dependencies or network. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const story=require('./story.js');
const {ClinicGame,observations,questions}=require('./engine.js');
const expected={O1:['A','잠깐 감별사'],O2:['B','퇴근 최종 승인자'],O3:['B','내일부터 압수반'],O4:['A','방금 추적자'],O5:['C','본문 열람자'],Q1:['A','경과 기록가'],Q2:['B','퇴근 동행자'],Q3:['C','괜찮아요 번역기']};
function drain(g){let limit=40;while(g.phase==='dialogue'){assert.ok(--limit>0,'dialogue must finish');g.next();}}
let paths=0;
const endings=new Set(),cards=new Set();
for(const o of observations)for(const q of questions)for(const selected of [o,q]){
  const g=new ClinicGame();
  assert.equal(g.choose(o),false,'cannot choose before starting');
  assert.equal(g.explain(),false,'cannot skip to explanation');
  assert.equal(g.start(),true);assert.equal(g.start(),false,'cannot start twice mid-dialogue');
  drain(g);assert.equal(g.phase,'observe');assert.deepEqual(g.available(),observations);
  assert.equal(g.choose('Q1'),false);assert.equal(g.choose(o),true);drain(g);
  assert.equal(g.phase,'question');assert.deepEqual(g.available(),questions);
  assert.equal(g.choose(q),true);drain(g);
  assert.equal(g.phase,'connect');assert.deepEqual(g.available(),[o,q]);
  const unavailable=Object.keys(expected).find(id=>![o,q].includes(id));
  assert.equal(g.choose(unavailable),false,'unseen clues cannot be selected');
  assert.equal(g.choose(selected),true);drain(g);assert.equal(g.phase,'discovery');
  assert.equal(g.explain(),true);assert.deepEqual(g.lines.slice(0,4),story.common,'all paths use the same clinic explanation');
  drain(g);assert.equal(g.phase,'ending');assert.equal(g.next(),false);
  const r=g.result();assert.equal(r.id,selected);assert.equal(r.ending,expected[selected][0]);assert.equal(r.nickname,expected[selected][1]);
  assert.ok(r.story&&r.description&&r.shareHeadline&&r.lastLine);
  endings.add(r.ending);cards.add(r.shareHeadline);
  assert.equal(g.start(true),true);assert.deepEqual(g.previous,{observation:o,question:q,selected});
  assert.equal(g.observation,null);assert.equal(g.question,null);assert.equal(g.selected,null);assert.deepEqual(g.lines,story.replay);drain(g);assert.equal(g.phase,'observe');
  paths++;
}
assert.equal(paths,30);assert.equal(endings.size,3);assert.equal(cards.size,8);
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'style.css'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
for(const file of ['story.js','engine.js','app.js'])new vm.Script(fs.readFileSync(path.join(__dirname,file),'utf8'),{filename:file});
for(const m of html.matchAll(/(?:src|href)="(?!https?:|#)([^"?]+)[^"]*"/g))assert.ok(fs.existsSync(path.join(__dirname,m[1])),`missing ${m[1]}`);
for(const m of css.matchAll(/url\(['"]?([^)'"?]+)['"]?\)/g))assert.ok(fs.existsSync(path.join(__dirname,m[1])),`missing ${m[1]}`);
for(const m of app.matchAll(/(?:sheet|background)\.src='([^']+)'/g))assert.ok(fs.existsSync(path.join(__dirname,m[1])),`missing ${m[1]}`);
assert.ok(!/maximum-scale|user-scalable=no/.test(html),'browser zoom must remain available');
assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/.test(app),'no outbound tracking or health storage');
console.log(JSON.stringify({pathsVerified:paths,endingTypes:endings.size,distinctShareCardTexts:cards.size,invalidChoicesBlocked:true,replayVerified:true,syntaxAndAssets:'PASS',browserTesting:'not performed'},null,2));
