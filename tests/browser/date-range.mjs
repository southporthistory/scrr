import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require=createRequire(import.meta.url);
const { chromium }=require("playwright");

const base=process.env.TEST_BASE_URL||"http://127.0.0.1:4180";
const browser=await chromium.launch({headless:true});
try {
  for(const [mode,viewport] of [["desktop",{width:1512,height:823}],["mobile",{width:390,height:844}]]){
    const page=await browser.newPage({viewport});const errors=[];page.on("pageerror",error=>errors.push(error.message));
    await page.goto(`${base}/archive.html`,{waitUntil:"networkidle"});if(mode==="mobile")await page.locator("#filter-open").click();
    const fields=page.locator(".date-field input"),from=page.locator(".date-handle--from"),chart=page.locator(".date-chart");
    const reset=async()=>{await page.getByRole("button",{name:"All years",exact:true}).click();};
    const values=()=>fields.evaluateAll(nodes=>nodes.map(node=>Number(node.value)));
    const [min,max]=await values(),chartBox=await chart.boundingBox();
    const endpointGeometry=()=>page.evaluate(()=>{const selection=document.querySelector(".date-selection").getBoundingClientRect(),centers=[...document.querySelectorAll(".date-handle")].map(node=>{const rect=node.getBoundingClientRect(),thumb=getComputedStyle(node,"::after");return rect.x+parseFloat(thumb.left)+parseFloat(thumb.width)/2;});return{edges:[selection.left,selection.right],centers};});
    const assertAligned=async label=>{const geometry=await endpointGeometry();assert.ok(Math.abs(geometry.edges[0]-geometry.centers[0])<1,`${mode}: ${label} left boundary/thumb mismatch`);assert.ok(Math.abs(geometry.edges[1]-geometry.centers[1])<1,`${mode}: ${label} right boundary/thumb mismatch`);};
    await assertAligned("full range");

    // Drag maps linearly to the usable plot width.
    const midpointX=chartBox.x+chartBox.width/2,fromBox=await from.boundingBox();
    await page.mouse.move(fromBox.x+fromBox.width/2,fromBox.y+fromBox.height/2);await page.mouse.down();await page.mouse.move(midpointX,fromBox.y+fromBox.height/2,{steps:12});await page.mouse.up();await page.waitForTimeout(50);
    const midpoint=Math.round((min+max)/2),dragged=(await values())[0];assert.ok(Math.abs(dragged-midpoint)<=1,`${mode}: drag ${dragged} != ${midpoint}`);await assertAligned("dragged range");
    if(mode==="desktop"){assert.ok(new URL(page.url()).searchParams.has("yearFrom"));assert.notEqual(await page.locator("#count").innerText(),"3,679 items");}
    else {assert.equal(await page.locator("#count").innerText(),"3,679 items");assert.equal(await page.locator("#filter-count").innerText(),"1");}

    // Keyboard increments are exact from a known endpoint.
    await reset();await from.press("ArrowRight");assert.equal((await values())[0],min+1);
    await from.press("Shift+ArrowRight");assert.equal((await values())[0],min+11);

    // Manual fields are authoritative; malformed years do not mutate the range.
    await reset();await fields.nth(0).fill("1900");await fields.nth(0).press("Enter");assert.equal((await values())[0],1900);
    await fields.nth(1).fill("19");await fields.nth(1).press("Enter");assert.equal(await fields.nth(1).getAttribute("aria-invalid"),"true");assert.match(await page.locator(".date-error").innerText(),/four-digit year/);
    await fields.nth(1).press("Escape");assert.equal((await values())[1],max);

    // A plot click moves the nearest endpoint to the clicked year.
    await reset();const beforeClick=(await values())[1];await page.mouse.click(chartBox.x+chartBox.width*.9,chartBox.y+chartBox.height/2);const clicked=(await values())[1];assert.ok(clicked<beforeClick&&clicked>Math.round((min+max)/2),`${mode}: chart click did not move latest year`);

    // Presets and reset remain deterministic.
    await page.getByRole("button",{name:"1950–1999",exact:true}).click();assert.deepEqual(await values(),[1950,1999]);await assertAligned("preset range");assert.ok(await page.getByRole("button",{name:"1950–1999",exact:true}).evaluate(node=>node.classList.contains("is-active")));
    await reset();assert.deepEqual(await values(),[min,max]);

    if(mode==="mobile"){
      await page.getByRole("button",{name:"1900–1949",exact:true}).click();assert.equal(await page.locator("#count").innerText(),"3,679 items");await page.locator("#filter-apply").click();await page.waitForTimeout(50);assert.notEqual(await page.locator("#count").innerText(),"3,679 items");assert.equal(new URL(page.url()).searchParams.get("yearFrom"),"1900");
    }
    assert.deepEqual(errors,[]);await page.close();
  }
} finally { await browser.close(); }
console.log("date-range browser interactions pass");
