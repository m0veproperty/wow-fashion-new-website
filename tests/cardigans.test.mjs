import test from 'node:test';import assert from 'node:assert/strict';import {readFile,access} from 'node:fs/promises';
const config=JSON.parse(await readFile('data/cardigans.json','utf8'));
const release=JSON.parse(await readFile('portal/public/data/build-status.json','utf8'));
const taxonomy=JSON.parse(await readFile('portal/public/data/taxonomy.json','utf8'));
test('all 16 cardigan routes have valid local links, static heroes and distinct populated product edits',async()=>{
 for(const c of [{slug:'',name:'Cardigans'},...config.collections]){
  const route='/cardigans/'+(c.slug?c.slug+'/':'');const html=await readFile('dist'+route+'index.html','utf8');
  assert.ok(html.includes('<title>'+c.name+' |'));assert.ok(!html.includes('<video'));assert.ok(!html.includes('__trashed'));
  assert.ok(html.includes('class="product-card"'));assert.ok(html.includes('Filter preview'));
  assert.ok(!/undefined|THE BLOUSE|buy the blouses|kind of blouse/.test(html));
  for(const m of html.matchAll(/(?:src|href)="(\/[^"#?]*)"/g)){
   await access('dist'+m[1]+(m[1].endsWith('/')?'index.html':''));
  }
 }
});
test('all cardigan inventory records link to released routes; all prior release links still resolve',async()=>{
 for(const row of taxonomy.rows.filter(r=>r.rootName==='Cardigans')){
  assert.equal(release.pages[row.id]?.pageBuilt,'Yes');assert.equal(release.pages[row.id]?.animatedHeader,'No');
 }
 for(const entry of Object.values(release.pages)){
  assert.equal(new URL(entry.previewUrl).origin,release.siteUrl);
  await access('dist'+new URL(entry.previewUrl).pathname+'index.html');
 }
});
test('cardigan product edits do not silently borrow unrelated products',async()=>{
 const products=JSON.parse(await readFile('data/cardigan-products.json','utf8')).filter(p=>!p.url.includes('__trashed'));
 for(const c of config.collections){
  const selected=c.ids?products.filter(p=>c.ids.includes(p.id)):products.filter(p=>p.categories.includes(c.match));
  assert.ok(selected.length>0,c.slug);assert.ok(selected.some(p=>p.id===c.hero),c.slug+' hero belongs to collection');
 }
});

