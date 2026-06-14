---
name: The Riot Houston
status: investigating
platform: StandUpTix (unknown)
url: https://www.theriothtx.com/
tags: [Comedy, Montrose]
firstSeen: 2026-06-14
lastChecked: 2026-06-14
pr:
---

Active comedy club at 2010 Waugh Dr, Houston, TX 77006 (Montrose).
Shows every night of the week: open mics, showcases, headliner sets —
approximately 45–50 shows per 4-week window. Very high volume source.

Ticketing platform appears to be StandUpTix, a comedy-specific ticketing
system. Investigation needed:
1. Check browser Network tab for API calls on the events page
2. Look for a JSON endpoint or calendar export
3. Check if there is an ICS subscribe link
4. Investigate StandUpTix platform for public API documentation

**Next step:** Inspect `https://www.theriothtx.com/` network traffic to
identify the data source (API calls, embedded calendar widget, etc.) and
determine whether a machine-readable feed exists before deciding on
implementation approach.
