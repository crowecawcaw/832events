import { describe, it, expect, vi, afterEach } from 'vitest';
import { AXSRipper } from './axs.js';
import * as proxyFetch from './proxy-fetch.js';

// Minimal AXS venue page: a __NEXT_DATA__ blob with one event.
function axsPage(events: any[], totalEvents = events.length): string {
    const data = { props: { pageProps: { venueEventsData: { eventItems: events, totalEvents } } } };
    return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></body></html>`;
}

function makeRipper(proxy: boolean) {
    return {
        config: {
            name: 'test-axs',
            proxy,
            url: new URL('https://www.axs.com/'),
            calendars: [{
                name: 'test-cal',
                friendlyname: 'Test Cal',
                timezone: 'America/Chicago' as any,
                tags: [],
                config: {
                    venueId: 12345,
                    venueSlug: 'test-venue-houston-tickets',
                    venueName: 'Test Venue',
                    venueAddress: '123 Main St, Houston, TX',
                },
            }],
        },
    } as any;
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('AXSRipper proxy routing', () => {
    it('uses the proxy-aware fetch (not curl) when proxy: true', async () => {
        const mockFetch = vi.fn(async () =>
            new Response(axsPage([]), { status: 200, headers: { 'Content-Type': 'text/html' } })
        );
        const spy = vi.spyOn(proxyFetch, 'getFetchForConfig').mockReturnValue(mockFetch as any);

        const result = await new AXSRipper().rip(makeRipper(true));

        expect(spy).toHaveBeenCalled();
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(String(mockFetch.mock.calls[0][0])).toContain('/venues/12345/test-venue-houston-tickets');
        // Empty page parses cleanly: no events, no errors.
        expect(result).toHaveLength(1);
        expect(result[0].events).toHaveLength(0);
        expect(result[0].errors).toHaveLength(0);
    });

    it('surfaces a non-200 proxy response as a ParseError naming the status', async () => {
        const mockFetch = vi.fn(async () => new Response('blocked', { status: 403 }));
        vi.spyOn(proxyFetch, 'getFetchForConfig').mockReturnValue(mockFetch as any);

        const result = await new AXSRipper().rip(makeRipper(true));

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(result[0].errors).toHaveLength(1);
        expect(result[0].errors[0].reason).toContain('HTTP 403');
    });

    it('does not touch the proxy fetch when proxy is unset (curl path)', async () => {
        const mockFetch = vi.fn();
        vi.spyOn(proxyFetch, 'getFetchForConfig').mockReturnValue(mockFetch as any);
        // Stub the private curl helper so the test never shells out.
        const curlSpy = vi
            .spyOn(AXSRipper.prototype as any, 'fetchPageViaCurl')
            .mockResolvedValue(axsPage([]));

        const result = await new AXSRipper().rip(makeRipper(false));

        expect(curlSpy).toHaveBeenCalledTimes(1);
        expect(mockFetch).not.toHaveBeenCalled();
        expect(result[0].errors).toHaveLength(0);
    });
});
