/* Versioned deterministic matching and public result sharing. Legacy engine.js stays immutable. */
(function(root){
  'use strict';
  const D=typeof module!=='undefined'&&module.exports?require('./data-v2.js'):root.HuataDataV2;
  function valid(answers){return Array.isArray(answers)&&answers.length===10&&answers.every(a=>['A','B','C','D','N'].includes(a));}
  const peopleById=new Map(D.people.map(p=>[p.id,p]));
  function friend(id){return peopleById.get(id)||(id==='horse'?D.horse:null);}
  function rankAnswers(answers){
    let best=null;
    for(let index=0;index<D.people.length;index++){
      const person=D.people[index],flags=Array.from(person.pattern,(a,q)=>a===answers[q]);
      const count=flags.reduce((a,b)=>a+Number(b),0),core=person.core.reduce((n,q)=>n+Number(flags[q]),0);
      let bits=0;for(const q of D.priority)bits=bits*2+Number(flags[q]);
      // The numeric key implements (two-or-more evidence, score, core count, question priority).
      const key=(count>=2?65536:0)+(count+core)*4096+core*1024+bits;
      if(!best||key>best.key)best={person,flags,count,core,key,index};
    }
    return best;
  }
  function getResult(answers){
    if(!valid(answers))throw new Error('열 문항의 답변이 필요합니다.');
    if(answers.every(a=>a==='N'))return {...D.horse,kind:'horse',analysis:[...D.horseAnalysis],evidence:[],faint:false};
    const picked=rankAnswers(answers),order=[...new Set([...picked.person.core,...D.priority])];
    const evidence=order.filter(q=>picked.flags[q]).slice(0,2).map(q=>({question:q,code:answers[q],text:D.analysis[q][answers[q].charCodeAt(0)-65]}));
    return {...picked.person,kind:'person',evidence,analysis:evidence.map(e=>e.text),faint:answers.filter(a=>a!=='N').length<=2||evidence.length<2};
  }
  function previewResult(id){
    const person=friend(id);if(!person)throw new Error('공유할 수 없는 결과입니다.');
    if(id==='horse')return {...person,kind:'horse',analysis:[...D.horseAnalysis],faint:false};
    return {...person,kind:'person',analysis:person.core.slice(0,2).map(q=>D.analysis[q][person.pattern.charCodeAt(q)-65]),faint:false};
  }
  function sentenceIds(person,analysis){
    const flat=D.analysis.flat(),seen=new Set(),ids=[];
    for(const text of Array.isArray(analysis)?analysis:[]){
      const id=flat.indexOf(text),q=Math.floor(id/4);
      if(id>=0&&!seen.has(q)&&person.pattern.charCodeAt(q)-65===id%4){seen.add(q);ids.push(id);}
      if(ids.length===2)break;
    }
    return ids;
  }
  function shareURL(result){
    const person=friend(result.id);if(!person)throw new Error('공유할 수 없는 결과입니다.');
    const url=new URL('result/v2/'+person.id+'/',D.url);
    if(person.id!=='horse'){
      const ids=sentenceIds(person,result.analysis);
      if(ids.length){const params=new URLSearchParams({a:ids.join('.')});if(result.faint)params.set('f','1');url.hash=params.toString();}
    }
    return url.href;
  }
  function sharedResult(id,fragment=''){
    const result=previewResult(id);if(result.kind==='horse')return result;
    const params=new URLSearchParams(fragment.replace(/^#/,'')),raw=params.get('a');
    if(!raw||!/^\d{1,2}(\.\d{1,2})?$/.test(raw))return result;
    const ids=raw.split('.').map(Number);
    if(ids.some(n=>n<0||n>=40||result.pattern.charCodeAt(Math.floor(n/4))-65!==n%4)||new Set(ids.map(n=>Math.floor(n/4))).size!==ids.length)return result;
    return {...result,analysis:ids.map(n=>D.analysis[Math.floor(n/4)][n%4]),faint:ids.length<2||params.get('f')==='1'};
  }
  function safeResult(result){
    const preview=previewResult(result.id);
    return preview.kind==='horse'?preview:sharedResult(result.id,new URL(shareURL(result)).hash);
  }
  function shareTitle(result){
    const p=previewResult(result.id);
    return p.id==='horse'?'나는 전생에 하후돈이 타던 말ㅋㅋ 너는 사람이었어?':'나는 전생에 ‘'+p.name+'’ — '+p.title;
  }
  function shareText(result){
    const p=safeResult(result),hook=p.id==='horse'?'너는 사람이었어? 🪞':'너는 누구였어? 🪞';
    const last=p.name.charCodeAt(p.name.length-1),hasFinal=last>=44032&&last<=55203&&(last-44032)%28!==0;
    return '나는 전생에 ‘'+p.name+'’'+(p.family==='fun'||p.kind==='horse'?(hasFinal?'이래ㅋㅋ':'래ㅋㅋ'):(hasFinal?'이었대.':'였대.'))+'\n'+p.title+'\n'+(p.faint?'적은 단서로 비친 전생 · ':'')+p.analysis.join(' ')+'\n\n'+hook+' 화타한테 물어봐!\n화타의 전생 진찰소 · © Bodyall';
  }
  function sharePayload(result){return {title:shareTitle(result),text:shareText(result),url:shareURL(result)};}
  const api={valid,getResult,rankAnswers,friend,previewResult,sharedResult,shareURL,shareTitle,shareText,sharePayload};
  root.HuataEngineV2=api;root.HuataEngine=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);
