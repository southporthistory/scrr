const $=s=>document.querySelector(s);
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;};
const norm=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"");
const MOBILE=window.matchMedia("(max-width: 900px)");
const params=new URLSearchParams(location.search);
const toYear=value=>/^\d{4}$/.test(String(value||""))?Number(value):null;
const legacyDecades=params.getAll("decade").map(Number).filter(Number.isFinite);
const initialItemId=params.get("item");
let DB,SEARCH,shown=60,view="grid",scrollY=0,filterDraft=null,itemOpener=null,dateBounds={min:1700,max:new Date().getFullYear()},collectionById,childrenById,currentResults=[],pageObserver,isAppending=false,sortTouched=params.has("sort");
const expandedFacets=new Set();
const expandedCollectionNodes=new Set();
const state={
  q:params.get("q")||"",
  collection:params.getAll("collection"),
  type:params.getAll("type"),
  subject:params.getAll("subject"),
  dateFrom:toYear(params.get("yearFrom"))??(legacyDecades.length?Math.min(...legacyDecades):null),
  dateTo:toYear(params.get("yearTo"))??(legacyDecades.length?Math.max(...legacyDecades)+9:null),
  sort:params.get("sort")||(params.get("q")?"relevance":"chrono")
};
const arrayFilterKeys=["collection","type","subject"];
const visibleArrayKeys=["collection","type"];
const hasDateFilter=s=>Number.isInteger(s.dateFrom)||Number.isInteger(s.dateTo);

function collectionTitle(id){return collectionById.get(id)?.title||id;}
function collectionDescendants(id){const found=new Set([id]),queue=[id];while(queue.length){for(const child of childrenById.get(queue.shift())||[]){if(!found.has(child)){found.add(child);queue.push(child);}}}return found;}
function collectionPath(id){const path=[];let c=collectionById.get(id);while(c){path.unshift(c);c=c.parentId?collectionById.get(c.parentId):null;}return path;}
function collectionAncestors(id){return collectionPath(id).slice(0,-1).map(collection=>collection.id);}
function normalizeCollectionSelection(ids){const selected=new Set(ids);for(const id of [...selected])if(collectionAncestors(id).some(ancestor=>selected.has(ancestor)))selected.delete(id);return [...selected];}
function selectedAncestor(id,selected){let collection=collectionById.get(id);while(collection?.parentId){if(selected.has(collection.parentId))return collection.parentId;collection=collectionById.get(collection.parentId);}return null;}
function excludeCollectionBranch(selected,id){
  const explicit=selected.has(id);if(explicit){selected.delete(id);return;}
  const ancestor=selectedAncestor(id,selected);if(!ancestor)return;
  selected.delete(ancestor);let branch=id;
  while(branch!==ancestor){const parent=collectionById.get(branch)?.parentId;if(!parent)break;for(const sibling of childrenById.get(parent)||[])if(sibling!==branch)selected.add(sibling);branch=parent;}
}
function hay(i){return norm([i.title,i.description,i.publicationDate?.label,...i.subjects,...i.people,...i.places,...i.collectionIds.map(collectionTitle)].join(" "));}
function passes(i,s=state){
  const start=i.contentDate?.startYear,end=i.contentDate?.endYear??start;
  const datePass=!hasDateFilter(s)||(Number.isInteger(start)&&end>=(s.dateFrom??dateBounds.min)&&start<=(s.dateTo??dateBounds.max));
  return(!s.collection.length||s.collection.some(selected=>{const ids=collectionDescendants(selected);return i.collectionIds.some(cid=>ids.has(cid));}))
    &&(!s.type.length||s.type.includes(i.media.type))
    &&(!s.subject.length||s.subject.some(subject=>i.subjects.includes(subject)))
    &&datePass;
}
function yearCompare(a,b,key,dir){const ay=a[key]?.year??a[key]?.startYear,bx=b[key]?.year??b[key]?.startYear;if(ay==null&&bx==null)return a.title.localeCompare(b.title);if(ay==null)return 1;if(bx==null)return-1;return(ay-bx)*dir||a.title.localeCompare(b.title);}
function sorted(xs){if(state.sort==="relevance"&&state.q)return xs;return[...xs].sort((a,b)=>state.sort==="title"?a.title.localeCompare(b.title):state.sort==="published"?yearCompare(a,b,"publicationDate",-1):yearCompare(a,b,"contentDate",state.sort==="chrono-desc"?-1:1));}
function syncUrl({itemId=null}={}){
  const p=new URLSearchParams();if(state.q)p.set("q",state.q);
  for(const key of arrayFilterKeys)for(const value of state[key])p.append(key,value);
  if(Number.isInteger(state.dateFrom))p.set("yearFrom",state.dateFrom);
  if(Number.isInteger(state.dateTo))p.set("yearTo",state.dateTo);
  if(state.sort!=="chrono")p.set("sort",state.sort);
  if(itemId)p.set("item",itemId);
  history.replaceState(null,"",`${location.pathname}${p.size?"?"+p:""}`);
}
function lockPage(){scrollY=window.scrollY;document.body.style.position="fixed";document.body.style.top=`-${scrollY}px`;document.body.style.width="100%";document.documentElement.classList.add("modal-open");}
function unlockPage(){const restoreY=scrollY;document.activeElement?.blur();document.body.style.position="";document.body.style.top="";document.body.style.width="";document.documentElement.classList.remove("modal-open");document.body.getBoundingClientRect();const restore=()=>window.scrollTo({top:restoreY,left:0,behavior:"instant"});restore();requestAnimationFrame(()=>requestAnimationFrame(restore));setTimeout(restore,120);}
function cloneState(s){return{...s,...Object.fromEntries(arrayFilterKeys.map(key=>[key,[...s[key]]]))};}
function activeTarget(){return MOBILE.matches?(filterDraft||(filterDraft=cloneState(state))):state;}
function afterFacetChange(target){shown=60;if(MOBILE.matches)updateFilterCount(target);else apply();}

