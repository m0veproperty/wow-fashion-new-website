import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {renderCommercePages} from '../scripts/core-commerce.mjs';
import {corePages} from '../portal/public/core-pages.js';
import {
  CART_KEY,ORDER_KEY,RETURN_KEY,SAMPLE_UNIT_PRICE,SAMPLE_COLOURS,SAMPLE_SIZES,
  sanitizeCart,addSampleItem,changeSampleItem,removeSampleItem,sampleSubtotal,
  sanitizeOrder,sampleOrder,sanitizeReturn,validatePreviewDetails
} from '../public/core-commerce.js';

const pages=renderCommercePages({corePages});
const byId=id=>pages.find(page=>page.id==='core-'+id);
const sampleItem={colour:'oat',size:'M',quantity:1};
const empty={version:1,items:[],orderPreview:false};
const validDetails={firstName:'Sample',lastName:'Shopper',line1:'12 Example Lane',city:'Exampletown',postcode:'AB1 2CD',email:'sample@example.invalid',label:'Home'};
const source=await readFile(new URL('../public/core-commerce.js',import.meta.url),'utf8');
const [product]=JSON.parse(await readFile(new URL('../data/product-pages.json',import.meta.url),'utf8'));

test('all 21 delegated screens have distinct concrete routes, matching the portal inventory',()=>{
  const expected=['basket','checkout','confirmation','payment-retry','login','register','reset','account','orders','order','addresses','preferences','tracking','return-start','return-status','404','error','newsletter','unsubscribe','gift','loyalty'];
  assert.deepEqual(pages.map(page=>page.id),expected.map(id=>'core-'+id));
  assert.equal(new Set(pages.map(page=>page.path)).size,21);
  assert.equal(new Set(pages.map(page=>page.body)).size,21);
  for(const page of pages){
    assert.equal(page.path,page.id==='core-order'?'/account/orders/sample-order/':corePages.find(item=>item.id===page.id).path);
    assert.doesNotMatch(page.path,/[{}]/);
    assert.deepEqual(page.styles,['/core-commerce.css']);
    assert.deepEqual(page.scripts,['/core-commerce.js']);
    assert.equal(page.status,page.kind==='system'?'Built':'Integration required');
    assert.equal(page.dependencies.length>0,page.kind!=='system');
  }
});

test('sample commerce pages identify their preview status and contain usable landmarks and labels',()=>{
  for(const page of pages){
    assert.equal((page.body.match(/<h1\b/g)||[]).length,1,page.path);
    const ids=[...page.body.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);
    assert.equal(new Set(ids).size,ids.length,'Duplicate ID on '+page.path);
    for(const [,id] of page.body.matchAll(/\sfor="([^"]+)"/g))assert.ok(ids.includes(id),page.path+' missing labelled input '+id);
    for(const [,references] of page.body.matchAll(/\saria-(?:describedby|labelledby)="([^"]+)"/g)){
      for(const id of references.split(/\s+/))assert.ok(ids.includes(id),page.path+' missing accessibility reference '+id);
    }
    if(page.kind==='commerce')assert.match(page.body,/aria-label="Preview information"/);
    assert.ok(page.description.length>12);
  }
});

test('sample configuration and referenced imagery use the existing concept product',async()=>{
  assert.equal(product.price,SAMPLE_UNIT_PRICE);
  assert.equal(product.currency,'GBP');
  assert.deepEqual(product.sizes,SAMPLE_SIZES);
  assert.deepEqual(product.variants.map(item=>item.id),SAMPLE_COLOURS);
  const checked=new Set();
  for(const page of pages){
    const config=JSON.parse(page.body.match(/id="commerce-page-data">([^<]+)<\/script>/)[1]);
    assert.equal(config.sample.id,product.id);
    assert.equal(config.sample.price,48);
    for(const [,src] of page.body.matchAll(/<img[^>]+src="([^"]+)"/g)){
      assert.ok(src.startsWith('/assets/'),src);
      if(checked.has(src))continue;
      checked.add(src);
      assert.ok((await stat(new URL('../public'+src,import.meta.url))).isFile(),src);
    }
  }
});

test('credentials and payments cannot be submitted by the design-preview forms',()=>{
  for(const page of pages){
    for(const [input] of page.body.matchAll(/<input[^>]*type="password"[^>]*>/g))assert.match(input,/\sreadonly(?:\s|>)/);
    assert.doesNotMatch(page.body,/<input[^>]*(?:autocomplete="cc-|name="(?:card|cvc|cvv|cardnumber|password-confirm))/i);
    for(const [form] of page.body.matchAll(/<form\b[^>]*>/g)){
      // The recovery search is the only form allowed to make a native request.
      if(page.id==='core-404')assert.match(form,/action="\/search\/" method="get"/);
      else assert.match(form,/method="dialog"/);
    }
  }
  assert.match(byId('checkout').body,/Preview order confirmation/);
  assert.match(byId('checkout').body,/no payment details/i);
  assert.match(byId('confirmation').body,/no order has been placed/i);
  assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage/);
});

