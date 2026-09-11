(function(root){
  'use strict';
  const story=typeof module!=='undefined'&&module.exports?require('./story.js'):root.ClinicStory;
  const observations=['O1','O2','O3','O4','O5'];
  const questions=['Q1','Q2','Q3'];
  class ClinicGame{
    constructor(){this.previous=null;this.reset();}
    reset(){this.phase='start';this.observation=null;this.question=null;this.selected=null;this.exchange=null;this.isReplay=false;}
    start(replay=false){
      if(this.phase!=='start'&&this.phase!=='ending')return false;
      if(this.phase==='ending')this.previous={observation:this.observation,question:this.question,selected:this.selected};
      this.reset();this.isReplay=replay;this.phase='observe';
      this.exchange={player:null,patient:replay?story.replayOpening:story.opening};
      return true;
    }
    available(){
      if(this.phase==='observe')return observations.slice();
      if(this.phase==='question')return questions.slice();
      if(this.phase==='connect')return [this.observation,this.question];
      return [];
    }
    choiceText(id){
      if(!this.available().includes(id))return null;
      return this.phase==='connect'?story.items[id].followupPrompt:story.items[id].prompt;
    }
    choose(id){
      if(!this.available().includes(id))return false;
      const item=story.items[id];
      this.exchange={player:this.choiceText(id),patient:this.phase==='connect'?item.lastLine:item.reply};
      if(this.phase==='observe'){this.observation=id;this.phase='question';}
      else if(this.phase==='question'){this.question=id;this.phase='connect';}
      else{this.selected=id;this.phase='ending';}
      return true;
    }
    result(){if(this.phase!=='ending'||!this.selected)return null;const item=story.items[this.selected];return {...item,...story.endings[item.ending]};}
    step(){return this.phase==='start'?0:this.phase==='observe'?1:this.phase==='question'?2:3;}
  }
  const api={ClinicGame,observations,questions};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ClinicEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
