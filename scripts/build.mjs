import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {createCollectionRenderer} from './collection-template.mjs';
import {renderHomepage} from './homepage-template.mjs';
const json=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
const blouseParent=await json('data/blouse-parent.json');
const campaignHeroes=await json('data/campaign-heroes.json');
Object.assign(blouseParent,{ids:[79,31,12,5,52,7,28,10,63,19,13,40],featuredId:79,featuredSlug:'cotton-blouses',featuredLabel:'Explore cotton blouses',detailLine:'A collar. A cuff. A different feeling.',heroAlt:'Campaign inspiration: a woman wearing an ivory blouse in a sunlit courtyard',campaignNote:'The collection header images are illustrative campaign styling inspiration.'});
const departments=[
 {slug:'blouses',singular:'blouse',parent:blouseParent,collections:await json('data/collections.json'),products:await json('data/products.json')},
 {slug:'cardigans',singular:'cardigan',...(await json('data/cardigans.json')),products:await json('data/cardigan-products.json')},
 {slug:'coats-and-jackets',singular:'coat or jacket',...(await json('data/outerwear.json')),products:await json('data/outerwear-products.json')},
 {slug:'dresses',singular:'dress',...(await json('data/dresses.json')),products:await json('data/dress-products.json')},
 {slug:'pants',singular:'pair of trousers',...(await json('data/pants.json')),products:await json('data/pants-products.json')},
 {slug:'skirts',singular:'skirt',...(await json('data/skirts.json')),products:await json('data/skirts-products.json')},
 {slug:'sweaters',singular:'sweater',...(await json('data/sweaters.json')),products:await json('data/sweaters-products.json')}
];
for(const department of departments){
 const render=createCollectionRenderer(department);
 for(const [c,isParent] of [[department.parent,true],...department.collections.map(c=>[c,false])]){
  if(c.preserved)continue;
  c.campaignHero=campaignHeroes['/'+department.slug+(isParent?'':'/'+c.slug)+'/'];
  const dir='dist/'+department.slug+(isParent?'':'/'+c.slug);
  await mkdir(dir,{recursive:true});await writeFile(dir+'/index.html',render(c,isParent));
 }
 console.log('Built '+department.parent.name+' and '+department.collections.length+' subcategories.');
}
console.log('Preserved both animated dress pages.');
await writeFile('dist/index.html',renderHomepage({home:await json('data/homepage.json'),departments,campaign:await json('data/homepage-campaign-provenance.json')}));
console.log('Built the WOW Fashion homepage.');


await import('./build-products.mjs');
