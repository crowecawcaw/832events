# Claude Code automation: the recommended workflow set

The skills under `skills/` are the operating manual; the **automation
workflows** are what run them on a schedule so the site maintains itself.
These run as **GitHub Actions workflows** using the
[`anthropics/claude-code-action@v1`](https://github.com/anthropics/claude-code-action)
action — they live entirely in this repo (`.github/workflows/`) and need
**only** the `CLAUDE_CODE_OAUTH_TOKEN` secret that the PR-review and
`@claude`-mention workflows already use.

> **History:** these used to be *routines* — resources created in your
> Anthropic account and pointed at the repo, fired on an account schedule.
> They have been replaced with in-repo GitHub Actions so the whole
> automation set is versioned alongside the code, needs no account-scoped
> resources, and reuses the single `CLAUDE_CODE_OAUTH_TOKEN` secret. The
> old `CLAUDE_ROUTINE_ID` / `CLAUDE_ROUTINE_TOKEN` secrets and the
> routine-fire API call are no longer used.

This catalog documents the automation set the reference instance
(832.events) actually runs: two scheduled/error-driven workflows, plus
the owner-driven interactive workflows (`@claude` mentions and PR review).
A copy is **self-maintaining** once the two exist — see the operator
journey in [`city-template.md`](./city-template.md#operator-journey).

The prompts in each workflow are **suggested templates** — adjust wording,
cadence, and scope to taste by editing the workflow file.

## Quick reference

| Workflow | File | Trigger | Runs |
|---|---|---|---|
| [Build-error responder](#1-build-error-responder) | `publish_calendars.yml` (`build-error-responder` job) | After a build with errors (≤ once per 24 h) | `skills/build-report/SKILL.md` |
| [Source pipeline](#2-source-pipeline) | `claude-sources.yml` | `schedule` (daily 08:30 UTC) + `workflow_dispatch` | `skills/source-discovery/SKILL.md` |

Both authenticate with the same `CLAUDE_CODE_OAUTH_TOKEN` secret and
skip silently on a copy that hasn't set it (or, on a fork whose
`github.repository` doesn't match the reference instance).

## Access control (who can trigger Claude)

These workflows run Claude with `contents: write` / `pull-requests: write`
and the `CLAUDE_CODE_OAUTH_TOKEN` secret, so trigger access is restricted
to the **repo owner**:

- **Scheduled workflows** (discovery, implementation) can't be triggered by
  outsiders — `schedule` isn't user-initiated and `workflow_dispatch`
  requires write access. They're additionally fork-guarded by
  `github.repository`.
- **Build-error responder** runs inside the publish pipeline (push to
  `main` / schedule / dispatch), never on PRs.
- **Interactive workflows** are owner-gated in their job `if:`:
  `claude.yml` (`@claude` mentions on issues/PRs/reviews) requires
  `github.actor == github.repository_owner`, and `claude-code-review.yml`
  only runs for PRs authored by the owner
  (`github.event.pull_request.user.login == github.repository_owner`).

The gate is on the **triggering actor**, not `author_association` — a
stranger commenting `@claude` on an issue *you* opened still carries your
`author_association` on the issue payload, so an actor check is the correct
signal. There is intentionally **no** workflow that auto-acts on
externally-opened issues or external/fork PRs. To drive Claude on any
issue or PR, the owner comments `@claude`.

> If this repo is ever moved under a GitHub **org**, `github.repository_owner`
> becomes the org name (which no `github.actor` equals), locking everyone
> out — switch the gates to an explicit login allowlist at that point. The
> same allowlist is how you'd grant a trusted collaborator access.

## Autonomous PRs: in-session validation, owner merges

The build-error responder and the source pipeline act from inside GitHub
Actions using the default `GITHUB_TOKEN`. GitHub attributes those to
`github-actions[bot]` and — by design, to prevent recursion — **does not
start new workflow runs from `GITHUB_TOKEN` events**. So a bot push to
`main`, and any PR a bot opens, does **not** trigger CI (`pr-preview.yml`,
`web-e2e.yml`) or the automated `claude-code-review.yml`. (This only
affects bot activity; pushes and PRs *you* make trigger everything
normally.)

Rather than introduce a privileged App/PAT token to work around the
recursion guard, these workflows **self-validate in the same session**
before landing anything.

**Everything lands in one human-review PR — nothing is committed to
`main` directly.**

- **Discovery hands its markdown to implementation in-session.** An
  orchestrator agent runs a discovery sub-agent (writes the candidate files
  and discovery log into the working tree, reports its top pick) and then an
  implementation sub-agent (builds that candidate). Neither sub-agent
  commits or pushes; the markdown stays in the working tree and rides into
  the same PR as the code rather than landing as a separate commit or
  throwaway PR.
- **The pipeline opens one PR for human review.** Phase 2 implements the
  highest-confidence candidate, then opens a single PR containing both the
  Phase 1 markdown (discovery log + candidate files) and the source code.
  It writes real code, which should be validated by a human (and ideally
  real CI) before landing, so it **never** pushes to `main` or self-merges.
  Before opening the PR it builds the affected source
  (`ONLY_SOURCE=<source> npm run generate-calendars`), runs `npm run
  test:all`, and runs `/code-review` on the working-tree diff, addressing
  findings (the `code-review` plugin is loaded for this). The build-error
  responder follows the same self-validate-then-PR pattern. Their prompts
  explicitly tell Claude *not* to wait for CI/review or enable auto-merge,
  since neither will fire on a bot-opened PR.

If you later want the fully hands-off auto-review/auto-merge loop for the
pipeline's PR, give it a GitHub App or fine-grained PAT as `github_token`
(so its PRs trigger downstream workflows) and widen the
`claude-code-review.yml` gate to that identity.

## 1. Build-error responder

**Purpose:** drain `build-errors.json` — fix broken sources, resolve
geocode errors, and chain into the resolver skills (uncertainty, photos,
costs, proxy escalation). When the build is healthy it falls through to
source discovery, so even this one workflow keeps a copy improving.

**Trigger & cadence:** the `build-error-responder` job in
`.github/workflows/publish_calendars.yml` runs after the daily build when
the build finished with a non-zero error count (push, schedule, or manual
dispatch — never on PRs, since that workflow doesn't trigger on PRs). It is
rate-limited to at most once per rolling 24 h window via the Actions cache;
a `workflow_dispatch` run with `force_routine=true` bypasses the limit. The
job runs `anthropics/claude-code-action@v1` with the build-report prompt
and opens PR(s) with its fixes, self-validated in-session (see
[Autonomous PRs](#autonomous-prs-in-session-validation-owner-merges) above).

**Prompt (in the workflow):**

```
Read skills/build-report/SKILL.md and follow it completely ...
```

**Secrets & repo coupling:** `CLAUDE_CODE_OAUTH_TOKEN`. The job skips
silently when the secret is unset.

**Without it:** build-error triage is manual — watch
`https://<your-domain>/build-errors.json` (or the Discord notification,
if enabled) and run `skills/build-report/SKILL.md` yourself when errors
appear.

## 2. Source pipeline

**Purpose:** grow the catalog. A single daily workflow discovers new sources
and implements the best ones in one run:

- **Discover** (`skills/source-discovery/SKILL.md` steps 1–5) — scan for new
  event sources in your city, quality-gate them, and record candidates in
  `docs/source-candidates.json` (git history is the log). Flag dead sources.
- **Implement** (`skills/source-discovery/SKILL.md` steps 6–8) — build **up to
  5** pending candidates, cheapest/highest volume first (external ICS + built-in
  platform rippers), validating each in-session (`npm run validate`, per-source
  `ONLY_SOURCE` build, `npm run test:all`, `/code-review`). It opens **one PR
  for human review** with all successfully-built sources plus the
  `docs/source-candidates.json` updates. Since CI won't run on a bot-authored
  PR, in-session validation is the gate; the repo owner merges.

If discovery turns up nothing and no candidates are implementable, it opens no PR.

**Trigger & cadence:** `.github/workflows/claude-sources.yml` (`schedule` daily
08:30 UTC); also supports `workflow_dispatch` for a manual run.

**Secrets & repo coupling:** `CLAUDE_CODE_OAUTH_TOKEN`.

**Without it:** the source catalog stops growing, dead sources go
unflagged, and candidates are never implemented until a human runs the
skill.

## Issues, PRs, and comments (owner-driven, not automated)

There is intentionally **no** workflow that auto-acts on externally-opened
issues or external/fork PRs — this instance doesn't take external
contributions, and an agent with write access reacting to stranger input
is exposure we don't want (see [Access control](#access-control-who-can-trigger-claude)).

To act on an issue or PR, the **owner** drives Claude on demand by
commenting `@claude` with the request (handled by `claude.yml`, owner-gated).
For a new-source request follow `skills/source-discovery/SKILL.md`; for a
broken calendar follow `skills/build-report/SKILL.md`; for an event poster
or "is X covered?" question follow `skills/source-from-event/SKILL.md`. PRs
the owner opens are auto-reviewed by `claude-code-review.yml`.
