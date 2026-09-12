const $=s=>document.querySelector(s),el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n;},nfmt=n=>n.toLocaleString("en-US");
const norm=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"");
function mosaic(db){const box=$("#mosaic");for(const iid of db.site.heroItemIds||[]){const it=db.items.find(x=>x.id===iid);if(!it)continue;const link=el("a","mosaic__item");link.href=`archive.html?item=${encodeURIComponent(it.id)}`;link.setAttribute("aria-label",`View ${it.title} in the archive`);const fig=el("figure");fig.append(thumbImg(it.media.thumbnail,{alt:it.title,eager:true}));link.append(fig);box.append(link);}}
function stats(db){const s=db.stats,span=s.yearStart?`${s.yearStart}–${s.yearEnd}`:"Dates being catalogued";for(const [n,label] of [[nfmt(s.total),"items available in this preview"],[nfmt(s.withThumbnail),"visual records you can preview"],[span,"years represented in catalogued material"],[nfmt(s.collectionCount),"curated collections to browse"]]){const d=el("div","stat");d.append(el("b",null,n),el("span",null,label));$("#stats").append(d);}}
function timeline(db){
  const subjectYears=db.items.map(i=>i.contentDate?.startYear).filter(Number.isInteger);
  const publicationYears=db.items.map(i=>i.publicationDate?.year).filter(Number.isInteger);
  const all=[...subjectYears,...publicationYears];if(!all.length)return;
  const from=Math.floor(Math.min(...all)/10)*10,to=Math.ceil((Math.max(...all)+1)/10)*10,bins=[];
  for(let y=from;y<to;y+=10)bins.push({y,subject:0,published:0});
  const add=(year,key)=>{const b=bins[Math.floor((year-from)/10)];if(b)b[key]++;};
  subjectYears.forEach(y=>add(y,"subject"));publicationYears.forEach(y=>add(y,"published"));
  const peak=Math.max(...bins.flatMap(b=>[b.subject,b.published]))||1;
  for(const b of bins){
    const a=el("a","tl__col");a.href=`archive.html?decade=${b.y}`;a.setAttribute("aria-label",`${b.y}s: ${nfmt(b.subject)} depict the decade; ${nfmt(b.published)} published or filed in it`);
    const tip=el("div","tl__tip");tip.innerHTML=`<strong>${b.y}s</strong><br>${nfmt(b.subject)} depict this decade<br>${nfmt(b.published)} published or filed in it`;
    const published=el("div","tl__bar tl__bar--pub");published.style.height=`${b.published/peak*100}%`;
    const subject=el("div","tl__bar tl__bar--subject");subject.style.height=`${b.subject/peak*100}%`;
    a.append(tip,published,subject);$("#tl").append(a);$("#tl-x").append(el("span",null,b.y%40===0?String(b.y):""));
  }
}

(async()=>{const db=await(await fetch("data/catalog.json")).json();mosaic(db);stats(db);timeline(db);})();
