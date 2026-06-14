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
| [Source pipeline](#2-source-pipeline) | `claude-sources.yml` | `schedule` (daily) + `workflow_dispatch` | `skills/source-discovery/SKILL.md` steps 1–8 |

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

- **Discovery hands its markdown to implementation in-session.** Phase 1
  writes the candidate files and discovery log into the working tree but
  does **not** commit or push them on their own. Phase 2 carries those
  changes forward, so the discovery markdown rides into the same PR as the
  code rather than landing as a separate commit or throwaway PR.
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

**Purpose:** grow the catalog in one daily run that does both halves of
the source pipeline in a single session:

- **Discovery** (`skills/source-discovery/SKILL.md` steps 1–5) — scan for
  new event sources in your city, quality-gate them, write candidates
  under `docs/source-candidates/`, append today's discovery log, and flag
  dead sources. This markdown stays in the working tree and is **handed to
  the implementation half in-session** — it is never committed to `main`
  on its own (see [Autonomous PRs](#autonomous-prs-in-session-validation-owner-merges)
  above).
- **Implementation** (`skills/source-discovery/SKILL.md` steps 6–8) —
  pick the highest-confidence candidate and implement that one source,
  following the quality gates, then open **one PR for human review** that
  carries both the Phase 1 markdown and the new source code. The PR is
  self-validated in-session (build + tests + `/code-review`) since CI won't
  run on a bot PR. The repo owner merges it.

Running both halves in one session means each day's freshly-discovered
candidates flow straight into the implementation half, with no offset
scheduling and no intermediate commit to `main`. If a run turns up nothing
worth implementing, it opens a markdown-only PR with the discovery
log / candidate / dead-source updates instead.

**Trigger & cadence:** `.github/workflows/claude-sources.yml`, `schedule`
daily (plus `workflow_dispatch` for a manual run).

**Prompt (in the workflow):**

```
Phase 1 — discovery (steps 1-5): write candidates + discovery log to the
working tree, hand them to Phase 2. Phase 2 — implementation (from step
6): implement the highest-confidence candidate and open ONE human-review
PR carrying both the Phase 1 markdown and the source code.
```

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
