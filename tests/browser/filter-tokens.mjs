import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require=createRequire(import.meta.url),{chromium}=require("playwright");
const base=process.env.TEST_BASE_URL||"http://127.0.0.1:4180",browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(`${base}/archive.html?type=image&yearFrom=1900&yearTo=1949&q=hazel`,{waitUntil:"networkidle"});
  const tokens=page.locator("#chips .chip");assert.deepEqual(await tokens.locator(".chip__label").allTextContents(),["Image","1900–1949"]);
  assert.equal((await page.locator("#q").inputValue()),"hazel");assert.equal((await tokens.allTextContents()).some(text=>text.includes("Search:")),false);
  const beforeCount=await page.locator("#count").innerText(),beforeUrl=page.url(),token=tokens.first();
  const beforeStyle=await token.evaluate(node=>({background:getComputedStyle(node).backgroundColor,color:getComputedStyle(node).color}));
  await token.hover();const hoverStyle=await token.evaluate(node=>({background:getComputedStyle(node).backgroundColor,color:getComputedStyle(node).color}));
  assert.deepEqual(hoverStyle,beforeStyle);
  await token.locator(".chip__label").click();assert.equal(await page.locator("#count").innerText(),beforeCount);assert.equal(page.url(),beforeUrl);
  await token.locator(".chip__remove").click();await page.waitForTimeout(40);assert.equal(new URL(page.url()).searchParams.has("type"),false);assert.equal(await page.locator("#chips .chip__label").count(),1);
  assert.deepEqual(errors,[]);
  console.log("filter-token browser interactions pass");
}finally{await browser.close();}
