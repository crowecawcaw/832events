---
name: Midtown Houston Management District
status: investigating
platform: The Events Calendar (Cloudflare-protected)
url: https://midtownhouston.com/explore/events/
tags: [Community, Arts, Midtown]
firstSeen: 2026-06-15
lastChecked: 2026-06-15
---

Midtown Houston Management District promotes events and programming in the Midtown neighborhood. Their calendar lists free and community events including park programming, fitness, arts, and cultural activities.

## Details

- **Events Page**: https://midtownhouston.com/explore/events/
- **Calendar Platform**: The Events Calendar (Tribe Events plugin)
- **Event Categories**: Arts + Culture, Parks (Bagby Park, Baldwin Park, Glover Park, Midtown Park), Community Events, Committee Meetings, Family Activities
- **Estimated Volume**: 20+ events/month

## Investigation Results (2026-06-15)

### ICS Feed URLs Tested
1. `https://midtownhouston.com/?post_type=tribe_events&ical=1&eventDisplay=list` → HTTP 403 (Cloudflare block)
2. `https://midtownhouston.com/explore/events/?ical=1` → HTTP 403 (Cloudflare block)
3. Main events page: `https://midtownhouston.com/explore/events/` → HTTP 403 (Cloudflare block)

### Findings

- **Status**: All requests blocked by Cloudflare WAF
- **No direct curl access** from CI/local environments
- **No visible BEGIN:VEVENT** in captured responses (all returned Cloudflare error pages)
- **Confirmed platform**: Website uses The Events Calendar plugin (tribe_events post type visible in attempted URL)
- **Recommendation**: Requires `proxy: "outofband"` or `proxy: "browserbase"` to fetch successfully

## Next Steps

Requires proxy-escalation flow. Either:
1. Mark as `proxy: "outofband"` and allow out-of-band runner to verify feed validity, or
2. Confirm via manual browser visit that ICS feed works before implementation
