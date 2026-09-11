import fs from "node:fs/promises";
import path from "node:path";
import { ROOT } from "./lib.mjs";
const exists=async p=>fs.access(p).then(()=>true,()=>false);
export async function syncThumbnails(catalog,{download=true}={}){
  const dir=path.join(ROOT,"content/thumbnails");await fs.mkdir(dir,{recursive:true});
  let present=0,fetched=0,missing=0;
  for(const item of catalog.items.filter(i=>i.status==="published")){
    const id=item.media.driveFileId, out=path.join(dir,`${id}.jpg`);
    if(await exists(out)){present++;continue;}
    if(!download){missing++;continue;}
    try{
      const r=await fetch(`https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w800`,{redirect:"follow"});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const type=r.headers.get("content-type")||"";if(!type.startsWith("image/"))throw new Error(`unexpected ${type}`);
      await fs.writeFile(out,Buffer.from(await r.arrayBuffer()));fetched++;
    }catch(e){console.warn(`thumbnail unavailable for ${item.id}: ${e.message}`);missing++;}
  }
  console.log(`Thumbnails: ${present} cached, ${fetched} fetched, ${missing} unavailable`);
}
