'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),S=require('./sound.js');
(async()=>{
 const audio=[],plays=[],states=[],notices=[],timers=new Map();let serial=0;
 class Audio{
  constructor(src){this.src=src;this.paused=true;this.currentTime=0;audio.push(this);}
  addEventListener(){}play(){this.paused=false;plays.push(this);return Promise.resolve();}pause(){this.paused=true;}
 }
 const env={Audio,setTimeout(fn,delay){assert.equal(this,env);timers.set(++serial,fn);return serial;},clearTimeout(id){assert.equal(this,env);timers.delete(id);}};
 const sound=S.create({env,random:()=>0,onState:s=>states.push(s),onError:m=>notices.push(m)});
 assert.equal(audio.length,0);sound.start();assert.equal(audio.length,4);
 const music=audio.find(a=>a.src.includes('courtyard'));assert(music.loop);assert(!music.paused);
 const voicePlays=()=>plays.filter(a=>a!==music);
 assert.equal(voicePlays().length,0);
 const heard=[];for(let i=0;i<3;i++)heard.push(sound.acknowledge({question:3,code:'B',expression:'warm'}));
 assert.equal(new Set(heard).size,3);assert.equal(voicePlays().length,3);assert.equal(timers.size,1);assert.equal(music.volume,.10);
 for(let i=0;i<10;i++){const cue=sound.acknowledge({question:3,code:'B',expression:'warm'});assert.notEqual(cue,heard.at(-1));heard.push(cue);}
 // Reusing a clip while older play promises settle must not stop the newest voice.
 sound.acknowledge({question:3,code:'B',expression:'warm'});const current=voicePlays().at(-1);await Promise.resolve();assert(!current.paused);
 assert.equal(audio.length,4);assert.equal(audio.filter(a=>a!==music&&!a.paused).length,1);
 current.onended();assert.equal(music.volume,.28);assert.equal(timers.size,0);
 const calm=S.eligible({question:1,code:'A',expression:'thoughtful'});assert(!calm.some(c=>['chuckle','aha'].includes(c.id)));
 // Ten unknown answers still get a quiet acknowledgment on every click.
 const calmCount=voicePlays().length;
 for(let i=0;i<10;i++)assert.equal(sound.acknowledge({question:i,code:'N',expression:'thoughtful'}),'mm');
 assert.equal(voicePlays().length,calmCount+10);await Promise.resolve();assert(!voicePlays().at(-1).paused);
 sound.pause();assert(music.paused);const count=voicePlays().length;sound.acknowledge();assert.equal(voicePlays().length,count);
 sound.resume();assert(!music.paused);sound.toggle();assert(music.paused);assert.equal(states.at(-1),false);
 sound.start();assert(music.paused);sound.acknowledge();assert.equal(voicePlays().length,count);await Promise.resolve();assert(music.paused);
 sound.toggle();assert(!music.paused);sound.pause();await Promise.resolve();assert(music.paused);assert.equal(notices.length,0);
 const noAudio=S.create({env:{setTimeout,clearTimeout},onError:()=>{}});assert.doesNotThrow(()=>{noAudio.start();noAudio.acknowledge();noAudio.pause();});
 assert.equal(S.cues.length,3);assert.deepEqual(S.cues.map(c=>c.text),['음…','아하!','허허…']);
 const source=fs.readFileSync(path.join(__dirname,'sound.js'),'utf8');assert(!source.includes('speechSynthesis'));assert(!source.includes('SpeechSynthesisUtterance'));
 for(const c of S.cues){assert(fs.existsSync(path.join(__dirname,c.src)));assert(fs.statSync(path.join(__dirname,c.src)).size>1000);}
 console.log(JSON.stringify({approvedSampleExcerpts:3,deviceSpeechRemoved:true,noImmediateRepeatWithMultipleChoices:true,everyCalmAnswerAcknowledged:true,calmSymptomResponses:true,voicePreloadedWithoutPlayback:true,oneVoiceAtATime:true,reusedClipPromiseRaceSafe:true,mutePersistsThroughRetry:true,hiddenPagePaused:true,optionalAudioFailureSafe:true,browserTested:false},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
