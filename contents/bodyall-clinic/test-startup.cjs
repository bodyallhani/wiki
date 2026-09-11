'use strict';
// Executes the shipped scripts in HTML order. Timer calls enforce Window receiver semantics.
// This is a startup regression test, not a browser UI/visual test.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const scriptNames=[...html.matchAll(/<script src="([^"?]+)/g)].map(m=>m[1]);
class Element{
 constructor(tag='div'){this.tagName=tag;this.style={};this.dataset={};this.listeners={};this.children=[];this.disabled=false;this.open=false;this.textContent='';this.hidden=false;this.attributes={};const names=new Set();this.classList={add:(...n)=>n.forEach(x=>names.add(x)),remove:(...n)=>n.forEach(x=>names.delete(x)),contains:n=>names.has(n),toggle:(n,b)=>{if(b??!names.has(n))names.add(n);else names.delete(n);}};}
 addEventListener(n,fn){(this.listeners[n]??=[]).push(fn);}
 fire(n,event={}){for(const fn of this.listeners[n]??[])fn(event);}
 click(){if(!this.disabled)this.fire('click');}
 setAttribute(n,v){this.attributes[n]=v;}
 append(...n){this.children.push(...n);}
 replaceChildren(...n){this.children=[...n];}
 querySelectorAll(tag){return this.children.filter(x=>x.tagName===tag);}
 focus(){} scrollIntoView(){} remove(){}
 getBoundingClientRect(){return {top:0,left:0,right:800,bottom:500};}
 showModal(){this.open=true;}close(){this.open=false;this.fire('close');}
}
async function boot({missingPortraitModule=false,failingActor=false}={}){
 const ids=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 ids.get('game').dataset.state='intro';ids.get('start').disabled=true;ids.get('start-label').textContent='거울을 닦는 중…';
 const other=new Map(),body=new Element('body');
 const document={hidden:false,body,getElementById:id=>ids.get(id)??null,querySelector:selector=>{if(!other.has(selector))other.set(selector,new Element());return other.get(selector);},createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),addEventListener(){}};
 let now=0,serial=0;const timers=new Map(),warnings=[];
 const clock={schedule(fn,delay){const id=++serial;timers.set(id,{at:now+delay,fn});return id;},cancel(id){timers.delete(id);}};
 class Image{set src(value){this._src=value;queueMicrotask(()=>this.onload?.());}}
 const context=vm.createContext({document,Image,URL,URLSearchParams,location:{search:''},navigator:{},innerHeight:900,CustomEvent:class{},console:{warn:(...a)=>warnings.push(a),log(){}},clock});
 vm.runInContext(`
  window=globalThis;
  function setTimeout(fn,delay){'use strict';if(this!==undefined&&this!==globalThis)throw new TypeError('Illegal invocation');return clock.schedule(fn,delay);}
  function clearTimeout(id){'use strict';if(this!==undefined&&this!==globalThis)throw new TypeError('Illegal invocation');clock.cancel(id);}
  function matchMedia(){return {matches:false,addEventListener(){}};}
  function addEventListener(){} function dispatchEvent(){}
 `,context);
 for(const name of scriptNames){
  if(missingPortraitModule&&['actor.js','reactions.js'].includes(name))continue;
  vm.runInContext(fs.readFileSync(path.join(__dirname,name),'utf8'),context,{filename:name});
  if(name==='actor.js'&&failingActor)vm.runInContext("HuataActor.create=()=>({start(){throw new Error('portrait failure');},stop(){},reset(){},react(){}})",context);
 }
 async function flush(){for(let i=0;i<12;i++)await Promise.resolve();}
 await flush();
 assert.equal(ids.get('start-label').textContent,'손목 맡기기');assert.equal(ids.get('start').disabled,false);
 ids.get('start').click();assert.equal(ids.get('game').dataset.state,'question');assert.equal(ids.get('question').textContent,'성별은 어떻게 되나?');
 const answers=ids.get('answers');assert.equal(answers.children.length,4);answers.children[0].click();assert(answers.children.every(b=>b.disabled));
 const end=now+950;
 for(;;){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);now=next[1].at;next[1].fn();await flush();}now=end;
 assert.equal(ids.get('question').textContent,'요즘 몸 상태는 어떤가?');assert.equal(answers.children.length,5);
 if(failingActor)assert.equal(warnings.length,1);else assert.equal(warnings.length,0);
}
(async()=>{await boot();await boot({failingActor:true});await boot({missingPortraitModule:true});console.log(JSON.stringify({defaultWindowTimers:true,startButtonUnlocks:true,firstAnswerAdvances:true,portraitFailureDoesNotBlockPlay:true,missingPortraitModuleDoesNotBlockPlay:true,browserTested:false},null,2));})().catch(error=>{console.error(error);process.exitCode=1;});
