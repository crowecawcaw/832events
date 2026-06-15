---
name: Houston Botanic Garden
status: investigating
platform: Custom CMS (no ICS found)
url: https://hbg.org/events/
tags: [Parks, Nature, Community]
firstSeen: 2026-06-15
lastChecked: 2026-06-15
pr:
---

75-acre botanic garden opened in 2020. Located at 1 Botanical Lane, Houston,
TX 77017 (Sims Bayou / Southeast Houston area). Programming includes
BotaniCamp youth programs, family nights, wellness classes, cultural
celebrations, and evening events.

June–August 2026 calendar (12 events visible):
- Garden Guardians (BotaniCamp) – June 15
- Juneteenth Jamboree with Houston BLCK Market – June 20
- Water Wonders (BotaniCamp) – June 22
- Somatic Mindfulness – June 27
- LEGO Night with Houston Toy Museum – July 11
- A Brush with Nature – July 18
- Salsa Night – August 29
- (plus more BotaniCamp sessions July–August)

**Calendar platform**: Custom CMS — no tribe_events URLs, no ICS subscription
link, no Google Calendar subscribe button found on the events page (hbg.org/events/).
No Eventbrite integration visible. Platform identity unknown.

**Next steps**: Check if hbg.org is built on WordPress, Drupal, or another
platform that has a hidden ICS endpoint. Try:
- `https://hbg.org/?post_type=tribe_events&ical=1&eventDisplay=list`
- `https://hbg.org/events/feed/`
- Check page source for calendar plugin scripts

**Confidence**: Investigating — strong event volume and community relevance,
but no machine-readable feed confirmed yet.

**geo**: Near Sims Bayou, Southeast Houston — address 1 Botanical Lane,
Houston, TX 77017. Not in a standard neighborhood in city.config.ts;
nearest recognized area is South Houston / Harrisburg.
