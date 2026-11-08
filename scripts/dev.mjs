import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import systemPage from '../api/system-page.js';

const root=path.resolve('dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4','.ttf':'font/ttf'};
const systemRoutes=new Map([['/404/',404],['/service-unavailable/',503]]);

export function createPreviewServer(){
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Robots-Tag','noindex, nofollow');
    res.setHeader('X-Content-Type-Options','nosniff');
    try{
      const url=new URL(req.url,'http://localhost');
      const route=url.pathname.replace(/\/?$/,'/');
      const code=systemRoutes.get(route);
      if(code)return systemPage({url:'/api/system-page?code='+code,method:req.method},res);
      if(route==='/api/system-page/')return systemPage(req,res);
      let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
      if(!file.startsWith(root+path.sep)&&file!==root)throw new Error('Outside preview root');
      if((await stat(file)).isDirectory())file=path.join(file,'index.html');
      const data=await readFile(file);
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});
      res.end(req.method==='HEAD'?'':data);
    }catch{
      await systemPage({url:'/api/system-page?code=404',method:req.method},res);
    }
  });
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  createPreviewServer().listen(4173,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4173'));
}
