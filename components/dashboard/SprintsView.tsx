'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'
import { PRIORITY_CONFIG, fmtDate, formatIssueCode } from '@/lib/utils'
import type { Issue } from '@/lib/types'

// Workspace sprint view: one page rolling up the same-named milestone across
// boards. The server already scopes boards and cards to the viewer, so this
// just renders what comes back.

interface SprintBoard {
  project_id: string; identifier: string; name: string; emoji: string; cycle_id: string
  total: number; done: number; progress: number
}
interface SprintIssue extends Issue {
  project_identifier: string; project_emoji: string
}
interface Sprint {
  name: string; description: string
  start_date: string | null; end_date: string | null
  boards: SprintBoard[]
  total: number; done: number; progress: number
  issues: SprintIssue[]
}

interface Props {
  onClickIssue?: (projectId: string, issueId: string) => void
}

export default function SprintsView({ onClickIssue }: Props) {
  const [sprints, setSprints] = useState<Sprint[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getSprints()
      .then(setSprints)
      .catch(e => setError(e?.message ?? 'could not load sprints'))
  }, [])

  if (error) return <p className="p-6 text-sm text-red-500">{error}</p>
  if (!sprints) return <p className="p-6 text-sm text-gray-400">Loading sprints…</p>
  if (sprints.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-500">No sprints yet.</p>
        <p className="text-xs text-gray-400 mt-1">Create a milestone with the same name on each board that takes part — it shows up here as one sprint.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
      {sprints.map(s => <SprintPanel key={s.name} sprint={s} onClickIssue={onClickIssue} />)}
    </div>
  )
}

function SprintPanel({ sprint, onClickIssue }: { sprint: Sprint; onClickIssue?: Props['onClickIssue'] }) {
  // Group the sprint's cards by epic (fall back to the board name) so the page
  // reads as workstreams, not a flat dump.
  const groups = new Map<string, SprintIssue[]>()
  for (const i of sprint.issues) {
    const key = i.epic?.name ?? `${sprint.name} — ${i.project_identifier}`
    const list = groups.get(key) ?? []
    list.push(i)
    groups.set(key, list)
  }

  return (
    <div className="bg-white ring-1 ring-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-bold text-gray-900">{sprint.name}</h2>
          <span className="text-xs text-gray-400">{fmtDate(sprint.start_date)} → {fmtDate(sprint.end_date)}</span>
          <span className="ml-auto text-xs font-semibold text-gray-600">{sprint.done}/{sprint.total} done · {sprint.progress}%</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${sprint.progress}%` }} />
        </div>
        {/* Per-board slices */}
        <div className="mt-3 flex flex-wrap gap-2">
          {sprint.boards.map(b => (
            <span key={b.cycle_id} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 bg-gray-50 ring-1 ring-gray-200 rounded-full px-2.5 py-1">
              <span>{b.emoji}</span>
              <span className="font-mono">{b.identifier}</span>
              <span className="text-gray-400">{b.done}/{b.total}</span>
              <span className={b.progress === 100 ? 'text-emerald-600' : 'text-gray-400'}>{b.progress}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* Cards grouped by epic */}
      {[...groups.entries()].map(([epic, issues]) => (
        <div key={epic} className="px-5 py-3 border-b border-gray-50 last:border-b-0">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">{epic} <span className="text-gray-300 normal-case tracking-normal">· {issues.length}</span></p>
          <ul className="divide-y divide-gray-50">
            {issues.map(i => (
              <li key={i.id}
                onClick={() => onClickIssue?.(i.project_id, i.id)}
                className="py-2 flex items-center gap-2 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded">
                <span className="text-[11px] text-gray-400 font-mono shrink-0">{i.project_identifier}-{formatIssueCode(i)}</span>
                <span className={`text-sm truncate flex-1 ${i.state?.group_type === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{i.title}</span>
                {i.state && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ color: i.state.color, backgroundColor: `${i.state.color}18` }}>
                    {i.state.name}
                  </span>
                )}
                <span className="text-[11px] shrink-0" title={PRIORITY_CONFIG[i.priority]?.label}>{PRIORITY_CONFIG[i.priority]?.icon}</span>
                {i.due_date && <span className="text-[11px] text-gray-400 shrink-0">{fmtDate(i.due_date)}</span>}
                <span className="flex -space-x-1 shrink-0">
                  {(i.assignees ?? []).slice(0, 3).map(a => <Avatar key={a.id} name={a.name} size={5} />)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
