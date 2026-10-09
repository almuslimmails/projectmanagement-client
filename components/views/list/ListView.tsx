'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Issue, State, Project, Label, Member } from '@/lib/types'
import { StateIcon } from '@/components/ui/StateIcon'
import { PriorityIcon } from '@/components/ui/PriorityIcon'
import { Avatar } from '@/components/ui/Avatar'
import AvatarStack from '@/components/ui/AvatarStack'
import LabelPicker from '@/components/ui/LabelPicker'
import IssueFilterBar, { type IssueFilters } from '@/components/issue/IssueFilterBar'
import { fmtDate, formatIssueCode, isOverdue, ISSUE_TYPE_CONFIG, overdueDuration, PRIORITY_CONFIG, relTime } from '@/lib/utils'

interface Props {
  issues: Issue[]
  states: State[]
  labels: Label[]
  members: Member[]
  milestones: { id: string; name: string }[]
  epics: { id: string; name: string }[]
  project: Project
  canEdit?: boolean
  filters: IssueFilters
  onFiltersChange: (f: IssueFilters) => void
  totalCount: number
  onClickIssue: (issue: Issue) => void
  onCreateIssue: (stateId?: string) => void
  onUpdateIssue?: (issueId: string, patch: { label_ids?: string[] }) => void
  onExport?: () => void
}

// One source of truth for the table's column widths — header + every row share it.
// Type | State | Priority | Title (flex) | Assignee | Labels | Start date | Due date | Estimate | Created At | Created By
const GRID_COLS = 'grid-cols-[110px_130px_100px_minmax(200px,1fr)_100px_minmax(150px,200px)_110px_110px_70px_110px_140px]'

const PRIO_RANK: Record<string, number> = { urgent: 1, high: 2, medium: 3, low: 4, none: 5 }

// Filtering + sorting happens here on the client. `issues` is the full unfiltered set,
// so the Board (which renders the same array) is never affected by Issues-view filters.
function applyFilters(issues: Issue[], f: IssueFilters): Issue[] {
  let list = issues
  if (f.search) { const q = f.search.toLowerCase(); list = list.filter(i => i.title.toLowerCase().includes(q)) }
  if (f.state_id) list = list.filter(i => i.state_id === f.state_id)
  if (f.priority) list = list.filter(i => i.priority === f.priority)
  if (f.type) list = list.filter(i => (i.type ?? 'issue') === f.type)
  if (f.assignee_id) list = list.filter(i => i.assignees?.some(a => a.id === f.assignee_id))
  if (f.label_id) list = list.filter(i => i.labels?.some(l => l.id === f.label_id))
  if (f.milestone_id) list = list.filter(i => i.milestone?.id === f.milestone_id)
  if (f.epic_id) list = list.filter(i => i.epic?.id === f.epic_id)

  const cmpDate = (a?: string | null, b?: string | null) => {
    if (!a && !b) return 0
    if (!a) return 1   // nulls last
    if (!b) return -1
    return a.localeCompare(b)
  }
  const sorted = [...list]
  switch (f.sort) {
    case 'recent':   sorted.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')); break
    case 'oldest':   sorted.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')); break
    case 'updated':  sorted.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')); break
    case 'priority': sorted.sort((a, b) => (PRIO_RANK[a.priority] - PRIO_RANK[b.priority]) || (b.sequence_id - a.sequence_id)); break
    case 'due_asc':  sorted.sort((a, b) => cmpDate(a.due_date, b.due_date)); break
    case 'due_desc': sorted.sort((a, b) => cmpDate(b.due_date, a.due_date)); break
    case 'seq_asc':  sorted.sort((a, b) => a.sequence_id - b.sequence_id); break
    default:         sorted.sort((a, b) => b.sequence_id - a.sequence_id)
  }
  return sorted
}

