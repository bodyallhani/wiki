/* Original local BGM + three excerpts of the user-approved Hua Tuo voice. Sound never gates gameplay. */
(function(root){
  'use strict';
  const cues=[
    {id:'mm',text:'음…',src:'assets/huata-approved-mm.mp3',moods:['calm','warm','surprised']},
    {id:'aha',text:'아하!',src:'assets/huata-approved-aha.mp3',moods:['warm','surprised']},
    {id:'chuckle',text:'허허…',src:'assets/huata-approved-chuckle.mp3',moods:['warm']}
  ];
  function eligible({question=0,code='N',expression='neutral'}={}){
    const calm=code==='N';
    const mood=calm?'calm':expression==='surprised'?'surprised':expression==='thoughtful'?'calm':'warm';
    return cues.filter(c=>c.moods.includes(mood));
  }
  function create({env=root,random=Math.random,onState=()=>{},onError=()=>{}}={}){
    let enabled=false,choiceMade=false,paused=false,music=null,context=null,voice=null,lastCue=null,voiceToken=0,voiceTimer=0;
    const used=new Set(),reported=new Set(),players=new Map();
    const after=(fn,ms)=>env.setTimeout(fn,ms),cancel=id=>env.clearTimeout(id);
    function report(key,message){if(!reported.has(key)){reported.add(key);onError(message);}}
    function stopVoice(){
      voiceToken++;cancel(voiceTimer);
      if(voice){voice.onended=null;voice.onerror=null;try{voice.pause();voice.currentTime=0;}catch(ignore){}voice=null;}
      if(music)music.volume=.28;
    }
    function getVoice(cue){
      if(players.has(cue.id))return players.get(cue.id);
      try{const player=new env.Audio(cue.src);player.preload='auto';player.volume=.88;players.set(cue.id,player);return player;}catch(ignore){return null;}
    }
    function prepareVoices(){cues.forEach(cue=>getVoice(cue));}
    function playMusic(){
      if(!enabled||paused)return;
      try{
        if(!music){music=new env.Audio('assets/huata-courtyard.mp3');music.loop=true;music.preload='none';music.volume=.28;
          music.addEventListener('error',()=>report('music','배경음악을 불러오지 못했어요. 게임은 계속할 수 있어요.'));
        }
        const play=music.play();
        if(play&&play.then)play.then(()=>{if(!enabled||paused)music.pause();}).catch(()=>{if(enabled&&!paused)report('play','소리 재생이 막혔어요. 소리 버튼을 한 번 더 눌러주세요.');});
      }catch(ignore){report('music','이 브라우저에서는 배경음악을 재생하지 못했어요.');}
    }
    function prepareEffects(){
      try{const Audio=env.AudioContext||env.webkitAudioContext;if(!Audio)return;if(!context)context=new Audio();const p=context.resume();if(p&&p.catch)p.catch(()=>{});}catch(ignore){}
    }
    function setEnabled(value){
      enabled=!!value;onState(enabled);
      if(enabled&&!paused){prepareVoices();prepareEffects();playMusic();}
      else{stopVoice();if(music)music.pause();try{const p=context?.suspend();if(p&&p.catch)p.catch(()=>{});}catch(ignore){}}
    }
    function start(){paused=false;if(!choiceMade){choiceMade=true;setEnabled(true);}else if(enabled){prepareVoices();prepareEffects();playMusic();}}
    function toggle(){choiceMade=true;paused=false;setEnabled(!enabled);}
    function pause(){paused=true;stopVoice();if(music)music.pause();try{const p=context?.suspend();if(p&&p.catch)p.catch(()=>{});}catch(ignore){}}
    function resume(){paused=false;if(enabled){prepareEffects();playMusic();}}
    function acknowledge(details){
      if(!enabled||paused)return;
      const options=eligible(details);let pool=options.filter(c=>!used.has(c.id)&&c.id!==lastCue);
      if(!pool.length){options.forEach(c=>used.delete(c.id));pool=options.filter(c=>c.id!==lastCue);}
      // A calm answer has just one approved cue; acknowledge it even after another calm answer.
      if(!pool.length)pool=options;
      const cue=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];if(!cue)return;
      used.add(cue.id);lastCue=cue.id;
      stopVoice();const token=voiceToken;
      const player=getVoice(cue);
      if(!player){report('voice','이 브라우저에서는 추임새를 재생하지 못했어요.');return;}
      voice=player;
      function finish(){if(token!==voiceToken)return;cancel(voiceTimer);player.onended=null;player.onerror=null;voice=null;if(music)music.volume=.28;}
      try{
        player.currentTime=0;player.onended=finish;player.onerror=()=>{finish();report('voice-file','추임새를 불러오지 못했어요. 게임은 계속할 수 있어요.');};
        if(music)music.volume=.10;
        const play=player.play();
        if(play&&play.then)play.then(()=>{if(!enabled||paused||(token!==voiceToken&&voice!==player))player.pause();}).catch(()=>{if(token===voiceToken)finish();});
        voiceTimer=after(()=>{if(token===voiceToken)stopVoice();},2000);
      }catch(ignore){finish();}
      return cue.id;
    }
    function effect(frequency=500,duration=.055,delay=0){
      if(!enabled||paused||!context||context.state!=='running')return;
      try{
        const t=context.currentTime+delay,osc=context.createOscillator(),gain=context.createGain();
        osc.type='sine';osc.frequency.setValueAtTime(frequency,t);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.025,t+.01);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
        osc.connect(gain);gain.connect(context.destination);osc.start(t);osc.stop(t+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};
      }catch(ignore){}
    }
    return {start,toggle,pause,resume,stopVoice,acknowledge,effect};
  }
  const api={create,cues,eligible};root.HuataSound=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);
