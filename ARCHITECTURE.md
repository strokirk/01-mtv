# Architecture & schema reference

This repo (`strokirk/01-mtv`) is a combined personal programme viewer for
Medeltidsveckan (Gotland's medieval festival week), merging the **official**
programme (medeltidsveckan.se) and the **unofficial/community** programme
(imtv.se) into one schema, with favoriting/ignoring at both the series and
individual-instance level. "Öppettider" (opening hours) is dropped entirely —
only actual events matter.

Both the data pipeline and the client PWA are built and deployed:
**https://strokirk.github.io/01-mtv/**. This doc is the reference for how it
fits together — read `docs/FINDINGS.md` for the raw research behind the
scraper design, and `docs/FUTURE.md` for deferred ideas.

## What's built

- **Schema**: `src/schema.ts` — a zod schema for `EventInstance` (one
  festival event, from either source) and `UserState` (local
  favorite/ignore state). This is the contract everything else builds on.
  Also see `schema/event.schema.json` (a generated JSON Schema mirror, in
  case you need schema validation outside the zod/TS toolchain).
- **Scrapers**: `scripts/scrape-official.ts` and `scripts/scrape-imtv.ts`,
  written and run against the live sites. Each writes normalized
  `EventInstance[]` to `fixtures/<source>/events.json` by default (a
  representative sample, or the full dataset when
  `SAMPLE_PER_CATEGORY=0`/`SCRAPE_OUT_DIR` is overridden — see CI below).
- **Sample fixtures**: `fixtures/official/events.json` (27 events — 2 per
  category plus one full 5-instance recurring series, "TRiX ger –
  Eldiaden") and `fixtures/imtv/events.json` (52 events — this source's
  entire dataset, small enough that no sampling was needed; includes an
  organic 8-instance recurring series, "Ringmuren runt"). Real scraped
  data, not synthetic — useful for local dev/testing without hitting the
  network.
- **Merged output**: `scripts/merge.ts` combines both sources into
  `public/data/events.json` (schema: `{ schemaVersion, generatedAt, events: [...] }`,
  validated against `EventsFileSchema`). It lives under `public/` so Vite
  serves it as-is at `/data/events.json` in both dev and the built site —
  same origin as the app, no CORS involved. Regenerate any time with
  `npm run merge` (reads from `fixtures/` by default — no network needed).
- **CI — data**: `.github/workflows/scrape.yml` runs both scrapers for real
  every 3 hours (`SAMPLE_PER_CATEGORY=0`, `SCRAPE_OUT_DIR=raw` — a
  gitignored scratch dir, so it never clobbers the curated `fixtures/`
  sample) plus on manual dispatch, merges, and commits
  `public/data/events.json` if it changed. This is the *only* place live
  scraping happens — both sources are confirmed to send no CORS headers, so
  a client-side fetch of medeltidsveckan.se or imtv.se from a different
  origin is always blocked by the browser (see `docs/FINDINGS.md`). Don't
  try it client-side.
- **CI — deploy**: `.github/workflows/deploy.yml` builds the Vite app
  (`GITHUB_PAGES=true` sets the `/01-mtv/` base path) and publishes `dist/`
  to GitHub Pages, on every push to `main` and also on completion of the
  scrape workflow (via `workflow_run`, since a bot-authored push doesn't
  retrigger `on: push`) — so a fresh scrape auto-redeploys.
- **Client**: Solid.js + Vite (`src/client/`), Dexie for IndexedDB
  (`src/client/db.ts`), `vite-plugin-pwa` for the service worker/offline
  precache/install manifest (`vite.config.ts`). Loads
  `/data/events.json`, caches it locally, and lets the user favorite/ignore
  at both the instance and series level with `resolveDecision()`'s
  precedence rule (below) — tested live: series-favoriting propagates to
  all instances, an instance-level ignore correctly overrides its series
  favorite, and state survives a reload. Confirmed fully functional with
  the network hard-disabled (DevTools offline emulation) after one prior
  load, including a normal (non-hard) reload.
- **Row interaction**: `src/client/components/SwipeableRow.tsx` implements
  swipe-right = favorite / swipe-left = ignore via Pointer Events (works for
  touch and mouse), with a background reveal and axis-locking so vertical
  page scroll isn't hijacked; a tap (movement that never crosses the lock
  threshold) opens `EventDetailsModal.tsx` (a native `<dialog>`) with the
  full description, badges, and a generic "🔗 hostname" link list built from
  `ticketUrl` + imtv's `links[]` combined — deliberately not labeled "Köp
  biljett", since not every link is a ticket purchase. The compact row
  itself only shows time/title/venue/organizer plus icon chips
  (`src/client/categoryStyles.ts`: one icon + accent color per official
  category, imtv falls back to a source-level color) and the
  favorite/ignore/series buttons, which remain as an accessible,
  discoverable alternative to swiping.