test('invalid storage and unknown products produce an empty bag',()=>{
  for(const input of [null,undefined,'broken JSON',[],42,{items:[null,{},sampleItem.color,{colour:'black',size:'M',quantity:1},{colour:'oat',size:'XXXL',quantity:1},{colour:'oat',size:'M',quantity:0},{colour:'oat',size:'M',quantity:1.5}]}]){
    assert.deepEqual(sanitizeCart(input),empty);
  }
});

test('sample storage keeps only whitelisted option IDs, quantities and the preview flag',()=>{
  const input={version:1,items:[{...sampleItem,email:'someone@example.test',address:'private value',price:999}],orderPreview:true,customer:{firstName:'Private'},token:'secret'};
  const clean=sanitizeCart(JSON.stringify(input));
  assert.deepEqual(clean,{version:1,items:[sampleItem],orderPreview:true});
  assert.doesNotMatch(JSON.stringify(clean),/private|someone|999|secret/i);
  assert.deepEqual(sanitizeCart({...sampleItem,version:1,orderPreview:true}),clean,'Earlier single-line sample bags remain readable');
  assert.equal(sanitizeCart({...empty,orderPreview:true}).orderPreview,false);
});

test('different sample variants remain separate while duplicates merge within the quantity limit',()=>{
  const input={items:[{colour:'oat',size:'M',quantity:6},{colour:'OAT',size:'M',quantity:8},{colour:'sage',size:'L',quantity:2},{colour:'sage',size:'M',quantity:1}]};
  assert.deepEqual(sanitizeCart(input).items,[{colour:'oat',size:'M',quantity:10},{colour:'sage',size:'L',quantity:2},{colour:'sage',size:'M',quantity:1}]);
  const allOptions={items:SAMPLE_COLOURS.flatMap(colour=>SAMPLE_SIZES.map(size=>({colour,size,quantity:1})))};
  assert.equal(sanitizeCart(allOptions).items.length,15);
});

test('bag edits invalidate confirmation state, preserve unrelated choices and do not mutate callers',()=>{
  const original={version:1,items:[{colour:'oat',size:'M',quantity:2},{colour:'sage',size:'L',quantity:1}],orderPreview:true};
  const snapshot=structuredClone(original);
  const changed=changeSampleItem(original,'oat:M',{size:'L',quantity:3});
  assert.deepEqual(changed,{version:1,items:[{colour:'oat',size:'L',quantity:3},{colour:'sage',size:'L',quantity:1}],orderPreview:false});
  const merged=changeSampleItem(original,'oat:M',{colour:'sage',size:'L'});
  assert.deepEqual(merged.items,[{colour:'sage',size:'L',quantity:3}]);
  assert.equal(addSampleItem(original).orderPreview,false);
  assert.deepEqual(original,snapshot);
});

test('removing the final item restores a genuinely empty bag and example totals track quantity',()=>{
  let cart=addSampleItem(empty);
  assert.equal(sampleSubtotal(cart),48);
  cart=addSampleItem(cart,{colour:'cocoa',size:'S',quantity:3});
  assert.equal(sampleSubtotal(cart),192);
  cart=removeSampleItem(cart,'oat:M');
  assert.equal(sampleSubtotal(cart),144);
  cart=removeSampleItem(cart,'cocoa:S');
  assert.deepEqual(cart,empty);
  assert.equal(sampleSubtotal(cart),0);
});

test('return preview stores fixed choices only, without free text or personal information',()=>{
  assert.equal(RETURN_KEY,'wow-return-preview-v1');
  assert.equal(CART_KEY,'wow-commerce-preview-v1');
  for(const input of [null,[],{},'malformed',{reason:'private address',resolution:'refund'},{reason:'fit',resolution:'cash'}])assert.equal(sanitizeReturn(input),null);
  assert.deepEqual(sanitizeReturn({reason:'fit',resolution:'refund',quantity:5,email:'someone@example.test',exchangeSize:'M'}),{version:1,items:[sampleItem],reason:'fit',resolution:'refund'});
  assert.deepEqual(sanitizeReturn({reason:'colour',resolution:'exchange',exchangeSize:'S',name:'Private'}),{version:1,items:[sampleItem],reason:'colour',resolution:'exchange',exchangeSize:'S'});
  assert.deepEqual(sanitizeReturn(JSON.stringify({reason:'fault',resolution:'exchange',exchangeSize:'invalid'})),{version:1,items:[sampleItem],reason:'fault',resolution:'exchange',exchangeSize:'L'});
  assert.doesNotMatch(byId('return-status').body,/data-cart-summary/,'A return example must not be replaced by the current shopping bag');
});

