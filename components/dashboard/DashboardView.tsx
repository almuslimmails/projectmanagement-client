'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'
import { PRIORITY_CONFIG, ISSUE_TYPE_CONFIG, fmtDate, formatIssueCode, overdueDuration, relTime } from '@/lib/utils'
import type { Project } from '@/lib/types'

// ── Types ──────────────────────────────────────────────────────────────────

interface ProjectRow {
  id: string; name: string; identifier: string; emoji: string
  total: number
  backlog: number; unstarted: number; inProgress: number; completed: number; cancelled: number
  overdue: number
  createdLast7: number; completedLast7: number
  progressPct: number
  health: 'healthy' | 'at-risk' | 'off-track'
}
interface Overview {
  projects: ProjectRow[]
  totals: { projects: number; total: number; inProgress: number; completed: number; overdue: number; createdLast7: number; completedLast7: number }
}
interface AgentFeedItem {
  id: string; project_id: string
  sequence_id: number; type_seq: number | null; type: string
  title: string; priority: string; due_date: string | null; created_at: string
  project_name: string; project_identifier: string; project_emoji: string
  state_name: string | null; state_color: string | null; state_group: string | null
  agent_name: string
  assignees: { id: string; name: string }[]
}
interface ProjectDashboard {
  headline: { total: number; inProgress: number; completed: number; overdue: number; createdLast7: number; completedLast7: number }
  rollup: { backlog: number; unstarted: number; started: number; completed: number; cancelled: number }
  byState: { name: string; color: string; group: string; count: number }[]
  byPriority: { key: string; count: number }[]
  byType: { key: string; count: number }[]
  byAssignee: { id: string | null; name: string; role: string; count: number }[]
  overdueIssues: { id: string; sequence_id: number; type: string; type_seq: number | null; title: string; due_date: string; priority: string; assignee: any }[]
  recentActivity: any[]
}

const FIELD_LABELS: Record<string, string> = {
  state_id: 'state', priority: 'priority', assignee_id: 'assignee',
  parent_id: 'parent', start_date: 'start date', due_date: 'due date',
  estimate: 'estimate', title: 'title', type: 'type', completed_at: 'completion',
}
function describeActivity(a: any): string {
  if (a.action === 'created') return 'created'
  if (a.action === 'label_added') return `added label "${a.new_value ?? ''}"`
  if (a.action === 'label_removed') return `removed label "${a.old_value ?? ''}"`
  if (a.action === 'assignee_added') return `assigned ${a.new_value ?? 'a member'}`
  if (a.action === 'assignee_removed') return `unassigned ${a.old_value ?? 'a member'}`
  const f = a.field ?? 'something'
  const label = FIELD_LABELS[f] ?? f
  if (f === 'description') return 'edited description'
  if (a.old_value && a.new_value) return `changed ${label} → "${a.new_value}"`
  if (a.new_value) return `set ${label} → "${a.new_value}"`
  if (a.old_value) return `cleared ${label}`
  return `updated ${label}`
}

// ── Root ───────────────────────────────────────────────────────────────────

interface Props {
  projects: Project[]
  initialProjectId?: string
  onClickIssue?: (projectId: string, issueId: string) => void
  onSelectProject?: (projectId: string) => void
}

