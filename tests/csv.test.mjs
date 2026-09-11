import test from "node:test";import assert from "node:assert/strict";import {parseCsv} from "../scripts/lib.mjs";
test("CSV parser handles quoted commas and multiline fields",()=>{const rows=parseCsv('id,title,description\n1,"Cape Fear, 1954","line one\nline two"\n');assert.deepEqual(rows,[{id:"1",title:"Cape Fear, 1954",description:"line one\nline two"}]);});
