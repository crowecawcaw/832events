# 832.events

Subscribe to Houston-area event calendars in your favorite calendar
app. This project scrapes event data from local websites, ICS feeds, and
APIs, then publishes them as standard iCalendar (.ics) files you can add to
Google Calendar, Apple Calendar, Outlook, or any other calendar application.

**https://832.events/**

Built from the [206.events city template](https://github.com/prestomation/206events)
— see `docs/SETUP.md` for the full setup walkthrough, `docs/city-template.md`
for how this instance is configured, and `AGENTS.md` for the agent-driven
maintenance workflow.

## Getting started

1. **Deploy**: edit `city.config.ts` if any value needs tuning (map bounds
   especially), set up the Cloudflare Pages project and GitHub secrets
   (`docs/SETUP.md` steps 4–5), and add your first sources —
   `skills/source-discovery/SKILL.md`.
2. **Self-maintain**: create the four Claude Code routines catalogued in
   `docs/routines.md` (build-error responder, daily source discovery,
   daily source implementation, GitHub-issues responder).
3. **Optional services**: Discord notifications, out-of-band proxy,
   favorites/sign-in — `docs/SETUP.md` step 7.

## Request a new calendar

Want a Houston-area event source added? Open an issue at
https://github.com/crowecawcaw/713events/issues with the website URL.
