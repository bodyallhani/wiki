(function(){
  'use strict';
  const story=window.ClinicStory;
  const game=new window.ClinicEngine.ClinicGame();
  const $=id=>document.getElementById(id);
  const ui={scene:$('scene'),content:$('scene-content'),portrait:$('portrait'),dialogue:$('dialogue'),choices:$('choices'),speaker:$('speaker'),count:$('scene-count'),modal:$('modal'),modalTitle:$('modal-title'),modalBody:$('modal-body')};
  const gameURL='https://wiki.body-all.co.kr/contents/bodyall-clinic/';
  const shareURL=gameURL+'?from=friend';
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const details={
    O1:['어제의 취침 전 사용','2시간 17분','“자기 전에 잠깐만 봐요.”'],
    O2:['업무 파일','최종_진짜최종_이게마지막_17','마지막이 자꾸 후속작을 냅니다.'],
    O3:['이번 주에는 나도 챙기기','다음 주부터','월 → 화 → 수 → 목 → 금 → …'],
    O4:['09:10 회의 때 챙긴 커피','방금 받은 커피','아침 회의가 남긴 메모'],
    O5:['접수 메모','별건 아닌데요…','어떤 상태인지 궁금함 / 계속 불편하면 어쩌지']
  };
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
    $('clue-list').innerHTML=ids.map((id,i)=>id?`<div class="clue-card found"><small>${i===0?'물건에서 발견':'대화에서 발견'}</small>${esc(story.items[id].clue)}</div>`:`<div class="clue-card empty"><span>${i===0?'I':'II'}</span>${i===0?'물건 속에 담긴 이야기':'대답 속에 숨은 이야기'}</div>`).join('');
    document.querySelectorAll('[data-step]').forEach(li=>{const n=Number(li.dataset.step);li.classList.toggle('current',game.phase!=='start'&&n===game.step()&&game.phase!=='ending');li.classList.toggle('done',n<game.step()||game.phase==='ending');if(li.classList.contains('current'))li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
  }
  function advance(){
    if(game.phase!=='dialogue')return;
    const last=game.lineIndex===game.lines.length-1,context=game.context;
    game.next();
    if(last&&story.items[context]){tone('found');toast('생활 단서 발견 · '+story.items[context].clue);}
    if(game.phase==='ending'){emit('game_complete',{ending:game.result().ending,clue:game.selected});prepareCard(game.result()).catch(()=>{});}
    render(true);
  }
  function start(replay){if(game.start(replay)){emit('game_start',{replay});render(true);}}
  function choose(id){if(game.choose(id))render(true);}
  function render(moveFocus=false){
    ui.choices.replaceChildren();ui.choices.className='choices';ui.content.innerHTML='';ui.scene.dataset.view=game.phase;updateJournal();
    ui.count.textContent=game.phase==='start'?'EP.01':game.phase==='ending'?'이야기 정리 완료':`선택 ${game.step()} / 3`;
    portrait(0);
    if(game.phase==='start'){
      portrait(1);ui.speaker.textContent='진료실 문 앞';
      ui.content.innerHTML='<div class="title-plaque"><p class="eyebrow">바디올 클리닉</p><h2>이 환자,<br>나잖아?</h2><p>퇴근은 했는데<br>하루가 끝나지 않은 사람.</p></div>';
      const friend=new URLSearchParams(location.search).get('from')==='friend';
      ui.dialogue.innerHTML='<p>'+(friend?'친구가 만난 최대리, 이번엔 당신 차례입니다.':'세 번의 선택으로 최대리의 숨은 사연을 찾아보세요.')+'</p><small>물건을 살펴보고, 이야기를 듣고, 마음에 걸리는 단서를 골라주세요.</small>';
      action('오늘의 환자 만나기',()=>start(false),{primary:true});
    }else if(game.phase==='dialogue'){
      const [speaker,line]=game.lines[game.lineIndex];ui.speaker.textContent=speaker;ui.dialogue.textContent=line;
      const id=game.context?.replace(/^U/,'');
      portrait(game.context==='intro'?1:game.context==='common'?(game.lineIndex===0?4:5):(expressionFor[id]??0));
      if(details[id]&&game.context===id){const [label,title,sub]=details[id];ui.content.innerHTML=`<div class="object-detail"><span class="detail-label">${esc(label)}</span><strong>${esc(title)}</strong><p>${esc(sub)}</p></div>`;}
      else if(game.context?.startsWith('U'))ui.content.innerHTML=`<div class="note-bubble">${esc(story.items[id].clue)}</div>`;
      else if(game.context==='common')ui.content.innerHTML='<div class="note-bubble">이야기도 듣고,<br>몸 상태도 살피고.</div>';
      action(game.lineIndex===game.lines.length-1?'이어서 보기 ▸':'다음 대사 ▸',advance,{primary:true});
      ui.count.textContent=`대화 ${game.lineIndex+1} / ${game.lines.length}`;
    }else if(game.phase==='observe'){
      portrait(5);ui.speaker.textContent='물건 살펴보기';ui.dialogue.innerHTML='<p>먼저 눈에 들어오는 물건 하나를 눌러보세요.</p><small>최대리가 직접 꺼내 보여준 물건들입니다.</small>';
      ui.content.innerHTML='<div class="note-bubble">“업무 파일은 열면<br>또 일이 생겨요.”</div>';
      ui.choices.classList.add('object-choices');
      game.available().forEach((id,i)=>action(`<span class="choice-numeral">${['I','II','III','IV','V'][i]}</span><span>${esc(story.items[id].label)}</span>${game.previous?.observation===id?'<span class="previous-label">지난번 선택</span>':''}`,()=>choose(id),{html:true,className:'object-button'}));
    }else if(game.phase==='question'){
      portrait(4);ui.speaker.textContent='한 가지 물어보기';ui.dialogue.textContent='이제 한 가지를 더 물어볼까요?';ui.choices.classList.add('stacked');
      game.available().forEach((id,i)=>action(`<span class="choice-index">0${i+1}</span><span>${esc(story.items[id].label)} ${game.previous?.question===id?'<small class="previous-label">지난번</small>':''}</span>`,()=>choose(id),{html:true}));
    }else if(game.phase==='connect'){
      portrait(0);ui.speaker.textContent='이야기 더 들어보기';ui.dialogue.textContent='어느 이야기를 조금 더 들어볼까요?';ui.choices.classList.add('stacked');
      game.available().forEach((id,i)=>action(`<span class="choice-index">0${i+1}</span><span>‘${esc(story.items[id].clue)}’에 대해 묻기</span>`,()=>choose(id),{html:true}));
    }else if(game.phase==='discovery'){
      const result=game.result();portrait(5);ui.speaker.textContent='사연 발견';ui.dialogue.textContent='작은 단서에서 시작한 대화가 최대리의 이야기로 이어졌습니다.';
      ui.content.innerHTML=`<div class="result-panel"><span class="eyebrow">새롭게 들은 이야기</span><h2>${esc(result.story)}</h2><span class="stamp">사연 발견</span></div>`;
      action('최대리의 마지막 질문 듣기',()=>{game.explain();render(true);},{primary:true});
    }else if(game.phase==='ending'){
      const r=game.result();portrait(r.ending==='C'?5:2);ui.speaker.textContent='최대리의 마지막 한마디';ui.dialogue.innerHTML=`<p>“${esc(r.lastLine)}”</p><small>게임 속 선택으로 만든 별명입니다. 건강 상태를 판정하지 않습니다.</small>`;
      ui.content.innerHTML=`<div class="result-panel"><span class="eyebrow">오늘의 이야기 정리 완료</span><h2>${esc(r.title)}</h2><span class="nickname">${esc(r.nickname)}</span><p>${esc(r.description)}</p><span class="stamp">EP.01 · END</span></div>`;
      action('이 환자, 친구도 만나보기',openShare,{primary:true});action('다른 이야기 발견하기',()=>start(true));action('바디올 척추교정 알아보기',openClinic,{subtle:true});
    }
    if(moveFocus){const b=ui.choices.querySelector('button');b?.focus({preventScroll:true});}
  }
  function openModal(title,html){
    modalOpener=document.activeElement;ui.modalTitle.textContent=title;ui.modalBody.innerHTML=html;
    if(!ui.modal.open)ui.modal.showModal();
  }
  function closeModal(){ui.modal.close();}
  $('close-modal').addEventListener('click',closeModal);
  ui.modal.addEventListener('click',e=>{if(e.target!==ui.modal)return;const r=ui.modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();});
  ui.modal.addEventListener('close',()=>{shareGeneration++;if(cardURL){URL.revokeObjectURL(cardURL);cardURL=null;}modalOpener?.focus?.({preventScroll:true});});
  $('help-button').addEventListener('click',()=>openModal('진료실 이용 안내','<h3>천천히 읽고,<br>마음에 걸리는 이야기를 골라주세요.</h3><p>물건 5개 중 하나를 살펴보고, 질문 하나를 고른 뒤, 발견한 단서 두 개 중 하나로 대화를 이어갑니다. 제한 시간은 없습니다.</p><p>버튼은 마우스·터치로 누르거나 Tab과 Enter로 선택할 수 있습니다. 대화 중에는 Space로 다음 대사를 볼 수 있습니다.</p><small>실제 진단·치료나 성격 검사가 아닌 가상 인물의 이야기입니다. 이름·증상·연락처를 입력받지 않습니다. 플레이 기록을 저장하거나 외부 분석 서비스로 보내지 않습니다. 새로고침하면 처음부터 시작합니다. 효과음은 직접 켠 경우에만 재생됩니다.</small>'));
  $('sound-button').addEventListener('click',()=>{sound=!sound;$('sound-button').textContent=sound?'소리 켜짐':'소리 꺼짐';$('sound-button').setAttribute('aria-pressed',String(sound));$('sound-button').title=sound?'효과음 끄기':'효과음 켜기';if(sound)tone('found');});
  document.addEventListener('keydown',e=>{if(ui.modal.open||e.repeat)return;if(e.code==='Space'&&game.phase==='dialogue'&&!['TEXTAREA','INPUT','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();advance();}});
  function openClinic(){
    openModal('바디올의 척추·골반 진료',`<h3>바디올의 척추·골반 진료가 궁금하다면</h3><p>바디올한의원은 수원 인계동에서 척추·골반 진료와 공간척추교정(SART)을 안내하고 있습니다. 나에게 어떤 진료나 치료가 적합한지는 실제 상태를 확인한 뒤 판단합니다.</p><small>게임의 별명과 엔딩은 건강 상태나 치료 필요성을 판정하지 않습니다.</small><div class="modal-actions"><a class="action primary" id="clinic-link" href="https://wiki.body-all.co.kr/SART.html" target="_blank" rel="noopener">바디올 진료 안내·상담 보기</a><button class="action" id="return-game">게임으로 돌아가기</button></div>`);
    $('return-game').addEventListener('click',closeModal);$('clinic-link').addEventListener('click',()=>emit('clinic_link_click',{destination:'SART'}));
  }
  function shareText(r){return `픽셀 진료실에서 최대리를 만났는데, 이 환자 좀 우리 같음.\n나는 ${r.title}. 너는 어떤 이야기를 발견할까?\n바디올 클리닉 — 이 환자, 나잖아?\n${shareURL}`;}
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
      ctx.fillStyle='#758269';ctx.font='22px "Malgun Gothic", sans-serif';ctx.fillText('퇴근했지만 종료되지 않은 최대리',540,801);
      ctx.fillStyle='#244d47';ctx.font='700 44px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
      wrap(ctx,r.shareHeadline,540,869,790,62);
      ctx.fillStyle='#3e6356';ctx.font='600 30px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';ctx.fillText('나는 '+r.title,540,1071);
      ctx.font='25px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';ctx.fillText('이 환자, 너랑 좀 비슷한데?',540,1131);
      ctx.fillStyle='#dcd2ab';ctx.font='23px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';ctx.fillText('바디올한의원 제작 · 가상 캐릭터 / 오락용 결과',540,1250);
      return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('이미지 저장을 준비하지 못했습니다.')),'image/png'));
    })();cards.set(r.id,promise);promise.catch(()=>cards.delete(r.id));return promise;
  }
  async function openShare(){
    const r=game.result();if(!r||game.phase!=='ending')return;
    emit('share_preview_open',{ending:r.ending});
    const generation=++shareGeneration;
    openModal('이 환자, 친구도 만나보기',`<div id="card-preview" class="share-status">최대리의 결과 카드를 준비하고 있습니다.</div><textarea id="share-text" class="share-text" aria-label="친구에게 보낼 공유 문구" readonly>${esc(shareText(r))}</textarea><div class="modal-actions"><button class="action primary" id="native-share">공유하기</button><button class="action" id="save-image" disabled>이미지 저장</button><button class="action" id="copy-share">문구·링크 복사</button></div><p class="share-status" id="share-status">보낼 내용과 카드를 확인한 뒤 공유해주세요.</p>`);
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
      $('card-preview').innerHTML=`<img class="share-image" src="${cardURL}" alt="${esc(r.shareHeadline+' 나는 '+r.title)}">`;
      $('save-image').disabled=false;
    }catch{if(generation!==shareGeneration)return;const preview=$('card-preview');if(preview)preview.textContent='이미지를 준비하지 못했습니다. 아래 문구와 게임 링크는 공유할 수 있습니다.';}
  }
  function registerGameTools(){
    const context=document.modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const state=()=>({phase:game.phase,speaker:game.phase==='dialogue'?game.lines[game.lineIndex][0]:null,dialogue:game.phase==='dialogue'?game.lines[game.lineIndex][1]:null,choices:game.available().map(id=>({id,label:story.items[id].label,clue:story.items[id].clue})),result:game.phase==='ending'?{title:game.result().title,nickname:game.result().nickname}:null});
    const tools=[
      {name:'read_clinic_story',title:'Read the current clinic story',description:'Read the current dialogue and choices available in the game.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(){return state();}},
      {name:'advance_clinic_story',title:'Play the clinic story',description:'Start, advance one dialogue, or choose one currently available clue. Does not share, download, or leave the game.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['start','next','choose','explain','replay']},clueId:{type:'string'}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){
        if(ui.modal.open)throw new Error('Close the current dialog first.');
        if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['action','clueId'].includes(k)))throw new Error('Invalid input.');
        if(input.action==='choose'){if(typeof input.clueId!=='string'||!game.available().includes(input.clueId))throw new Error('That clue is not available.');choose(input.clueId);}
        else if(input.clueId!==undefined)throw new Error('clueId is only accepted for choose.');
        else if(input.action==='start'&&game.phase==='start')start(false);
        else if(input.action==='replay'&&game.phase==='ending')start(true);
        else if(input.action==='next'&&game.phase==='dialogue')advance();
        else if(input.action==='explain'&&game.phase==='discovery'){game.explain();render(true);}
        else throw new Error('This action is not available now.');
        return state();
      }}
    ];
    for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
    window.addEventListener('pagehide',e=>{if(!e.persisted)lifecycle.abort();},{once:true});
  }
  render();registerGameTools();
})();
