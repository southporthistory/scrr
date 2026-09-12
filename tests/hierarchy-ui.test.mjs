import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { ROOT } from "../scripts/lib.mjs";

test("Collections overview does not render descendant lists",async()=>{
  const source=await fs.readFile(path.join(ROOT,"site/assets/js/collections.js"),"utf8");
  assert.match(source,/collectionCard\(child,grandchildren\)/);
  assert.doesNotMatch(source,/family__children|family__nested/);
});
test("Browse uses a semantic expandable collection tree",async()=>{
  const source=await fs.readFile(path.join(ROOT,"site/assets/js/archive.js"),"utf8");
  for(const phrase of ['role","tree"','role","treeitem"','input.indeterminate=partial','collection-tree-toggle'])assert.ok(source.includes(phrase),`missing ${phrase}`);
});
test("collection context shows only one unambiguous effective description",async()=>{
  const source=await fs.readFile(path.join(ROOT,"site/assets/js/archive.js"),"utf8");
  assert.match(source,/function effectiveCollectionContexts\(\)/);
  assert.match(source,/reverse\(\)\.find\(collection=>collection\.description/);
  assert.match(source,/if\(contexts\.length!==1\)return/);
  assert.doesNotMatch(source,/collection-context--pair|collection-context--many|collection-context-summary/);
  assert.doesNotMatch(source,/collection-context__clear/);
});
