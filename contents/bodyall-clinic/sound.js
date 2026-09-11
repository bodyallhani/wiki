/* Original local BGM + ten Korean acknowledgements. Sound never gates gameplay. */
(function(root){
  'use strict';
  const cues=[
    {id:'mm',text:'음.',moods:['calm','warm','surprised'],pitch:.76},
    {id:'mm-mm',text:'음, 음.',moods:['calm','warm'],pitch:.79},
    {id:'aha',text:'아하.',moods:['calm','warm','surprised'],pitch:.86},
    {id:'oh',text:'오오.',moods:['warm','surprised'],pitch:.89},
    {id:'ho',text:'호오.',moods:['warm','surprised'],pitch:.78},
    {id:'isee',text:'그렇군.',moods:['calm','warm'],pitch:.77},
    {id:'understood',text:'알겠네.',moods:['calm','warm'],pitch:.80},
    {id:'good',text:'좋네.',moods:['warm'],pitch:.83},
    {id:'indeed',text:'그렇구먼.',moods:['calm','warm'],pitch:.75},
    {id:'chuckle',text:'허허.',moods:['warm'],pitch:.79}
  ];
  function eligible({question=0,code='N',expression='neutral'}={}){
    const calm=code==='N'||question===0||(question===1&&code!=='B'&&code!=='D')||(question===2&&code!=='E');
    const mood=calm?'calm':expression==='surprised'?'surprised':expression==='thoughtful'?'calm':'warm';
    return cues.filter(c=>c.moods.includes(mood));
  }
  function create({env=root,random=Math.random,onState=()=>{},onError=()=>{}}={}){
    let enabled=false,choiceMade=false,paused=false,music=null,context=null,lastCue=null,voiceToken=0,voiceTimer=0;
    const used=new Set(),reported=new Set();
    const after=(fn,ms)=>env.setTimeout(fn,ms),cancel=id=>env.clearTimeout(id);
    function report(key,message){if(!reported.has(key)){reported.add(key);onError(message);}}
    function stopVoice(){
      voiceToken++;cancel(voiceTimer);
      try{env.speechSynthesis?.cancel();}catch(ignore){}
      if(music)music.volume=.28;
    }
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
      if(enabled&&!paused){prepareEffects();playMusic();try{env.speechSynthesis?.getVoices();}catch(ignore){}}
      else{stopVoice();if(music)music.pause();try{const p=context?.suspend();if(p&&p.catch)p.catch(()=>{});}catch(ignore){}}
    }
    function start(){paused=false;if(!choiceMade){choiceMade=true;setEnabled(true);}else if(enabled){prepareEffects();playMusic();}}
    function toggle(){choiceMade=true;paused=false;setEnabled(!enabled);}
    function pause(){paused=true;stopVoice();if(music)music.pause();try{const p=context?.suspend();if(p&&p.catch)p.catch(()=>{});}catch(ignore){}}
    function resume(){paused=false;if(enabled){prepareEffects();playMusic();}}
    function acknowledge(details){
      if(!enabled||paused)return;
      const options=eligible(details);let pool=options.filter(c=>!used.has(c.id)&&c.id!==lastCue);
      if(!pool.length){options.forEach(c=>used.delete(c.id));pool=options.filter(c=>c.id!==lastCue);}
      const cue=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];if(!cue)return;
      used.add(cue.id);lastCue=cue.id;
      stopVoice();const token=voiceToken;
      try{
        const synth=env.speechSynthesis,Utterance=env.SpeechSynthesisUtterance;
        if(!synth||!Utterance){report('voice','이 브라우저는 추임새 음성을 지원하지 않아 음악만 재생해요.');return;}
        const voices=synth.getVoices(),korean=voices.filter(v=>/^ko(?:-|_)?/i.test(v.lang));
        if(voices.length&&!korean.length){report('korean','한국어 음성을 찾지 못해 배경음악만 재생해요.');return;}
        const utterance=new Utterance(cue.text);utterance.lang='ko-KR';utterance.rate=.94;utterance.pitch=cue.pitch;utterance.volume=.84;
        const male=korean.find(v=>/InJoon|Hyunsu|Hyunsoo|Minho|male|남성/i.test(v.name));
        if(male||korean[0])utterance.voice=male||korean[0];
        function finish(){if(token!==voiceToken)return;cancel(voiceTimer);if(music)music.volume=.28;}
        utterance.onend=finish;utterance.onerror=finish;
        if(music)music.volume=.10;
        synth.speak(utterance);
        voiceTimer=after(()=>{if(token===voiceToken){try{synth.cancel();}catch(ignore){}finish();}},1700);
      }catch(ignore){if(music)music.volume=.28;}
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
