const SHARED_KEY='wow-homepage-saved-v1';
const parse=value=>{try{const result=JSON.parse(value);return Array.isArray(result)?result:[];}catch{return [];}};
const unique=values=>[...new Set(values)];
const sourceKey=value=>{try{const url=new URL(value);return url.hostname.toLowerCase()+url.pathname.replace(/\/+$/,'');}catch{return '';}};

/** Keep an older page's numeric edit and dialog in sync with the full wishlist.
 * URL matching is intentional: the club-page numeric IDs are a different index.
 */
export async function createWishlistBridge({products,legacyKey,onChange,storage=globalThis.localStorage,eventTarget=globalThis.window,fetchCatalog=()=>fetch('/data/shop-catalog.json').then(response=>{if(!response.ok)throw new Error('Catalogue unavailable');return response.json();})}){
  const catalog=await fetchCatalog();
  if(!Array.isArray(catalog.products))throw new Error('Catalogue unavailable');
  const canonicalByUrl=new Map(catalog.products.map(product=>[sourceKey(product.sourceUrl||product.href),product.id]));
  const mapping=new Map(products.map(product=>[product.id,canonicalByUrl.get(sourceKey(product.url))]).filter(([,id])=>id));
  const known=new Set(products.map(product=>product.id));
  let storageAvailable=true,shared=[],legacy=[];
  const read=(key,fallback)=>{if(!storageAvailable)return fallback;try{return parse(storage.getItem(key));}catch{storageAvailable=false;return fallback;}};
  const canonicalize=ids=>unique(ids.filter(id=>typeof id==='string').map(id=>catalog.idAliases?.[id]||id));
  const write=(key,ids)=>{try{storage.setItem(key,JSON.stringify(ids));return true;}catch{storageAvailable=false;return false;}};
  const selected=()=>products.filter(product=>mapping.has(product.id)?shared.includes(mapping.get(product.id)):legacy.includes(product.id)).map(product=>product.id);
  const publish=()=>{
    onChange({ids:selected(),storageAvailable,unmappedIds:products.filter(product=>!mapping.has(product.id)).map(product=>product.id)});
    eventTarget?.dispatchEvent(new CustomEvent('wow:saved',{detail:{ids:[...shared],storageAvailable}}));
  };
  shared=canonicalize(read(SHARED_KEY,[]));
  legacy=read(legacyKey,[]).filter(id=>known.has(id));
  const migrated=unique([...shared,...legacy.filter(id=>mapping.has(id)).map(id=>mapping.get(id))]);
  if(legacy.some(id=>mapping.has(id))){
    shared=migrated;
    // Clear migrated IDs only after a successful shared write. This prevents
    // a later revisit from resurrecting items removed on the full wishlist.
    if(write(SHARED_KEY,shared)){legacy=legacy.filter(id=>!mapping.has(id));write(legacyKey,legacy);}
  }
  const refresh=()=>{shared=canonicalize(read(SHARED_KEY,shared));legacy=read(legacyKey,legacy).filter(id=>known.has(id));publish();};
  eventTarget?.addEventListener('storage',event=>{if(event.key===SHARED_KEY||event.key===legacyKey||event.key===null)refresh();});
  eventTarget?.addEventListener('pageshow',refresh);
  publish();
  return {
    mapping,
    toggle(id){
      if(!known.has(id))return {saved:false,storageAvailable,mapped:false};
      const canonical=mapping.get(id);
      if(canonical){
        shared=canonicalize(read(SHARED_KEY,shared));
        shared=shared.includes(canonical)?shared.filter(item=>item!==canonical):[canonical,...shared];
        write(SHARED_KEY,shared);
      }else{
        legacy=read(legacyKey,legacy).filter(item=>known.has(item));
        legacy=legacy.includes(id)?legacy.filter(item=>item!==id):[...legacy,id];
        write(legacyKey,legacy);
      }
      publish();
      return {saved:selected().includes(id),storageAvailable,mapped:!!canonical};
    },
    refresh
  };
}
