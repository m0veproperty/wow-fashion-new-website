import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {renderContentPages,contentPageIds,journalArticles} from '../scripts/core-content.mjs';
import {convertMeasurement,normalizeText,matchesQuery,prepareEnquiry,normalizePreference,readPreference,CONTENT_STORAGE} from '../public/core-content.js';
import {corePages} from '../portal/public/core-pages.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const pages=renderContentPages();

test('content renderer covers the assigned inventory and two additional complete stories',()=>{
  assert.equal(pages.length,24);
  assert.equal(new Set(pages.map(page=>page.path)).size,pages.length);
  assert.equal(new Set(pages.map(page=>page.id)).size,pages.length);
  for(const id of contentPageIds){
    const page=pages.find(page=>page.id===id);
    assert.ok(page,id);
    const inventory=corePages.find(page=>page.id===id);
    assert.ok(inventory,id+' has an inventory record');
    if(!inventory.path.includes('{'))assert.equal(page.path,inventory.path);
    assert.ok(page.body.length>1000,id+' is a complete page');
    assert.equal((page.body.match(/<h1[ >]/g)||[]).length,1,id+' has one main heading');
  }
  assert.equal(pages.filter(page=>page.path.startsWith('/journal/')&&page.path!=='/journal/').length,3);
});

test('internal routes, on-page anchors and reused assets resolve',()=>{
  const routes=new Set(['/',...corePages.filter(page=>!page.path.includes('{')).map(page=>page.path),...pages.map(page=>page.path)]);
  for(const slug of ['blouses','cardigans','coats-and-jackets','dresses','pants','skirts','sweaters']){
    routes.add('/'+slug+'/');
    const source=slug==='blouses'?'collections':slug==='coats-and-jackets'?'outerwear':slug;
    const data=JSON.parse(readFileSync(root+'data/'+source+'.json','utf8'));
    for(const collection of (Array.isArray(data)?data:data.collections||[]))routes.add('/'+slug+'/'+collection.slug+'/');
  }
  for(const page of pages){
    const ids=new Set([...page.body.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));
    for(const [,href] of page.body.matchAll(/\bhref="([^"]+)"/g)){
      if(href.startsWith('#'))assert.ok(ids.has(href.slice(1)),page.path+' '+href);
      else if(href.startsWith('/'))assert.ok(routes.has(href.split(/[?#]/)[0]),page.path+' links to '+href);
      else assert.match(href,/^https:\/\/wowfashion\.com\//);
    }
    for(const [,src] of page.body.matchAll(/\bsrc="([^"]+)"/g))assert.ok(existsSync(root+'public'+src),page.path+' image '+src);
    for(const src of [...page.styles,...page.scripts])assert.ok(existsSync(root+'public'+src),src);
  }
});

test('unfinished business policies and service connections expose dependencies',()=>{
  for(const id of ['core-return-policy','core-warranty','core-cancel-order','core-delivery','core-sourcing','core-privacy','core-cookies','core-terms','core-affiliate','core-editorial']){
    const page=pages.find(page=>page.id===id);
    assert.equal(page.status,'Policy review required',id);
    assert.ok(page.dependencies.length>0,id);
    assert.match(page.body,/preview|under review|for review/i,id);
  }
  for(const id of ['core-contact','core-payments'])assert.equal(pages.find(page=>page.id===id).status,'Integration required');
});

test('measurement conversion handles boundaries and rejects invalid measurements',()=>{
  assert.equal(convertMeasurement(25.4,'cm','in'),10);
  assert.equal(convertMeasurement(10,'in','cm'),25.4);
  assert.equal(convertMeasurement(300,'cm','in'),118.1);
  assert.equal(convertMeasurement('42.0','cm','cm'),42);
  for(const value of ['',null,undefined,false,-10,0,Infinity,NaN,301,'words'])assert.equal(convertMeasurement(value),null,String(value));
  assert.equal(convertMeasurement(119,'in','cm'),null);
  assert.equal(convertMeasurement(10,'yards','cm'),null);
});

test('help matching uses every query word, ignoring punctuation and accents',()=>{
  assert.equal(normalizeText('Favourites & café'), 'favourites cafe');
  assert.ok(matchesQuery('Delivery: tracking the parcel','parcel delivery'));
  assert.ok(matchesQuery('Sizing and fit',''));
  assert.ok(!matchesQuery('Sizing and fit','delivery sizing'));
});

test('enquiry composition is plain text and includes only supplied fields',()=>{
  const result=prepareEnquiry({topic:'return',name:'  Ava  ',reference:'ORDER-123',message:'Please explain the return process.'});
  assert.ok(result.startsWith('WOW Fashion enquiry: Return or exchange'));
  assert.ok(result.includes('Name: Ava'));
  assert.ok(result.includes('ORDER-123'));
  assert.ok(!result.includes('Reply email:'));
  const untrusted=prepareEnquiry({topic:'<bad>',message:'<script>alert(1)</script>'});
  assert.ok(untrusted.includes('Something else'));
  assert.ok(untrusted.endsWith('<script>alert(1)</script>'));
  const script=readFileSync(root+'public/core-content.js','utf8');
  assert.match(script,/draft\.value=prepareEnquiry/);
  assert.ok(!script.includes('innerHTML'));
});

test('preference parser never treats unknown or permissive data as consent',()=>{
  const valid={version:1,necessary:true,optional:false,savedAt:'2026-11-08T12:00:00Z'};
  assert.deepEqual(normalizePreference(valid),{...valid,savedAt:'2026-11-08T12:00:00.000Z'});
  for(const value of [null,{}, {...valid,optional:true},{...valid,version:2},{...valid,savedAt:'bad-date'}])assert.equal(normalizePreference(value),null);
  assert.deepEqual(readPreference({getItem:()=>JSON.stringify(valid)}),{available:true,preference:normalizePreference(valid)});
  assert.deepEqual(readPreference({getItem:()=>null}),{available:true,preference:null});
  assert.deepEqual(readPreference({getItem:()=>'{broken'}),{available:true,preference:null});
  assert.deepEqual(readPreference({getItem(){throw new Error('blocked');}}),{available:false,preference:null});
  assert.equal(CONTENT_STORAGE.preferences,'wow-cookie-preferences-v1');
});

test('journal has complete original story bodies and an explicit house byline',()=>{
  for(const article of journalArticles){
    assert.ok(article.sections.length>=4);
    assert.ok(article.sections.map(section=>section.body).join(' ').split(/\s+/).length>=250);
    const page=pages.find(page=>page.id===article.id);
    assert.match(page.body,/WOW Fashion editorial/);
    assert.match(page.body,/datetime="2026-11-08"/);
  }
  assert.match(pages.find(page=>page.id==='core-author').body,/house byline/);
});
