---
name: Murder By The Book
status: candidate
platform: Drupal 11 + IndieCommerce (HTML-only)
url: https://www.murderbooks.com/events
tags: [Books, "West University"]
firstSeen: 2026-06-14
lastChecked: 2026-06-15
pr:
---

One of the nation's largest mystery-genre specialty bookstores (est. 1980),
at 2342 Bissonnet St, Houston, TX 77005 (Museum District / West University area).
Approximately 200+ author events/year; heavy focus on crime, thriller, and
mystery authors.

## Investigation Results

**No ICS/RSS feed found.** Tested:
- `https://www.murderbooks.com/events?ical=1` → 404
- `https://www.murderbooks.com/events/feed` → 404
- `https://www.murderbooks.com/events.ics` → 404

**Events are server-rendered HTML.** The `/events` page lists upcoming events
with a clean, parseable structure:

- Each event is a `<article id="event-XXXX" class="event-list">`
- **Date:** `<span class="event-list__date--month">` and `event-list__date--day`
- **Title:** `<h3 class="event-list__title"><a>` (also href to detail page)
- **Time:** `<div class="event-list__details--item">` with "Time:" label
- **Location:** Fixed at 2342 Bissonnet St, Houston, TX 77005 (in `event-details__location--location`)
- **Description:** `<div class="event-list__body">` (truncated with "...")
- **Image:** `<img src="/sites/default/files/styles/large/public/YYYY-MM/...">` (event banner)

Tech stack: **Drupal 11** + **Commerce 3** (via Generator meta tag).

## Implementation Notes

**Scrapability:** ✅ Server-rendered, no JS required. Selectable via CSS classes.

**Potential future custom ripper:**
1. Parse events from `https://www.murderbooks.com/events` (may paginate)
2. Extract date (month + day as separate elements)
3. Extract title from `a` in `h3.event-list__title`
4. Extract time from `event-list__details--item` containing "Time:" label
5. Parse full event details by fetching detail page (href in title link)
6. Fixed location: 2342 Bissonnet St, Houston, TX 77005

**Related sources:** Blue Willow Bookshop and Brazos Bookstore also use
Drupal + IndieCommerce — a shared ripper pattern could cover all three.

## Custom Ripper Implemented

Custom HTML ripper written at `sources/murder-by-the-book/`. Unit tests
pass with **10 events** from the live-fetched `sample-data.html` (June 2026
sample). Status set to `candidate` — awaiting CI confirmation of >0 events
before flipping to `added`.

**Selectors used:**
- Event articles: `article.event-list`
- Title: `h3.event-list__title a` (text + href)
- Date: `.event-list__details--item` text after "Date: " label — format `Wed, 6/3/2026`
- Time: `.event-list__details--item` text after "Time: " label — format `6:30pm` or `6:30pm - 8:00pm`
- Description: `.event-list__body` text (truncated)
- Image: `.event-list__second--top .event-list__image img[src]`

**Stable ID:** `slugify(title)-YYYY-MM-DD`