- **Theme**: reskinned rose/burgundy + gold to match Medeltidsveckan 2026's
  actual festival theme, "en kärlekshistoria" ("a love story") — confirmed
  from medeltidsveckan.se's own homepage copy, not assumed. Two 700-year-old
  public-domain Codex Manesse illuminations (`public/art/`, credited in
  `public/art/ATTRIBUTIONS.md`) appear in a header banner
  (`src/client/components/ThemeBanner.tsx`) and the empty "Mitt schema"
  state — resized/re-encoded to WebP and explicitly added to the service
  worker's precache `globPatterns` (`vite.config.ts`) so they're available
  offline too, not just the app code and data.

Run `npm run typecheck` any time to confirm everything still compiles.
`npm run dev` for a local dev server; `GITHUB_PAGES=true npx vite build`
to reproduce the production build.

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
entity — it's just every `EventInstance` sharing the same `seriesKey`. The
client groups by that field to show "all instances of this thing" and to
let the user favorite/ignore the whole series at once (see
`seriesCounts`/`isRecurring` in `src/client/App.tsx`).

**Favorite/ignore precedence**: an instance-level decision always overrides
the series-level default. `src/schema.ts` exports the resolver, used
throughout the client rather than reimplemented:

```ts
resolveDecision(event, userState) // -> "favorite" | "ignore" | "neutral"
```

Resolution order: `favoriteInstances`/`ignoreInstances` (by `id`) → else
`favoriteSeries`/`ignoreSeries` (by `seriesKey`) → else `"neutral"`. A user
can favorite an entire series and still ignore one specific instance of it,
or vice versa — the instance-level entry always wins. `UserState` is
**local-only** (IndexedDB via `src/client/db.ts`), never synced or
committed anywhere.

## Known gaps / things to work around

- **`familyFriendly` / `includedInPass` are never set.** These come from a
  filter form on the official site (`misc[family_friendly]`,
  `misc[included_in_pass]`) submitted against
  `/wp-admin/admin-ajax.php?action=mv_programme_search` with a page-scraped
  nonce — a first attempt at that request returned zero results, so the
  exact param shape is still unconfirmed (see `docs/FINDINGS.md` and
  `docs/FUTURE.md`). Both fields are optional in the schema; the client
  deliberately doesn't build filters on them yet.
- **`seriesKey` is a heuristic, not a guarantee.** It's
  `normalized(title [+ venue for official] [+ organizer for imtv])`.
  Organizers sometimes reword a yearly-recurring imtv event's title slightly
  year to year, which would silently split it into a "new" series. Treat
  series-favoriting as a nice-to-have grouping, not a hard guarantee it'll
  catch every future instance.
- **imtv `venue` is best-effort text extraction** from a "Plats: ..."
  substring inside free-text descriptions, present on maybe 5-10% of imtv
  events. Most imtv events have no structured venue at all — this is a
  normal, common case in the UI, not an error state.
- **`FESTIVAL_YEAR` is hardcoded to `2026`** in
  `.github/workflows/scrape.yml` and defaults to `2026` in
  `scripts/scrape-imtv.ts`. imtv.se's day headers ("Lördag 1/8") never
  include a year, so this must be bumped by hand every year.
- **No PWA icons yet** (`vite.config.ts` manifest has `icons: []`) — install-
  to-homescreen will use a browser default rather than a real app icon.
- Both scrapers' `raw` field preserves the entire original scraped payload
  per event — if a normalized field is ever wrong or missing something
  needed, check `raw` before assuming the data isn't there.

See `docs/FUTURE.md` for deferred ideas (a Netlify Edge Function proxy for
on-demand refresh, better cross-year series identity, etc.) — none of these
block the app working as-is.
