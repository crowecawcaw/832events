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
(832.events) actually runs: three scheduled/error-driven workflows, plus
the owner-driven interactive workflows (`@claude` mentions and PR review).
A copy is **self-maintaining** once the three exist — see the operator
journey in [`city-template.md`](./city-template.md#operator-journey).

The prompts in each workflow are **suggested templates** — adjust wording,
cadence, and scope to taste by editing the workflow file.

## Quick reference

| Workflow | File | Trigger | Runs |
|---|---|---|---|
| [Build-error responder](#1-build-error-responder) | `publish_calendars.yml` (`build-error-responder` job) | After a build with errors (≤ once per 24 h) | `skills/build-report/SKILL.md` |
| [Daily source discovery](#2-daily-source-discovery) | `claude-source-discovery.yml` | `schedule` (daily) + `workflow_dispatch` | `skills/source-discovery/SKILL.md` steps 1–5 |
| [Daily source implementation](#3-daily-source-implementation) | `claude-source-implementation.yml` | `schedule` (daily, offset) + `workflow_dispatch` | `skills/source-discovery/SKILL.md` steps 6–8 |

All three authenticate with the same `CLAUDE_CODE_OAUTH_TOKEN` secret and
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
and opens PR(s) with its fixes.

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

## 2. Daily source discovery

**Purpose:** grow the catalog — scan for new event sources in your city,
quality-gate them, record candidates under `docs/source-candidates/`, and
flag dead sources.

**Trigger & cadence:** `.github/workflows/claude-source-discovery.yml`,
`schedule` daily (plus `workflow_dispatch` for a manual run).

**Prompt (in the workflow):**

```
Read skills/source-discovery/SKILL.md and follow steps 1-5 (discovery and
candidate triage only - do not implement a source). Record new candidates
under docs/source-candidates/ and append today's discovery log.
```

**Secrets & repo coupling:** `CLAUDE_CODE_OAUTH_TOKEN`.

**Without it:** the source catalog stops growing and dead sources go
unflagged until a human runs the skill.

## 3. Daily source implementation

**Purpose:** turn candidates into live calendars — pick the
highest-confidence candidate from `docs/source-candidates/` and implement
it as its own PR, following the quality gates.

**Trigger & cadence:**
`.github/workflows/claude-source-implementation.yml`, `schedule` daily
(offset a few hours after the discovery workflow so fresh candidates are
available) plus `workflow_dispatch`.

**Prompt (in the workflow):**

```
Read skills/source-discovery/SKILL.md and follow it from step 6: pick the
highest-confidence existing candidate in docs/source-candidates/ and
implement that one source as a PR. Do not run the discovery scan.
```

**Secrets & repo coupling:** `CLAUDE_CODE_OAUTH_TOKEN`.

**Without it:** candidates pile up in `docs/source-candidates/`
unimplemented.

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
