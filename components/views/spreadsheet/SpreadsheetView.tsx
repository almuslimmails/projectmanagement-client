'use client'
import { useState } from 'react'
import type { Issue, State, Label, Member, Project } from '@/lib/types'
import { StateIcon } from '@/components/ui/StateIcon'
import { PriorityIcon } from '@/components/ui/PriorityIcon'
import { Avatar } from '@/components/ui/Avatar'
import AvatarStack from '@/components/ui/AvatarStack'
import { ISSUE_TYPE_CONFIG, PRIORITY_CONFIG, fmtDate, formatIssueCode, isOverdue } from '@/lib/utils'

interface Props {
  issues: Issue[]
  states: State[]
  labels: Label[]
  members: Member[]
  project: Project
  onClickIssue: (issue: Issue) => void
  onUpdateIssue: (id: string, patch: Partial<Issue>) => void
  onCreateIssue: () => void
}

const COLS = ['Type', 'State', 'Priority', 'Title', 'Assignee', 'Labels', 'Start date', 'Due date', 'Estimate', 'Created At', 'Created By']
// Columns that are click-to-sort. Created By isn't useful to sort on, so it's read-only.
const SORTABLE = ['Type','Priority','Title','Start date','Due date','Estimate','Created At']

// Stable sort order for the Type column (groups milestones first, subtasks last).
const TYPE_RANK: Record<string, number> = { milestone: 0, task: 1, issue: 2, enhancement: 3, subtask: 4 }

export default function SpreadsheetView({ issues, states, labels, members, project, onClickIssue, onUpdateIssue, onCreateIssue }: Props) {
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null)

  function toggleSort(col: string) {
    if (sort?.col === col) {
      setSort(sort.dir === 'asc' ? { col, dir: 'desc' } : null)
    } else {
      setSort({ col, dir: 'asc' })
    }
  }

  const sorted = [...issues].sort((a, b) => {
    if (!sort) return 0
    let av: any, bv: any
    switch (sort.col) {
      case 'Type': {
        av = TYPE_RANK[a.type ?? 'issue'] ?? 99
        bv = TYPE_RANK[b.type ?? 'issue'] ?? 99
        break
      }
      case 'Priority': {
        const order = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 }
        av = order[a.priority]; bv = order[b.priority]; break
      }
      case 'Start date': av = a.start_date ?? ''; bv = b.start_date ?? ''; break
      case 'Due date': av = a.due_date ?? ''; bv = b.due_date ?? ''; break
      case 'Estimate': av = a.estimate ?? -1; bv = b.estimate ?? -1; break
      case 'Created At': av = a.created_at; bv = b.created_at; break
      default: av = a.title.toLowerCase(); bv = b.title.toLowerCase()
    }
    if (av < bv) return sort.dir === 'asc' ? -1 : 1
    if (av > bv) return sort.dir === 'asc' ? 1 : -1
    return 0
  })

  function SortIcon({ col }: { col: string }) {
    if (sort?.col !== col) return <svg className="w-3 h-3 opacity-0 group-hover:opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
    return sort.dir === 'asc'
      ? <svg className="w-3 h-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg>
      : <svg className="w-3 h-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[900px]">
        {/* Toolbar — count only; the global "+ New issue" lives in the project header */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-white sticky top-0 z-20">
          <span className="text-sm text-gray-500">{issues.length} issues</span>
        </div>

        {/* Table */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="w-8 px-3 py-2 text-left"></th>
              {COLS.map(col => {
                const sortable = SORTABLE.includes(col)
                return (
                  <th key={col}
                    onClick={() => sortable && toggleSort(col)}
                    className={`px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide group ${sortable ? 'cursor-pointer hover:bg-gray-100' : ''}`}>
                    <span className="flex items-center gap-1">
                      {col}
                      {sortable && <SortIcon col={col} />}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((issue, idx) => {
              const overdue = isOverdue(issue.due_date) && issue.state?.group_type !== 'completed'
              return (
                <tr key={issue.id} className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${idx % 2 === 0 ? '' : 'bg-white'}`}
                  onClick={() => onClickIssue(issue)}>
                  <td className="px-3 py-2 text-xs font-mono text-gray-400 whitespace-nowrap">
                    {project.identifier}-{formatIssueCode(issue)}
                  </td>
                  <td className="px-3 py-2">
                    {(() => {
                      const t = ISSUE_TYPE_CONFIG[issue.type ?? 'issue']
                      return (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
                          style={{ backgroundColor: t.color + '20', color: t.color }}
                          title={t.label}>
                          <span aria-hidden>{t.icon}</span>{t.label}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <StateIcon state={issue.state} size={13} />
                      <span className="text-xs text-gray-600">{issue.state?.name ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <PriorityIcon priority={issue.priority} size={12} />
                      <span className="text-xs text-gray-600">{PRIORITY_CONFIG[issue.priority]?.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 max-w-[300px]">
                    <span className={`text-sm truncate block ${issue.state?.group_type === 'completed' ? 'line-through text-gray-400' : 'text-gray-800 font-medium'}`}>
                      {issue.title}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {issue.assignees?.length
                      ? <div className="flex items-center gap-1.5">
                          <AvatarStack members={issue.assignees} size={5} />
                          <span className="text-xs text-gray-600 truncate">
                            {issue.assignees.length === 1
                              ? issue.assignees[0].name
                              : `${issue.assignees.length} people`}
                          </span>
                        </div>
                      : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {issue.labels.map(l => (
                        <span key={l.id} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: l.color + '20', color: l.color }}>{l.name}</span>
                      ))}
                      {!issue.labels.length && <span className="text-xs text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-gray-500">{issue.start_date ? fmtDate(issue.start_date) : '—'}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                      {issue.due_date ? fmtDate(issue.due_date) : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-gray-500">{issue.estimate ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-gray-400">{fmtDate(issue.created_at)}</span>
                  </td>
                  <td className="px-3 py-2">
                    {issue.creator
                      ? <span className="text-xs text-gray-600 truncate inline-block max-w-[140px]">{issue.creator.name}</span>
                      : <span className="text-xs text-gray-400 italic">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {issues.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <svg className="w-12 h-12 text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <p className="text-gray-400 text-sm">No issues yet</p>
            <button onClick={onCreateIssue} className="mt-3 text-sm text-indigo-600 hover:underline">Create your first issue</button>
          </div>
        )}
      </div>
    </div>
  )
}
