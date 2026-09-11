(function(root){
  'use strict';
  const story = typeof module !== 'undefined' && module.exports ? require('./story.js') : root.ClinicStory;
  const observations = ['O1','O2','O3','O4','O5'];
  const questions = ['Q1','Q2','Q3'];
  class ClinicGame {
    constructor(){ this.previous = null; this.reset(); }
    reset(){ this.phase='start'; this.observation=null; this.question=null; this.selected=null; this.lines=[]; this.lineIndex=0; this.nextPhase=null; this.context=null; }
    talk(lines,nextPhase,context=null){ this.phase='dialogue'; this.lines=lines; this.lineIndex=0; this.nextPhase=nextPhase; this.context=context; }
    start(replay=false){
      if(this.phase!=='start' && this.phase!=='ending') return false;
      if(this.phase==='ending') this.previous={observation:this.observation,question:this.question,selected:this.selected};
      this.reset(); this.talk(replay ? story.replay : story.intro,'observe','intro'); return true;
    }
    next(){
      if(this.phase!=='dialogue') return false;
      if(this.lineIndex<this.lines.length-1) this.lineIndex++;
      else { this.phase=this.nextPhase; this.context=null; }
      return true;
    }
    available(){
      if(this.phase==='observe') return observations.slice();
      if(this.phase==='question') return questions.slice();
      if(this.phase==='connect') return [this.observation,this.question];
      return [];
    }
    choose(id){
      if(!this.available().includes(id)) return false;
      const item=story.items[id];
      if(this.phase==='observe'){ this.observation=id; this.talk(item.lines,'question',id); }
      else if(this.phase==='question'){ this.question=id; this.talk(item.lines,'connect',id); }
      else if(this.phase==='connect'){ this.selected=id; this.talk(item.followup,'discovery','U'+id); }
      return true;
    }
    explain(){
      if(this.phase!=='discovery') return false;
      this.talk([...story.common,['최대리',story.items[this.selected].lastLine]],'ending','common');
      return true;
    }
    result(){
      if(!this.selected) return null;
      const item=story.items[this.selected];
      return {...item,...story.endings[item.ending]};
    }
    step(){
      if(this.selected) return 3;
      if(this.question) return 3;
      if(this.observation) return 2;
      return 1;
    }
  }
  const api={ClinicGame,observations,questions};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.ClinicEngine=api;
})(typeof globalThis!=='undefined' ? globalThis : this);
