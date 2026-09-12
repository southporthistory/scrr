const TYPES = new Set(["image","document","video","audio"]);
const uniq = xs => [...new Set(xs)];
export function validateCatalog(catalog) {
  const errors=[];
  if(catalog?.schemaVersion!==1)errors.push("schemaVersion must be 1");
  if(!catalog?.site?.name)errors.push("site.name is required");
  if(!catalog?.site?.organization)errors.push("site.organization is required");
  const cs=Array.isArray(catalog?.collections)?catalog.collections:[];
  const is=Array.isArray(catalog?.items)?catalog.items:[];
  const cids=new Set(), iids=new Set();
  for(const [n,c] of cs.entries()){
    const p=`collections[${n}]`;
    if(!c.id)errors.push(`${p}.id is required`); else if(cids.has(c.id))errors.push(`duplicate collection id: ${c.id}`); else cids.add(c.id);
    if(!c.title)errors.push(`${p}.title is required`);
  }
  for(const c of cs)if(c.parentId&&!cids.has(c.parentId))errors.push(`collection ${c.id} has unknown parentId ${c.parentId}`);
  const parentById=new Map(cs.map(c=>[c.id,c.parentId||null]));
  for(const c of cs){const seen=new Set([c.id]);let parent=c.parentId;while(parent){if(seen.has(parent)){errors.push(`collection hierarchy contains a cycle at ${c.id}`);break;}seen.add(parent);parent=parentById.get(parent);}}
  const heroIds=catalog?.site?.heroItemIds;
  if(!Array.isArray(heroIds)||heroIds.length!==6)errors.push("site.heroItemIds must contain exactly 6 ordered item IDs");
  else if(new Set(heroIds).size!==heroIds.length)errors.push("site.heroItemIds must not contain duplicates");
  for(const [n,i] of is.entries()){
    const p=`items[${n}]`;
    if(!i.id)errors.push(`${p}.id is required`); else if(iids.has(i.id))errors.push(`duplicate item id: ${i.id}`); else iids.add(i.id);
    if(!i.title)errors.push(`${p}.title is required`);
    if(!["draft","published","archived"].includes(i.status))errors.push(`${p}.status is invalid`);
    if(!Array.isArray(i.collectionIds)||!i.collectionIds.length)errors.push(`${p}.collectionIds requires at least one collection`);
    else for(const id of i.collectionIds)if(!cids.has(id))errors.push(`${p} references unknown collection ${id}`);
    if(!TYPES.has(i.media?.type))errors.push(`${p}.media.type is invalid`);
    if(!i.media?.viewUrl)errors.push(`${p}.media.viewUrl is required`);
    if(!i.media?.driveFileId)errors.push(`${p}.media.driveFileId is required`);
    if(i.homepageSlot!=null&&(!Number.isInteger(i.homepageSlot)||i.homepageSlot<1||i.homepageSlot>6))errors.push(`${p}.homepageSlot must be an integer from 1 to 6`);
    for(const k of ["startYear","endYear"]){const v=i.contentDate?.[k];if(v!=null&&(!Number.isInteger(v)||v<1000||v>2200))errors.push(`${p}.contentDate.${k} is invalid`);}
    if(i.contentDate?.startYear&&i.contentDate?.endYear&&i.contentDate.startYear>i.contentDate.endYear)errors.push(`${p}.contentDate starts after it ends`);
    if(i.publicationDate?.year!=null&&(!Number.isInteger(i.publicationDate.year)||i.publicationDate.year<1000||i.publicationDate.year>2200))errors.push(`${p}.publicationDate.year is invalid`);
  }
  const slots=is.filter(item=>item.homepageSlot!=null);
  if(new Set(slots.map(item=>item.homepageSlot)).size!==slots.length)errors.push("item homepageSlot values must be unique");
  const projectedHeroes=slots.sort((a,b)=>a.homepageSlot-b.homepageSlot).map(item=>item.id);
  if(projectedHeroes.length&&JSON.stringify(projectedHeroes)!==JSON.stringify(heroIds))errors.push("site.heroItemIds must match Items homepageSlot order");
  const itemById=new Map(is.map(item=>[item.id,item]));
  for(const id of heroIds||[]){const item=itemById.get(id);if(!item)errors.push(`site.heroItemIds references unknown item ${id}`);else if(item.status!=="published")errors.push(`site.heroItemIds references unpublished item ${id}`);}
  for(const c of cs)if(c.coverItemId){const item=itemById.get(c.coverItemId);if(!item)errors.push(`collection ${c.id} has unknown coverItemId ${c.coverItemId}`);else if(item.status!=="published")errors.push(`collection ${c.id} coverItemId references unpublished item ${c.coverItemId}`);}
  return errors;
}
export function compile(catalog) {
  const publishedItems=catalog.items.filter(i=>i.status==="published");
  const used=new Set(publishedItems.flatMap(i=>i.collectionIds));
  let changed=true; while(changed){changed=false;for(const c of catalog.collections){if(used.has(c.id)&&c.parentId&&!used.has(c.parentId)){used.add(c.parentId);changed=true;}}}
  const collections=catalog.collections.filter(c=>c.status==="published"&&used.has(c.id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)||a.title.localeCompare(b.title));
  const itemById=new Map(publishedItems.map(i=>[i.id,i]));
  const collectionById=new Map(collections.map(c=>[c.id,c]));
  const childrenById=new Map(collections.map(c=>[c.id,[]]));
  for(const c of collections)if(c.parentId&&childrenById.has(c.parentId))childrenById.get(c.parentId).push(c.id);
  const descendants=id=>{const found=new Set([id]),queue=[id];while(queue.length){for(const child of childrenById.get(queue.shift())||[]){if(!found.has(child)){found.add(child);queue.push(child);}}}return found;};
  const items=publishedItems.map(i=>({
    id:i.id,title:i.title,description:i.description||"",collectionIds:i.collectionIds,
    contentDate:i.contentDate||{label:"",startYear:null,endYear:null},publicationDate:i.publicationDate||null,media:{...i.media,thumbnail:`assets/thumbs/${i.media.driveFileId}.jpg`},
    subjects:uniq(i.subjects||[]),people:uniq(i.people||[]),places:uniq(i.places||[]),featured:!!i.featured
  }));
  const countFor=id=>{const ids=descendants(id);return items.filter(i=>i.collectionIds.some(cid=>ids.has(cid))).length;};
  const outputCollections=collections.map(c=>{const ids=descendants(c.id),cover=itemById.get(c.coverItemId)||items.find(i=>i.collectionIds.some(cid=>ids.has(cid)));return {id:c.id,title:c.title,description:c.description||"",parentId:c.parentId||null,sortOrder:c.sortOrder||0,itemCount:countFor(c.id),cover:cover?`assets/thumbs/${cover.media.driveFileId}.jpg`:null};});
  const years=items.map(i=>i.contentDate?.startYear).filter(Number.isInteger);
  const values=k=>uniq(items.flatMap(i=>i[k]||[])).sort((a,b)=>a.localeCompare(b));
  const types=Object.fromEntries([...TYPES].map(t=>[t,items.filter(i=>i.media.type===t).length]).filter(([,n])=>n));
  return {schemaVersion:1,generatedAt:new Date().toISOString(),site:catalog.site,collections:outputCollections,items,
    stats:{total:items.length,withThumbnail:items.length,dated:years.length,yearStart:years.length?Math.min(...years):null,yearEnd:years.length?Math.max(...years):null,collectionCount:collections.length},
    facets:{types,subjects:values("subjects"),people:values("people"),places:values("places")}};
}
