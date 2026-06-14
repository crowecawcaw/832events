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
(832.events) actually runs: four workflows. A copy is **self-maintaining**
once all four exist — see the operator journey in
[`city-template.md`](./city-template.md#operator-journey).

The prompts in each workflow are **suggested templates** — adjust wording,
cadence, and scope to taste by editing the workflow file.

## Quick reference

| Workflow | File | Trigger | Runs |
|---|---|---|---|
| [Build-error responder](#1-build-error-responder) | `publish_calendars.yml` (`build-error-responder` job) | After a build with errors (≤ once per 24 h) | `skills/build-report/SKILL.md` |
| [Daily source discovery](#2-daily-source-discovery) | `claude-source-discovery.yml` | `schedule` (daily) + `workflow_dispatch` | `skills/source-discovery/SKILL.md` steps 1–5 |
| [Daily source implementation](#3-daily-source-implementation) | `claude-source-implementation.yml` | `schedule` (daily, offset) + `workflow_dispatch` | `skills/source-discovery/SKILL.md` steps 6–8 |
| [GitHub-issues responder](#4-github-issues-responder) | `claude-issue-responder.yml` | `issues: [opened, reopened]` | triage → the matching skill |

All four authenticate with the same `CLAUDE_CODE_OAUTH_TOKEN` secret and
skip silently on a copy that hasn't set it (or, for the three new
workflows, on a fork whose `github.repository` doesn't match the reference
instance).

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

## 4. GitHub-issues responder

**Purpose:** act on user feedback. The in-app feedback form files labeled
GitHub issues automatically (see [`user-feedback.md`](./user-feedback.md)),
and users also open issues by hand — bug reports, new-source requests,
stale-calendar reports. This workflow triages them and turns them into PRs.

**Trigger & cadence:** `.github/workflows/claude-issue-responder.yml`,
`on: issues: [opened, reopened]`. Issues that explicitly mention `@claude`
are skipped here and handled by `claude.yml` (the on-demand mention
handler) instead, so the two don't double-process the same issue.

**Prompt (in the workflow):**

```
... For a new-source request, follow skills/source-discovery/SKILL.md
(quality gates included). For a broken or incorrect calendar, follow
skills/build-report/SKILL.md conventions to fix the ripper. For an event
poster or "is X covered?" question, follow skills/source-from-event/SKILL.md.
Open a PR and comment on the issue with the result.
```

**Secrets & repo coupling:** `CLAUDE_CODE_OAUTH_TOKEN`. (The
`FEEDBACK_GITHUB_ISSUES_TOKEN` secret mentioned in the favorites-worker
setup is unrelated — it lets the *feedback form* file issues, not the
responder read them.)

**Without it:** feedback-form submissions and user issues sit until a
human triages them.
