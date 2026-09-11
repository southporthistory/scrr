import { acquire } from "./acquire.mjs";
import { validateCatalog } from "./model.mjs";
const errors=validateCatalog(await acquire());
if(errors.length){console.error(`Catalog rejected (${errors.length} errors):\n- ${errors.join("\n- ")}`);process.exit(1);}
console.log("Catalog valid");
