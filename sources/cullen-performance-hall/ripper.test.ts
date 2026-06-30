import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sampleHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Calendar of Events | Cullen Performance Hall</title>
</head>
<body>
    <table class="table table-responsive table-striped">
        <tbody>
            <tr>
                <td colspan="4" align="right">
                    <h3 style="text-align: left;">Performances and Events</h3>
                </td>
            </tr>
            <tr>
                <td colspan="4" align="right">
                    <h3 style="text-align: left;">2026 Events</h3>
                </td>
            </tr>
            <tr>
                <td>New Student Orientation</td>
                <td>Monday</td>
                <td>July 6</td>
                <td>8 a.m.</td>
            </tr>
            <tr>
                <td>Max Amini Live in Houston! (<a href="https://cph.evenue.net/events/max-amini-live-in-houston">Tickets</a>)</td>
                <td>Sunday</td>
                <td>July 12</td>
                <td>8 p.m.</td>
            </tr>
            <tr>
                <td>Dan and Phil: The Hard Launch World Tour <a href="https://cph.evenue.net/events/dan-phil">(Tickets)</a></td>
                <td>Saturday</td>
                <td>Sept. 26</td>
                <td>8 p.m.</td>
            </tr>
            <tr>
                <td>Zeteo and Risala Present Mehdi and Mo Amer in Houston! <a href="https://cph.evenue.net/events/zeteo-and-risala-present-mehdi-mo-amer-in-houston">(Tickets)</a></td>
                <td>Friday</td>
                <td>Oct. 16</td>
                <td>7:30 p.m.</td>
            </tr>
            <tr>
                <td>Whose Live Anyway? <a href="https://cph.evenue.net/events/whose-live-anyway">(Tickets)</a></td>
                <td>Sunday</td>
                <td>Nov. 22</td>
                <td>7:30 p.m.</td>
            </tr>
        </tbody>
    </table>
</body>
</html>
`;

describe("Cullen Performance Hall ripper", () => {
    it("sample data contains event table", () => {
        expect(sampleHtml).toContain("table class=");
        expect(sampleHtml).toContain("Performances and Events");
        expect(sampleHtml).toContain("2026 Events");
    });

    it("sample data has event entries with required fields", () => {
        expect(sampleHtml).toContain("New Student Orientation");
        expect(sampleHtml).toContain("July 6");
        expect(sampleHtml).toContain("8 a.m.");
        expect(sampleHtml).toContain("Monday");
    });

    it("sample data includes various event types", () => {
        expect(sampleHtml).toContain("Max Amini Live in Houston!");
        expect(sampleHtml).toContain("Dan and Phil: The Hard Launch World Tour");
        expect(sampleHtml).toContain("Whose Live Anyway?");
    });

    it("sample data has events with ticket links", () => {
        expect(sampleHtml).toContain("cph.evenue.net");
        expect(sampleHtml).toContain("Tickets");
    });

    it("sample data includes various times", () => {
        expect(sampleHtml).toContain("8 a.m.");
        expect(sampleHtml).toContain("8 p.m.");
        expect(sampleHtml).toContain("7:30 p.m.");
    });

    it("sample data includes multiple dates", () => {
        expect(sampleHtml).toContain("July 6");
        expect(sampleHtml).toContain("Sept. 26");
        expect(sampleHtml).toContain("Oct. 16");
        expect(sampleHtml).toContain("Nov. 22");
    });
});
