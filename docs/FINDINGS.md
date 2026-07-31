# Research findings

Raw research notes behind the schema and scraper design in this repo.
Consolidated from live exploration of both sources (2026-07-31, ahead of the
2026-08-01 → 2026-08-09 festival).

## Official programme (medeltidsveckan.se/programme/)

- WordPress, custom post type `mv_programme`. Not exposed via `/wp-json/`
  (`GET /wp-json/wp/v2/types` lists `post`, `page`, `wpum_directory`,
  `shortcuts`, `ufaq` only).
- The entire 9-day programme (636 event cards, confirmed by counting
  `<article class="programme-item" data-pid="...">` elements) is embedded in
  the initial HTML of one page load — day tabs are CSS show/hide, not
  separate requests. One fetch of `/programme/` gets every event's pid.
- Cards live inside `<section class="day" data-date="YYYY-MM-DD">` —
  that's the reliable per-event date source, not anything in the card
  itself.
- "Öppettider" (opening hours) entries are structurally separate: a
  `<div id="hours-YYYY-MM-DD">` accordion per day, using
  `<a data-pid="...">` — NOT `<article data-pid="...">`. Selecting only
  `article.programme-item[data-pid]` excludes all 111 of them automatically,
  no category-based filtering needed. Verified: 747 total `data-pid`
  attributes on the page, 636 of them on `<article>` elements, 0 on
  `<a data-bs-toggle="modal" data-pid="...">` elements matching the
  `article` selector.
- Per-event detail comes from an undocumented, public, unauthenticated AJAX
  GET: `/?async=true&action=fetch-programme-item&pid=<pid>`. Returns JSON as
  the response body but with `Content-Type: text/html; charset=UTF-8` —
  must `JSON.parse(await res.text())`, `res.json()` will refuse based on
  content-type in some fetch implementations.
- Response shape (verified, pid 64689):
  ```json
  {
    "image": "https://join.medeltidsveckan.se/uploads/....jpg",
    "header": { "item_owner": "Jimmy Pihl", "title": "..." },
    "content": {
      "description": "<p>...</p>",
      "siblings": { "1785931200": { "day": "Onsdag", "time": "12:00", "timestamp": 1785931200, "title": "..." } }
    },
    "sidebar": { "dayName": "Måndag", "date": "2026-08-03", "time": "12:00 - 13:00", "venue": "Teatern, Strand Hotel", "ticket_link": "...", "bookmark_button_html": null },
    "meta": { "logged_ind": false }
  }
  ```
- **Bug found and worked around**: `header.title` / `header.item_owner` /
  `sidebar.venue` come through this JSON endpoint still HTML-entity-encoded
  (e.g. literal string `"TRiX ger &#8211; Eldiaden"`), even though they're
  "plain text" fields, not HTML. The scraper decodes them explicitly
  (`scripts/scrape-official.ts`, via the `entities` package) — without this,
  slugified `seriesKey`/`id` values and displayed text both come out wrong
  (a stray `8211` token where the en-dash should be). The `description`
  field is genuine HTML and is left encoded as normal, since it's rendered
  as HTML downstream.
- `content.siblings` names other occurrences of the same recurring event
  (day/time/title/timestamp) but **not their pid** — you can't jump directly
  to a sibling's own detail JSON from this field. The scraper instead
  detects recurrence structurally, by grouping all 636 cards by normalized
  title and finding groups with 2+ members (this is exactly how the sample
  fixture's demo series, "TRiX ger – Eldiaden", 5 instances, was found and
  captured).
- Category taxonomy: 19 known `cat-*` slugs (see `OfficialCategorySchema` in
  `src/schema.ts`), but **only 11 distinct Swedish labels were observed live
  on cards this year** — Eldshow, Föredrag, Guidad visning, Konsert, Parad,
  Performance, Strid, Teater, Uppvisningsläger, Workshop, Övrigt. The
  remaining 8 (Äventyr, Berättare, Festival, Föreställning, Gyckel, Krog,
  Marknad, Stridande) are inferred, not verified. The card-footer CSS
  classes on `<article>` (e.g. `mv_programme_category-konsert`) are
  **stale/identical across all 636 cards** — a caching bug in the WP theme.
  Confirmed by spot-checking: three cards with visibly different rendered
  category text ("Övrigt") all shared the class
  `mv_programme_category-konsert mv_programme_venue-kapitelhusgarden`. Do
  not trust these classes for anything; the scraper reads the rendered
  footer text instead.
