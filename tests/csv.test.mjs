import test from "node:test";import assert from "node:assert/strict";import {parseCsv} from "../scripts/lib.mjs";
test("CSV parser handles quoted commas and multiline fields",()=>{const rows=parseCsv('id,title,description\n1,"Cape Fear, 1954","line one\nline two"\n');assert.deepEqual(rows,[{id:"1",title:"Cape Fear, 1954",description:"line one\nline two"}]);});

import {fromRows} from "../scripts/acquire.mjs";
test("Sheet item homepage slots compile into ordered hero IDs",()=>{const base={status:"published",title:"Item",collection_ids:"photos",media_type:"image",drive_file_id:"file",view_url:"https://example.test"};const items=[{...base,id:"b",homepage_slot:"2"},{...base,id:"a",homepage_slot:"1"},{...base,id:"c",homepage_slot:""}];const collections=[{id:"photos",status:"published",title:"Photos"}];const catalog=fromRows(items,collections);assert.deepEqual(catalog.site.heroItemIds,["a","b"]);assert.equal(catalog.items[0].homepageSlot,2);});
