// A small direction buffer avoids flicker from touchpad noise and mobile bounce.
export function createNavigationScrollState({threshold=165,buffer=10}={}) {
  let previous=0,travel=0,direction=0,hidden=false;
  return (position,{pinned=false,reset=false}={})=>{
    const y=Math.max(0,Number(position)||0),delta=y-previous,nextDirection=Math.sign(delta);
    if(reset){travel=0;direction=0;hidden=false;}
    else if(nextDirection){if(nextDirection!==direction)travel=0;direction=nextDirection;travel+=Math.abs(delta);}
    if(y<=threshold||pinned){hidden=false;travel=0;direction=0;}
    else if(travel>=buffer){hidden=direction>0;travel=0;}
    previous=y;
    return {hidden,y};
  };
}

if(typeof document!=='undefined') initialiseNavigation();

function initialiseNavigation() {
  const navigation=document.querySelector('[data-site-navigation]');
  const header=document.getElementById('site-header');
  const menu=document.getElementById('site-menu');
  if(!navigation||!header||!menu)return;
  const announcement=navigation.querySelector('.site-announcement');
  const shade=navigation.querySelector('.site-nav-shade');
  const departments=[...header.querySelectorAll('.site-department')];
  const triggers=[...document.querySelectorAll('[data-site-menu-open]')];
  const mobile=matchMedia('(max-width:1080px)');
  let trackScroll=createNavigationScrollState(),frame=0,hoverTimer,closeTimer,lastMenuTrigger,keyboardMode=false;
  const navIsPinned=()=>menu.open||departments.some(item=>item.open)||(keyboardMode&&header.contains(document.activeElement));

  function paintScroll(reset=false) {
    frame=0;
    const y=Math.max(0,window.scrollY),announcementHeight=announcement.getBoundingClientRect().height;
    const state=trackScroll(y,{pinned:navIsPinned(),reset});
    navigation.style.setProperty('--site-header-offset',`${Math.max(0,announcementHeight-y)}px`);
    header.classList.toggle('is-scrolled',y>announcementHeight+2);
    header.classList.toggle('is-hidden',state.hidden);
  }
  function requestScroll(){if(!frame)frame=requestAnimationFrame(()=>paintScroll());}
  function refreshDimensions(){trackScroll=createNavigationScrollState({threshold:header.offsetHeight+announcement.offsetHeight+12});paintScroll(true);}

  function syncDepartments() {
    const open=departments.some(item=>item.open);
    header.classList.toggle('is-menu-open',open||menu.open);
    shade.hidden=!open;
    for(const item of departments)item.querySelector('summary').setAttribute('aria-expanded',String(item.open));
    paintScroll();
  }
  function closeDepartments({focus=false}={}) {
    clearTimeout(hoverTimer);clearTimeout(closeTimer);
    const open=departments.find(item=>item.open);
    for(const item of departments)item.open=false;
    if(focus&&open)open.querySelector('summary').focus({preventScroll:true});
    syncDepartments();
  }
  function openDepartment(item,{hover=false}={}) {
    if(mobile.matches)return;
    for(const other of departments)if(other!==item)other.open=false;
    if(hover)item.dataset.hoverOpen='true';else delete item.dataset.hoverOpen;
    item.open=true;
    syncDepartments();
  }
  for(const item of departments) {
    const summary=item.querySelector('summary');
    summary.setAttribute('aria-expanded','false');
    item.addEventListener('toggle',()=>{
      if(item.open)for(const other of departments)if(other!==item)other.open=false;
      syncDepartments();
    });
    summary.addEventListener('pointerenter',event=>{
      if(event.pointerType!=='mouse'||!matchMedia('(hover:hover)').matches)return;
      clearTimeout(closeTimer);clearTimeout(hoverTimer);
      hoverTimer=setTimeout(()=>openDepartment(item,{hover:true}),160);
    });
    item.addEventListener('pointerenter',()=>clearTimeout(closeTimer));
    item.addEventListener('pointerleave',()=>{
      clearTimeout(hoverTimer);
      if(keyboardMode&&item.contains(document.activeElement))return;
      closeTimer=setTimeout(()=>{item.open=false;syncDepartments();},210);
    });
    summary.addEventListener('click',event=>{
      clearTimeout(hoverTimer);clearTimeout(closeTimer);
      // A click after the hover delay should keep the chosen menu open.
      if(item.open&&item.dataset.hoverOpen==='true')event.preventDefault();
      delete item.dataset.hoverOpen;
    });
    summary.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown'){event.preventDefault();openDepartment(item);item.querySelector('.site-view-all').focus();}
      if(event.key==='ArrowRight'||event.key==='ArrowLeft'){
        event.preventDefault();const next=(departments.indexOf(item)+(event.key==='ArrowRight'?1:-1)+departments.length)%departments.length;
        const wasOpen=item.open;closeDepartments();if(wasOpen)openDepartment(departments[next]);departments[next].querySelector('summary').focus();
      }
    });
    item.addEventListener('focusout',()=>{queueMicrotask(()=>{if(keyboardMode&&!item.contains(document.activeElement)){item.open=false;syncDepartments();}});});
  }
  shade.addEventListener('click',()=>closeDepartments());
  document.addEventListener('keydown',event=>{
    if(event.key==='Tab'){keyboardMode=true;header.classList.remove('is-hidden');}
    if(event.key==='Escape'&&!menu.open&&departments.some(item=>item.open)){event.preventDefault();closeDepartments({focus:true});}
  });
  document.addEventListener('pointerdown',()=>{keyboardMode=false;},{passive:true});
  header.addEventListener('focusin',()=>header.classList.remove('is-hidden'));

  function closeMenu(){if(menu.open)menu.close();}
  for(const trigger of triggers)trigger.addEventListener('click',()=>{
    closeDepartments();lastMenuTrigger=trigger;
    menu.showModal();document.body.classList.add('site-menu-open');
    trigger.setAttribute('aria-expanded','true');header.classList.remove('is-hidden');syncDepartments();
  });
  menu.querySelector('[data-site-menu-close]').addEventListener('click',closeMenu);
  menu.addEventListener('click',event=>{
    if(event.target!==menu)return;
    const rect=menu.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeMenu();
  });
  menu.addEventListener('close',()=>{
    document.body.classList.remove('site-menu-open');
    for(const trigger of triggers)trigger.setAttribute('aria-expanded','false');
    if(lastMenuTrigger?.isConnected&&mobile.matches)lastMenuTrigger.focus({preventScroll:true});
    syncDepartments();
  });
  const mobileDepartments=[...menu.querySelectorAll('.site-mobile-department')];
  for(const item of mobileDepartments)item.addEventListener('toggle',()=>{if(item.open)for(const other of mobileDepartments)if(other!==item)other.open=false;});
  // Closing first prevents a back-forward restore from reopening an old drawer.
  menu.querySelectorAll('a[href]').forEach(anchor=>anchor.addEventListener('click',closeMenu));
  mobile.addEventListener('change',()=>{closeDepartments();if(!mobile.matches)closeMenu();refreshDimensions();});

  function updateCounts(savedIds,previewQuantity) {
    let savedCount=0,bagCount=0;
    try{
      const saved=savedIds??JSON.parse(localStorage.getItem('wow-homepage-saved-v1')||'[]');
      savedCount=Array.isArray(saved)?new Set(saved.filter(id=>typeof id==='string'&&/^[a-z0-9-]{1,100}$/.test(id))).size:0;
    }catch{}
    try{
      const bag=JSON.parse(sessionStorage.getItem('wow-commerce-preview-v1')||'null');
      if(bag?.version===1&&Array.isArray(bag.items))bagCount=bag.items.reduce((sum,item)=>sum+(Number.isInteger(item.quantity)&&item.quantity>=1&&item.quantity<=10?item.quantity:0),0);
    }catch{}
    if(Number.isInteger(previewQuantity)&&previewQuantity>=0)bagCount=previewQuantity;
    navigation.querySelectorAll('[data-wishlist-count]').forEach(node=>node.textContent=savedCount?String(savedCount):'');
    navigation.querySelectorAll('[data-site-bag-count]').forEach(node=>node.textContent=bagCount?String(bagCount):'');
  }
  window.addEventListener('wow:saved',event=>updateCounts(event.detail?.ids));
  window.addEventListener('wow:bag-changed',event=>updateCounts(undefined,event.detail?.quantity));
  window.addEventListener('storage',()=>updateCounts());
  window.addEventListener('pageshow',()=>{closeMenu();closeDepartments();updateCounts();refreshDimensions();});
  window.addEventListener('pagehide',()=>{closeMenu();closeDepartments();});
  window.addEventListener('scroll',requestScroll,{passive:true});
  window.addEventListener('resize',refreshDimensions,{passive:true});
  navigation.dataset.enhanced='true';
  for(const trigger of triggers)trigger.setAttribute('aria-expanded','false');
  updateCounts();refreshDimensions();
}
