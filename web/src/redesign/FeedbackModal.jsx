// FeedbackModal — a small dialog for sending feedback, reporting a problem with
// a source, or suggesting a new source. Driven by the app context: opened via
// app.openFeedback(prefill) and closed via app.closeFeedback(). There is no
// backend; submitting opens the GitHub "new issue" page.

import { useState, useEffect } from 'react'
import { useApp832 } from './context.js'
import { Ico } from './icons.jsx'
import cityConfig from '../../../city.config.ts'

const TYPE_OPTIONS = [
  { id: 'general', label: 'General feedback' },
  { id: 'bug', label: 'Report a problem' },
  { id: 'source', label: 'Suggest a source' },
]

const PLACEHOLDERS = {
  general: 'What do you love, what’s missing, what would you change?',
  bug: 'What’s wrong? Which calendar or event, what you expected vs. what you saw, and a link if you have one.',
  source: `Which ${cityConfig.city.name}-area event source should we add? Paste the website URL and what kind of events it lists.`,
}

const GITHUB_NEW_ISSUE = `https://github.com/${cityConfig.site.repo}/issues/new`

export function FeedbackModal() {
  const app = useApp832()
  const prefill = app.feedbackPrefill
  const open = !!prefill

  const [type, setType] = useState('general')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // honeypot — humans leave this blank
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Each open resets the form to the (possibly new) prefill.
  useEffect(() => {
    if (!prefill) return
    setType(prefill.type || 'general')
    setMessage('')
    setEmail('')
    setWebsite('')
    setError('')
    setSubmitting(false)
  }, [prefill])

  // Esc to close + lock body scroll while open (mirrors Lightbox).
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') app.closeFeedback() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, app])

  if (!open) return null

  // Only surface known string-typed context fields in the dialog (e.g. the
  // "About <source>" line).
  const rawContext = prefill.context || {}
  const context = {}
  for (const key of ['sourceName', 'icsUrl', 'pageUrl']) {
    if (typeof rawContext[key] === 'string' && rawContext[key]) context[key] = rawContext[key]
  }

  const submit = () => {
    const msg = message.trim()
    if (!msg) { setError('Please enter a message.'); return }

    // No backend: hand off to GitHub's new-issue page. The noopener,noreferrer
    // features prevent the opened tab from reaching back through window.opener.
    window.open(GITHUB_NEW_ISSUE, '_blank', 'noopener,noreferrer')
    app.closeFeedback()
  }

  return (
    <div className="a-modal-backdrop" role="dialog" aria-modal="true" aria-label="Send feedback"
      onClick={app.closeFeedback}>
      <div className="a-modal" onClick={(e) => e.stopPropagation()}>
        <div className="a-modal-head">
          <div className="a-h1" style={{ fontSize: 20 }}>Send feedback</div>
          <button className="a-iconbtn" onClick={app.closeFeedback} aria-label="Close">{Ico.close}</button>
        </div>

        {/* type selector */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {TYPE_OPTIONS.map((opt) => (
            <button key={opt.id}
              className={`btn ${type === opt.id ? 'btn-blue' : 'btn-ghost'}`}
              style={{ height: 36, fontSize: 13 }}
              aria-pressed={type === opt.id}
              onClick={() => setType(opt.id)}>
              {opt.label}
            </button>
          ))}
        </div>

        {context.sourceName && (
          <div className="a-modal-context">
            About <strong>{context.sourceName}</strong>
          </div>
        )}

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          autoFocus
          rows={5}
          maxLength={5000}
          placeholder={PLACEHOLDERS[type]}
          className="a-input a-modal-textarea" />

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional — only if you’d like a reply)"
          className="a-input"
          style={{ width: '100%', marginTop: 10 }} />

        {/* Honeypot: off-screen, not tabbable, hidden from AT. Bots fill it. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="a-hp" />

        {error && <div className="a-modal-error">{error}</div>}

        <div className="a-modal-actions">
          <button className="btn btn-ghost" onClick={app.closeFeedback} disabled={submitting}>Cancel</button>
          <button className="btn btn-blue" onClick={submit} disabled={submitting}>
            {submitting ? 'Sending…' : 'Send'}
          </button>
        </div>

        <p className="a-modal-note">
          Feedback is filed as a <strong>public</strong> GitHub issue, including any email you enter —
          please don’t include anything private.
        </p>
      </div>
    </div>
  )
}
