import {readFile,writeFile} from 'node:fs/promises';
import {siteHeader} from './site-navigation.mjs';
import {renderHeroTopBlend} from './hero-top-blend.mjs';

const marker='<!--site-navigation-->';
const preservedPages=[
  {path:'/dresses/',inverse:false},
  {path:'/dresses/club-dresses/',inverse:true}
];

const decodeAttribute=value=>value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi,(_,entity)=>{
  if(entity[0]==='#') return String.fromCodePoint(parseInt(entity.slice(entity[1].toLowerCase()==='x'?2:1),entity[1].toLowerCase()==='x'?16:10));
  return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'}[entity.toLowerCase()];
});

function addHeroTopBlend(html,path) {
  const opening=html.match(/<section\b(?=[^>]*\bclass=["'][^"']*\bhero\b)[^>]*>/i);
  if(!opening) throw new Error('Expected a preserved hero on '+path);
  const insertion=opening.index+opening[0].length;
  const hero=html.slice(insertion,html.indexOf('</section>',insertion));
  const video=hero.match(/<video\b[^>]*>/i)?.[0];
  const poster=video?.match(/\bposter=(["'])(.*?)\1/i)?.[2];
  if(!poster) throw new Error('Expected a hero video poster on '+path);
  return html.slice(0,insertion)+renderHeroTopBlend(decodeAttribute(poster))+html.slice(insertion);
}

/** Supply the shared navigation while retaining the original campaign pages. */
export async function buildPreservedNavigation() {
  for(const page of preservedPages) {
    const file=new URL('../dist'+page.path+'index.html',import.meta.url);
    const html=await readFile(file,'utf8');
    if(html.split(marker).length!==2) {
      throw new Error('Expected one site navigation marker on '+page.path);
    }
    const withBlend=addHeroTopBlend(html,page.path);
    await writeFile(file,withBlend.replace(marker,siteHeader(page.path,{overlay:true,inverse:page.inverse})), 'utf8');
  }
}
