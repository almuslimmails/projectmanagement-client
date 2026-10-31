'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Member } from '@/lib/types'

// Hard gate after sign-in: employees (every role below owner) must clock in
// before the tracker becomes usable. Owners are exempt — they administer the
// workspace (and the agent account runs the MCP), so they are never locked
// out. The gate also stands down when the Attendance feature is switched off
// in Company settings, since clocking in would be impossible then.
interface Props {
  currentMember: Member | null
  enabled: boolean
}

export default function ForceClockInGate({ currentMember, enabled }: Props) {
  const gated = !!currentMember && currentMember.role !== 'owner' && enabled
  const [state, setState] = useState<'checking' | 'blocked' | 'clear'>('checking')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!gated) { setState('clear'); return }
    setState('checking')
    api.getMySession()
      .then((s: any) => setState(!s || s.status === 'offline' ? 'blocked' : 'clear'))
      // Fail open: a broken status check must not lock someone out of work.
      .catch(() => setState('clear'))
  }, [gated, currentMember?.id])

  if (state === 'clear') return null

  async function clockIn() {
    setPending(true)
    setError('')
    try {
      await api.clockIn()
      setState('clear')
      // Tell the sidebar ClockWidget right away — it otherwise only polls every 30s.
      window.dispatchEvent(new Event('tracker:clock-changed'))
    } catch (e: any) {
      setError(e?.message ?? 'Clock-in failed — try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#2b0a2c]/90 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
        {state === 'checking' ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Checking your clock…</p>
          </div>
        ) : (
          <>
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Clock in to start your day</h2>
            <p className="text-sm text-gray-500 mt-1.5">
              Hi {currentMember?.name} — attendance is required before you can use the tracker.
            </p>
            {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
            <button onClick={clockIn} disabled={pending}
              className="mt-6 w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm shadow-sm transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {pending ? 'Clocking in…' : 'Clock In'}
            </button>
            <button onClick={() => { api.logout(); window.location.href = '/sign-in' }}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Sign out instead
            </button>
          </>
        )}
      </div>
    </div>
  )
}
