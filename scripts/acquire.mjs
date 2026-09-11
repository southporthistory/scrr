import { readJson, parseCsv, list, bool, intOrNull } from "./lib.mjs";

async function fetchText(url, label) {
  if (!url) throw new Error(`Missing ${label}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  return response.text();
}
function fromRows(itemRows, collectionRows) {
  return {
    schemaVersion: 1,
    site: {
      name: process.env.SITE_NAME || "Susie Carson Research Room",
      organization: process.env.SITE_ORGANIZATION || "Southport Historical Society",
      tagline: process.env.SITE_TAGLINE || "The records are still here. Come find the story.",
      intro: process.env.SITE_INTRO || "Explore the Society's digital archive."
    },
    collections: collectionRows.map(r => ({
      id:r.id, status:r.status || "draft", title:r.title, description:r.description || "",
      parentId:r.parent_id || null, sortOrder:intOrNull(r.sort_order) ?? 0, coverItemId:r.cover_item_id || null
    })),
    items: itemRows.map(r => ({
      id:r.id, status:r.status || "draft", title:r.title, description:r.description || "",
      collectionIds:list(r.collection_ids),
      contentDate:{label:r.display_date || "", startYear:intOrNull(r.start_year), endYear:intOrNull(r.end_year)},
      media:{type:r.media_type, driveFileId:r.drive_file_id, viewUrl:r.view_url},
      subjects:list(r.subjects), people:list(r.people), places:list(r.places), featured:bool(r.featured)
    }))
  };
}
export async function acquire() {
  const source = process.env.CATALOG_SOURCE || "fixture";
  if (source === "fixture") return readJson("content/fixture/catalog.json");
  if (source === "sheet") {
    const [items, collections] = await Promise.all([
      fetchText(process.env.SHEET_ITEMS_CSV_URL, "SHEET_ITEMS_CSV_URL"),
      fetchText(process.env.SHEET_COLLECTIONS_CSV_URL, "SHEET_COLLECTIONS_CSV_URL")
    ]);
    return fromRows(parseCsv(items), parseCsv(collections));
  }
  if (source === "json") return readJson(process.env.CATALOG_JSON_PATH || "content/catalog.json");
  throw new Error(`Unsupported CATALOG_SOURCE: ${source}`);
}
