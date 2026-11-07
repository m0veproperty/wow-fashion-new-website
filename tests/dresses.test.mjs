import test from 'node:test';import assert from 'node:assert/strict';import {readFile,access} from 'node:fs/promises';
const config=JSON.parse(await readFile('data/dresses.json','utf8'));
test('dress collection preserves two films and publishes all other subcategories with static headers',async()=>{
 const parent=await readFile('dist/dresses/index.html','utf8');const club=await readFile('dist/dresses/club-dresses/index.html','utf8');assert.ok(parent.includes('<video'));assert.ok(club.includes('<video'));assert.ok(parent.includes('/dresses/assets/hero.mp4'));assert.ok(club.includes('/dresses/club-dresses/assets/hero.mp4'));
 for(const c of config.collections){
  const html=await readFile('dist/dresses/'+c.slug+'/index.html','utf8');assert.ok(parent.includes('/dresses/'+c.slug+'/'),c.slug+' reachable from parent');
  if(!c.preserved){assert.ok(!html.includes('<video'));assert.ok(html.includes('<title>'+c.name.replaceAll('&','&amp;')+' |'));assert.ok(html.includes('class="product-card"'));assert.ok(!/__trashed|undefined/.test(html));}
  for(const m of html.matchAll(/(?:src|href|poster)="(\/[^"#?]*)"/g))await access('dist'+m[1]+(m[1].endsWith('/')?'index.html':''));
 }
});
test('every dress inventory record has a live link and correct animation status',async()=>{
 const t=JSON.parse(await readFile('portal/public/data/taxonomy.json','utf8')),release=JSON.parse(await readFile('portal/public/data/build-status.json','utf8'));
 for(const r of t.rows.filter(r=>r.rootName==='Dresses')){const p=release.pages[r.id];assert.equal(p.pageBuilt,'Yes');assert.equal(p.animatedHeader,r.isTopLevel||r.name==='Club Dresses'?'Yes':'No');await access('dist'+new URL(p.previewUrl).pathname+'index.html');}
});

