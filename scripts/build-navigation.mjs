import {readFile,writeFile} from 'node:fs/promises';
import {siteHeader} from './site-navigation.mjs';

const marker='<!--site-navigation-->';
const preservedPages=[
  {path:'/dresses/',inverse:false},
  {path:'/dresses/club-dresses/',inverse:true}
];

/** Supply the shared navigation while retaining the original campaign pages. */
export async function buildPreservedNavigation() {
  for(const page of preservedPages) {
    const file=new URL('../dist'+page.path+'index.html',import.meta.url);
    const html=await readFile(file,'utf8');
    if(html.split(marker).length!==2) {
      throw new Error('Expected one site navigation marker on '+page.path);
    }
    await writeFile(file,html.replace(marker,siteHeader(page.path,{overlay:true,inverse:page.inverse})), 'utf8');
  }
}
