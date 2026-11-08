const PAGE_SIZE = 24;
const WISHLIST_KEY = 'wow-homepage-saved-v1';
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const arrow = '<span aria-hidden="true">↗</span>';

export function normalizeQuery(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').replace(/\bt\s+shirts?\b/g, 'tshirt').replace(/\btrousers?\b/g, 'pants').replace(/\bjumpers?\b/g, 'sweater').replace(/\s+/g, ' ').trim();
}

function scoreMatch(name, keywords, query) {
  const normalizedName = normalizeQuery(name);
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) return 0;
  const text = normalizedName + ' ' + normalizeQuery(keywords);
  if (!normalizedQuery.split(' ').every(word => text.includes(word))) return -1;
  return normalizedName === normalizedQuery ? 0 : normalizedName.startsWith(normalizedQuery) ? 1 : normalizedName.includes(normalizedQuery) ? 2 : 3;
}

function productKeywords(product, collectionsByKey) {
  return [product.category, ...(product.sourceCategories || []), ...(product.collectionKeys || []).map(key => collectionsByKey.get(key)?.name || '')].join(' ');
}

export function parseBrowseState(search, catalog) {
  const params = new URLSearchParams(search);
  const state = {q:(params.get('q') || '').trim().slice(0,120),department:params.get('department') || '',collection:params.get('collection') || '',sort:params.get('sort') || 'edit',page:Number(params.get('page') || 1)};
  if (!catalog.departments.some(department => department.id === state.department)) state.department = '';
  const collection = catalog.collections.find(collection => collection.key === state.collection);
  if (!collection) state.collection = '';
  else if (collection.department) state.department = collection.department;
  if (!['edit','az','za'].includes(state.sort)) state.sort = 'edit';
  if (!Number.isSafeInteger(state.page) || state.page < 1) state.page = 1;
  return state;
}

export function browseCatalog(catalog, state, pageSize = PAGE_SIZE) {
  const size = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : PAGE_SIZE;
  const collectionsByKey = new Map(catalog.collections.map(collection => [collection.key, collection]));
  const collection = collectionsByKey.get(state.collection);
  const allowed = collection ? new Set(collection.productIds) : null;
  const matches = catalog.products.map(product => ({product,score:scoreMatch(product.name,productKeywords(product,collectionsByKey),state.q)})).filter(({product,score}) => score >= 0 && (!state.department || product.departments.includes(state.department)) && (!allowed || allowed.has(product.id)));
  matches.sort((a,b) => state.sort === 'az' ? a.product.name.localeCompare(b.product.name,'en') : state.sort === 'za' ? b.product.name.localeCompare(a.product.name,'en') : a.score - b.score || a.product.rank - b.product.rank);
  const total = matches.length;
  const pages = Math.ceil(total / size);
  const page = Math.max(1,Math.min(Number.isSafeInteger(state.page) ? state.page : 1, pages || 1));
  return {items:matches.slice((page-1)*size,page*size).map(item => item.product),total,pages,page,pageSize:size};
}

export function getSearchResults(catalog, query, {department='',guides=[]} = {}) {
  const q = normalizeQuery(query);
  if (!q) return {products:[],collections:[],guides:[],total:0};
  const collectionMap = new Map(catalog.collections.map(collection => [collection.key,collection]));
  const rank = items => items.filter(item => item.score >= 0).sort((a,b) => a.score - b.score || a.order - b.order).map(item => item.value);
  const products = rank(catalog.products.filter(product => !department || product.departments.includes(department)).map((product,order) => ({value:product,order,score:scoreMatch(product.name,productKeywords(product,collectionMap),q)})));
  const collections = rank(catalog.collections.filter(collection => !department || collection.department === department).map((collection,order) => ({value:collection,order,score:scoreMatch(collection.name,[...(collection.aliases || []),collection.description].join(' '),q)})));
  const guideResults = department ? [] : rank(guides.map((guide,order) => ({value:guide,order,score:scoreMatch(guide.name,guide.description,q)})));
  return {products,collections,guides:guideResults,total:products.length+collections.length+guideResults.length};
}

