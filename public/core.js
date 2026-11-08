const key='wow-homepage-saved-v1';
let catalogue;
let saved=[];
let storageAvailable=true;
let toastTimer;
document.documentElement.classList.add('js');

function parseIds(raw){try{const value=JSON.parse(raw);return Array.isArray(value)?[...new Set(value.filter(id=>typeof id==='string'&&/^[a-z0-9-]{1,100}$/.test(id)))]:[];}catch{return [];}}
function readIds(){if(!storageAvailable)return saved;try{return parseIds(localStorage.getItem(key));}catch{storageAvailable=false;return saved;}}
function sanitize(ids){if(!catalogue)return ids;const aliases=catalogue.idAliases||{};const valid=new Set(catalogue.products.map(p=>p.id));return [...new Set(ids.map(id=>aliases[id]||id).filter(id=>valid.has(id)))];}
function updateButtons(){
  document.querySelectorAll('.core-save-count,[data-wishlist-count]').forEach(node=>{node.textContent=saved.length?String(saved.length):'';});
  document.querySelectorAll('[data-save]').forEach(button=>{
    const id=catalogue?.idAliases?.[button.dataset.save]||button.dataset.save;
    const active=saved.includes(id);button.setAttribute('aria-pressed',String(active));
    const name=catalogue?.products.find(p=>p.id===id)?.name;
    if(name&&!button.hasAttribute('data-save-label-static'))button.setAttribute('aria-label',`${active?'Remove':'Save'} ${name}${active?' from your wishlist':''}`);
  });
  document.querySelectorAll('[data-storage-notice]').forEach(node=>{node.hidden=storageAvailable;});
}
function publish(){updateButtons();window.dispatchEvent(new CustomEvent('wow:saved',{detail:{ids:[...saved],storageAvailable}}));}
function toast(message){const node=document.getElementById('core-toast');if(!node)return;clearTimeout(toastTimer);node.textContent=message;node.hidden=false;toastTimer=setTimeout(()=>{node.hidden=true;},3000);}
saved=readIds();updateButtons();
const catalogueReady=fetch('/data/shop-catalog.json').then(response=>{if(!response.ok)throw new Error('Catalogue unavailable');return response.json();}).then(data=>{catalogue=data;saved=sanitize(readIds());publish();return data;}).catch(()=>null);
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-save]');if(!button)return;
  event.preventDefault();await catalogueReady;
  if(!catalogue){toast('Your wishlist could not load. Please try again.');return;}
  const id=catalogue.idAliases?.[button.dataset.save]||button.dataset.save;
  const product=catalogue.products.find(p=>p.id===id);if(!product)return;
  saved=sanitize(readIds());const removing=saved.includes(id);saved=removing?saved.filter(item=>item!==id):[id,...saved];
  try{localStorage.setItem(key,JSON.stringify(saved));storageAvailable=true;}catch{storageAvailable=false;}
  publish();toast(removing?'Removed from your wishlist.':storageAvailable?'Saved to your wishlist.':'Saved on this page only. Browser storage is unavailable.');
});
window.addEventListener('storage',event=>{if(event.key===key||event.key===null){saved=sanitize(readIds());publish();}});
window.addEventListener('pageshow',()=>{saved=sanitize(readIds());publish();});
window.addEventListener('wow:catalog-rendered',updateButtons);
window.addEventListener('wow:request-saved',event=>{saved=event?.detail?.clear?[]:sanitize(readIds());publish();});

for(const trigger of document.querySelectorAll('[data-dialog-open]'))trigger.addEventListener('click',()=>{
  const dialog=document.getElementById(trigger.dataset.dialogOpen);if(!dialog)return;dialog.showModal();document.body.classList.add('dialog-open');
});
for(const dialog of document.querySelectorAll('dialog')){
  dialog.querySelectorAll('[data-dialog-close]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
  dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('dialog-open');});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
}
