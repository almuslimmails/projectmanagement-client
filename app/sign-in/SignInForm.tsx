'use client'

// JWT sign-in against tracker-api (POST /auth/login). On success the token
// lands in localStorage (+ a presence cookie for middleware gating) and the
// member id becomes the acting identity. NextAuth is no longer involved.
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import SetupWizard from './SetupWizard'

interface Props { next?: string }

export default function SignInForm({ next = '/' }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // null = still checking; a fresh install shows the setup wizard instead.
  const [setup, setSetup] = useState<{ needsSetup: boolean; workspace_name: string | null } | null>(null)

  useEffect(() => {
    api.getSetupStatus()
      .then(setSetup)
      .catch(() => setSetup({ needsSetup: false, workspace_name: null }))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) { setError('Email and password are required'); return }
    setPending(true); setError(null)
    try {
      await api.login(email.trim().toLowerCase(), password)
      // Full navigation (not router.push) so middleware sees the fresh cookie.
      window.location.href = next || '/'
    } catch {
      setError('Invalid email or password')
      setPending(false)
    }
  }

  if (setup === null) {
    return <p className="text-sm text-gray-400 text-center py-6">Checking server…</p>
  }
  if (setup.needsSetup) {
    return <SetupWizard initialWorkspaceName={setup.workspace_name} />
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
