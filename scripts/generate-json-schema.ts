// Regenerates schema/event.schema.json from the canonical zod schema in
// src/schema.ts. Run this whenever src/schema.ts changes:
//   npx tsx scripts/generate-json-schema.ts
import { writeFileSync } from "node:fs";
import { zodToJsonSchema } from "zod-to-json-schema";
import { EventsFileSchema } from "../src/schema.ts";

const jsonSchema = zodToJsonSchema(EventsFileSchema, "EventsFile");
writeFileSync(
  new URL("../schema/event.schema.json", import.meta.url),
  JSON.stringify(jsonSchema, null, 2) + "\n"
);
console.log("Wrote schema/event.schema.json");
