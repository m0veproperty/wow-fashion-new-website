import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import {buildCatalog} from '../scripts/core-catalog.mjs';
import {renderDiscoveryPages} from '../scripts/core-discovery.mjs';
import {normalizeQuery,parseBrowseState,browseCatalog,getSearchResults,suggestQuery,validWishlistIds} from '../public/core-discovery.js';
import {corePages} from '../portal/public/core-pages.js';
import {createWishlistBridge} from '../public/wishlist-bridge.js';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const json = path => JSON.parse(read(path));
const departmentFiles = [
  ['blouses','blouse-parent','products','collections'],
  ['cardigans','cardigans','cardigan-products'],
  ['coats-and-jackets','outerwear','outerwear-products'],
  ['dresses','dresses','dress-products'],
  ['pants','pants','pants-products'],
  ['skirts','skirts','skirts-products'],
  ['sweaters','sweaters','sweaters-products']
];
const departments = departmentFiles.map(([slug,dataFile,productsFile,collectionsFile])=>{
  const data=json('data/'+dataFile+'.json');
  return {slug,parent:collectionsFile?data:data.parent,collections:collectionsFile?json('data/'+collectionsFile+'.json'):data.collections,products:json('data/'+productsFile+'.json')};
});
const catalog=buildCatalog({departments,campaignHeroes:json('data/campaign-heroes.json')});
const pages=renderDiscoveryPages({catalog,corePages});
const state=query=>parseBrowseState(query,catalog);
const all=query=>browseCatalog(catalog,state(query),1000);

test('all shopping records from the website map resolve once, using existing collection routes or explicit browse filters',()=>{
  const shopping=json('portal/public/data/taxonomy.json').rows.filter(row=>['editorial','shop'].includes(row.system));
  assert.equal(shopping.length,248);
  assert.deepEqual(new Set(catalog.mapAssignments.map(row=>row.sourceId)),new Set(shopping.map(row=>row.id)));
  assert.equal(catalog.mapAssignments.length,shopping.length);
  assert.equal(catalog.mapAudit.mappedToBuiltCollections,236);
  assert.equal(catalog.mapAudit.mappedToBrowseFilters,12);
  assert.equal(catalog.collections.filter(collection=>collection.kind==='collection').length,129);
  assert.equal(catalog.departments.length,7);
  assert.equal(catalog.extraGroups.length,3);
  for(const mapping of catalog.mapAssignments)assert.ok(catalog.collections.some(collection=>collection.path===mapping.path),'Missing mapped destination '+mapping.sourceId);
  for(const department of catalog.departments)for(const collection of department.children)assert.equal(collection.parentPath,department.path);
  for(const group of catalog.extraGroups)for(const collection of group.children)assert.equal(collection.parentPath,group.path);
});

test('the full catalogue preserves real product identities, photos and local cardigan destinations while removing duplicates and retired records',()=>{
  assert.equal(catalog.products.length,499);
  assert.equal(new Set(catalog.products.map(product=>product.sourceUrl)).size,499);
  assert.equal(catalog.mapAudit.retiredRecordsExcluded,26);
  assert.deepEqual(catalog.idAliases,{'pants-27':'blouses-23','sweaters-18':'cardigans-34'});
  assert.deepEqual(catalog.products.slice(0,8).map(product=>product.id),['blouses-31','cardigans-6','dresses-20','pants-95','skirts-34','sweaters-2','dresses-31','coats-and-jackets-15']);
  for(const product of catalog.products){
    assert.equal(new URL(product.sourceUrl).hostname,'wowfashion.com');
    assert.ok(!product.sourceUrl.includes('__trashed'));
    assert.ok(existsSync(new URL('../public'+product.image,import.meta.url)),product.image);
    assert.equal(product.price,null);
    assert.ok(product.collectionPaths.length>0);
  }
  for(const id of [6,45,29,20])assert.match(catalog.products.find(product=>product.id==='cardigans-'+id).href,/^\/products\/[^/]+\/$/);
  assert.ok(catalog.products.find(product=>product.id==='blouses-23').departments.includes('pants'));
  assert.ok(catalog.products.find(product=>product.id==='cardigans-34').departments.includes('sweaters'));
  for(const collection of catalog.collections)if(collection.image)assert.ok(existsSync(new URL('../public'+collection.image,import.meta.url)),collection.image);
});

