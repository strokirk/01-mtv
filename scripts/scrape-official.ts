// Scrapes the official Medeltidsveckan programme (medeltidsveckan.se).
//
// There is no public API for the `mv_programme` post type. Instead:
//   1. The full programme list HTML (/programme/) embeds every event card
//      for all festival days in one page load (day tabs are just CSS
//      show/hide, not separate requests) — so one fetch gets every pid.
//   2. Each card in that HTML is an <article class="programme-item"
//      data-pid="...">, nested inside a <section class="day"
//      data-date="YYYY-MM-DD">. "Öppettider" (opening hours) entries live in
//      a separate <div id="hours-..."> accordion using <a data-pid="...">,
//      NOT <article data-pid="...">, so selecting only `article[data-pid]`
//      excludes them automatically — no category filtering needed.
//   3. Per-event detail (description, organizer, exact venue, ticket link,
//      sibling occurrences) comes from an undocumented public AJAX GET:
//        /?async=true&action=fetch-programme-item&pid=<pid>
//      which returns JSON despite a `text/html` content-type (must
//      JSON.parse the body text, not use res.json()). No auth/nonce
//      required, no CORS header present (server-side fetch only).
//
// Known gap: the `familyFriendly` / `includedInPass` filter booleans are not
// visible in the static list HTML or in the per-event AJAX payload — they
// only show up as filter checkboxes in the offcanvas filter form
// (misc[family_friendly], misc[included_in_pass]) submitted against
// /wp-admin/admin-ajax.php?action=mv_programme_search with a page-scraped
// nonce. A first attempt at that endpoint (nonce + misc[family_friendly]=1)
// returned zero matches, so the exact request shape is still unconfirmed —
// left as a TODO for whoever refines the production CI scraper (try
// inspecting the real request in a browser network tab). Both fields are
// optional in the schema and are simply omitted for now.

import * as cheerio from "cheerio";
import { decodeHTML } from "entities";
import { writeFileSync, mkdirSync } from "node:fs";
import type { EventInstance, BookingStatus } from "../src/schema.ts";
import { SCHEMA_VERSION } from "../src/schema.ts";
import { computeId, normalizeForKey, categoryLabelToSlug } from "./lib/normalize.ts";

const PROGRAMME_URL = "https://www.medeltidsveckan.se/programme/";
const USER_AGENT = "Mozilla/5.0 (compatible; mtv-scraper/0.1; +https://github.com/strokirk/01-mtv)";

// How many sample events to keep *per category*, for the representative
// fixture set. Set SAMPLE_PER_CATEGORY=0 (or omit) to keep every card found
// (full scrape) — this is what the production CI job should do.
const SAMPLE_PER_CATEGORY = Number(process.env.SAMPLE_PER_CATEGORY ?? "2");

// Where per-source raw output gets written, read by scripts/merge.ts. Local/
// dev default is "fixtures" (the small, hand-curated, committed sample). CI's
// production run overrides this to an ignored scratch dir so a full scrape
// never clobbers the curated fixtures — see .github/workflows/scrape.yml.
const OUT_DIR = process.env.SCRAPE_OUT_DIR ?? "fixtures";

