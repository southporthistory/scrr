import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { ROOT } from "../scripts/lib.mjs";

test("About carries the complete legacy rights policy and is the sole policy destination",async()=>{
  const site=path.join(ROOT,"site");
  const about=await fs.readFile(path.join(site,"about.html"),"utf8");
  for(const phrase of [
    "informational purposes only",
    "non-commercial purposes only",
    "holder of the original copyright",
    "responsible for securing any necessary permission",
    "agrees to indemnify",
    "must be obtained in writing",
    "receive a copy of the finished work",
    "Name of collection, Southport Historical Society / Susie Carson Research Room"
  ])assert.ok(about.includes(phrase),`missing policy provision: ${phrase}`);
  await assert.rejects(fs.access(path.join(site,"rights.html")));
  for(const name of ["index.html","collections.html","archive.html","about.html"]){
    const html=await fs.readFile(path.join(site,name),"utf8");
    assert.ok(html.includes('href="about.html#rights"'),`${name} does not link to About rights section`);
    assert.doesNotMatch(html,/href="rights\.html"/);
  }
  assert.doesNotMatch(about,/preserved and shared,\s*not resold/);
});
