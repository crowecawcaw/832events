// @ts-ignore — ical.js has no type declarations
import ICAL from "ical.js";
import { Duration, LocalDate, LocalDateTime, ZoneId, ZonedDateTime } from "@js-joda/core";
import "@js-joda/timezone";
import { getFetchForConfig } from "../../lib/config/proxy-fetch.js";
import {
  IRipper,
  Ripper,
  RipperCalendar,
  RipperCalendarEvent,
} from "../../lib/config/schema.js";

const TIMEZONE = ZoneId.of("America/Chicago");

/**
 * Returns true for paid enrollment-style academic courses that should be
 * excluded per the source-discovery quality gate (item #8).
 *
 * Catches: info sessions for paid programs, certificate/certification courses,
 * paid executive-education multi-day workshops, and paid tech camps.
 */
function isEnrollmentStyleCourse(summary: string, description: string): boolean {
  const s = summary.toLowerCase();
  const d = description.toLowerCase();
  return (
    /(information|info)\s+session/.test(s) ||
    /certificate/.test(s) ||
    /\bcertifi(ed|ication)\b/.test(s) ||
    /elite tech camp/.test(s) ||
    /executive education/.test(d)
  );
}

function icalTimeToZonedDateTime(t: any): ZonedDateTime {
  if (t.isDate) {
    // All-day event: represent as 10:00 AM local time
    return ZonedDateTime.of(
      LocalDate.of(t.year, t.month, t.day).atTime(10, 0),
      TIMEZONE
    );
  }
  const tzId: string | undefined = t.timezone;
  const zone =
    !tzId || tzId === "floating" ? TIMEZONE : ZoneId.of(tzId);
  return ZonedDateTime.of(
    LocalDateTime.of(t.year, t.month, t.day, t.hour, t.minute),
    zone
  );
}

export default class RicePublicEventsRipper implements IRipper {
  public async rip(ripper: Ripper): Promise<RipperCalendar[]> {
    const fetchFn = getFetchForConfig(ripper.config);
    const res = await fetchFn(ripper.config.url.toString());
    if (!res.ok) {
      throw new Error(`${ripper.config.url} returned HTTP ${res.status}`);
    }

    const icsContent = await res.text();
    const jcalData = ICAL.parse(icsContent);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents("vevent");

    const events: RipperCalendarEvent[] = [];

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);
      const summary: string = event.summary ?? "";
      const description: string = event.description ?? "";

      if (isEnrollmentStyleCourse(summary, description)) continue;

      const startTime = event.startDate;
      if (!startTime) continue;

      let date: ZonedDateTime;
      try {
        date = icalTimeToZonedDateTime(startTime);
      } catch {
        continue;
      }

      let duration: Duration;
      const endTime = event.endDate;
      if (endTime && !endTime.isDate && !startTime.isDate) {
        const startMs = startTime.toJSDate().getTime();
        const endMs = endTime.toJSDate().getTime();
        const diffMs = endMs - startMs;
        duration = diffMs > 0
          ? Duration.ofSeconds(Math.round(diffMs / 1000))
          : Duration.ofHours(2);
      } else {
        // All-day or no end time: use 8 hours for exhibitions, 2 hours otherwise
        duration = startTime.isDate ? Duration.ofHours(8) : Duration.ofHours(2);
      }

      const uid: string = vevent.getFirstPropertyValue("uid") as string ?? "";
      const id = uid.split("@")[0] ?? `rice-${summary.slice(0, 20)}-${date.toLocalDate()}`;

      const urlVal = vevent.getFirstPropertyValue("url");
      const url = typeof urlVal === "string"
        ? urlVal.replace(/&amp;/g, "&")
        : undefined;

      const location: string | undefined = event.location || undefined;

      // Image: prefer X-LIVEWHALE-IMAGE, fall back to ATTACH
      let imageUrl: string | undefined;
      const lwImage = vevent.getFirstProperty("x-livewhale-image");
      const lwImageVal = lwImage?.getFirstValue?.() as string | undefined;
      if (typeof lwImageVal === "string" && lwImageVal.startsWith("http")) {
        imageUrl = lwImageVal;
      } else {
        const attach = vevent.getFirstProperty("attach");
        const attachVal = attach?.getFirstValue?.();
        if (typeof attachVal === "string" && attachVal.startsWith("http")) {
          imageUrl = attachVal;
        }
      }

      events.push({
        id,
        ripped: new Date(),
        date,
        duration,
        summary,
        description: description || undefined,
        url,
        location,
        imageUrl,
      });
    }

    const cal = ripper.config.calendars[0]!;
    return [
      {
        name: cal.name,
        friendlyname: cal.friendlyname,
        events,
        errors: [],
        tags: ripper.config.tags ?? [],
        parent: ripper.config,
      },
    ];
  }
}
