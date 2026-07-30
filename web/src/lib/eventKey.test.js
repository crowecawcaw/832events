import { describe, it, expect } from 'vitest'
import { eventKey } from './eventKey.js'

describe('eventKey', () => {
  it('builds a composite summary|date key', () => {
    expect(eventKey({ summary: 'Jazz Night', date: '2026-02-15T19:00:00-06:00' }))
      .toBe('Jazz Night|2026-02-15T19:00:00-06:00')
  })

  it('gives equal keys to distinct objects with the same summary + date', () => {
    const a = { summary: 'Trivia', date: '2026-03-01T18:00:00-06:00', icsUrl: 'a.ics' }
    const b = { summary: 'Trivia', date: '2026-03-01T18:00:00-06:00', icsUrl: 'b.ics' }
    expect(eventKey(a)).toBe(eventKey(b))
  })

  it('returns the identical string instance on repeat calls (memoized per object)', () => {
    const e = { summary: 'Market', date: '2026-04-04T09:00:00-05:00' }
    const first = eventKey(e)
    const second = eventKey(e)
    expect(second).toBe(first)
    // Cheap proxy for "not rebuilt": mutating the fields after the first call
    // does not change the cached key. Index entries are immutable after load,
    // so this can't bite in production — it pins the caching contract.
    e.summary = 'Changed'
    expect(eventKey(e)).toBe(first)
  })

  it('does not throw on non-object input', () => {
    expect(() => eventKey(null)).not.toThrow()
    expect(() => eventKey(undefined)).not.toThrow()
  })
})