- Booking-status badges are visible directly on cards: "Fullbokad" (→
  `soldout`), "Få biljetter kvar" (→ `few-left`), and a "Veckan tipsar!"
  badge (→ `editorTip: true`). These are the *only* source for
  `bookingStatus`/`editorTip` — they don't appear in the AJAX detail
  response at all.
- **`familyFriendly` / `includedInPass` could not be sourced.** These exist
  only as an offcanvas filter form (`misc[family_friendly]`,
  `misc[included_in_pass]` checkboxes, labeled "Extra bra för barn" /
  "Gratis & veckan tipsar") — not rendered per-card anywhere in the static
  HTML or the AJAX detail payload. The form posts to
  `/wp-admin/admin-ajax.php?action=mv_programme_search` with a page-scraped
  nonce (found embedded as `var mvSearch = {"ajaxUrl":"...","nonce":"..."}`
  in an inline script). Tried both GET and POST with
  `action=mv_programme_search&nonce=<real nonce>&misc[family_friendly]=1` —
  both returned the site's "no results" HTML fragment (282 bytes, "Vi är
  mycket ledsna, men vi kunde inte hitta några programobjekt..."), meaning
  the actual request shape (param encoding, required accompanying fields
  like a search term) is still wrong. Left unimplemented; see
  `docs/FUTURE.md`.
- No `Access-Control-Allow-Origin` header on the AJAX endpoint (verified via
  `curl -D -`) or on the plain `/programme/` page. **A client-side
  `fetch()` from any other origin is blocked by the browser regardless of
  what the client code does** — this is standard CORS enforcement, not
  something fixable from the requesting side. Confirms server-side (CI)
  fetching is the only reliable import path.

## Unofficial/community programme (imtv.se)

- Community-run ("Sällskapet", contact `imtv@skelett.nu`), classic ASP on
  IIS. Confirmed via probing: `/api.asp`, `/program.asp`, `/events.asp`,
  `/feed.asp`, `/calendar.ics`, `/program.json` all 404. No API, no JSON, no
  ICS export anywhere.
- The entire festival week is server-rendered on the single homepage
  (`https://imtv.se`), one `<dl>` with a `<dt>`/`<dd>` pair per day:
  ```html
  <dt><h2><div id="day3">Lördag 1/8</div></h2></dt>
  <dd><ul>
    <li>
      <span class="time">17:00</span>
      <div>
        <h3>Förfest</h3>
        <img class="trigger" data-modalid="{GUID}">
        <div class="modal" id="{GUID}"><div class="modal-content">
          Skapad av:<br>Admin<br><br>Senast ändrad:<br><nobr>2024-07-29 21:39:49</nobr>
        </div></div>
        <p>Allmänt galej i Nordergravar för folk som anlänt tidigt till veckan.</p>
      </div>
    </li>
  </ul></dd>
  ```
- **Day headers never include a year** ("Lördag 1/8", not "Lördag 1/8 2026")
  — the scraper has to be told the year via `FESTIVAL_YEAR` (env var,
  currently defaulting to 2026). This is the single most likely thing to
  silently produce wrong dates if this scraper is reused unmodified next
  year without updating that default.
- 52 unique events found (57 raw `<li>` entries, minus duplicates/one
  malformed `<dt>` with an empty day header that gets skipped and logged).
  No pagination, no separate per-day URLs — one fetch gets everything.
- GUIDs (`data-modalid`) are almost certainly per-year: a known yearly
  tradition ("Inofficiella pinen i år igen") shows a `Senast ändrad`
  timestamp of `2026-07-07`, i.e. re-submitted this year, not reused from a
  prior year's post. Series grouping is therefore title(+creator)-based, not
  GUID-based, and is a heuristic — confirmed working live: "Ringmuren runt"
  (a daily wall-walk) appears 8 times across the week under one seriesKey,
  and "Sagoskoj"/"Knalleslaget" each appear 4 times.
- No structured category, venue, GPS, image, or price anywhere. Venue is
  occasionally embedded as free text inside the description ("Plats: ..."),
  observed on only 4 of 57 sampled entries — extraction is a loose regex,
  documented as best-effort in `scripts/scrape-imtv.ts`.
- No `Access-Control-Allow-Origin` header (verified via `curl -D -`) — same
  CORS block as the official site.

## Bottom line

Both sources are real HTML-scraping targets with no supported API, and both
categorically block client-side cross-origin fetches via missing CORS
headers. There is no client-only way to import this data — importing
requires a fetch that originates server-side (this repo's GitHub Actions
job) or from a same-origin/CORS-permitting proxy the client controls (see
`docs/FUTURE.md` for that option, intentionally deferred for v1).
