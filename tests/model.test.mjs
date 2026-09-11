import test from "node:test";import assert from "node:assert/strict";
import {readJson} from "../scripts/lib.mjs";import {validateCatalog,compile} from "../scripts/model.mjs";
test("fixture is a valid intentional catalog",async()=>{const c=await readJson("content/fixture/catalog.json");assert.deepEqual(validateCatalog(c),[]);});
test("publication excludes drafts and operational fields",async()=>{const c=await readJson("content/fixture/catalog.json");c.items.push({...c.items[0],id:"draft",status:"draft"});const p=compile(c);assert.equal(p.items.some(i=>i.id==="draft"),false);assert.equal("status" in p.items[0],false);assert.equal("driveFileId" in p.items[0],false);assert.ok(p.items[0].media.driveFileId);});
test("broken collection references reject publication",async()=>{const c=await readJson("content/fixture/catalog.json");c.items[0].collectionIds=["missing"];assert.ok(validateCatalog(c).some(e=>e.includes("unknown collection")));});
