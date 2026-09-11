/* Short, answer-specific dialogue. Entertainment only; no medical inference. */
(function(root){
  'use strict';
  const r=(line,expression='warm',gesture='nod')=>({line,expression,gesture});
  const rows=[
    {A:r('알겠네. 요즘은 어떻게 지내나?'),B:r('알겠네. 요즘은 어떻게 지내나?'),C:r('알겠네. 요즘은 어떻게 지내나?')},
    {A:r('쉽게 지치는구먼. 편히 앉아 있게.','thoughtful','lean'),B:r('오, 기운 하나는 장수감이로군!','surprised','recoil'),C:r('좋은 날도, 처지는 날도 있겠지.','thoughtful','tilt'),D:r('괜찮다니 나도 반갑구먼.','warm','nod')},
    {A:r('목과 어깨구먼. 알겠네.','thoughtful','nod'),B:r('허리와 다리 쪽이구먼. 알겠네.','thoughtful','nod'),C:r('속이 불편하다는 말이군. 알겠네.','thoughtful','nod'),D:r('머리와 눈 쪽이구먼. 알겠네.','thoughtful','nod'),E:r('불편한 곳이 없다니 다행일세.')},
    {A:r('몸은 쉬어도 머리는 바쁘구먼.','thoughtful','tilt'),B:r('허허, 쉬는 것도 심심한가?','warm','chuckle'),C:r('쉬는 중에도 사람을 챙기는군.'),D:r('혼자 느긋한 시간, 좋지.')},
    {A:r('생각 하나가 또 다른 생각을 부르는군.','thoughtful','tilt'),B:r('속마음이 금세 밖으로 나오는구먼.','surprised','recoil'),C:r('남의 표정까지 눈에 들어오는군.','thoughtful','lean'),D:r('조용히 정리할 시간이 필요하구먼.','thoughtful','nod')},
    {A:r('허허, 남에게 맡기기가 쉽지 않지.','warm','chuckle'),B:r('믿고 맡길 사람을 알아보는군.'),C:r('함께할 때 힘이 나는 쪽이구먼.'),D:r('말보다 끝낸 일로 보여주는군.')},
    {A:r('돌다리도 두드려 보는 편이구먼.','thoughtful','tilt'),B:r('오, 마음을 정하면 빠르구먼!','surprised','recoil'),C:r('다른 생각도 먼저 들어보는군.'),D:r('자네만의 기준이 있구먼.','thoughtful','nod')},
    {A:r('막히면 다른 길을 찾는구먼.','warm','lean'),B:r('일단 해보자는 쪽이로군!','surprised','recoil'),C:r('사람들과 발을 맞춰 가는군.'),D:r('기다리는 것도 자네의 한 수군.','thoughtful','tilt')},
    {A:r('해냈다는 한마디가 힘이 되는군.'),B:r('허허, 실력은 알아줘야지!','warm','chuckle'),C:r('든든한 사람이라는 말, 참 좋지.'),D:r('마음을 알아주는 사람이 고맙지.','warm','lean')},
    {A:r('마무리까지 해야 마음이 놓이는군.','thoughtful','nod'),B:r('허허, 아직 의욕이 남았구먼!','warm','chuckle'),C:r('맡길 줄도 아는 사람이구먼.'),D:r('좋네. 쉴 때는 쉬어야지.','warm','nod')}
  ];
  function forAnswer(question,code,answers=[]){
    const row=rows[question];if(!row)throw new RangeError('Unknown question');
    if(code==='N'){
      let streak=1;for(let i=question-1;i>=0&&answers[i]==='N';i--)streak++;
      if(question===9&&answers.length===10&&answers.every(a=>a==='N'))return r('잠깐… 거울이 좀 이상한데?','surprised','lean');
      if(streak>=4)return r('허허, 오늘은 나도 좀 어렵구먼.','warm','chuckle');
      if(streak===3)return r('음… 거울도 고개를 갸웃하는군.','thoughtful','tilt');
      if(streak===2)return r('천천히 떠올려도 괜찮네.','warm','lean');
      return r(question===0?'괜찮네. 편하게 이야기해 보세.':'그럴 수 있지. 다음 이야기를 해보세.','warm','nod');
    }
    if(!row[code])throw new RangeError('Unknown answer');
    return {...row[code]};
  }
  const api={forAnswer,expressions:['neutral','warm','thoughtful','surprised']};root.HuataReactions=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);
