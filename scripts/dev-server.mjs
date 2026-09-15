import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const port=Number(process.env.PORT||4173);
const server=createServer(async(req,res)=>{
 try{
  let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(name==='/')name='/index.html';
  if(!extname(name))name+='.html';
  const path=resolve(root,'.'+name);
  const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'}[extname(path)];
  if(!path.startsWith(root+sep)||!type||name.startsWith('/tests/')||name.startsWith('/node_modules/')){res.writeHead(404).end();return;}
  const content=await readFile(path);res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(content);
 }catch{res.writeHead(404).end('No encontrado');}
});
server.listen(port,'127.0.0.1',()=>console.log('Inventario local: http://127.0.0.1:'+port));
