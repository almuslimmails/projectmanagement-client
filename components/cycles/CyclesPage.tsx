'use client'
import { useState, useEffect } from 'react'
import type { Cycle, Issue, Project, State, Member, Label } from '@/lib/types'
import { api } from '@/lib/api'
import { fmtDate, formatIssueCode, isOverdue, validateMilestoneName, validateDateOrder, NAME_MAX_LEN } from '@/lib/utils'
import IssueRow from '@/components/issue/IssueRow'

interface Props {
  project: Project
  currentMember: Member | null
  onClickIssue: (issue: Issue) => void
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-full">
      <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

function CycleCard({ cycle, projectId, onView }: { cycle: Cycle; projectId: string; onView: () => void }) {
  const now = new Date()
  const start = cycle.start_date ? new Date(cycle.start_date) : null
  const end = cycle.end_date ? new Date(cycle.end_date) : null
  const isActive = start && end && start <= now && now <= end
  const isCompleted = end && now > end
  const isUpcoming = start && now < start

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={onView}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isActive && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">Active</span>}
            {isCompleted && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Completed</span>}
            {isUpcoming && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">Upcoming</span>}
          </div>
          <h3 className="font-semibold text-gray-900">{cycle.name}</h3>
          {cycle.description && <p className="text-sm text-gray-500 mt-0.5">{cycle.description}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-500">
            {start ? fmtDate(start.toISOString()) : '—'} → {end ? fmtDate(end.toISOString()) : '—'}
          </p>
          <p className="text-sm font-semibold text-gray-700 mt-1">{cycle.issue_count} issues</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <ProgressBar pct={(cycle.progress ?? 0)} />
        <span className="text-xs font-medium text-gray-600 shrink-0">{Math.round((cycle.progress ?? 0))}%</span>
      </div>
    </div>
  )
}

function CycleDetail({ cycle: initialCycle, project, canManage, onClose, onClickIssue, onChange, onDeleted }: {
  cycle: Cycle; project: Project; canManage: boolean; onClose: () => void; onClickIssue: (i: Issue) => void; onChange?: () => void; onDeleted?: () => void
}) {
  const [cycle, setCycle] = useState(initialCycle)
  const [issues, setIssues] = useState<Issue[]>([])
  const [allIssues, setAllIssues] = useState<Issue[]>([])
  const [adding, setAdding] = useState(false)

  // Edit form state — populated from the current cycle whenever we enter edit mode.
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: cycle.name,
    description: cycle.description ?? '',
    start_date: cycle.start_date ?? '',
    end_date: cycle.end_date ?? '',
    status: cycle.status ?? 'draft',
  })

  function beginEdit() {
    setForm({
      name: cycle.name,
      description: cycle.description ?? '',
      start_date: cycle.start_date ?? '',
      end_date: cycle.end_date ?? '',
      status: cycle.status ?? 'draft',
    })
    setEditing(true)
  }

  const nameError = form.name.trim() ? validateMilestoneName(form.name) : null
  const dateError = validateDateOrder(form.start_date, form.end_date)
  const canSave = !nameError && !dateError && form.name.trim().length > 0

