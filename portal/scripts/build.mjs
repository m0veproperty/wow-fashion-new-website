import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
await rm('dist', {recursive:true, force:true});
await mkdir('dist', {recursive:true});
await cp('public', 'dist', {recursive:true});
for (const file of ['taxonomy.json','prompts.json']) { const data=JSON.parse(await readFile(`dist/data/${file}`, 'utf8')); await writeFile(`dist/data/${file}`, JSON.stringify(data)); }
console.log('Built Wow Fashion workspace to dist.');

