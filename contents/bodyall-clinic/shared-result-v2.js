/* Decode public v2 sentence IDs only. Legacy recipient pages keep shared-result.js and engine.js. */
(function(){
  'use strict';
  function render(){
    try{
      const result=window.HuataEngineV2.sharedResult(document.body.dataset.resultId,location.hash);
      const analysis=document.getElementById('shared-analysis');
      analysis.replaceChildren(...result.analysis.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));
      const note=document.getElementById('shared-limited');if(note)note.hidden=!result.faint;
    }catch(ignore){}
  }
  render();window.addEventListener('hashchange',render);
  document.querySelector('.shared-start')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('bodyall:game-event',{detail:{name:'shared_result_start',version:'huata-v2'}})));
})();
