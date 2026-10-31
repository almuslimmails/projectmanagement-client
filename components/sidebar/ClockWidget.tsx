'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface Session {
  id: string
  login_at: string
  logout_at: string | null
  status: 'online' | 'break' | 'offline'
  break_start: string | null
  total_break_seconds: number
}

// Parses an ISO-ish or SQLite datetime string ("2026-05-19 10:13:00") as UTC.
function parseTs(s: string): number {
  if (!s) return 0
  return new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z').getTime()
}

function hms(totalSeconds: number): string {
  const t = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m ${String(s).padStart(2, '0')}s`
}

export default function ClockWidget() {
  const [session, setSession] = useState<Session | null>(null)
  const [pending, setPending] = useState(false)
  const [now, setNow] = useState(Date.now())

  async function refresh() {
    try { setSession(await api.getMySession() as any) } catch {}
  }

  // Initial fetch + 30s poll (covers external state changes; local ticking handled below).
  // 'tracker:clock-changed' fires when something else clocks the member in or out
  // (the forced clock-in gate) so the widget updates immediately instead of on the
  // next poll.
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 30_000)
    window.addEventListener('tracker:clock-changed', refresh)
    return () => { clearInterval(t); window.removeEventListener('tracker:clock-changed', refresh) }
  }, [])

  // 1s tick so the on-screen timer feels alive when a session is open.
  useEffect(() => {
    if (!session || session.status === 'offline') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [session?.status])

  // Live "worked" + "on-break" durations computed on the client.
  let secondsWorked = 0
  let secondsOnBreak = 0
  if (session && session.login_at) {
    const start = parseTs(session.login_at)
    const end = session.logout_at ? parseTs(session.logout_at) : now
    let breaks = session.total_break_seconds ?? 0
    if (session.status === 'break' && session.break_start) {
      breaks += Math.max(0, Math.floor((now - parseTs(session.break_start)) / 1000))
    }
    secondsOnBreak = breaks
    secondsWorked = Math.max(0, Math.floor((end - start) / 1000) - breaks)
  }

  async function run(fn: () => Promise<unknown>) {
    setPending(true)
    try { await fn(); await refresh() } finally { setPending(false) }
  }

  // ── Render states ────────────────────────────────────────────────────────
  if (!session || session.status === 'offline') {
    return (
      <div className="px-4 py-3 border-b border-black/20">
        <button onClick={() => run(() => api.clockIn())}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold py-2 rounded-md text-sm shadow-sm transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {pending ? 'Clocking in…' : 'Clock In'}
        </button>
      </div>
    )
  }

  const onBreak = session.status === 'break'
  return (
    <div className="px-4 py-3 border-b border-black/20 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${onBreak ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
          <span className="text-[10px] uppercase tracking-widest font-bold text-white/80">
            {onBreak ? 'On break' : 'Clocked in'}
          </span>
        </div>
        <span className="text-xs tabular-nums font-semibold text-white">{hms(secondsWorked)}</span>
      </div>
      {secondsOnBreak > 0 && (
        <p className="text-[10px] text-white/50">Break time: {hms(secondsOnBreak)}</p>
      )}
      <div className="flex gap-1.5">
        <button onClick={() => run(() => api.toggleBreak())}
          disabled={pending}
          className={`flex-1 text-[11px] font-medium px-2 py-1.5 rounded transition-colors ${onBreak ? 'bg-emerald-500/90 hover:bg-emerald-500 text-white' : 'bg-amber-500/90 hover:bg-amber-500 text-white'}`}>
          {onBreak ? 'Resume' : 'Take break'}
        </button>
        <button onClick={() => run(() => api.clockOut())}
          disabled={pending}
          className="flex-1 text-[11px] font-medium px-2 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white transition-colors">
          Clock out
        </button>
      </div>
    </div>
  )
}
