(function(root){
  'use strict';
  const PEOPLE={zhuge:'제갈량',cao:'조조',liu:'유비',guan:'관우',zhang:'장비',zhao:'조운',sun:'손권',zhou:'주유',sima:'사마의',huang:'황충',lu:'여포',diao:'초선',meng:'맹획',dong:'동탁',yuan:'원술',liushan:'유선',jiao:'장각',li:'이각',xing:'형도영',mi:'예형',zuo:'좌자',xu:'허저',horse:'하후돈이 타던 말'};
  const FUN=['meng','dong','yuan','liushan','jiao','li','xing','mi','zuo','xu'];
  function parseCSV(text){
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];
      if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
      else if(c===','&&!quoted){row.push(cell);cell='';}
      else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
      else cell+=c;
    }
    if(quoted)throw Error('CSV의 따옴표가 닫히지 않았습니다. 다시 내려받은 파일을 선택해주세요.');
    if(cell||row.length){row.push(cell);rows.push(row);}
    const normalize=s=>s.replace(/^\uFEFF/,'').trim().toLowerCase();
    const headerIndex=rows.findIndex(r=>r.some(c=>['event name','이벤트 이름'].includes(normalize(c)))&&r.some(c=>['event count','이벤트 수'].includes(normalize(c))));
    if(headerIndex<0)throw Error('GA4 이벤트 보고서 CSV를 선택해주세요. ‘이벤트 이름’과 ‘이벤트 수’ 열이 필요합니다.');
    const header=rows[headerIndex].map(normalize),nameAt=header.findIndex(c=>['event name','이벤트 이름'].includes(c)),countAt=header.findIndex(c=>['event count','이벤트 수'].includes(c));
    const totals={};let matched=0;
    for(const r of rows.slice(headerIndex+1)){const name=r[nameAt]?.trim();if(!/^huata_[a-z0-9_]+$/.test(name||''))continue;
      const count=Number((r[countAt]||'').replace(/,/g,'').trim());if(!Number.isFinite(count)||count<0||!Number.isInteger(count))throw Error('이벤트 수를 읽지 못했습니다. 합계가 포함된 원본 CSV를 사용해주세요.');
      totals[name]=(totals[name]||0)+count;matched++;
    }
    if(!matched)throw Error('이 파일에 화타 게임 이벤트가 없습니다. 수집 기간과 이벤트 필터를 확인해주세요.');
    return totals;
  }
  function summarize(t,selected='auto'){
    const version=selected==='auto'?(Object.keys(t).some(n=>n.startsWith('huata_v2_'))?'v2':'v1'):selected;
    if(!['v1','v2'].includes(version))throw Error('알 수 없는 버전입니다.');
    const n=name=>t[version==='v2'?name.replace(/^huata_/,'huata_v2_'):name]||0,starts=n('huata_start'),completed=n('huata_complete'),intent=n('huata_share_intent');
    const people=Object.entries(PEOPLE).filter(([id])=>version==='v2'||!FUN.includes(id)).map(([id,name])=>({id,name,family:id==='horse'?'special':FUN.includes(id)?'fun':'cool',results:n('huata_result_'+id),shares:n('huata_result_share_'+id)})).sort((a,b)=>b.results-a.results);
    const familyCount=f=>people.filter(p=>p.family===f).reduce((total,p)=>total+p.results,0),cool=familyCount('cool'),fun=familyCount('fun'),special=familyCount('special'),ordinary=cool+fun;
    return {version,cool,fun,special,ordinary,coolRate:ordinary?cool/ordinary:null,funRate:ordinary?fun/ordinary:null,starts,completed,completionRate:starts?completed/starts:null,shareIntent:intent,shareRate:completed?intent/completed:null,
      visits:n('huata_visit'),sharedViews:n('huata_shared_view'),friendStarts:n('huata_friend_start'),copies:n('huata_copy'),saves:n('huata_save'),fog:n('huata_fog'),
      steps:Array.from({length:10},(_,i)=>({question:i+1,count:n('huata_step_'+String(i+1).padStart(2,'0'))})),
      people};
  }
  const api={parseCSV,summarize,PEOPLE};if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(!root.document)return;
  const $=id=>document.getElementById(id),cfg=root.HuataAnalyticsConfig||{},fmt=n=>n.toLocaleString('ko-KR'),pct=n=>n===null?'—':(n*100).toFixed(1)+'%';
  $('connection').textContent=cfg.enabled&&cfg.measurementId?'수집 연결 설정됨 · 실제 수신은 GA4에서 확인':'수집 연결 대기 · 현재 버전은 통계를 전송하지 않습니다';
  for(const [id,key] of [['open-realtime','realtimeURL'],['open-reports','reportsURL'],['open-dashboard','dashboardURL']]){
    const a=$(id),url=cfg[key];if(url&&/^https:\/\/(?:analytics\.google\.com|datastudio\.google\.com|lookerstudio\.google\.com)\//.test(url)){a.href=url;a.hidden=false;}
  }
  let loadedTotals=null,loadedFile='';
  function renderStats(){
    if(!loadedTotals)return;
    const s=summarize(loadedTotals,$('report-version').value);
    for(const key of ['starts','completed','shareIntent','friendStarts','visits','sharedViews','copies','saves','fog','cool','fun','special'])$(key).textContent=fmt(s[key]);
    $('completionRate').textContent=pct(s.completionRate);$('shareRate').textContent=pct(s.shareRate);
    $('coolRate').textContent=pct(s.coolRate);$('funRate').textContent=pct(s.funRate);
    $('version-label').textContent=s.version==='v2'?'개편판 v2':'기존판 v1';
    $('people').replaceChildren(...s.people.map(p=>{const tr=document.createElement('tr');for(const value of [p.name,fmt(p.results),fmt(p.shares),pct(p.results?p.shares/p.results:null)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}return tr;}));
    $('steps').replaceChildren(...s.steps.map(p=>{const div=document.createElement('div');div.className='step';const span=document.createElement('span');span.textContent=p.question+'번';const meter=document.createElement('meter');meter.min=0;meter.max=Math.max(1,...s.steps.map(x=>x.count));meter.value=p.count;const b=document.createElement('b');b.textContent=fmt(p.count);div.append(span,meter,b);return div;}));
    $('file-status').textContent=loadedFile+' · '+(s.version==='v2'?'개편판 v2':'기존판 v1')+'를 집계했습니다. 최신 수치는 새 CSV를 선택해주세요.';$('result').hidden=false;
  }
  $('report-version').addEventListener('change',renderStats);
  $('csv').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      if(file.size>5*1024*1024)throw Error('5MB 이하의 이벤트 보고서를 선택해주세요.');
      loadedTotals=parseCSV(await file.text());loadedFile=file.name;renderStats();
    }catch(error){loadedTotals=null;$('file-status').textContent=error.message;$('result').hidden=true;}
  });
  $('source').addEventListener('change',()=>{const u=new URL('../','https://wiki.body-all.co.kr/contents/bodyall-clinic/stats/');u.searchParams.set('src',$('source').value);$('campaign-url').value=u.href;});
  $('copy-campaign').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('campaign-url').value);$('campaign-status').textContent='복사했습니다.';}catch(ignore){$('campaign-url').select();$('campaign-status').textContent='선택된 링크를 복사해주세요.';}});
})(typeof globalThis!=='undefined'?globalThis:window);
