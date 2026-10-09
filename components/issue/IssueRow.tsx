'use client'
import { useEffect, useRef, useState } from 'react'
import type { Issue, Label } from '@/lib/types'
import { StateIcon } from '@/components/ui/StateIcon'
import { PriorityIcon } from '@/components/ui/PriorityIcon'
import AvatarStack from '@/components/ui/AvatarStack'
import LabelPicker from '@/components/ui/LabelPicker'
import { fmtDate, formatIssueCode, isOverdue, overdueDuration, ISSUE_TYPE_CONFIG } from '@/lib/utils'

interface Props {
  issue: Issue
  projectIdentifier: string
  onClick: () => void
  compact?: boolean
  labels?: Label[]
  canEdit?: boolean
  onLabelsChange?: (ids: string[]) => void
}

export default function IssueRow({ issue, projectIdentifier, onClick, compact, labels, canEdit, onLabelsChange }: Props) {
  const overdue = isOverdue(issue.due_date) && issue.state?.group_type !== 'completed'
  const overdueBy = overdue ? overdueDuration(issue.due_date) : null
  const typeCfg = ISSUE_TYPE_CONFIG[issue.type ?? 'issue']
  const selectedIds = issue.labels.map(l => l.id)
  const stopRow = (e: React.MouseEvent) => e.stopPropagation()
  // Inline edit gated behind double-click for privileged users only.
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
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    if (editable) setEditing(true)
  }
  useEffect(() => {
    if (!editing) return
    const onDown = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) setEditing(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditing(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [editing])
  // Drop edit mode immediately if the signed-in user loses privileges.
  useEffect(() => { if (!editable && editing) setEditing(false) }, [editable])

  return (
    <div
      ref={rowRef}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title={editable && !editing ? 'Double-click to edit' : ''}
      className={`relative flex items-center gap-3 pl-5 pr-4 ${compact ? 'py-2.5' : 'py-3'} cursor-pointer border-b border-gray-100 group transition-colors ${editing ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-300' : 'hover:bg-gray-50'}`}>
      {/* GitLab-style state color accent on the left edge */}
      {issue.state?.color && (
        <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: issue.state.color }} />
      )}
      <span className="text-xs shrink-0" title={typeCfg.label}>{typeCfg.icon}</span>
      <StateIcon state={issue.state} size={15} />
      <PriorityIcon priority={issue.priority} size={13} />
      <span className="text-[11px] text-gray-400 font-mono font-semibold shrink-0 tracking-wider">{projectIdentifier}-{formatIssueCode(issue)}</span>
      <span className={`flex-1 text-[14px] truncate ${issue.state?.group_type === 'completed' ? 'line-through text-gray-400' : 'text-gray-900 font-semibold'}`}>{issue.title}</span>

      {/* Milestone + Epic chips */}
      {issue.milestone && (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-violet-50 text-violet-700 inline-flex items-center gap-1 shrink-0" title={`Milestone: ${issue.milestone.name}`}>
          🎯 <span className="truncate max-w-[80px]">{issue.milestone.name}</span>
        </span>
      )}
      {issue.epic && (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-sky-50 text-sky-700 inline-flex items-center gap-1 shrink-0" title={`Epic: ${issue.epic.name}`}>
          📦 <span className="truncate max-w-[80px]">{issue.epic.name}</span>
        </span>
      )}

      {/* Labels — read-only by default, click-to-remove only when in edit mode (dbl-click) */}
      {issue.labels.map(l => (
        editing && onLabelsChange ? (
          <button
            key={l.id}
            onClick={e => { stopRow(e); onLabelsChange(selectedIds.filter(id => id !== l.id)) }}
            title={`Click to remove "${l.name}"`}
            className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 hover:ring-1 hover:ring-current/40 transition-all"
            style={{ backgroundColor: l.color + '22', color: l.color }}
          >{l.name}</button>
        ) : (
          <span key={l.id} className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
            style={{ backgroundColor: l.color + '22', color: l.color }}>{l.name}</span>
        )
      ))}
      {editing && labels && onLabelsChange && (
        <span onClick={stopRow} className="shrink-0">
          <LabelPicker
            labels={labels}
            selectedIds={selectedIds}
            onChange={onLabelsChange}
            hideSelected
            align="right"
          />
        </span>
      )}

      {/* Overdue pill */}
      {overdue && (
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 shrink-0"
          title={`Past due by ${overdueBy}`}>
          Overdue{overdueBy ? ` · ${overdueBy}` : ''}
        </span>
      )}

      {/* Due date */}
      {issue.due_date && (
        <span className={`text-[11px] shrink-0 ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>{fmtDate(issue.due_date)}</span>
      )}

      {/* Assignees (stacked avatars) */}
      {issue.assignees?.length > 0 && <AvatarStack members={issue.assignees} size={5} />}
    </div>
  )
}
