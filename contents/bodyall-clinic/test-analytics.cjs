'use strict';
const assert=require('node:assert/strict'),A=require('./analytics.js'),{parseCSV,summarize}=require('./stats/report.js'),{boot}=require('./test-startup.cjs');
const config={enabled:true,measurementId:'G-TEST123456',allowedHost:'wiki.body-all.co.kr',basePath:'/contents/bodyall-clinic/',version:'test'};
const base='https://wiki.body-all.co.kr/contents/bodyall-clinic/';
function fixture(options={}){const sent=[],stored=new Map();const storage={getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)};
 const tracker=A.create({config,href:base+'?email=secret@example.com&src=kakao#answers=private',referrer:'https://example.org/health/patient?q=private',storage,send:e=>sent.push(e),now:()=>1000,...options});return {tracker,sent,stored};}
function start(t){t.capture({name:'game_start'});}
function finish(t,id='sun'){t.capture({name:'game_complete',result:id,answers:['private'],gender:'private',symptoms:'private'});}
function accept(t){t.choose('granted');t.activate();}
(async()=>{
 const f=fixture(),t=f.tracker;t.visit();start(t);t.capture({name:'question_view',question:1,answer:'private'});finish(t);
 assert.equal(f.sent.length,0);accept(t);assert.equal(f.sent.filter(e=>e.name==='huata_start').length,1);
 assert.equal(f.sent.filter(e=>e.name==='huata_complete').length,1);assert(!JSON.stringify(f.sent).includes('private'));assert(!JSON.stringify(f.sent).includes('secret@'));
 assert(f.sent.every(e=>e.params.page_location===base&&e.params.page_referrer==='https://example.org/'));
 for(let i=0;i<3;i++){t.capture({name:'share_attempt'});t.capture({name:'share_link_copied'});t.capture({name:'result_card_export'});finish(t);}
 assert.equal(f.sent.filter(e=>e.name==='huata_share_intent').length,1);assert.equal(f.sent.filter(e=>e.name==='huata_result_share_sun').length,1);assert.equal(f.sent.filter(e=>e.name==='huata_save').length,1);
 start(t);for(let i=0;i<3;i++)t.capture({name:'question_view',question:1});t.capture({name:'question_view',question:6,repair:true});
 t.capture({name:'game_complete',result:'fog'});t.capture({name:'game_complete',result:'fog'});finish(t,'lu');finish(t,'lu');
 assert.equal(f.sent.filter(e=>e.name==='huata_step_01').length,2);assert.equal(f.sent.filter(e=>e.name==='huata_step_06').length,0);
 assert.equal(f.sent.filter(e=>e.name==='huata_fog').length,1);assert.equal(f.sent.filter(e=>e.name==='huata_complete').length,2);
 const before=f.sent.length;t.choose('denied');start(t);finish(t);t.activate();assert.equal(f.sent.length,before);assert.equal(t.status().pending,0);
 for(const href of ['http://wiki.body-all.co.kr/contents/bodyall-clinic/','https://evil.example/contents/bodyall-clinic/',base+'stats/',base+'result/private/']){const x=fixture({href});accept(x.tracker);x.tracker.visit();start(x.tracker);assert(!x.tracker.configured);assert.equal(x.sent.length,0);}
 const disabled=fixture({config:{...config,enabled:false}});accept(disabled.tracker);disabled.tracker.visit();assert.equal(disabled.sent.length,0);
 const refused=fixture();refused.tracker.visit();start(refused.tracker);refused.tracker.choose('denied');accept(refused.tracker);assert.deepEqual(refused.sent.map(e=>e.name),['huata_visit']);
 const invite=fixture({href:base+'?r=lu&from=friend'});accept(invite.tracker);start(invite.tracker);assert(invite.sent.some(e=>e.name==='huata_friend_start'));
 const shared=fixture({href:base+'result/sun/#a=9.14'});shared.tracker.visit();shared.tracker.capture({name:'shared_result_start'});accept(shared.tracker);assert.deepEqual(shared.sent.map(e=>e.name),['huata_shared_view','huata_shared_start_click']);assert(shared.sent.every(e=>!e.params.page_location.includes('#')));
 const bounded=fixture();for(let i=0;i<1000;i++)start(bounded.tracker);assert.equal(bounded.tracker.status().pending,160);
 const unsupported=fixture({storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},send(){throw Error('network');}});accept(unsupported.tracker);start(unsupported.tracker);finish(unsupported.tracker);
 // The browser integration makes no third-party request before consent and keeps a failed tag isolated.
 const listeners={},elements={};for(const id of ['analytics-choice','analytics-status','analytics-allow','analytics-deny'])elements[id]={hidden:true,textContent:'',addEventListener(name,fn){this[name]=fn;}};
 const scripts=[],values=new Map(),cookieWrites=[];let writes=0;
 const document={referrer:'',getElementById:id=>elements[id],createElement:()=>({}),head:{append:s=>scripts.push(s)},get cookie(){return 'huata_ga=123; other_cookie=keep';},set cookie(v){cookieWrites.push(v);}};
 const w={document,location:{href:base},HuataAnalyticsConfig:config,localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>{writes++;values.set(k,v);}},addEventListener:(n,fn)=>listeners[n]=fn};
 A.mount(w);assert.equal(scripts.length,0);assert.equal(w.dataLayer,undefined);
 elements['analytics-allow'].click();assert.equal(scripts.length,1);assert.equal(scripts[0].referrerPolicy,'origin');scripts[0].onload();
 const commands=w.dataLayer.map(x=>Array.from(x));assert(commands.some(c=>c[0]==='event'&&c[1]==='huata_visit'));
 const setup=commands.find(c=>c[0]==='config')[2];assert.equal(setup.allow_google_signals,false);assert.equal(setup.allow_ad_personalization_signals,false);assert.equal(setup.send_page_view,false);assert.equal(setup.cookie_path,config.basePath);
 const oldWrites=writes;listeners.storage({key:'huata.stats.consent.v1',newValue:JSON.stringify({value:'denied',expires:Date.now()+10000})});assert.equal(writes,oldWrites);assert(w['ga-disable-'+config.measurementId]);assert(cookieWrites.every(c=>c.startsWith('huata_ga=')));
 const csv='\uFEFF# exported report\n이벤트 이름,이벤트 수,총 사용자\nhuata_start,"1,000",900\nhuata_complete,800,700\nhuata_share_intent,200,180\nhuata_result_sun,300,290\nhuata_result_share_sun,60,55\npage_view,5000,1200\n';
 const stats=summarize(parseCSV(csv));assert.equal(stats.starts,1000);assert.equal(stats.completionRate,.8);assert.equal(stats.shareRate,.25);assert.equal(stats.people[0].name,'손권');
 assert.throws(()=>parseCSV('name,count\na,1'));assert.throws(()=>parseCSV('Event name,Event count\nhuata_start,bad'));assert.throws(()=>parseCSV('Event name,Event count\nhuata_start,"1'));assert.throws(()=>parseCSV('Event name,Event count\npage_view,100'));
 // Exercise the real app event order through a complete game, not only handcrafted events.
 const h=await boot(),real=fixture();accept(real.tracker);const realEvents=h.events;
 const D=require('./data.js'),p=D.people.find(p=>p.id==='sun'),answers=['A','D','E',...p.pattern];
 for(let q=1;q<10;q++){h.ids.get('answers').children[D.questions[q].answers.findIndex(a=>a.code===answers[q])].click();await h.advance(q===9?1250:950);}
 await h.advance(3000);await h.flush();for(const detail of realEvents)real.tracker.capture(detail);
 assert.equal(real.sent.filter(e=>e.name==='huata_start').length,1);assert.equal(real.sent.filter(e=>e.name.startsWith('huata_step_')).length,10);assert.equal(real.sent.filter(e=>e.name==='huata_result_sun').length,1);
 console.log(JSON.stringify({noRequestsBeforeConsent:true,answerAndUrlDataExcluded:true,restrictedToGameHostAndPaths:true,replayAndRepairDeduplicated:true,shareIntentSeparateFromDelivery:true,crossTabWithdrawalDoesNotLoop:true,analyticsFailureDoesNotBlockGame:true,realGameTenStepsAndResult:true,koreanCsvSummary:true,liveGoogleReceiptVerified:false},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
