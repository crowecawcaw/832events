# Setting up your city's instance

This walkthrough takes you from "clicked **Use this template**" to a live,
agent-maintained event calendar site for your city. The design behind all of
this lives in [`docs/city-template.md`](./city-template.md); this page is
just the steps.

## What done looks like

Setup lands in tiers — stop at whichever one you want:

1. **Deployed site** (steps 1–6, about an afternoon): the site is live at
   your `SITE_URL`, the daily build is green, and your first sources are
   merged and publishing events.
2. **Self-maintaining site** (+ the three Claude Code automation workflows
   in step 7): broken sources get fixed, and new sources get discovered and
   implemented — without you in the loop. The workflow set, with suggested
   prompts, is catalogued in [`docs/routines.md`](./routines.md).
3. **Full product** (+ the remaining step 7 services): Discord build
   notifications and the Browserbase proxy for bot-blocked sources.
   (Favorites are stored only in the browser's localStorage — there is no
   backend, sign-in, or multi-device sync to set up.)

## 1. Create your repository

On GitHub, click **Use this template → Create a new repository**. Any name
works; you'll record the `owner/name` slug during configuration.

Clone it and install dependencies (Node 20+):

```sh
git clone https://github.com/<owner>/<repo>
cd <repo>
npm install   # postinstall also installs web/ dependencies
```

## 2. Configure your city

**Recommended:** open the repo in Claude Code and run
[`skills/city-setup/SKILL.md`](../skills/city-setup/SKILL.md) — it collects
your city's facts, runs the converter, tunes the geography, and walks you
through everything below.

**Manual:** run the converter yourself:

```sh
npm run init-city                                   # interactive prompts
# or, scripted:
npm run init-city -- --answers my-city.json --dry-run   # review the plan
npm run init-city -- --answers my-city.json --yes
```

This regenerates `city.config.ts` for your city and permanently deletes the
Seed content (sources, candidate docs, caches, geocoder lookup tables,
and the reference Discord notification workflow).
Afterwards, open `city.config.ts` and hand-tune the derived geographic
boxes — `map.clampBounds` should hug your populated metro,
`geocoder.nominatimViewbox` slightly larger, `venueSanityBbox` a generous
day-trip radius.

## 3. Verify locally

```sh
npm run typecheck
npm run test:all
npm run generate-calendars   # zero sources — must complete with 0 errors
```

Content-coupled tests self-skip on a stripped copy; everything else must
pass. Commit the result on a branch, but **before opening the PR** enable
GitHub Pages (step 4) so the PR preview can deploy, and set the
`CLAUDE_CODE_OAUTH_TOKEN` secret (step 8) so the PR gets reviewed. Then
open and merge it — this is your instance's baseline.

## 4. GitHub Pages (required — this is the site hosting)