function facet(title,key,values,{limit=0}={}){
  const wrap=el("section","facet");
  const heading=el("h3","facet__title",title);
  const body=el("div","facet__body");
  const active=filterDraft||state,selected=new Set(active[key]),expanded=expandedFacets.has(key);
  // Expanded lists stay in their stable authored/alphabetical order. Selected
  // values are promoted only at the explicit collapse boundary.
  const ordered=expanded
    ? [...values]
    : [...values.filter(([value])=>selected.has(value)),...values.filter(([value])=>!selected.has(value))];
  const selectedCount=ordered.filter(([value])=>selected.has(value)).length;
  const visibleUnselected=Math.max(0,limit-selectedCount);
  let unselectedIndex=0,hiddenCount=0;
  for(const[value,label,count]of ordered){
    const isSelected=selected.has(value),row=el("label",isSelected?"opt opt--selected":"opt");
    if(limit&&!isSelected&&unselectedIndex++>=visibleUnselected){row.classList.add("opt--extra");hiddenCount++;}
    const input=document.createElement("input");input.type="checkbox";input.name=key;input.value=value;input.checked=isSelected;
    input.onchange=()=>{const target=activeTarget();target[key]=input.checked?[...target[key],value]:target[key].filter(candidate=>candidate!==value);const rail=$("#rail"),scrollTop=rail.scrollTop;renderRail();$("#rail").scrollTop=scrollTop;afterFacetChange(target);};
    row.append(input,el("span",null,label),el("em",null,String(count)));body.append(row);
  }
  if(hiddenCount){
    const more=el("button","facet__more");more.type="button";
    const syncExpanded=()=>{const isExpanded=expandedFacets.has(key);wrap.classList.toggle("facet--expanded",isExpanded);more.textContent=isExpanded?"Show less":`Show ${hiddenCount} more`;more.setAttribute("aria-expanded",String(isExpanded));};
    more.onclick=()=>{const rail=$("#rail"),scrollTop=rail.scrollTop;if(expandedFacets.has(key))expandedFacets.delete(key);else expandedFacets.add(key);renderRail();$("#rail").scrollTop=scrollTop;};
    syncExpanded();body.append(more);
  }else expandedFacets.delete(key);
  wrap.append(heading,body);return wrap;
}

