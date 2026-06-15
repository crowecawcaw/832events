import { describe, expect, test } from 'vitest';
import { RipperLoader, loadRipper } from './loader.js';
import { EventbriteRipper } from './eventbrite.js';
import { TicketmasterRipper } from './ticketmaster.js';

import { readdirSync } from 'fs';

// These tests load the real sources/ tree, which `npm run init-city`
// empties for template copies — self-skip when there are no rippers.
const SOURCE_DIR_COUNT = readdirSync('sources', { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'external' && d.name !== 'recurring').length;

describe.skipIf(SOURCE_DIR_COUNT === 0)('Config Load', () => {
    test('All configs load without errors', async () => {
            const loader = new RipperLoader("sources/");
            const [configs, errors] = await loader.loadConfigs();

            // All source directories should have valid ripper.yaml files
            expect(errors).toEqual([]);

            // Sanity check: verify a known config loads correctly
            const camh = configs.filter(c => c.config.name == "camh")[0];
            expect(camh.config.url.toString()).toEqual("https://camh.org/")
    });

    test('loads eventbrite and ticketmaster sources via type field without ripper.ts', async () => {
            const loader = new RipperLoader("sources/");
            const [configs, _errors] = await loader.loadConfigs();

            const camh = configs.find(c => c.config.name === "camh");
            expect(camh).toBeDefined();
            expect(camh!.config.type).toBe("eventbrite");
            expect(camh!.ripperImpl).toBeInstanceOf(EventbriteRipper);

            const whiteOak = configs.find(c => c.config.name === "white-oak-music-hall");
            expect(whiteOak).toBeDefined();
            expect(whiteOak!.config.type).toBe("ticketmaster");
            expect(whiteOak!.ripperImpl).toBeInstanceOf(TicketmasterRipper);
    });
});
