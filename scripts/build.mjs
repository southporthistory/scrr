import fs from "node:fs/promises";
import path from "node:path";
import { acquire } from "./acquire.mjs";
import { validateCatalog,compile } from "./model.mjs";
import { syncThumbnails } from "./sync-thumbnails.mjs";
import { ROOT,writeJson } from "./lib.mjs";
const catalog=await acquire();const errors=validateCatalog(catalog);
if(errors.length){console.error(errors.join("\n"));process.exit(1);}
await syncThumbnails(catalog,{download:process.env.FETCH_THUMBNAILS!=="false"});
const publication=compile(catalog), dist=path.join(ROOT,"dist");
let actualThumbnails=0;
for (const item of publication.items) {
  try { await fs.access(path.join(ROOT,"content/thumbnails",`${item.media.driveFileId}.jpg`)); actualThumbnails++; } catch {}
}
publication.stats.withThumbnail=actualThumbnails;
await fs.rm(dist,{recursive:true,force:true});await fs.mkdir(path.join(dist,"data"),{recursive:true});
await fs.cp(path.join(ROOT,"site"),dist,{recursive:true});
const deployedThumbs=path.join(dist,"assets/thumbs");
await fs.mkdir(deployedThumbs,{recursive:true});
for(const item of publication.items){
  const name=`${item.media.driveFileId}.jpg`, source=path.join(ROOT,"content/thumbnails",name);
  try{await fs.copyFile(source,path.join(deployedThumbs,name));}catch(error){if(error.code!=="ENOENT")throw error;}
}
await fs.writeFile(path.join(dist,"data/catalog.json"),JSON.stringify(publication));await fs.writeFile(path.join(dist,".nojekyll"),"");
console.log(`Built dist/: ${publication.items.length} items, ${publication.collections.length} collections`);
