# Operational notes

Practical gotchas discovered while building and running this project — not
architecture (see `ARCHITECTURE.md`) or research (see `FINDINGS.md`), just
things that will bite you if you don't know them going in.

## A newly-created workflow does not run until something triggers it

`workflow_dispatch`/`schedule` workflows sit completely dormant after being
added — GitHub doesn't backfill or run them retroactively. This actually
caused a real bug here: `.github/workflows/scrape.yml` was created and
committed, but never manually triggered, so it silently never ran. The live
site kept serving the original ~27-event sample fixture for hours,
including through a full "ship it" pass, until a user noticed a specific
event ("Historisk sjukamp") was missing.

**Lesson**: after adding or meaningfully changing a scheduled/dispatchable
workflow, immediately run `gh workflow run <name>.yml` and watch it
(`gh run watch <run-id> --exit-status`) to confirm it actually works
end-to-end. Don't assume "the cron will get to it eventually" — verify now.

## The scrape cron pushes directly to main — rebase before you push

`.github/workflows/scrape.yml` runs every 3 hours and commits straight to
`main` if the scraped data changed. If you've been working locally for a
while, a plain `git push` can get rejected because the bot got there first.
Fix: `git pull --rebase origin main` before pushing — the data commits
touch only `public/data/events.json`, so this has never actually conflicted
with real code changes, just needed the rebase.

## Full official scrape takes ~10-11 minutes

`scripts/scrape-official.ts` fetches each of the ~636 event cards'
individual AJAX detail endpoint sequentially (one `fetch-programme-item`
request per pid, no concurrency). That's a real ~10-11 minute CI job every
time it runs, not a quick script. If you're waiting on `gh run watch` for
`scrape.yml`, expect it to take a while — it's not stuck.

## PWA `autoUpdate` needs one reload after a new deploy

`vite-plugin-pwa`'s `registerType: "autoUpdate"` downloads and activates a
new service worker in the background, but a tab that was already open when
you deployed keeps rendering the old cached shell until you reload it once.
This is normal for basically all PWAs, not a bug — don't spend time
"fixing" it. When verifying a fresh deploy in a browser session that
already visited the site, always reload once before trusting what you see.

## Testing true offline behavior

Use `mcp__chrome-devtools__emulate({ networkConditions: "Offline" })` and
then a **plain** reload (`navigate_page` with `type: "reload"`, no
`ignoreCache`). A hard/cache-bypassing reload (`ignoreCache: true`) also
bypasses the service worker at the Chrome DevTools Protocol level, so it'll
show a connection error even though the PWA would work fine for a real
user's normal reload/relaunch. Verified this way: the app renders fully
offline after one prior successful load.

## Dexie schema changes need a version bump

Adding a new table (e.g. `timeBlocks`) means adding a new
`this.version(N).stores({...})` block in `src/client/db.ts`'s `ProgrammeDB`
constructor with the **full** schema for that version (not just the new
table) — Dexie applies versions in order and needs each one to be
self-contained. Existing users' browsers migrate automatically on next
load; nothing else to do.

## solid-icons usage pattern

Icons from `solid-icons/fa` are plain `(props: IconProps) => JSX.Element`
components.

- **Statically known** (e.g. the heart/ban/filter icons in a specific
  button): import directly and use as a normal JSX tag — `<FaSolidHeart />`.
- **Chosen dynamically** (a component looked up in a map at render time):
  store the component reference itself (not a string/emoji) in the lookup
  map, and render via `<Dynamic component={...} />` from `solid-js/web`.
  A plain `{lookupIcon(slug)}` doesn't work — Solid needs `<Dynamic>` to
  know the component reference can change between renders. Nothing in the
  client needs this today (categories became color-only), but it's the
  pattern to reach for if a per-row icon map comes back.

They render as inline `<svg width="1em" height="1em">`, which sits on the
text baseline and leaves a descender gap — `src/client/index.css` corrects
that globally (`svg { vertical-align: -0.125em; flex: none }` plus
`inline-flex` on icon-bearing controls). Don't re-align icons per component;
fix it there.

## Repo visibility

The repo is public (`strokirk/01-mtv`) specifically so GitHub Pages could
serve it without a paid plan. Nothing sensitive lives here — scraped
programme data is public festival info, and all favorite/ignore/time-block
state lives in the visiting browser's IndexedDB only, never committed or
transmitted anywhere.
