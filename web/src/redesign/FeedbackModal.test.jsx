import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { App832Context } from './context.js'
import { FeedbackModal } from './FeedbackModal.jsx'
import cityConfig from '../../../city.config.ts'

// Minimal app model the modal reads from context. Tests override fields per case.
function makeApp(overrides = {}) {
  return {
    feedbackPrefill: { type: 'general' },
    openFeedback: vi.fn(),
    closeFeedback: vi.fn(),
    flash: vi.fn(),
    ...overrides,
  }
}

function renderModal(app) {
  return render(
    <App832Context.Provider value={app}>
      <FeedbackModal />
    </App832Context.Provider>
  )
}

describe('FeedbackModal', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('renders nothing when no prefill is set', () => {
    const app = makeApp({ feedbackPrefill: null })
    const { container } = renderModal(app)
    expect(container.firstChild).toBeNull()
  })

  it('renders a hidden, non-tabbable honeypot field', () => {
    const app = makeApp()
    const { container } = renderModal(app)
    const hp = container.querySelector('input.a-hp')
    expect(hp).toBeTruthy()
    expect(hp.getAttribute('tabindex')).toBe('-1')
    expect(hp.getAttribute('aria-hidden')).toBe('true')
  })

  it('preselects the type from the prefill (source)', () => {
    const app = makeApp({ feedbackPrefill: { type: 'source' } })
    renderModal(app)
    expect(screen.getByRole('button', { name: 'Suggest a source' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the source context when launched from a channel', () => {
    const app = makeApp({ feedbackPrefill: { type: 'bug', context: { sourceName: 'Stoup Brewing' } } })
    renderModal(app)
    expect(screen.getByText('Stoup Brewing')).toBeInTheDocument()
  })

  it('does not submit an empty message', () => {
    const openFn = vi.fn()
    vi.stubGlobal('open', openFn)
    const app = makeApp()
    renderModal(app)
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(openFn).not.toHaveBeenCalled()
    expect(screen.getByText(/Please enter a message/i)).toBeInTheDocument()
  })

  it('opens the GitHub new-issue page on submit (no backend)', () => {
    const openFn = vi.fn()
    vi.stubGlobal('open', openFn)
    const app = makeApp()
    renderModal(app)
    fireEvent.change(screen.getByPlaceholderText(/love/i), { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(openFn).toHaveBeenCalledWith(expect.stringContaining(`github.com/${cityConfig.site.repo}/issues/new`), '_blank', 'noopener,noreferrer')
    expect(app.closeFeedback).toHaveBeenCalled()
  })
})
