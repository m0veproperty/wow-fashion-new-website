import {resolveVariant,resolveImage,validSize} from './product-state.js';
const $=s=>document.querySelector(s),product=JSON.parse($('#product-data').textContent);
let variant=resolveVariant(product,new URL(location.href).searchParams.get('colour')),imageIndex=0,bag=[],returnFocus;
const money=new Intl.NumberFormat('en-GB',{style:'currency',currency:product.currency});
function renderGallery(announce=false){
 const img=resolveImage(variant,imageIndex),main=$('#product-image');
 main.src=img.src;main.alt=img.alt;$('#zoom-image').src=img.src;$('#zoom-image').alt=img.alt;
 $('#colour-name').textContent=variant.name;
 document.querySelectorAll('[name="colour"]').forEach(r=>r.checked=r.value===variant.id);
 document.querySelectorAll('[data-view]').forEach((button,i)=>{button.setAttribute('aria-pressed',String(i===imageIndex));const thumb=button.querySelector('img');thumb.src=variant.images[i].thumb;thumb.alt=variant.images[i].alt;});
 $('#image-position').textContent=String(imageIndex+1).padStart(2,'0')+' / '+String(variant.images.length).padStart(2,'0')+' · '+img.view[0].toUpperCase()+img.view.slice(1)+' view';
 $('#zoom-caption').textContent=product.name+' · '+variant.name+' · '+img.view+' view';
 if(announce)$('#product-status').textContent=variant.name+' selected. Showing '+img.view+' view.';
}
function changeImage(step){imageIndex=(imageIndex+step+variant.images.length)%variant.images.length;renderGallery(true);$('.zoom-scroll').scrollTop=0;}
function showDialog(id){returnFocus=document.activeElement;$('#'+id).showModal();}
function closeDialog(id){$('#'+id).close();returnFocus?.focus();}
document.querySelectorAll('dialog').forEach(d=>{d.addEventListener('cancel',()=>returnFocus?.focus());d.addEventListener('click',ev=>{if(ev.target===d){const r=d.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)closeDialog(d.id);}});});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeDialog(b.dataset.close));
document.querySelectorAll('[name="colour"]').forEach(r=>r.addEventListener('change',()=>{variant=resolveVariant(product,r.value);renderGallery(true);const url=new URL(location.href);url.searchParams.set('colour',variant.id);history.replaceState(null,'',url);}));
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{imageIndex=Number(b.dataset.view);renderGallery();});
$('#previous-image').onclick=()=>changeImage(-1);$('#next-image').onclick=()=>changeImage(1);$('#zoom-previous').onclick=()=>changeImage(-1);$('#zoom-next').onclick=()=>changeImage(1);
$('#zoom-open').onclick=()=>showDialog('image-dialog');$('#size-guide-open').onclick=()=>showDialog('size-dialog');
$('#image-dialog').addEventListener('keydown',ev=>{if(ev.key==='ArrowRight'){ev.preventDefault();changeImage(1);}if(ev.key==='ArrowLeft'){ev.preventDefault();changeImage(-1);}});
document.querySelectorAll('[name="size"]').forEach(r=>r.addEventListener('change',()=>{$('#size-error').textContent='';$('.size-field').removeAttribute('aria-invalid');}));
function renderBag(){
 const content=$('#bag-content');content.replaceChildren();
 if(!bag.length){const p=document.createElement('p');p.textContent='Your bag is waiting for a favourite.';content.append(p);}
 for(const [i,item] of bag.entries()){const row=document.createElement('div');row.className='bag-item';const img=document.createElement('img');img.src=item.image;img.alt=product.name+' in '+item.colour;img.width=72;img.height=128;const details=document.createElement('div');const title=document.createElement('h3');title.textContent=product.name;const meta=document.createElement('p');meta.textContent=item.colour+' / '+item.size+' · Qty '+item.quantity;const price=document.createElement('p');price.textContent=money.format(product.price*item.quantity);const remove=document.createElement('button');remove.className='remove-item';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+item.colour+' size '+item.size);remove.onclick=()=>{bag.splice(i,1);renderBag();};details.append(title,meta,price,remove);row.append(img,details);content.append(row);}
 $('#bag-count').textContent=bag.reduce((n,x)=>n+x.quantity,0);
}
$('#product-form').addEventListener('submit',ev=>{ev.preventDefault();const size=new FormData(ev.currentTarget).get('size');if(!validSize(product,size)){$('#size-error').textContent='Choose a size to try this in your preview bag.';$('.size-field').setAttribute('aria-invalid','true');document.querySelector('[name="size"]').focus();return;}const item=bag.find(x=>x.colour===variant.name&&x.size===size);if(item)item.quantity++;else bag.push({colour:variant.name,size,quantity:1,image:variant.images[0].thumb});renderBag();showDialog('bag-dialog');});
$('#open-bag').onclick=()=>{renderBag();showDialog('bag-dialog');};$('#continue-browsing').onclick=()=>closeDialog('bag-dialog');
$('#menu-button').onclick=()=>{const open=$('#department-menu').hidden;$('#department-menu').hidden=!open;$('#menu-button').setAttribute('aria-expanded',String(open));$('#menu-button').setAttribute('aria-label',open?'Close navigation':'Open navigation');};
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!$('#department-menu').hidden){$('#menu-button').click();$('#menu-button').focus();}});
$('#product-image').addEventListener('error',()=>{$('#product-status').textContent='This image could not load. Please try another view or refresh the page.';});
renderGallery();
const film=$('#featured-film');
if(film){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const playFilm=()=>{if(!reduced.matches&&!document.hidden)film.play().catch(()=>{});};
 const syncMotion=()=>{if(reduced.matches)film.pause();else playFilm();};
 reduced.addEventListener('change',syncMotion);
 const showFilmFallback=()=>{$('#film-error').hidden=false;};
 film.addEventListener('error',showFilmFallback);
 film.querySelector('source')?.addEventListener('error',showFilmFallback);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)film.pause();});
 playFilm();
}
