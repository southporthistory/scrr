(function(root){
  "use strict";
  const STOP=new Set("a an and are as at be by for from had has have in into is it its of on or that the their there this to was were what when where which who with".split(" "));
  const MEDIA=new Map([
    ["photo","image"],["photograph","image"],["image","image"],["picture","image"],["portrait","image"],
    ["video","video"],["movie","video"],["film","video"],
    ["audio","audio"],["recording","audio"],
    ["document","document"],["report","document"],["pdf","document"],["paper","document"]
  ]);
  const normalize=value=>String(value||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"").replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim();
  const stem=word=>{
    if(word.length>4&&word.endsWith("ies"))return word.slice(0,-3)+"y";
    if(word.length>4&&/(ches|shes|sses|xes|zes)$/.test(word))return word.slice(0,-2);
    if(word.length>3&&word.endsWith("s")&&!word.endsWith("ss"))return word.slice(0,-1);
    return word;
  };
  const tokens=value=>normalize(value).split(/\s+/).filter(Boolean).map(stem);
  const editWithin=(a,b,limit)=>{
    if(Math.abs(a.length-b.length)>limit)return false;
    let previous=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const current=[i],from=Math.max(1,i-limit),to=Math.min(b.length,i+limit);
      for(let j=1;j<from;j++)current[j]=limit+1;
      let rowMin=limit+1;
      for(let j=from;j<=to;j++){
        current[j]=Math.min(previous[j]+1,current[j-1]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
        rowMin=Math.min(rowMin,current[j]);
      }
      for(let j=to+1;j<=b.length;j++)current[j]=limit+1;
      if(rowMin>limit)return false;
      previous=current;
    }
    return previous[b.length]<=limit;
  };
  const parseQuery=query=>{
    const raw=normalize(query),all=raw.split(/\s+/).filter(Boolean),terms=[],media=new Set(),years=[];
    for(const rawToken of all){
      if(STOP.has(rawToken))continue;
      const decade=rawToken.match(/^(1[7-9]\d|20\d)0s$/);if(decade){years.push({from:Number(decade[1]+"0"),to:Number(decade[1]+"0")+9,label:rawToken});continue;}
      if(/^\d{4}$/.test(rawToken)){years.push({from:Number(rawToken),to:Number(rawToken),label:rawToken});continue;}
      const token=stem(rawToken),type=MEDIA.get(token);if(type){media.add(type);continue;}
      terms.push(token);
    }
    return{raw,terms:[...new Set(terms)],media:[...media],years};
  };
  function create(items,collections){
    const collectionById=new Map(collections.map(c=>[c.id,c])),documents=new Map(),postings=new Map();
    const collectionText=item=>{
      const seen=new Set(),parts=[];
      for(const id of item.collectionIds){let c=collectionById.get(id);while(c&&!seen.has(c.id)){seen.add(c.id);parts.push(c.title,c.description||"");c=c.parentId?collectionById.get(c.parentId):null;}}
      return parts.join(" ");
    };
    const add=(map,text,weight)=>{for(const token of tokens(text))map.set(token,Math.max(map.get(token)||0,weight));};
    for(const item of items){
      const weighted=new Map(),entityText=[...(item.people||[]),...(item.places||[]),...(item.subjects||[])].join(" "),collectionsText=collectionText(item);
      add(weighted,item.title,12);add(weighted,entityText,10);add(weighted,item.description,7);add(weighted,collectionsText,5);
      add(weighted,item.publicationDate?.label,3);add(weighted,item.contentDate?.label,4);
      const doc={item,title:normalize(item.title),entities:normalize(entityText),collections:normalize(collectionsText),weighted};documents.set(item.id,doc);
      for(const[token,weight]of weighted){if(!postings.has(token))postings.set(token,new Map());postings.get(token).set(item.id,weight);}
    }
    const vocabulary=[...postings.keys()];
    function matchingTokens(queryToken){
      const exact=postings.has(queryToken)?[[queryToken,1]]:[],matches=[];
      for(const token of vocabulary){
        if(token===queryToken)continue;
        if(queryToken.length>=2&&token.startsWith(queryToken)){matches.push([token,queryToken.length/token.length*.9]);continue;}
        const limit=queryToken.length>=8?2:queryToken.length>=5?1:0;
        if(limit&&editWithin(queryToken,token,limit))matches.push([token,.62-(limit-1)*.06]);
      }
      return exact.concat(matches.sort((a,b)=>b[1]-a[1]).slice(0,24));
    }
    function search(query){
      const parsed=parseQuery(query);if(!parsed.raw||(parsed.terms.length&&parsed.terms.every(term=>term.length<2)&&!parsed.media.length&&!parsed.years.length))return items.map(item=>({item,score:0,coverage:0}));
      const scores=new Map(),coverage=new Map(),concepts=[];
      for(const term of parsed.terms){
        const perDoc=new Map();
        for(const[token,quality]of matchingTokens(term))for(const[id,weight]of postings.get(token)||[]){perDoc.set(id,Math.max(perDoc.get(id)||0,weight*quality));}
        concepts.push(perDoc);
      }
      for(const type of parsed.media){const perDoc=new Map();for(const item of items)if(item.media.type===type)perDoc.set(item.id,8);concepts.push(perDoc);}
      for(const range of parsed.years){const perDoc=new Map();for(const item of items){const start=item.contentDate?.startYear,end=item.contentDate?.endYear??start;if(Number.isInteger(start)&&end>=range.from&&start<=range.to)perDoc.set(item.id,9);}concepts.push(perDoc);}
      for(const concept of concepts)for(const[id,value]of concept){scores.set(id,(scores.get(id)||0)+value);coverage.set(id,(coverage.get(id)||0)+1);}
      for(const[id,doc]of documents){
        if(parsed.raw.length>=3){if(doc.title===parsed.raw)scores.set(id,(scores.get(id)||0)+50);else if(doc.title.includes(parsed.raw))scores.set(id,(scores.get(id)||0)+24);else if(doc.entities.includes(parsed.raw))scores.set(id,(scores.get(id)||0)+16);else if(doc.collections.includes(parsed.raw))scores.set(id,(scores.get(id)||0)+8);}
      }
      // Prefer records satisfying the largest number of concepts found anywhere.
      // Unknown words do not zero an otherwise useful query, while a natural
      // query with media + subject + decade does not degrade into media + decade.
      const maxCoverage=Math.max(0,...coverage.values()),minimum=Math.max(1,maxCoverage);
      return [...scores.keys()].filter(id=>(coverage.get(id)||0)>=minimum).map(id=>({item:documents.get(id).item,score:scores.get(id),coverage:coverage.get(id)})).sort((a,b)=>b.coverage-a.coverage||b.score-a.score||a.item.title.localeCompare(b.item.title));
    }
    return{search,parseQuery,documentCount:documents.size,termCount:vocabulary.length};
  }
  root.ArchiveSearch={create,normalize,parseQuery,editWithin};
})(globalThis);
