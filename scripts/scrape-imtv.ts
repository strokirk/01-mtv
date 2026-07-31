// Scrapes the unofficial/community Medeltidsveckan programme (imtv.se).
//
// No API, no JSON, no ICS export exists — everything is server-rendered
// classic ASP HTML. The whole festival week is on the single homepage
// (https://imtv.se), structured as:
//
//   <dl>
//     <dt><h2><div id="dayN">Lördag 1/8</div></h2></dt>   <!-- weekday + day/month, NO YEAR -->
//     <dd><ul>
//       <li>
//         <span class="time">17:00</span>
//         <div>
//           <h3>Title</h3>
//           <img class="trigger" data-modalid="{GUID}">
//           <div class="modal" id="{GUID}"><div class="modal-content">
//             Skapad av:<br>Creator<br><br>Senast ändrad:<br><nobr>YYYY-MM-DD HH:MM:SS</nobr>
//           </div></div>
//           <p>Free-text description, sometimes "Plats: X", occasional <a> links.</p>
//         </div>
//       </li>
//       ...
//     </ul></dd>
//     <dt>...</dt>  <!-- next day -->
//   </dl>
//
// The day header never includes a year, so this script needs FESTIVAL_YEAR
// (env var, defaults to the current known festival year) to turn "1/8" into
// an ISO date. This is the single most likely thing to need updating by
// hand each year.
//
// GUIDs (data-modalid) are per-year, not stable across years — a yearly
// tradition gets re-submitted with a fresh GUID (confirmed by prior
// research). Series grouping is therefore a pure title (+creator) heuristic,
// same as the official scraper, and is expected to be lower-confidence here
// since organizers sometimes reword titles slightly year to year.
//
// No structured venue/category/price exist at all on this source — venue is
// best-effort extracted from a "Plats: ..." substring inside the free-text
// description when present (observed on ~4 of 57 sampled entries; most
// events simply don't state a location this way).
//
// Confirmed no CORS header on the response — server-side (CI) fetch only.

import * as cheerio from "cheerio";
import { writeFileSync, mkdirSync } from "node:fs";
import type { EventInstance } from "../src/schema.ts";
import { SCHEMA_VERSION } from "../src/schema.ts";
import { computeId, normalizeForKey } from "./lib/normalize.ts";

const IMTV_URL = "https://imtv.se";
const USER_AGENT = "Mozilla/5.0 (compatible; mtv-scraper/0.1; +https://github.com/strokirk/01-mtv)";
const FESTIVAL_YEAR = Number(process.env.FESTIVAL_YEAR ?? "2026");

// See scrape-official.ts for why this defaults to "fixtures" locally and is
// overridden in CI.
const OUT_DIR = process.env.SCRAPE_OUT_DIR ?? "fixtures";

const WEEKDAY_RE = /^(\S+)\s+(\d{1,2})\/(\d{1,2})(?:\s*-\s*(.*))?$/;

function dayLabelToDate(label: string): { date: string; dayNote?: string } | undefined {
  const match = label.trim().match(WEEKDAY_RE);
  if (!match) return undefined;
  const [, , dayStr, monthStr, dayNote] = match;
  const day = dayStr!.padStart(2, "0");
  const month = monthStr!.padStart(2, "0");
  return { date: `${FESTIVAL_YEAR}-${month}-${day}`, dayNote: dayNote || undefined };
}

interface RawEntry {
  date: string;
  time: string;
  title: string;
  guid?: string;
  creator?: string;
  lastModified?: string;
  description?: string;
  links: string[];
}

function extractLocationText(description: string | undefined): string | undefined {
  if (!description) return undefined;
  // Best-effort: "Plats: <venue>" up to the first sentence-ending period, or
  // to the end of the description if there isn't one. Free text, no fixed
  // schema on this source, so this is deliberately loose.
  const match = description.match(/Plats:\s*([^.]+)\.?/i);
  return match?.[1]?.trim() || undefined;
}

function parseEntries(html: string): RawEntry[] {
  const $ = cheerio.load(html);
  const entries: RawEntry[] = [];

  $("dl > dt").each((_, dt) => {
    const dayLabel = $(dt).find("h2 div[id^='day']").first().text().trim();
    const parsedDay = dayLabelToDate(dayLabel);
    if (!parsedDay) {
      console.warn(`Skipping unrecognized day header: ${JSON.stringify(dayLabel)}`);
      return;
    }

    const dd = $(dt).next("dd");
    dd.find("> ul > li").each((_, li) => {
      const $li = $(li);
      const time = $li.find("> span.time").first().text().trim();
      const container = $li.find("> div").first();
      const title = container.find("> h3").first().text().trim();
      if (!title) return;

      const guid = container.find("img.trigger").attr("data-modalid");
      const modalContentHtml = container.find(".modal .modal-content").first().html() ?? "";
      const creatorMatch = modalContentHtml.match(/Skapad av:<br\s*\/?>([^<]*)<br/);
      const lastModifiedMatch = modalContentHtml.match(/<nobr>([^<]*)<\/nobr>/);

      const description = container.find("> p").first().text().trim() || undefined;
      const links = container
        .find("> p a")
        .map((_, a) => $(a).attr("href"))
        .get()
        .filter((href): href is string => Boolean(href));

      entries.push({
        date: parsedDay.date,
        time,
        title,
        guid,
        creator: creatorMatch?.[1]?.trim() || undefined,
        lastModified: lastModifiedMatch?.[1]?.trim() || undefined,
        description,
        links,
      });
    });
  });

  return entries;
}

function normalizeEvent(entry: RawEntry): EventInstance {
  const venue = extractLocationText(entry.description);
  const seriesKey = `imtv:${[normalizeForKey(entry.title), entry.creator && normalizeForKey(entry.creator)].filter(Boolean).join(":")}`;
  const id = computeId(["imtv", entry.date, entry.time, normalizeForKey(entry.title), entry.creator]);

  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    source: "imtv",
    sourceId: entry.guid ?? id,
    seriesKey,
    title: entry.title,
    organizer: entry.creator,
    description: entry.description,
    date: entry.date,
    startTime: entry.time,
    venue,
    links: entry.links.length > 0 ? entry.links : undefined,
    lastModified: entry.lastModified,
    raw: entry,
  };
}

async function main() {
  console.log(`Fetching ${IMTV_URL} ...`);
  const res = await fetch(IMTV_URL, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${IMTV_URL} -> ${res.status}`);
  const html = await res.text();

  const entries = parseEntries(html);
  console.log(`Found ${entries.length} events across all days (FESTIVAL_YEAR=${FESTIVAL_YEAR}).`);

  const events = entries.map(normalizeEvent);

  mkdirSync(new URL(`../${OUT_DIR}/imtv`, import.meta.url), { recursive: true });
  const outPath = new URL(`../${OUT_DIR}/imtv/events.json`, import.meta.url);
  writeFileSync(outPath, JSON.stringify(events, null, 2) + "\n");
  console.log(`Wrote ${events.length} events to ${OUT_DIR}/imtv/events.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
