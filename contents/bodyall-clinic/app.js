(function () {
  'use strict';
  const D=window.HuataData, E=window.HuataEngine, R=window.HuataReactions, $=id=>document.getElementById(id);
  const game=$('game'), dialog=$('dialog'), reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const assetPaths={room:'assets/huata-room.webp',doctor:'assets/huata-doctor.webp',expressions:'assets/huata-expressions.webp',atlas:'assets/huata-portraits.webp',horse:'assets/huata-horse.webp',logo:'assets/huata-symbol.webp'};
  const imageCache=new Map(), assetImages={};
  let answers=Array(10).fill(null), index=0, result=null, busy=false, generation=0;
  let mutterTimer=0, toastTimer=0, repair=false, repairAt=0, blobURL=null, cardPromise=null, assetsReady=false, dialogSession=0;
  const repairQuestions=[5,6,8];
  let sceneVisible=true;
  function actorActive(){return assetsReady&&sceneVisible&&!document.hidden&&!dialog.open&&['intro','question'].includes(game.dataset.state);}
  let actor=null,actorFailed=false;
  try{if(window.HuataActor)actor=window.HuataActor.create({face:$('doctor-face'),gesture:$('doctor-gesture'),canAnimate:actorActive,reduced:()=>reduced.matches});}
  catch(error){actorFailed=true;console.warn('Portrait initialization failed',error);}
  function perform(method,...args){
    if(!actor||actorFailed)return;
    try{actor[method](...args);}catch(error){
      actorFailed=true;game.classList.remove('has-expressions');game.classList.add('actor-paused');
      try{actor.stop();}catch(ignore){}console.warn('Portrait animation paused',error);
    }
  }
  function syncActor(){const active=actorActive()&&!!actor&&!actorFailed;game.classList.toggle('actor-paused',!active);perform(active?'start':'stop');}
  const scheduled=new Set();
  function later(fn,ms){const id=setTimeout(()=>{scheduled.delete(id);fn();},ms);scheduled.add(id);return id;}
  function cancelScheduled(){for(const id of scheduled)clearTimeout(id);scheduled.clear();clearTimeout(mutterTimer);}
  function announce(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2800);}
  function event(name, extra={}){window.dispatchEvent(new CustomEvent('bodyall:game-event',{detail:{name,version:D.version,...extra}}));}
  let sound=null;
  try{if(window.HuataSound)sound=window.HuataSound.create({onState:enabled=>{$('sound').setAttribute('aria-pressed',String(enabled));$('sound').textContent=enabled?'소리 켜짐':'소리 꺼짐';$('sound').title=enabled?'음악과 목소리 끄기':'음악과 목소리 켜기';},onError:announce});}catch(error){console.warn('Audio unavailable',error);}
  function playSound(method,...args){if(!sound)return;try{sound[method](...args);}catch(error){console.warn('Audio skipped',error);}}
  function tone(frequency=500,duration=.055,delay=0){playSound('effect',frequency,duration,delay);}
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
      assetsReady=true;if(actor&&!actorFailed)game.classList.add('has-expressions');$('start').disabled=false;$('start-label').textContent='손목 맡기기';$('asset-status').textContent='질문 10개 · 약 1분 · 가입 없이';syncActor();
    }catch(err){assetsReady=false;syncActor();$('start').disabled=false;$('start-label').textContent='그림 다시 불러오기';$('asset-status').textContent='그림을 불러오지 못했어요. 한 번 더 눌러주세요.';}
  }
  function say(text,expression='warm',motion='nod'){
    clearTimeout(mutterTimer);$('mutter').textContent=text;$('mutter').classList.add('visible');
    perform('react',expression,motion);mutterTimer=setTimeout(()=>$('mutter').classList.remove('visible'),2600);
  }
  function react(q,code){const response=R?R.forAnswer(q,code,answers):{line:'그렇구먼. 다음 이야기도 들려주게.',expression:'neutral',gesture:'nod'};say(response.line,response.expression,response.gesture);playSound('acknowledge',{question:q,code,expression:response.expression});}
  function clearCard(){if(blobURL)URL.revokeObjectURL(blobURL);blobURL=null;cardPromise=null;}
  function reset(){
    generation++;cancelScheduled();clearCard();playSound('stopVoice');answers=Array(10).fill(null);index=0;result=null;repair=false;repairAt=0;busy=false;perform('reset');
    game.classList.remove('mirror-awake','face-visible','horse','fog');$('mutter').classList.remove('visible');$('story').open=false;
    $('reveal-caption').textContent='';$('stage').setAttribute('aria-label','내 손목을 짚으며 거울을 들고 있는 화타');
  }
  function start(){
    if(!assetsReady){loadAssets();return;}
    playSound('start');reset();$('intro').hidden=true;$('result-view').hidden=true;$('question-view').hidden=false;game.dataset.state='question';syncActor();
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
    },index===9?1250:950);
  }
  function setPortrait(person){
    const face=$('reflection');
    if(person.id==='horse'){face.style.backgroundImage="url('"+assetPaths.horse+"')";face.style.backgroundSize='100% 100%';face.style.backgroundPosition='50% 50%';}
    else if(Number.isInteger(person.tile)){face.style.backgroundImage="url('"+assetPaths.atlas+"')";face.style.backgroundSize='300% 400%';face.style.backgroundPosition=((person.tile%3)*50)+'% '+(Math.floor(person.tile/3)*100/3)+'%';}
  }
  function reveal(){
    playSound('stopVoice');result=E.getResult(answers);busy=true;repair=false;$('question-view').hidden=true;$('mutter').classList.remove('visible');clearTimeout(mutterTimer);game.dataset.state='revealing';syncActor();
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
    busy=false;game.dataset.state='result';syncActor();$('intro').hidden=true;$('question-view').hidden=true;$('result-view').hidden=false;
    game.classList.toggle('fog',result.kind==='fog');game.classList.toggle('horse',result.kind==='horse');
    $('result-name').textContent=result.name;$('analysis').replaceChildren();$('story').open=false;
    if(result.kind==='fog'){
      $('result-eyebrow').textContent='안개 낀 거울';$('result-title').textContent='아직은 얼굴이 잘 보이지 않아요.';
      $('result-quote').textContent='“성격 이야기 세 가지만 더 들려주겠나?”';$('share').textContent='답변 보태기';$('story').hidden=true;
    }else{
      $('result-eyebrow').textContent=result.faint?'희미하게 보이는 전생':'거울에 비친 당신의 전생';$('result-title').textContent=result.title;
      result.analysis.forEach(text=>{const p=document.createElement('p');p.textContent=text;$('analysis').append(p);});
      $('result-quote').textContent='“'+result.quote+'”';$('share').textContent='내 결과 공유하기 ↗';$('story').hidden=false;$('story-copy').textContent=result.story;
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
    game.dataset.state='question';syncActor();game.classList.remove('mirror-awake','face-visible','fog');$('result-view').hidden=true;$('question-view').hidden=false;$('reveal-caption').textContent='';renderQuestion();
    say('떠오르는 것부터 골라보게.');
  }
  function showDialog(title){playSound('stopVoice');dialogSession++;$('dialog-title').textContent=title;$('dialog-body').replaceChildren();if(!dialog.open)dialog.showModal();syncActor();}
  function closeDialog(){dialogSession++;dialog.close();syncActor();}
  function addText(parent,text,cls){const p=document.createElement('p');p.textContent=text;if(cls)p.className=cls;parent.append(p);return p;}
  function addButton(parent,text,cls,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls;b.addEventListener('click',fn);parent.append(b);return b;}
  async function openShare(){
    if(!result)return;if(result.kind==='fog'){repairAnswers();return;}
    const snapshot=result,token=generation;showDialog('내 전생은 '+snapshot.name+'!');const session=dialogSession,body=$('dialog-body');
    addText(body,E.shareText(snapshot),'share-message');
    const buttons=document.createElement('div');buttons.className='share-buttons';body.append(buttons);
    const share=addButton(buttons,'이 결과 친구에게 보내기 ↗','primary',async()=>{
      // Keep the result URL in the main share. Some apps discard text/URLs when a file is attached.
      const payload=E.sharePayload(snapshot);
      if(!navigator.share){await copyLink(snapshot,body);return;}
      share.disabled=true;
      try{await navigator.share(payload);event('share_api_resolved',{result:snapshot.id,withImage:false});}
      catch(error){if(error.name!=='AbortError')announce('공유 창을 열지 못했어요. 결과 문구와 링크를 복사해서 보내주세요.');}
      finally{share.disabled=false;}
    });
    const save=addButton(buttons,'이미지 저장','secondary',()=>{
      if(!blobURL)return;const a=document.createElement('a');a.href=blobURL;a.download='바디올_전생_'+snapshot.name.replaceAll(' ','_')+'.png';document.body.append(a);a.click();a.remove();event('result_card_export',{result:snapshot.id});announce('이미지를 열었다면 길게 눌러 저장할 수도 있어요.');
    });save.disabled=true;
    addButton(buttons,'결과 문구·링크 복사','secondary',()=>copyLink(snapshot,body));
    addText(body,navigator.share?'공유 창에서 카카오톡 등 원하는 앱을 선택하세요.':'결과 문구와 링크를 복사해 카카오톡에 붙여넣으세요.','share-help');
    const pending=addText(body,'결과 이미지를 준비하는 중…','share-help');event('share_preview_open',{result:snapshot.id});
    if(!cardPromise)cardPromise=makeCard(snapshot).catch(()=>null);
    const card=await cardPromise;if(token!==generation||session!==dialogSession||!dialog.open)return;pending.remove();
    if(card){if(blobURL)URL.revokeObjectURL(blobURL);blobURL=URL.createObjectURL(card.blob);const img=document.createElement('img');img.className='card-image';img.src=blobURL;img.alt=snapshot.name+' · '+snapshot.title+' · '+snapshot.analysis.join(' ')+' · 바디올한의원';body.append(img);save.disabled=false;}
    else addText(body,'이미지를 준비하지 못했지만, 위 버튼으로 결과를 보낼 수 있어요.','share-help');
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
  $('sound').addEventListener('click',()=>playSound('toggle'));
  $('help').addEventListener('click',()=>{showDialog('화타의 전생 진찰소');const body=$('dialog-body');addText(body,'앞에 앉은 사람은 한의사로 돌아온 화타. 손목을 맡긴 사람은 지금의 나예요. 거울에는 내 삼국지 전생이 나타나요.');addText(body,'열 가지 물음에 가까운 답을 골라보세요. 고민되면 “잘 모르겠어요”도 괜찮아요.');addText(body,'삼국지연의의 인물을 현대적으로 해석한 재미용 테스트입니다. 실제 진단이나 검증된 심리검사가 아닙니다.','fine');addText(body,'답변은 이 화면 안에서만 계산해요. 공유 카드에는 인물과 짧은 성향 분석이 담기며, 성별·몸 상태·불편한 부위는 공유하지 않아요.','fine');});
  $('dialog-close').addEventListener('click',closeDialog);dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
  document.querySelector('.clinic').addEventListener('click',()=>event('clinic_link_click'));
  try{const f=E.friend(new URLSearchParams(location.search).get('r'));if(f){$('friend-note').textContent='친구는 '+f.name+' — '+f.title+'. 이번엔 내 전생을 알아볼 차례!';$('friend-note').hidden=false;event('share_landing',{friendResult:f.id});}}catch(ignore){}
  document.addEventListener('visibilitychange',()=>{syncActor();playSound(document.hidden?'pause':'resume');});
  dialog.addEventListener('close',syncActor);
  if(reduced.addEventListener)reduced.addEventListener('change',()=>{perform('stop');syncActor();});
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{sceneVisible=entries[0].isIntersecting;syncActor();},{threshold:0});observer.observe($('stage'));}
  window.addEventListener('pageshow',()=>{syncActor();playSound('resume');});
  window.addEventListener('pagehide',e=>{playSound('pause');perform('stop');if(e.persisted)return;cancelScheduled();if(blobURL)URL.revokeObjectURL(blobURL);});
  loadAssets();
})();
