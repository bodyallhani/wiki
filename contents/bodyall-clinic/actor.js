/* Portrait performance; timers pause while the scene cannot be seen. */
(function(root){
  'use strict';
  const columns={neutral:0,warm:1,thoughtful:2,surprised:3};
  function create({face,gesture,canAnimate,reduced,clock={setTimeout:(fn,delay)=>setTimeout(fn,delay),clearTimeout:id=>clearTimeout(id)},random=Math.random}){
    let running=false,expression='neutral',blinkTimer=0,openTimer=0,restTimer=0,poseTimer=0;
    function paint(closed=false){face.style.backgroundPosition=(columns[expression]*100/3)+'% '+(closed?100:0)+'%';}
    function clear(name){clock.clearTimeout(name);}
    function stop(){running=false;[blinkTimer,openTimer,restTimer,poseTimer].forEach(clear);expression='neutral';paint();gesture.dataset.motion='rest';}
    function nextBlink(delay){
      clear(blinkTimer);if(!running||reduced())return;
      blinkTimer=clock.setTimeout(()=>{
        if(!running||!canAnimate())return;
        paint(true);
        openTimer=clock.setTimeout(()=>{if(!running)return;paint();nextBlink(2800+random()*2300);},145);
      },delay);
    }
    function start(){if(running)return;running=true;paint();nextBlink(1100+random()*900);}
    function react(next='neutral',motion='nod'){
      clear(restTimer);clear(poseTimer);clear(openTimer);clear(blinkTimer);
      expression=Object.hasOwn(columns,next)?next:'neutral';paint();
      gesture.dataset.motion='rest';
      // Commit the resting pose so repeated nods restart independently of the breathing loop.
      if(running&&!reduced()&&canAnimate()){
        void gesture.offsetWidth;gesture.dataset.motion=motion;
        poseTimer=clock.setTimeout(()=>{gesture.dataset.motion='rest';},1050);
      }
      restTimer=clock.setTimeout(()=>{expression='neutral';paint();},2450);
      nextBlink(530+random()*260);
    }
    function reset(){stop();expression='neutral';paint();}
    return {start,stop,react,reset};
  }
  const api={create};root.HuataActor=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);
