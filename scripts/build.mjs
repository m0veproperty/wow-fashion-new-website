import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {createCollectionRenderer} from './collection-template.mjs';
const json=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
const blouseParent=await json('data/blouse-parent.json');
Object.assign(blouseParent,{ids:[79,31,12,5,52,7,28,10,63,19,13,40],featuredId:79,featuredSlug:'cotton-blouses',featuredLabel:'Explore cotton blouses',detailLine:'A collar. A cuff. A different feeling.',heroAlt:'Campaign inspiration: a woman wearing an ivory blouse in a sunlit courtyard',campaignNote:'The parent and denim campaign images are illustrative styling inspiration.'});
const departments=[
 {slug:'blouses',singular:'blouse',parent:blouseParent,collections:await json('data/collections.json'),products:await json('data/products.json')},
 {slug:'cardigans',singular:'cardigan',...(await json('data/cardigans.json')),products:await json('data/cardigan-products.json')}
];
for(const department of departments){
 const render=createCollectionRenderer(department);
 for(const [c,isParent] of [[department.parent,true],...department.collections.map(c=>[c,false])]){
  const dir='dist/'+department.slug+(isParent?'':'/'+c.slug);
  await mkdir(dir,{recursive:true});await writeFile(dir+'/index.html',render(c,isParent));
 }
 if(department.slug==='blouses')await writeFile('dist/index.html',render(department.parent,true));
 console.log('Built '+department.parent.name+' and '+department.collections.length+' subcategories.');
}
console.log('Preserved both animated dress pages.');