test('each built collection uses its exact source matches and keeps empty category selections empty',()=>{
  for(const department of departments){
    const available=department.products.filter(product=>!product.url.includes('__trashed'));
    for(const collection of department.collections){
      const expected=available.filter(product=>Array.isArray(collection.ids)?collection.ids.includes(product.id):product.categories.includes(collection.match)).map(product=>catalog.idAliases[department.slug+'-'+product.id]||department.slug+'-'+product.id);
      const actual=catalog.collections.find(item=>item.path===`/${department.slug}/${collection.slug}/`);
      assert.deepEqual(new Set(actual.productIds),new Set(expected),actual.path);
    }
  }
  for(const path of ['/blouses/denim-blouses/','/pants/corduroy-pants/'])assert.equal(catalog.collections.find(collection=>collection.path===path).count,0);
  assert.equal(catalog.collections.find(collection=>collection.key==='shop-2763').count,1);
  assert.equal(catalog.collections.find(collection=>collection.key==='shop-2761').count,2);
  for(const key of ['shop-2763','shop-2761'])for(const id of catalog.collections.find(collection=>collection.key===key).productIds)assert.ok(catalog.products.find(product=>product.id===id).sourceCategories.includes('Plus size'));
});

test('department and collection filters return all matching pieces, including canonical records shared across departments',()=>{
  for(const department of catalog.departments){
    const result=all('?department='+department.id);
    assert.equal(result.total,department.count,department.name);
    assert.ok(result.items.every(product=>product.departments.includes(department.id)));
  }
  for(const collection of catalog.collections){
    const result=all('?collection='+encodeURIComponent(collection.key));
    assert.deepEqual(new Set(result.items.map(product=>product.id)),new Set(collection.productIds),collection.name);
  }
  assert.ok(all('?department=pants').items.some(product=>product.id==='blouses-23'));
  assert.ok(all('?department=sweaters').items.some(product=>product.id==='cardigans-34'));
});

test('browse pagination is stable and complete, with no missing or repeated catalogue items',()=>{
  const first=browseCatalog(catalog,state(''));
  assert.equal(first.pageSize,24);
  assert.equal(first.pages,21);
  const ids=[];
  for(let page=1;page<=first.pages;page++)ids.push(...browseCatalog(catalog,state('?page='+page)).items.map(product=>product.id));
  assert.equal(ids.length,499);
  assert.equal(new Set(ids).size,499);
  const last=browseCatalog(catalog,state('?page=999999'));
  assert.equal(last.page,21);
  assert.equal(last.items.length,19);
  assert.deepEqual(browseCatalog(catalog,state('?page=1')).items,first.items);
  assert.equal(browseCatalog(catalog,state('?collection=shop-2767')).page,1);
});

test('browse URL state validates unsafe or unknown values and preserves supported filters and alphabetic sorting',()=>{
  const invalid=state('?department=unknown&collection=javascript:alert(1)&sort=price&page=-1&q='+encodeURIComponent('x'.repeat(150)));
  assert.deepEqual({...invalid,q:''},{q:'',department:'',collection:'',sort:'edit',page:1});
  assert.equal(invalid.q.length,120);
  const selected=state('?department=pants&collection=%2Fblouses%2Fsatin-blouses%2F&sort=za&page=2');
  assert.equal(selected.department,'blouses');
  assert.equal(selected.collection,'/blouses/satin-blouses/');
  assert.equal(selected.sort,'za');
  const az=all('?sort=az').items.map(product=>product.name);
  assert.deepEqual(az,[...az].sort((a,b)=>a.localeCompare(b,'en')));
  assert.deepEqual(all('?sort=za').items.map(product=>product.name),[...az].sort((a,b)=>b.localeCompare(a,'en')));
  for(const value of ['NaN','Infinity','1.2','0'])assert.equal(state('?page='+value).page,1);
});

test('search covers every mapped collection, all products and editorial help with synonyms and relevant exact matches',()=>{
  for(const collection of catalog.collections)assert.ok(getSearchResults(catalog,collection.name).collections.some(item=>item.key===collection.key),collection.name);
  for(const product of catalog.products)assert.ok(getSearchResults(catalog,product.name).products.some(item=>item.id===product.id),product.id);
  assert.equal(getSearchResults(catalog,'club dresses').collections[0].path,'/dresses/club-dresses/');
  assert.equal(normalizeQuery('  T-SHIRTS & Crème Trousers  '),'tshirt and creme pants');
  assert.deepEqual(getSearchResults(catalog,'linen trousers').products,getSearchResults(catalog,'linen pants').products);
  const guides=[{name:'Size guide',description:'How to measure yourself',path:'/size-guide/'}];
  assert.equal(getSearchResults(catalog,'measure',{guides}).guides[0].path,'/size-guide/');
  assert.equal(getSearchResults(catalog,'measure',{guides,department:'blouses'}).guides.length,0);
  assert.equal(getSearchResults(catalog,'').total,0);
  assert.equal(getSearchResults(catalog,'zzyyxxnotathing').total,0);
  assert.equal(suggestQuery(catalog,'chifon blouses'),'chiffon blouses');
  assert.equal(suggestQuery(catalog,'zzyyxxnotathing'),'');
});

