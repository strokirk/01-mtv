# Agent instructions for this repo

## Push straight to main

This repo has no PR-branch workflow — the user works directly off `main` and
can't pick up anything sitting on a branch. Do not create feature branches
or hold changes for review. As soon as a change is in a good state
(typecheck passes, build succeeds), commit it and push straight to `main`,
quickly and without asking for confirmation first. If a session happens to
be started on some other branch, merge/rebase it onto `main` and push there
instead of leaving work stranded off of it.

## Commit and push eagerly

Commit and push working increments as soon as they're in a good state —
typecheck passes, build succeeds — rather than batching everything into one
commit at the end of a session. Don't wait for a task to be "fully done" to
push progress.

Why this matters here specifically: sessions run against a usage quota and
can get cut off mid-task. Uncommitted or unpushed work at that point is
lost. Pushing early and often means an interrupted session still leaves
useful, working progress on the branch instead of nothing.

This doesn't relax the rule about only committing when the user asked for
it, and it doesn't mean push broken code — each pushed commit should still
be a coherent, working state (`npm run typecheck` clean at minimum). It
just means: don't sit on a finished, verified change hoping to bundle it
with more later.

## Where to start

- [README.md](./README.md) — quick orientation and dev commands.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — schema reference, client structure,
  favorite/ignore precedence rule. Read this before touching the data
  pipeline or `src/client/`.
- [docs/OPERATIONS.md](./docs/OPERATIONS.md) — practical gotchas (CI quirks,
  PWA update behavior, Dexie versioning, icon rendering). Read before
  touching CI or the data pipeline.
- Run `npm run typecheck` after any change to `src/` or `scripts/`.
