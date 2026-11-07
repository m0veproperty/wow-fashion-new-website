import test from 'node:test';import assert from 'node:assert/strict';import {readFile,access} from 'node:fs/promises';
const config=JSON.parse(await readFile('data/pants.json','utf8'));
test('all 30 pants routes have static headers, valid assets and clearly labelled corduroy alternatives',async()=>{
 const ps=JSON.parse(await readFile('data/pants-products.json','utf8')).filter(p=>!p.url.includes('__trashed'));
 for(const c of [{...config.parent,slug:''},...config.collections]){
  const html=await readFile('dist/pants/'+(c.slug?c.slug+'/':'')+'index.html','utf8');
  assert.ok(html.includes('<title>'+c.name.replaceAll('&','&amp;')+' |'));assert.ok(!/<video|undefined|__trashed|RELATED COTTON BLOUSES/.test(html));assert.ok(html.includes('class="product-card"'));
  if(c.slug==='corduroy-pants'){assert.ok(html.includes('OTHER TROUSER STYLES'));assert.ok(html.includes('not corduroy'));}
  else if(c.slug){const selected=c.ids?ps.filter(p=>c.ids.includes(p.id)):ps.filter(p=>p.categories.includes(c.match));assert.ok(selected.some(p=>p.id===c.hero),c.slug);}
  for(const m of html.matchAll(/(?:src|href)="(\/[^"#?]*)"/g))await access('dist'+m[1]+(m[1].endsWith('/')?'index.html':''));
 }
});
test('every pants inventory record has a matching live route and static-header status',async()=>{
 const t=JSON.parse(await readFile('portal/public/data/taxonomy.json','utf8')),release=JSON.parse(await readFile('portal/public/data/build-status.json','utf8'));
 for(const r of t.rows.filter(r=>r.rootName==='Pants and Leggings')){const p=release.pages[r.id];assert.equal(p?.pageBuilt,'Yes');assert.equal(p.animatedHeader,'No');await access('dist'+new URL(p.previewUrl).pathname+'index.html');}
});

