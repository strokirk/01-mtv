# Handoff: building the Medeltidsveckan programme viewer PWA

This repo (`strokirk/01-mtv`) is a combined personal programme viewer for
Medeltidsveckan (Gotland's medieval festival week), merging the **official**
programme (medeltidsveckan.se) and the **unofficial/community** programme
(imtv.se) into one schema, with favoriting/ignoring at both the series and
individual-instance level. "Öppettider" (opening hours) is dropped entirely —
only actual events matter.

**You are picking this up in a zero-egress environment — you cannot reach
the network at all, not even to fetch these two sites.** That's why
everything requiring live network access was already done in a prior session
with real internet access: research, schema design, both scrapers (tested
against the live sites), a representative sample dataset, and the CI job
that will keep the real dataset fresh. Your job is the PWA itself, built
entirely against the schema and sample data already committed here — you
should never need to touch the network to finish this.

## What's already done

- **Schema**: `src/schema.ts` — a zod schema for `EventInstance` (one
  festival event, from either source) and `UserState` (local
  favorite/ignore state). This is the contract for everything you build.
  Also see `schema/event.schema.json` (a generated JSON Schema mirror, in
  case you need schema validation outside the zod/TS toolchain).
- **Scrapers**: `scripts/scrape-official.ts` and `scripts/scrape-imtv.ts`,
  written and run against the live sites. Each writes normalized
  `EventInstance[]` to `fixtures/<source>/events.json`.
- **Sample data**: `fixtures/official/events.json` (27 events — 2 per
  category plus one full 5-instance recurring series, "TRiX ger –
  Eldiaden") and `fixtures/imtv/events.json` (52 events — this source's
  entire dataset, small enough that no sampling was needed; includes an
  organic 8-instance recurring series, "Ringmuren runt"). These are real
  scraped data, not synthetic — good enough to build and visually check the
  whole UI against.
- **Merged output**: `scripts/merge.ts` combines both sources into
  `data/events.json` (schema: `{ schemaVersion, generatedAt, events: [...] }`,
  validated against `EventsFileSchema`). This is the exact file your client
  app will fetch. Regenerate it any time with `npm run merge` (reads from
  `fixtures/` by default — no network needed).
- **CI**: `.github/workflows/scrape.yml` runs both scrapers for real every 3
  hours (`SAMPLE_PER_CATEGORY=0` for a full scrape) plus on manual dispatch,
  merges, and commits `data/events.json` if it changed. This is the *only*
  place live scraping happens — both sources are confirmed to send no CORS
  headers, so a client-side fetch of medeltidsveckan.se or imtv.se from a
  different origin will always be blocked by the browser. Don't try it.

Run `npm run typecheck` any time to confirm everything still compiles.

## The schema, in brief

```ts
interface EventInstance {
  schemaVersion: 1;
  id: string;              // stable synthetic id — same real event = same id across re-scrapes
  source: "official" | "imtv";
  sourceId: string;         // original pid/GUID — NOT stable cross-year, dedupe-within-run only
  seriesKey: string;        // heuristic grouping key for "this recurring thing" — see below
  title: string;
  organizer?: string;
  description?: string;     // HTML (official) or plain text (imtv)
  date: string;              // YYYY-MM-DD, Europe/Stockholm local
  startTime: string;         // "HH:MM"
  endTime?: string;
  venue?: string;
  category?: string;         // official only (cat-* slug); undefined for imtv
  image?: string;
  ticketUrl?: string;
  price?: string;
  bookingStatus?: "available" | "few-left" | "soldout"; // official only
  familyFriendly?: boolean;   // official only — NOT populated by the current scraper, see Known gaps
  includedInPass?: boolean;   // official only — same caveat
  editorTip?: boolean;        // official only
  links?: string[];           // imtv only
  lastModified?: string;      // imtv only
  raw: unknown;                // full original scraped payload — drift-tolerance escape hatch
}
```

A "series" (e.g. a show that repeats daily) is **not** a separate stored
entity — it's just every `EventInstance` sharing the same `seriesKey`. Group
by that field when you need to show "all instances of this thing" or let the
user favorite/ignore the whole series at once.

**Favorite/ignore precedence — implement this exactly, it's load-bearing
UX**: an instance-level decision always overrides the series-level default.
`src/schema.ts` already exports the resolver, use it rather than
reimplementing:

```ts
resolveDecision(event, userState) // -> "favorite" | "ignore" | "neutral"
```

Resolution order: `favoriteInstances`/`ignoreInstances` (by `id`) → else
`favoriteSeries`/`ignoreSeries` (by `seriesKey`) → else `"neutral"`. A user
can favorite an entire series and still ignore one specific instance of it,
or vice versa — the instance-level entry always wins. `UserState` is
**local-only** (IndexedDB), never synced or committed anywhere.

## Known gaps / things to work around

- **`familyFriendly` / `includedInPass` are never set.** These come from a
  filter form on the official site (`misc[family_friendly]`,
  `misc[included_in_pass]`) submitted against
  `/wp-admin/admin-ajax.php?action=mv_programme_search` with a page-scraped
  nonce — a first attempt at that request returned zero results, so the
  exact param shape is still unconfirmed. Both fields are optional in the
  schema; just don't build UI that assumes they're populated (e.g. a
  "family friendly" filter would currently show nothing). If you ever get
  network access to iterate on this, inspect the real request in a browser
  network tab while using the site's own filter UI.
- **`seriesKey` is a heuristic, not a guarantee.** It's
  `normalized(title [+ venue for official] [+ organizer for imtv])`.
  Organizers sometimes reword a yearly-recurring imtv event's title slightly
  year to year, which would silently split it into a "new" series. Don't
  build anything that assumes seriesKey stability is perfect — favoriting a
  series is a nice-to-have grouping, not a hard guarantee it'll always catch
  every future instance.
- **imtv `venue` is best-effort text extraction** from a "Plats: ..."
  substring inside free-text descriptions, present on maybe 5-10% of imtv
  events. Most imtv events simply have no structured venue at all — design
  the UI so a missing venue is a normal, common case, not an error state.
- **`FESTIVAL_YEAR` is hardcoded to `2026`** in
  `.github/workflows/scrape.yml` and defaults to `2026` in
  `scripts/scrape-imtv.ts`. imtv.se's day headers ("Lördag 1/8") never
  include a year, so this must be bumped by hand every year — flag this
  clearly if you're touching the CI workflow for a future festival.
- Both scrapers' `raw` field preserves the entire original scraped payload
  per event — if you ever find a normalized field is wrong or missing
  something you need, check `raw` before assuming the data isn't there.

## What's left: the PWA itself

Recommended stack (not yet scaffolded — this is your call to build):
**Vite + TypeScript**, a lightweight UI layer (plain TS or Preact — avoid a
heavy framework, this is mobile-first and needs to stay light on slow
festival-week network), **Dexie.js** for typed IndexedDB access (event
cache + `UserState`), **`vite-plugin-pwa`** for the service worker
(offline precache, install-as-PWA manifest).

Core behavior to build:

1. **Data loading**: fetch `data/events.json` same-origin (this repo will be
   served via GitHub Pages, so `/data/events.json` is same-origin — no CORS
   concern once deployed). Stale-while-revalidate: render instantly from
   whatever's cached in IndexedDB, refetch in the background when online,
   and diff the incoming events against what's cached **by `id`** so
   `UserState` entries survive a re-import even when unrelated fields
   (description, booking status) change underneath.
2. **List/day view**: group by `date`, then time — the merged
   `data/events.json` is already sorted this way. Both sources interleaved
   is fine; a small source badge/icon per event is probably enough
   distinction.
3. **Filters**: category (official only — 19 possible `cat-*` values, see
   `OfficialCategorySchema` in `src/schema.ts` for the full list and
   `scripts/lib/normalize.ts` for the Swedish-label-to-slug mapping) and
   venue at minimum. Don't build family-friendly/pass filters yet (see
   Known gaps above) unless you're also fixing that data gap.
4. **Favorite/ignore UI**: toggle at both the instance level (this specific
   occurrence) and the series level (all occurrences of this recurring
   thing), using `resolveDecision()` for the actual precedence logic. A
   "my schedule" view showing only favorited (and not individually ignored)
   instances is the main point of the whole app.
5. **Offline resilience**: this is explicitly for unreliable festival-week
   network — the app should be fully usable (browse, favorite, ignore) with
   zero network after the first successful load. Precache `data/events.json`
   and the app shell via the service worker.

To develop and test without any network access: use the committed
`fixtures/*/events.json` (via `npm run merge`, which needs no network) or
just point your dev server at the already-generated `data/events.json`
directly. Both are real scraped data, not placeholders.
