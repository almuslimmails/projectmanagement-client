'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, type DragStartEvent, type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Issue, State, Project } from '@/lib/types'
import { StateIcon } from '@/components/ui/StateIcon'
import { PriorityIcon } from '@/components/ui/PriorityIcon'
import { Avatar } from '@/components/ui/Avatar'
import AvatarStack from '@/components/ui/AvatarStack'
import LabelPicker from '@/components/ui/LabelPicker'
import type { Label } from '@/lib/types'
import { fmtDate, formatIssueCode, isOverdue, overdueDuration, ISSUE_TYPE_CONFIG } from '@/lib/utils'

// Prefix column drag IDs so we can tell them apart from issue drags inside the shared DndContext.
const COL_PREFIX = 'col:'

interface Props {
  issues: Issue[]
  states: State[]
  labels: Label[]
  project: Project
  /** True when the current user can inline-edit on cards (owner/admin/manager). */
  canEdit?: boolean
  onClickIssue: (issue: Issue) => void
  onMoveIssue: (issueId: string, stateId: string) => void
  onCreateIssue: (stateId: string) => void
  onReorderStates?: (orderedIds: string[]) => void
  onUpdateIssue?: (issueId: string, patch: { label_ids?: string[] }) => void
}

function IssueCard({ issue, project, allLabels, canEdit, subIssues = [], onClick, onClickSubIssue, onLabelsChange }: {
  issue: Issue; project: Project; allLabels: Label[]
  canEdit?: boolean
  subIssues?: Issue[]
  onClick: () => void
  onClickSubIssue?: (i: Issue) => void
  onLabelsChange?: (ids: string[]) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id })
  const overdue = isOverdue(issue.due_date) && issue.state?.group_type !== 'completed'
  const selectedIds = issue.labels.map(l => l.id)
  // Stop drag from starting when the user clicks a label or the picker.
  const stopDrag = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() }

  // Inline edit lives behind a double-click for privileged users.
  // Single-click → open detail (delayed 200ms so dblclick can pre-empt it).
  const [editing, setEditing] = useState(false)
  const editable = !!canEdit && !!onLabelsChange
  const cardRef = useRef<HTMLDivElement | null>(null)
  const clickTimerRef = useRef<number | null>(null)

  function handleClick(e: React.MouseEvent) {
    if (editing) return
    if (clickTimerRef.current !== null) return
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null
      onClick()
    }, 200)
  }
  function handleDoubleClick(e: React.MouseEvent) {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    if (editable) setEditing(true)
  }

  // Exit edit mode on outside click or Esc.
  useEffect(() => {
    if (!editing) return
    const onDown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setEditing(false)
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
      ref={node => { setNodeRef(node); cardRef.current = node }}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title={editable && !editing ? 'Double-click to edit' : ''}
      className={`relative bg-white rounded-lg overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(99,102,241,0.2)] hover:-translate-y-0.5 cursor-pointer group transition-all select-none ${editing ? 'ring-2 ring-indigo-500 shadow-lg' : ''}`}
    >
      {/* GitLab-style accent strip in the state's color */}
      {issue.state?.color && (
        <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: issue.state.color }} />
      )}
      <div className="pl-4 pr-3.5 py-3.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px]" title={ISSUE_TYPE_CONFIG[issue.type ?? 'issue'].label}>{ISSUE_TYPE_CONFIG[issue.type ?? 'issue'].icon}</span>
        <PriorityIcon priority={issue.priority} size={12} />
        <span className="text-[10px] font-mono font-semibold text-gray-400 shrink-0 tracking-wider">{project.identifier}-{formatIssueCode(issue)}</span>
        <span className="flex-1" />
        {issue.assignees?.length > 0 && <AvatarStack members={issue.assignees} size={5} />}
      </div>
      <p className={`text-[15px] font-semibold leading-snug mb-2.5 ${issue.state?.group_type === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
        {issue.title}
      </p>
      {/* Milestone + Epic chips */}
      {(issue.milestone || issue.epic) && (
        <div className="flex flex-wrap items-center gap-1 mb-1.5">
          {issue.milestone && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-violet-50 text-violet-700 inline-flex items-center gap-1" title={`Milestone: ${issue.milestone.name}`}>
              🎯 <span className="truncate max-w-[120px]">{issue.milestone.name}</span>
            </span>
          )}
          {issue.epic && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-sky-50 text-sky-700 inline-flex items-center gap-1" title={`Epic: ${issue.epic.name}`}>
              📦 <span className="truncate max-w-[120px]">{issue.epic.name}</span>
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 mb-2">
        {issue.labels.map(l => (
          editing ? (
            <button
              key={l.id}
              {...stopDrag}
              onClick={e => { e.stopPropagation(); onLabelsChange?.(selectedIds.filter(id => id !== l.id)) }}
              title={`Click to remove "${l.name}"`}
              className="text-[10px] px-2 py-0.5 rounded-full font-medium hover:ring-1 hover:ring-current/40 transition-all"
              style={{ backgroundColor: l.color + '22', color: l.color }}
            >
              {l.name}
            </button>
          ) : (
            <span
              key={l.id}
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: l.color + '22', color: l.color }}
            >
              {l.name}
            </span>
          )
        ))}
        {editing && onLabelsChange && (
          <span {...stopDrag}>
            <LabelPicker
              labels={allLabels}
              selectedIds={selectedIds}
              onChange={onLabelsChange}
              hideSelected
            />
          </span>
        )}
      </div>
      {(issue.due_date || overdue) && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100">
          {overdue ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-700">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Overdue · {overdueDuration(issue.due_date)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              {fmtDate(issue.due_date)}
            </span>
          )}
        </div>
      )}

      {/* Nested sub-issues (Jira-style) — clicking one opens its own detail */}
      {subIssues.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Sub-issues · {subIssues.length}
          </p>
          {subIssues.map(sub => (
            <button
              key={sub.id}
              {...stopDrag}
              onClick={e => { e.stopPropagation(); onClickSubIssue?.(sub) }}
              className="w-full flex items-center gap-1.5 text-left rounded px-1 py-1 hover:bg-indigo-50/60 transition-colors"
            >
              <span className="text-[10px] shrink-0" title={ISSUE_TYPE_CONFIG[sub.type ?? 'subtask'].label}>{ISSUE_TYPE_CONFIG[sub.type ?? 'subtask'].icon}</span>
              <StateIcon state={sub.state} size={11} />
              <span className="text-[9px] font-mono text-gray-400 shrink-0">{project.identifier}-{formatIssueCode(sub)}</span>
              <span className={`text-[11px] truncate flex-1 ${sub.state?.group_type === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>{sub.title}</span>
              {sub.assignees?.length > 0 && <AvatarStack members={sub.assignees} size={4} />}
            </button>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}

function Column({ state, issues, childrenByParent, project, allLabels, canEdit, onClickIssue, onCreateIssue, onLabelsChange }: {
  state: State; issues: Issue[]; childrenByParent: Record<string, Issue[]>; project: Project; allLabels: Label[]
  canEdit?: boolean
  onClickIssue: (i: Issue) => void; onCreateIssue: () => void
  onLabelsChange?: (issueId: string, ids: string[]) => void
}) {
  // Each column is sortable using a dedicated COL_PREFIX id so it doesn't collide with issue cards.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: COL_PREFIX + state.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex flex-col w-72 shrink-0"
    >
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-2">
        <button
          {...attributes}
          {...listeners}
          title="Drag to reorder column"
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 -ml-1 p-0.5"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
          </svg>
        </button>
        <StateIcon state={state} size={14} />
        <span className="text-sm font-semibold text-gray-800">{state.name}</span>
        <span className="text-[10px] font-bold tabular-nums text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full ml-0.5">{issues.length}</span>
        <button onClick={onCreateIssue} className="ml-auto text-gray-300 hover:text-indigo-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
          </svg>
        </button>
      </div>

      {/* Cards */}
      <SortableContext items={issues.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 min-h-[60px] p-2 rounded-2xl bg-gray-50 ring-1 ring-gray-100 flex-1">
          {issues.map(issue => (
            <IssueCard
              key={issue.id}
              issue={issue}
              project={project}
              allLabels={allLabels}
              canEdit={canEdit}
              subIssues={childrenByParent[issue.id] ?? []}
              onClick={() => onClickIssue(issue)}
              onClickSubIssue={onClickIssue}
              onLabelsChange={onLabelsChange ? ids => onLabelsChange(issue.id, ids) : undefined}
            />
          ))}
          {issues.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-8">
              <p className="text-xs text-gray-300">No issues</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export default function BoardView({ issues, states, labels, project, canEdit, onClickIssue, onMoveIssue, onCreateIssue, onReorderStates, onUpdateIssue }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  // Local order overrides props until the parent refetches — so the drag feels instant.
  const [localOrder, setLocalOrder] = useState<string[] | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const orderedStates = localOrder
    ? localOrder.map(id => states.find(s => s.id === id)!).filter(Boolean)
    : states
  const activeIssue = issues.find(i => i.id === activeId)

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string)
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Column drag — both ids are prefixed with COL_PREFIX.
    if (activeId.startsWith(COL_PREFIX) && overId.startsWith(COL_PREFIX)) {
      const ids = orderedStates.map(s => s.id)
      const oldIdx = ids.indexOf(activeId.slice(COL_PREFIX.length))
      const newIdx = ids.indexOf(overId.slice(COL_PREFIX.length))
      if (oldIdx < 0 || newIdx < 0) return
      const next = arrayMove(ids, oldIdx, newIdx)
      setLocalOrder(next)  // optimistic
      onReorderStates?.(next)
      return
    }

    // Issue drag → move card to a different state.
    const issue = issues.find(i => i.id === activeId)
    if (!issue) return
    const overIssue = issues.find(i => i.id === overId)
    // When dropping onto empty column space, over.id is the column id (COL_PREFIX + stateId).
    // Strip the prefix so we send the actual state id, not "col:<id>".
    const targetStateId = overIssue
      ? overIssue.state_id
      : (overId.startsWith(COL_PREFIX) ? overId.slice(COL_PREFIX.length) : overId)
    // Defensive: only emit a move for a state that actually belongs to this project's columns.
    if (targetStateId && targetStateId !== issue.state_id && states.some(s => s.id === targetStateId)) {
      onMoveIssue(issue.id, targetStateId)
    }
  }

  // Jira-style nesting: only top-level issues become column cards; each card lists its
  // direct sub-issues beneath it (regardless of the sub-issue's own state).
  const childrenByParent = useMemo(() => {
    const map: Record<string, Issue[]> = {}
    for (const i of issues) if (i.parent_id) (map[i.parent_id] ??= []).push(i)
    return map
  }, [issues])
  const byState = (stateId: string) => issues.filter(i => i.state_id === stateId && !i.parent_id)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedStates.map(s => COL_PREFIX + s.id)} strategy={horizontalListSortingStrategy}>
        <div className="flex gap-5 overflow-x-auto p-6 h-full items-start">
          {orderedStates.map(state => (
            <Column
              key={state.id}
              state={state}
              issues={byState(state.id)}
              childrenByParent={childrenByParent}
              project={project}
              allLabels={labels}
              canEdit={canEdit}
              onClickIssue={onClickIssue}
              onCreateIssue={() => onCreateIssue(state.id)}
              onLabelsChange={onUpdateIssue ? (id, ids) => onUpdateIssue(id, { label_ids: ids }) : undefined}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeIssue && (
          <div className="bg-white border border-indigo-300 rounded-lg p-3 shadow-2xl w-72 rotate-1">
            <p className="text-sm font-medium text-gray-800">{activeIssue.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
