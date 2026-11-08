import {readFile} from 'node:fs/promises';
import path from 'node:path';

export default async function handler(req,res) {
  const url=new URL(req.url,'https://wow-fashion-new-website.vercel.app');
  const code=url.searchParams.get('code')==='404'?404:503;
  const file=code===404?'404':'service-unavailable';
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(code===503)res.setHeader('Retry-After','120');
  res.statusCode=code;
  try {
    const html=await readFile(path.join(process.cwd(),'dist',file,'index.html'),'utf8');
    res.end(req.method==='HEAD'?'':html);
  } catch {
    res.end(req.method==='HEAD'?'':`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WOW Fashion</title><main><h1>${code===404?'Let’s find your way back.':'A little pause.'}</h1><p>${code===404?'This page could not be found.':'This page is temporarily unavailable.'}</p><a href="/shop/">Explore WOW Fashion</a></main></html>`);
  }
}
