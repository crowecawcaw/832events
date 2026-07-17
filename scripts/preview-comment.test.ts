import { describe, it, expect } from 'vitest';
// @ts-expect-error — CJS module consumed by actions/github-script via require()
import { buildCommentBody } from './preview-comment.cjs';

const BASE = {
    errorCount: '0',
    previewUrl: 'https://example.github.io/preview/12/',
    headSha: 'abc1234',
    zeroEventCalendarsRaw: '',
    newZeroEventSourcesRaw: '',
    buildErrors: {},
    newSourceSummary: null,
};

describe('buildCommentBody', () => {
    it('renders the clean-build happy path', () => {
        const body = buildCommentBody(BASE);
        expect(body).toContain('## 📅 Calendar Preview');
        expect(body).toContain('**Status:** ✅ No errors');
        expect(body).toContain('[View Calendar Index](https://example.github.io/preview/12/)');
        expect(body).toContain('**Commit:** abc1234');
        expect(body).toContain('✅ All calendars have events');
        expect(body).toContain('✅ No new sources in this PR');
    });

    it('splits parse errors and uncertainty in the status badge', () => {
        const body = buildCommentBody({
            ...BASE,
            errorCount: '5',
            buildErrors: {
                sources: [{ source: 'zoo', calendar: 'main', parseErrorCount: 3 }],
                uncertaintyStats: { outstanding: 2, resolvedFromCache: 0, acknowledgedUnresolvable: 0 },
            },
        });
        expect(body).toContain('❌ 3 parse error(s)');
        expect(body).toContain('❓ 2 uncertain');
        expect(body).toContain('`zoo/main`: 3 parse error(s)');
        expect(body).toContain('**❓ Uncertain events:** 2 outstanding');
    });

    it('lists zero-event calendars and blocking new-source problems', () => {
        const body = buildCommentBody({
            ...BASE,
            zeroEventCalendarsRaw: 'cal-a\ncal-b\n',
            newZeroEventSourcesRaw: 'brand-new-source\n',
            buildErrors: {
                newSourceParseErrors: [{ source: 'fresh', calendar: 'main', errorCount: 4 }],
                urlEntityErrors: [{ source: 'zoo', calendar: 'main', field: 'url', entities: ['&amp;'], value: 'https://x?a=1&amp;b=2' }],
            },
        });
        expect(body).toContain('⚠️ 2 calendar(s) with 0 events');
        expect(body).toContain('- `cal-a`');
        expect(body).toContain('1 new source(s) with 0 events that have never appeared in production');
        expect(body).toContain('`fresh/main`: 4 parse error(s)');
        expect(body).toContain('1 URL field(s) contain HTML entities');
    });

    it('renders coverage stats and new-source samples', () => {
        const body = buildCommentBody({
            ...BASE,
            buildErrors: {
                geoStats: { eventsWithGeo: 90, totalEvents: 100, geocodeErrors: 1 },
                photoStats: { eventsWithImage: 50, totalEvents: 100, venuesWithImage: 5, totalVenues: 10 },
                photoGaps: { venueGaps: ['v1'], eventGaps: [] },
                costStats: { eventsWithCost: 80, totalEvents: 100, freeEvents: 20 },
                costGaps: ['e1', 'e2'],
            },
            newSourceSummary: [{
                source: 'new-venue',
                type: 'External',
                eventCount: 7,
                sampleEvents: [{ summary: 'Show', date: '2026-08-01T19:00:00Z', location: 'Houston' }],
            }],
        });
        expect(body).toContain('**🗺️ Geo coverage:** 90 / 100 events (90%)');
        expect(body).toContain('⚠️ 1 geocode error(s)');
        expect(body).toContain('**🖼️ Photo coverage:**');
        expect(body).toContain('1 missing (run the photo-resolver skill)');
        expect(body).toContain('**💲 Cost coverage:** 80 / 100 events (80%), 20 free');
        expect(body).toContain('## 🆕 New Sources in This PR');
        expect(body).toContain('**new-venue** (External) — 7 events');
    });

    it('is not broken by quotes/backticks in build output (the reason this is not inline YAML)', () => {
        const body = buildCommentBody({
            ...BASE,
            zeroEventCalendarsRaw: "weird `cal` with 'quotes' and \"doubles\"\n${{ github.token }}\n",
        });
        expect(body).toContain("weird `cal` with 'quotes'");
        // Rendered as literal text, never evaluated as an expression
        expect(body).toContain('${{ github.token }}');
    });
});
