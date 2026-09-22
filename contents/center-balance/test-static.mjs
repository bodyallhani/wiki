import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const html=await readFile(resolve(root,'index.html'),'utf8');
const app=await readFile(resolve(root,'app.mjs'),'utf8');
const ids=new Set(Array.from(html.matchAll(/\bid="([^"]+)"/g),match=>match[1]));
for(const match of app.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(match[1]),`missing DOM id: ${match[1]}`);
for(const match of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g))await access(resolve(root,match[1]));
assert.match(app,/three@0\.186\.0\/build\/three\.module\.js/);
assert.match(app,/cannon-es@0\.20\.0\/dist\/cannon-es\.js/);
assert.doesNotMatch(html,/id="control-pad"|id="control-knob"/);
assert.match(html,/id="touch-origin"/);
const parent=await readFile(resolve(root,'..','index.html'),'utf8');
assert.match(parent,/href="center-balance\/"/);assert.match(parent,/center-balance\/assets\/mascot\.svg/);
assert.doesNotMatch(html,/진료비\s*할인|치료\s*쿠폰|척추\s*나이|교정\s*필요\s*점수/);
console.log('center-balance static checks passed');
