import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {corePages} from '../portal/public/core-pages.js';
import {corePageBuilds} from '../portal/public/data/core-page-builds.js';
import systemPage from '../api/system-page.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const manifest=JSON.parse(await read('dist/data/core-page-builds.json'));
const builtPath=route=>'dist'+route+(route.endsWith('/')?'index.html':'');

test('every portal core screen has one concrete built route and a public review link',async()=>{
  assert.equal(corePages.length,50);
  assert.equal(manifest.corePageCount,50);
  assert.deepEqual(Object.keys(manifest.pages).sort(),corePages.map(page=>page.id).sort());
  assert.deepEqual(corePageBuilds,manifest.pages);
  const paths=Object.values(manifest.pages).map(page=>page.path);
  assert.equal(new Set(paths).size,50);
  for(const page of Object.values(manifest.pages)){
    assert.ok(!/[{}]/.test(page.path),'Templates must have a concrete review example');
    assert.equal(page.url,manifest.site+page.path);
    assert.ok(Array.isArray(page.dependencies));
    assert.ok((await stat(new URL('../'+builtPath(page.path),import.meta.url))).isFile());
  }
});

test('all core page links, images, styles and scripts resolve, with valid landmarks and unique IDs',async()=>{
  const pages=[...Object.values(manifest.pages),...manifest.additionalPages];
  const checked=new Set();
  for(const page of pages){
    const html=await read(builtPath(page.path));
    assert.equal((html.match(/<h1\b/g)||[]).length,1,page.path+' must have one main heading');
    assert.equal((html.match(/<main\b/g)||[]).length,1,page.path+' must have one main landmark');
    const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);
    assert.equal(new Set(ids).size,ids.length,'Duplicate HTML ID on '+page.path);
    for(const match of html.matchAll(/(?:href|src|poster|data-src)="(\/[^"#]*)"/g)){
      const href=match[1];if(href.startsWith('//'))continue;
      const route=new URL(href,'https://wow.test').pathname;
      if(checked.has(route))continue;
      checked.add(route);
      assert.ok((await stat(new URL('../'+builtPath(route),import.meta.url))).isFile(),page.path+' references missing '+route);
    }
    for(const match of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(match[1]),page.path+' has a missing anchor '+match[1]);
    for(const match of html.matchAll(/data-dialog-open="([^"]+)"/g))assert.ok(ids.includes(match[1]),'Missing navigation dialog');
    if(page.path!=='/')assert.match(html,/<meta name="robots" content="noindex, nofollow">/);
  }
});

test('homepage and discovery pages use the same wishlist owner without the old eight-item write restriction',async()=>{
  const home=await read('dist/index.html');
  const homeScript=await read('dist/homepage.js');
  const coreScript=await read('dist/core.js');
  assert.match(home,/src="\/core.js"/);
  assert.match(home,/href="\/wishlist\/"/);
  assert.doesNotMatch(homeScript,/localStorage\.setItem|savedKey|toggleSaved/);
  assert.match(coreScript,/wow-homepage-saved-v1/);
  assert.match(coreScript,/catalogue\.products/);
  assert.match(coreScript,/wow:request-saved/);
});

test('system pages return real error status codes and cannot be cached as customer content',async()=>{
  for(const code of [404,503]){
    const response={headers:{},setHeader(name,value){this.headers[name]=value;},end(body){this.body=body;}};
    await systemPage({url:'/api/system-page?code='+code,method:'GET'},response);
    assert.equal(response.statusCode,code);
    assert.equal(response.headers['Cache-Control'],'no-store');
    assert.equal(response.headers['X-Robots-Tag'],'noindex, nofollow');
    assert.match(response.body,/class="core-header"/);
    assert.match(response.body,/<h1/);
    if(code===503)assert.equal(response.headers['Retry-After'],'120');
  }
  const config=JSON.parse(await read('vercel.json'));
  assert.ok(config.rewrites.some(rule=>rule.source==='/service-unavailable/'&&rule.destination.includes('code=503')));
  assert.ok(config.headers.some(rule=>rule.headers.some(header=>header.key==='X-Robots-Tag'&&header.value==='noindex, nofollow')));
  assert.match(await read('dist/404.html'),/data-core-page="core-404"/);
});
