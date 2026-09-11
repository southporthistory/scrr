import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { ROOT } from "./lib.mjs";

const base=path.join(ROOT,"dist"),port=Number(process.env.PORT||4173);
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".jpg":"image/jpeg",".svg":"image/svg+xml"};
const compressed=new Map();
function cacheControl(file){
  const rel=path.relative(base,file).replaceAll(path.sep,"/");
  if(rel.startsWith("assets/thumbs/"))return "public, max-age=604800, stale-while-revalidate=86400";
  if(rel.startsWith("assets/"))return "public, max-age=3600, stale-while-revalidate=86400";
  if(rel==="data/catalog.json")return "public, max-age=300, stale-while-revalidate=3600";
  return "no-cache";
}
http.createServer((req,res)=>{
  const clean=decodeURIComponent(req.url.split("?")[0]);let file=path.join(base,clean==="/"?"index.html":clean);
  if(!file.startsWith(base)){res.writeHead(403);return res.end();}
  fs.stat(file,(statError,stat)=>{
    if(!statError&&stat.isDirectory()){file=path.join(file,"index.html");try{stat=fs.statSync(file);}catch(e){statError=e;}}
    if(statError||!stat?.isFile()){res.writeHead(404);return res.end("Not found");}
    const etag=`"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
    const headers={"Content-Type":types[path.extname(file)]||"application/octet-stream","Cache-Control":cacheControl(file),"ETag":etag,"Last-Modified":stat.mtime.toUTCString(),"Vary":"Accept-Encoding"};
    if(req.headers["if-none-match"]===etag){res.writeHead(304,headers);return res.end();}
    fs.readFile(file,(err,data)=>{
      if(err){res.writeHead(500);return res.end("Read error");}
      const compressible=/\.(html|js|css|json|svg)$/.test(file),gzip=compressible&&/\bgzip\b/.test(req.headers["accept-encoding"]||"");
      if(gzip){const key=`${file}:${etag}`;let body=compressed.get(key);if(!body){body=zlib.gzipSync(data,{level:9});compressed.set(key,body);}headers["Content-Encoding"]="gzip";headers["Content-Length"]=body.length;res.writeHead(200,headers);return res.end(body);}
      headers["Content-Length"]=data.length;res.writeHead(200,headers);res.end(data);
    });
  });
}).listen(port,"0.0.0.0",()=>console.log(`http://0.0.0.0:${port}`));
