'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const D=require('./data-v2.js'),E=require('./engine-v2.js'),legacyD=require('./data.js'),legacyE=require('./engine.js');
const A=require('./analytics.js'),Stats=require('./stats/report.js'),{boot}=require('./test-startup.cjs');
function check(a){
 const r=E.getResult(a);assert.deepEqual(r,E.getResult(a));assert.notEqual(r.kind,'fog');
 const u=new URL(E.shareURL(r));assert.equal(u.pathname,'/contents/bodyall-clinic/result/v2/'+r.id+'/');assert.equal(u.search,'?share=invite1');
 const read=E.sharedResult(r.id,u.hash);assert.deepEqual(read.analysis,r.analysis);assert.equal(read.faint,r.faint);
 if(r.kind==='person'){assert(r.evidence.length>=1&&r.evidence.length<=2);assert(r.evidence.every(e=>a[e.question]===e.code&&D.analysis[e.question][e.code.charCodeAt(0)-65]===e.text));}
 assert(E.shareText(r).includes(r.name));assert(E.shareText(r).includes(r.title));assert(r.analysis.every(t=>E.shareText(r).includes(t)));
 return r;
}
(async()=>{
 assert.equal(D.questions.length,10);assert.equal(D.people.length,22);assert.equal(D.people.filter(p=>p.family==='fun').length,10);
 assert(!D.questions.some(q=>/성별|남성|여성|불편한 곳/.test(q.text)));
 D.questions.forEach(q=>assert.deepEqual(q.answers.map(a=>a.code),['A','B','C','D','N']));
 assert.throws(()=>E.getResult(['E',...Array(9).fill('N')]));assert.throws(()=>E.getResult([]));
 const horse=check(Array(10).fill('N'));assert.equal(horse.name,'하후돈이 타던 말');assert.equal(horse.revealQuote,'자네는 전생에 사람이 아니었나 보구먼…');
 for(const p of D.people)assert.equal(check([...p.pattern]).id,p.id);
 for(let q=0;q<10;q++)for(const c of 'ABCD'){const a=Array(10).fill('N');a[q]=c;const r=check(a);assert(r.faint);assert.notEqual(r.id,'horse');}
 for(let q=0;q<10;q++)for(let z=q+1;z<10;z++)for(const c of 'ABCD')for(const d of 'ABCD'){const a=Array(10).fill('N');a[q]=c;a[z]=d;assert.notEqual(check(a).id,'horse');}
 for(const p of D.people){
  assert.equal(new URL(p.biographyURL).hostname,'ko.wikipedia.org');
  const page=fs.readFileSync(path.join(__dirname,'result/v2',p.id,'index.html'),'utf8');assert(page.includes('<html lang="ko">'));assert(page.includes(p.name));assert(page.includes('og:title'));assert(page.includes('og:description'));assert(page.includes('내 전생 알아보기'));assert(page.includes('engine-v2.js'));
 }
 for(const p of legacyD.people){const r=legacyE.getResult(['A','D','E',...p.pattern]);const url=legacyE.shareURL(r);assert(!url.includes('/v2/'));assert.deepEqual(legacyE.sharedResult(p.id,new URL(url).hash).analysis,r.analysis);assert(!fs.readFileSync(path.join(__dirname,'result',p.id,'index.html'),'utf8').includes('engine-v2.js'));}
 assert.throws(()=>E.previewResult('<script>'));assert.equal(E.friend('__proto__'),null);
 for(const hash of ['#a=99','#a=-1','#a=0.0','#a=0.1','#a=%3Cscript%3E'])assert.deepEqual(E.sharedResult('zhuge',hash).analysis,E.previewResult('zhuge').analysis);
 const config={enabled:true,measurementId:'G-TEST123456',allowedHost:'wiki.body-all.co.kr',basePath:'/contents/bodyall-clinic/',version:'huata-v2'},sent=[];
 const tracker=A.create({config,href:'https://wiki.body-all.co.kr/contents/bodyall-clinic/?r=jiao&from=friend&secret=private#answers=private',send:e=>sent.push(e)});
 tracker.visit();tracker.capture({name:'game_start',version:'huata-v2'});assert.equal(sent.length,0);tracker.choose('granted');tracker.activate();
 tracker.capture({name:'game_complete',result:'jiao',answers:'private'});tracker.capture({name:'share_attempt',result:'jiao'});tracker.capture({name:'share_link_copied',result:'jiao'});
 assert.equal(sent.filter(e=>e.name==='huata_v2_complete').length,1);assert.equal(sent.filter(e=>e.name==='huata_v2_share_intent').length,1);assert(sent.some(e=>e.name==='huata_v2_friend_start'));assert(!JSON.stringify(sent).includes('private'));
 assert.equal(A.context('https://wiki.body-all.co.kr/contents/bodyall-clinic/result/v2/liushan/#a=5.27','',config).version,'huata-v2');assert.equal(A.context('https://wiki.body-all.co.kr/contents/bodyall-clinic/result/sun/','',config).version,'huata-1');assert.equal(A.context('https://wiki.body-all.co.kr/contents/bodyall-clinic/result/liushan/','',config),null);
 const mixed={huata_start:100,huata_complete:90,huata_result_sun:90,huata_v2_start:20,huata_v2_complete:20,huata_v2_result_sun:9,huata_v2_result_jiao:9,huata_v2_result_horse:2,huata_v2_share_intent:4};
 const stats=Stats.summarize(mixed);assert.equal(stats.version,'v2');assert.equal(stats.starts,20);assert.equal(stats.ordinary,18);assert.equal(stats.coolRate,.5);assert.equal(stats.funRate,.5);assert.equal(stats.special,2);assert.equal(Stats.summarize(mixed,'v1').completed,90);
 for(const id of ['jiao','li','liushan','yuan','xu','zhuge','horse']){
  const answers=id==='horse'?Array(10).fill('N'):[...D.people.find(p=>p.id===id).pattern];
  const h=await boot({firstCode:answers[0]});for(let q=1;q<10;q++){h.ids.get('answers').children['ABCDN'.indexOf(answers[q])].click();await h.advance(q===9?1250:950);}
  await h.advance(3200);assert.equal(h.ids.get('result-name').textContent,E.friend(id).name);assert.equal(h.ids.get('share').textContent,'내 결과 공유하기 ↗');assert.equal(h.events.filter(e=>e.name==='game_complete').length,1);assert(!h.ids.get('result-view').hidden);
  if(id==='horse')assert(h.ids.get('reveal-caption').textContent.includes('사람이 아니었나'));
 }
 console.log(JSON.stringify({canonical:22,partialAnswerCases:760,allUnknownHorse:true,legacyLinks:13,versionedRoundTrips:true,evidenceFromAnswers:true,gameplayPaths:7,analyticsVersionIsolation:true,comedyRatioExcludesHorse:true,browserTested:false},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
