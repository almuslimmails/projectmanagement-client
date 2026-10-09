'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Issue, State, Label, Member, Project, ActivityEntry } from '@/lib/types'
import { StateIcon } from '@/components/ui/StateIcon'
import { PriorityIcon } from '@/components/ui/PriorityIcon'
import { Avatar } from '@/components/ui/Avatar'
import AssigneePicker from '@/components/ui/AssigneePicker'
import MarkdownView from '@/components/ui/MarkdownView'
import LinkAttachments from '@/components/issue/LinkAttachments'
import IssueWikiLinks from '@/components/issue/IssueWikiLinks'
import IssueComments from '@/components/issue/IssueComments'
import LabelPicker from '@/components/ui/LabelPicker'
import { PRIORITY_CONFIG, ISSUE_TYPE_CONFIG, fmtDate, formatIssueCode, isOverdue, overdueDuration, canManageDates, relTime } from '@/lib/utils'
import { api } from '@/lib/api'
import '@uiw/react-md-editor/markdown-editor.css'

// MDEditor uses window — load it client-only to avoid SSR mismatch.
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface Props {
  issue: Issue; project: Project; states: State[]; labels: Label[]; members: Member[]
  milestones?: { id: string; name: string }[]
  epics?: { id: string; name: string }[]
  currentMember?: Member | null
  onClose: () => void
  onUpdate: (patch: Partial<Issue> & { label_ids?: string[] }) => void
  onDelete: () => void
  onAddSubIssue?: () => void
  onClickSubIssue?: (sub: Issue) => void
  onSetMilestone?: (milestoneId: string | null) => void
  onSetEpic?: (epicId: string | null) => void
}

// Fields that participate in the buffered "Update" workflow. Milestone and
// epic have their own dedicated endpoints/callbacks — they still auto-save.
type BufferedKey =
  | 'title' | 'description' | 'state_id' | 'priority'
  | 'assignee_ids' | 'label_ids' | 'start_date' | 'due_date' | 'estimate'

// Human labels for the "N unsaved changes" footer bar.
const FIELD_LABELS_SHORT: Record<BufferedKey, string> = {
  title: 'title', description: 'description', state_id: 'state', priority: 'priority',
  assignee_ids: 'assignees', label_ids: 'labels',
  start_date: 'start date', due_date: 'due date', estimate: 'estimate',
}

// Read a field's baseline value from the server-supplied issue. For assignees
// and labels we return the id list — that's the shape the API accepts.
function originalFor(key: BufferedKey, issue: Issue): any {
  if (key === 'assignee_ids') return (issue.assignees ?? []).map(a => a.id)
  if (key === 'label_ids')    return (issue.labels ?? []).map(l => l.id)
  return (issue as any)[key] ?? null
}

// Cheap deep-equal for the shapes we store in `pending` — scalars, nulls, and
// id arrays. Falls back to strict equality if the shape is unexpected.
function isEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null || b == null) return a == null && b == null
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    const sa = [...a].sort(); const sb = [...b].sort()
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false
    return true
  }
  return false
}

