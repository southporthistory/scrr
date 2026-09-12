import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
require("../site/assets/js/search.js");
const {create,parseQuery}=globalThis.ArchiveSearch;
const items=[
 {id:"hazel",title:"Hurricane Hazel damages the waterfront",description:"",collectionIds:["storms"],contentDate:{startYear:1954,endYear:1954,label:"1954"},publicationDate:null,media:{type:"image"},subjects:["Storms"],people:[],places:["Southport Waterfront"]},
 {id:"boat",title:"Fishing boats at the harbor",description:"Menhaden fleet",collectionIds:["photos"],contentDate:{startYear:1957,endYear:1957,label:"1957"},publicationDate:null,media:{type:"image"},subjects:["Maritime"],people:[],places:["Southport"]},
 {id:"church",title:"Church history report",description:"",collectionIds:["reports"],contentDate:{startYear:1940,endYear:1940,label:"1940"},publicationDate:null,media:{type:"document"},subjects:[],people:[],places:[]}
];
const collections=[{id:"root",title:"Research Collections",description:"",parentId:null},{id:"storms",title:"Stormy Weather",description:"Historic hurricanes and coastal storms",parentId:"root"},{id:"photos",title:"Photographs",description:"",parentId:"root"},{id:"reports",title:"Reports",description:"",parentId:"root"}];
const search=create(items,collections);
test("query parsing recognizes natural media and decade language",()=>assert.deepEqual(parseQuery("photos of boats in the 1950s"),{raw:"photos of boats in the 1950s",terms:["boat"],media:["image"],years:[{from:1950,to:1959,label:"1950s"}]}));
test("token order does not matter",()=>assert.equal(search.search("hazel hurricane")[0].item.id,"hazel"));
test("plural forms and typos resolve",()=>{assert.equal(search.search("storms")[0].item.id,"hazel");assert.equal(search.search("huricane")[0].item.id,"hazel");});
test("natural query combines media, subject, and decade",()=>assert.equal(search.search("photos of boats in the 1950s")[0].item.id,"boat"));
test("collection descriptions improve conceptual recall",()=>assert.equal(search.search("coastal storms")[0].item.id,"hazel"));
test("one-character in-progress queries do not blank results",()=>assert.equal(search.search("h").length,items.length));
test("unrelated long terms do not match one-letter tokens",()=>assert.equal(search.search("zzqxvnotaword").length,0));
