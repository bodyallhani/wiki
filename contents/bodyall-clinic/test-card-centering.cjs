'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
let canvasAPI;try{canvasAPI=require('@napi-rs/canvas');}catch(error){if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;canvasAPI=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));}
const {createCanvas}=canvasAPI;
const card=require('./card.js'),D=require('./data.js'),E=require('./engine.js');
const canvas=createCanvas(1080,1350),ctx=canvas.getContext('2d');
const atlas=createCanvas(1086,1448),horse=createCanvas(1254,1254),logo=createCanvas(1449,1085);
let mark,label;const originalImage=ctx.drawImage.bind(ctx),originalText=ctx.fillText.bind(ctx);
ctx.drawImage=(...args)=>{if(args[0]===logo)mark={x:args[1],y:args[2],w:args[3],h:args[4]};return originalImage(...args);};
ctx.fillText=(text,x,y)=>{if(text==='바디올한의원')label={x,y,width:ctx.measureText(text).width,ascent:ctx.measureText(text).actualBoundingBoxAscent,descent:ctx.measureText(text).actualBoundingBoxDescent};return originalText(text,x,y);};
const person=D.people.find(p=>p.id==='sima'),result=E.getResult(['A','D','E',...person.pattern]);
card.draw(ctx,result,{atlas,horse,logo});
assert(Math.abs((mark.x+label.x+label.width)/2-540)<.01);
assert(Math.abs(mark.y+mark.h/2-(label.y-(label.ascent-label.descent)/2))<.01);
assert.equal(label.x-mark.x-mark.w,18);
console.log(JSON.stringify({groupCenterX:(mark.x+label.x+label.width)/2,logoAndNameVerticallyCentered:true,measuredFontWidth:true},null,2));
