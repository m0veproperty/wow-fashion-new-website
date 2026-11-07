import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {renderProduct} from './product-template.mjs';
const products=JSON.parse(await readFile(new URL('../data/product-pages.json',import.meta.url),'utf8'));
for(const product of products){const dir='dist/products/'+product.slug;await mkdir(dir,{recursive:true});await writeFile(dir+'/index.html',renderProduct(product));}
console.log('Built '+products.length+' product template preview.');

const {renderCatalogProduct}=await import('./related-products.mjs');
const related=JSON.parse(await readFile(new URL('../data/related-cardigans.json',import.meta.url),'utf8'));
for(const product of related){const dir='dist/products/'+product.slug;await mkdir(dir,{recursive:true});await writeFile(dir+'/index.html',renderCatalogProduct(product,related.filter(x=>x.id!==product.id)));}
console.log('Built '+related.length+' related cardigan product pages.');
