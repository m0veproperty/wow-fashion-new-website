import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {navigationDepartments,navigationEdits,navigationHelp} from '../scripts/site-navigation-data.mjs';
import {siteHeader,siteNavigationAssets} from '../scripts/site-navigation.mjs';
import {createNavigationScrollState} from '../public/site-navigation.js';
import {parseBrowseState,browseCatalog} from '../public/core-discovery.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const json=async path=>JSON.parse(await read(path));
const sources=[
  ['dresses','data/dresses.json'],
  ['blouses','data/collections.json'],
  ['cardigans','data/cardigans.json'],
  ['coats-and-jackets','data/outerwear.json'],
  ['pants','data/pants.json'],
  ['skirts','data/skirts.json'],
  ['sweaters','data/sweaters.json']
];
const expectedDepartments=await Promise.all(sources.map(async ([id,file])=>{
  const source=await json(file);
  return {id,path:`/${id}/`,collections:(Array.isArray(source)?source:source.collections).map(collection=>`/${id}/${collection.slug}/`)};
}));
const groupedLinks=navigationDepartments.flatMap(department=>department.groups.flatMap(group=>group.links));
const decode=value=>value.replaceAll('&amp;','&');
const htmlIds=html=>[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);
const builtPath=path=>path==='/404/'?'dist/_system/404.html':path==='/service-unavailable/'?'dist/_system/503.html':'dist'+path+(path.endsWith('/')?'index.html':'');
async function resolveLocal(href){
  assert.ok(href.startsWith('/')&&!href.startsWith('//'),'Navigation must stay on the preview site: '+href);
  const url=new URL(decode(href),'https://wow.test');
  assert.ok((await stat(new URL('../'+builtPath(url.pathname),import.meta.url))).isFile(),'Missing navigation destination: '+href);
  if(url.hash){
    const html=await read(builtPath(url.pathname));
    assert.ok(htmlIds(html).includes(decodeURIComponent(url.hash.slice(1))),'Missing destination section: '+href);
  }
}

test('grouped navigation covers all seven departments and every source subcategory exactly once',()=>{
  assert.equal(navigationDepartments.length,7);
  assert.deepEqual(navigationDepartments.map(department=>department.id).sort(),expectedDepartments.map(department=>department.id).sort());
  const expected=expectedDepartments.flatMap(department=>department.collections);
  assert.equal(expected.length,122);
  const actual=groupedLinks.filter(link=>new URL(link.href,'https://wow.test').pathname!=='/shop/').map(link=>link.href);
  assert.equal(new Set(actual).size,actual.length,'A subcategory must not repeat across shopping groups');
  assert.deepEqual(actual.slice().sort(),expected.slice().sort());
  for(const department of navigationDepartments){
    const source=expectedDepartments.find(item=>item.id===department.id);
    assert.equal(department.href,source.path);
    assert.ok(department.groups.length>0);
    assert.ok(department.groups.every(group=>group.label.trim()&&group.links.length>0));
    const links=department.groups.flatMap(group=>group.links).filter(link=>link.href.startsWith(department.href));
    assert.deepEqual(links.map(link=>link.href).sort(),source.collections.slice().sort(),department.label);
  }
});

test('navigation links, campaign tiles, shared assets and mapped shopping filters resolve',async()=>{
  const links=[...navigationDepartments,...groupedLinks,...navigationEdits,...navigationHelp];
  const destinations=new Set(links.map(link=>link.href));
  const assets=new Set(navigationDepartments.map(department=>department.image));
  for(const match of siteNavigationAssets.matchAll(/(?:href|src)="([^"]+)"/g))assets.add(match[1]);
  const css=await read('dist/site-navigation.css');
  for(const match of css.matchAll(/url\(['"]?(\/[^)'"\s]+)['"]?\)/g))assets.add(match[1]);
  await Promise.all([...destinations,...assets].map(resolveLocal));

  const catalog=await json('dist/data/shop-catalog.json');
  const filters=links.filter(link=>new URL(link.href,'https://wow.test').searchParams.has('collection'));
  assert.equal(filters.length,5,'Mapped blouse and additional shopping edits must remain discoverable');
  assert.equal(new Set(filters.map(link=>link.href)).size,filters.length);
  for(const link of filters){
    const url=new URL(link.href,'https://wow.test');
    const key=url.searchParams.get('collection');
    const collection=catalog.collections.find(item=>item.key===key);
    assert.ok(collection,'Unknown mapped filter: '+link.href);
    const state=parseBrowseState(url.search,catalog);
    assert.equal(state.collection,key,'The catalogue must retain the linked filter');
    assert.equal(browseCatalog(catalog,state).total,collection.count,'Mapped links must filter to their own collection');
  }
});

