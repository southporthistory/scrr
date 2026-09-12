import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { ROOT } from "../scripts/lib.mjs";

test("home does not render an empty feature module and closes directly into footer",async()=>{
  const html=await fs.readFile(path.join(ROOT,"site/index.html"),"utf8");
  const css=await fs.readFile(path.join(ROOT,"site/assets/css/main.css"),"utf8");
  const js=await fs.readFile(path.join(ROOT,"site/assets/js/home.js"),"utf8");
  assert.match(html,/<body class="home">/);
  assert.doesNotMatch(html,/id="stories"|Threads worth pulling|Ways in/);
  assert.doesNotMatch(js,/function stories\(/);
  assert.match(css,/\.home \.foot \{ margin-top:0; \}/);
});