function editDistance(a,b) {
  if (Math.abs(a.length-b.length)>2) return 3;
  let previous = Array.from({length:b.length+1},(_,index)=>index);
  for (let i=1;i<=a.length;i++) {
    const row = [i];
    for (let j=1;j<=b.length;j++) row[j] = Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+Number(a[i-1]!==b[j-1]));
    previous = row;
  }
  return previous[b.length];
}

export function suggestQuery(catalog, query) {
  const words = normalizeQuery(query).split(' ').filter(Boolean);
  if (!words.length || words.length > 5) return '';
  const vocabulary = new Map();
  for (const entry of [...catalog.collections,...catalog.products]) for (const word of normalizeQuery(entry.name).split(' ')) if (word.length >= 4) vocabulary.set(word,(vocabulary.get(word) || 0)+1);
  let changed = false;
  const suggestion = words.map(word => {
    if (word.length < 4 || vocabulary.has(word)) return word;
    const choices = [...vocabulary].map(([value,frequency]) => ({value,frequency,distance:editDistance(word,value)})).filter(candidate => candidate.distance <= (word.length < 6 ? 1 : 2)).sort((a,b)=>a.distance-b.distance || b.frequency-a.frequency || a.value.localeCompare(b.value));
    if (!choices.length) return word;
    changed = true;
    return choices[0].value;
  }).join(' ');
  return changed && getSearchResults(catalog,suggestion).total ? suggestion : '';
}

export function validWishlistIds(raw, catalog) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = new Set(catalog.products.map(product => product.id));
    return [...new Set(parsed.filter(id=>typeof id==='string').map(id=>catalog.idAliases?.[id]||id).filter(id=>valid.has(id)))];
  } catch { return []; }
}

function productCard(product, removable=false) {
  return `<article class="product-card" data-product-id="${escape(product.id)}"><div class="product-image"><a href="${escape(product.href)}" tabindex="-1" aria-hidden="true"><img src="${escape(product.image)}" alt="${escape(product.name)}" width="800" height="800" loading="lazy" decoding="async"></a><button class="product-save" type="button" data-save="${escape(product.id)}" aria-label="Save ${escape(product.name)}" aria-pressed="false"><svg aria-hidden="true" viewBox="0 0 24 24"><use href="#core-icon-heart"></use></svg></button></div><p class="product-category">${escape(product.category)}</p><h3><a href="${escape(product.href)}">${escape(product.name)}</a></h3><a class="product-link" href="${escape(product.href)}">View piece ${arrow}</a>${removable?`<button type="button" class="wishlist-remove" data-save="${escape(product.id)}" data-save-label-static aria-label="Remove ${escape(product.name)} from your wishlist">Remove from wishlist</button>`:''}</article>`;
}

function collectionCard(collection) {
  return `<a class="search-collection-card" href="${escape(collection.path)}">${collection.image?`<span class="search-collection-photo"><img src="${escape(collection.image)}" alt="" width="360" height="220" style="object-position:${escape(collection.imagePosition||'center')}" loading="lazy"></span>`:'<span class="search-collection-plain" aria-hidden="true">WOW</span>'}<span class="search-collection-label"><strong>${escape(collection.name)}</strong>${arrow}</span><small>${collection.count} ${collection.count===1?'piece':'pieces'} in this catalogue</small></a>`;
}

function guideCard(guide) {
  return `<a class="search-guide-card" href="${escape(guide.path)}"><span><strong>${escape(guide.name)}</strong><small>${escape(guide.description)}</small></span>${arrow}</a>`;
}

function browseUrl(state, path='/shop/', hash='') {
  const params = new URLSearchParams();
  for (const name of ['q','department','collection']) if (state[name]) params.set(name,state[name]);
  if (state.sort && state.sort!=='edit') params.set('sort',state.sort);
  if (state.type && state.type!=='all') params.set('type',state.type);
  if (state.page>1) params.set('page',state.page);
  return path + (params.size?'?'+params.toString():'') + hash;
}

