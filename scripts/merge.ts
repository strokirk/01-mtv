// Combines the per-source scraped events (scripts/scrape-official.ts and
// scripts/scrape-imtv.ts, which write fixtures/<source>/events.json) into
// the single file the client app actually fetches: public/data/events.json.
// It lives under public/ specifically so Vite serves it as a static asset
// at /data/events.json both in dev and in the built dist/ output — same
// origin as the app once deployed, no CORS involved.
//
// Validates the merged result against EventsFileSchema before writing, so a
// broken scrape (or a schema drift after a site redesign) fails the CI run
// loudly instead of publishing corrupt data the app would then have to
// defend against at runtime.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { EventInstanceSchema, EventsFileSchema, SCHEMA_VERSION } from "../src/schema.ts";
import type { EventInstance } from "../src/schema.ts";

const SOURCES = ["official", "imtv"] as const;

// Matches SCRAPE_OUT_DIR in scrape-official.ts / scrape-imtv.ts: "fixtures"
// locally (the committed, hand-curated sample), overridden by CI to an
// ignored scratch dir for the real full-scrape run.
const OUT_DIR = process.env.SCRAPE_OUT_DIR ?? "fixtures";

function readSource(source: (typeof SOURCES)[number]): EventInstance[] {
  const path = new URL(`../${OUT_DIR}/${source}/events.json`, import.meta.url);
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    console.warn(`No ${OUT_DIR}/${source}/events.json found — skipping (run npm run scrape:${source} first).`);
    return [];
  }
  const parsed = JSON.parse(raw);
  const validated: EventInstance[] = [];
  for (const item of parsed) {
    const result = EventInstanceSchema.safeParse(item);
    if (result.success) {
      validated.push(result.data);
    } else {
      console.error(`Dropping invalid ${source} event (id=${item?.id}):`, result.error.issues);
    }
  }
  return validated;
}

function main() {
  const events = SOURCES.flatMap(readSource);

  const seenIds = new Set<string>();
  const deduped: EventInstance[] = [];
  for (const event of events) {
    if (seenIds.has(event.id)) {
      console.warn(`Duplicate event id ${event.id} (${event.source} "${event.title}") — keeping first occurrence.`);
      continue;
    }
    seenIds.add(event.id);
    deduped.push(event);
  }

  deduped.sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));

  const eventsFile = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    events: deduped,
  };

  const validation = EventsFileSchema.safeParse(eventsFile);
  if (!validation.success) {
    console.error("Merged events file failed schema validation:", validation.error.issues);
    process.exit(1);
  }

  mkdirSync(new URL("../public/data", import.meta.url), { recursive: true });
  const outPath = new URL("../public/data/events.json", import.meta.url);
  writeFileSync(outPath, JSON.stringify(validation.data, null, 2) + "\n");

  console.log(
    `Wrote public/data/events.json: ${deduped.length} events (${deduped.filter((e) => e.source === "official").length} official, ${deduped.filter((e) => e.source === "imtv").length} imtv).`
  );
}

main();
