'use client'
import { useEffect, useMemo, useState } from 'react'
import { api, urlFor } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'

interface Session {
  id: string
  member_id: string
  member?: { id: string; name: string; email: string; role: string }
  login_at: string
  logout_at: string | null
  status: 'online' | 'break' | 'offline'
  seconds_worked: number
  total_break_seconds: number
  ip_address: string | null
}

function todayISO() { return new Date().toISOString().slice(0, 10) }

function fmtTime(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z')
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

// Adaptive duration formatter. Break durations are minutes-scale, so the old
// `Xh YYm` format hid anything under a minute as "0h 00m". Now:
//   <60s  → "Xs" (still visible for a quick break)
//   <60m  → "Xm"
//   ≥1h   → "Xh YYm"
function hms(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds ?? 0))
  if (s < 60) return `${s}s`
  const totalMin = Math.floor(s / 60)
  if (totalMin < 60) return `${totalMin}m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export default function AttendanceView({ projectId }: { projectId: string }) {
  const [date, setDate] = useState(todayISO())
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  // Ticks once a second so live-elapsed durations update visually between the
  // 30s server refreshes. Value is ignored — its state change is the trigger.
  const [, setTick] = useState(0)
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  async function refresh() {
    setLoading(true)
    try {
      setSessions(await api.getAttendance(date) as Session[])
      setLastRefresh(Date.now())
    } finally { setLoading(false) }
  }

  useEffect(() => {
    let cancelled = false
    refresh()
    const server = setInterval(() => { if (!cancelled) refresh() }, 30_000)
    const local  = setInterval(() => { if (!cancelled) setTick(t => t + 1) }, 1_000)
    return () => { cancelled = true; clearInterval(server); clearInterval(local) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  // Overlay the seconds elapsed since the server response onto live sessions.
  // - status 'break':   accumulate onto total_break_seconds
  // - status 'online':  accumulate onto seconds_worked
  // - status 'offline': persisted values (frozen)
  // Capped at 60s to avoid runaway values if the tab was suspended.
  function liveOverlay(s: Session): Session {
    if (s.status === 'offline') return s
    const delta = Math.min(60, Math.max(0, Math.floor((Date.now() - lastRefresh) / 1000)))
    if (s.status === 'break') return { ...s, total_break_seconds: (s.total_break_seconds ?? 0) + delta }
    return { ...s, seconds_worked: (s.seconds_worked ?? 0) + delta }
  }

  function exportCsv() {
    window.open(urlFor(`/attendance/export?date=${date}`), '_blank', 'noopener')
  }

  // Per-status rollups for the headline strip.
  const rollup = useMemo(() => {
    const out = { online: 0, break: 0, offline: 0, totalSeconds: 0 }
    for (const s of sessions) {
      if (s.status === 'online') out.online++
      else if (s.status === 'break') out.break++
      else out.offline++
      out.totalSeconds += s.seconds_worked ?? 0
    }
    return out
  }, [sessions])

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#F8F8F8]">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Attendance</h2>
            <p className="text-sm text-gray-500 mt-0.5">Who's working when. Pick a date or export.</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} max={todayISO()}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            <button onClick={exportCsv}
              className="text-sm bg-white border border-gray-200 hover:border-indigo-300 hover:text-indigo-700 rounded-md px-3 py-1.5 inline-flex items-center gap-1.5 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-5l-4 4m0 0l-4-4m4 4V4"/></svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Rollup cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Sessions"    value={sessions.length}        accent="indigo" />
          <StatCard label="Online now"  value={rollup.online}          accent="emerald" />
          <StatCard label="On break"    value={rollup.break}           accent="amber" />
          <StatCard label="Total hours" value={hms(rollup.totalSeconds)} accent="violet" />
        </div>

        {/* Table */}
        <div className="bg-white ring-1 ring-gray-100 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[200px_100px_110px_110px_110px_110px_1fr] gap-3 px-5 py-2 border-b border-gray-200 bg-gray-50 text-[10px] font-bold tracking-widest text-gray-500 uppercase">
            <span>Member</span>
            <span>Status</span>
            <span>Login</span>
            <span>Logout</span>
            <span>Worked</span>
            <span>Break</span>
            <span>IP</span>
          </div>
          {loading ? (
            <p className="px-5 py-6 text-sm text-gray-400">Loading…</p>
          ) : sessions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 italic">No sessions on {date}.</p>
          ) : sessions.map(raw => {
            const s = liveOverlay(raw)
            return (
            <div key={s.id} className="grid grid-cols-[200px_100px_110px_110px_110px_110px_1fr] gap-3 px-5 py-2.5 border-b border-gray-100 items-center hover:bg-gray-50">
              <div className="flex items-center gap-2 min-w-0">
                {s.member ? <Avatar name={s.member.name} size={5} /> : null}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.member?.name ?? '—'}</p>
                  <p className="text-[10px] text-gray-500 truncate">{s.member?.email}</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${s.status === 'online' ? 'bg-emerald-50 text-emerald-700' : s.status === 'break' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                {s.status}
              </span>
              <span className="text-xs text-gray-700 tabular-nums">{fmtTime(s.login_at)}</span>
              <span className="text-xs text-gray-700 tabular-nums">{fmtTime(s.logout_at)}</span>
              <span className="text-xs font-semibold text-gray-900 tabular-nums">{hms(s.seconds_worked ?? 0)}</span>
              <span className={`text-xs tabular-nums ${s.status === 'break' ? 'text-amber-700 font-semibold' : 'text-gray-500'}`}>
                {hms(s.total_break_seconds ?? 0)}
              </span>
              <span className="text-[11px] text-gray-400 truncate">{s.ip_address ?? ''}</span>
            </div>
          )})}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent: 'indigo' | 'amber' | 'emerald' | 'violet' }) {
  const styles: Record<string, { bg: string; ring: string; num: string; dot: string }> = {
    indigo:  { bg: 'bg-indigo-50',  ring: 'ring-indigo-100',  num: 'text-indigo-700',  dot: 'bg-indigo-500' },
    amber:   { bg: 'bg-amber-50',   ring: 'ring-amber-100',   num: 'text-amber-700',   dot: 'bg-amber-500' },
    emerald: { bg: 'bg-emerald-50', ring: 'ring-emerald-100', num: 'text-emerald-700', dot: 'bg-emerald-500' },
    violet:  { bg: 'bg-violet-50',  ring: 'ring-violet-100',  num: 'text-violet-700',  dot: 'bg-violet-500' },
  }
  const s = styles[accent]
  return (
    <div className={`${s.bg} ring-1 ${s.ring} rounded-2xl p-5`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">{label}</p>
      </div>
      <span className={`text-3xl font-bold tabular-nums tracking-tight ${s.num}`}>{value}</span>
    </div>
  )
}
