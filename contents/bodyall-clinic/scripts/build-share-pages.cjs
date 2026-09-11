'use strict';
// Export the existing character portraits and static result metadata for link-preview crawlers.
// No new artwork, user submissions, credentials, or external service are involved.
const fs=require('node:fs'),path=require('node:path');
const D=require('../data.js'),E=require('../engine.js');
let canvas;
try{canvas=require('@napi-rs/canvas');}
catch(error){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;canvas=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));}
const ROOT=path.resolve(__dirname,'..'),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(async()=>{
 const atlas=await canvas.loadImage(path.join(ROOT,'assets/huata-portraits.webp'));
 const horse=await canvas.loadImage(path.join(ROOT,'assets/huata-horse.webp'));
 const tile=atlas.width/3; if(!Number.isInteger(tile)||atlas.height!==tile*4)throw new Error('Unexpected portrait atlas');
 const records=[];
 for(const person of [...D.people,D.horse]){
  const r=E.previewResult(person.id),directory=path.join(ROOT,'result',r.id);fs.mkdirSync(directory,{recursive:true});
  const portrait=canvas.createCanvas(tile,tile),ctx=portrait.getContext('2d');ctx.imageSmoothingEnabled=false;
  if(r.id==='horse')ctx.drawImage(horse,0,0,horse.width,horse.height,0,0,tile,tile);
  else ctx.drawImage(atlas,(r.tile%3)*tile,Math.floor(r.tile/3)*tile,tile,tile,0,0,tile,tile);
  fs.writeFileSync(path.join(directory,'portrait.jpg'),portrait.toBuffer('image/jpeg',92));
  const url=E.shareURL({id:r.id}),title=E.shareTitle(r),description=r.title+' · '+r.analysis.join(' '),image=new URL('portrait.jpg',url).href;
  const start=new URL(D.url);start.searchParams.set('r',r.id);start.searchParams.set('from','friend');start.searchParams.set('v','result-share2');
  const html=`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#17372f">
  <meta name="robots" content="noindex,follow">
  <title>${esc(title)} | 화타의 전생 진찰소</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:site_name" content="화타의 전생 진찰소 · 바디올한의원">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:width" content="${tile}">
  <meta property="og:image:height" content="${tile}">
  <meta property="og:image:alt" content="${esc(r.name+' — '+r.title)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(image)}">
  <link rel="stylesheet" href="../../shared-result.css?v=2">
  <script src="../../data.js?v=huata1" defer></script>
  <script src="../../engine.js?v=huata-result-share2" defer></script>
  <script src="../../shared-result.js?v=2" defer></script>
</head>
<body data-result-id="${esc(r.id)}">
  <main class="shared-result">
    <header class="shared-header">화타의 전생 진찰소</header>
    <section class="shared-main" aria-label="친구가 공유한 전생 결과">
      <p class="shared-eyebrow">친구의 전생은</p>
      <img class="shared-portrait" src="portrait.jpg" alt="${esc(r.name)}의 정면 초상화" width="${tile}" height="${tile}" fetchpriority="high">
      <h1>${esc(r.name)}</h1>
      <p class="shared-alias">${esc(r.title)}</p>
      <div class="shared-analysis" id="shared-analysis">${r.analysis.map(t=>'<p>'+esc(t)+'</p>').join('')}</div>
      <p class="shared-hook">너는 누구였어?</p>
      <a class="shared-start" href="${esc(start.href)}">그럼, 내 전생은? →</a>
      <p class="shared-meta">질문 10개 · 약 1분 · 가입 없이</p>
    </section>
    <footer class="shared-footer">
      <a class="shared-clinic" href="${esc(D.clinicURL)}" target="_blank" rel="noopener"><img src="../../assets/huata-symbol.webp" alt=""><span>바디올한의원</span></a>
      <p>삼국지연의를 바탕으로 만든 재미용 테스트입니다.</p>
    </footer>
  </main>
</body>
</html>
`;
  fs.writeFileSync(path.join(directory,'index.html'),html);
  records.push({id:r.id,name:r.name,url,image,title,description,portraitSource:r.id==='horse'?'assets/huata-horse.webp':`assets/huata-portraits.webp#tile=${r.tile}`});
 }
 fs.writeFileSync(path.join(ROOT,'SHARING.json'),JSON.stringify({version:2,mode:'static result-specific Open Graph pages + native text/link share',personalAnalysis:'Up to two public personality sentence IDs in the URL fragment, decoded on the result page. No raw answers or health data.',kakao:'Uses the OS share sheet or copy/paste. Kakao SDK direct-send is not configured.',records},null,2)+'\n');
 console.log('Built '+records.length+' result pages and exported their existing portraits.');
})().catch(error=>{console.error(error);process.exitCode=1;});
