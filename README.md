# 01-mtv

Combined personal programme viewer for Medeltidsveckan — merges the official
programme (medeltidsveckan.se) and the unofficial/community programme
(imtv.se) into one schema, with favoriting/ignoring at both the series and
individual-instance level.

Live at **https://strokirk.github.io/01-mtv/**.

Data pipeline: schema (`src/schema.ts`), scrapers
(`scripts/scrape-official.ts`, `scripts/scrape-imtv.ts`), a representative
sample dataset (`fixtures/`), merged output (`public/data/events.json`), and
a CI job (`.github/workflows/scrape.yml`) that keeps it fresh. Client: a
Solid.js + Vite PWA (`src/client/`) with an IndexedDB cache (Dexie) for
offline-first use, deployed to GitHub Pages on every push
(`.github/workflows/deploy.yml`).

**Start here: [ARCHITECTURE.md](./ARCHITECTURE.md)** — schema reference,
favorite/ignore precedence rule, and known data gaps.
**[docs/FINDINGS.md](./docs/FINDINGS.md)** has the raw research behind the
scraper design; **[docs/FUTURE.md](./docs/FUTURE.md)** has deferred ideas.

```sh
npm install
npm run dev              # local dev server
npm run scrape            # scrape:official + scrape:imtv + merge (needs network)
npm run merge              # just re-merge fixtures/ -> public/data/events.json (no network needed)
npm run typecheck
GITHUB_PAGES=true npx vite build   # reproduce the production build
```
