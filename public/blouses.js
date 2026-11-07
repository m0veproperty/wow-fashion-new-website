const $=s=>document.querySelector(s);
const toggle=$('#menu-toggle');
toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));$('#mobile-nav').hidden=!open;});
document.querySelectorAll('#mobile-nav a').forEach(a=>a.addEventListener('click',()=>{$('#mobile-nav').hidden=true;toggle.setAttribute('aria-expanded','false');}));
$('.mobile-filters')?.addEventListener('click',function(){const open=this.getAttribute('aria-expanded')!=='true';this.setAttribute('aria-expanded',String(open));this.querySelector('span').textContent=open?'−':'＋';this.closest('.catalog-layout').classList.toggle('filters-visible',open);});
const track=$('#category-track');
if(track){const prev=$('.category-prev'),next=$('.category-next');const update=()=>{prev.disabled=track.scrollLeft<3;next.disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-3;};prev.onclick=()=>track.scrollBy({left:-track.clientWidth,behavior:'smooth'});next.onclick=()=>track.scrollBy({left:track.clientWidth,behavior:'smooth'});track.addEventListener('scroll',update,{passive:true});addEventListener('resize',update);update();}
addEventListener('scroll',()=>$('#header')?.classList.toggle('scrolled',scrollY>40),{passive:true});
