(function () {
  'use strict';
  const D=window.HuataData, E=window.HuataEngine, $=id=>document.getElementById(id);
  const game=$('game'), dialog=$('dialog'), reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const assetPaths={room:'assets/huata-room.webp',doctor:'assets/huata-doctor.webp',atlas:'assets/huata-portraits.webp',horse:'assets/huata-horse.webp',logo:'assets/huata-symbol.webp'};
  const imageCache=new Map(), assetImages={};
  let answers=Array(10).fill(null), index=0, result=null, busy=false, soundOn=false, audioContext=null, generation=0;
  let mutterTimer=0, toastTimer=0, repair=false, repairAt=0, blobURL=null, cardPromise=null, assetsReady=false, dialogSession=0;
  const repairQuestions=[5,6,8], spoken=new Set();
  const scheduled=new Set();
  function later(fn,ms){const id=setTimeout(()=>{scheduled.delete(id);fn();},ms);scheduled.add(id);return id;}
  function cancelScheduled(){for(const id of scheduled)clearTimeout(id);scheduled.clear();clearTimeout(mutterTimer);}
  function announce(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2800);}
  function event(name, extra={}){window.dispatchEvent(new CustomEvent('bodyall:game-event',{detail:{name,version:D.version,...extra}}));}
  function tone(frequency=500,duration=.055,delay=0){
    if(!soundOn||!audioContext)return;
    const t=audioContext.currentTime+delay, osc=audioContext.createOscillator(),gain=audioContext.createGain();
    osc.type='triangle';osc.frequency.setValueAtTime(frequency,t);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.045,t+.01);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(gain);gain.connect(audioContext.destination);osc.start(t);osc.stop(t+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  function loadImage(src){
    if(imageCache.has(src))return imageCache.get(src);
    const promise=new Promise((resolve,reject)=>{
      const img=new Image(),timeout=setTimeout(()=>{img.onload=null;img.onerror=null;imageCache.delete(src);reject(new Error('image-timeout'));},12000);
      img.onload=()=>{clearTimeout(timeout);resolve(img);};img.onerror=()=>{clearTimeout(timeout);imageCache.delete(src);reject(new Error('image-load'));};img.src=src;
    });imageCache.set(src,promise);return promise;
  }
  async function loadAssets(){
    $('start').disabled=true;$('start-label').textContent='거울을 닦는 중…';
    try{
      await Promise.all(Object.entries(assetPaths).map(async([key,path])=>{assetImages[key]=await loadImage(path);}));
      assetsReady=true;$('start').disabled=false;$('start-label').textContent='손목 맡기기';$('asset-status').textContent='질문 10개 · 약 1분 · 가입 없이';
    }catch(err){assetsReady=false;$('start').disabled=false;$('start-label').textContent='그림 다시 불러오기';$('asset-status').textContent='그림을 불러오지 못했어요. 한 번 더 눌러주세요.';}
  }
  function say(text){
    clearTimeout(mutterTimer);$('mutter').textContent=text;$('mutter').classList.add('visible');mutterTimer=setTimeout(()=>$('mutter').classList.remove('visible'),2400);
  }
  function react(q, code){
    if(spoken.has(q)||repair)return;
    const phrases={3:'전생에도 이런 버릇이 있었을까…',6:'어디서 본 듯한데…',8:'이제 조금 보이는군.'};
    if(q===1){const p={A:'요즘 쉽게 지치는구먼.',B:'움직일 기운은 충분하구먼.',C:'날마다 좀 다르구먼.',D:'대체로 괜찮다니 다행이네.',N:'음… 어디 보자.'};say(p[code]);spoken.add(q);}
    else if(phrases[q]){say(phrases[q]);spoken.add(q);}
  }
  function clearCard(){if(blobURL)URL.revokeObjectURL(blobURL);blobURL=null;cardPromise=null;}
  function reset(){
    generation++;cancelScheduled();clearCard();answers=Array(10).fill(null);index=0;result=null;repair=false;repairAt=0;busy=false;spoken.clear();
    game.classList.remove('mirror-awake','face-visible','horse','fog');$('mutter').classList.remove('visible');$('story').open=false;
    $('reveal-caption').textContent='';$('stage').setAttribute('aria-label','내 손목을 짚으며 거울을 들고 있는 화타');
  }
  function start(){
    if(!assetsReady){loadAssets();return;}
    reset();$('intro').hidden=true;$('result-view').hidden=true;$('question-view').hidden=false;game.dataset.state='question';
    renderQuestion();say('손목은 편히 두게. 자, 시작해 볼까?');tone(620,.1);event('game_start');
  }
  function renderQuestion(){
    busy=false;const q=D.questions[index];$('question').textContent=q.text;
    $('question-count').replaceChildren(document.createTextNode(String(repair?repairAt+1:index+1).padStart(2,'0')+' '));const total=document.createElement('i');total.textContent=repair?'/ 3':'/ 10';$('question-count').append(total);
    $('progress').setAttribute('aria-valuemax',repair?'3':'10');$('progress').setAttribute('aria-valuenow',String(repair?repairAt:index));$('progress-fill').style.width=((repair?repairAt/3:index/10)*100)+'%';
    document.querySelector('.question-meta>span:first-child').textContent=repair?'전생을 조금 더 또렷하게':'화타의 물음';
    $('answers').replaceChildren();
    q.answers.forEach((a,n)=>{
      const button=document.createElement('button');button.type='button';button.className='answer'+(a.code==='N'?' unknown':'')+(answers[index]===a.code?' selected':'');
      const mark=document.createElement('span');mark.className='answer-mark';mark.setAttribute('aria-hidden','true');const text=document.createElement('span');text.textContent=a.label;button.append(mark,text);
      button.setAttribute('aria-pressed',String(answers[index]===a.code));const questionIndex=index;
      button.addEventListener('click',()=>choose(questionIndex,a.code,button));$('answers').append(button);
    });
    $('back').disabled=!repair&&index===0;$('back').textContent=repair&&repairAt===0?'← 결과로 돌아가기':'← 이전 질문';$('question').focus({preventScroll:true});
  }
  function choose(questionIndex,code,button){
    if(busy||questionIndex!==index||game.dataset.state!=='question')return;
    busy=true;answers[index]=code;button.classList.add('selected');$('answers').querySelectorAll('button').forEach(b=>b.disabled=true);$('back').disabled=true;tone();react(index,code);
    const token=generation;
    later(()=>{
      if(token!==generation)return;
      if(repair){repairAt++;if(repairAt<repairQuestions.length){index=repairQuestions[repairAt];renderQuestion();}else reveal();}
      else if(index<9){index++;renderQuestion();}else reveal();
    },170);
  }
  function setPortrait(person){
    const face=$('reflection');
    if(person.id==='horse'){face.style.backgroundImage="url('"+assetPaths.horse+"')";face.style.backgroundSize='100% 100%';face.style.backgroundPosition='50% 50%';}
    else if(Number.isInteger(person.tile)){face.style.backgroundImage="url('"+assetPaths.atlas+"')";face.style.backgroundSize='300% 400%';face.style.backgroundPosition=((person.tile%3)*50)+'% '+(Math.floor(person.tile/3)*100/3)+'%';}
  }
  function reveal(){
    result=E.getResult(answers);busy=true;repair=false;$('question-view').hidden=true;$('mutter').classList.remove('visible');clearTimeout(mutterTimer);game.dataset.state='revealing';
    game.classList.toggle('horse',result.kind==='horse');game.classList.toggle('fog',result.kind==='fog');$('reveal-caption').textContent='“자, 직접 보게.”';
    if(result.kind!=='fog')setPortrait(result);
    const token=generation, quick=reduced.matches, duration=quick?650:2600;
    tone(330,.25);tone(440,.35,.15);tone(660,.4,.3);
    later(()=>{if(token!==generation)return;game.classList.add('mirror-awake');},quick?80:1000);
    later(()=>{if(token!==generation)return;game.classList.add('face-visible');tone(result.kind==='horse'?190:880,.24);},quick?240:1670);
    if(result.kind==='horse')later(()=>{if(token===generation)$('reveal-caption').textContent='“……자네, 사람이 아니었구만.”';},quick?370:2110);
    later(()=>{if(token===generation)renderResult();},result.kind==='horse'?duration+450:duration);
  }
  function renderResult(){
    busy=false;game.dataset.state='result';$('intro').hidden=true;$('question-view').hidden=true;$('result-view').hidden=false;
    game.classList.toggle('fog',result.kind==='fog');game.classList.toggle('horse',result.kind==='horse');
    $('result-name').textContent=result.name;$('analysis').replaceChildren();$('story').open=false;
    if(result.kind==='fog'){
      $('result-eyebrow').textContent='안개 낀 거울';$('result-title').textContent='아직은 얼굴이 잘 보이지 않아요.';
      $('result-quote').textContent='“성격 이야기 세 가지만 더 들려주겠나?”';$('share').textContent='답변 보태기';$('story').hidden=true;
    }else{
      $('result-eyebrow').textContent=result.faint?'희미하게 보이는 전생':'거울에 비친 당신의 전생';$('result-title').textContent=result.title;
      result.analysis.forEach(text=>{const p=document.createElement('p');p.textContent=text;$('analysis').append(p);});
      $('result-quote').textContent='“'+result.quote+'”';$('share').textContent='친구에게 공유하기 ↗';$('story').hidden=false;$('story-copy').textContent=result.story;
      $('story-source').hidden=!result.chapter;if(result.chapter)$('story-source').href='https://zh.wikisource.org/wiki/三國演義/第'+result.chapter+'回';
      const snapshot=result;cardPromise=makeCard(snapshot).catch(()=>null);
    }
    $('stage').setAttribute('aria-label',result.kind==='fog'?'아직 실루엣이 흐릿한 거울':'거울에 비친 '+result.name+'의 정면 얼굴');
    $('result-name').focus({preventScroll:true});
    event('game_complete',{result:result.id});
    // Keep the mirror in view while bringing the result controls into reach.
    if($('console').getBoundingClientRect().top>window.innerHeight*.72)$('console').scrollIntoView({block:'center',behavior:reduced.matches?'instant':'smooth'});
  }
  function repairAnswers(){
    generation++;cancelScheduled();clearCard();repair=true;repairAt=0;index=repairQuestions[0];
    game.dataset.state='question';game.classList.remove('mirror-awake','face-visible','fog');$('result-view').hidden=true;$('question-view').hidden=false;$('reveal-caption').textContent='';renderQuestion();
    say('떠오르는 것부터 골라보게.');
  }
  function showDialog(title){dialogSession++;$('dialog-title').textContent=title;$('dialog-body').replaceChildren();if(!dialog.open)dialog.showModal();}
  function closeDialog(){dialogSession++;dialog.close();}
  function addText(parent,text,cls){const p=document.createElement('p');p.textContent=text;if(cls)p.className=cls;parent.append(p);return p;}
  function addButton(parent,text,cls,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls;b.addEventListener('click',fn);parent.append(b);return b;}
  async function openShare(){
    if(!result)return;if(result.kind==='fog'){repairAnswers();return;}
    const snapshot=result,token=generation;showDialog('나의 전생, 친구에게');const session=dialogSession,body=$('dialog-body');const pending=addText(body,'공유 카드를 펼치는 중…','share-help');
    if(!cardPromise)cardPromise=makeCard(snapshot).catch(()=>null);
    const card=await cardPromise;if(token!==generation||session!==dialogSession||!dialog.open)return;pending.remove();
    if(card){if(blobURL)URL.revokeObjectURL(blobURL);blobURL=URL.createObjectURL(card.blob);const img=document.createElement('img');img.className='card-image';img.src=blobURL;img.alt=snapshot.name+' · '+snapshot.title+' · '+snapshot.analysis.join(' ')+' · 바디올한의원';body.append(img);}
    else addText(body,'카드를 그리지 못했어요. 링크로 전생을 공유할 수 있어요.','share-help');
    const buttons=document.createElement('div');buttons.className='share-buttons';body.append(buttons);
    const share=addButton(buttons,'친구에게 공유하기 ↗','primary',async()=>{
      const payload={title:'화타의 전생 진찰소',text:E.shareText(snapshot),url:E.shareURL(snapshot)};
      if(card&&typeof File==='function'){
        const file=new File([card.blob],'bodyall-'+snapshot.id+'.png',{type:'image/png'});
        try{if(navigator.canShare&&navigator.canShare({files:[file]}))payload.files=[file];}catch(ignore){}
      }
      if(!navigator.share){await copyLink(snapshot,body);return;}
      share.disabled=true;
      try{await navigator.share(payload);event('share_api_resolved',{result:snapshot.id,withImage:!!payload.files});}
      catch(error){if(error.name!=='AbortError')announce('아래의 이미지 저장이나 링크 복사를 이용해주세요.');}
      finally{share.disabled=false;}
    });
    const save=addButton(buttons,'이미지 저장','secondary',()=>{
      if(!blobURL)return;const a=document.createElement('a');a.href=blobURL;a.download='바디올_전생_'+snapshot.name.replaceAll(' ','_')+'.png';document.body.append(a);a.click();a.remove();event('result_card_export',{result:snapshot.id});announce('이미지를 열었다면 길게 눌러 저장할 수도 있어요.');
    });save.disabled=!card;
    addButton(buttons,'링크 복사','secondary',()=>copyLink(snapshot,body));
    addText(body,'이미지에는 별칭과 짧은 성향 분석이 함께 담겨요. 저장한 뒤 친구에게 보내보세요.','share-help');event('share_preview_open',{result:snapshot.id});
  }
  async function copyLink(snapshot,body){
    const text=E.shareText(snapshot)+'\n'+E.shareURL(snapshot);
    try{if(!navigator.clipboard)throw new Error('clipboard');await navigator.clipboard.writeText(text);announce('공유 문구와 링크를 복사했어요.');event('share_link_copied',{result:snapshot.id});}
    catch(error){let box=body.querySelector('textarea');if(!box){box=document.createElement('textarea');box.className='copy-fallback';box.readOnly=true;box.setAttribute('aria-label','복사할 공유 문구와 링크');box.rows=4;body.append(box);}box.value=text;box.focus();box.select();announce('선택된 문구를 복사해주세요.');}
  }
  async function makeCard(snapshot){
    const [atlas,horse,logo]=await Promise.all([loadImage(assetPaths.atlas),loadImage(assetPaths.horse),loadImage(assetPaths.logo)]);
    if(document.fonts&&document.fonts.ready)await document.fonts.ready;
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('canvas');
    window.HuataCard.draw(ctx,snapshot,{atlas,horse,logo});
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('export')),'image/png'));
    return {blob,width:1080,height:1350};
  }
  $('start').addEventListener('click',start);$('retry').addEventListener('click',()=>{closeDialog();start();game.scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});});$('share').addEventListener('click',openShare);
  $('back').addEventListener('click',()=>{if(busy)return;if(repair){if(repairAt===0){repair=false;renderResult();return;}repairAt--;index=repairQuestions[repairAt];}else if(index>0)index--;renderQuestion();});
  $('sound').addEventListener('click',async()=>{
    soundOn=!soundOn;
    try{if(soundOn){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('audio');if(!audioContext)audioContext=new Audio();await audioContext.resume();}}
    catch(error){soundOn=false;announce('이 브라우저에서는 소리 없이 진행할게요.');}
    $('sound').setAttribute('aria-pressed',String(soundOn));$('sound').textContent=soundOn?'소리 켜짐':'소리 꺼짐';$('sound').title=soundOn?'효과음 끄기':'효과음 켜기';if(soundOn)tone(660,.1);
  });
  $('help').addEventListener('click',()=>{showDialog('화타의 전생 진찰소');const body=$('dialog-body');addText(body,'앞에 앉은 사람은 한의사로 돌아온 화타. 손목을 맡긴 사람은 지금의 나예요. 거울에는 내 삼국지 전생이 나타나요.');addText(body,'열 가지 물음에 가까운 답을 골라보세요. 고민되면 “잘 모르겠어요”도 괜찮아요.');addText(body,'삼국지연의의 인물을 현대적으로 해석한 재미용 테스트입니다. 실제 진단이나 검증된 심리검사가 아닙니다.','fine');addText(body,'답변은 이 화면 안에서만 계산해요. 공유 카드에는 인물과 짧은 성향 분석이 담기며, 성별·몸 상태·불편한 부위는 공유하지 않아요.','fine');});
  $('dialog-close').addEventListener('click',closeDialog);dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
  document.querySelector('.clinic').addEventListener('click',()=>event('clinic_link_click'));
  try{const f=E.friend(new URLSearchParams(location.search).get('r'));if(f){$('friend-note').textContent='친구의 전생은 '+f.name+'. 당신은?';$('friend-note').hidden=false;event('share_landing',{friendResult:f.id});}}catch(ignore){}
  window.addEventListener('pagehide',e=>{if(e.persisted)return;cancelScheduled();if(blobURL)URL.revokeObjectURL(blobURL);});
  loadAssets();
})();
