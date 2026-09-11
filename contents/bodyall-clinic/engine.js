(function (root) {
  'use strict';
  const D = root.HuataData || (typeof require === 'function' ? require('./data.js') : null);
  function valid(answers) {
    return Array.isArray(answers) && answers.length === 10 && answers.every((a,i) => D.questions[i].answers.some(b => b.code === a));
  }
  function getResult(answers) {
    if (!valid(answers)) throw new Error('열 문항의 답변이 필요합니다.');
    if (answers.every(a => a === 'N')) return {...D.horse, kind:'horse', analysis:['무슨 질문이 와도 대답은 한결같아요.', '정체는 흐려도 일관성은 확실해요.'], evidence:[], faint:false};
    const selected = answers.slice(3), count = selected.filter(a => a !== 'N').length;
    if (!count) return {id:'fog', kind:'fog', name:'아직 흐릿한 전생', analysis:[], evidence:[]};
    const ranked = D.people.map(p => {
      const flags = selected.map((a,i) => Number(a === p.pattern[i]));
      return {person:p, flags, score:flags.reduce((a,b) => a+b,0)};
    });
    function compare(a,b) {
      if (a.score !== b.score) return b.score-a.score;
      for (const i of D.priority) if (a.flags[i] !== b.flags[i]) return b.flags[i]-a.flags[i];
      return 0;
    }
    ranked.sort(compare);
    const ties = ranked.filter(p => compare(p, ranked[0]) === 0).sort((a,b) => a.person.name < b.person.name ? -1 : a.person.name > b.person.name ? 1 : 0);
    const seed = selected.reduce((n,a) => n*5 + 'NABCD'.indexOf(a), 0), picked = ties[seed % ties.length];
    const evidence = D.priority.filter(i => picked.flags[i]).slice(0,2).map(i => ({question:i+3, code:selected[i], text:D.analysis[i][selected[i].charCodeAt(0)-65]}));
    return {...picked.person, kind:'person', faint:count<=2, analysis:evidence.map(e => e.text), evidence};
  }
  function friend(id) { return D.people.find(p => p.id === id) || (id === 'horse' ? D.horse : null); }
  function previewResult(id) {
    const person=friend(id);if(!person)throw new Error('공유할 수 없는 결과입니다.');
    const analysis=id==='horse' ? ['무슨 질문이 와도 대답은 한결같아요.', '정체는 흐려도 일관성은 확실해요.'] : D.priority.slice(0,2).map(i=>D.analysis[i][person.pattern.charCodeAt(i)-65]);
    return {...person,kind:id==='horse'?'horse':'person',analysis};
  }
  function shareURL(result) {
    if (!friend(result.id)) throw new Error('공유할 수 없는 결과입니다.');
    const url=new URL('result/'+result.id+'/',D.url),person=previewResult(result.id);
    // Only public personality sentence IDs go into the fragment; never raw answers or health data.
    if(person.kind==='person'&&Array.isArray(result.analysis)){
      const ids=result.analysis.slice(0,2).map(text=>D.analysis.flat().indexOf(text)).filter(id=>id>=0&&person.pattern.charCodeAt(Math.floor(id/4))-65===id%4);
      if(ids.length)url.hash='a='+[...new Set(ids)].join('.');
    }
    return url.href;
  }
  function sharedResult(id,fragment='') {
    const result=previewResult(id);if(result.kind!=='person')return result;
    const value=new URLSearchParams(fragment.replace(/^#/, '')).get('a');
    if(!value||!/^\d{1,2}(\.\d{1,2})?$/.test(value))return result;
    const ids=value.split('.').map(Number);
    if(new Set(ids).size!==ids.length||ids.some(n=>n>27||result.pattern.charCodeAt(Math.floor(n/4))-65!==n%4))return result;
    return {...result,analysis:ids.map(n=>D.analysis[Math.floor(n/4)][n%4])};
  }
  function shareTitle(result) {
    const person=friend(result.id);if(!person)throw new Error('공유할 수 없는 결과입니다.');
    return person.id==='horse'?'나는 전생에 이름 모를 말…ㅋㅋ 너는 누구였어?':'나는 전생에 ‘'+person.name+'’! 너는 누구였어?';
  }
  function shareText(result) {
    const person=previewResult(result.id),analysis=Array.isArray(result.analysis)&&result.analysis.length?result.analysis:person.analysis;
    const opening=person.id==='horse'?'나는 전생에 ‘'+person.name+'’…ㅋㅋ':'나는 전생에 ‘'+person.name+'’!';
    return opening+'\n'+person.title+'\n'+analysis.slice(0,2).join(' ')+'\n\n너는 누구였어? 화타한테 물어봐!\n화타의 전생 진찰소 · © Bodyall';
  }
  function sharePayload(result) { return {title:shareTitle(result),text:shareText(result),url:shareURL(result)}; }
  const api = {getResult, valid, friend, previewResult, sharedResult, shareURL, shareTitle, shareText, sharePayload}; root.HuataEngine=api;
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