export default function ListView({ issues, states, labels, members, milestones, epics, project, canEdit, filters, onFiltersChange, totalCount, onClickIssue, onCreateIssue, onUpdateIssue, onExport }: Props) {
  const visible = useMemo(() => applyFilters(issues, filters), [issues, filters])

  return (
    <div className="flex-1 overflow-y-auto">
      <IssueFilterBar
        filters={filters}
        onChange={onFiltersChange}
        total={issues.length}
        shown={visible.length}
        states={states}
        labels={labels}
        members={members}
        milestones={milestones}
        epics={epics}
        onExport={onExport}
      />

      {/* Table header — sticky under the filter bar */}
      <div className={`grid ${GRID_COLS} gap-3 items-center px-5 py-2 border-b border-gray-200 bg-gray-50 sticky top-[97px] z-10 text-[10px] font-bold tracking-widest text-gray-500 uppercase`}>
        <span>Type</span>
        <span>State</span>
        <span>Priority</span>
        <span>Title</span>
        <span>Assignee</span>
        <span>Labels</span>
        <span>Start date</span>
        <span>Due date</span>
        <span>Estimate</span>
        <span>Created At</span>
        <span>Created By</span>
      </div>

      {visible.map(issue => (
        <IssueTableRow
          key={issue.id}
          issue={issue}
          project={project}
          labels={labels}
          canEdit={canEdit}
          onClick={() => onClickIssue(issue)}
          onLabelsChange={onUpdateIssue ? ids => onUpdateIssue(issue.id, { label_ids: ids }) : undefined}
        />
      ))}

      {visible.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-gray-400">No issues match your filters</p>
        </div>
      )}

      <div className="px-5 py-3 border-t border-gray-100 bg-white">
        <button onClick={() => onCreateIssue()}
          className="flex items-center gap-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          New issue
        </button>
      </div>
    </div>
  )
}

// ─── Single row in the columnar issue table ─────────────────────────────────

