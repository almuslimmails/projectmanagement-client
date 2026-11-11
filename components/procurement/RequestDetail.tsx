'use client'

// One procurement request: details, processing actions and its timeline.
//   Requester: edit or withdraw while it is still New; comment any time.
//   Owner/admin/manager: edit, move between open columns, set the handler,
//   send to a board (creates the card) or decline with a reason; reopen
//   declined requests.
import { useEffect, useState } from 'react'
import type { Member, Project, ProcurementRequest, ProcurementType, Priority } from '@/lib/types'
import { api, errorMessage } from '@/lib/api'
import { fmtDate, PRIORITY_CONFIG, ISSUE_TYPE_CONFIG } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { COLUMNS, PROCESSOR_ROLES, OPEN_STATUSES as OPEN } from './shared'

const TYPES: ProcurementType[] = ['task', 'issue', 'enhancement']
const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low', 'none']

interface Props {
  requestId: string
  currentMember: Member | null
  members: Member[]
  projects: Project[]
  onClose: () => void
  onChanged: (r: ProcurementRequest) => void
  onDeleted: (id: string) => void
  onOpenCard: (projectId: string, issueId: string) => void
}

export default function RequestDetail({ requestId, currentMember, members, projects, onClose, onChanged, onDeleted, onOpenCard }: Props) {
  const [r, setR] = useState<ProcurementRequest | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<'none' | 'route' | 'decline'>('none')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [comment, setComment] = useState('')

  useEffect(() => {
    let alive = true
    api.getProcurementRequest(requestId)
      .then((x: ProcurementRequest) => { if (alive) { setR(x); setTitle(x.title); setDescription(x.description) } })
      .catch(e => { if (alive) setLoadError(errorMessage(e, 'Could not load the request')) })
    return () => { alive = false }
  }, [requestId])

  const isProcessor = PROCESSOR_ROLES.includes(currentMember?.role ?? '')
  const isOwner = currentMember?.role === 'owner'
  const own = !!r && r.requester?.id === currentMember?.id
  const open = !!r && OPEN.includes(r.status)
  const canEdit = !!r && open && (isProcessor || (own && r.status === 'new'))
  const processors = members.filter(m => PROCESSOR_ROLES.includes(m.role))

  async function act(fn: () => Promise<ProcurementRequest | void>) {
    setBusy(true); setError(null)
    try {
      const fresh = await fn()
      if (fresh) { setR(fresh); setTitle(fresh.title); setDescription(fresh.description); onChanged(fresh) }
      return true
    } catch (e) {
      setError(errorMessage(e, 'Action failed'))
      return false
    } finally { setBusy(false) }
  }

  const patch = (data: Record<string, unknown>) =>
    act(() => api.updateProcurementRequest(requestId, data) as Promise<ProcurementRequest>)

  function saveText() {
    if (!r || !canEdit) return
    const data: Record<string, unknown> = {}
    if (title.trim() && title.trim() !== r.title) data.title = title.trim()
    if (description !== r.description) data.description = description
    if (Object.keys(data).length) void patch(data)
  }

  async function postComment() {
    const text = comment.trim()
    if (!text) return
    const ok = await act(() => api.commentOnProcurementRequest(requestId, text) as Promise<ProcurementRequest>)
    if (ok) setComment('')
  }

  async function withdraw() {
    if (!r) return
    const msg = own && !isOwner ? `Withdraw ${r.code}? It will be removed.` : `Delete ${r.code}? This can't be undone.`
    if (!window.confirm(msg)) return
    setBusy(true); setError(null)
    try { await api.deleteProcurementRequest(requestId); onDeleted(requestId) }
    catch (e) { setError(errorMessage(e, 'Could not remove the request')); setBusy(false) }
  }

  const status = r ? COLUMNS.find(c => c.id === r.status) : null

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto flex flex-col bg-white shadow-2xl h-full w-full md:w-[620px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0">
          <span className="font-mono text-xs text-gray-500">{r?.code ?? '…'}</span>
          {status && (
            <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 border"
              style={{ color: status.dot, borderColor: status.dot + '55', backgroundColor: status.dot + '14' }}>
              {status.label}
            </span>
          )}
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-700" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {loadError ? (
          <p className="p-6 text-sm text-gray-500">{loadError}</p>
        ) : !r ? (
          <p className="p-6 text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-4 space-y-4">
              {/* Title + description */}
              {canEdit ? (
                <input value={title} onChange={e => setTitle(e.target.value)} onBlur={saveText} maxLength={200}
                  className="w-full text-lg font-semibold text-gray-900 border border-transparent hover:border-gray-200 focus:border-indigo-300 rounded-lg px-2 py-1 -mx-2 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
              ) : (
                <h2 className="text-lg font-semibold text-gray-900">{r.title}</h2>
              )}
              {canEdit ? (
                <textarea value={description} onChange={e => setDescription(e.target.value)} onBlur={saveText} rows={5}
                  placeholder="Add details…"
                  className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-y" />
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.description || <span className="text-gray-400">No details.</span>}</p>
              )}

              {/* Outcome banners */}
              {r.status === 'routed' && (
                <div className="border border-sky-200 bg-sky-50 rounded-lg px-3 py-2.5 flex items-center gap-3">
                  <div className="text-sm text-sky-900 min-w-0">
                    Sent to <b>{r.routed_project?.name ?? 'a board'}</b>{r.routed_issue && <> as <b className="font-mono">{r.routed_issue.code}</b></>}
                    {r.processed_by && <span className="text-sky-700"> · by {r.processed_by.name}</span>}
                  </div>
                  {r.routed_issue && projects.some(p => p.id === r.routed_issue!.project_id) && (
                    <button onClick={() => onOpenCard(r.routed_issue!.project_id, r.routed_issue!.id)}
                      className="ml-auto shrink-0 text-xs font-medium text-sky-800 border border-sky-300 hover:bg-sky-100 rounded-md px-2.5 py-1">
                      Open card
                    </button>
                  )}
                </div>
              )}
              {r.status === 'declined' && (
                <div className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5">
                  <p className="text-sm text-gray-800">
                    Declined{r.processed_by && <> by <b>{r.processed_by.name}</b></>}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">{r.decline_reason}</p>
                  {isProcessor && (
                    <button disabled={busy} onClick={() => act(() => api.reopenProcurementRequest(requestId) as Promise<ProcurementRequest>)}
                      className="mt-2 text-xs font-medium text-indigo-700 border border-indigo-200 hover:bg-indigo-50 rounded-md px-2.5 py-1">
                      Reopen for review
                    </button>
                  )}
                </div>
              )}

              {/* Fields */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Field label="Requested by">
                  {r.requester ? <span className="flex items-center gap-1.5"><Avatar name={r.requester.name} size={5} />{r.requester.name}</span> : '—'}
                </Field>
                <Field label="Raised">{fmtDate(r.created_at.slice(0, 10))}</Field>
                <Field label="Type">
                  {canEdit ? (
                    <select value={r.type} disabled={busy} onChange={e => patch({ type: e.target.value })} className="text-sm border rounded-md px-2 py-1 bg-white">
                      {TYPES.map(t => <option key={t} value={t}>{ISSUE_TYPE_CONFIG[t].icon} {ISSUE_TYPE_CONFIG[t].label}</option>)}
                    </select>
                  ) : <>{ISSUE_TYPE_CONFIG[r.type]?.icon} {ISSUE_TYPE_CONFIG[r.type]?.label}</>}
                </Field>
                <Field label="Priority">
                  {canEdit ? (
                    <select value={r.priority} disabled={busy} onChange={e => patch({ priority: e.target.value })} className="text-sm border rounded-md px-2 py-1 bg-white">
                      {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
                    </select>
                  ) : PRIORITY_CONFIG[r.priority]?.label}
                </Field>
                <Field label="Needed by">
                  {canEdit ? (
                    <input type="date" value={r.needed_by ?? ''} disabled={busy} onChange={e => patch({ needed_by: e.target.value || null })}
                      className="text-sm border rounded-md px-2 py-0.5" />
                  ) : (r.needed_by ? fmtDate(r.needed_by) : '—')}
                </Field>
                <Field label="Probably for">
                  {canEdit ? (
                    <select value={r.suggested_project?.id ?? ''} disabled={busy} onChange={e => patch({ suggested_project_id: e.target.value || null })}
                      className="text-sm border rounded-md px-2 py-1 bg-white max-w-full">
                      <option value="">Not sure</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                    </select>
                  ) : (r.suggested_project ? `${r.suggested_project.emoji} ${r.suggested_project.name}` : '—')}
                </Field>
                <Field label="Handler">
                  {isProcessor && open ? (
                    <select value={r.handler?.id ?? ''} disabled={busy} onChange={e => patch({ handler_id: e.target.value || null })}
                      className="text-sm border rounded-md px-2 py-1 bg-white">
                      <option value="">Nobody yet</option>
                      {processors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  ) : (r.handler?.name ?? '—')}
                </Field>
              </div>

              {/* Processing actions */}
              {isProcessor && open && (
                <div className="border-t pt-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mr-1">Move to</span>
                    {OPEN.filter(s => s !== r.status).map(s => (
                      <button key={s} disabled={busy} onClick={() => patch({ status: s })}
                        className="text-xs border border-gray-200 hover:bg-gray-50 rounded-md px-2.5 py-1">
                        {COLUMNS.find(c => c.id === s)?.label}
                      </button>
                    ))}
                    <span className="flex-1" />
                    <button disabled={busy} onClick={() => setPanel(panel === 'route' ? 'none' : 'route')}
                      className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md px-3 py-1.5">
                      Send to board
                    </button>
                    <button disabled={busy} onClick={() => setPanel(panel === 'decline' ? 'none' : 'decline')}
                      className="text-xs font-medium text-red-700 border border-red-200 hover:bg-red-50 rounded-md px-3 py-1.5">
                      Decline
                    </button>
                  </div>
                  {panel === 'route' && (
                    <RoutePanel r={r} projects={projects} busy={busy}
                      onCancel={() => setPanel('none')}
                      onSend={async data => {
                        const ok = await act(() => api.routeProcurementRequest(requestId, data) as Promise<ProcurementRequest>)
                        if (ok) setPanel('none')
                      }} />
                  )}
                  {panel === 'decline' && (
                    <DeclinePanel busy={busy} onCancel={() => setPanel('none')}
                      onDecline={async reason => {
                        const ok = await act(() => api.declineProcurementRequest(requestId, reason) as Promise<ProcurementRequest>)
                        if (ok) setPanel('none')
                      }} />
                  )}
                </div>
              )}

              {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

              {((own && r.status === 'new') || (isOwner && r.status !== 'routed')) && (
                <button disabled={busy} onClick={withdraw} className="text-xs text-gray-500 hover:text-red-700">
                  {own && !isOwner ? 'Withdraw this request' : 'Delete this request'}
                </button>
              )}
            </div>

            {/* Timeline */}
            <div className="border-t bg-gray-50/60 px-5 py-4">
              <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-3">Activity</p>
              <ol className="space-y-3">
                {(r.events ?? []).map(e => (
                  <li key={e.id} className="flex gap-2.5 text-sm">
                    {e.kind === 'comment'
                      ? <Avatar name={e.actor?.name ?? '?'} size={6} />
                      : <span className="w-6 h-6 rounded-full bg-white border flex items-center justify-center text-[11px] shrink-0">{EVENT_ICON[e.kind] ?? '•'}</span>}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500">
                        <b className="text-gray-700">{e.actor?.name ?? 'Someone'}</b> {EVENT_VERB[e.kind] ?? ''}
                        <span className="text-gray-400"> · {fmtWhen(e.created_at)}</span>
                      </p>
                      {e.body && (
                        <p className={`mt-0.5 whitespace-pre-wrap ${e.kind === 'comment' ? 'text-gray-800 bg-white border rounded-lg px-3 py-2' : 'text-gray-600 text-xs'}`}>{e.body}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex gap-2 items-end">
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void postComment() }}
                  placeholder={isProcessor ? 'Ask the requester something, or note a decision…' : 'Add a comment for the manager…'}
                  className="flex-1 text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-y" />
                <button disabled={busy || !comment.trim()} onClick={postComment}
                  className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-lg px-3 py-2">
                  Comment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const EVENT_ICON: Record<string, string> = {
  created: '✚', status: '→', edited: '✎', handler: '👤', routed: '📋', declined: '✕', reopened: '↺',
}
const EVENT_VERB: Record<string, string> = {
  created: 'raised this request', status: 'moved it', edited: 'edited it', handler: 'set the handler',
  routed: 'sent it to a board', declined: 'declined it', reopened: 'reopened it', comment: 'commented',
}

function fmtWhen(ts: string): string {
  // DB timestamps are UTC "YYYY-MM-DD HH:MM:SS".
  const d = new Date(ts.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return ts
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-1">{label}</p>
      <div className="text-gray-800">{children}</div>
    </div>
  )
}

function RoutePanel({ r, projects, busy, onCancel, onSend }: {
  r: ProcurementRequest; projects: Project[]; busy: boolean
  onCancel: () => void
  onSend: (data: Record<string, unknown>) => void
}) {
  const [pid, setPid] = useState(r.suggested_project?.id && projects.some(p => p.id === r.suggested_project!.id) ? r.suggested_project.id : '')
  const [assignable, setAssignable] = useState<Member[] | null>(null)
  const [assignees, setAssignees] = useState<string[]>([])
  const [type, setType] = useState<ProcurementType>(r.type)
  const [priority, setPriority] = useState<Priority>(r.priority)
  const [due, setDue] = useState(r.needed_by ?? '')

  useEffect(() => {
    if (!pid) return
    let alive = true
    api.getProjectAssignees(pid)
      .then((m: Member[]) => { if (alive) setAssignable(m) })
      .catch(() => { if (alive) setAssignable([]) })
    return () => { alive = false }
  }, [pid])
  function pickBoard(next: string) {
    setPid(next); setAssignees([]); setAssignable(null)
  }

  return (
    <div className="border border-indigo-100 bg-indigo-50/40 rounded-lg p-3 space-y-3">
      <p className="text-xs text-indigo-900">Creates a card on the board with this title and details. {r.requester?.name ?? 'The requester'} is recorded as its creator.</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="block col-span-2">
          <span className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold block mb-1">Board</span>
          <select value={pid} onChange={e => pickBoard(e.target.value)} className="w-full border rounded-md px-2 py-1.5 bg-white">
            <option value="">Pick a board…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name} · {p.identifier}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold block mb-1">Type</span>
          <select value={type} onChange={e => setType(e.target.value as ProcurementType)} className="w-full border rounded-md px-2 py-1.5 bg-white">
            {TYPES.map(t => <option key={t} value={t}>{ISSUE_TYPE_CONFIG[t].icon} {ISSUE_TYPE_CONFIG[t].label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold block mb-1">Priority</span>
          <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className="w-full border rounded-md px-2 py-1.5 bg-white">
            {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold block mb-1">Due date</span>
          <input type="date" value={due} onChange={e => setDue(e.target.value)} className="w-full border rounded-md px-2 py-1" />
        </label>
      </div>
      {pid && (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Assign to</p>
          {assignable === null ? (
            <p className="text-xs text-gray-500">Loading the board&apos;s members…</p>
          ) : assignable.length === 0 ? (
            <p className="text-xs text-gray-500">Nobody is attached to this board yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {assignable.map(m => {
                const on = assignees.includes(m.id)
                return (
                  <button key={m.id} type="button"
                    onClick={() => setAssignees(a => on ? a.filter(x => x !== m.id) : [...a, m.id])}
                    className={`flex items-center gap-1.5 text-xs rounded-full border px-2 py-1 ${on ? 'border-indigo-400 bg-indigo-100 text-indigo-900' : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-200'}`}>
                    <Avatar name={m.name} size={4} />{m.name}
                  </button>
                )
              })}
            </div>
          )}
          {assignees.length === 0 && !!assignable?.length && (
            <p className="text-[11px] text-gray-500 mt-1">Nobody picked: the card goes to the managers, as with any new card.</p>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} disabled={busy} className="text-xs text-gray-600 hover:bg-gray-100 rounded-md px-3 py-1.5">Cancel</button>
        <button disabled={busy || !pid}
          onClick={() => onSend({ project_id: pid, type, priority, due_date: due || null, assignee_ids: assignees })}
          className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-md px-3 py-1.5">
          {busy ? 'Sending…' : 'Create card'}
        </button>
      </div>
    </div>
  )
}

function DeclinePanel({ busy, onCancel, onDecline }: { busy: boolean; onCancel: () => void; onDecline: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  return (
    <div className="border border-red-100 bg-red-50/40 rounded-lg p-3 space-y-2">
      <p className="text-xs text-red-900">The requester sees this reason.</p>
      <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} autoFocus
        placeholder="e.g. Already covered by TATHBA-TS031, or out of scope this quarter"
        className="w-full text-sm border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-100" />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} disabled={busy} className="text-xs text-gray-600 hover:bg-gray-100 rounded-md px-3 py-1.5">Cancel</button>
        <button disabled={busy || !reason.trim()} onClick={() => onDecline(reason.trim())}
          className="text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-md px-3 py-1.5">
          Decline request
        </button>
      </div>
    </div>
  )
}
