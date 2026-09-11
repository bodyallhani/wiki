(function(){
  'use strict';
  const story=window.ClinicStory;
  const game=new window.ClinicEngine.ClinicGame();
  const $=id=>document.getElementById(id);
  const ui={scene:$('scene'),content:$('scene-content'),portrait:$('portrait'),dialogue:$('dialogue'),choices:$('choices'),speaker:$('speaker'),count:$('scene-count'),modal:$('modal'),modalTitle:$('modal-title'),modalBody:$('modal-body')};
  const gameURL='https://wiki.body-all.co.kr/contents/bodyall-clinic/';
  const shareURL=gameURL+'?from=friend';
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const expressionFor={O1:2,O2:1,O3:4,O4:3,O5:4,Q1:4,Q2:2,Q3:5};
  let sound=false,audioContext=null,toastTimer,modalOpener=null,cardURL=null,shareGeneration=0;
  const sheet=new Image(); sheet.src='assets/portraits.webp';
  const background=new Image(); background.src='assets/clinic-room.webp';
  const cards=new Map();
  function emit(name,detail={}){document.dispatchEvent(new CustomEvent('bodyall:game-event',{detail:{name,...detail}}));}
  function tone(type='tap'){
    if(!sound)return;
    try{
      audioContext??=new (window.AudioContext||window.webkitAudioContext)();
      if(audioContext.state==='suspended')audioContext.resume();
      const notes=type==='found'?[523.25,659.25,783.99]:[440];
      notes.forEach((f,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain(),t=audioContext.currentTime+i*.065;o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.045,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+.12);o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+.13);});
    }catch{sound=false;$('sound-button').textContent='소리 꺼짐';$('sound-button').setAttribute('aria-pressed','false');}
  }
  function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3000);}
  function portrait(index){ui.portrait.style.backgroundPosition=`${index%3*50}% ${Math.floor(index/3)*100}%`;}
  function action(label,callback,{primary=false,subtle=false,html=false,className=''}={}){
    const b=document.createElement('button');b.type='button';b.className='action '+(primary?'primary ':'')+(subtle?'subtle ':'')+className;
    if(html)b.innerHTML=label;else b.textContent=label;
    b.addEventListener('click',()=>{tone();callback();});ui.choices.appendChild(b);return b;
  }
  function updateJournal(){
    const ids=[game.observation,game.question];
    $('clue-count').textContent=ids.filter(Boolean).length+' / 2';
    $('clue-list').innerHTML=ids.map((id,i)=>id?`<div class="clue-card found"><small>최대리의 얘기</small>${esc(story.items[id].clue)}</div>`:`<div class="clue-card empty"><span>${i===0?'I':'II'}</span>${i===0?'먼저 말을 걸어보세요':'한 가지 더 물어보세요'}</div>`).join('');
    document.querySelectorAll('[data-step]').forEach(li=>{const n=Number(li.dataset.step);li.classList.toggle('current',game.phase!=='start'&&n===game.step()&&game.phase!=='ending');li.classList.toggle('done',n<game.step()||game.phase==='ending');if(li.classList.contains('current'))li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
  }
  function start(replay){if(game.start(replay)){emit('game_start',{replay});render(true);}}
  function choose(id){
    if(!game.choose(id))return;
    if(game.phase==='ending'){
      tone('found');emit('game_complete',{ending:game.result().ending,clue:game.selected});
      prepareCard(game.result()).catch(()=>{});
    }
    render(true);
  }
  function render(moveFocus=false){
    ui.choices.replaceChildren();ui.choices.className='choices';ui.content.innerHTML='';ui.scene.dataset.view=game.phase;updateJournal();
    $('game').dataset.playing=String(game.phase!=='start');
    $('my-line').hidden=true;$('my-line').innerHTML='';
    $('choice-prompt').hidden=true;
    ui.count.textContent=game.phase==='start'?'EP.01':game.phase==='ending'?'대화 끝':`${game.step()} / 3`;
    portrait(0);
    if(game.phase==='start'){
      portrait(1);ui.speaker.textContent='오늘은 내가 원장님';
      ui.content.innerHTML='<div class="title-plaque"><p class="eyebrow">바디올 클리닉</p><h2>이 환자,<br>나잖아?</h2><p>퇴근하고도<br>일 생각뿐인 최대리.</p></div>';
      const friend=new URLSearchParams(location.search).get('from')==='friend';
      ui.dialogue.innerHTML='<p>'+(friend?'이번엔 내가 원장님이 될 차례!':'최대리에게 무슨 말을 건넬까요?')+'</p><small>정답은 없어요. 하고 싶은 말을 세 번 고르면 됩니다.</small>';
      action('원장님으로 시작하기',()=>start(false),{primary:true});
    }else{
      ui.speaker.textContent='최대리와 나누는 대화';
      const exchange=game.exchange;
      if(exchange.player){
        $('my-line').hidden=false;
        $('my-line').innerHTML=`<span class="dialogue-name">나 · 원장님</span><p>${esc(exchange.player)}</p>`;
      }
      ui.dialogue.innerHTML=`<span class="dialogue-name patient">최대리</span><p>${esc(exchange.patient)}</p>`;
      const respondingTo=game.phase==='question'?game.observation:game.phase==='connect'?game.question:game.selected;
      portrait(game.phase==='observe'?1:(expressionFor[respondingTo]??0));
      if(game.phase==='question'){
        const [label,title,sub]=story.items[game.observation].detail;
        ui.content.innerHTML=`<div class="object-detail"><span class="detail-label">${esc(label)}</span><strong>${esc(title)}</strong><p>${esc(sub)}</p></div>`;
      }
      if(game.phase==='ending'){
        const r=game.result();portrait(r.ending==='C'?5:2);
        ui.content.innerHTML=`<div class="result-panel"><span class="eyebrow">최대리가 붙여준 내 별명</span><h2>${esc(r.nickname)}</h2><span class="nickname">${esc(r.title)}</span><p>${esc(r.description)}</p><span class="stamp">EP.01 · END</span></div>`;
        action('친구에게 보여주기',openShare,{primary:true});action('다른 말 걸어보기',()=>start(true));action('바디올 진료 안내',openClinic,{subtle:true});
      }else{
        $('choice-prompt').hidden=false;
        $('choice-prompt').textContent=game.phase==='observe'?'내가 먼저 건넬 말':game.phase==='question'?'이어서 물어볼 말':'마지막으로 건넬 말';
        ui.choices.classList.add(game.phase==='observe'?'opening-choices':'stacked');
        game.available().forEach((id,i)=>{
          const previous=(game.phase==='observe'?game.previous?.observation:game.phase==='question'?game.previous?.question:game.previous?.selected)===id;
          action(`<span class="choice-index">${i+1}</span><span>${esc(game.choiceText(id))}${previous?'<small class="previous-label">지난번 선택</small>':''}</span>`,()=>choose(id),{html:true});
        });
      }
    }
    if(moveFocus){
      ui.dialogue.tabIndex=-1;ui.dialogue.focus({preventScroll:true});
      (game.exchange?.player?$('my-line'):ui.dialogue).scrollIntoView({block:'nearest',behavior:'instant'});
    }
  }
  function openModal(title,html){
    modalOpener=document.activeElement;ui.modalTitle.textContent=title;ui.modalBody.innerHTML=html;
    if(!ui.modal.open)ui.modal.showModal();
  }
  function closeModal(){ui.modal.close();}
  $('close-modal').addEventListener('click',closeModal);
  ui.modal.addEventListener('click',e=>{if(e.target!==ui.modal)return;const r=ui.modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();});
  ui.modal.addEventListener('close',()=>{shareGeneration++;if(cardURL){URL.revokeObjectURL(cardURL);cardURL=null;}modalOpener?.focus?.({preventScroll:true});});
  $('help-button').addEventListener('click',()=>openModal('이렇게 플레이해요','<h3>나는 원장님,<br>상대는 직장인 최대리.</h3><p>아래 버튼은 내가 건넬 말입니다. 하나를 고르면 최대리가 바로 대답해요. 세 번 대화하면 끝!</p><p>선택에 정답이나 시간 제한은 없어요. 다시 해보면 다른 대답도 들을 수 있어요.</p><small>마우스·터치 또는 Tab과 Enter로 선택합니다. 가상 인물과 나누는 대화 게임이며 실제 진료나 성격 검사가 아닙니다. 이름·증상·연락처를 입력받지 않고 플레이 기록을 저장하거나 전송하지 않습니다. 새로고침하면 처음부터 시작합니다.</small>'));
  $('sound-button').addEventListener('click',()=>{sound=!sound;$('sound-button').textContent=sound?'소리 켜짐':'소리 꺼짐';$('sound-button').setAttribute('aria-pressed',String(sound));$('sound-button').title=sound?'효과음 끄기':'효과음 켜기';if(sound)tone('found');});
  function openClinic(){
    openModal('바디올의 척추·골반 진료',`<h3>바디올의 척추·골반 진료가 궁금하다면</h3><p>바디올한의원은 수원 인계동에서 척추·골반 진료와 공간척추교정(SART)을 안내하고 있습니다. 나에게 어떤 진료나 치료가 적합한지는 실제 상태를 확인한 뒤 판단합니다.</p><small>게임의 별명과 엔딩은 건강 상태나 치료 필요성을 판정하지 않습니다.</small><div class="modal-actions"><a class="action primary" id="clinic-link" href="https://wiki.body-all.co.kr/SART.html" target="_blank" rel="noopener">바디올 진료 안내·상담 보기</a><button class="action" id="return-game">게임으로 돌아가기</button></div>`);
    $('return-game').addEventListener('click',closeModal);$('clinic-link').addEventListener('click',()=>emit('clinic_link_click',{destination:'SART'}));
  }
  function shareText(r){return `내가 원장님이 되어 최대리랑 얘기해봤어.\n내 별명은 ‘${r.nickname}’. 너라면 뭐라고 할래?\n바디올 클리닉 — 이 환자, 나잖아?\n${shareURL}`;}
  function loadImage(img){if(img.complete&&img.naturalWidth)return Promise.resolve(img);return new Promise((resolve,reject)=>{img.addEventListener('load',()=>resolve(img),{once:true});img.addEventListener('error',()=>reject(new Error('이미지를 불러오지 못했습니다.')),{once:true});if(img.complete&&!img.naturalWidth)reject(new Error('이미지를 불러오지 못했습니다.'));});}
  function wrap(ctx,text,x,y,width,lineHeight){
    let line='',row=0;
    for(const char of text){if(char==='\n'){ctx.fillText(line,x,y+row++*lineHeight);line='';continue;}const next=line+char;if(ctx.measureText(next).width>width&&line){ctx.fillText(line.trim(),x,y+row++*lineHeight);line=char;}else line=next;}
    if(line)ctx.fillText(line.trim(),x,y+row++*lineHeight);return y+row*lineHeight;
  }
  async function prepareCard(r){
    if(cards.has(r.id))return cards.get(r.id);
    const promise=(async()=>{
      await Promise.all([loadImage(sheet),loadImage(background)]);
      if(document.fonts?.ready)await document.fonts.ready;
      const c=document.createElement('canvas');c.width=1080;c.height=1350;const ctx=c.getContext('2d');
      if(!ctx)throw new Error('이 브라우저에서 이미지 생성을 지원하지 않습니다.');
      ctx.fillStyle='#173f43';ctx.fillRect(0,0,1080,1350);
      ctx.strokeStyle='#c8aa67';ctx.lineWidth=3;ctx.strokeRect(27,27,1026,1296);ctx.strokeRect(38,38,1004,1274);
      ctx.fillStyle='#f5e8c7';ctx.textAlign='center';ctx.font='600 27px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';ctx.fillText('바디올 클리닉 · 생활공감 픽셀게임',540,98);
      ctx.save();ctx.beginPath();ctx.rect(72,140,936,620);ctx.clip();ctx.drawImage(background,0,0,background.naturalWidth,background.naturalHeight,72,140,936,624);
      ctx.fillStyle='#12393933';ctx.fillRect(72,140,936,620);
      const n=expressionFor[r.id]??0,cw=sheet.naturalWidth/3,ch=sheet.naturalHeight/2;
      ctx.drawImage(sheet,(n%3)*cw,Math.floor(n/3)*ch,cw,ch,234,149,642,642);ctx.restore();
      ctx.fillStyle='#f7edd5';ctx.fillRect(72,741,936,455);ctx.strokeStyle='#b2a16e';ctx.lineWidth=2;ctx.strokeRect(82,751,916,435);
      ctx.fillStyle='#758269';ctx.font='22px "Malgun Gothic", sans-serif';ctx.fillText('퇴근했는데 아직도 일하는 최대리',540,801);
      ctx.fillStyle='#244d47';ctx.font='700 44px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
      wrap(ctx,r.shareHeadline,540,869,790,62);
      ctx.fillStyle='#3e6356';ctx.font='600 30px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';ctx.fillText('내 별명은 ‘'+r.nickname+'’',540,1071);
      ctx.font='25px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';ctx.fillText('이 환자, 너랑 좀 비슷한데?',540,1131);
      ctx.fillStyle='#dcd2ab';ctx.font='23px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';ctx.fillText('바디올한의원 제작 · 가상 캐릭터 / 오락용 결과',540,1250);
      return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('이미지 저장을 준비하지 못했습니다.')),'image/png'));
    })();cards.set(r.id,promise);promise.catch(()=>cards.delete(r.id));return promise;
  }
  async function openShare(){
    const r=game.result();if(!r||game.phase!=='ending')return;
    emit('share_preview_open',{ending:r.ending});
    const generation=++shareGeneration;
    openModal('친구에게 보여주기',`<div id="card-preview" class="share-status">최대리의 결과 카드를 준비하고 있습니다.</div><textarea id="share-text" class="share-text" aria-label="친구에게 보낼 공유 문구" readonly>${esc(shareText(r))}</textarea><div class="modal-actions"><button class="action primary" id="native-share">공유하기</button><button class="action" id="save-image" disabled>이미지 저장</button><button class="action" id="copy-share">문구·링크 복사</button></div><p class="share-status" id="share-status">보낼 내용과 카드를 확인한 뒤 공유해주세요.</p>`);
    let card=null;
    $('copy-share').addEventListener('click',async()=>{try{if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable');await navigator.clipboard.writeText(shareText(r));toast('문구와 게임 링크를 복사했습니다.');}catch{$('share-text')?.focus();$('share-text')?.select();toast('선택된 문구를 직접 복사해주세요.');}});
    $('native-share').addEventListener('click',async()=>{
      if(!navigator.share){$('share-status').textContent='이 브라우저에서는 기본 공유창을 지원하지 않습니다. 이미지를 저장하거나 문구·링크를 복사해주세요.';return;}
      const text=shareText(r).replace('\n'+shareURL,'');
      let data={title:'바디올 클리닉 — 이 환자, 나잖아?',text,url:shareURL};
      if(card&&typeof File!=='undefined'){const file=new File([card],`bodyall-clinic-${r.id}.png`,{type:'image/png'});if(navigator.canShare?.({files:[file]}))data={...data,files:[file]};}
      try{await navigator.share(data);emit('share_api_resolved',{withImage:!!data.files});}
      catch(e){if(e.name==='AbortError')return;const status=$('share-status');if(status)status.textContent='공유창을 열지 못했습니다. 이미지를 저장하거나 문구·링크를 복사해주세요.';}
    });
    $('save-image').addEventListener('click',()=>{if(!cardURL)return;const a=document.createElement('a');a.href=cardURL;a.download=`bodyall-clinic-${r.id}.png`;document.body.appendChild(a);a.click();a.remove();emit('result_card_export',{clue:r.id});$('share-status').textContent='이미지 저장을 요청했습니다. 모바일에서 저장되지 않으면 위 이미지를 길게 눌러 저장해주세요.';});
    try{
      card=await prepareCard(r);
      if(!ui.modal.open||generation!==shareGeneration)return;
      if(cardURL)URL.revokeObjectURL(cardURL);cardURL=URL.createObjectURL(card);
      $('card-preview').innerHTML=`<img class="share-image" src="${cardURL}" alt="${esc(r.shareHeadline+' 내 별명은 '+r.nickname)}">`;
      $('save-image').disabled=false;
    }catch{if(generation!==shareGeneration)return;const preview=$('card-preview');if(preview)preview.textContent='이미지를 준비하지 못했습니다. 아래 문구와 게임 링크는 공유할 수 있습니다.';}
  }
  function registerGameTools(){
    const context=document.modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const state=()=>({phase:game.phase,playerRole:'원장님',character:'최대리',exchange:game.exchange,choices:game.available().map(id=>({id,text:game.choiceText(id)})),result:game.phase==='ending'?{title:game.result().title,nickname:game.result().nickname}:null});
    const tools=[
      {name:'read_clinic_story',title:'Read the current clinic story',description:'Read the current dialogue and choices available in the game.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(){return state();}},
      {name:'advance_clinic_story',title:'Play the clinic story',description:'Start the conversation or choose one currently available line to say. Does not share, download, or leave the game.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['start','choose','replay']},clueId:{type:'string'}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){
        if(ui.modal.open)throw new Error('Close the current dialog first.');
        if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['action','clueId'].includes(k)))throw new Error('Invalid input.');
        if(input.action==='choose'){if(typeof input.clueId!=='string'||!game.available().includes(input.clueId))throw new Error('That clue is not available.');choose(input.clueId);}
        else if(input.clueId!==undefined)throw new Error('clueId is only accepted for choose.');
        else if(input.action==='start'&&game.phase==='start')start(false);
        else if(input.action==='replay'&&game.phase==='ending')start(true);
        else throw new Error('This action is not available now.');
        return state();
      }}
    ];
    for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
    window.addEventListener('pagehide',e=>{if(!e.persisted)lifecycle.abort();},{once:true});
  }
  render();registerGameTools();
})();