test('checkout order snapshots keep every selected variant and quantity, independently of later bag edits',()=>{
  assert.equal(ORDER_KEY,'wow-order-preview-v1');
  const cart={version:1,items:[{colour:'sage',size:'L',quantity:2},{colour:'cocoa',size:'S',quantity:3}],orderPreview:false,email:'private@example.test'};
  const order=sanitizeOrder(cart);
  assert.deepEqual(order,{version:1,items:[{colour:'sage',size:'L',quantity:2},{colour:'cocoa',size:'S',quantity:3}]});
  assert.equal(sampleSubtotal(order),240);
  assert.equal(sampleSubtotal(changeSampleItem(cart,'sage:L',{quantity:1})),192);
  assert.equal(sampleSubtotal(order),240,'Editing a later bag must not change the linked sample order');
  cart.items[0].quantity=10;
  assert.equal(order.items[0].quantity,2,'The order must not share mutable item objects with the bag');
  assert.deepEqual(sanitizeOrder(JSON.stringify(order)),order);
  assert.doesNotMatch(JSON.stringify(order),/private|email|orderPreview/);
});

test('order screens share one snapshot binding and explicit standalone fallback',()=>{
  for(const id of ['confirmation','account','orders','order','tracking']){
    const body=byId(id).body;
    assert.match(body,/data-order-lines/,id+' must render the shared snapshot');
    assert.match(body,/data-order-source/,id+' must identify the standalone fallback');
    assert.doesNotMatch(body,/data-confirmation-lines|data-cart-subtotal/,id+' must not follow the mutable bag');
    if(id!=='tracking')assert.match(body,/data-order-subtotal/);
  }
  for(const invalid of [null,{},[],{items:[]},{items:[{colour:'unknown',size:'M',quantity:2}]}])assert.equal(sanitizeOrder(invalid),null);
  assert.deepEqual(sampleOrder(null),{version:1,items:[sampleItem]});
  const selected={version:1,items:[{colour:'sage',size:'L',quantity:2}]};
  assert.deepEqual(sampleOrder(selected),selected);
});

test('return selections preserve ordered options and cannot exceed their original quantities',()=>{
  const order={version:1,items:[{colour:'sage',size:'L',quantity:2},{colour:'cocoa',size:'S',quantity:3}]};
  const request=sanitizeReturn({items:[{colour:'sage',size:'L',quantity:1},{colour:'cocoa',size:'S',quantity:10},{colour:'oat',size:'M',quantity:1}],reason:'fit',resolution:'exchange',exchangeSize:'XL'},order);
  assert.deepEqual(request,{version:1,items:[{colour:'sage',size:'L',quantity:1},{colour:'cocoa',size:'S',quantity:3}],reason:'fit',resolution:'exchange',exchangeSize:'XL'});
  assert.equal(sampleSubtotal(request),192);
  assert.equal(sanitizeReturn({items:[sampleItem],reason:'fit',resolution:'refund'},order),null);
  assert.equal(sanitizeReturn({items:[],reason:'fit',resolution:'refund'},order),null);
  assert.match(byId('return-start').body,/id="return-item-options"/);
  assert.match(byId('return-status').body,/data-return-lines/);
  assert.match(byId('return-status').body,/data-return-subtotal/);
});

test('history restoration refreshes stored state and synchronises dependent return controls',()=>{
  assert.match(source,/addEventListener\('pageshow',\(\)=>\{\s*reloadPreviewState\(\);renderCart\(\);renderOrderViews\(\);resetReturnControls\(\)/);
  assert.match(source,/function reloadPreviewState\(\)[\s\S]*?sessionStorage\.getItem\(CART_KEY\)[\s\S]*?sessionStorage\.getItem\(ORDER_KEY\)/);
  assert.match(source,/function resetReturnControls\(\)[\s\S]*?\$\('#return-exchange-options'\)\.hidden=\$\('\[name="return-resolution"\]:checked'\)\.value!=='exchange'/);
  assert.match(source,/\['return-item-error','return-reason-error','return-understood-error'\]/);
  assert.match(source,/sessionStorage\.setItem\(ORDER_KEY,JSON\.stringify\(snapshot\)\);sessionStorage\.removeItem\(RETURN_KEY\)/);
});

test('sample detail validation reports each missing field and accepts the fictional fixture',()=>{
  assert.deepEqual(validatePreviewDetails(validDetails,{email:true,label:true}),{});
  assert.deepEqual(Object.keys(validatePreviewDetails({}, {email:true,label:true})).sort(),['city','email','firstName','label','lastName','line1','postcode']);
  const errors=validatePreviewDetails({...validDetails,firstName:' ',postcode:'unknown',email:'invalid',label:'x'.repeat(41)},{email:true,label:true});
  assert.deepEqual(Object.keys(errors).sort(),['email','firstName','label','postcode']);
  assert.deepEqual(validatePreviewDetails({...validDetails,postcode:'ab12cd'}),{});
  assert.ok(validatePreviewDetails({...validDetails,line1:'x'.repeat(101)}).line1);
});

test('browser history cleanup resets editable fields and rendered personal preview content',()=>{
  assert.match(source,/addEventListener\('pagehide'/);
  assert.match(source,/input\.value=input\.defaultValue/);
  assert.match(source,/\$\('#checkout-address-review'\)\.textContent=''/);
  assert.match(source,/resetAddresses\(\)/);
  assert.match(source,/\$\('#gift-preview-message'\)\.textContent=\$\('#gift-example-message'\)\.defaultValue/);
});
