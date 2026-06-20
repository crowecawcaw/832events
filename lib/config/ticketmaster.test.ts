import { describe, it, expect } from 'vitest';
import { ZoneId } from '@js-joda/core';
import '@js-joda/timezone';
import { Duration } from '@js-joda/core';
import { TicketmasterRipper } from './ticketmaster.js';
import { RipperCalendarEvent, UncertaintyError } from './schema.js';

const tz = ZoneId.of('America/Los_Angeles');

function makeEvent(overrides: any = {}): any {
    return {
        id: `tm-syn-${Math.abs(JSON.stringify(overrides).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0))}`,
        name: 'Test Show',
        dates: { start: { localDate: '2026-03-10', localTime: '19:00:00' } },
        ...overrides,
    };
}

function parseOne(event: any): RipperCalendarEvent {
    const ripper = new TicketmasterRipper();
    const results = ripper.parseEvents([event], tz, { venueName: 'Test Venue' });
    const [e] = results.filter(r => 'summary' in r) as RipperCalendarEvent[];
    return e;
}

function parseRaw(event: any) {
    const ripper = new TicketmasterRipper();
    return ripper.parseEvents([event], tz, { venueName: 'Test Venue' }, 'test-source', 'test-cal');
}

describe('TicketmasterRipper cost extraction', () => {
    it('maps priceRanges min/max to a cost range', () => {
        const e = parseOne(makeEvent({ priceRanges: [{ type: 'standard', currency: 'USD', min: 25, max: 75 }] }));
        expect(e.cost).toEqual({ min: 25, max: 75 });
    });

    it('omits max when min and max are equal', () => {
        const e = parseOne(makeEvent({ priceRanges: [{ type: 'standard', currency: 'USD', min: 40, max: 40 }] }));
        expect(e.cost).toEqual({ min: 40 });
    });

    it('treats a $0 min with a real max as paid-unknown (hidden platinum/resale junk)', () => {
        const e = parseOne(makeEvent({ priceRanges: [{ type: 'standard', currency: 'USD', min: 0, max: 199 }] }));
        expect(e.cost).toEqual({ paid: true });
    });

    it('handles a min-only price range', () => {
        const e = parseOne(makeEvent({ priceRanges: [{ type: 'standard', currency: 'USD', min: 30 }] }));
        expect(e.cost).toEqual({ min: 30 });
    });

    it('leaves cost unset when priceRanges is absent', () => {
        const e = parseOne(makeEvent());
        expect(e.cost).toBeUndefined();
    });

    it('still writes the price into the description alongside cost', () => {
        const e = parseOne(makeEvent({ priceRanges: [{ type: 'standard', currency: 'USD', min: 25, max: 75 }] }));
        expect(e.description).toContain('Price: $25 - $75');
    });
});

describe('TicketmasterRipper duration / start-time uncertainty', () => {
    it('emits a 2-hour default duration with NO uncertainty when start time is known (localDate + localTime)', () => {
        const results = parseRaw(makeEvent());
        const events = results.filter(r => 'summary' in r) as RipperCalendarEvent[];
        const uncertainties = results.filter(r => 'type' in r && (r as any).type === 'Uncertainty');

        expect(events).toHaveLength(1);
        expect(events[0].duration.equals(Duration.ofHours(2))).toBe(true);
        expect(uncertainties).toHaveLength(0);
    });

    it('emits a 2-hour default duration with NO uncertainty when start time is known (dateTime)', () => {
        const results = parseRaw(makeEvent({ dates: { start: { dateTime: '2026-03-10T03:00:00Z' } } }));
        const events = results.filter(r => 'summary' in r) as RipperCalendarEvent[];
        const uncertainties = results.filter(r => 'type' in r && (r as any).type === 'Uncertainty');

        expect(events).toHaveLength(1);
        expect(events[0].duration.equals(Duration.ofHours(2))).toBe(true);
        expect(uncertainties).toHaveLength(0);
    });

    it('emits exactly one startTime-only uncertainty for a date-only listing (19:30 placeholder)', () => {
        const results = parseRaw(makeEvent({ dates: { start: { localDate: '2026-03-10' } } }));
        const events = results.filter(r => 'summary' in r) as RipperCalendarEvent[];
        const uncertainties = results.filter(r => 'type' in r && (r as any).type === 'Uncertainty') as UncertaintyError[];

        expect(events).toHaveLength(1);
        // 19:30 placeholder applied, with the default 2-hour duration.
        expect(events[0].duration.equals(Duration.ofHours(2))).toBe(true);
        expect(uncertainties).toHaveLength(1);
        expect(uncertainties[0].unknownFields).toEqual(['startTime']);
        expect(uncertainties[0].unknownFields).not.toContain('duration');
    });
});
