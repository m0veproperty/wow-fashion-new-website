import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {productPageView} from '../public/product-pages.js';import {productPages} from '../public/data/product-pages.js';
test('public Products view presents the test page and all colour preview links',()=>{
 const html=productPageView();assert.ok(html.includes('<h1>Products</h1>'));for(const p of productPages){assert.ok(html.includes(p.previewUrl));assert.ok(html.includes(p.name));for(const c of p.colours)assert.ok(html.includes('?colour='+c.toLowerCase()));}assert.ok(html.includes('9:16 portrait'));
});
test('Products is added separately without replacing private product research',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');assert.ok(app.includes("['product-pages','Products','layers']"));assert.ok(app.includes("['products','Product research','bag']"));assert.ok(app.includes("'product-pages':productPageView"));assert.ok(app.includes('products:productsView'));
});
