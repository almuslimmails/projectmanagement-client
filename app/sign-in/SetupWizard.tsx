'use client'

// First-run setup wizard — shown instead of the sign-in form while the server
// reports an empty members table (GET /setup/status). Three steps: workspace →
// owner account → data. POST /setup creates everything and signs the owner in.
import { useState } from 'react'
import { api } from '@/lib/api'

export default function SetupWizard({ initialWorkspaceName }: { initialWorkspaceName?: string | null }) {
  const [step, setStep] = useState(0)
  const [workspaceName, setWorkspaceName] = useState(initialWorkspaceName ?? 'My Workspace')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loadDemo, setLoadDemo] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const steps = ['Workspace', 'Owner account', 'Data']

  function nextFromOwner() {
    if (!name.trim() || !email.trim()) { setError('Name and email are required'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError(null); setStep(2)
  }

  async function finish() {
    setPending(true); setError(null)
    try {
      await api.runSetup({
        workspace_name: workspaceName.trim() || undefined,
        name: name.trim(), email: email.trim().toLowerCase(), password,
        load_demo: loadDemo,
      })
      window.location.href = '/'
    } catch (e: any) {
      setError(e?.message ?? 'Setup failed')
      setPending(false)
    }
  }

  return (
    <div>
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-5">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center
              ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {i < step ? '✓' : i + 1}
            </span>
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${i === step ? 'text-indigo-700' : 'text-gray-400'}`}>{s}</span>
            {i < steps.length - 1 && <span className="w-5 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-600">Fresh install — let&apos;s set up your tracker. First, name the workspace.</p>
          <Field label="Workspace name" type="text" placeholder="My Workspace" autoFocus
            value={workspaceName} onChange={setWorkspaceName} />
          <button onClick={() => setStep(1)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-sm shadow-indigo-600/20">
            Continue
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-600">Create the first <b>owner</b> account — it controls members, roles and settings.</p>
          <Field label="Your name" type="text" placeholder="Full name" autoFocus value={name} onChange={setName} />
          <Field label="Email" type="email" placeholder="you@example.com" value={email} onChange={setEmail} />
          <Field label="Password" type="password" placeholder="At least 8 characters" value={password} onChange={setPassword} />
          <Field label="Confirm password" type="password" placeholder="Repeat the password" value={confirm} onChange={setConfirm} />
          {error && <ErrorBox message={error} />}
          <div className="flex gap-2">
            <button onClick={() => { setError(null); setStep(0) }}
              className="flex-1 text-gray-600 hover:bg-gray-100 border border-gray-200 font-semibold py-2.5 rounded-lg transition-colors">Back</button>
            <button onClick={nextFromOwner}
              className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-sm shadow-indigo-600/20">
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-600">Almost done. Start empty, or load the demo dataset to explore the tool.</p>
          <label className="flex items-start gap-2.5 border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-indigo-300 transition-colors">
            <input type="checkbox" checked={loadDemo} onChange={e => setLoadDemo(e.target.checked)} className="mt-0.5 rounded" />
            <span>
              <span className="text-sm font-medium text-gray-900 block">Load demo data</span>
              <span className="text-[11px] text-gray-500">3 sample projects, 36 issues, milestones, epics and demo members. You can wipe and rebuild it any time from Workspace settings → Demo data.</span>
            </span>
          </label>
          {error && <ErrorBox message={error} />}
          <div className="flex gap-2">
            <button onClick={() => { setError(null); setStep(1) }} disabled={pending}
              className="flex-1 text-gray-600 hover:bg-gray-100 border border-gray-200 font-semibold py-2.5 rounded-lg transition-colors">Back</button>
            <button onClick={finish} disabled={pending}
              className="flex-[2] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-sm shadow-indigo-600/20">
              {pending ? 'Setting up…' : 'Finish setup'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, type, placeholder, autoFocus, value, onChange }: {
  label: string; type: string; placeholder: string; autoFocus?: boolean
  value: string; onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest block mb-1">{label}</span>
      <input type={type} placeholder={placeholder} autoFocus={autoFocus}
        value={value} onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300" />
    </label>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
      {message}
    </div>
  )
}
