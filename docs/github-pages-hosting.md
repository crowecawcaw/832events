# GitHub Pages Hosting & PR Previews

This document records the move of 832.events off Cloudflare and onto GitHub
Pages, and the removal of the Cloudflare favorites worker.

## Summary

- **Static site hosting:** GitHub Pages, served from the `gh-pages` branch.
- **Custom domain:** `832.events` is kept. The deploy workflow writes a `CNAME`
  file to the `gh-pages` root; the domain owner points DNS at GitHub Pages.
- **PR previews:** deployed to the same `gh-pages` branch under
  `preview/<PR>/`, served at `https://832.events/preview/<PR>/`.
- **Favorites:** now **localStorage-only in the browser**. The Cloudflare
  favorites worker (sign-in/OAuth, KV-backed favorites, per-user lists, and
  server-generated personal ICS feeds) has been **deleted**. There is no
  backend API.

## Why a single `gh-pages` branch

GitHub Pages serves one source per repository. To host the production site
*and* per-PR previews from the same Pages site, everything lives on the
`gh-pages` branch:

```
gh-pages/
  index.html, *.ics, *.json, ...   ← production site (root)
  CNAME                            ← "832.events"
  preview/
    123/                           ← PR #123 preview
    124/                           ← PR #124 preview
```

The official `actions/deploy-pages` flow deploys a single artifact as the whole
site, which can't hold coexisting per-PR subtrees. So we publish to the branch
incrementally with `peaceiris/actions-gh-pages` instead.

## Workflows

All three workflows that push to `gh-pages` share one concurrency lane
(`group: gh-pages-deploy`, `cancel-in-progress: false`) so pushes are
**serialized, never cancelled** — a half-applied branch commit would be worse
than a short queue wait.

### `publish_calendars.yml` (production, `deploy` job)

1. Downloads the built `output/` artifact.
2. Checks out the current `gh-pages` and copies its `preview/` subtree into
   `output/preview/` so the production publish doesn't wipe open previews.
3. `peaceiris/actions-gh-pages` publishes `output/` to the `gh-pages` root
   (clean replace) with `cname: 832.events`.

Because step 2 carries previews forward and the publish is a clean root
replace, stale production files removed in a build are also removed from the
deployed site — the `allowed-removals/` + `check-missing-urls` workflow still
behaves as documented.

### `pr-preview.yml` (`deploy-preview` job)

- The reusable build is invoked with `base-path: /preview/<PR>/` so the Vite
  bundle's asset URLs resolve under the preview subpath.
- `peaceiris/actions-gh-pages` publishes `output/` to
  `destination_dir: preview/<PR>` with `keep_files: false`. With a
  `destination_dir` set, peaceiris replaces only that subtree and leaves the
  production site, the root `CNAME`, and other PRs' previews untouched.
- The PR comment links to `https://832.events/preview/<PR>/`.

### `cleanup-preview.yml` (PR `closed`)

Checks out `gh-pages`, `git rm -r preview/<PR>`, commits, and pushes (with a
small rebase-retry loop in case it queues behind a deploy).

## The Vite base path

`web/vite.config.js` reads `base: process.env.VITE_BASE_PATH || '/'`.

- Production builds at the apex domain use the default `/`.
- Preview builds set `VITE_BASE_PATH=/preview/<PR>/` (threaded through the
  `base-path` input of `build-calendars.yml`).

Only Vite's bundled asset URLs (JS/CSS) need the base. The app fetches its data
files with relative paths (`./manifest.json`, `./events-index.json`, …) and the
manifest's `icsUrl` values are relative filenames, so data loading works under
both the root and a `/preview/<PR>/` subpath without further changes.

## Favorites: localStorage only

Favorites, saved searches, and geo filters persist to `localStorage` in the
browser (keys `calendar-ripper-favorites`, `calendar-ripper-search-filters`,
`calendar-ripper-geo-filters`). The web UI applies the same Fuse.js search and
haversine geo filtering it always did — that logic was previously duplicated on
the server for parity, and now runs client-side only.

**What was removed with the worker:**

- Google sign-in / OAuth and cross-device sync.
- Multiple named favorites lists.
- Server-generated, subscribable personal ICS feed URLs. Favorites live only in
  the browser that created them; there is no live per-user feed to subscribe to
  in a calendar app.

In-app feedback now opens a prefilled GitHub issue instead of POSTing to the
worker.

## One-time setup (repo owner)

1. **Enable GitHub Pages:** Settings → Pages → Build and deployment → Source =
   *Deploy from a branch*, Branch = `gh-pages` / `/ (root)`. The first run of
   `publish_calendars.yml` creates the branch.
2. **Custom domain DNS:** point `832.events` at GitHub Pages (apex `A`/`AAAA`
   records to GitHub's Pages IPs, or an `ALIAS`/`ANAME` to
   `<owner>.github.io`). The `CNAME` file is written automatically by the
   deploy. Enable "Enforce HTTPS" once the certificate provisions.
3. **Remove obsolete secrets/vars (optional cleanup):** `CLOUDFLARE_API_TOKEN`,
   `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT`, `FAVORITES_API_URL`.

> Previews require write access to `gh-pages`, so previews for PRs from forks
> (which only get a read-only `GITHUB_TOKEN`) won't deploy — same practical
> limitation as the old Cloudflare setup, which needed secrets forks lacked.