test('guest wishlist parsing recovers safely from malformed storage and canonicalises duplicate product IDs',()=>{
  for(const raw of [null,'undefined','{','{}','42','"blouses-31"'])assert.deepEqual(validWishlistIds(raw,catalog),[]);
  assert.deepEqual(validWishlistIds('["pants-27","blouses-23","missing",null,12,"cardigans-6"]',catalog),['blouses-23','cardigans-6']);
});

test('six discovery previews have useful content and the full category hierarchy, with evidence-dependent claims explicitly pending',()=>{
  assert.deepEqual(pages.map(page=>page.id),['core-shop','core-search','core-new','core-best','core-sale','core-wishlist']);
  const shop=pages.find(page=>page.id==='core-shop').body;
  for(const collection of catalog.collections)assert.ok(shop.includes('href="'+collection.path.replace(/&/g,'&amp;')+'"'),collection.path);
  for(const page of pages){
    assert.equal((page.body.match(/<h1\b/g)||[]).length,1);
    assert.doesNotMatch(page.body,/__trashed|\b(?:20|30|50)% off\b|\b(?:sold out|in stock)\b/i);
    assert.ok(page.body.length>500);
    assert.deepEqual(page.styles,['/core-discovery.css']);
    assert.deepEqual(page.scripts,['/core-discovery.js']);
    assert.equal(page.status,['core-new','core-best','core-sale'].includes(page.id)?'Integration required':'Built');
    assert.equal(page.dependencies.length>0,page.status==='Integration required');
  }
  const search=pages.find(page=>page.id==='core-search').body;
  const guides=JSON.parse(search.match(/id="discovery-guide-data">([\s\S]*?)<\/script>/)[1]);
  assert.ok(guides.some(guide=>guide.path==='/size-guide/'));
  assert.ok(guides.every(guide=>!/[{}]/.test(guide.path)));
  assert.ok(search.includes('/pants/linen-pants/'));
});

test('wishlist discovery requests the universal saved state, renders that state and leaves storage mutations to the shared controller',async()=>{
  const listeners=new Map(),clicks=[],events=[];
  let writes=0;
  const storage={value:'["blouses-31"]',getItem(){return this.value;},setItem(key,value){writes++;this.value=value;}};
  const nodes=new Map();
  let renderedButtons=[];
  const element=()=>({dataset:{},hidden:false,textContent:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},querySelectorAll(){return [];},querySelector(){return null;}});
  for(const id of ['discovery-load-status','wishlist-result-count','wishlist-content'])nodes.set(id,element());
  const content=nodes.get('wishlist-content');
  Object.defineProperty(content,'innerHTML',{get(){return this.html||'';},set(html){
    this.html=html;
    renderedButtons=[...html.matchAll(/<button\b[^>]*data-save="([^"]+)"[^>]*>/g)].map(match=>({dataset:{save:match[1]},attributes:{},hasAttribute(name){return match[0].includes(name);},setAttribute(name,value){this.attributes[name]=value;}}));
  }});
  const root=element();root.dataset.discoveryPage='wishlist';
  const document={documentElement:element(),activeElement:null,querySelector(selector){return selector==='[data-discovery-page]'?root:null;},getElementById(id){return nodes.get(id)||null;},querySelectorAll(selector){return selector==='[data-save]'?renderedButtons:[];},addEventListener(name,fn){if(name==='click')clicks.push(fn);}};
  const window={addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},dispatchEvent(event){events.push(event.type);for(const fn of listeners.get(event.type)||[])fn(event);}};
  const context=vm.createContext({document,window,localStorage:storage,fetch:async()=>({ok:true,json:async()=>catalog}),CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail;}},setTimeout,clearTimeout,URLSearchParams});
  vm.runInContext(read('public/core.js'),context);
  vm.runInContext(read('public/core-discovery.js').replace(/^export /gm,''),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(writes,0,'Loading or rendering the wishlist must not overwrite saved state');
  assert.ok(events.includes('wow:request-saved'));
  assert.ok(events.includes('wow:catalog-rendered'));
  assert.match(content.innerHTML,/data-product-id="blouses-31"/);
  assert.ok(renderedButtons.every(button=>button.attributes['aria-pressed']==='true'),'Newly rendered saved buttons are refreshed by core.js');
  await clicks[0]({target:{closest:()=>({dataset:{save:'blouses-31'}})},preventDefault(){}});
  assert.equal(writes,1,'The universal controller owns the single save mutation');
  assert.doesNotMatch(content.innerHTML,/data-product-id="blouses-31"/);
  assert.match(content.innerHTML,/Something will/);
});

