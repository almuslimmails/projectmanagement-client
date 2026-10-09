'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'
import type { Member } from '@/lib/types'

interface Session {
  id: string
  status: 'online' | 'break' | 'offline'
  login_at: string
  logout_at: string | null
  break_start: string | null
  total_break_seconds: number
}

interface Props {
  currentMember: Member | null
  onSignOut: () => void
}

function parseTs(s: string): number {
  if (!s) return 0
  return new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z').getTime()
}

function hms(totalSeconds: number): string {
  const t = Math.max(0, Math.floor(totalSeconds))
  if (t < 60) return `${t}s`
  const totalMin = Math.floor(t / 60)
  if (totalMin < 60) return `${totalMin}m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

// Always-visible top-header strip with: user chip, clock in/out, break, sign out.
// Mirrors the sidebar's ClockWidget for members who work with the sidebar
// collapsed. Every signed-in member sees this regardless of role.
export default function HeaderUserStrip({ currentMember, onSignOut }: Props) {
  const [session, setSession] = useState<Session | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())

  async function refresh() {
    if (!currentMember) return
    try { setSession(await api.getMySession() as any) } catch {}
  }
  useEffect(() => { refresh(); const t = setInterval(refresh, 30_000); return () => clearInterval(t) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMember?.id])

  // 1s tick so the on-header timer feels alive when a session is open.
  useEffect(() => {
    if (!session || session.status === 'offline') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [session?.status])

  if (!currentMember) return null

  // Live worked / break seconds — mirrors the sidebar ClockWidget's math.
  let worked = 0, onBreak = 0
  if (session && session.login_at) {
    const start = parseTs(session.login_at)
    const end = session.logout_at ? parseTs(session.logout_at) : now
    let breaks = session.total_break_seconds ?? 0
    if (session.status === 'break' && session.break_start) {
      breaks += Math.max(0, Math.floor((now - parseTs(session.break_start)) / 1000))
    }
    onBreak = breaks
    worked = Math.max(0, Math.floor((end - start) / 1000) - breaks)
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    try { await fn(); await refresh() } finally { setBusy(false) }
  }

  const offline = !session || session.status === 'offline'
  const online  = session?.status === 'online'
  const breaking = session?.status === 'break'

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Clock in / out / break */}
      {offline ? (
        <button onClick={() => run(() => api.clockIn())} disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-2.5 py-1.5 rounded-md shadow-sm transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {busy ? 'Clocking in…' : 'Clock in'}
        </button>
      ) : (
        <div className="inline-flex items-center gap-1.5 bg-gray-50 ring-1 ring-gray-200 rounded-md pl-2 pr-1 py-0.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums">
            <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
            <span className={online ? 'text-emerald-700' : 'text-amber-700'}>
              {online ? hms(worked) : `Break ${hms(onBreak)}`}
            </span>
          </span>
          <button onClick={() => run(() => api.toggleBreak())} disabled={busy}
            title={online ? 'Start break' : 'End break'}
            className="text-[10px] font-semibold text-gray-600 hover:text-amber-700 hover:bg-white px-1.5 py-0.5 rounded transition-colors">
            {online ? 'Break' : 'Resume'}
          </button>
          <button onClick={() => run(() => api.clockOut())} disabled={busy}
            title="Clock out"
            className="text-[10px] font-semibold text-gray-600 hover:text-red-600 hover:bg-white px-1.5 py-0.5 rounded transition-colors">
            Out
          </button>
        </div>
      )}

      {/* User chip — click to sign out */}
      <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-gray-200">
        <Avatar name={currentMember.name} size={6} />
        <div className="min-w-0 leading-tight">
          <p className="text-[11px] font-semibold text-gray-800 truncate max-w-[120px]">{currentMember.name}</p>
          <p className="text-[9px] uppercase tracking-widest text-gray-400 capitalize">{currentMember.role}</p>
        </div>
      </div>

      {/* Sign out — icon-only on narrow, keeps working when the sidebar is collapsed. */}
      <button onClick={onSignOut}
        title="Sign out"
        aria-label="Sign out"
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-md transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        <span className="hidden md:inline">Sign out</span>
      </button>
    </div>
  )
}
