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
  function shareURL(result) {
    if (!friend(result.id)) throw new Error('공유할 수 없는 결과입니다.');
    const url = new URL(D.url); url.searchParams.set('r', result.id); url.searchParams.set('from','friend'); url.searchParams.set('v','1'); return url.href;
  }
  function shareText(result) { return (result.id === 'horse' ? '너는 뭐 나왔냐. 나는 말 나옴ㅋㅋ' : '나 전생에 '+result.name+'이었대ㅋㅋ 너는 누구냐')+'\n화타의 전생 진찰소 · 바디올한의원'; }
  const api = {getResult, valid, friend, shareURL, shareText}; root.HuataEngine=api;
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
