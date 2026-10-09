'use client'
import { useState } from 'react'
import type { State, Label, Member, IssueType } from '@/lib/types'
import { PRIORITY_CONFIG, ISSUE_TYPE_CONFIG, PRIMARY_ISSUE_TYPES, canManageDates } from '@/lib/utils'
import AssigneePicker from '@/components/ui/AssigneePicker'

export interface CreateIssuePayload {
  title: string; description: string; state_id: string; priority: string
  assignee_ids: string[]; label_ids: string[]; start_date: string; due_date: string; estimate: string
  type: IssueType; parent_id?: string
}

interface Props {
  states: State[]
  labels: Label[]
  members: Member[]
  currentMember?: Member | null
  defaultStateId?: string
  defaultType?: IssueType
  parentId?: string
  parentLabel?: string
  onClose: () => void
  onCreate: (data: CreateIssuePayload) => void
}

export default function CreateIssueModal({ states, labels, members, currentMember, defaultStateId, defaultType, parentId, parentLabel, onClose, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stateId, setStateId] = useState(defaultStateId ?? states[0]?.id ?? '')
  const [type, setType] = useState<IssueType>(defaultType ?? (parentId ? 'subtask' : 'issue'))
  const [priority, setPriority] = useState('none')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [estimate, setEstimate] = useState('')
  const canEditDates = canManageDates(currentMember)
  const lockTitle = canEditDates ? '' : 'Only owners, admins, or project managers can set dates.'

  // Only owners choose the type explicitly. Non-owners take the sensible
  // default (subtask under a parent, otherwise bug) — the modal doesn't even
  // show them the picker.
  const canPickType = currentMember?.role === 'owner' && !parentId
  const typeCfg = ISSUE_TYPE_CONFIG[type]

  function toggleLabel(id: string) {
    setSelectedLabels(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id])
  }

  function submit() {
    if (!title.trim()) return
    onCreate({ title: title.trim(), description, state_id: stateId, priority, assignee_ids: assigneeIds, label_ids: selectedLabels, start_date: canEditDates ? startDate : '', due_date: canEditDates ? dueDate : '', estimate, type, parent_id: parentId })
  }

  return (
    // Right-side drawer, half-viewport wide (matches the IssueDetail task view).
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto flex flex-col bg-white shadow-2xl h-full w-full md:w-[50vw] md:min-w-[640px] max-w-[900px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b shrink-0">
          <div>
            <h2 className="font-semibold text-gray-800">
              {parentId ? 'Create sub-issue' : 'Create issue'}
            </h2>
            {parentLabel && (
              <p className="text-xs text-gray-500 mt-0.5">under <span className="font-mono">{parentLabel}</span></p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body — the description flexes to fill the drawer's height */}
        <div className="p-8 flex flex-col gap-5 flex-1 min-h-0 overflow-y-auto">
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full text-2xl font-semibold text-gray-900 border-0 focus:outline-none placeholder-gray-300 tracking-tight"
            onKeyDown={e => e.key === 'Enter' && submit()}
          />
          <div className="flex flex-col flex-1 min-h-0">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Description <span className="ml-1 normal-case tracking-normal text-gray-300 text-[10px]">markdown supported</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add a description. What's the problem, the expected behaviour, screenshots, links…"
              className="w-full flex-1 min-h-[320px] text-sm text-gray-700 border rounded-lg p-4 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 leading-relaxed font-normal"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {canPickType && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Type <span className="ml-1 text-[9px] font-bold tracking-widest text-indigo-600">OWNER</span>
                </label>
                <select value={type} onChange={e => setType(e.target.value as IssueType)}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                  {PRIMARY_ISSUE_TYPES.map(k => {
                    const v = ISSUE_TYPE_CONFIG[k]
                    return <option key={k} value={k}>{v.icon} {v.label}</option>
                  })}
                </select>
              </div>
            )}
            {!canPickType && (
              // Non-owners see the type as a read-only chip so they know what
              // they're about to create, without the picker itself.
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Type</label>
                <div className="flex items-center gap-2 text-sm border rounded-lg px-3 py-2 bg-gray-50 text-gray-600">
                  <span aria-hidden>{typeCfg.icon}</span>
                  <span className="font-medium" style={{ color: typeCfg.color }}>{typeCfg.label}</span>
                  <span className="ml-auto text-[10px] text-gray-400">default</span>
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">State</label>
              <select value={stateId} onChange={e => setStateId(e.target.value)}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Assignees{assigneeIds.length > 0 && <span className="ml-1 text-gray-400 normal-case">({assigneeIds.length})</span>}
              </label>
              <AssigneePicker members={members} selectedIds={assigneeIds} onChange={setAssigneeIds} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Start date {!canEditDates && '🔒'}
              </label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                disabled={!canEditDates} title={lockTitle}
                className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${!canEditDates ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Due date {!canEditDates && '🔒'}
              </label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                disabled={!canEditDates} title={lockTitle}
                className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${!canEditDates ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Estimate (pts)</label>
              <input type="number" value={estimate} onChange={e => setEstimate(e.target.value)}
                placeholder="0"
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
          </div>

          {labels.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Labels</label>
              <div className="flex flex-wrap gap-2">
                {labels.map(l => (
                  <button key={l.id} onClick={() => toggleLabel(l.id)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${selectedLabels.includes(l.id) ? 'border-transparent' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                    style={selectedLabels.includes(l.id) ? { backgroundColor: l.color + '20', color: l.color, borderColor: l.color + '40' } : {}}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-8 py-4 border-t bg-gray-50 shrink-0">
          <button onClick={onClose} className="text-sm text-gray-600 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={!title.trim()}
            className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 rounded-lg transition-colors font-medium">
            Create issue
          </button>
        </div>
      </div>
    </div>
  )
}
