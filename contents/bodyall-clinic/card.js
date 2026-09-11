(function(root){
  'use strict';
  function fitText(ctx,text,maxWidth,initial,min=24,weight=700,family='sans-serif'){
    let size=initial;while(size>min){ctx.font=weight+' '+size+'px '+family;if(ctx.measureText(text).width<=maxWidth)break;size--;}
    return size;
  }
  function lines(ctx,text,width){
    const out=[];let line='';for(const ch of text){if(ctx.measureText(line+ch).width>width&&line){out.push(line);line=ch;}else line+=ch;}if(line)out.push(line);return out;
  }
  function draw(ctx,snapshot,images){
    const {atlas,horse,logo,portrait}=images;
    const sans='"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif',serif='"Batang",serif';
    ctx.fillStyle='#17372f';ctx.fillRect(0,0,1080,1350);
    ctx.strokeStyle='#c3a267';ctx.lineWidth=3;ctx.strokeRect(28,28,1024,1294);ctx.strokeStyle='#526448';ctx.lineWidth=1;ctx.strokeRect(38,38,1004,1274);
    ctx.fillStyle='#dfcb9b';ctx.textAlign='center';ctx.font='500 28px '+sans;ctx.fillText('화타의 전생 진찰소',540,99);
    ctx.strokeStyle='#8f855c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(200,123);ctx.lineTo(880,123);ctx.stroke();
    ctx.fillStyle='#c7aa70';ctx.font='500 24px '+sans;ctx.fillText(snapshot.kind==='horse'?'화타도 이름을 못 알아낸 전생':snapshot.faint?'적은 단서로 비친 전생':'거울에 비친 나의 전생',540,167);
    ctx.save();ctx.translate(540,454);ctx.fillStyle='#b99557';ctx.beginPath();ctx.ellipse(0,0,236,270,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f1d398';ctx.lineWidth=5;ctx.stroke();ctx.fillStyle='#273f34';ctx.beginPath();ctx.ellipse(0,0,222,255,0,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.save();ctx.beginPath();ctx.ellipse(540,454,211,244,0,0,Math.PI*2);ctx.clip();ctx.fillStyle='#063c43';ctx.fillRect(310,200,460,510);ctx.imageSmoothingEnabled=false;
    if(snapshot.id==='horse')ctx.drawImage(horse,0,0,horse.width,horse.height,295,209,490,490);
    else if(portrait)ctx.drawImage(portrait,0,0,portrait.width,portrait.height,295,209,490,490);
    else{const tile=atlas.width/3;ctx.drawImage(atlas,(snapshot.tile%3)*tile,Math.floor(snapshot.tile/3)*tile,tile,tile,295,209,490,490);}
    ctx.restore();ctx.imageSmoothingEnabled=true;
    ctx.fillStyle='#2c4937';ctx.fillRect(60,771,960,355);ctx.strokeStyle='#60734f';ctx.lineWidth=1;ctx.strokeRect(60,771,960,355);
    ctx.fillStyle='#f5e5bc';fitText(ctx,snapshot.name,870,72,40,700,serif);ctx.fillText(snapshot.name,540,848);
    ctx.fillStyle='#d8d5b7';fitText(ctx,snapshot.title,840,32,25,500,sans);ctx.fillText(snapshot.title,540,906);
    ctx.strokeStyle='#6a7c56';ctx.beginPath();ctx.moveTo(160,939);ctx.lineTo(920,939);ctx.stroke();
    ctx.fillStyle='#f0ead6';let y=991;
    const analysisLines=snapshot.analysis.flatMap(text=>{fitText(ctx,text,840,33,26,500,sans);return lines(ctx,text,840);});
    ctx.font='500 31px '+sans;analysisLines.slice(0,4).forEach(text=>{ctx.fillText(text,540,y);y+=45;});
    ctx.fillStyle='#d5c89e';ctx.font='500 26px '+sans;ctx.fillText(snapshot.kind==='horse'?'너는 사람이었어?':'너는 누구였어?',540,1190);
    const credit='© Bodyall',logoW=34,logoH=logoW*logo.height/logo.width,gap=12,centerY=1254;
    ctx.fillStyle='#d5c89e';ctx.font='400 28px '+sans;ctx.textAlign='left';
    const metrics=ctx.measureText(credit),textW=metrics.width,groupX=(1080-logoW-gap-textW)/2;
    const ascent=metrics.actualBoundingBoxAscent??25,descent=metrics.actualBoundingBoxDescent??6;
    ctx.drawImage(logo,groupX,centerY-logoH/2,logoW,logoH);
    ctx.fillText(credit,groupX+logoW+gap,centerY+(ascent-descent)/2);
    ctx.textAlign='center';
  }
  const api={draw};root.HuataCard=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);
