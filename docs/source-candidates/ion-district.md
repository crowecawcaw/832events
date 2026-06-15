---
name: Ion District
status: investigating
platform: Community Calendar (Tribe Events - WPEngine hosted)
url: https://iondistrict.com/events/
tags: [Community, Tech, Innovation, Midtown]
firstSeen: 2026-06-15
lastChecked: 2026-06-15
---

Ion District is Houston's technology and innovation hub in Midtown (4201 Main St, Houston, TX 77002). Their website features community events including tech meetups, family festivals, and cultural programming.

## Details

- **Events Page**: https://iondistrict.com/events/
- **Platform**: Tribe Events (hosted on WPEngine)
- **Estimated Volume**: Moderate (10-15 events/month)
- **Blocker**: Cloudflare challenge blocks automated requests to entire iondistrict.com domain
- **HTTP Status**: 403 Forbidden from CI IPs

## Investigation Results (2026-06-15)

Attempted to locate ICS feed via:
1. `https://iondistrict.com/?post_type=tribe_events&ical=1&eventDisplay=list` → Cloudflare blocked (403)
2. `https://iondistrict.com/events/?ical=1` → Cloudflare blocked (403)
3. Main events page HTML inspection → All requests blocked by Cloudflare

The entire domain is protected by Cloudflare and blocks data-center IPs. The website uses Tribe Events (inferred from WPEngine hosting), which typically supports ICS feed at the patterns above, but we cannot verify the feed exists without bypassing Cloudflare.

## Recommendation

Set `proxy: "outofband"` if proceeding — standard Tribe Events feed URL likely exists, but cannot be verified from CI. Out-of-band runner should be able to fetch it from residential IP.
