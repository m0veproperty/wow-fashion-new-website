import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('public');
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:fallback;};
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname.startsWith('/api/')) {res.setHeader('Content-Type','application/json');res.statusCode=u.pathname==='/api/session'?200:401;res.end(JSON.stringify({authenticated:false,configured:false,localPreview:true,error:'Shared editing is available on the deployed workspace.'}));return;}
  try {const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/index.html'||u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep))throw new Error('path');await stat(file);res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end('Not found');}
}).listen(Number(arg('--port',process.env.PORT||3000)),arg('--host','0.0.0.0'),()=>console.log('Wow Fashion preview ready'));

