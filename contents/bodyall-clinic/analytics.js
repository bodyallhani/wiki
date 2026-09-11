(function(root){
  'use strict';
  const LEGACY_IDS=['zhuge','cao','liu','guan','zhang','zhao','sun','zhou','sima','huang','lu','diao','horse'];
  const IDS=[...LEGACY_IDS,'meng','dong','yuan','liushan','jiao','li','xing','mi','zuo','xu'];
  const FUN=['meng','dong','yuan','liushan','jiao','li','xing','mi','zuo','xu'];
  const SOURCES=['kakao','instagram','naver_cafe','naver_blog','community','youtube','offline','bodyall'];
  const CONSENT_KEY='huata.stats.consent.v1';
  function context(href,referrer,config){
    const u=new URL(href),base=config.basePath;
    if(u.protocol!=='https:'||u.hostname!==config.allowedHost)return null;
    const relative=u.pathname.slice(base.length),match=relative.match(/^result\/(v2\/)?([a-z]+)\/(?:index.html)?$/);
    if(!u.pathname.startsWith(base)||(!['','index.html'].includes(relative)&&!match))return null;
    if(match&&!(match[1]?IDS:LEGACY_IDS).includes(match[2]))return null;
    let ref='';try{const r=new URL(referrer);if(r.protocol==='https:'||r.protocol==='http:')ref=r.origin+'/';}catch(ignore){}
    const tagged=u.searchParams.get('src'),campaign=SOURCES.includes(tagged)?tagged:'';
    // Strip all arbitrary query strings, answer fragments, and referrer paths.
    return {location:u.origin+base+(match?'result/'+(match[1]||'')+match[2]+'/':''),referrer:ref,
      page:match?'shared':'game',result:match?match[2]:null,version:match?(match[1]?'huata-v2':'huata-1'):config.version,
      invited:!match&&u.searchParams.get('from')==='friend'&&IDS.includes(u.searchParams.get('r')),
      campaign};
  }
  function create({config,href,referrer='',storage,send,now=()=>Date.now()}){
    let page;try{page=context(href,referrer,config);}catch(ignore){}
    const configured=!!(config.enabled&&/^G-[A-Z0-9]{6,15}$/.test(config.measurementId)&&page);
    let consent='unknown';try{const saved=JSON.parse(storage?.getItem(CONSENT_KEY)||'null');if(saved&&saved.expires>now()&&['granted','denied'].includes(saved.value))consent=saved.value;}catch(ignore){}
    let buffer=[],ready=false,run=null;const pageSeen=new Set();
    function emit(name,extra={}){
      if(!configured||consent==='denied')return;
      const version=run?.version||page.version;
      const item={name:version==='huata-v2'?name.replace(/^huata_/,'huata_v2_'):name,params:{content_group:'huata',game_version:version,page_kind:page.page,
        page_location:page.location,page_referrer:page.referrer,page_title:'화타의 전생 진찰소',...extra}};
      if(page.campaign)item.params.campaign_source=page.campaign;
      if(consent==='granted'&&ready){try{send(item);}catch(ignore){}}
      else if(buffer.length<160)buffer.push(item);
    }
    function once(name,extra,seen=pageSeen){if(seen.has(name))return;seen.add(name);emit(name,extra);}
    function capture(detail){
      if(!configured||consent==='denied'||!detail||typeof detail!=='object')return;
      // This switch is the allowlist. Never forward arbitrary event fields or answer values.
      if(detail.name==='game_start'){
        run={seen:new Set(),complete:false,result:null,version:['huata-1','huata-v2'].includes(detail.version)?detail.version:page.version};emit('huata_start');
        if(page.invited)emit('huata_friend_start');return;
      }
      if(detail.name==='question_view'){
        const q=detail.question;if(run&&!run.complete&&Number.isInteger(q)&&q>=1&&q<=10&&!detail.repair)
          once('huata_step_'+String(q).padStart(2,'0'),undefined,run.seen);return;
      }
      if(detail.name==='game_complete'){
        if(!run||run.complete)return;
        if(detail.result==='fog'){once('huata_fog',undefined,run.seen);return;}
        if(!IDS.includes(detail.result))return;
        run.complete=true;run.result=detail.result;emit('huata_complete',{result_id:run.result,result_family:run.result==='horse'?'special':FUN.includes(run.result)?'fun':'cool'});
        emit('huata_result_'+run.result);return;
      }
      if(detail.name==='shared_result_start'){
        if(page.page==='shared')once('huata_shared_start_click',{result_id:page.result});return;
      }
      if(detail.name==='clinic_link_click'){once('huata_creator_click');return;}
      if(!run||!run.complete)return;
      const actions={share_preview_open:'huata_share_open',share_attempt:'huata_share_attempt',
        share_api_resolved:'huata_share_returned',share_link_copied:'huata_copy',result_card_export:'huata_save'};
      const name=actions[detail.name];if(!name)return;
      once(name,{result_id:run.result},run.seen);
      if(['share_attempt','share_link_copied'].includes(detail.name)){
        once('huata_share_intent',{result_id:run.result},run.seen);
        once('huata_result_share_'+run.result,undefined,run.seen);
      }
    }
    function choose(value,persist=true){
      if(!['granted','denied'].includes(value))return;
      const previous=consent;consent=value;if(persist)try{storage?.setItem(CONSENT_KEY,JSON.stringify({value,expires:now()+180*86400000}));}catch(ignore){}
      if(value==='denied'){buffer=[];ready=false;run=null;}
      else if(previous==='denied'){pageSeen.clear();visit();}
    }
    function activate(){
      if(!configured||consent!=='granted')return;ready=true;
      const pending=buffer;buffer=[];for(const item of pending){try{send(item);}catch(ignore){}}
    }
    function visit(){once(page?.page==='shared'?'huata_shared_view':'huata_visit',page?.result?{result_id:page.result}:undefined);}
    return {configured,page,capture,choose,activate,visit,status:()=>({consent,ready,pending:buffer.length})};
  }
  function mount(w){
    const config=w.HuataAnalyticsConfig;if(!config)return;
    const doc=w.document;let storage;try{storage=w.localStorage;}catch(ignore){}
    const tracker=create({config,href:w.location.href,referrer:doc.referrer,storage,
      send:item=>w.gtag('event',item.name,{...item.params,send_to:config.measurementId})});
    if(!tracker.configured)return;
    const panel=doc.getElementById('analytics-choice');if(!panel)return;
    const label=doc.getElementById('analytics-status'),allow=doc.getElementById('analytics-allow'),deny=doc.getElementById('analytics-deny');
    let loaded=false,loading=false,failed=false;
    function command(){w.dataLayer.push(arguments);}
    function render(){
      const choice=tracker.status().consent;panel.hidden=false;
      label.textContent=failed?'통계 연결을 사용할 수 없어요. 게임은 계속 즐길 수 있어요.':
        choice==='granted'?'이용통계에 참여 중입니다.':choice==='denied'?'이용통계에 참여하지 않습니다.':'이용통계에 참여하시겠어요? 답변 내용은 보내지 않아요.';
      allow.hidden=choice==='granted';deny.textContent=choice==='granted'?'참여 끄기':'건너뛰기';deny.hidden=choice==='denied';
    }
    function startTag(){
      if(tracker.status().consent!=='granted')return;
      w['ga-disable-'+config.measurementId]=false;
      if(loaded){command('consent','update',{analytics_storage:'granted'});tracker.activate();return;}
      if(loading||failed)return;loading=true;
      w.dataLayer=w.dataLayer||[];w.gtag=w.gtag||command;
      command('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});
      command('set','ads_data_redaction',true);
      command('set',{allow_google_signals:false,allow_ad_personalization_signals:false,
        page_location:tracker.page.location,page_referrer:tracker.page.referrer});
      command('consent','update',{analytics_storage:'granted'});
      command('js',new Date());
      const fields={send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,
        cookie_domain:'none',cookie_path:config.basePath,cookie_prefix:'huata',cookie_expires:30*86400,cookie_update:false,
        content_group:'huata',page_location:tracker.page.location,page_referrer:tracker.page.referrer,page_title:'화타의 전생 진찰소'};
      if(tracker.page.campaign){fields.campaign_source=tracker.page.campaign;fields.campaign_medium='referral';fields.campaign_name='huata';}
      command('config',config.measurementId,fields);
      const script=doc.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+config.measurementId;
      script.referrerPolicy='origin';
      script.onload=()=>{loaded=true;loading=false;tracker.activate();};
      script.onerror=()=>{loading=false;failed=true;render();};doc.head.append(script);
    }
    function choose(value,persist=true){
      tracker.choose(value,persist);
      if(value==='granted')startTag();
      else{
        w['ga-disable-'+config.measurementId]=true;
        if(w.gtag)command('consent','update',{analytics_storage:'denied'});
        for(const cookie of doc.cookie.split(';')){const name=cookie.trim().split('=')[0];
          if(/^huata_ga(?:_[A-Z0-9]+)?$/.test(name))doc.cookie=name+'=; Max-Age=0; Path='+config.basePath+'; SameSite=Lax; Secure';}
      }render();
    }
    allow.addEventListener('click',()=>choose('granted'));deny.addEventListener('click',()=>choose('denied'));
    w.addEventListener('bodyall:game-event',e=>{try{tracker.capture(e.detail);}catch(ignore){}});
    w.addEventListener('storage',e=>{if(e.key!==CONSENT_KEY)return;try{const saved=JSON.parse(e.newValue);choose(saved?.value==='granted'&&saved.expires>Date.now()?'granted':'denied',false);}catch(ignore){choose('denied',false);}});
    tracker.visit();render();startTag();
  }
  const api={create,context,mount,IDS,SOURCES};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root.document){try{mount(root);}catch(ignore){/* Analytics must never block the game. */}}
})(typeof globalThis!=='undefined'?globalThis:window);
