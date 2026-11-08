import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const script=await readFile(new URL('../public/core.js',import.meta.url),'utf8');
async function controller({stored=null,writeBlocked=false}={}){
  const clickHandlers=[],windowHandlers={},published=[];
  const catalog={products:[{id:'blouses-31',name:'Cotton blouse'},{id:'skirts-34',name:'Pleated skirt'}],idAliases:{'blouses-99':'blouses-31'}};
  const storage={value:stored,getItem(){return this.value;},setItem(key,value){if(writeBlocked)throw new Error('Quota unavailable');this.value=value;}};
  const document={documentElement:{classList:{add(){}}},querySelectorAll(){return [];},getElementById(){return null;},addEventListener(name,fn){if(name==='click')clickHandlers.push(fn);}};
  const window={addEventListener(name,fn){windowHandlers[name]=fn;},dispatchEvent(event){if(event.type==='wow:saved')published.push(event.detail);}};
  vm.runInNewContext(script,{document,window,localStorage:storage,fetch:async()=>({ok:true,json:async()=>catalog}),CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},setTimeout,clearTimeout});
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  await flush();
  return {storage,published,windowHandlers,click:async id=>{await clickHandlers[0]({target:{closest:()=>({dataset:{save:id}})},preventDefault(){}});await flush();}};
}

test('wishlist keeps all catalogue selections across page visits and canonicalises duplicate record IDs',async()=>{
  const first=await controller({stored:'["blouses-99","missing-id"]'});
  assert.deepEqual(Array.from(first.published.at(-1).ids),['blouses-31']);
  await first.click('skirts-34');
  assert.deepEqual(JSON.parse(first.storage.value),['skirts-34','blouses-31']);
  const next=await controller({stored:first.storage.value});
  assert.deepEqual(Array.from(next.published.at(-1).ids),['skirts-34','blouses-31']);
  await next.click('blouses-31');
  assert.deepEqual(JSON.parse(next.storage.value),['skirts-34']);
  next.storage.value=null;next.windowHandlers['wow:request-saved']();
  assert.deepEqual(Array.from(next.published.at(-1).ids),[]);
  next.storage.value='["blouses-31"]';next.windowHandlers.pageshow();
  assert.deepEqual(Array.from(next.published.at(-1).ids),['blouses-31'],'Back navigation refreshes the visible wishlist state');
});

test('wishlist retains multiple selections in memory when browser writes are blocked',async()=>{
  const state=await controller({writeBlocked:true});
  await state.click('blouses-31');
  await state.click('skirts-34');
  assert.deepEqual(Array.from(state.published.at(-1).ids),['skirts-34','blouses-31']);
  assert.equal(state.published.at(-1).storageAvailable,false);
  await state.click('blouses-31');
  assert.deepEqual(Array.from(state.published.at(-1).ids),['skirts-34']);
  state.windowHandlers['wow:request-saved']({detail:{clear:true}});
  assert.deepEqual(Array.from(state.published.at(-1).ids),[]);
});
