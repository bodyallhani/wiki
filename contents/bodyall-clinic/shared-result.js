/* The result is already readable in HTML; only approved personality sentences are personalized here. */
(function(){
  'use strict';
  function render(){
    try{
      const result=window.HuataEngine.sharedResult(document.body.dataset.resultId,location.hash);
      const analysis=document.getElementById('shared-analysis');
      const lines=result.analysis.map(text=>{const p=document.createElement('p');p.textContent=text;return p;});
      analysis.replaceChildren(...lines);
    }catch(ignore){}
  }
  render();window.addEventListener('hashchange',render);
  document.querySelector?.('.shared-start')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('bodyall:game-event',{detail:{name:'shared_result_start'}})));
})();
