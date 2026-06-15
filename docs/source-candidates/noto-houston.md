---
status: investigating
slug: noto-houston
firstSeen: 2026-06-15
lastChecked: 2026-06-15
---

# NOTO Houston

## Summary
NOTO Houston is a nightlife venue at 3215 McKinney St (EaDo neighborhood). Primary ticketing platform is **Speakeasy** (proprietary), not Eventbrite. Events displayed on website link to `speakeasygo.com/NOTO-Houston/...`.

## Details

**Venue:** NOTO Houston  
**Address:** 3215 McKinney St, Houston, TX 77003  
**Location:** EaDo (East Downtown)  
**Type:** Nightclub / Live Events Venue  
**Website:** https://notohtx.com  

## Ticketing Investigation

**Speakeasy (Primary):**
- All events on notohtx.com link to `https://speakeasygo.com/NOTO-Houston/`
- Website footer shows "Powered by Speakeasy"
- Speakeasy is a proprietary ticketing platform with no public API or ICS feed
- Multiple upcoming events observed (Jersey Party World Cup, DRC World Cup, Mariah The Scientist, RNB Night Juneteenth)

**Eventbrite (Secondary/Mirror):**
- Org ID: `69829155243` (unverified as primary source)
- Page exists with title "NOTO Events"
- Contains at least 1-2 events (Mariah The Scientist visible)
- Appears to be incomplete mirror of Speakeasy calendar — significantly fewer events than primary ticketing platform

## Findings

1. **Primary platform is Speakeasy (not Eventbrite)** — website exclusively links there
2. **Eventbrite appears secondary** — may have stale/incomplete event listings
3. **No public feed available** — Speakeasy does not expose ICS, API, or RSS to public
4. **Would require custom Speakeasy ripper** — but no documented API; would need reverse-engineering or HTML scraping

## Recommendation

**Status: `investigating`** — Not viable as primary source without:
- Speakeasy API (not available publicly)
- Custom ripper development + ongoing maintenance
- Or escalation to proxy (Browserbase) for Speakeasy HTML scraping

If Eventbrite coverage is desired as *secondary* collection, consider `type: eventbrite` with org ID `69829155243`, but note events will lag behind primary Speakeasy listings.

## Next Steps

- [ ] Determine if Eventbrite secondary mirror is sufficient, or requires Speakeasy scraping
- [ ] If Speakeasy required: evaluate proxy→Browserbase for JS-heavy ticketing pages
