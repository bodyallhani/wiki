'use strict';
const assert=require('node:assert/strict'),S=require('./sound.js');
(async()=>{
 const music=[],spoken=[],states=[],notices=[],timers=new Map();let serial=0,cancels=0;
 class Audio{constructor(src){this.src=src;this.paused=true;music.push(this);}addEventListener(){}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
 const env={Audio,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},speechSynthesis:{getVoices:()=>[{lang:'ko-KR',name:'Microsoft InJoon'}],cancel:()=>{cancels++;},speak:u=>spoken.push(u)},setTimeout(fn,delay){assert.equal(this,env);timers.set(++serial,fn);return serial;},clearTimeout(id){assert.equal(this,env);timers.delete(id);}};
 const sound=S.create({env,random:()=>0,onState:state=>states.push(state),onError:message=>notices.push(message)});
 assert.equal(music.length,0);assert.equal(spoken.length,0);sound.start();assert.equal(music.length,1);assert(music[0].loop);assert(!music[0].paused);
 const heard=[];for(let i=0;i<10;i++)heard.push(sound.acknowledge({question:3,code:'B',expression:'warm'}));
 assert.equal(new Set(heard).size,10);assert.equal(spoken.length,10);assert(spoken.every(u=>u.lang==='ko-KR'&&u.voice.lang==='ko-KR'));assert.equal(timers.size,1);assert.equal(music[0].volume,.10);
 spoken.at(-1).onend();assert.equal(music[0].volume,.28);assert.equal(timers.size,0);
 const calm=S.eligible({question:1,code:'A',expression:'thoughtful'});assert(!calm.some(c=>['chuckle','good','oh','ho'].includes(c.id)));
 sound.pause();assert(music[0].paused);const count=spoken.length;sound.acknowledge();assert.equal(spoken.length,count);
 sound.resume();assert(!music[0].paused);assert.equal(music.length,1);sound.toggle();assert(music[0].paused);assert.equal(states.at(-1),false);
 sound.start();assert(music[0].paused);sound.acknowledge();assert.equal(spoken.length,count);await Promise.resolve();assert(music[0].paused);
 sound.toggle();assert(!music[0].paused);sound.pause();await Promise.resolve();assert(music[0].paused);assert.equal(notices.length,0);assert(cancels>10);
 const noAudio=S.create({env:{setTimeout,clearTimeout},onError:()=>{}});assert.doesNotThrow(()=>{noAudio.start();noAudio.acknowledge();noAudio.pause();});
 console.log(JSON.stringify({acknowledgements:10,noImmediateRepeat:true,symptomAnswersUseCalmVoice:true,musicStartsOnInteraction:true,mutePersistsThroughRetry:true,hiddenPagePaused:true,rapidToggleSafe:true,optionalAudioFailureSafe:true,browserTested:false},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