export default function IssueDetail({ issue, project, states, labels, members, milestones = [], epics = [], currentMember, onClose, onUpdate, onDelete, onAddSubIssue, onClickSubIssue, onSetMilestone, onSetEpic }: Props) {
  const typeCfg = ISSUE_TYPE_CONFIG[issue.type ?? 'issue']
  const canEditDates = canManageDates(currentMember)
  const lockTitle = canEditDates ? '' : `Only owners, admins, or project managers can change dates. You are signed in as ${currentMember ? currentMember.role : 'no one'}.`
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState(issue.description) // draft while in MDEditor mode
  const [saving, setSaving] = useState(false)
  const [activity, setActivity] = useState<ActivityEntry[]>([])

  // ── Buffered field edits ─────────────────────────────────────────────
  // Every user-facing change lands here first — nothing hits the server until
  // the user clicks "Update". Milestone and epic bypass this (they call
  // dedicated callbacks) so their behaviour is unchanged.
  const [pending, setPending] = useState<Partial<Record<BufferedKey, any>>>({})

  function effective<T = any>(key: BufferedKey): T {
    return (key in pending ? pending[key] : originalFor(key, issue)) as T
  }
  function set(key: BufferedKey, value: any) {
    setPending(prev => {
      const next = { ...prev }
      if (isEqual(value, originalFor(key, issue))) delete next[key]
      else next[key] = value
      return next
    })
  }
  function discard() {
    setPending({})
    setEditingDesc(false)
    setDescDraft(issue.description)
  }
  async function flush() {
    if (Object.keys(pending).length === 0) return
    setSaving(true)
    try {
      onUpdate(pending as any)
      setPending({})
    } finally { setSaving(false) }
  }

  // If the server-side issue refreshes, drop any pending entries that now
  // match the fresh baseline — this happens after our own successful save,
  // and lets a concurrent edit from elsewhere clear the "unsaved" indicator.
  useEffect(() => {
    setPending(prev => {
      const next: Partial<Record<BufferedKey, any>> = {}
      for (const [k, v] of Object.entries(prev) as [BufferedKey, any][]) {
        if (!isEqual(v, originalFor(k, issue))) next[k] = v
      }
      return next
    })
    setDescDraft(issue.description)
    // Only re-run when the server-side snapshot changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue.updated_at])

  // Fetch activity for this issue; refresh after every successful save (updated_at flips).
  useEffect(() => {
    let cancelled = false
    api.getActivity(project.id, issue.id).then((a: ActivityEntry[]) => {
      if (!cancelled) setActivity(a)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [project.id, issue.id, issue.updated_at])

  const pendingCount = Object.keys(pending).length
  const hasPending = pendingCount > 0
  const pendingList = (Object.keys(pending) as BufferedKey[]).map(k => FIELD_LABELS_SHORT[k]).join(', ')

  // Effective view of the fields the UI reads.
  const effTitle       = effective<string>('title') ?? ''
  const effDescription = effective<string>('description') ?? ''
  const effStateId     = effective<string | null>('state_id') ?? ''
  const effPriority    = effective<string>('priority') ?? 'none'
  const effAssignees   = effective<string[]>('assignee_ids') ?? []
  const effLabelIds    = effective<string[]>('label_ids') ?? []
  const effStartDate   = effective<string | null>('start_date') ?? ''
  const effDueDate     = effective<string | null>('due_date') ?? ''
  const effEstimate    = effective<number | null>('estimate')

  const overdue = isOverdue(effDueDate || null) && issue.state?.group_type !== 'completed'
  const overdueBy = overdue ? overdueDuration(effDueDate) : null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto flex flex-col bg-white shadow-2xl h-full w-full md:w-[75vw] md:min-w-[820px] max-w-[1300px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-3 border-b shrink-0">
          <StateIcon state={issue.state} size={16} />
          <span className="text-xs font-mono text-gray-400">{project.identifier}-{formatIssueCode(issue)}</span>
          <span className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: typeCfg.color + '20', color: typeCfg.color }}
            title={typeCfg.label}>
            <span>{typeCfg.icon}</span>{typeCfg.label}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {saving && <span className="text-xs text-gray-400 mr-2">Saving…</span>}
            {!saving && hasPending && (
              <span className="text-[11px] font-semibold text-amber-600 mr-2 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {pendingCount} unsaved
              </span>
            )}
            <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded hover:bg-red-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors rounded hover:bg-gray-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <textarea value={effTitle} onChange={e => set('title', e.target.value)}
              onBlur={() => set('title', effTitle.trim())}
              className="w-full text-xl font-semibold text-gray-800 resize-none border-0 focus:outline-none leading-snug p-0"
              rows={2} />

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Description <span className="text-gray-300 normal-case text-[10px] ml-1">markdown</span>
                </p>
                {!editingDesc && effDescription && (
                  <button onClick={() => { setDescDraft(effDescription); setEditingDesc(true) }}
                    className="text-[11px] text-indigo-600 hover:text-indigo-700">Edit</button>
                )}
              </div>
              {editingDesc ? (
                <div data-color-mode="light" className="border rounded-lg overflow-hidden">
                  <MDEditor
                    value={descDraft}
                    onChange={v => setDescDraft(v ?? '')}
                    height={280}
                    preview="edit"
                    visibleDragbar={false}
                    textareaProps={{ placeholder: 'Write in markdown — supports **bold**, lists, `code`, [links](…), tables, task lists', autoFocus: true }}
                  />
                  <div className="flex justify-end gap-2 px-3 py-2 bg-gray-50 border-t">
                    <button onClick={() => { setEditingDesc(false); setDescDraft(effDescription) }}
                      className="text-xs text-gray-600 hover:bg-gray-200 px-3 py-1 rounded">Cancel</button>
                    <button onClick={() => { setEditingDesc(false); set('description', descDraft) }}
                      className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded font-medium">Apply</button>
                  </div>
                </div>
              ) : effDescription ? (
                <div onClick={() => { setDescDraft(effDescription); setEditingDesc(true) }}
                  className="border rounded-lg p-3 hover:bg-gray-50 cursor-text min-h-[60px]">
                  <MarkdownView value={effDescription} onChange={next => set('description', next)} />
                </div>
              ) : (
                <button onClick={() => { setDescDraft(''); setEditingDesc(true) }}
                  className="w-full text-left text-sm text-gray-400 italic border rounded-lg p-3 hover:bg-gray-50 min-h-[60px]">
                  Add a description…
                </button>
              )}
            </div>

            {/* Sub-issues */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Sub-issues{issue.sub_issues?.length ? ` (${issue.sub_issues.length})` : ''}
                </p>
                {/* Only allow one level of nesting — a sub-issue itself cannot have children. */}
                {onAddSubIssue && !issue.parent_id && (
                  <button onClick={onAddSubIssue}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    Add sub-issue
                  </button>
                )}
              </div>
              {issue.sub_issues?.length ? (
                <div className="border rounded-lg overflow-hidden">
                  {issue.sub_issues.map(sub => {
                    const subType = ISSUE_TYPE_CONFIG[sub.type ?? 'subtask']
                    return (
                      <div key={sub.id}
                        onClick={() => onClickSubIssue?.(sub)}
                        className={`flex items-center gap-2 px-3 py-2 border-b last:border-0 hover:bg-gray-50 ${onClickSubIssue ? 'cursor-pointer' : ''}`}>
                        <span className="text-xs" title={subType.label}>{subType.icon}</span>
                        <StateIcon state={sub.state} size={13} />
                        <span className="text-xs text-gray-400 font-mono">{project.identifier}-{formatIssueCode(sub)}</span>
                        <span className="text-sm text-gray-700 flex-1 truncate">{sub.title}</span>
                        <PriorityIcon priority={sub.priority} size={12} />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 italic">No sub-issues yet</p>
              )}
            </div>

            {/* Wiki pages that link this issue — filtered to the current
                member's authorised pages by the server. Renders nothing when
                the caller has no visible links. */}
            <IssueWikiLinks projectId={project.id} issueId={issue.id} />

            {/* Link attachments */}
            <LinkAttachments projectId={project.id} issueId={issue.id} />

            {/* Comment thread — reads the same attachments list so users can
                quote any file uploaded above into a comment via [[att:<id>]]. */}
            <IssueComments projectId={project.id} issueId={issue.id} currentMember={currentMember} members={members} />

            {/* Activity timeline */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Activity {activity.length > 0 && <span className="text-gray-300 normal-case ml-1">({activity.length})</span>}
              </p>
              {activity.length === 0 ? (
                <p className="text-[11px] text-gray-400 italic">No activity yet</p>
              ) : (
                <ul className="space-y-2.5 border-l-2 border-gray-100 pl-4 ml-2">
                  {activity.map(a => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[22px] top-0">
                        {a.actor
                          ? <Avatar name={a.actor.name} size={5} />
                          : <span className="block w-5 h-5 rounded-full bg-gray-200" />}
                      </span>
                      <p className="text-xs text-gray-700 leading-snug">
                        <span className="font-medium text-gray-900">{a.actor?.name ?? 'Someone'}</span>
                        {' '}{describeActivity(a)}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{relTime(a.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-56 border-l bg-gray-50 overflow-y-auto p-4 space-y-4 shrink-0">
            {/* State */}
            <Prop label="State">
              <select value={effStateId} onChange={e => set('state_id', e.target.value || null)}
                className="w-full text-xs border rounded p-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200">
                {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Prop>

            {/* Priority */}
            <Prop label="Priority">
              <select value={effPriority} onChange={e => set('priority', e.target.value)}
                className="w-full text-xs border rounded p-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200">
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Prop>

            {/* Assignees (multi) */}
            <Prop label={`Assignees${effAssignees.length ? ` (${effAssignees.length})` : ''}`}>
              <AssigneePicker
                members={members}
                selectedIds={effAssignees}
                onChange={ids => set('assignee_ids', ids)}
              />
            </Prop>

            {/* Milestone */}
            {onSetMilestone && (
              <Prop label="Milestone">
                <div className="flex items-center gap-1">
                  <select
                    value={issue.milestone?.id ?? ''}
                    onChange={e => onSetMilestone(e.target.value || null)}
                    className="w-full text-xs border rounded p-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">— none —</option>
                    {milestones.map(m => <option key={m.id} value={m.id}>🎯 {m.name}</option>)}
                  </select>
                  {issue.milestone && (
                    <button onClick={() => onSetMilestone(null)}
                      title="Clear milestone"
                      className="text-gray-400 hover:text-red-500 p-1 rounded">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              </Prop>
            )}

            {/* Epic */}
            {onSetEpic && (
              <Prop label="Epic">
                <div className="flex items-center gap-1">
                  <select
                    value={issue.epic?.id ?? ''}
                    onChange={e => onSetEpic(e.target.value || null)}
                    className="w-full text-xs border rounded p-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">— none —</option>
                    {epics.map(ep => <option key={ep.id} value={ep.id}>📦 {ep.name}</option>)}
                  </select>
                  {issue.epic && (
                    <button onClick={() => onSetEpic(null)}
                      title="Clear epic"
                      className="text-gray-400 hover:text-red-500 p-1 rounded">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              </Prop>
            )}

            {/* Labels — GitLab-style: applied pills + searchable add dropdown */}
            <Prop label="Labels">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {effLabelIds.map(id => {
                    const l = labels.find(x => x.id === id)
                    if (!l) return null
                    return (
                      <button key={l.id}
                        onClick={() => set('label_ids', effLabelIds.filter(x => x !== l.id))}
                        title={`Click to remove "${l.name}"`}
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium hover:ring-1 hover:ring-current/40 transition-all"
                        style={{ backgroundColor: l.color + '22', color: l.color }}>
                        {l.name}
                      </button>
                    )
                  })}
                  {effLabelIds.length === 0 && (
                    <p className="text-[11px] text-gray-400 italic">No labels yet</p>
                  )}
                </div>
                {labels.length > 0 && (
                  <LabelPicker
                    labels={labels}
                    selectedIds={effLabelIds}
                    onChange={ids => set('label_ids', ids)}
                    hideSelected
                  />
                )}
              </div>
            </Prop>

            {/* Start date — buffered until "Update" is pressed */}
            <Prop label={canEditDates ? 'Start date' : 'Start date 🔒'}>
              <input type="date" value={effStartDate}
                disabled={!canEditDates}
                title={lockTitle}
                onChange={e => set('start_date', e.target.value || null)}
                className={`w-full text-xs border rounded p-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${!canEditDates ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`} />
            </Prop>

            {/* Due date — buffered until "Update" is pressed */}
            <Prop label={canEditDates ? 'Due date' : 'Due date 🔒'}>
              <input type="date" value={effDueDate}
                disabled={!canEditDates}
                title={lockTitle}
                onChange={e => set('due_date', e.target.value || null)}
                className={`w-full text-xs border rounded p-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${overdue ? 'border-red-400 text-red-600' : ''} ${!canEditDates ? 'bg-gray-100 cursor-not-allowed' : ''}`} />
              {overdue && (
                <p className="text-[10px] font-semibold text-red-500 mt-1 inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  OVERDUE{overdueBy ? ` BY ${overdueBy}` : ''}
                </p>
              )}
              {!canEditDates && <p className="text-[10px] text-gray-400 mt-0.5">Read-only · ask a project manager</p>}
            </Prop>

            {/* Estimate — key by issue.id so type='number' input resets on issue switch */}
            <Prop label="Estimate (pts)">
              <input type="number"
                value={effEstimate ?? ''}
                onChange={e => set('estimate', e.target.value ? parseInt(e.target.value) : null)}
                className="w-full text-xs border rounded p-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="Story points" />
            </Prop>

            {/* Created By — who created the issue */}
            <Prop label="Created By">
              <div className="flex items-center gap-2">
                {issue.creator ? (
                  <>
                    <Avatar name={issue.creator.name} size={5} />
                    <div className="min-w-0">
                      <p className="text-[11px] text-gray-700 font-medium truncate">{issue.creator.name}</p>
                      <p className="text-[10px] text-gray-400 capitalize">{issue.creator.role}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-gray-400 italic">Unknown user</p>
                )}
              </div>
            </Prop>

            {/* Created At — when it was created */}
            <Prop label="Created At">
              <p className="text-[11px] text-gray-700">{fmtDate(issue.created_at)}</p>
            </Prop>
          </div>
        </div>

        {/* Sticky footer — shows the queued changes and commits them. */}
        {hasPending && (
          <div className="shrink-0 border-t border-amber-200 bg-amber-50/70 px-4 py-2.5 flex items-center gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {pendingCount} unsaved change{pendingCount === 1 ? '' : 's'}
              </span>
              <span className="text-[11px] text-amber-800/80 truncate">{pendingList}</span>
            </div>
            <button
              onClick={discard}
              disabled={saving}
              className="text-xs font-medium text-gray-700 hover:bg-white/70 disabled:opacity-40 px-3 py-1.5 rounded-md transition-colors">
              Discard
            </button>
            <button
              onClick={flush}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-3.5 py-1.5 rounded-md shadow-sm transition-colors">
              {saving ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                  </svg>
                  Updating…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Update
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const FIELD_LABELS: Record<string, string> = {
  state_id: 'state', priority: 'priority', assignee_id: 'assignee',
  parent_id: 'parent', start_date: 'start date', due_date: 'due date',
  estimate: 'estimate', title: 'title', type: 'type', completed_at: 'completion',
}

function describeActivity(a: ActivityEntry): string {
  if (a.action === 'created') return 'created this issue'
  if (a.action === 'label_added') return `added label "${a.new_value ?? ''}"`
  if (a.action === 'label_removed') return `removed label "${a.old_value ?? ''}"`
  if (a.action === 'assignee_added') return `assigned ${a.new_value ?? 'a member'}`
  if (a.action === 'assignee_removed') return `unassigned ${a.old_value ?? 'a member'}`
  // updated
  const f = a.field ?? 'something'
  const label = FIELD_LABELS[f] ?? f
  if (f === 'description') return 'edited the description'
  if (a.old_value && a.new_value) return `changed ${label} from "${a.old_value}" to "${a.new_value}"`
  if (a.new_value) return `set ${label} to "${a.new_value}"`
  if (a.old_value) return `cleared ${label} (was "${a.old_value}")`
  return `updated ${label}`
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">{label}</p>
      {children}
      <div className="mt-3 border-b border-gray-200" />
    </div>
  )
}
