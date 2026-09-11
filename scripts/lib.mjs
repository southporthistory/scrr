import fs from "node:fs/promises";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const readJson = async (p) => JSON.parse(await fs.readFile(path.resolve(ROOT, p), "utf8"));
export const writeJson = async (p, value) => {
  const full = path.resolve(ROOT, p); await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(value, null, 2) + "\n");
};
export const list = (value) => String(value || "").split("|").map(s => s.trim()).filter(Boolean);
export const bool = (value) => /^(1|true|yes)$/i.test(String(value || ""));
export const intOrNull = (value) => value === "" || value == null ? null : Number.parseInt(value, 10);
export function parseCsv(text) {
  const rows=[]; let row=[], field="", quote=false;
  for(let i=0;i<text.length;i++){const c=text[i], n=text[i+1];
    if(quote){if(c==='"'&&n==='"'){field+='"';i++;}else if(c==='"')quote=false;else field+=c;}
    else if(c==='"')quote=true; else if(c===','){row.push(field);field="";} else if(c==='\n'){row.push(field);rows.push(row);row=[];field="";} else if(c!=='\r')field+=c;
  }
  if(field||row.length){row.push(field);rows.push(row);} const [head,...body]=rows;
  if(!head)return []; return body.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(head.map((h,i)=>[h.trim(),r[i]??""])));
}
export const slug = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