function dateRangeFacet(){
  const target=filterDraft||state;
  const wrap=el("section","facet date-facet");
  const heading=el("h3","facet__title facet__title--visually-hidden","Date range");
  const body=el("div","facet__body date-filter");
  const counts=new Map();let dated=0;
  for(const item of DB.items){const year=item.contentDate?.startYear;if(!Number.isInteger(year))continue;dated++;const decade=Math.floor(year/10)*10;counts.set(decade,(counts.get(decade)||0)+1);}
  const first=Math.floor(dateBounds.min/10)*10,last=Math.floor(dateBounds.max/10)*10,bins=[];
  for(let decade=first;decade<=last;decade+=10)bins.push({decade,count:counts.get(decade)||0});
  const peak=Math.max(...bins.map(bin=>bin.count),1);
  const chart=el("div","date-chart");chart.setAttribute("aria-label",`Histogram of ${dated.toLocaleString()} records with known dates`);
  const bars=el("div","date-bars");
  for(const bin of bins){const bar=el("span","date-bar");bar.style.height=`${Math.max(bin.count?8:2,Math.sqrt(bin.count/peak)*100)}%`;bar.title=`${bin.decade}s: ${bin.count.toLocaleString()} records`;bars.append(bar);}
  const selected=el("div","date-selection");
  const makeHandle=(side,label)=>{const button=el("button",`date-handle date-handle--${side}`);button.type="button";button.setAttribute("role","slider");button.setAttribute("aria-label",label);return button;};
  const fromHandle=makeHandle("from","Earliest year"),toHandle=makeHandle("to","Latest year");
  const axis=el("div","date-axis");axis.append(el("span",null,String(dateBounds.min)),el("span",null,String(dateBounds.max)));
  chart.append(bars,selected,fromHandle,toHandle,axis);
  const fields=el("div","date-fields");
  const makeField=(label,side)=>{const shell=el("label","date-field");shell.append(el("span",null,label));const input=document.createElement("input");input.type="text";input.inputMode="numeric";input.pattern="[0-9]{4}";input.maxLength=4;input.autocomplete="off";input.dataset.side=side;shell.append(input);return{shell,input};};
  const fromField=makeField("From","from"),toField=makeField("To","to");fields.append(fromField.shell,el("span","date-fields__dash","to"),toField.shell);
  const error=el("p","date-error");error.hidden=true;
  const note=el("p","date-note");
  const presets=el("div","date-presets");
  const presetValues=[["All years",null,null],["Before 1900",dateBounds.min,1899],["1900–1949",1900,1949],["1950–1999",1950,1999],["2000–now",2000,dateBounds.max]];
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const shownRange=()=>({from:target.dateFrom??dateBounds.min,to:target.dateTo??dateBounds.max});
  const commit=(from,to,{final=true}={})=>{
    from=clamp(Math.round(from),dateBounds.min,dateBounds.max);to=clamp(Math.round(to),dateBounds.min,dateBounds.max);
    if(from>to)[from,to]=[to,from];target.dateFrom=from;target.dateTo=to;update();if(final)afterFacetChange(target);
  };
  const clear=()=>{target.dateFrom=null;target.dateTo=null;update();afterFacetChange(target);};
  for(const[label,from,to]of presetValues){const button=el("button","date-preset",label);button.type="button";button.onclick=()=>from==null?clear():commit(from,to);presets.append(button);}
  const HANDLE_DIAMETER=36;
  const ratio=year=>(year-dateBounds.min)/(dateBounds.max-dateBounds.min);
  const handlePosition=year=>`calc(${ratio(year)*100}% - ${HANDLE_DIAMETER/2}px)`;
  const visualPosition=year=>`${ratio(year)*100}%`;
  function update(){
    const{from,to}=shownRange(),active=hasDateFilter(target),fromRatio=ratio(from),toRatio=ratio(to);
    selected.style.left=visualPosition(from);selected.style.width=`${Math.max(0,toRatio-fromRatio)*100}%`;
    fromHandle.style.left=handlePosition(from);toHandle.style.left=handlePosition(to);
    fromField.input.value=from;toField.input.value=to;
    for(const[handle,value]of[[fromHandle,from],[toHandle,to]]){handle.setAttribute("aria-valuemin",dateBounds.min);handle.setAttribute("aria-valuemax",dateBounds.max);handle.setAttribute("aria-valuenow",value);handle.setAttribute("aria-valuetext",String(value));}
    [...bars.children].forEach((bar,index)=>bar.classList.toggle("is-selected",bins[index].decade+9>=from&&bins[index].decade<=to));
    for(const [index,button] of [...presets.children].entries()){const preset=presetValues[index];button.classList.toggle("is-active",preset[1]==null?!active:active&&from===preset[1]&&to===preset[2]);}
    const matching=active?DB.items.filter(item=>{const start=item.contentDate?.startYear,end=item.contentDate?.endYear??start;return Number.isInteger(start)&&end>=from&&start<=to;}).length:dated;
    note.hidden=!active;
    note.textContent=active?`Records without a known date are excluded. ${matching.toLocaleString()} records match this range.`:"";
  }
  const parseField=(input,side)=>{const value=toYear(input.value);if(value==null||value<dateBounds.min||value>dateBounds.max){input.setAttribute("aria-invalid","true");input.classList.add("is-invalid");error.textContent=`Enter a four-digit year from ${dateBounds.min} to ${dateBounds.max}.`;error.hidden=false;return;}for(const field of [fromField.input,toField.input]){field.removeAttribute("aria-invalid");field.classList.remove("is-invalid");}error.hidden=true;const range=shownRange();commit(side==="from"?value:range.from,side==="to"?value:range.to);};
  for(const{input}of[fromField,toField]){input.onfocus=()=>input.select();input.onchange=()=>parseField(input,input.dataset.side);input.onkeydown=event=>{if(event.key==="Enter"){event.preventDefault();parseField(input,input.dataset.side);if(!input.matches('[aria-invalid="true"]'))input.blur();}if(event.key==="Escape"){event.preventDefault();event.stopPropagation();update();input.blur();}};}
  const yearAt=event=>{const rect=chart.getBoundingClientRect(),value=clamp((event.clientX-rect.left)/Math.max(1,rect.width),0,1);return dateBounds.min+value*(dateBounds.max-dateBounds.min);};
  const installDrag=(handle,side)=>{
    let drag=null;
    const restore=()=>{if(!drag)return;target.dateFrom=drag.initialFrom;target.dateTo=drag.initialTo;drag=null;update();};
    handle.onpointerdown=event=>{if(event.button!==0&&event.pointerType==="mouse")return;event.preventDefault();drag={pointerId:event.pointerId,initialFrom:target.dateFrom,initialTo:target.dateTo,moved:false};handle.setPointerCapture(event.pointerId);};
    handle.onpointermove=event=>{if(!drag||event.pointerId!==drag.pointerId)return;const range=shownRange(),year=yearAt(event),from=side==="from"?Math.min(year,range.to):range.from,to=side==="to"?Math.max(year,range.from):range.to;const roundedFrom=Math.round(from),roundedTo=Math.round(to);if(roundedFrom===range.from&&roundedTo===range.to)return;drag.moved=true;commit(from,to,{final:false});};
    handle.onpointerup=event=>{if(!drag||event.pointerId!==drag.pointerId)return;const moved=drag.moved;drag=null;if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);if(moved)afterFacetChange(target);};
    handle.onpointercancel=restore;
    handle.onlostpointercapture=()=>{if(!drag)return;const moved=drag.moved;drag=null;if(moved)afterFacetChange(target);};
  };
  installDrag(fromHandle,"from");installDrag(toHandle,"to");
  chart.onclick=event=>{if(event.target===fromHandle||event.target===toHandle)return;const year=yearAt(event),range=shownRange(),side=Math.abs(year-range.from)<=Math.abs(year-range.to)?"from":"to";commit(side==="from"?Math.min(year,range.to):range.from,side==="to"?Math.max(year,range.from):range.to);};
  for(const[handle,side]of[[fromHandle,"from"],[toHandle,"to"]])handle.onkeydown=event=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;event.preventDefault();const range=shownRange(),step=event.shiftKey?10:1,current=side==="from"?range.from:range.to,value=event.key==="Home"?dateBounds.min:event.key==="End"?dateBounds.max:current+(event.key==="ArrowLeft"?-step:step);commit(side==="from"?Math.min(value,range.to):range.from,side==="to"?Math.max(value,range.from):range.to);};
  body.append(chart,fields,error,note,presets);wrap.append(heading,body);update();return wrap;
}

