import test from 'node:test';import assert from 'node:assert/strict';import {readFile,access} from 'node:fs/promises';
for(const key of ['skirts','sweaters']){
 const config=JSON.parse(await readFile('data/'+key+'.json','utf8'));
 test(key+' routes contain static headers, matching products and valid local assets',async()=>{
  const ps=JSON.parse(await readFile('data/'+key+'-products.json','utf8')).filter(p=>!p.url.includes('__trashed'));
  assert.equal(config.collections.length,key==='skirts'?16:14);
  for(const c of [{...config.parent,slug:''},...config.collections]){
   const html=await readFile('dist/'+key+'/'+(c.slug?c.slug+'/':'')+'index.html','utf8');
   assert.ok(html.includes('<title>'+c.name.replaceAll('&','&amp;')+' |'));assert.ok(!/<video|undefined|__trashed|RELATED COTTON BLOUSES/.test(html));assert.ok(html.includes('class="product-card"'));
   if(c.slug){const selected=c.ids?ps.filter(p=>c.ids.includes(p.id)):ps.filter(p=>p.categories.includes(c.match));assert.ok(selected.some(p=>p.id===c.hero),c.slug);}
   for(const m of html.matchAll(/(?:src|href)="(\/[^"#?]*)"/g))await access('dist'+m[1]+(m[1].endsWith('/')?'index.html':''));
  }
 });
 test(key+' portal records all point to built pages with static headers',async()=>{
  const t=JSON.parse(await readFile('portal/public/data/taxonomy.json','utf8')),release=JSON.parse(await readFile('portal/public/data/build-status.json','utf8'));
  for(const r of t.rows.filter(r=>r.rootName.toLowerCase()===key)){const p=release.pages[r.id];assert.equal(p?.pageBuilt,'Yes');assert.equal(p.animatedHeader,'No');await access('dist'+new URL(p.previewUrl).pathname+'index.html');}
 });
}
