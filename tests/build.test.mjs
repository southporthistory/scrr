import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { ROOT } from "../scripts/lib.mjs";

test("built HTML references only fingerprinted mutable assets",async()=>{
  const dist=path.join(ROOT,"dist");
  const htmlFiles=(await fs.readdir(dist)).filter(name=>name.endsWith(".html"));
  for(const name of htmlFiles){
    const html=await fs.readFile(path.join(dist,name),"utf8");
    assert.doesNotMatch(html,/assets\/(css|js)\/[^"']+(?<!\.[a-f0-9]{12})\.(css|js)["']/);
    for(const match of html.matchAll(/(?:href|src)="(assets\/(?:css|js)\/[^"]+)"/g))
      await fs.access(path.join(dist,match[1]));
  }
  const manifest=JSON.parse(await fs.readFile(path.join(dist,"build-manifest.json"),"utf8"));
  assert.match(manifest.catalog,/^data\/catalog\.[a-f0-9]{12}\.json$/);
  await fs.access(path.join(dist,manifest.catalog));
  assert.equal((await fs.readdir(path.join(dist,"data"))).includes("catalog.json"),false);
});
