# Future ideas (not v1)

Deliberately deferred for now — v1 ships with hardcoded, CI-scraped static
data only (`public/data/events.json`, refreshed on a schedule by
`.github/workflows/scrape.yml`). Nothing below is required for the app to
work; these are directions to consider later if a real need shows up.

## On-demand refresh via a Netlify Edge Function

We have a Netlify account. Since both upstream sources block client-side
CORS (see `docs/FINDINGS.md`), the client can never fetch them directly no
matter how it's written — but a small Netlify Edge Function acting as a
same-origin proxy would let it. The function would do the actual
cross-origin fetch server-side (no CORS restriction applies server-to-
server) and hand the raw HTML/JSON back to the client with permissive
headers; the existing normalize logic in `scripts/lib/normalize.ts` and the
per-source scrapers could plausibly run in that edge runtime too (both are
plain TS with no Node-only APIs beyond `node:crypto`/`node:fs`, which would
need swapping for Web Crypto / removing the file write — worth checking
Netlify Edge Functions' exact runtime constraints before assuming this is a
drop-in reuse).

Worth it only if the 3-hour CI cron turns out to be too stale in practice
during the actual festival (e.g. a booking-status flip or a last-minute
imtv addition the user wants sooner than the next scheduled run). Cost:
one more moving piece that can go down, and it cuts against the
"local-first, works with zero backend" framing — so treat this as an
optional "refresh now" button layered on top of the static-data baseline,
never a replacement for it.

## Family-friendly / included-in-pass flags

`docs/FINDINGS.md` has the detail: the official site's
`misc[family_friendly]` / `misc[included_in_pass]` filter posts to
`/wp-admin/admin-ajax.php?action=mv_programme_search` with a nonce, and a
first attempt (GET and POST, nonce + the misc param) returned "no results"
rather than a filtered list. Needs inspecting the real request in a browser
network tab while using the site's own filter UI to find what's actually
missing (an accompanying required field? different param nesting?) before
it's worth another scripted attempt.

## Better cross-year series identity

Both `seriesKey` heuristics (title[+venue] for official, title[+organizer]
for imtv) are single-year, string-normalization heuristics — good enough to
group a show's occurrences within one festival, not guaranteed to recognize
"this is the same tradition as last year" if an organizer rewords a title.
If multi-year history ever matters (e.g. "you favorited this last year,
want to again?"), this would need fuzzy matching (edit distance / embedding
similarity) rather than exact normalized-string equality.

## imtv venue extraction

Currently a loose regex on "Plats: ..." free text, present on a small
minority of entries. Could be improved with a small hand-maintained
gazetteer of known Medeltidsveckan/Visby venue names to match against full
descriptions (not just ones with an explicit "Plats:" label), but not worth
it unless venue-based filtering on the imtv side turns out to matter to
actual usage.
