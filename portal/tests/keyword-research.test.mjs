import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL('../public'+p,import.meta.url),'utf8'));
const d=read('/data/keyword-research.json');
const kws=d.meta.keywordFiles.flatMap(read), ps=d.meta.proposalFiles.flatMap(read);
test('research covers every commercial child record with unique measured keywords',()=>{
 const taxonomy=read('/data/taxonomy.json');const expected=taxonomy.rows.filter(x=>!x.isTopLevel&&x.system!=='blog').map(x=>x.id).sort();
 assert.deepEqual(d.groups.flatMap(x=>x.ids).sort(),expected);
 assert.equal(kws.length,d.meta.uniqueKeywords);assert.equal(new Set(kws.map(x=>x[0])).size,kws.length);
 for(const r of kws){assert.ok(r[1]>0);assert.ok(r[2]===null||(r[2]>=0&&r[2]<=100));assert.ok(r[4].every(i=>d.groups[i]));}
});
test('proposal volumes are measured lead-keyword volumes and all variants have evidence',()=>{
 const index=new Map(kws.map(x=>[x[0],x]));assert.equal(ps.length,d.meta.proposalCount);
 for(const p of ps){assert.ok(d.groups[p.group]);assert.equal(p.volume,index.get(p.keyword)[1]);assert.ok(p.variants.every(k=>index.has(k)));assert.equal(p.volume,Math.max(...p.variants.map(k=>index.get(k)[1])));assert.equal(p.status,'Proposed — validate');}
 assert.equal(index.get('white lace blouse')[1],600);assert.equal(index.get('black denim blouse')[1],10);
 assert.ok(ps.some(p=>p.keyword==='black denim blouse'));assert.ok(ps.some(p=>p.keyword==='white lace blouse'));
});
