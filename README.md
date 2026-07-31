# 01-mtv

Combined personal programme viewer for Medeltidsveckan — merges the official
programme (medeltidsveckan.se) and the unofficial/community programme
(imtv.se) into one schema, with favoriting/ignoring at both the series and
individual-instance level.

This repo currently contains the data layer: schema (`src/schema.ts`),
scrapers (`scripts/scrape-official.ts`, `scripts/scrape-imtv.ts`), a
representative sample dataset (`fixtures/`), the merged output
(`data/events.json`), and a CI job (`.github/workflows/scrape.yml`) that
keeps it fresh. The PWA client that consumes this data is not built yet.

**Start here: [HANDOFF.md](./HANDOFF.md)** — schema reference, known data
gaps, and what's left to build.

```sh
npm install
npm run scrape          # scrape:official + scrape:imtv + merge (needs network)
npm run merge           # just re-merge fixtures/ -> data/events.json (no network needed)
npm run typecheck
```
