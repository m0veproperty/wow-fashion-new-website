// Shared column sizing and a viewport-pinned scrollbar for every overflowing table.
let active=null,frame=0;
const bar=document.createElement('div');
bar.className='table-scroll-dock';bar.hidden=true;
bar.innerHTML='<span class="table-scroll-label">Scroll table horizontally</span><div class="table-scroll-track" tabindex="0" role="region" aria-label="Scroll visible table horizontally"><div class="table-scroll-spacer"></div></div>';
const track=bar.querySelector('.table-scroll-track'),spacer=bar.querySelector('.table-scroll-spacer');
function update(){frame=0;let candidate=null,area=0;
 document.querySelectorAll('.table-wrap').forEach(w=>{const b=w.getBoundingClientRect();const visible=Math.min(b.bottom,innerHeight-48)-Math.max(b.top,70);if(w.scrollWidth>w.clientWidth+2&&visible>60&&b.bottom>innerHeight-45&&b.left<innerWidth&&b.right>0&&visible>area){candidate=w;area=visible;}});
 active=candidate;bar.hidden=!active||!!document.querySelector('dialog[open]')||!!document.querySelector('.shell.menu-open');if(bar.hidden)return;
 const box=active.getBoundingClientRect(),left=Math.max(8,box.left),right=Math.min(innerWidth-8,box.right);bar.style.left=left+'px';bar.style.width=Math.max(0,right-left)+'px';
 spacer.style.width=(active.scrollWidth-active.clientWidth+track.clientWidth)+'px';track.scrollLeft=active.scrollLeft;
}
function schedule(){if(!frame)frame=requestAnimationFrame(update);}
const resize=new ResizeObserver(schedule);
function enhance(){document.querySelectorAll('table').forEach(table=>{
 if(table.dataset.sized==='yes')return;table.dataset.sized='yes';
 const headings=Array.from(table.querySelectorAll('thead tr:first-child th'));
 if(!headings.length)return;
 const group=document.createElement('colgroup');
 headings.forEach((th,i)=>{const text=th.textContent.trim().toLowerCase();let kind=i===0?'name':'standard';
 if(/^(parent|page type|products$|publish date|weight|page built|has the page been built|does the page feature an animated|animated header|indexing|dummy product|dummy review|sample rating|item rating|store rating|price|sale price|price range|uk searches|linked products|action|listing|preview)/.test(text))kind='compact';
 if(/^(purpose|how to assess|interpretation|records sharing|review \/ customer)/.test(text))kind='description';
 if(/^(parent|parent \/ system)$/.test(text))kind='parent';if(/^(page type|page built|animated header|products)$/.test(text))kind='flag';if(!text)kind='action';const col=document.createElement('col');col.className='table-col-'+kind;group.append(col);th.classList.add('table-heading-'+kind);});
 table.prepend(group);resize.observe(table);const wrapper=table.closest('.table-wrap');if(wrapper){resize.observe(wrapper);wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label',(document.querySelector('h1')?.textContent||'Workspace')+' table');}
 });schedule();}
function init(){document.body.append(bar);enhance();new MutationObserver(enhance).observe(document.getElementById('app'),{childList:true,subtree:true});}
track.addEventListener('scroll',()=>{if(active)active.scrollLeft=track.scrollLeft;});
track.addEventListener('keydown',e=>{if(!active)return;const offsets={ArrowLeft:-80,ArrowRight:80,Home:-Infinity,End:Infinity};if(e.key in offsets){e.preventDefault();track.scrollLeft=e.key==='Home'?0:e.key==='End'?track.scrollWidth:track.scrollLeft+offsets[e.key];}});
document.addEventListener('scroll',e=>{if(e.target===active&&Math.abs(track.scrollLeft-active.scrollLeft)>1)track.scrollLeft=active.scrollLeft;schedule();},true);
window.addEventListener('resize',schedule);window.addEventListener('hashchange',schedule);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();

