let collapsed=false;
try{collapsed=localStorage.getItem('wow-sidebar-collapsed')==='true';}catch{}
const mobile=()=>matchMedia('(max-width:720px)').matches;
export function restoreSidebar(){
 const shell=document.querySelector('.shell'),sidebar=document.querySelector('.sidebar'),button=document.querySelector('.menu-toggle');if(!shell||!sidebar||!button)return;
 shell.classList.toggle('sidebar-collapsed',collapsed&&!mobile());
 const expanded=mobile()?shell.classList.contains('menu-open'):!collapsed;
 sidebar.inert=!expanded;button.setAttribute('aria-expanded',String(expanded));button.setAttribute('aria-label',expanded?'Collapse sidebar':'Expand sidebar');const label=button.querySelector('.sidebar-toggle-label');if(label)label.textContent=expanded?'Collapse sidebar':'Expand sidebar';button.title=expanded?'Collapse sidebar for full-width view':'Expand sidebar';
 window.dispatchEvent(new Event('resize-table-layout'));
}
export function toggleSidebar(){if(mobile())document.querySelector('.shell')?.classList.toggle('menu-open');else{collapsed=!collapsed;try{localStorage.setItem('wow-sidebar-collapsed',String(collapsed));}catch{}}restoreSidebar();}
window.addEventListener('resize',restoreSidebar);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.querySelector('.shell.menu-open')){document.querySelector('.shell').classList.remove('menu-open');restoreSidebar();document.querySelector('.menu-toggle')?.focus();}});
