import { describe, expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ZoneId } from '@js-joda/core';
import '@js-joda/timezone';
import { parseEvents } from './ripper.js';
import { RipperCalendarEvent } from '../../lib/config/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleHtml = readFileSync(join(__dirname, 'sample-data.html'), 'utf-8');
const timezone = ZoneId.of('America/Chicago');

describe('LawndaleArtCenterRipper', () => {
    describe('parseEvents', () => {
        test('extracts at least one event from sample HTML', () => {
            const results = parseEvents(sampleHtml, timezone, 'lawndale-art-center');
            const events = results.filter((r): r is RipperCalendarEvent => 'date' in r);
            expect(events.length).toBeGreaterThanOrEqual(1);
        });

        test('first event has a non-empty summary', () => {
            const results = parseEvents(sampleHtml, timezone, 'lawndale-art-center');
            const events = results.filter((r): r is RipperCalendarEvent => 'date' in r);
            expect(events[0]).toBeDefined();
            expect(events[0]!.summary).toBeTruthy();
        });

        test('first event date is in year >= 2026', () => {
            const results = parseEvents(sampleHtml, timezone, 'lawndale-art-center');
            const events = results.filter((r): r is RipperCalendarEvent => 'date' in r);
            expect(events[0]).toBeDefined();
            expect(events[0]!.date.year()).toBeGreaterThanOrEqual(2026);
        });

        test('all events have unique ids', () => {
            const results = parseEvents(sampleHtml, timezone, 'lawndale-art-center');
            const events = results.filter((r): r is RipperCalendarEvent => 'date' in r);
            const ids = events.map(e => e.id).filter(Boolean);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });

        test('events have stable deterministic ids', () => {
            const results1 = parseEvents(sampleHtml, timezone, 'lawndale-art-center');
            const results2 = parseEvents(sampleHtml, timezone, 'lawndale-art-center');
            const events1 = results1.filter((r): r is RipperCalendarEvent => 'date' in r);
            const events2 = results2.filter((r): r is RipperCalendarEvent => 'date' in r);
            expect(events1.map(e => e.id)).toEqual(events2.map(e => e.id));
        });

        test('events have ripped date set', () => {
            const results = parseEvents(sampleHtml, timezone, 'lawndale-art-center');
            const events = results.filter((r): r is RipperCalendarEvent => 'date' in r);
            for (const event of events) {
                expect(event.ripped).toBeInstanceOf(Date);
            }
        });

        test('events have positive duration', () => {
            const results = parseEvents(sampleHtml, timezone, 'lawndale-art-center');
            const events = results.filter((r): r is RipperCalendarEvent => 'date' in r);
            for (const event of events) {
                expect(event.duration.seconds()).toBeGreaterThan(0);
            }
        });

        test('events have URL pointing to lawndaleartcenter.org', () => {
            const results = parseEvents(sampleHtml, timezone, 'lawndale-art-center');
            const events = results.filter((r): r is RipperCalendarEvent => 'date' in r);
            for (const event of events) {
                if (event.url) {
                    expect(event.url).toContain('lawndaleartcenter.org');
                }
            }
        });
    });
});
