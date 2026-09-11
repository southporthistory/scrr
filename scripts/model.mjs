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
    for(const k of ["startYear","endYear"]){const v=i.contentDate?.[k];if(v!=null&&(!Number.isInteger(v)||v<1000||v>2200))errors.push(`${p}.contentDate.${k} is invalid`);}
    if(i.contentDate?.startYear&&i.contentDate?.endYear&&i.contentDate.startYear>i.contentDate.endYear)errors.push(`${p}.contentDate starts after it ends`);
  }
  for(const c of cs)if(c.coverItemId&&!iids.has(c.coverItemId))errors.push(`collection ${c.id} has unknown coverItemId ${c.coverItemId}`);
  return errors;
}
export function compile(catalog) {
  const publishedItems=catalog.items.filter(i=>i.status==="published");
  const used=new Set(publishedItems.flatMap(i=>i.collectionIds));
  let changed=true; while(changed){changed=false;for(const c of catalog.collections){if(used.has(c.id)&&c.parentId&&!used.has(c.parentId)){used.add(c.parentId);changed=true;}}}
  const collections=catalog.collections.filter(c=>c.status==="published"&&used.has(c.id)).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)||a.title.localeCompare(b.title));
  const itemById=new Map(publishedItems.map(i=>[i.id,i]));
  const collectionById=new Map(collections.map(c=>[c.id,c]));
  const items=publishedItems.map(i=>({
    id:i.id,title:i.title,description:i.description||"",collectionIds:i.collectionIds,
    contentDate:i.contentDate||{label:"",startYear:null,endYear:null},media:{...i.media,thumbnail:`assets/thumbs/${i.media.driveFileId}.jpg`},
    subjects:uniq(i.subjects||[]),people:uniq(i.people||[]),places:uniq(i.places||[]),featured:!!i.featured
  }));
  const countFor=id=>items.filter(i=>i.collectionIds.includes(id)||i.collectionIds.some(cid=>collectionById.get(cid)?.parentId===id)).length;
  const outputCollections=collections.map(c=>{const cover=itemById.get(c.coverItemId)||items.find(i=>i.collectionIds.includes(c.id));return {id:c.id,title:c.title,description:c.description||"",parentId:c.parentId||null,sortOrder:c.sortOrder||0,itemCount:countFor(c.id),cover:cover?`assets/thumbs/${cover.media.driveFileId}.jpg`:null};});
  const years=items.map(i=>i.contentDate?.startYear).filter(Number.isInteger);
  const values=k=>uniq(items.flatMap(i=>i[k]||[])).sort((a,b)=>a.localeCompare(b));
  const types=Object.fromEntries([...TYPES].map(t=>[t,items.filter(i=>i.media.type===t).length]).filter(([,n])=>n));
  return {schemaVersion:1,generatedAt:new Date().toISOString(),site:catalog.site,collections:outputCollections,items,
    stats:{total:items.length,withThumbnail:items.length,dated:years.length,yearStart:years.length?Math.min(...years):null,yearEnd:years.length?Math.max(...years):null,collectionCount:collections.filter(c=>c.parentId).length},
    facets:{types,subjects:values("subjects"),people:values("people"),places:values("places")}};
}
