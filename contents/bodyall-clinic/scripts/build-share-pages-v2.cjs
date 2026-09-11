'use strict';
// Versioned recipient pages preserve already-shared v1 URLs and sentence dictionaries.
const fs=require('node:fs'),path=require('node:path');
const D=require('../data-v2.js'),E=require('../engine-v2.js');
let canvas;try{canvas=require('@napi-rs/canvas');}catch(error){canvas=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));}
const ROOT=path.resolve(__dirname,'..');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(async()=>{
 const atlas=await canvas.loadImage(path.join(ROOT,'assets/huata-portraits.webp'));
 const horse=await canvas.loadImage(path.join(ROOT,'assets/huata-horse.webp'));
 const tile=atlas.width/3,records=[];
 if(!Number.isInteger(tile)||atlas.height!==tile*4)throw Error('Unexpected portrait atlas');
 for(const person of [...D.people,D.horse]){
  const r=E.previewResult(person.id),directory=path.join(ROOT,'result','v2',r.id);fs.mkdirSync(directory,{recursive:true});
  const portrait=canvas.createCanvas(512,512),ctx=portrait.getContext('2d');ctx.imageSmoothingEnabled=false;
  if(r.id==='horse')ctx.drawImage(horse,0,0,horse.width,horse.height,0,0,512,512);
  else if(r.portrait){const source=await canvas.loadImage(path.join(ROOT,r.portrait));ctx.drawImage(source,0,0,source.width,source.height,0,0,512,512);}
  else ctx.drawImage(atlas,(r.tile%3)*tile,Math.floor(r.tile/3)*tile,tile,tile,0,0,512,512);
  fs.writeFileSync(path.join(directory,'portrait.jpg'),portrait.toBuffer('image/jpeg',92));
  const url=E.shareURL({id:r.id}),title=E.shareTitle(r),description=r.analysis.join(' ')+' '+(r.kind==='horse'?'너는 사람이었어?':'너는 누구였어?')+' 화타에게 물어봐!',image=new URL('portrait.jpg',url).href;
  const start=new URL(D.url);start.searchParams.set('r',r.id);start.searchParams.set('from','friend');start.searchParams.set('v','huata-v2');
  const html=`<!doctype html>
<html lang="ko"><head>
 <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
 <meta name="theme-color" content="#17372f"><meta name="robots" content="noindex,follow">
 <title>${esc(title)} | 화타의 전생 진찰소</title><meta name="description" content="${esc(description)}">
 <link rel="canonical" href="${esc(url)}">
 <meta property="og:type" content="website"><meta property="og:locale" content="ko_KR"><meta property="og:site_name" content="화타의 전생 진찰소">
 <meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}">
 <meta property="og:image" content="${esc(image)}"><meta property="og:image:width" content="512"><meta property="og:image:height" content="512"><meta property="og:image:alt" content="${esc(r.name+' — '+r.title)}">
 <meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}">
 <link rel="stylesheet" href="../../../shared-result.css?v=huata-v2"><link rel="stylesheet" href="../../../analytics.css?v=huata-stats1">
 <script src="../../../analytics-config.js?v=huata-v2" defer></script><script src="../../../analytics.js?v=huata-v2" defer></script>
 <script src="../../../data-v2.js?v=huata-v2" defer></script><script src="../../../engine-v2.js?v=huata-v2" defer></script><script src="../../../shared-result-v2.js?v=huata-v2" defer></script>
</head><body data-result-id="${esc(r.id)}" data-game-version="huata-v2">
 <main class="shared-result"><header class="shared-header">화타의 전생 진찰소</header>
 <section class="shared-main" aria-label="친구가 공유한 전생 결과">
  <p class="shared-eyebrow">친구의 전생은</p><img class="shared-portrait" src="portrait.jpg" alt="${esc(r.name)}의 정면 초상화" width="512" height="512" fetchpriority="high">
  <h1>${esc(r.name)}</h1><p class="shared-alias">${esc(r.title)}</p><p id="shared-limited" class="shared-meta" hidden>적은 단서로 비친 전생</p>
  <div class="shared-analysis" id="shared-analysis">${r.analysis.map(t=>'<p>'+esc(t)+'</p>').join('')}</div>
  <p class="shared-quote">화타 “${esc(r.quote)}”</p><p class="shared-hook">${r.kind==='horse'?'너는 사람이었어?':'너는 누구였어?'}</p>
  <a class="shared-start" href="${esc(start.href)}">내 전생 알아보기 →</a><p class="shared-meta">질문 10개 · 약 1분 · 가입 없이</p>
 </section>
 <footer class="shared-footer"><a class="shared-clinic" href="${esc(D.clinicURL)}" target="_blank" rel="noopener"><img src="../../../assets/huata-symbol.webp" alt=""><span>© Bodyall</span></a><p>삼국지연의를 바탕으로 만든 재미용 테스트입니다.</p>
 <div class="analytics-choice" id="analytics-choice" hidden><p id="analytics-status"></p><button id="analytics-allow" type="button">통계 참여</button><button id="analytics-deny" type="button">건너뛰기</button><a href="../../../privacy.html" target="_blank" rel="noopener">수집 안내</a></div></footer>
 </main></body></html>\n`;
  fs.writeFileSync(path.join(directory,'index.html'),html);
  records.push({id:r.id,name:r.name,family:r.family,url,image,title,description,portraitSource:r.portrait||(r.id==='horse'?'assets/huata-horse.webp':`assets/huata-portraits.webp#tile=${r.tile}`)});
 }
 fs.writeFileSync(path.join(ROOT,'SHARING-v2.json'),JSON.stringify({version:'huata-v2',personalAnalysis:'At most two allowlisted public sentence IDs in the fragment, with optional limited-evidence flag; no raw answer sequence.',kakao:'OS share sheet or copy/paste; no direct Kakao SDK transmission is configured. Static OG preview has character and canonical analysis; recipient screen and copied text preserve personalized analysis.',legacy:'result/<id>/ and data.js / engine.js are preserved.',records},null,2)+'\n');
 console.log('Built '+records.length+' v2 result pages; legacy pages were not rewritten.');
})().catch(e=>{console.error(e);process.exitCode=1;});
