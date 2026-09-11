/* Short responses to the v2 everyday questions; the approved voice files are unchanged. */
(function(root){
  'use strict';
  const r=(line,expression='warm',gesture='nod')=>({line,expression,gesture});
  const rows=[
    [r('해냈다는 한마디가 힘이 되는군.'),r('허허, 실력은 알아줘야지!','warm','chuckle'),r('든든하다는 말, 참 좋지.'),r('자네다움을 알아주는 말이구먼.')],
    [r('하던 일은 마음에 남는구먼.','thoughtful','tilt'),r('쉴 때는 확실하구먼.','warm','chuckle'),r('쉬다가도 누가 찾으면 나가는군.'),r('재미있는 건 조금 더 하고 싶지.','warm','lean')],
    [r('이유부터 납득하고 싶은 거군.','thoughtful','tilt'),r('오, 요점만 잡으면 빠르구먼!','surprised','recoil'),r('믿고 맡길 사람이 중요하겠군.'),r('직접 겪은 것이 기준이구먼.','thoughtful','nod')],
    [r('메뉴도 비교해보고 고르는군.','thoughtful','tilt'),r('먹고 싶은 건 분명하구먼.','warm','chuckle'),r('함께 먹는 사람들을 살피는군.'),r('골라주는 대로 먹는 것도 편하지.')],
    [r('막히면 방법부터 바꾸는구먼.','warm','lean'),r('한 번 더라… 기억해두지.','surprised','recoil'),r('잘하는 사람에게 배우는 쪽이군.'),r('다음 기회를 보는 것도 방법이지.','thoughtful','nod')],
    [r('말을 듣고 고쳐볼 수 있구먼.'),r('자네가 납득해야 움직이겠군.','thoughtful','tilt'),r('주변에 미칠 영향도 생각하는군.'),r('흐음… 말리는 이유가 궁금하겠군.','thoughtful','lean')],
    [r('할 일부터 나누는 사람이구먼.'),r('오, 먼저 손이 나가는군!','surprised','recoil'),r('같이 의논할 때 힘이 나겠군.'),r('맡길 사람이 있으면 좋지.','warm','chuckle')],
    [r('끝나기 전에는 신중한 편이구먼.','thoughtful','nod'),r('벌써 성공한 모습이 보이나?','warm','chuckle'),r('함께한 사람부터 떠올리는군.'),r('사람을 모으는 쪽이구먼.','surprised','lean')],
    [r('근거를 챙겨서 말하는구먼.','thoughtful','tilt'),r('말은 빠른 편이겠군.','surprised','recoil'),r('민망하지 않게 챙기는구먼.'),r('허허, 농담에 한마디 담는군.','warm','chuckle')],
    [r('시간이 나면 밀린 일을 보는군.'),r('움직이며 보내고 싶은 거군.','warm','lean'),r('사람을 만날 시간이 반갑겠군.'),r('마음 가는 대로 보내도 좋지.','warm','chuckle')]
  ];
  function forAnswer(q,code,answers=[]){
    if(!rows[q])throw new RangeError('Unknown question');
    if(code==='N'){
      if(q===9&&answers.length===10&&answers.every(a=>a==='N'))return r('자, 거울을 한번 보세.','thoughtful','lean');
      let streak=1;for(let i=q-1;i>=0&&answers[i]==='N';i--)streak++;
      return streak>=3?r('음… 조금만 더 보세.','thoughtful','tilt'):r('그럴 수도 있지. 편하게 고르게.');
    }
    const response=rows[q][code.charCodeAt(0)-65];if(!response)throw new RangeError('Unknown answer');return {...response};
  }
  const api={forAnswer,expressions:['neutral','warm','thoughtful','surprised']};root.HuataReactions=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);