function collectionTreeFacet(){
  const target=filterDraft||state,selected=new Set(target.collection);
  const section=el("section","facet collection-tree-facet"),heading=el("h3","facet__title","Collections"),tree=el("div","collection-filter-tree");
  tree.setAttribute("role","tree");
  const byOrder=(a,b)=>(a.sortOrder||0)-(b.sortOrder||0)||a.title.localeCompare(b.title,undefined,{sensitivity:"base",numeric:true});
  function appendNode(collection,depth){
    const children=(childrenById.get(collection.id)||[]).map(id=>collectionById.get(id)).filter(child=>child?.itemCount).sort(byOrder);
    const row=el("div","collection-tree-row");row.style.setProperty("--tree-depth",depth);row.setAttribute("role","treeitem");row.setAttribute("aria-level",String(depth+1));
    const covered=selected.has(collection.id)||collectionAncestors(collection.id).some(id=>selected.has(id));
    const partial=!covered&&[...selected].some(id=>collectionDescendants(collection.id).has(id));
    if(children.length){const toggle=el("button","collection-tree-toggle",expandedCollectionNodes.has(collection.id)?"▾":"▸");toggle.type="button";toggle.setAttribute("aria-label",`${expandedCollectionNodes.has(collection.id)?"Collapse":"Expand"} ${collection.title}`);toggle.setAttribute("aria-expanded",String(expandedCollectionNodes.has(collection.id)));toggle.onclick=()=>{if(expandedCollectionNodes.has(collection.id))expandedCollectionNodes.delete(collection.id);else expandedCollectionNodes.add(collection.id);renderRail();};row.append(toggle);}else row.append(el("span","collection-tree-spacer"));
    const label=el("label","collection-tree-option");const input=document.createElement("input");input.type="checkbox";input.name="collection";input.value=collection.id;input.checked=covered;input.indeterminate=partial;input.setAttribute("aria-label",`${collection.title}, ${collection.itemCount.toLocaleString()} items${partial?", partially selected":""}`);
    input.onchange=()=>{const next=new Set(target.collection);if(input.checked){for(const id of [...next])if(collectionDescendants(collection.id).has(id))next.delete(id);next.add(collection.id);}else excludeCollectionBranch(next,collection.id);target.collection=normalizeCollectionSelection([...next]);afterFacetChange(target);renderRail();};
    label.append(input,el("span","collection-tree-label",collection.title),el("em",null,collection.itemCount.toLocaleString()));row.append(label);tree.append(row);
    if(children.length&&expandedCollectionNodes.has(collection.id))for(const child of children)appendNode(child,depth+1);
  }
  const roots=DB.collections.filter(collection=>!collection.parentId&&collection.itemCount).sort(byOrder);for(const root of roots)appendNode(root,0);
  section.append(heading,tree);return section;
}

