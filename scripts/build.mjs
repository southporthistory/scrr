import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { acquire } from "./acquire.mjs";
import { validateCatalog,compile } from "./model.mjs";
import { syncThumbnails } from "./sync-thumbnails.mjs";
import { ROOT } from "./lib.mjs";

const digest = value => crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
const catalog=await acquire();const errors=validateCatalog(catalog);
if(errors.length){console.error(errors.join("\n"));process.exit(1);}
await syncThumbnails(catalog,{download:process.env.FETCH_THUMBNAILS!=="false"});
const publication=compile(catalog), dist=path.join(ROOT,"dist");
let actualThumbnails=0;
for (const item of publication.items) {
  try { await fs.access(path.join(ROOT,"content/thumbnails",`${item.media.driveFileId}.jpg`)); actualThumbnails++; } catch {}
}
publication.stats.withThumbnail=actualThumbnails;
await fs.rm(dist,{recursive:true,force:true});
await fs.mkdir(path.join(dist,"data"),{recursive:true});
await fs.cp(path.join(ROOT,"site"),dist,{recursive:true});

const deployedThumbs=path.join(dist,"assets/thumbs");
await fs.mkdir(deployedThumbs,{recursive:true});
for(const item of publication.items){
  const name=`${item.media.driveFileId}.jpg`, source=path.join(ROOT,"content/thumbnails",name);
  try{await fs.copyFile(source,path.join(deployedThumbs,name));}catch(error){if(error.code!=="ENOENT")throw error;}
}

// Fingerprint every mutable publication asset. New HTML can never load stale CSS,
// JavaScript, or catalog data from a prior deployment.
const catalogBody=JSON.stringify(publication);
const catalogName=`catalog.${digest(catalogBody)}.json`;
await fs.writeFile(path.join(dist,"data",catalogName),catalogBody);

const jsDir=path.join(dist,"assets/js");
const jsFiles=(await fs.readdir(jsDir)).filter(name=>name.endsWith(".js"));
const assetMap=new Map();
for(const name of jsFiles){
  const sourcePath=path.join(jsDir,name);
  let body=await fs.readFile(sourcePath,"utf8");
  body=body.replaceAll('fetch("data/catalog.json")',`fetch("data/${catalogName}")`);
  const fingerprinted=name.replace(/\.js$/,`.${digest(body)}.js`);
  await fs.writeFile(path.join(jsDir,fingerprinted),body);
  await fs.rm(sourcePath);
  assetMap.set(`assets/js/${name}`,`assets/js/${fingerprinted}`);
}
const cssDir=path.join(dist,"assets/css");
for(const name of (await fs.readdir(cssDir)).filter(name=>name.endsWith(".css"))){
  const sourcePath=path.join(cssDir,name),body=await fs.readFile(sourcePath);
  const fingerprinted=name.replace(/\.css$/,`.${digest(body)}.css`);
  await fs.rename(sourcePath,path.join(cssDir,fingerprinted));
  assetMap.set(`assets/css/${name}`,`assets/css/${fingerprinted}`);
}
for(const name of (await fs.readdir(dist)).filter(name=>name.endsWith(".html"))){
  const file=path.join(dist,name);let html=await fs.readFile(file,"utf8");
  for(const [original,fingerprinted] of assetMap)html=html.replaceAll(original,fingerprinted);
  await fs.writeFile(file,html);
}
await fs.writeFile(path.join(dist,"build-manifest.json"),JSON.stringify({catalog:`data/${catalogName}`,assets:Object.fromEntries(assetMap)},null,2)+"\n");
await fs.writeFile(path.join(dist,".nojekyll"),"");
console.log(`Built dist/: ${publication.items.length} items, ${publication.collections.length} collections, ${catalogName}`);