function IssueTableRow({ issue, project, labels, canEdit, onClick, onLabelsChange }: {
  issue: Issue
  project: Project
  labels: Label[]
  canEdit?: boolean
  onClick: () => void
  onLabelsChange?: (ids: string[]) => void
}) {
  const overdue = isOverdue(issue.due_date) && issue.state?.group_type !== 'completed'
  const overdueBy = overdue ? overdueDuration(issue.due_date) : null
  const selectedIds = issue.labels.map(l => l.id)
  const stopRow = (e: React.MouseEvent) => e.stopPropagation()

  // Same dbl-click edit gate used in the board cards.
  const [editing, setEditing] = useState(false)
  const editable = !!canEdit && !!onLabelsChange
  const rowRef = useRef<HTMLDivElement | null>(null)
  const clickTimerRef = useRef<number | null>(null)
  function handleClick() {
    if (editing) return
    if (clickTimerRef.current !== null) return
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null
      onClick()
    }, 200)
  }
  function handleDoubleClick() {
    if (clickTimerRef.current !== null) { window.clearTimeout(clickTimerRef.current); clickTimerRef.current = null }
    if (editable) setEditing(true)
  }
  useEffect(() => {
    if (!editing) return
    const onDown = (e: MouseEvent) => { if (rowRef.current && !rowRef.current.contains(e.target as Node)) setEditing(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditing(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [editing])
  useEffect(() => { if (!editable && editing) setEditing(false) }, [editable])

  const isDone = issue.state?.group_type === 'completed'
  const priorityCfg = PRIORITY_CONFIG[issue.priority]

  return (
    <div
      ref={rowRef}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title={editable && !editing ? 'Double-click to edit' : ''}
      className={`relative grid ${GRID_COLS} gap-3 items-center px-5 py-3 border-b border-gray-100 cursor-pointer transition-colors group ${editing ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-300' : 'hover:bg-gray-50'}`}
    >
      {/* State-color accent on the left edge (GitLab) */}
      {issue.state?.color && (
        <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: issue.state.color }} />
      )}

      {/* Type */}
      <div className="min-w-0">
        {(() => {
          const t = ISSUE_TYPE_CONFIG[issue.type ?? 'issue']
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: t.color + '20', color: t.color }}
              title={t.label}>
              <span aria-hidden>{t.icon}</span>{t.label}
            </span>
          )
        })()}
      </div>

      {/* State */}
      <div className="flex items-center gap-1.5 min-w-0">
        <StateIcon state={issue.state} size={13} />
        <span className="text-xs text-gray-700 truncate">{issue.state?.name ?? '—'}</span>
      </div>

      {/* Priority */}
      <div className="flex items-center gap-1.5 min-w-0">
        <PriorityIcon priority={issue.priority} size={12} />
        <span className="text-xs text-gray-700 truncate">{priorityCfg.label}</span>
      </div>

      {/* Title */}
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[10px] font-mono font-semibold text-gray-400 tracking-wider mb-0.5">
          {project.identifier}-{formatIssueCode(issue)}
          {issue.milestone && <span className="text-violet-600 font-sans font-medium normal-case tracking-normal truncate max-w-[100px]" title={issue.milestone.name}>🎯 {issue.milestone.name}</span>}
          {issue.epic && <span className="text-sky-600 font-sans font-medium normal-case tracking-normal truncate max-w-[100px]" title={issue.epic.name}>📦 {issue.epic.name}</span>}
        </p>
        <p className={`text-sm truncate ${isDone ? 'line-through text-gray-400' : 'text-gray-900 font-semibold'}`}>{issue.title}</p>
      </div>

      {/* Assignee */}
      <div className="flex items-center min-w-0">
        {issue.assignees?.length > 0
          ? <AvatarStack members={issue.assignees} size={5} />
          : <span className="text-[11px] text-gray-300">—</span>}
      </div>

      {/* Labels */}
      <div className="flex flex-wrap items-center gap-1 min-w-0">
        {issue.labels.length === 0 && !editing && <span className="text-[11px] text-gray-300">—</span>}
        {issue.labels.map(l => (
          editing && onLabelsChange ? (
            <button key={l.id}
              onClick={e => { stopRow(e); onLabelsChange(selectedIds.filter(id => id !== l.id)) }}
              title={`Click to remove "${l.name}"`}
              className="text-[10px] px-2 py-0.5 rounded-full font-medium hover:ring-1 hover:ring-current/40 transition-all"
              style={{ backgroundColor: l.color + '22', color: l.color }}
            >{l.name}</button>
          ) : (
            <span key={l.id}
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: l.color + '22', color: l.color }}
            >{l.name}</span>
          )
        ))}
        {editing && labels && onLabelsChange && (
          <span onClick={stopRow}>
            <LabelPicker labels={labels} selectedIds={selectedIds} onChange={onLabelsChange} hideSelected align="right" />
          </span>
        )}
      </div>

      {/* Start date */}
      <div className="min-w-0">
        {issue.start_date
          ? <span className="text-xs text-gray-600">{fmtDate(issue.start_date)}</span>
          : <span className="text-[11px] text-gray-300">—</span>}
      </div>

      {/* Due date */}
      <div className="min-w-0">
        {issue.due_date ? (
          overdue ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-700" title={`Due ${fmtDate(issue.due_date)} — overdue by ${overdueBy}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {overdueBy}
            </span>
          ) : (
            <span className="text-xs text-gray-600">{fmtDate(issue.due_date)}</span>
          )
        ) : <span className="text-[11px] text-gray-300">—</span>}
      </div>

      {/* Estimate */}
      <div className="text-xs text-gray-700 tabular-nums">
        {issue.estimate ?? <span className="text-[11px] text-gray-300">—</span>}
      </div>

      {/* Created At */}
      <div className="min-w-0" title={fmtDate(issue.created_at) ?? ''}>
        <span className="text-[11px] text-gray-500 truncate block">{relTime(issue.created_at)}</span>
      </div>

      {/* Created By */}
      <div className="flex items-center gap-1.5 min-w-0">
        {issue.creator
          ? <>
              <Avatar name={issue.creator.name} size={4} />
              <span className="text-[11px] text-gray-600 truncate">{issue.creator.name}</span>
            </>
          : <span className="text-[11px] text-gray-300 italic">Unknown</span>}
      </div>
    </div>
  )
}