function renderRail(){
  const rail=$("#rail");rail.innerHTML="";
  rail.append(dateRangeFacet());
  rail.append(collectionTreeFacet());
  rail.append(facet("Format","type",Object.entries(DB.facets.types).map(([key,count])=>[key,key[0].toUpperCase()+key.slice(1),count])));
}
function updateFilterCount(s=state){const n=visibleArrayKeys.reduce((total,key)=>total+s[key].length,0)+(hasDateFilter(s)?1:0),badge=$("#filter-count");badge.textContent=n;badge.hidden=!n;}
function openFilters(){filterDraft=cloneState(state);renderRail();updateFilterCount(filterDraft);$("#filter-panel").classList.add("on");$("#filter-scrim").classList.add("on");$("#filter-panel").setAttribute("aria-hidden","false");lockPage();$("#filter-close").focus();}
function closeFilters({applyDraft=false}={}){if(applyDraft&&filterDraft){for(const key of arrayFilterKeys)state[key]=[...filterDraft[key]];state.dateFrom=filterDraft.dateFrom;state.dateTo=filterDraft.dateTo;shown=60;}filterDraft=null;$("#filter-panel").classList.remove("on");$("#filter-scrim").classList.remove("on");$("#filter-panel").setAttribute("aria-hidden",String(MOBILE.matches));unlockPage();renderRail();updateFilterCount();if(applyDraft)apply();$("#filter-open").focus();}
function meta(i){return[i.contentDate?.label,i.media.type,collectionTitle(i.collectionIds[0])].filter(Boolean).join(" · ");}
function card(i){const button=el("button","card");button.type="button";const image=el("div","card__img");image.append(thumbImg(i.media.thumbnail,{alt:""}));const body=el("div","card__body");body.append(el("div","card__meta",meta(i)),el("div","card__title",i.title));button.append(image,body);button.onclick=()=>openItem(i);return button;}
function row(i){const button=el("button","result");button.type="button";const image=el("div","result__img");image.append(thumbImg(i.media.thumbnail));const body=el("div","result__body");body.append(el("h3",null,i.title),el("p",null,meta(i)));button.append(image,body);button.onclick=()=>openItem(i);return button;}
function openItem(i,{updateUrl=true}={}){itemOpener=document.activeElement;if(updateUrl)syncUrl({itemId:i.id});$("#drawer-kind").textContent=i.media.type;const image=$("#drawer-img");image.innerHTML="";image.append(thumbImg(i.media.thumbnail,{alt:i.title,eager:true}));const body=$("#drawer-body");body.innerHTML="";body.append(el("h2",null,i.title));if(i.description)body.append(el("p",null,i.description));const details=el("dl","dl"),add=(key,value)=>{if(value)details.append(el("dt",null,key),el("dd",null,value));};add("Date",i.contentDate?.label);add("Published / filed",i.publicationDate?.label);add("Collection",i.collectionIds.map(collectionTitle).join(", "));add("Subjects",i.subjects.join(", "));add("People",i.people.join(", "));add("Places",i.places.join(", "));body.append(details);const buttons=el("div","btnrow"),open=el("a","btn btn--primary","View original in Google Drive");open.href=i.media.viewUrl;open.target="_blank";open.rel="noopener noreferrer";buttons.append(open);body.append(buttons);$("#scrim").classList.add("on");$("#drawer").classList.add("on");$("#drawer").setAttribute("aria-hidden","false");lockPage();$("#drawer-x").focus();}
function closeItem(){syncUrl();$("#scrim").classList.remove("on");$("#drawer").classList.remove("on");$("#drawer").setAttribute("aria-hidden","true");unlockPage();setTimeout(()=>itemOpener?.focus({preventScroll:true}),130);}
function effectiveCollectionContexts(){
  const contexts=new Map();
  for(const selectedId of state.collection){
    const path=collectionPath(selectedId),selected=collectionById.get(selectedId);if(!selected)continue;
    const source=[...path].reverse().find(collection=>collection.description?.trim());
    if(!source)continue;
    const existing=contexts.get(source.id)||{source,selected:[]};existing.selected.push(selected);contexts.set(source.id,existing);
  }
  return [...contexts.values()];
}
function collectionContextBlock(entry,{compact=false}={}){
  const block=el("article",compact?"collection-context-note collection-context-note--compact":"collection-context-note");
  const title=el("h3",null,entry.source.title);block.append(title);
  const inherited=entry.selected.some(selected=>selected.id!==entry.source.id);
  if(inherited){const scopes=entry.selected.map(selected=>selected.title).join(", ");block.append(el("div","collection-context-note__scope",`Context for ${scopes}`));}
  for(const paragraph of entry.source.description.split(/\n\n+/).filter(Boolean))block.append(el("p",null,paragraph));
  return block;
}
function renderCollectionContext(){
  const box=$("#secnote");box.innerHTML="";
  const contexts=effectiveCollectionContexts();
  // Editorial context is shown only when the selected scope resolves to one
  // unambiguous description. Multiple distinct candidates are intentionally
  // omitted rather than composed into a misleading or noisy introduction.
  if(contexts.length!==1)return;
  const section=el("section","collection-context collection-context--single");
  section.append(collectionContextBlock(contexts[0]));box.append(section);
}
function filterLabel(key,value){if(key==="collection")return collectionTitle(value);if(key==="type")return value[0].toUpperCase()+value.slice(1);return value;}
function filterToken(label,onRemove){
  const token=el("span","chip"),text=el("span","chip__label",label),remove=el("button","chip__remove","×");
  remove.type="button";remove.setAttribute("aria-label",`Remove ${label} filter`);remove.onclick=onRemove;
  token.append(text,remove);return token;
}
function renderChips(){
  const box=$("#chips");box.innerHTML="";
  for(const key of arrayFilterKeys)for(const value of state[key]){
    if(key==="collection"&&effectiveCollectionContexts().length===1)continue;
    const label=filterLabel(key,value);
    box.append(filterToken(label,()=>{state[key]=state[key].filter(v=>v!==value);shown=60;renderRail();apply();}));
  }
  if(hasDateFilter(state)){
    const from=state.dateFrom??dateBounds.min,to=state.dateTo??dateBounds.max,label=`${from}–${to}`;
    box.append(filterToken(label,()=>{state.dateFrom=null;state.dateTo=null;shown=60;renderRail();apply();}));
  }
  // Search is already visible and removable in the search field; duplicating it
  // as a filter token creates a second owner for the same state.
  box.hidden=!box.childElementCount;
}
function updatePagination(){const more=$("#more"),remaining=Math.max(0,currentResults.length-shown);more.hidden=!remaining;more.textContent=remaining?`Load ${Math.min(60,remaining).toLocaleString()} more`:"";}
function appendNextPage(){if(isAppending||shown>=currentResults.length)return;isAppending=true;pageObserver?.unobserve($("#sentinel"));const grid=$("#grid"),start=shown;shown=Math.min(shown+60,currentResults.length);for(const item of currentResults.slice(start,shown))grid.append(view==="grid"?card(item):row(item));updatePagination();requestAnimationFrame(()=>{isAppending=false;if(shown<currentResults.length)pageObserver?.observe($("#sentinel"));});}
function apply(){syncUrl();renderChips();renderCollectionContext();const candidates=state.q?SEARCH.search(state.q).map(result=>result.item):DB.items;currentResults=sorted(candidates.filter(i=>passes(i)));$("#count").textContent=`${currentResults.length.toLocaleString()} item${currentResults.length===1?"":"s"}`;const grid=$("#grid");grid.className=view==="grid"?"grid":"results";grid.innerHTML="";shown=Math.min(shown,currentResults.length);for(const item of currentResults.slice(0,shown))grid.append(view==="grid"?card(item):row(item));updatePagination();updateFilterCount();}

