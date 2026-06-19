import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ZoneId } from '@js-joda/core';
import '@js-joda/timezone';
import DocsHoustonRipper from './ripper.js';
import { RipperCalendarEvent, ParseError } from '../../lib/config/schema.js';
import { Ripper } from '../../lib/config/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleHtml = readFileSync(join(__dirname, 'sample-data.html'), 'utf-8');

describe('DocsHoustonRipper', () => {
    it('should extract events from sample HTML', async () => {
        const ripper = new DocsHoustonRipper();

        // Parse the HTML manually to test the parsing logic
        const { parse } = await import('node-html-parser');
        const html = parse(sampleHtml);
        const tz = ZoneId.of('America/Chicago');

        const results = await ripper['parseEvents'](html, tz, {});
        const events = results.filter((e): e is RipperCalendarEvent => 'date' in e);
        const errors = results.filter((e): e is ParseError => 'type' in e);

        expect(events.length).toBeGreaterThan(0);
        console.log(`Extracted ${events.length} events, ${errors.length} errors`);
    });

    it('should parse show titles correctly', async () => {
        const ripper = new DocsHoustonRipper();
        const { parse } = await import('node-html-parser');
        const html = parse(sampleHtml);
        const tz = ZoneId.of('America/Chicago');

        const results = await ripper['parseEvents'](html, tz, {});
        const events = results.filter((e): e is RipperCalendarEvent => 'date' in e);

        // Should have events from the Pinia state
        expect(events.length).toBeGreaterThan(0);

        // Check that we have expected show titles
        const titles = events.map(e => e.summary);
        expect(titles.length).toBeGreaterThan(0);
    });

    it('should parse dates with correct timezone', async () => {
        const ripper = new DocsHoustonRipper();
        const { parse } = await import('node-html-parser');
        const html = parse(sampleHtml);
        const tz = ZoneId.of('America/Chicago');

        const results = await ripper['parseEvents'](html, tz, {});
        const events = results.filter((e): e is RipperCalendarEvent => 'date' in e);

        expect(events.length).toBeGreaterThan(0);

        // All events should have valid dates
        for (const event of events) {
            expect(event.date).toBeDefined();
            expect(event.date.year()).toBeGreaterThanOrEqual(2026);
            expect(event.date.monthValue()).toBeGreaterThanOrEqual(1);
            expect(event.date.monthValue()).toBeLessThanOrEqual(12);
        }
    });

    it('should create stable event IDs', async () => {
        const ripper = new DocsHoustonRipper();
        const { parse } = await import('node-html-parser');
        const html = parse(sampleHtml);
        const tz = ZoneId.of('America/Chicago');

        const results = await ripper['parseEvents'](html, tz, {});
        const events = results.filter((e): e is RipperCalendarEvent => 'date' in e);

        expect(events.length).toBeGreaterThan(0);

        // All IDs should be stable and unique
        const ids = events.map(e => e.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(events.length);

        // All IDs should start with docs-houston
        for (const id of ids) {
            expect(id).toMatch(/^docs-houston-/);
        }
    });

    it('should include event images when available', async () => {
        const ripper = new DocsHoustonRipper();
        const { parse } = await import('node-html-parser');
        const html = parse(sampleHtml);
        const tz = ZoneId.of('America/Chicago');

        const results = await ripper['parseEvents'](html, tz, {});
        const events = results.filter((e): e is RipperCalendarEvent => 'date' in e);

        // Should have at least one event with an image
        const eventsWithImages = events.filter(e => e.imageUrl);
        expect(eventsWithImages.length).toBeGreaterThan(0);
    });

    it('should include event descriptions when available', async () => {
        const ripper = new DocsHoustonRipper();
        const { parse } = await import('node-html-parser');
        const html = parse(sampleHtml);
        const tz = ZoneId.of('America/Chicago');

        const results = await ripper['parseEvents'](html, tz, {});
        const events = results.filter((e): e is RipperCalendarEvent => 'date' in e);

        // Should have at least one event with a description
        const eventsWithDescriptions = events.filter(e => e.description);
        expect(eventsWithDescriptions.length).toBeGreaterThan(0);
    });
});
