import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require=createRequire(import.meta.url),{chromium}=require("playwright");
const base=process.env.TEST_BASE_URL||"http://127.0.0.1:4180",browser=await chromium.launch({headless:true});
try{
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];p.on("pageerror",e=>errors.push(e.message));await p.goto(`${base}/archive.html`,{waitUntil:"networkidle"});
 const query=async text=>{await p.locator("#q").fill(text);await p.waitForTimeout(80);return{count:await p.locator("#count").innerText(),titles:await p.locator(".card__title").evaluateAll(xs=>xs.slice(0,8).map(x=>x.textContent)),sort:await p.locator("#sort").inputValue(),url:p.url()};};
 const single=await query("h"),ordered=await query("hazel hurricane"),reversed=await query("hurricane hazel"),typo=await query("huricane hazel"),natural=await query("photos of boats in the 1950s"),concept=await query("historic storms"),partial=await query("whitt"),nonsense=await query("zzqxvnotaword");
 assert.equal(single.count,"3,679 items");assert.notEqual(ordered.count,"0 items");assert.equal(ordered.count,reversed.count);assert.equal(ordered.sort,"relevance");assert.notEqual(typo.count,"0 items");assert.notEqual(natural.count,"0 items");assert.ok(Number(natural.count.replace(/[^0-9]/g,""))<100);assert.notEqual(concept.count,"0 items");assert.notEqual(partial.count,"0 items");assert.equal(nonsense.count,"0 items");assert.ok(new URL(ordered.url).searchParams.has("q"));
 await p.locator("#sort").selectOption("title");const titleSorted=await query("hurricane hazel");assert.equal(titleSorted.sort,"title");
 await p.locator("#q-clear").click();assert.equal(await p.locator("#count").innerText(),"3,679 items");assert.deepEqual(errors,[]);
 console.log(JSON.stringify({single,ordered,reversed,typo,natural,concept,partial,nonsense,titleSorted},null,2));
}finally{await browser.close();}
