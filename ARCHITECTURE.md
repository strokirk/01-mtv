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
- **One day at a time**: the list renders a single selected day
  (`src/client/components/DayNav.tsx` — chevrons, a chip strip, and ←/→ on
  the keyboard), never the whole 683-row programme. This is both the
  "jump to prev/next day" feature and the fix for the swipe jank: the DOM
  goes from ~22 900 nodes to ~3 100, and a dragged row keeps a steady 60fps
  under 6× CPU throttling instead of dropping ~5% of its frames. A day chip
  carries a dot when that day has favorites. A **search is the one thing
  that spans all days** (it would be useless otherwise), so it's capped at
  `MAX_SEARCH_RESULTS` rows with a "+N till" hint rather than reintroducing
  an unbounded list; the day nav is disabled while a search is active.
- **Row interaction**: `src/client/components/SwipeableRow.tsx` implements
  swipe-right = favorite / swipe-left = ignore via Pointer Events (works for
  touch and mouse), with a background reveal and axis-locking so vertical
  page scroll isn't hijacked; a tap (movement that never crosses the lock
  threshold) opens `EventDetailsModal.tsx` (a native `<dialog>`) with the
  full description, badges, series actions, and a generic "🔗 hostname" link
  list built from `ticketUrl` + imtv's `links[]` combined — deliberately not
  labeled "Köp biljett", since not every link is a ticket purchase. Two
  deliberate perf choices live in `SwipeableRow`: the reveal backgrounds are
  only mounted *while* a row is being dragged (two gradient layers per row
  is real paint cost otherwise), and the per-pixel transform is written
  straight to the DOM in a rAF callback rather than through a signal.
  `.swipe-wrapper` also sets `content-visibility: auto` so offscreen rows
  skip layout/paint entirely.
- **Row anatomy**: category color as a stripe down the left edge, then
  time · title · venue · organizer · tags. Venue and organizer each get
  their own icon and weight/color so they stop reading as one grey blur.
  Tags are *text* ("Konsert", "Fullbokad", "Veckan tipsar") rather than the
  old icon chips, which needed a legend to mean anything and cost more row
  width than they earned. Source is tagged only for imtv ("Inofficiellt") —
  92% of events are official, so tagging those too would be noise on every
  row; the intro legend says as much. Series-level favorite/ignore moved
  from the row into the details modal, where there's room to label them
  ("Favorit: alla 4 tillfällen"); the row keeps just the two per-instance
  buttons as the accessible alternative to swiping.
- **Explainer**: `src/client/components/IntroCard.tsx` — what the app is,
  the swipe/tap/day-nav gestures, and a collapsible color legend built from
  the categories actually present in the data. Shown on first visit,
  dismissible (localStorage `mtv:intro-dismissed`, read through a try/catch
  since storage can throw outright in a locked-down browser), and
  reopenable from the (i) button in the header.
- **Theme**: white-first with rose accents (`src/client/index.css`) — the
  vibrant per-category colors read as accents against plain white instead
  of competing with an all-over purple. Rose/burgundy still ties to
  Medeltidsveckan 2026's actual festival theme, "en kärlekshistoria" ("a
  love story") — confirmed from medeltidsveckan.se's own homepage copy, not
  assumed. Two 700-year-old public-domain Codex Manesse illuminations
  (`public/art/`, credited in `public/art/ATTRIBUTIONS.md`) appear in a
  header banner (`src/client/components/ThemeBanner.tsx`) and the empty
  "Mitt schema" state — resized/re-encoded to WebP and explicitly added to
  the service worker's precache `globPatterns` (`vite.config.ts`) so they're
  available offline too, not just the app code and data. The brand block
  scrolls away; only the view toggle + day strip stick to the top.
- **Icons**: functional UI icons (booking status, favorite/ignore actions,
  venue/organizer, filter/calendar/chevron triggers) use `solid-icons/fa`
  components, not emoji. They render as inline `<svg width="1em">`, which
  sits on the text baseline — `index.css` nudges every `svg` with
  `vertical-align: -0.125em; flex: none` and centers icon-bearing controls
  with `inline-flex`, which is what keeps them optically aligned. Categories
  are color-only now (`src/client/categoryStyles.ts`), so nothing needs
  Solid's `<Dynamic>` any more.
- **Filters**: collapsed behind a filter-icon toggle next to the search box
  (`src/client/components/FilterBar.tsx`) — only search is visible by
  default; category/venue/source/"visa ignorerade" expand on click. The
  toggle button gets an `.active` style when any of those filters are set,
  so it stays discoverable even while collapsed.
- **Time blocks**: users can mark themselves "unavailable" for one or more
  date+time ranges (e.g. Wednesday 10:30–16:00) via a calendar-icon button
  in the header → `TimeBlocksModal.tsx`. Stored in a dedicated Dexie table
  (`db.timeBlocks`, `src/client/db.ts`) — a `TimeBlock` is
  `{ id, date, startTime, endTime, label? }`, purely client-local, unrelated
  to the scraped-event schema. `isBlockedByTimeSlot()` (also in `db.ts`)
  hides any overlapping event in **every** view, including "Mitt schema" —
  a hard scheduling constraint overrides even a favorite. Events with a real
  `endTime` get a proper interval-overlap check; point-in-time events
  (common for imtv, no `endTime`) are blocked if their start falls inside
  the window. A banner shows how many events are currently hidden this way,
  so the effect isn't invisible.

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
let the user favorite/ignore the whole series at once (see `seriesCounts`
in `src/client/App.tsx`, surfaced as the "alla N tillfällen" buttons in the
details modal).

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
