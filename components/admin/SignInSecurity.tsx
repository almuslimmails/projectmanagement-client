'use client'

// Company settings → Sign-in security. The owner's switch for email
// verification at sign-in (two-factor): after the password, every member gets
// a 6-digit code at their company email address.
//
// Turning it on is two steps — a code is first emailed to the owner's own
// inbox — so it can't be switched on for a server that can't deliver mail or
// a domain the owner isn't on. Turning it off is immediate.
import { useMemo, useState } from 'react'
import type { Company, Member } from '@/lib/types'
import { api, errorMessage } from '@/lib/api'

interface Props {
  company: Company
  members: Member[]
  currentMember: Member | null
  isOwner: boolean
  onChanged: (c: Company) => void
}

function domainOf(email?: string | null): string {
  const at = String(email ?? '').lastIndexOf('@')
  return at > 0 ? String(email).slice(at + 1).toLowerCase() : ''
}

export default function SignInSecurity({ company, members, currentMember, isOwner, onChanged }: Props) {
  const tf = company.two_factor ?? { enabled: false, email_domain: '', mail_configured: false, disabled_by_server: false }
  const [domain, setDomain] = useState(tf.email_domain || domainOf(currentMember?.email))
  const [challenge, setChallenge] = useState<{ token: string; emailHint: string; domain: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cleanDomain = domain.trim().toLowerCase().replace(/^@/, '')
  const checkDomain = tf.enabled ? tf.email_domain : cleanDomain
  // People (not agents) whose address could never receive a code.
  const offDomain = useMemo(() => checkDomain
    ? members.filter(m => !m.is_agent && !String(m.email ?? '').toLowerCase().endsWith(`@${checkDomain}`))
    : [], [members, checkDomain])
  const agents = members.filter(m => m.is_agent)

  async function act(fn: () => Promise<void>) {
    setBusy(true); setError(null)
    try { await fn() } catch (e) { setError(errorMessage(e, 'Action failed')) } finally { setBusy(false) }
  }

  function sendCode() {
    act(async () => {
      const r = await api.startCompanyTwoFactor(cleanDomain)
      setChallenge({ token: r.challenge_token, emailHint: r.email_hint, domain: r.email_domain })
      setCode('')
    })
  }

  function confirm() {
    if (!challenge) return
    act(async () => {
      try {
        const fresh = await api.confirmCompanyTwoFactor(challenge.token, code.replace(/\D/g, '')) as Company
        setChallenge(null); setCode('')
        onChanged(fresh)
      } catch (e) {
        if (/expired|send a new code/i.test(errorMessage(e))) setChallenge(null)
        throw e
      }
    })
  }

  function turnOff() {
    if (!window.confirm('Turn off email verification? Members will sign in with their password alone.')) return
    act(async () => {
      const fresh = await api.disableCompanyTwoFactor() as Company
      onChanged(fresh)
    })
  }

  const statusPill = tf.enabled
    ? <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">On</span>
    : <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">Off</span>

  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold block mb-2">Sign-in security</label>
      <div className="border border-gray-200 rounded-xl px-4 py-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-800">Email verification code at sign-in</p>
            <p className="text-xs text-gray-500 mt-0.5">
              After the password, members get a 6-digit code at their company email
              {tf.enabled && tf.email_domain ? <> (<b>@{tf.email_domain}</b>)</> : null} and must type it in.
              {agents.length > 0 && <> {agents.map(a => a.name).join(', ')} signs in without a code (no mailbox).</>}
            </p>
          </div>
          {statusPill}
        </div>

        {tf.disabled_by_server && (
          <Notice tone="amber">
            Switched off on the server (<code>TWO_FACTOR_DISABLED=1</code>). Members sign in with the password alone
            until that setting is removed.
          </Notice>
        )}
        {!tf.mail_configured && (
          <Notice tone="amber">
            This server can&apos;t send email yet. Add the SMTP settings to the backend <code>.env.local</code> and
            restart it before turning this on.
          </Notice>
        )}

        {tf.enabled ? (
          <>
            <p className="text-xs text-gray-600">
              Applies from each member&apos;s next sign-in. Current sessions last up to 24 hours.
            </p>
            {offDomain.length > 0 && (
              <Notice tone="red">
                Can&apos;t sign in until their email is changed to @{tf.email_domain}:{' '}
                {offDomain.map(m => `${m.name} (${m.email || 'no email'})`).join(', ')}
              </Notice>
            )}
            {isOwner && (
              <button onClick={turnOff} disabled={busy}
                className="text-xs font-medium text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-40 px-3 py-1.5 rounded-lg">
                Turn off
              </button>
            )}
          </>
        ) : isOwner ? (
          <div className="space-y-2">
            {!challenge ? (
              <>
                <label className="text-xs text-gray-600 block">Company email domain</label>
                <div className="flex gap-2">
                  <div className="flex flex-1 items-center border rounded-lg px-3 focus-within:ring-2 focus-within:ring-indigo-200">
                    <span className="text-sm text-gray-400">@</span>
                    <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="tathkarah.in"
                      disabled={busy} className="flex-1 text-sm py-2 pl-1 focus:outline-none bg-transparent" />
                  </div>
                  <button onClick={sendCode} disabled={busy || !cleanDomain || !tf.mail_configured}
                    className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-4 rounded-lg whitespace-nowrap">
                    {busy ? 'Sending…' : 'Send code to my email'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400">
                  To check email delivery works, a confirmation code goes to your own address first.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-600">
                  Code sent to <b>{challenge.emailHint}</b>. Enter it to turn verification on for <b>@{challenge.domain}</b>.
                </p>
                <div className="flex gap-2">
                  <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric" autoComplete="one-time-code" placeholder="123456" disabled={busy} autoFocus
                    onKeyDown={e => e.key === 'Enter' && code.length === 6 && confirm()}
                    className="w-36 text-center text-lg tracking-[0.3em] font-semibold border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                  <button onClick={confirm} disabled={busy || code.length !== 6}
                    className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-4 rounded-lg">
                    {busy ? 'Checking…' : 'Turn on'}
                  </button>
                  <button onClick={() => { setChallenge(null); setCode(''); setError(null) }} disabled={busy}
                    className="text-xs text-gray-500 hover:text-gray-800 px-2">Cancel</button>
                </div>
              </>
            )}
            {offDomain.length > 0 && cleanDomain && (
              <Notice tone="amber">
                Not on @{checkDomain}, so they could not sign in once this is on — change their email in the
                Members tab first: {offDomain.map(m => `${m.name} (${m.email || 'no email'})`).join(', ')}
              </Notice>
            )}
          </div>
        ) : null}

        {error && <Notice tone="red">{error}</Notice>}
      </div>
    </div>
  )
}

function Notice({ tone, children }: { tone: 'amber' | 'red'; children: React.ReactNode }) {
  const cls = tone === 'red'
    ? 'text-red-700 bg-red-50 border-red-200'
    : 'text-amber-800 bg-amber-50 border-amber-200'
  return <div className={`text-xs border rounded-md px-3 py-2 ${cls}`}>{children}</div>
}