The site is built and published by
`.github/workflows/publish_calendars.yml`, which deploys the `output/`
artifact to the `gh-pages` branch via
[`peaceiris/actions-gh-pages`](https://github.com/peaceiris/actions-gh-pages).
PR previews land on the same branch under `preview/<PR>/`.

1. In your GitHub repo settings → **Pages**, set the source to **Deploy
   from a branch**, branch `gh-pages`, folder `/ (root)`. (The first
   deploy creates the branch; you may need to revisit this page once it
   exists.)
2. Add **repository variables** (Settings → Secrets and variables → Actions
   → Variables):
   - `SITE_URL` — `https://<your-domain>` (no trailing slash)
3. Custom domain: the deploy workflow writes a `CNAME` file into the
   `gh-pages` branch so GitHub Pages serves the site at your custom
   domain. Point a DNS record for that domain at GitHub Pages (a `CNAME`
   to `<owner>.github.io`, or the GitHub Pages `A`/`AAAA` apex records),
   then confirm the domain under Settings → Pages. Until the custom domain
   resolves, the site serves from `https://<owner>.github.io/<repo>/` — if
   you start there, use that URL as `SITE_URL` and in `city.config.ts`
   (`site.baseUrl`/`site.productionUrl`), and update both when the real
   domain is live.

## 5. First deploy

Push to `main`, or run the **"Generate Calendars and Publish to GitHub
Pages"** workflow manually (Actions → Run workflow). First runs are
tolerant by design: with no deployed site yet, the backwards-compatibility
URL check skips itself, and the geo/fetch caches cold-start empty.

## 6. Add your first sources

Follow [`skills/source-discovery/SKILL.md`](../skills/source-discovery/SKILL.md).
Start with a handful of high-volume, reliable sources — the city's biggest
venues, the library system, a community calendar. One source per PR; every
PR gets a preview at `https://<your-domain>/preview/<n>/` (on the
`gh-pages` branch under `preview/<n>/`) with a build report comment.

## 7. Optional services

Everything below degrades gracefully when unset — add each one when you
need it. The full behavior matrix is in
[`docs/city-template.md`](./city-template.md#secrets-vars-and-optional-services).

### Per-source API keys (repo secrets)

Add only when you add a source of that type: `TICKETMASTER_API_KEY`,
`EVENTBRITE_TOKEN`, `DICE_API_KEY`, `BROWSERBASE_API_KEY` (Browserbase
fetches bot-blocked / JS-challenge sources live — see the Browserbase
proxy section below).

### Discord notifications

`init-city` deletes the reference notification workflow. To enable
Discord on your copy, restore `.github/workflows/notify-discord.yml` from
the upstream repo (adjusting the hardcoded role mention), then set the
`DISCORD_WEBHOOK_CALENDAR` secret to a channel webhook URL. Build results
and actionable queues (uncertain events, photo/cost gaps) get posted after
each run.

### Claude Code automation workflows (the self-maintaining part)

The skills under `skills/` are the operating manual; the automation
workflows are what run them on a schedule. They run as **GitHub Actions**
(in `.github/workflows/`) using the `anthropics/claude-code-action@v1`
action and the same `CLAUDE_CODE_OAUTH_TOKEN` secret as the PR-review and
`@claude`-mention workflows — no Anthropic-account routines or extra
secrets. The reference instance runs **two**; suggested prompts and
cadences for each are in [`docs/routines.md`](./routines.md):

- **Build-error responder** — runs `skills/build-report/SKILL.md`; the
  `build-error-responder` job in `publish_calendars.yml` runs after a daily
  build with errors (rate-limited to once per 24 h; bypass with a manual
  run and `force_routine=true`).
- **Source pipeline** — one scheduled workflow, `source-pipeline.yml` (daily
  08:30 UTC). It discovers new sources, records them in
  `docs/source-candidates/`, builds up to 5 pending candidates, and opens one
  PR (`skills/source-discovery/SKILL.md`). For a **content-only** PR it enables
  GitHub auto-merge, so the PR merges itself once the build passes (see "Native
  auto-merge" below); anything touching code/config waits for you.

Issues and PRs are **owner-driven**, not automated: comment `@claude` to
have it act on demand (`claude.yml`), and owner-authored PRs are
auto-reviewed (`claude-code-review.yml`). Both are gated to the repo owner;
there is no workflow that auto-acts on external issues or fork PRs. See the
access-control section of [`docs/routines.md`](./routines.md).

Both authenticate with `CLAUDE_CODE_OAUTH_TOKEN` and skip silently when
it (or, for a fork, the matching `github.repository`) isn't present.

### Native auto-merge

The bot pipelines enable GitHub's built-in auto-merge on their own
content-only PRs (`gh pr merge --auto --merge`), so a green PR merges without
a manual click. GitHub only honours that once `main` has a required check to
wait on, so this is a **one-time owner setup** (nothing merges automatically
until it's done):

1. **Allow auto-merge** — Repo **Settings → General → Pull Requests →** check
   **"Allow auto-merge"**. Without it, `gh pr merge --auto` errors and every
   PR waits for a manual merge.
2. **Protect `main`** — Repo **Settings → Branches → Add branch ruleset** (or
   classic branch protection) targeting `main`, with just:
   - **Require status checks to pass** → add **`build / build`** (the
     pr-preview build; it runs on every PR, bot PRs included). This is the
     check auto-merge waits for.
   - Do **not** require checks that don't run on bot PRs (e.g. Claude Code
     Review is owner-only) — that would block every bot PR.
3. **Keep direct pushes working** — a required status check also applies to
   direct pushes, and `publish_calendars.yml` pushes the coverage graph
   straight to `main`. Add the GitHub Actions actor (or **"Repository admin"**)
   to the ruleset **bypass list** so that push isn't blocked; watch the next
   `publish_calendars.yml` run and add the bypass if its push starts failing.

Security model: this replaces the old `auto-merge-claude-prs.yml` janitor,
which enforced a path allowlist in workflow code. The guard now lives in the
bot prompts (`source-pipeline.yml`): a pipeline only
enables auto-merge when **every changed file is calendar content** (`sources/`,
`docs/`, `allowed-removals/`, caches); a PR touching `.github/`, `scripts/`,
`lib/`, `web/`, or config is left for you to review and merge. This is a
bot-side (advisory) guard rather than a GitHub-enforced one — if you later want
it enforced, add a `.github/CODEOWNERS` + **Require review from Code Owners**
(with *Required approvals* `0`) to the ruleset.

### Browserbase proxy (skip until a source actually needs it)

Some sites block GitHub Actions IPs or gate content behind a JS challenge.
Don't set this up preemptively, and don't mark sources `proxy: true` before
the secret exists. When needed: set the `BROWSERBASE_API_KEY` secret and add
`proxy: true` to the blocked source. Those sources are then fetched live
through Browserbase during the build — no AWS, S3, CloudFormation, or
residential cron.

### Favorites

Favorites are stored entirely in the browser's `localStorage` — there is
no backend, no sign-in, no multi-device sync, and no personal subscribable
ICS feed. Nothing to set up.

## 8. Code review tooling

This repo ships **Claude Code Review** as its automated PR reviewer, via two
GitHub Actions workflows:

- `.github/workflows/claude-code-review.yml` — reviews every PR
  automatically on open and on each push (`opened`/`synchronize`/`ready_for_review`/`reopened`).
  No trigger comment needed.
- `.github/workflows/claude.yml` — responds to `@claude` mentions in
  issue/PR comments for on-demand questions or an out-of-band re-review.

Both authenticate with the **`CLAUDE_CODE_OAUTH_TOKEN`** repo secret —
generate one with `claude setup-token` (or install the Claude GitHub App)
and add it under Settings → Secrets and variables → Actions, ideally before
your first PR. If the secret isn't set, the workflows are inert; skip the
review-iteration steps and treat human review as the gate — everything else
in the workflow applies as written.

## 9. Staying current with the upstream engine

Template copies don't track the upstream repo. To pull engine improvements:

```sh
git remote add upstream https://github.com/prestomation/206events
git fetch upstream
git merge upstream/main --allow-unrelated-histories   # first time only
git merge upstream/main                               # thereafter
```

Because your copy deleted the seed content once and never recreates the
same paths, merges touch engine files only; `city.config.ts` conflicts only
when the schema itself changes.

## Day-2 operations

- `https://<your-domain>/build-errors.json` is the single source of truth
  for build health; every reporting surface reads it.
- The skills under `skills/` are the operational runbook — `build-report`
  daily, the resolver skills to drain the non-fatal queues, `geo-resolver`
  to grow `KNOWN_VENUE_COORDS` for your city. The automation workflows in
  [`docs/routines.md`](./routines.md) run that runbook for you.
- `AGENTS.md` is the contributor/agent manual for everything else.
