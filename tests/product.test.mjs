import test from 'node:test';import assert from 'node:assert/strict';import {readFile,access} from 'node:fs/promises';import {resolveVariant,resolveImage,validSize} from '../public/product-state.js';
const [product]=JSON.parse(await readFile('data/product-pages.json','utf8'));
test('product colour variants have complete distinct portrait galleries',async()=>{
 const paths=new Set();
 for(const v of product.variants){assert.equal(v.images.length,2);assert.deepEqual(v.images.map(i=>i.view),['front','back']);for(const img of v.images){assert.equal(img.width/img.height,9/16);assert.ok(img.alt.includes(v.name));assert.ok(!paths.has(img.src));paths.add(img.src);await access('dist'+img.src);await access('dist'+img.thumb);}}
 assert.equal(paths.size,6);
});
test('variant selection, image wraparound and size validation handle edge cases',()=>{
 assert.equal(resolveVariant(product,'sage').name,'Sage');assert.equal(resolveVariant(product,'missing').id,'oat');
 for(const id of ['oat','sage','cocoa','oat']){const v=resolveVariant(product,id);assert.ok(resolveImage(v,1).src.includes(id+'-back'));assert.equal(resolveImage(v,-1),v.images[1]);assert.equal(resolveImage(v,2),v.images[0]);}
 assert.equal(validSize(product,null),false);assert.equal(validSize(product,'XXXL'),false);assert.equal(validSize(product,'M'),true);
});
test('product template contains valid local links and a linked public portal record',async()=>{
 const html=await readFile('dist/products/'+product.slug+'/index.html','utf8');assert.ok(html.includes('Add to preview bag'));assert.ok(html.includes('Example price'));assert.ok(!html.includes('undefined'));
 for(const m of html.matchAll(/(?:src|href)="(\/[^"#?]*)"/g))await access('dist'+m[1]+(m[1].endsWith('/')?'index.html':''));
 const {productPages}=await import('../portal/public/data/product-pages.js');assert.equal(productPages[0].id,product.id);assert.equal(new URL(productPages[0].previewUrl).pathname,'/products/'+product.slug+'/');await access('portal/public'+productPages[0].cover);
});
