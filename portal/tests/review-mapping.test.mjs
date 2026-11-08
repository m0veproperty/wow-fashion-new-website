import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogue,sampleReviews,productPageView,reviewsView} from '../public/product-pages.js';
test('dummy records stay portal only and reviews reference valid product IDs',()=>{
 assert.equal(catalogue.length,20);assert.equal(new Set(catalogue.map(p=>p.id)).size,20);
 assert.equal(new Set(sampleReviews.map(r=>r.id)).size,sampleReviews.length);
 for(const r of sampleReviews){assert.ok(catalogue.some(p=>p.id===r.productId));assert.equal(r.dummyReview,true);}
 for(const p of catalogue.filter(p=>!p.existing)){assert.equal(p.dummyProduct,true);assert.equal(p.pageBuilt,'No');assert.equal(p.previewUrl,null);}
});
test('product links filter reviews and return to the same product',()=>{
 for(const p of catalogue){const params=new URLSearchParams({product:p.id});const detail=productPageView({params}),reviews=reviewsView({params});assert.ok(detail.includes('#/reviews?product='+p.id));assert.ok(reviews.includes('#/product-pages?product='+p.id));for(const r of sampleReviews){assert.equal(reviews.includes(r.id),r.productId===p.id);}}
});
test('rating and workflow filters intersect and respect content security policy',()=>{
 const html=reviewsView({params:new URLSearchParams({rating:'3',status:'Draft'})});
 for(const r of sampleReviews)assert.equal(html.includes(r.id),r.rating===3&&r.status==='Draft');
 assert.ok(!/onchange=|onsubmit=/.test(html));assert.ok(html.includes('data-review-filter="product"'));
});

test('variation ranges and sale prices reflect the underlying combinations',async()=>{
 const {productPrice}=await import('../public/product-pages.js');
 const p=catalogue.find(p=>p.id==='wow-dummy-001');
 assert.equal(productPrice(p),'£39.00–£47.00');assert.equal(productPrice(p,true),'£31.20–£37.60');
 assert.equal(productPrice(catalogue.find(p=>p.id==='wow-dummy-002'),true),'—');
 const html=productPageView();assert.ok(html.includes('<th>Price</th><th>Sale price</th>'));assert.ok(!html.includes('<th>Example price</th>'));
 for(const p of catalogue)for(const v of p.variants||[])if(v.salePrice!==null)assert.ok(v.salePrice<v.price);
 for(const r of sampleReviews){assert.match(r.reviewer,/^[A-Z][a-z]+ [A-Z]\.$/);assert.ok(!r.body.includes('Placeholder review'));}
});