  async function save() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const updated: any = await api.updateCycle(project.id, cycle.id, {
        name: form.name.trim(),
        description: form.description,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
      })
      setCycle(prev => ({ ...prev, ...updated }))
      setEditing(false)
      onChange?.()
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update milestone')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    api.getCycleIssues(project.id, cycle.id).then(setIssues)
    api.getIssues(project.id).then(setAllIssues)
  }, [cycle.id, project.id])

  async function addIssue(issueId: string) {
    await api.addIssueToCycle(project.id, cycle.id, issueId)
    setIssues(await api.getCycleIssues(project.id, cycle.id))
  }

  async function removeIssue(issueId: string) {
    await api.removeIssueFromCycle(project.id, cycle.id, issueId)
    setIssues(await api.getCycleIssues(project.id, cycle.id))
  }

  async function deleteThisCycle() {
    if (!canManage) return
    if (!confirm(`Delete milestone "${cycle.name}"? Its ${issues.length} linked issue${issues.length === 1 ? '' : 's'} will remain but lose their milestone link. This cannot be undone.`)) return
    try {
      await api.deleteCycle(project.id, cycle.id)
    } catch (e: any) {
      alert(e?.message ?? 'Failed to delete milestone')
      return
    }
    onDeleted?.()
    onClose()
  }

  const issueIds = new Set(issues.map(i => i.id))
  const available = allIssues.filter(i => !issueIds.has(i.id))

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto flex flex-col bg-white shadow-2xl w-full max-w-2xl h-full overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 truncate">{cycle.name}</h2>
            {cycle.description && <p className="text-sm text-gray-500 truncate">{cycle.description}</p>}
            {(cycle.start_date || cycle.end_date) && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                {cycle.start_date ? fmtDate(cycle.start_date) : '—'} → {cycle.end_date ? fmtDate(cycle.end_date) : '—'}
                <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-100 text-[10px] uppercase tracking-wide">{cycle.status}</span>
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-500">{Math.round((cycle.progress ?? 0))}% complete</p>
            <ProgressBar pct={(cycle.progress ?? 0)} />
          </div>
          {!editing && canManage && (
            <button onClick={beginEdit} title="Edit milestone"
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
          )}
          {!editing && canManage && (
            <button onClick={deleteThisCycle} title="Delete milestone"
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          )}
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors rounded hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {editing && (
          <div className="px-6 py-4 border-b bg-indigo-50/40 space-y-3 shrink-0">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                maxLength={NAME_MAX_LEN} aria-invalid={!!nameError}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${nameError ? 'border-red-300 focus:ring-red-200' : 'focus:ring-indigo-300'}`} />
              {nameError && <p className="text-[11px] text-red-600 mt-1">{nameError}</p>}
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Start</label>
                  <input type="date" value={form.start_date} max={form.end_date || undefined}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${dateError ? 'border-red-300 focus:ring-red-200' : 'focus:ring-indigo-300'}`} />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">End</label>
                  <input type="date" value={form.end_date} min={form.start_date || undefined}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${dateError ? 'border-red-300 focus:ring-red-200' : 'focus:ring-indigo-300'}`} />
                </div>
                <div className="w-36">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              {dateError && <p className="text-[11px] text-red-600 mt-1">{dateError}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={!canSave || saving}
                className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 rounded-lg font-medium transition-colors">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} disabled={saving}
                className="text-sm text-gray-600 hover:bg-gray-100 px-4 py-1.5 rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center px-6 py-3 border-b bg-gray-50">
            <span className="text-sm font-medium text-gray-700">{issues.length} issues</span>
            <button onClick={() => setAdding(a => !a)}
              className="ml-auto flex items-center gap-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Add issues
            </button>
          </div>

          {adding && available.length > 0 && (
            <div className="border-b border-indigo-100 bg-indigo-50 max-h-48 overflow-y-auto">
              {available.map(i => (
                <div key={i.id} onClick={() => addIssue(i.id)}
                  className="flex items-center gap-2 px-6 py-2 hover:bg-indigo-100 cursor-pointer">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                  <span className="text-xs font-mono text-gray-400">{project.identifier}-{formatIssueCode(i)}</span>
                  <span className="text-sm text-gray-700">{i.title}</span>
                </div>
              ))}
            </div>
          )}

          {issues.map(issue => (
            <div key={issue.id} className="flex items-center group">
              <div className="flex-1">
                <IssueRow issue={issue} projectIdentifier={project.identifier} onClick={() => onClickIssue(issue)} />
              </div>
              <button onClick={() => removeIssue(issue.id)}
                className="px-3 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          ))}

          {issues.length === 0 && !adding && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-gray-400 text-sm">No issues in this cycle</p>
              <button onClick={() => setAdding(true)} className="mt-2 text-sm text-indigo-600 hover:underline">Add issues</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CyclesPage({ project, currentMember, onClickIssue }: Props) {
  // Planning structure is manager+ — matches the API's requireManager guard.
  const canManage = ['owner','admin','manager'].includes(currentMember?.role ?? '')
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [selected, setSelected] = useState<Cycle | null>(null)
  const [creating, setCreating] = useState(false)
  const EMPTY_FORM = { name: '', description: '', start_date: '', end_date: '' }
  const [form, setForm] = useState(EMPTY_FORM)

  // Surface inline errors only after the user has typed (avoids yelling at an empty form).
  const nameError = form.name.trim() ? validateMilestoneName(form.name) : null
  const dateError = validateDateOrder(form.start_date, form.end_date)
  const canCreate = !nameError && !dateError && form.name.trim().length > 0

  useEffect(() => {
    api.getCycles(project.id).then(setCycles)
  }, [project.id])

  function cancelCreate() {
    setForm(EMPTY_FORM)
    setCreating(false)
  }

  async function createCycle() {
    if (!canCreate) return
    try {
      await api.createCycle(project.id, { name: form.name.trim(), description: form.description, start_date: form.start_date || undefined, end_date: form.end_date || undefined })
    } catch (e: any) {
      alert(e?.message ?? 'Failed to create milestone')
      return
    }
    setForm(EMPTY_FORM)
    setCreating(false)
    setCycles(await api.getCycles(project.id))
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Milestones</h2>
            <p className="text-sm text-gray-500 mt-0.5">Time-boxed delivery goals</p>
          </div>
          {canManage && (
            <button onClick={() => setCreating(c => !c)}
              className="flex items-center gap-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              New milestone
            </button>
          )}
        </div>

        {creating && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-5">
            <h3 className="font-semibold text-gray-800 mb-4">Create milestone</h3>
            <div className="space-y-3">
              <div>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  maxLength={NAME_MAX_LEN} aria-invalid={!!nameError}
                  placeholder="Milestone name"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${nameError ? 'border-red-300 focus:ring-red-200' : 'focus:ring-indigo-300'}`} />
                {nameError && <p className="text-[11px] text-red-600 mt-1">{nameError}</p>}
              </div>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description (optional)" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Start date</label>
                    <input type="date" value={form.start_date}
                      max={form.end_date || undefined}
                      onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${dateError ? 'border-red-300 focus:ring-red-200' : 'focus:ring-indigo-300'}`} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">End date</label>
                    <input type="date" value={form.end_date}
                      min={form.start_date || undefined}
                      onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${dateError ? 'border-red-300 focus:ring-red-200' : 'focus:ring-indigo-300'}`} />
                  </div>
                </div>
                {dateError && <p className="text-[11px] text-red-600 mt-1">{dateError}</p>}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={createCycle} disabled={!canCreate}
                  className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors">Create</button>
                <button onClick={cancelCreate} className="text-sm text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {cycles.map(cycle => (
            <CycleCard key={cycle.id} cycle={cycle} projectId={project.id} onView={() => setSelected(cycle)} />
          ))}
          {cycles.length === 0 && !creating && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <svg className="w-14 h-14 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              <p className="text-gray-400">No cycles yet</p>
              <button onClick={() => setCreating(true)} className="mt-2 text-sm text-indigo-600 hover:underline">Create your first cycle</button>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <CycleDetail
          cycle={selected}
          project={project}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onClickIssue={i => { setSelected(null); onClickIssue(i) }}
          onChange={async () => setCycles(await api.getCycles(project.id))}
          onDeleted={async () => setCycles(await api.getCycles(project.id))}
        />
      )}
    </div>
  )
}
