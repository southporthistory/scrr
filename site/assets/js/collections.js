const $=s=>document.querySelector(s);
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;};
const nfmt=n=>n.toLocaleString("en-US");
const byOrder=(a,b)=>(a.sortOrder||0)-(b.sortOrder||0)||a.title.localeCompare(b.title,undefined,{sensitivity:"base",numeric:true});
const itemLabel=n=>`${nfmt(n)} item${n===1?"":"s"}`;

function collectionCard(collection,children){
  const link=el("a","collection-card");
  link.href=`archive.html?collection=${encodeURIComponent(collection.id)}`;
  const image=el("div","collection-card__image");
  image.append(collection.cover?thumbImg(collection.cover,{alt:""}):placeholderEl());
  const body=el("div","collection-card__body");
  if(children.length)body.append(el("div","collection-card__kind",`${children.length} subcollections`));
  body.append(el("h3",null,collection.title));
  if(collection.description)body.append(el("p",null,collection.description));
  const meta=el("div","collection-card__meta");
  meta.append(el("span",null,itemLabel(collection.itemCount)));
  body.append(meta);link.append(image,body);return link;
}

(async()=>{
  const db=await(await fetch("data/catalog.json")).json();
  const roots=db.collections.filter(collection=>!collection.parentId).sort(byOrder);
  const box=$("#groups");
  for(const root of roots){
    const children=db.collections.filter(collection=>collection.parentId===root.id).sort(byOrder);
    const section=el("section","collection-group");
    const heading=el("div","collection-group__head");
    heading.append(el("h2",null,root.title));
    if(root.description)heading.append(el("p",null,root.description));
    const grid=el("div","collection-overview");
    for(const child of children){
      const grandchildren=db.collections.filter(collection=>collection.parentId===child.id);
      grid.append(collectionCard(child,grandchildren));
    }
    section.append(heading,grid);box.append(section);
  }
})();
