import { describe, expect, test } from 'vitest';
import { RipperLoader, loadRipper } from './loader.js';
import { AXSRipper } from './axs.js';

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
            const improv = configs.filter(c => c.config.name == "houston-improv")[0];
            expect(improv.config.url.toString()).toEqual("https://improvtx.com/houston/")
    });

    test('loads axs sources via type field without ripper.ts', async () => {
            const loader = new RipperLoader("sources/");
            const [configs, _errors] = await loader.loadConfigs();

            const improv = configs.find(c => c.config.name === "houston-improv");
            expect(improv).toBeDefined();
            expect(improv!.config.type).toBe("axs");
            expect(improv!.ripperImpl).toBeInstanceOf(AXSRipper);
    });
});
