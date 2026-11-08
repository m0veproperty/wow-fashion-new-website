import test from 'node:test';import assert from 'node:assert/strict';import {readFile,access} from 'node:fs/promises';
const config=JSON.parse(await readFile('data/outerwear.json','utf8'));
test('all 19 outerwear routes render real category products, static headers and valid local assets',async()=>{
 const products=JSON.parse(await readFile('data/outerwear-products.json','utf8')).filter(p=>!p.url.includes('__trashed'));
 for(const c of [{...config.parent,slug:''},...config.collections]){
  const html=await readFile('dist/coats-and-jackets/'+(c.slug?c.slug+'/':'')+'index.html','utf8');
  assert.ok(html.includes('<title>'+c.name.replaceAll('&','&amp;')+' |'));
  assert.ok(html.includes('class="product-card"'));assert.ok(html.includes('Filter preview'));
  assert.ok(!/<video|undefined|__trashed|Discover the coats-and-jackets|buy the coats-and-jackets/.test(html));
  assert.ok(html.includes('href="/shop/"'),'The department links to the complete built catalogue');
  assert.ok(products.some(product=>html.includes('href="'+product.url+'"')),'Real product listings remain available');
  for(const m of html.matchAll(/(?:src|href)="(\/[^"#?]*)"/g))await access('dist'+m[1]+(m[1].endsWith('/')?'index.html':''));
  if(c.slug){const ps=products.filter(p=>p.categories.includes(c.match));assert.ok(ps.length>0,c.slug);assert.ok(ps.some(p=>p.id===c.hero),c.slug+' hero belongs to category');}
 }
});
test('every outerwear inventory record is marked built and linked to its matching live route',async()=>{
 const taxonomy=JSON.parse(await readFile('portal/public/data/taxonomy.json','utf8'));
 const release=JSON.parse(await readFile('portal/public/data/build-status.json','utf8'));
 for(const row of taxonomy.rows.filter(r=>['Coats and Jackets','Coats & Jackets'].includes(r.rootName))){
  const entry=release.pages[row.id];assert.equal(entry?.pageBuilt,'Yes');assert.equal(entry.animatedHeader,'No');
  assert.ok(new URL(entry.previewUrl).pathname.startsWith('/coats-and-jackets/'));
  await access('dist'+new URL(entry.previewUrl).pathname+'index.html');
 }
});

