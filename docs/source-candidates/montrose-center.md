---
name: Montrose Center
status: notviable
platform: Tribe Events (ICS)
url: https://montrosecenter.org/events/
tags: [Montrose, Community]
firstSeen: 2026-06-14
lastChecked: 2026-06-16
pr: 10
---

LGBTQ+ community center at 401 Branard St, Houston, TX 77006 (Montrose).
High-volume programming includes support groups, yoga, game nights, theater
performances, senior programs, and community events — approximately 35
events/month.

Previously added as `sources/external/montrose-center.yaml` (PR #10), then
removed. The ICS feed mixes public programming with private/semi-private
support group meetings (grief groups, addiction recovery, etc.) that cannot
be filtered at the external ICS level. Per the no-support-groups policy,
sources whose feeds include substantial support group content are not
suitable unless events can be filtered. A custom ripper that excludes
support group event titles could revisit this, but it was not pursued.
