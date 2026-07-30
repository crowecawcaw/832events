/**
 * Composite key for deduplicating events across attribution maps and filter sets.
 * Used in App.jsx, EventsMap.jsx, and filter-parity tests.
 *
 * Memoized per event object: the key is rebuilt constantly in hot paths that
 * scan the whole index (isMappable, the map count badge, attribution lookups,
 * matchEvents), and index entries are immutable after load, so the string is
 * computed once per object. A WeakMap keeps garbage collection unaffected when
 * a corpus swap replaces the entries wholesale.
 * See docs/web-tab-switch-performance.md ("cheaper hot paths").
 */
const keyCache = new WeakMap()

export const eventKey = (event) => {
  // WeakMap keys must be objects; primitives (and null) fall through uncached.
  if (event === null || typeof event !== 'object') return `${event?.summary}|${event?.date}`
  let key = keyCache.get(event)
  if (key === undefined) {
    key = `${event.summary}|${event.date}`
    keyCache.set(event, key)
  }
  return key
}