interface CardPreview {
  pid: string;
  date: string;
  time: string;
  titleText: string;
  categoryLabel?: string;
  ticketUrl?: string;
  editorTip: boolean;
  bookingStatus?: BookingStatus;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

function parseCards(html: string): CardPreview[] {
  const $ = cheerio.load(html);
  const cards: CardPreview[] = [];

  $("section.day[data-date]").each((_, daySection) => {
    const date = $(daySection).attr("data-date")!;

    $(daySection)
      .find("article.programme-item[data-pid]")
      .each((_, el) => {
        const $el = $(el);
        const pid = $el.attr("data-pid");
        if (!pid) return;

        const time = $el.find(".card-body .float-end").first().text().trim();
        const titleText = $el.find(".card-body strong").first().text().trim();

        const $footer = $el.find(".card-footer").first().clone();
        $footer.find("a").remove();
        const categoryLabel = $footer.text().trim() || undefined;

        const ticketUrl = $el.find(".card-footer a").first().attr("href") || undefined;

        const badgeText = $el.find(".badge").text().trim();
        const editorTip = /veckan tipsar/i.test(badgeText);
        let bookingStatus: BookingStatus | undefined;
        if (/fullbokad/i.test(badgeText)) bookingStatus = "soldout";
        else if (/f[åa] biljetter kvar/i.test(badgeText)) bookingStatus = "few-left";

        cards.push({ pid, date, time, titleText, categoryLabel, ticketUrl, editorTip, bookingStatus });
      });
  });

  return cards;
}

function sampleByCategory(cards: CardPreview[], perCategory: number): CardPreview[] {
  if (perCategory <= 0) return cards;
  const seenPerCategory = new Map<string, number>();
  const sample: CardPreview[] = [];
  for (const card of cards) {
    const key = card.categoryLabel ?? "(none)";
    const count = seenPerCategory.get(key) ?? 0;
    if (count >= perCategory) continue;
    seenPerCategory.set(key, count + 1);
    sample.push(card);
  }
  return sample;
}

// Finds the first title that recurs across multiple cards (same normalized
// title, different date/pid) and returns every instance of it. This
// guarantees the representative sample actually demonstrates a recurring
// series end-to-end, rather than relying on the per-category quota to
// stumble onto one by chance.
function findDemoSeries(allCards: CardPreview[]): CardPreview[] {
  const byTitle = new Map<string, CardPreview[]>();
  for (const card of allCards) {
    const key = normalizeForKey(card.titleText);
    const group = byTitle.get(key) ?? [];
    group.push(card);
    byTitle.set(key, group);
  }
  for (const group of byTitle.values()) {
    if (group.length >= 2) return group;
  }
  return [];
}

interface OfficialDetail {
  image?: string;
  header?: { item_owner?: string; title?: string };
  content?: {
    description?: string;
    siblings?: Record<string, { day: string; time: string; timestamp: number; title: string }>;
  };
  sidebar?: {
    dayName?: string;
    date?: string;
    time?: string; // "HH:MM - HH:MM"
    venue?: string;
    ticket_link?: string;
  };
}

async function fetchDetail(pid: string): Promise<OfficialDetail> {
  const url = `https://www.medeltidsveckan.se/?async=true&action=fetch-programme-item&pid=${pid}`;
  const text = await fetchText(url);
  return JSON.parse(text);
}

// WordPress serializes these "plain text" JSON fields through its usual
// title/content filters, so they can still contain literal HTML entities
// (e.g. "TRiX ger &#8211; Eldiaden") even though they're not HTML — decode
// before use so slugified seriesKey/id and displayed text match reality.
function decodeMaybe(s: string | undefined): string | undefined {
  return s ? decodeHTML(s) : s;
}

function normalizeEvent(card: CardPreview, detail: OfficialDetail): EventInstance {
  const venue = decodeMaybe(detail.sidebar?.venue) || undefined;
  const organizer = decodeMaybe(detail.header?.item_owner) || undefined;
  const title = decodeMaybe(detail.header?.title) || card.titleText;
  const date = detail.sidebar?.date || card.date;

  const timeRange = detail.sidebar?.time ?? "";
  const [startTimeRaw, endTimeRaw] = timeRange.split("-").map((s) => s.trim());
  const startTime = startTimeRaw || card.time;
  const endTime = endTimeRaw || undefined;

  const seriesKey = `official:${[normalizeForKey(title), venue && normalizeForKey(venue)].filter(Boolean).join(":")}`;
  const id = computeId(["official", date, startTime, normalizeForKey(title), venue]);

  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    source: "official",
    sourceId: card.pid,
    seriesKey,
    title,
    organizer,
    description: detail.content?.description,
    date,
    startTime,
    endTime,
    venue,
    category: card.categoryLabel ? categoryLabelToSlug(card.categoryLabel) : undefined,
    image: detail.image,
    ticketUrl: detail.sidebar?.ticket_link || card.ticketUrl,
    bookingStatus: card.bookingStatus,
    editorTip: card.editorTip || undefined,
    raw: { card, detail },
  };
}

async function main() {
  console.log(`Fetching ${PROGRAMME_URL} ...`);
  const html = await fetchText(PROGRAMME_URL);

  const allCards = parseCards(html);
  console.log(`Found ${allCards.length} event cards (excludes Öppettider entries).`);

  let cards = sampleByCategory(allCards, SAMPLE_PER_CATEGORY);
  console.log(
    SAMPLE_PER_CATEGORY > 0
      ? `Sampling ${cards.length} cards (${SAMPLE_PER_CATEGORY} per category).`
      : `Fetching detail for all ${cards.length} cards (full scrape).`
  );

  if (SAMPLE_PER_CATEGORY > 0) {
    const demoSeries = findDemoSeries(allCards);
    const pidsAlreadyIncluded = new Set(cards.map((c) => c.pid));
    const missing = demoSeries.filter((c) => !pidsAlreadyIncluded.has(c.pid));
    if (missing.length > 0) {
      console.log(
        `Adding ${missing.length} extra card(s) so the sample includes a full recurring series: "${demoSeries[0]?.titleText}" (${demoSeries.length} instances).`
      );
      cards = [...cards, ...missing];
    }
  }

  const events: EventInstance[] = [];
  for (const [i, card] of cards.entries()) {
    process.stdout.write(`\r  [${i + 1}/${cards.length}] pid=${card.pid}          `);
    try {
      const detail = await fetchDetail(card.pid);
      events.push(normalizeEvent(card, detail));
    } catch (err) {
      console.warn(`\nFailed to fetch detail for pid ${card.pid}:`, (err as Error).message);
    }
  }
  console.log();

  mkdirSync(new URL(`../${OUT_DIR}/official`, import.meta.url), { recursive: true });
  const outPath = new URL(`../${OUT_DIR}/official/events.json`, import.meta.url);
  writeFileSync(outPath, JSON.stringify(events, null, 2) + "\n");
  console.log(`Wrote ${events.length} events to ${OUT_DIR}/official/events.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