export default function DashboardView({ projects, initialProjectId, onClickIssue, onSelectProject }: Props) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [err, setErr] = useState<string | null>(null)
  // Per-project detail cache — populated lazily on section expand.
  const [details, setDetails] = useState<Record<string, ProjectDashboard | 'loading' | 'error'>>({})
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initialProjectId ? [initialProjectId] : []))

  const [agentFeed, setAgentFeed] = useState<AgentFeedItem[]>([])

  useEffect(() => {
    let cancelled = false
    api.getWorkspaceOverview()
      .then((d: Overview) => { if (!cancelled) setOverview(d) })
      .catch(e => { if (!cancelled) setErr(e?.message ?? 'Failed to load') })
    // The agent feed is an extra — a failure here never blocks the dashboard.
    api.getAgentFeed()
      .then((d: AgentFeedItem[]) => { if (!cancelled && Array.isArray(d)) setAgentFeed(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Pre-load the initially-expanded project so its details show immediately.
  useEffect(() => {
    if (initialProjectId) loadDetail(initialProjectId)
  }, [initialProjectId])

  async function loadDetail(pid: string) {
    setDetails(prev => (prev[pid] && prev[pid] !== 'error') ? prev : { ...prev, [pid]: 'loading' })
    try {
      const d = await api.getDashboard(pid)
      setDetails(prev => ({ ...prev, [pid]: d as ProjectDashboard }))
    } catch {
      setDetails(prev => ({ ...prev, [pid]: 'error' }))
    }
  }

  function toggle(pid: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid)
      else { next.add(pid); if (!details[pid] || details[pid] === 'error') loadDetail(pid) }
      return next
    })
  }

  if (err) return <div className="flex-1 p-8 text-sm text-red-600">Couldn't load dashboard: {err}</div>
  if (!overview) return <div className="flex-1 p-8 text-sm text-gray-500">Loading workspace overview…</div>

  const identifierById = new Map(projects.map(p => [p.id, p.identifier]))

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {/* ─── Workspace summary ─────────────────────────────────────────── */}
      <div className="p-6 space-y-5 border-b border-gray-200 bg-gradient-to-b from-white to-gray-50">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase">Workspace overview</p>
          <h1 className="text-lg font-bold text-gray-900">All projects at a glance</h1>
          <p className="text-xs text-gray-500 mt-0.5">{overview.totals.projects} project{overview.totals.projects === 1 ? '' : 's'} · totals across the whole workspace</p>
        </div>

        {/* Grand totals */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total issues"   value={overview.totals.total}       accent="indigo" />
          <StatCard label="In progress"    value={overview.totals.inProgress}  accent="amber" />
          <StatCard label="Completed"      value={overview.totals.completed}   accent="emerald" />
          <StatCard label="Overdue"        value={overview.totals.overdue}     accent="red" />
          <StatCard label="Created · 7d"   value={overview.totals.createdLast7} accent="violet"
            subValue={`${overview.totals.completedLast7} done`} />
        </div>

        {/* Tasks pushed from Claude */}
        {agentFeed.length > 0 && (
          <div className="bg-white ring-1 ring-violet-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-violet-100 bg-violet-50/60">
              <span className="w-5 h-5 rounded-md bg-violet-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">✳</span>
              <p className="text-[11px] font-bold text-violet-700 uppercase tracking-widest">Pushed from Claude</p>
              <p className="text-[10px] text-violet-400 ml-auto">{agentFeed.length} recent · newest first</p>
            </div>
            <ul className="divide-y divide-gray-100">
              {agentFeed.map(t => (
                <li key={t.id}
                  onClick={() => onClickIssue?.(t.project_id, t.id)}
                  className="px-5 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-violet-50/40 transition-colors">
                  <span className="text-sm leading-none shrink-0" title={t.project_name}>{t.project_emoji || '📁'}</span>
                  <span className="text-[11px] text-gray-400 font-mono shrink-0">
                    {t.project_identifier}-{formatIssueCode(t as any)}
                  </span>
                  <span className="text-sm text-gray-800 truncate flex-1 min-w-0">{t.title}</span>
                  {t.state_name && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-medium text-gray-600 px-2 py-0.5 rounded-full bg-gray-50 ring-1 ring-gray-200 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.state_color ?? '#9CA3AF' }} />
                      {t.state_name}
                    </span>
                  )}
                  <span className="hidden sm:inline text-[11px] shrink-0" title={PRIORITY_CONFIG[t.priority as keyof typeof PRIORITY_CONFIG]?.label ?? t.priority}>
                    {PRIORITY_CONFIG[t.priority as keyof typeof PRIORITY_CONFIG]?.icon ?? ''}
                  </span>
                  <span className="flex -space-x-1.5 shrink-0">
                    {t.assignees.slice(0, 3).map(a => <Avatar key={a.id} name={a.name} size={5} />)}
                  </span>
                  <span className="text-[10px] text-gray-400 shrink-0 w-14 text-right">{relTime(t.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Comparison table */}
        <div className="bg-white ring-1 ring-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Project comparison</p>
            <p className="text-[10px] text-gray-400">click a row to jump to details</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="text-left  py-2 px-4 font-semibold">Project</th>
                  <th className="text-right py-2 px-3 font-semibold">Total</th>
                  <th className="text-left  py-2 px-3 font-semibold w-40">Progress</th>
                  <th className="text-right py-2 px-3 font-semibold">In&nbsp;prog.</th>
                  <th className="text-right py-2 px-3 font-semibold">Done</th>
                  <th className="text-right py-2 px-3 font-semibold">Overdue</th>
                  <th className="text-right py-2 px-3 font-semibold">7d&nbsp;in</th>
                  <th className="text-right py-2 px-3 font-semibold">7d&nbsp;done</th>
                  <th className="text-center py-2 px-3 font-semibold">Health</th>
                </tr>
              </thead>
              <tbody>
                {overview.projects.length === 0 && (
                  <tr><td colSpan={9} className="py-6 text-center text-gray-400 italic">No projects yet</td></tr>
                )}
                {overview.projects.map(p => (
                  <tr key={p.id}
                    onClick={() => {
                      onSelectProject?.(p.id)
                      setExpanded(prev => {
                        const next = new Set(prev); next.add(p.id); return next
                      })
                      if (!details[p.id] || details[p.id] === 'error') loadDetail(p.id)
                      // Scroll to the section after render.
                      requestAnimationFrame(() => {
                        document.getElementById(`dash-section-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      })
                    }}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-indigo-50/40 cursor-pointer transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base leading-none shrink-0">{p.emoji || '📁'}</span>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{p.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{p.identifier}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-gray-800">{p.total}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${p.progressPct}%` }} />
                        </div>
                        <span className="text-[10px] tabular-nums text-gray-500 w-8 text-right shrink-0">{p.progressPct}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-amber-700">{p.inProgress || <span className="text-gray-300">·</span>}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">{p.completed || <span className="text-gray-300">·</span>}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {p.overdue ? <span className="text-red-700 font-semibold">{p.overdue}</span> : <span className="text-gray-300">·</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-violet-700">{p.createdLast7 || <span className="text-gray-300">·</span>}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">{p.completedLast7 || <span className="text-gray-300">·</span>}</td>
                    <td className="py-2.5 px-3 text-center">
                      <HealthChip value={p.health} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Per-project detail sections ───────────────────────────────── */}
      <div className="p-6 space-y-4">
        {overview.projects.map(p => {
          const isOpen = expanded.has(p.id)
          const detail = details[p.id]
          return (
            <section key={p.id} id={`dash-section-${p.id}`}
              className="bg-white ring-1 ring-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <header
                onClick={() => toggle(p.id)}
                className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
                <span className="text-lg leading-none">{p.emoji || '📁'}</span>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-gray-900 truncate">{p.name}</h2>
                  <p className="text-[10px] text-gray-500 font-mono">{p.identifier}</p>
                </div>
                <MiniStat label="Total"    value={p.total} />
                <MiniStat label="Progress" value={`${p.progressPct}%`} tone="emerald" />
                <MiniStat label="Overdue"  value={p.overdue} tone={p.overdue ? 'red' : 'muted'} />
                <HealthChip value={p.health} />
              </header>

              {isOpen && (
                <div className="p-5">
                  {detail === 'loading' && <p className="text-sm text-gray-500 py-6 text-center">Loading project details…</p>}
                  {detail === 'error'   && (
                    <div className="text-sm text-red-600 py-6 text-center">
                      Failed to load details.
                      <button onClick={() => loadDetail(p.id)} className="ml-2 underline">Retry</button>
                    </div>
                  )}
                  {detail && detail !== 'loading' && detail !== 'error' && (
                    <ProjectDetail data={detail}
                      identifier={identifierById.get(p.id) ?? p.identifier}
                      onClickIssue={(iid) => onClickIssue?.(p.id, iid)} />
                  )}
                </div>
              )}
            </section>
          )
        })}
        {overview.projects.length === 0 && (
          <div className="text-sm text-gray-400 italic text-center py-8">
            No projects yet — create one to see its dashboard here.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Per-project detail panels (the old dashboard content) ──────────────────

function ProjectDetail({ data, identifier, onClickIssue }: {
  data: ProjectDashboard; identifier: string; onClickIssue?: (iid: string) => void
}) {
  const max = (arr: { count: number }[]) => Math.max(1, ...arr.map(x => x.count))

  return (
    <div className="space-y-4">
      {/* Headline strip — smaller now, since totals were already shown above */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total issues" value={data.headline.total}       accent="indigo" small />
        <StatCard label="In progress"  value={data.headline.inProgress}  accent="amber" small />
        <StatCard label="Completed"    value={data.headline.completed}   accent="emerald" small />
        <StatCard label="Overdue"      value={data.headline.overdue}     accent="red" small />
        <StatCard label="Created · 7d" value={data.headline.createdLast7} accent="violet" small
          subValue={`${data.headline.completedLast7} done`} />
      </div>

      {/* Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="By state">
          <BarList items={data.byState.map(s => ({ label: s.name, value: s.count, color: s.color }))}
            max={max(data.byState)} empty="No issues" />
        </Panel>
        <Panel title="By priority">
          <BarList items={data.byPriority.filter(p => p.count > 0).map(p => ({
            label: PRIORITY_CONFIG[p.key as keyof typeof PRIORITY_CONFIG].label,
            value: p.count,
            color: PRIORITY_CONFIG[p.key as keyof typeof PRIORITY_CONFIG].color,
          }))} max={max(data.byPriority)} empty="No issues" />
        </Panel>
        <Panel title="By type">
          <BarList items={data.byType.filter(t => t.count > 0).map(t => ({
            label: `${ISSUE_TYPE_CONFIG[t.key as keyof typeof ISSUE_TYPE_CONFIG].icon} ${ISSUE_TYPE_CONFIG[t.key as keyof typeof ISSUE_TYPE_CONFIG].label}`,
            value: t.count,
            color: ISSUE_TYPE_CONFIG[t.key as keyof typeof ISSUE_TYPE_CONFIG].color,
          }))} max={max(data.byType)} empty="No issues" />
        </Panel>
        <Panel title="Workload">
          <BarList items={data.byAssignee.map(a => ({
            label: a.name + (a.role ? ` · ${a.role}` : ''),
            value: a.count,
            color: a.id ? '#6366F1' : '#9CA3AF',
          }))} max={max(data.byAssignee)} empty="No issues" />
        </Panel>
      </div>

      {/* Overdue + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title={`Overdue (${data.overdueIssues.length})`}>
          {data.overdueIssues.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-4">Nothing overdue — nice 🎉</p>
          ) : (
            <ul className="divide-y">
              {data.overdueIssues.map(i => (
                <li key={i.id}
                  onClick={() => onClickIssue?.(i.id)}
                  className="py-2 flex items-center gap-2 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 shrink-0">
                    {overdueDuration(i.due_date)}
                  </span>
                  <span className="text-[11px] text-gray-400 font-mono shrink-0">{identifier}-{formatIssueCode(i as any)}</span>
                  <span className="text-sm text-gray-800 truncate flex-1">{i.title}</span>
                  <span className="text-[11px] text-red-500 shrink-0">{fmtDate(i.due_date)}</span>
                  {i.assignee && <Avatar name={i.assignee.name} size={5} />}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent activity">
          {data.recentActivity.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-4">No activity yet</p>
          ) : (
            <ul className="space-y-2">
              {data.recentActivity.map((a: any) => (
                <li key={a.id} className="flex items-start gap-2">
                  {a.actor
                    ? <Avatar name={a.actor.name} size={5} />
                    : <span className="block w-5 h-5 rounded-full bg-gray-200 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-700 leading-snug">
                      <span className="font-medium text-gray-900">{a.actor?.name ?? 'Someone'}</span>
                      {' '}{describeActivity(a)}
                      {' on '}
                      <span className="font-mono text-gray-500">{identifier}-{formatIssueCode({ type: a.issue_type, type_seq: a.issue_type_seq, sequence_id: a.issue_seq })}</span>
                    </p>
                    <p className="text-[10px] text-gray-400">{relTime(a.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

// ── Building blocks ────────────────────────────────────────────────────────

function StatCard({ label, value, accent, subValue, small }: {
  label: string; value: number | string
  accent: 'indigo' | 'amber' | 'emerald' | 'red' | 'violet'
  subValue?: string; small?: boolean
}) {
  const styles: Record<string, { bg: string; ring: string; num: string; dot: string }> = {
    indigo:  { bg: 'bg-indigo-50',  ring: 'ring-indigo-100',  num: 'text-indigo-700',  dot: 'bg-indigo-500' },
    amber:   { bg: 'bg-amber-50',   ring: 'ring-amber-100',   num: 'text-amber-700',   dot: 'bg-amber-500' },
    emerald: { bg: 'bg-emerald-50', ring: 'ring-emerald-100', num: 'text-emerald-700', dot: 'bg-emerald-500' },
    red:     { bg: 'bg-red-50',     ring: 'ring-red-100',     num: 'text-red-700',     dot: 'bg-red-500' },
    violet:  { bg: 'bg-violet-50',  ring: 'ring-violet-100',  num: 'text-violet-700',  dot: 'bg-violet-500' },
  }
  const s = styles[accent]
  return (
    <div className={`${s.bg} ring-1 ${s.ring} rounded-2xl ${small ? 'p-3' : 'p-5'} transition-transform hover:-translate-y-0.5`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">{label}</p>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`${small ? 'text-2xl' : 'text-4xl'} font-bold tabular-nums tracking-tight ${s.num}`}>{value}</span>
        {subValue && <span className="text-[11px] text-gray-500">{subValue}</span>}
      </div>
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: number | string; tone?: 'emerald' | 'red' | 'muted' }) {
  const color = tone === 'emerald' ? 'text-emerald-700'
    : tone === 'red' ? 'text-red-700'
    : tone === 'muted' ? 'text-gray-400'
    : 'text-gray-800'
  return (
    <div className="hidden md:flex flex-col items-end shrink-0 min-w-[52px]">
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[9px] uppercase tracking-widest text-gray-400">{label}</span>
    </div>
  )
}

function HealthChip({ value }: { value: 'healthy' | 'at-risk' | 'off-track' }) {
  const s = value === 'healthy'
    ? { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Healthy' }
    : value === 'at-risk'
    ? { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'At risk' }
    : { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Off track' }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.text} whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white ring-1 ring-gray-100 rounded-2xl p-5 shadow-sm">
      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">{title}</p>
      {children}
    </div>
  )
}

function BarList({ items, max, empty }: { items: { label: string; value: number; color: string }[]; max: number; empty: string }) {
  if (items.length === 0) return <p className="text-xs text-gray-400 italic">{empty}</p>
  return (
    <ul className="space-y-2.5">
      {items.map((it, idx) => (
        <li key={idx} className="flex items-center gap-3 text-xs">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: it.color }} />
          <span className="text-gray-700 font-medium truncate w-32 shrink-0">{it.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(it.value / max) * 100}%`, backgroundColor: it.color }} />
          </div>
          <span className="text-gray-700 font-bold tabular-nums w-8 text-right shrink-0">{it.value}</span>
        </li>
      ))}
    </ul>
  )
}
