'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const D=require('./data.js'),E=require('./engine.js'),{boot}=require('./test-startup.cjs');
const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
async function finishAs(id,navigator={}){
 const h=await boot({shareNavigator:navigator,locationSearch:'?r=lu&from=friend'});
 assert(h.ids.get('friend-note').textContent.includes('여포'));
 const p=D.people.find(p=>p.id===id),answers=['A','D','E',...p.pattern];
 for(let q=1;q<10;q++){
  const i=D.questions[q].answers.findIndex(a=>a.code===answers[q]);h.ids.get('answers').children[i].click();await h.advance(q===9?1250:950);
 }
 await h.advance(3000);await h.flush();assert.equal(h.ids.get('result-name').textContent,p.name);
 assert.equal(h.ids.get('story-source').href,p.biographyURL);assert(!h.ids.get('story-source').hidden);
 assert.equal(h.ids.get('story-source').textContent,p.name+' 알아보기 (한국어) ↗');
 h.ids.get('share').click();
 const buttons=h.ids.get('dialog-body').children.find(e=>e.className==='share-buttons');
 assert(buttons,'Share controls must exist before the card promise resolves');
 return {...h,buttons,result:E.getResult(answers)};
}
(async()=>{
 const records=JSON.parse(fs.readFileSync(path.join(__dirname,'SHARING.json'),'utf8')).records;assert.equal(records.length,13);
 const urls=new Set(),images=new Set();
 for(const record of records){
  const html=fs.readFileSync(path.join(__dirname,'result',record.id,'index.html'),'utf8');
  const meta=new Map([...html.matchAll(/<meta (?:property|name)="([^"]+)" content="([^"]*)"/g)].map(m=>[m[1],decode(m[2])]));
  assert.equal(meta.get('og:title'),record.title);assert.equal(meta.get('og:description'),record.description);assert.equal(meta.get('og:image'),record.image);assert.equal(meta.get('og:url'),record.url);
  assert.equal(meta.get('twitter:title'),record.title);assert.equal(meta.get('twitter:description'),record.description);assert.equal(meta.get('twitter:image'),record.image);
  assert(record.title.includes('너는 누구였어?'));assert(html.includes('<h1>'+record.name+'</h1>'));
  const href=decode(html.match(/class="shared-start" href="([^"]+)"/)[1]),start=new URL(href);assert.equal(start.origin,new URL(D.url).origin);assert.equal(start.pathname,new URL(D.url).pathname);assert.equal(start.searchParams.get('r'),record.id);
  assert(!html.includes('http-equiv="refresh"'));assert(html.includes('그럼, 내 전생은?'));
  const image=fs.readFileSync(path.join(__dirname,'result',record.id,'portrait.jpg'));assert.equal(image.readUInt16BE(0),0xffd8);assert(image.length>1000);
  urls.add(record.url);images.add(record.image);
 }
 assert.equal(urls.size,13);assert.equal(images.size,13);
 const sun=E.previewResult('sun');for(const hash of ['#a=99','#a=27','#a=9.9','#a=<script>','#a=9.10.14'])assert.deepEqual(E.sharedResult('sun',hash).analysis,sun.analysis);
 assert.throws(()=>E.shareURL({id:'../sun'}));assert.throws(()=>E.previewResult('fog'));
 const faint=E.getResult(['A','D','E','N','N','B','N','N','N','N']);assert.equal(E.sharedResult(faint.id,new URL(E.shareURL(faint)).hash).analysis.length,1);
 const shared=[];const native=await finishAs('sun',{share:payload=>{shared.push(payload);return Promise.resolve();}});
 native.buttons.children[0].click();assert.equal(shared.length,1);await native.flush();
 assert.equal(shared[0].title,E.shareTitle(native.result));assert.equal(shared[0].text,E.shareText(native.result));assert.equal(shared[0].url,E.shareURL(native.result));assert(!('files' in shared[0]));
 for(const t of native.result.analysis)assert(shared[0].text.includes(t));assert(shared[0].text.includes(native.result.title));
 const copied=[];const fallback=await finishAs('lu',{clipboard:{writeText:async text=>copied.push(text)}});fallback.buttons.children[0].click();await fallback.flush();assert.equal(copied[0],E.shareText(fallback.result)+'\n'+E.shareURL(fallback.result));
 const cancelled=await finishAs('sun',{share:()=>Promise.reject(Object.assign(new Error('cancel'),{name:'AbortError'})),clipboard:{writeText:()=>{throw new Error('Cancel must not copy');}}});cancelled.buttons.children[0].click();await cancelled.flush();assert(!cancelled.buttons.children[0].disabled);
 const manual=await finishAs('lu',{});manual.buttons.children[0].click();await manual.flush();const box=manual.ids.get('dialog-body').querySelector('textarea');assert(box.value.includes('여포'));assert(box.value.includes(E.shareURL(manual.result)));
 // The receiving page preserves the sender's short analysis without applying their result to the new quiz.
 const paragraphs=[];const received=E.getResult(['A','D','E',...'CDBCCCC']);const fragment=new URL(E.shareURL(received)).hash;
 const context={window:{HuataEngine:E,addEventListener(){}},location:{hash:fragment},document:{body:{dataset:{resultId:'sun'}},createElement:()=>({}),getElementById:()=>({replaceChildren:(...nodes)=>paragraphs.push(...nodes)})}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'shared-result.js'),'utf8'),context);assert.deepEqual(paragraphs.map(p=>p.textContent),received.analysis);
 console.log(JSON.stringify({resultSpecificStaticPreviews:13,nativeResultTextAndLink:true,cardFailureDoesNotBlockSharing:true,copyFallbackIncludesActualResult:true,cancelDoesNotCopy:true,manualCopyFallback:true,recipientAnalysisRestored:true,newParticipantStartsOwnQuiz:true,rawAnswersAndHealthNotShared:true,realKakaoSendTested:false},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
