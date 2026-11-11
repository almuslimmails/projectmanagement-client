'use client'

// JWT sign-in against tracker-api (POST /auth/login). On success the token
// lands in localStorage (+ a presence cookie for middleware gating) and the
// member id becomes the acting identity. NextAuth is no longer involved.
//
// When the company has email verification on, the password step returns a
// challenge instead of a token: a 6-digit code was emailed to the member's
// company address, and the second step (POST /auth/login/verify) finishes.
import { useEffect, useRef, useState } from 'react'
import { api, AuthError } from '@/lib/api'
import SetupWizard from './SetupWizard'

interface Props { next?: string }

interface Challenge { token: string; emailHint: string }

export default function SignInForm({ next = '/' }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [resendIn, setResendIn] = useState(0)
  // null = still checking; a fresh install shows the setup wizard instead.
  const [setup, setSetup] = useState<{ needsSetup: boolean; workspace_name: string | null } | null>(null)

  useEffect(() => {
    api.getSetupStatus()
      .then(setSetup)
      .catch(() => setSetup({ needsSetup: false, workspace_name: null }))
  }, [])

  // Resend countdown.
  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  function finish() {
    // Full navigation (not router.push) so middleware sees the fresh cookie.
    window.location.href = next || '/'
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) { setError('Email and password are required'); return }
    setPending(true); setError(null)
    try {
      const result = await api.login(email.trim().toLowerCase(), password)
      if (result.mfaRequired) {
        setChallenge({ token: result.challengeToken, emailHint: result.emailHint })
        setResendIn(result.resendAfter ?? 60)
        setPending(false)
        return
      }
      finish()
    } catch (err) {
      const status = err instanceof AuthError ? err.status : 0
      setError(status === 401 ? 'Invalid email or password' : (err as Error).message || 'Sign-in failed')
      setPending(false)
    }
  }

  function restart(message?: string) {
    setChallenge(null)
    setPassword('')
    setResendIn(0)
    setError(message ?? null)
  }

  if (setup === null) {
    return <p className="text-sm text-gray-400 text-center py-6">Checking server…</p>
  }
  if (setup.needsSetup) {
    return <SetupWizard initialWorkspaceName={setup.workspace_name} />
  }

  if (challenge) {
    return (
      <CodeStep challenge={challenge} resendIn={resendIn} setResendIn={setResendIn}
        onDone={finish} onRestart={restart} />
    )
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-3">
        <Field name="email" type="email" placeholder="you@example.com" label="Email" autoComplete="email" autoFocus
          value={email} onChange={setEmail} />
        <Field name="password" type="password" placeholder="••••••••" label="Password" autoComplete="current-password"
          value={password} onChange={setPassword} />
        {error && <FormError message={error} />}
        <button type="submit" disabled={pending}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-sm shadow-indigo-600/20">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-[11px] text-gray-500 text-center leading-relaxed mt-5">
        Don&apos;t have an account? Ask a workspace owner to create one for you under
        <span className="font-semibold"> Workspace settings</span>.
      </p>
    </>
  )
}

// ─── Step 2: the emailed code ────────────────────────────────────────────────

function CodeStep({ challenge, resendIn, setResendIn, onDone, onRestart }: {
  challenge: Challenge
  resendIn: number
  setResendIn: (n: number) => void
  onDone: () => void
  onRestart: (message?: string) => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function verify(e?: React.FormEvent, entered?: string) {
    e?.preventDefault()
    if (pending) return
    const typed = (entered ?? code).replace(/\D/g, '')
    if (typed.length !== 6) { setError('Enter the 6-digit code from the email.'); return }
    setPending(true); setError(null); setInfo(null)
    try {
      await api.verifyLoginCode(challenge.token, typed)
      onDone()
    } catch (err) {
      if (err instanceof AuthError && err.restart) { onRestart(err.message); return }
      setError((err as Error).message || 'Verification failed')
      setCode('')
      setPending(false)
      inputRef.current?.focus()
    }
  }

  async function resend() {
    setError(null); setInfo(null)
    try {
      const r = await api.resendLoginCode(challenge.token)
      setResendIn(r.resend_after ?? 60)
      setCode('')
      setInfo(`A new code is on its way to ${challenge.emailHint}. The previous code no longer works.`)
      inputRef.current?.focus()
    } catch (err) {
      if (err instanceof AuthError && err.restart) { onRestart(err.message); return }
      if (err instanceof AuthError && err.retryAfter) setResendIn(err.retryAfter)
      setError((err as Error).message || 'Could not send a new code')
    }
  }

  // Submit automatically once six digits are in (typed or pasted).
  function onChange(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    if (digits.length === 6) void verify(undefined, digits)
  }

  return (
    <form onSubmit={verify} className="space-y-3">
      <div className="text-center">
        <div className="mx-auto mb-2 w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-gray-800">Check your email</p>
        <p className="text-xs text-gray-500 mt-1">
          We sent a 6-digit code to <span className="font-medium text-gray-700">{challenge.emailHint}</span>.
          It expires in 10 minutes.
        </p>
      </div>

      <label className="block">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest block mb-1">Verification code</span>
        <input ref={inputRef} name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456"
          value={code} onChange={e => onChange(e.target.value)} maxLength={7} disabled={pending}
          className="w-full text-center text-2xl tracking-[0.5em] font-semibold border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 disabled:bg-gray-50" />
      </label>

      {error && <FormError message={error} />}
      {info && !error && (
        <div className="text-xs text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-md px-3 py-2">{info}</div>
      )}

      <button type="submit" disabled={pending}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-sm shadow-indigo-600/20">
        {pending ? 'Verifying…' : 'Verify and sign in'}
      </button>

      <div className="flex items-center justify-between text-xs pt-1">
        <button type="button" onClick={() => onRestart()} className="text-gray-500 hover:text-gray-800">
          ← Use a different account
        </button>
        <button type="button" onClick={resend} disabled={resendIn > 0}
          className="text-indigo-600 hover:text-indigo-800 disabled:text-gray-400 disabled:cursor-not-allowed">
          {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
        </button>
      </div>
      <p className="text-[11px] text-gray-400 text-center leading-relaxed">
        Can&apos;t find it? Check spam, or ask a workspace owner to confirm your company email.
      </p>
    </form>
  )
}

function Field({ name, type, placeholder, label, autoComplete, autoFocus, value, onChange }: {
  name: string; type: string; placeholder: string; label: string
  autoComplete?: string; autoFocus?: boolean
  value: string; onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest block mb-1">{label}</span>
      <input name={name} type={type} placeholder={placeholder} autoComplete={autoComplete} autoFocus={autoFocus} required
        value={value} onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" />
    </label>
  )
}

function FormError({ message }: { message: string }) {
  return (
    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
      {message}
    </div>
  )
}