(async()=>{
  DB=await(await fetch("data/catalog.json")).json();
  collectionById=new Map(DB.collections.map(c=>[c.id,c]));childrenById=new Map(DB.collections.map(c=>[c.id,[]]));for(const c of DB.collections)if(c.parentId&&childrenById.has(c.parentId))childrenById.get(c.parentId).push(c.id);
  SEARCH=ArchiveSearch.create(DB.items,DB.collections);
  for(const id of state.collection)for(const ancestor of collectionAncestors(id))expandedCollectionNodes.add(ancestor);
  const years=DB.items.map(i=>i.contentDate?.startYear).filter(Number.isInteger),currentYear=new Date().getFullYear();dateBounds={min:Math.min(...years),max:Math.max(currentYear,...years)};
  if(Number.isInteger(state.dateFrom))state.dateFrom=Math.max(dateBounds.min,Math.min(dateBounds.max,state.dateFrom));if(Number.isInteger(state.dateTo))state.dateTo=Math.max(dateBounds.min,Math.min(dateBounds.max,state.dateTo));
  const relevanceOption=$("#sort option[value=relevance]"),syncSearchControls=()=>{$("#q-clear").hidden=!state.q;relevanceOption.disabled=!state.q;};
  $("#q").value=state.q;$("#mobile-q").value=state.q;$("#sort").value=state.sort;syncSearchControls();
  const search=event=>{const wasEmpty=!state.q;state.q=event.target.value;$(event.target.id==="q"?"#mobile-q":"#q").value=state.q;if(state.q&&wasEmpty&&!sortTouched){state.sort="relevance";$("#sort").value="relevance";}if(!state.q&&state.sort==="relevance"){state.sort="chrono";$("#sort").value="chrono";}syncSearchControls();shown=60;apply();};$("#q").oninput=search;$("#mobile-q").oninput=search;
  $("#q-clear").onclick=()=>{$("#q").value="";$("#mobile-q").value="";state.q="";if(state.sort==="relevance"){state.sort="chrono";$("#sort").value="chrono";}syncSearchControls();shown=60;apply();};$("#sort").onchange=event=>{sortTouched=true;state.sort=event.target.value;apply();};$("#view").onchange=event=>{view=event.target.value;apply();};
  const backToTop=$("#back-to-top"),syncBackToTop=()=>{backToTop.hidden=window.scrollY<600;};
  backToTop.onclick=()=>window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  window.addEventListener("scroll",syncBackToTop,{passive:true});syncBackToTop();
  $("#drawer-x").onclick=closeItem;$("#scrim").onclick=closeItem;$("#filter-open").onclick=openFilters;$("#filter-close").onclick=()=>closeFilters();$("#filter-scrim").onclick=()=>closeFilters();$("#filter-apply").onclick=()=>closeFilters({applyDraft:true});
  $("#filter-clear").onclick=()=>{filterDraft={...cloneState(state),...Object.fromEntries(visibleArrayKeys.map(key=>[key,[]])),dateFrom:null,dateTo:null};renderRail();updateFilterCount(filterDraft);};
  document.addEventListener("keydown",event=>{if(event.key!=="Escape")return;if($("#drawer").classList.contains("on"))closeItem();else if($("#filter-panel").classList.contains("on"))closeFilters();});
  MOBILE.addEventListener("change",()=>{if(!MOBILE.matches&&$("#filter-panel").classList.contains("on"))closeFilters();renderRail();});
  $("#more").onclick=appendNextPage;
  pageObserver=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))appendNextPage();},{rootMargin:"500px 0px"});
  renderRail();apply();if(shown<currentResults.length)pageObserver.observe($("#sentinel"));
  if(initialItemId){const item=DB.items.find(candidate=>candidate.id===initialItemId);if(item)openItem(item);else{params.delete("item");syncUrl();}}
})();