const preservedProducts=path=>{const source=read(path),start=source.indexOf('[');return JSON.parse(source.slice(start,source.indexOf('];',start)+1));};
const preservedDressProducts=preservedProducts('public/dresses/app.js');
const preservedClubProducts=preservedProducts('public/dresses/club-dresses/products.js');
const bridgeStorage=initial=>({values:{...initial},getItem(key){return this.values[key]??null;},setItem(key,value){this.values[key]=value;}});

test('both preserved animated edits map every legacy item by its actual product URL, including the distinct club ID index',async()=>{
  for(const products of [preservedDressProducts,preservedClubProducts]){
    const bridge=await createWishlistBridge({products,legacyKey:'test-edit',onChange(){},storage:bridgeStorage({}),eventTarget:new EventTarget(),fetchCatalog:async()=>catalog});
    assert.equal(bridge.mapping.size,products.length);
    for(const product of products)assert.equal(catalog.products.find(item=>item.id===bridge.mapping.get(product.id)).sourceUrl,product.url);
    if(products===preservedClubProducts)assert.equal(bridge.mapping.get(1),'dresses-13');
  }
  assert.equal(preservedDressProducts.length+preservedClubProducts.length,27);
});

test('legacy migration and later dress toggles preserve other departments and do not resurrect removed favourites on revisit',async()=>{
  const storage=bridgeStorage({'wow-homepage-saved-v1':'["blouses-31","skirts-34"]','wow-club-edit':'[1,2]'});
  let last;
  const setup=()=>createWishlistBridge({products:preservedClubProducts,legacyKey:'wow-club-edit',onChange:state=>{last=state;},storage,eventTarget:new EventTarget(),fetchCatalog:async()=>catalog});
  const bridge=await setup();
  assert.deepEqual(last.ids,[1,2]);
  assert.deepEqual(JSON.parse(storage.values['wow-homepage-saved-v1']),['blouses-31','skirts-34','dresses-13','dresses-29']);
  assert.deepEqual(JSON.parse(storage.values['wow-club-edit']),[]);
  storage.values['wow-homepage-saved-v1']='["blouses-31","skirts-34","sweaters-2","dresses-29"]';
  bridge.refresh();
  assert.deepEqual(last.ids,[2]);
  await setup();
  assert.deepEqual(last.ids,[2],'A dress removed from the full wishlist must stay removed after revisiting the old page');
  bridge.toggle(2);
  assert.deepEqual(JSON.parse(storage.values['wow-homepage-saved-v1']),['blouses-31','skirts-34','sweaters-2']);
  bridge.toggle(7);
  assert.deepEqual(JSON.parse(storage.values['wow-homepage-saved-v1']),['dresses-70','blouses-31','skirts-34','sweaters-2']);
});

test('the preserved-page bridge retains session saves when writes fail and keeps unmapped legacy items explicitly local',async()=>{
  const storage=bridgeStorage({'wow-homepage-saved-v1':'["skirts-34"]'});
  storage.setItem=()=>{throw new Error('Storage blocked');};
  let last;
  const bridge=await createWishlistBridge({products:[...preservedDressProducts,{id:999,url:'https://wowfashion.com/unknown-legacy-dress/'}],legacyKey:'wow-dress-edit',onChange:state=>{last=state;},storage,eventTarget:new EventTarget(),fetchCatalog:async()=>catalog});
  bridge.toggle(20);bridge.toggle(10);
  assert.deepEqual(last.ids,[20,10]);
  assert.equal(last.storageAvailable,false);
  assert.deepEqual(last.unmappedIds,[999]);
  const result=bridge.toggle(999);
  assert.equal(result.mapped,false);
  assert.equal(result.saved,true);
  assert.deepEqual(JSON.parse(storage.values['wow-homepage-saved-v1']),['skirts-34']);
  await assert.rejects(createWishlistBridge({products:preservedDressProducts,legacyKey:'wow-dress-edit',onChange(){},storage,eventTarget:new EventTarget(),fetchCatalog:async()=>{throw new Error('Offline');}}),/Offline/);
});