function pagination(result, state, path) {
  if (result.pages < 2) return '';
  const numbers = [...new Set([1,result.page-1,result.page,result.page+1,result.pages].filter(number=>number>=1&&number<=result.pages))].sort((a,b)=>a-b);
  const link = (number,label,extra='') => `<a href="${escape(browseUrl({...state,page:number},path,path==='/shop/'?'#browse':'#catalog-search-results'))}" data-page-number="${number}" ${extra}>${label}</a>`;
  let last = 0;
  const middle = numbers.map(number => {
    const gap = last && number-last>1 ? '<span class="pagination-gap" aria-hidden="true">…</span>' : '';
    last = number;
    return gap + link(number,String(number),`aria-label="Page ${number}"${number===result.page?' aria-current="page"':''}`);
  }).join('');
  return `${result.page>1?link(result.page-1,'← Previous','class="pagination-direction"'):'<span class="pagination-direction" aria-disabled="true">← Previous</span>'}<div>${middle}</div>${result.page<result.pages?link(result.page+1,'Next →','class="pagination-direction"'):'<span class="pagination-direction" aria-disabled="true">Next →</span>'}`;
}

function announceRendered() { window.dispatchEvent(new CustomEvent('wow:catalog-rendered')); }
function goToResults(id) { document.getElementById(id)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'}); }

async function initDiscovery() {
  const root = document.querySelector('[data-discovery-page]');
  if (!root) return;
  const page = root.dataset.discoveryPage;
  const loadStatus = document.getElementById('discovery-load-status');
  let catalog;
  let shopState;
  let searchState;
  let wishlistIds = [];
  let storageAvailable = true;
  let searchTimer;
  const guides = JSON.parse(document.getElementById('discovery-guide-data')?.textContent || '[]');
  const shopForm = document.getElementById('shop-filter-form');
  const searchForm = document.getElementById('catalog-search-form');
  const initialSearchContent = document.getElementById('catalog-search-results')?.innerHTML || '';

  function updateHistory(state, replace=false) {
    const url = browseUrl(state,page==='search'?'/search/':'/shop/');
    if (location.pathname+location.search!==url) history[replace?'replaceState':'pushState']({},'',url);
  }

  function syncCollections(department, chosen) {
    const select = shopForm.elements.collection;
    let html = '<option value="">Every collection</option>';
    const groups = department ? catalog.departments.filter(item=>item.id===department) : catalog.departments;
    for (const group of groups) html += `<optgroup label="${escape(group.name)}">${group.children.map(collection=>`<option value="${escape(collection.key)}">${escape(collection.name)} (${collection.count})</option>`).join('')}</optgroup>`;
    if (!department) for (const group of catalog.extraGroups) html += `<optgroup label="${escape(group.name)}"><option value="${escape(group.key)}">All ${escape(group.name.toLowerCase())} (${group.count})</option>${group.children.map(collection=>`<option value="${escape(collection.key)}">${escape(collection.name)} (${collection.count})</option>`).join('')}</optgroup>`;
    // Root collection filters from a shared URL remain a valid choice.
    const rootCollection = catalog.collections.find(collection=>collection.key===chosen&&collection.isParent&&collection.department);
    if (rootCollection) html += `<option value="${escape(rootCollection.key)}">All ${escape(rootCollection.name.toLowerCase())}</option>`;
    select.innerHTML = html;
    select.value = chosen;
  }

  function renderShop({sync=true}={}) {
    const result = browseCatalog(catalog,shopState);
    shopState.page = result.page;
    if (sync) {
      shopForm.elements.q.value = shopState.q;
      shopForm.elements.department.value = shopState.department;
      shopForm.elements.sort.value = shopState.sort;
      syncCollections(shopState.department,shopState.collection);
    }
    const first = result.total ? (result.page-1)*result.pageSize+1 : 0;
    const last = Math.min(result.page*result.pageSize,result.total);
    document.getElementById('shop-result-count').textContent = result.total ? `${first}-${last} of ${result.total} pieces` : 'No pieces match these filters.';
    const labels = [['q',shopState.q?`“${shopState.q}”`:''],['department',catalog.departments.find(item=>item.id===shopState.department)?.name],['collection',catalog.collections.find(item=>item.key===shopState.collection)?.name]].filter(([,label])=>label);
    document.getElementById('shop-active-filters').innerHTML = labels.map(([name,label])=>`<button type="button" data-clear-filter="${name}" aria-label="Remove ${escape(label)} filter">${escape(label)} <span aria-hidden="true">×</span></button>`).join('');
    const grid = document.getElementById('shop-product-grid');
    grid.classList.toggle('discovery-empty-grid',!result.total);
    if (result.total) grid.innerHTML = result.items.map(product=>productCard(product)).join('');
    else {
      const suggestion = shopState.q ? suggestQuery(catalog,shopState.q) : '';
      grid.innerHTML = `<div class="empty-state"><h2>Let’s try a<br><em>different starting point.</em></h2><p>${shopState.collection?'No matching pieces are currently included in this catalogue selection. Try another collection or remove a filter.':'Try a simpler search, choose another department or explore the full edit.'}</p>${suggestion?`<button type="button" class="text-link discovery-suggestion" data-suggest="${escape(suggestion)}">Did you mean “${escape(suggestion)}”? →</button>`:''}<button class="button" type="button" data-reset-discovery>Explore all pieces ${arrow}</button></div>`;
    }
    document.getElementById('shop-pagination').innerHTML = pagination(result,shopState,'/shop/');
    document.querySelectorAll('[data-browse-department]').forEach(link=>{
      if (link.dataset.browseDepartment===shopState.department) link.setAttribute('aria-current','true');
      else link.removeAttribute('aria-current');
    });
    announceRendered();
  }

  function readSearchState() {
    const params = new URLSearchParams(location.search);
    const type = params.get('type') || 'all';
    const department = params.get('department') || '';
    return {q:(params.get('q')||'').trim().slice(0,120),type:['all','products','collections','guides'].includes(type)?type:'all',department:catalog.departments.some(item=>item.id===department)?department:'',page:Math.max(1,Number.parseInt(params.get('page'),10)||1)};
  }

  function searchGroup(title,type,items,render,limit) {
    if (!items.length) return '';
    const content = items.slice(0,limit).map(render).join('');
    const className = type==='products'?'product-grid':type==='collections'?'search-collection-grid':'search-guide-grid';
    return `<section class="search-result-section"><div class="search-result-heading"><h2>${title} <small>${items.length}</small></h2>${items.length>limit?`<a class="text-link" href="${escape(browseUrl({...searchState,type,page:1},'/search/'))}" data-search-type="${type}">See all ${items.length} ${arrow}</a>`:''}</div><div class="${className}">${content}</div></section>`;
  }

  function renderSearch({sync=true}={}) {
    if (sync) {
      searchForm.elements.q.value = searchState.q;
      document.getElementById('search-department').value = searchState.department;
    }
    const output = document.getElementById('catalog-search-results');
    const results = getSearchResults(catalog,searchState.q,{department:searchState.department,guides});
    const nav = document.getElementById('search-type-nav');
    nav.hidden = !searchState.q;
    document.getElementById('search-department-field').hidden = !searchState.q || searchState.type==='guides';
    const counts = {all:results.total,products:results.products.length,collections:results.collections.length,guides:results.guides.length};
    const labels = {all:'All results',products:'Pieces',collections:'Collections',guides:'Guides & help'};
    nav.querySelectorAll('[data-search-type]').forEach(link=>{
      const type = link.dataset.searchType;
      link.textContent = `${labels[type]} (${counts[type]})`;
      link.href = browseUrl({...searchState,type,page:1},'/search/');
      if (type===searchState.type) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    });
    const count = counts[searchState.type];
    document.getElementById('search-result-count').textContent = searchState.q ? `${count} ${count===1?'result':'results'} for “${searchState.q}”` : 'Find something that feels like you.';
    document.getElementById('search-pagination').innerHTML = '';
    if (!searchState.q) output.innerHTML = initialSearchContent;
    else if (!count) {
      const suggestion = suggestQuery(catalog,searchState.q);
      output.innerHTML = `<div class="empty-state search-empty"><h2>Nothing quite<br><em>matches yet.</em></h2><p>Try a fabric, a simpler style name or a different department. You can also browse every collection in Shop all.</p>${suggestion?`<button class="text-link discovery-suggestion" type="button" data-suggest="${escape(suggestion)}">Did you mean “${escape(suggestion)}”? →</button>`:''}<a class="button" href="/shop/">Explore the wardrobe ${arrow}</a>${searchState.department?'<button type="button" class="discovery-clear" data-clear-search-department>Search all departments</button>':''}</div>`;
    } else if (searchState.type==='all') {
      output.innerHTML = searchGroup('Collections','collections',results.collections,collectionCard,6) + searchGroup('Pieces','products',results.products,product=>productCard(product),8) + searchGroup('Guides & help','guides',results.guides,guideCard,6);
    } else {
      const items = results[searchState.type];
      const pages = Math.ceil(items.length/PAGE_SIZE);
      searchState.page = Math.max(1,Math.min(searchState.page,pages));
      const subset = items.slice((searchState.page-1)*PAGE_SIZE,searchState.page*PAGE_SIZE);
      const renderer = searchState.type==='products'?product=>productCard(product):searchState.type==='collections'?collectionCard:guideCard;
      const className = searchState.type==='products'?'product-grid':searchState.type==='collections'?'search-collection-grid':'search-guide-grid';
      output.innerHTML = `<div class="${className}">${subset.map(renderer).join('')}</div>`;
      document.getElementById('search-pagination').innerHTML = pagination({page:searchState.page,pages},searchState,'/search/');
    }
    announceRendered();
  }

  function renderWishlist() {
    const list = wishlistIds.map(id=>catalog.products.find(product=>product.id===id)).filter(Boolean);
    document.getElementById('wishlist-result-count').textContent = list.length ? `${list.length} saved ${list.length===1?'piece':'pieces'}` : 'Your next favourite is waiting.';
    const output = document.getElementById('wishlist-content');
    output.innerHTML = list.length ? `<div class="product-grid wishlist-grid">${list.map(product=>productCard(product,true)).join('')}</div>` : `<div class="empty-state wishlist-empty"><h2>Something will<br><em>catch your eye.</em></h2><p>Tap the heart beside a piece to save it here. Build a little collection of things you love, then come back when the mood is right.</p><a class="button" href="/shop/">Explore the wardrobe ${arrow}</a></div>`;
    document.querySelectorAll('[data-storage-notice]').forEach(node=>node.hidden=storageAvailable);
    announceRendered();
  }

  function retryBlock() {
    loadStatus.innerHTML = `The catalogue could not load. <button type="button" data-retry-discovery>Try again</button> <a href="/shop/#wardrobe-directory">Browse collections</a>`;
    loadStatus.classList.add('discovery-load-error');
    loadStatus.hidden = false;
    root.removeAttribute('aria-busy');
  }

  async function load() {
    root.setAttribute('aria-busy','true');
    loadStatus.textContent = 'Loading the catalogue…';
    loadStatus.classList.remove('discovery-load-error');
    loadStatus.hidden = false;
    try {
      const response = await fetch('/data/shop-catalog.json');
      if (!response.ok) throw new Error('Catalogue request failed');
      const value = await response.json();
      if (!Array.isArray(value.products) || !Array.isArray(value.collections) || !Array.isArray(value.departments)) throw new Error('Catalogue data is incomplete');
      catalog = value;
      loadStatus.hidden = true;
      root.removeAttribute('aria-busy');
      root.classList.add('discovery-ready');
      if (page==='shop') {shopState=parseBrowseState(location.search,catalog);renderShop();}
      if (page==='search') {searchState=readSearchState();renderSearch();}
      if (page==='wishlist') {
        try {wishlistIds=validWishlistIds(localStorage.getItem(WISHLIST_KEY),catalog);} catch {storageAvailable=false;}
        renderWishlist();
        window.dispatchEvent(new CustomEvent('wow:request-saved'));
      }
    } catch {retryBlock();}
  }

  if (shopForm) {
    const apply = (replace=false) => {
      if (!catalog) return;
      const values = Object.fromEntries(new FormData(shopForm));
      shopState = parseBrowseState(new URLSearchParams({...values,page:'1'}),catalog);
      updateHistory(shopState,replace);
      renderShop({sync:!replace});
    };
    shopForm.addEventListener('submit',event=>{event.preventDefault();clearTimeout(searchTimer);apply();goToResults('browse');});
    shopForm.elements.q.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>apply(true),180);});
    shopForm.elements.department.addEventListener('change',()=>{shopForm.elements.collection.value='';apply();});
    shopForm.elements.collection.addEventListener('change',()=>apply());
    shopForm.elements.sort.addEventListener('change',()=>apply());
    document.getElementById('shop-filter-toggle').addEventListener('click',event=>{
      const button=event.currentTarget;
      const expanded=button.getAttribute('aria-expanded')!=='true';
      button.setAttribute('aria-expanded',String(expanded));
      shopForm.classList.toggle('is-expanded',expanded);
    });
    document.getElementById('shop-clear').addEventListener('click',()=>{
      if (!catalog) return;
      clearTimeout(searchTimer);shopState=parseBrowseState('',catalog);updateHistory(shopState);renderShop();
    });
  }
  if (searchForm) {
    const apply=(replace=false)=>{
      if (!catalog) return;
      searchState={...searchState,q:searchForm.elements.q.value.trim().slice(0,120),page:1};
      updateHistory(searchState,replace);renderSearch({sync:!replace});
    };
    searchForm.addEventListener('submit',event=>{event.preventDefault();clearTimeout(searchTimer);apply();});
    searchForm.elements.q.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>apply(true),180);});
    document.getElementById('search-department').addEventListener('change',event=>{
      if (!catalog) return;
      searchState={...searchState,department:event.target.value,page:1};updateHistory(searchState);renderSearch();
    });
  }
  document.addEventListener('click',event=>{
    const retry=event.target.closest('[data-retry-discovery]');
    if (retry) {load();return;}
    if (!catalog) return;
    const department=event.target.closest('[data-browse-department]');
    if (department && page==='shop') {
      event.preventDefault();clearTimeout(searchTimer);shopState=parseBrowseState(new URLSearchParams({department:department.dataset.browseDepartment}),catalog);updateHistory(shopState);renderShop();goToResults('browse');return;
    }
    const paging=event.target.closest('[data-page-number]');
    if (paging) {
      event.preventDefault();clearTimeout(searchTimer);
      if (page==='shop') {shopState.page=Number(paging.dataset.pageNumber);updateHistory(shopState);renderShop();goToResults('browse');}
      if (page==='search') {searchState.page=Number(paging.dataset.pageNumber);updateHistory(searchState);renderSearch();goToResults('catalog-search-results');}
      return;
    }
    const filter=event.target.closest('[data-clear-filter]');
    if (filter && page==='shop') {
      clearTimeout(searchTimer);shopState[filter.dataset.clearFilter]='';if(filter.dataset.clearFilter==='department')shopState.collection='';shopState.page=1;updateHistory(shopState);renderShop();return;
    }
    if (event.target.closest('[data-reset-discovery]') && page==='shop') {shopState=parseBrowseState('',catalog);updateHistory(shopState);renderShop();return;}
    const type=event.target.closest('[data-search-type]');
    if (type && page==='search') {event.preventDefault();searchState={...searchState,type:type.dataset.searchType,page:1};if(searchState.type==='guides')searchState.department='';updateHistory(searchState);renderSearch();return;}
    const suggestion=event.target.closest('[data-suggest]');
    if (suggestion) {
      if(page==='shop'){shopState={...shopState,q:suggestion.dataset.suggest,page:1};updateHistory(shopState);renderShop();}
      if(page==='search'){searchState={...searchState,q:suggestion.dataset.suggest,type:'all',page:1};updateHistory(searchState);renderSearch();}
      return;
    }
    if (event.target.closest('[data-clear-search-department]') && page==='search') {searchState={...searchState,department:'',page:1};updateHistory(searchState);renderSearch();}
  });
  window.addEventListener('popstate',()=>{
    if (!catalog) return;
    clearTimeout(searchTimer);
    if(page==='shop'){shopState=parseBrowseState(location.search,catalog);renderShop();}
    if(page==='search'){searchState=readSearchState();renderSearch();}
  });
  window.addEventListener('wow:saved',event=>{
    if(page!=='wishlist')return;
    const previous=wishlistIds;
    const activeId=document.activeElement?.closest('[data-save]')?.dataset.save;
    const activeIndex=previous.indexOf(activeId);
    wishlistIds=event.detail?.ids || [];
    storageAvailable=event.detail?.storageAvailable!==false;
    if(catalog){
      renderWishlist();
      if(activeId&&!wishlistIds.includes(activeId)){
        const cards=[...document.querySelectorAll('#wishlist-content .product-card')];
        (cards[Math.max(0,Math.min(activeIndex,cards.length-1))]?.querySelector('.wishlist-remove')||document.querySelector('#wishlist-content a'))?.focus({preventScroll:true});
      }
    }
  });
  load();
}

if (typeof document !== 'undefined') initDiscovery();