test('each page family has one shared header and drawer with valid controls and unique IDs',async()=>{
  const products=await json('data/product-pages.json');
  const related=await json('data/related-cardigans.json');
  const routes=new Set([
    '/', '/shop/', '/help/', '/checkout/', '/about/', '/404/', '/service-unavailable/',
    ...expectedDepartments.map(department=>department.path),
    ...expectedDepartments.map(department=>department.collections.find(path=>path!=='/dresses/club-dresses/')),
    '/dresses/club-dresses/',
    ...products.map(product=>`/products/${product.slug}/`),
    ...related.map(product=>`/products/${product.slug}/`)
  ]);
  for(const route of routes){
    const html=await read(builtPath(route));
    const ids=htmlIds(html);
    assert.equal(ids.length,new Set(ids).size,'Duplicate element ID on '+route);
    assert.equal((html.match(/\bdata-site-navigation(?:\s|>)/g)||[]).length,1,'Missing or repeated shared navigation on '+route);
    assert.equal((html.match(/<header\b[^>]*\bid="site-header"/g)||[]).length,1,'Missing or repeated shared header on '+route);
    assert.equal((html.match(/<dialog\b[^>]*\bid="site-menu"/g)||[]).length,1,'Missing or repeated menu drawer on '+route);
    assert.equal((html.match(/href="\/site-navigation\.css"/g)||[]).length,1,'Stylesheet count on '+route);
    assert.equal((html.match(/src="\/site-navigation\.js"/g)||[]).length,1,'Interaction module count on '+route);
    assert.ok(!html.includes('<!--site-navigation-->'),'Unresolved navigation marker on '+route);
    const nav=html.match(/<header\b[^>]*\bid="site-header"[\s\S]*?<\/header>/)?.[0]||'';
    const drawer=html.match(/<dialog\b[^>]*\bid="site-menu"[\s\S]*?<\/dialog>/)?.[0]||'';
    for(const match of (nav+drawer).matchAll(/\b(?:aria-controls|aria-labelledby)="([^"]+)"/g)){
      for(const target of match[1].split(/\s+/))assert.ok(ids.includes(target),'Missing menu target '+target+' on '+route);
    }
    for(const match of html.matchAll(/<a\b[^>]*class="site-skip"[^>]*href="#([^"]+)"/g)){
      assert.ok(ids.includes(match[1]),'Missing skip destination on '+route);
    }
    for(const department of navigationDepartments){
      assert.equal((nav.match(new RegExp(`data-nav-department="${department.id}"`,'g'))||[]).length,1,route+' desktop '+department.id);
      assert.equal((drawer.match(new RegExp(`data-mobile-department="${department.id}"`,'g'))||[]).length,1,route+' mobile '+department.id);
    }
  }
});

test('the current category remains identified in desktop and mobile navigation',()=>{
  const path='/blouses/satin-blouses/';
  const html=siteHeader(path,{overlay:true});
  const currentLinks=[...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*aria-current="page"/g)].map(match=>decode(match[1]));
  assert.deepEqual(currentLinks,[path,path],'Both menu versions should identify the current subcategory');
  const currentDepartments=[...html.matchAll(/data-(?:nav|mobile)-department="([^"]+)" data-current="true"/g)].map(match=>match[1]);
  assert.deepEqual(currentDepartments,['blouses','blouses']);
});

test('scroll direction has a buffer before hiding or revealing the header',()=>{
  const track=createNavigationScrollState({threshold:120,buffer:12});
  assert.equal(track(0).hidden,false);
  assert.equal(track(120).hidden,false,'The complete opening header stays visible');
  assert.equal(track(300).hidden,true,'Scrolling down past the opening hides navigation');
  assert.equal(track(298).hidden,true,'Small upward movement should not flicker');
  assert.equal(track(292).hidden,true);
  assert.equal(track(288).hidden,false,'A deliberate upward movement reveals navigation');
  assert.equal(track(291).hidden,false,'A small downward correction preserves visibility');
  assert.equal(track(300).hidden,true,'Further deliberate downward movement hides it again');
});

test('direction changes reset the buffer instead of accumulating touchpad noise',()=>{
  const track=createNavigationScrollState({threshold:120,buffer:12});
  assert.equal(track(400).hidden,true);
  assert.equal(track(395).hidden,true);
  assert.equal(track(397).hidden,true);
  assert.equal(track(390).hidden,true,'Separate upward movements must not accumulate across a direction reversal');
  assert.equal(track(385).hidden,false);
});

test('open menus keep navigation visible and closing waits for fresh scrolling',()=>{
  const track=createNavigationScrollState({threshold:120,buffer:12});
  assert.equal(track(300).hidden,true);
  assert.equal(track(301,{pinned:true}).hidden,false);
  assert.equal(track(330,{pinned:true}).hidden,false);
  assert.equal(track(330).hidden,false,'Closing a pinned menu must not hide the header without scrolling');
  assert.equal(track(335).hidden,false);
  assert.equal(track(342).hidden,true);
});

test('top-of-page bounce and history resets restore a visible navigation state',()=>{
  const track=createNavigationScrollState({threshold:120,buffer:12});
  assert.equal(track(500).hidden,true);
  assert.deepEqual(track(-18),{hidden:false,y:0},'Negative mobile bounce positions are clamped');
  assert.equal(track(500).hidden,true);
  assert.equal(track(500,{reset:true}).hidden,false,'History restoration starts with navigation available');
  assert.equal(track(504).hidden,false);
  assert.equal(track(512).hidden,true,'The normal direction buffer resumes after reset');
});
