import {
  mockManifest,
  mockEvents,
  mockVenues,
  mockBuildErrors,
  mockIcs,
} from './fixtures.js'

// Register browser-level network stubs for every runtime fetch the app makes,
// so the suite is hermetic (no calendar generation, no live network, no
// favorites API). Mirrors the `mockFetch` switch in web/src/App.test.jsx.
export async function installDataMocks(page) {
  // Start every spec as a returning visitor: pre-set the first-run flag so the
  // FTUX welcome modal (a deliberate first-visit-only overlay) doesn't appear
  // and intercept clicks. addInitScript runs before the app's scripts on each
  // navigation. These flows exercise the main UI, not onboarding.
  await page.addInitScript(() => {
    try { localStorage.setItem('calendar-ripper-ftux-seen', '1') } catch { /* ignore */ }
  })

  const json = (body) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })

  await page.route('**/manifest.json', (route) => route.fulfill(json(mockManifest)))
  await page.route('**/events-index.json', (route) => route.fulfill(json(mockEvents)))
  await page.route('**/venues.json', (route) => route.fulfill(json(mockVenues)))
  await page.route('**/build-errors.json', (route) => route.fulfill(json(mockBuildErrors)))
  await page.route('**/tags.json', (route) => route.fulfill(json([])))

  await page.route('**/*.ics', (route) =>
    route.fulfill({ status: 200, contentType: 'text/calendar', body: mockIcs }))
}
