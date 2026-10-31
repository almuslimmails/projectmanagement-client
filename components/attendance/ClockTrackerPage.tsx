'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'

// Clock Tracker — owners and managers only (menu + API both enforce it):
// hours worked per member per day over a date range, with range totals.

interface DayRow {
  member_id: string; name: string; email: string; role: string
  date: string; sessions: number; first_in: string; last_out: string | null
  seconds_worked: number; seconds_break: number; open: boolean; ip_addresses: string[]
}
interface MemberTotal {
  member_id: string; name: string; role: string
  days: number; seconds_worked: number; seconds_break: number
}
interface Report { from: string; to: string; rows: DayRow[]; totals: MemberTotal[] }

function hm(totalSeconds: number): string {
  const t = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(t / 3600)}h ${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}m`
}
function fmtTime(ts: string | null): string {
  if (!ts) return '—'
  const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z')
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
const iso = (d: Date) => d.toISOString().slice(0, 10)

export default function ClockTrackerPage() {
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 6 * 86_400_000)))
  const [to, setTo] = useState(() => iso(new Date()))
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!from || !to || from > to) return
    api.getClockReport(from, to)
      .then(r => { setReport(r as Report); setError('') })
      .catch(e => setError(e?.message ?? 'Could not load the clock report.'))
  }, [from, to])

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Clock Tracker</h2>
            <p className="text-sm text-gray-500 mt-0.5">Hours worked per person per day — visible to owners and managers only</p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">From</label>
              <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">To</label>
              <input type="date" value={to} min={from} max={iso(new Date())} onChange={e => setTo(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        {!report && !error && <p className="text-sm text-gray-400">Loading clock report…</p>}

        {report && (
          <>
            {/* Range totals per member */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {report.totals.map(t => (
                <div key={t.member_id} className="bg-white ring-1 ring-gray-100 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar name={t.name} size={6} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase">{t.role}</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{hm(t.seconds_worked)}</p>
                  <p className="text-[11px] text-gray-500">{t.days} day{t.days === 1 ? '' : 's'} · {hm(t.seconds_break)} on break</p>
                </div>
              ))}
              {report.totals.length === 0 && (
                <p className="col-span-full text-sm text-gray-400">Nobody clocked in between {report.from} and {report.to}.</p>
              )}
            </div>

            {/* Day-by-day detail */}
            {report.rows.length > 0 && (
              <div className="bg-white ring-1 ring-gray-100 rounded-xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                      <th className="text-left font-semibold px-4 py-2.5">Member</th>
                      <th className="text-left font-semibold px-4 py-2.5">Date</th>
                      <th className="text-left font-semibold px-4 py-2.5">First in</th>
                      <th className="text-left font-semibold px-4 py-2.5">Last out</th>
                      <th className="text-right font-semibold px-4 py-2.5">Sessions</th>
                      <th className="text-right font-semibold px-4 py-2.5">Worked</th>
                      <th className="text-right font-semibold px-4 py-2.5">Break</th>
                      <th className="text-left font-semibold px-4 py-2.5">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map(r => (
                      <tr key={`${r.member_id}-${r.date}`} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-2">
                            <Avatar name={r.name} size={5} />
                            <span className="font-medium text-gray-800">{r.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-600 tabular-nums">{r.date}</td>
                        <td className="px-4 py-2 text-gray-600 tabular-nums">{fmtTime(r.first_in)}</td>
                        <td className="px-4 py-2 tabular-nums">
                          {r.open
                            ? <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />working</span>
                            : <span className="text-gray-600">{fmtTime(r.last_out)}</span>}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600 tabular-nums">{r.sessions}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-900 tabular-nums">{hm(r.seconds_worked)}</td>
                        <td className="px-4 py-2 text-right text-gray-500 tabular-nums">{hm(r.seconds_break)}</td>
                        <td className="px-4 py-2 text-[11px] text-gray-400 font-mono">{r.ip_addresses.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
