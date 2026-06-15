import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ZoneId } from '@js-joda/core';
import '@js-joda/timezone';
import { parseEvents } from './ripper.js';
import { RipperCalendarEvent, ParseError } from '../../lib/config/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleHtml = readFileSync(join(__dirname, 'sample-data.html'), 'utf-8');
const tz = ZoneId.of('America/Chicago');

describe('McGonigelsMuckyDuckRipper', () => {
    it('extracts events from sample HTML', () => {
        const results = parseEvents(sampleHtml, tz, 'mcgonigels-mucky-duck');
        const events = results.filter((e): e is RipperCalendarEvent => 'date' in e);
        const errors = results.filter((e): e is ParseError => 'type' in e);

        expect(events.length).toBeGreaterThan(0);
        console.log(`Extracted ${events.length} events, ${errors.length} errors`);
    });

    it('parses year >= 2026 on first event', () => {
        const results = parseEvents(sampleHtml, tz, 'mcgonigels-mucky-duck');
        const events = results.filter((e): e is RipperCalendarEvent => 'date' in e);

        expect(events.length).toBeGreaterThan(0);
        const first = events[0];
        expect(first.summary).toBeTruthy();
        expect(first.date.year()).toBeGreaterThanOrEqual(2026);
    });

    it('parses correct time for a known event', () => {
        const results = parseEvents(sampleHtml, tz, 'mcgonigels-mucky-duck');
        const events = results.filter((e): e is RipperCalendarEvent => 'date' in e);

        // First visible event: Open Mic, 06/15/2026 6:00 pm
        const openMic = events.find(e => e.summary.startsWith('Open Mic') && e.id === 'mcgonigels-31876');
        expect(openMic).toBeDefined();
        expect(openMic!.date.hour()).toBe(18);   // 6pm = 18:00
        expect(openMic!.date.minute()).toBe(0);
    });

    it('assigns stable unique IDs derived from upstream id', () => {
        const results = parseEvents(sampleHtml, tz, 'mcgonigels-mucky-duck');
        const events = results.filter((e): e is RipperCalendarEvent => 'date' in e);

        const ids = events.map(e => e.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(events.length);
        // All IDs should follow the pattern mcgonigels-<number>
        for (const id of ids) {
            expect(id).toMatch(/^mcgonigels-\d+$/);
        }
    });

    it('same-day shows with different IDs get distinct event IDs', () => {
        const results = parseEvents(sampleHtml, tz, 'mcgonigels-mucky-duck');
        const events = results.filter((e): e is RipperCalendarEvent => 'date' in e);

        // Jun 17 has Irish Session at 7:30pm — multiple occurrences in data,
        // but only one should be visible (d-none hidden ones are excluded).
        // The visible one should have id mcgonigels-31936.
        const jun17Events = events.filter(e =>
            e.date.monthValue() === 6 &&
            e.date.dayOfMonth() === 17
        );
        const jun17Ids = jun17Events.map(e => e.id);
        const uniqueJun17Ids = new Set(jun17Ids);
        // All visible events on the same day must have distinct IDs
        expect(uniqueJun17Ids.size).toBe(jun17Events.length);
    });

    it('includes show URL when available', () => {
        const results = parseEvents(sampleHtml, tz, 'mcgonigels-mucky-duck');
        const events = results.filter((e): e is RipperCalendarEvent => 'date' in e);

        const withUrl = events.filter(e => e.url);
        expect(withUrl.length).toBeGreaterThan(0);
        // URL should be absolute and point to the shows subdirectory
        for (const ev of withUrl) {
            expect(ev.url).toMatch(/^https:\/\/www\.mcgonigels\.com\/shows\//);
        }
    });

    it('includes image URL when available', () => {
        const results = parseEvents(sampleHtml, tz, 'mcgonigels-mucky-duck');
        const events = results.filter((e): e is RipperCalendarEvent => 'date' in e);

        const withImage = events.filter(e => e.imageUrl);
        expect(withImage.length).toBeGreaterThan(0);
    });

    it('does not include hidden (d-none) card duplicates', () => {
        const results = parseEvents(sampleHtml, tz, 'mcgonigels-mucky-duck');
        const events = results.filter((e): e is RipperCalendarEvent => 'date' in e);

        // Hidden cards have IDs 31923, 31925, 31926, 32027 — none should appear
        const hiddenIds = ['mcgonigels-31923', 'mcgonigels-31925', 'mcgonigels-31926', 'mcgonigels-32027'];
        for (const hiddenId of hiddenIds) {
            const found = events.find(e => e.id === hiddenId);
            expect(found).toBeUndefined();
        }
    });
});
