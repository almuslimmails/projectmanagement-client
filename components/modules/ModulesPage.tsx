'use client'
import { useState, useEffect } from 'react'
import type { Module, Issue, Project, Member } from '@/lib/types'
import { api } from '@/lib/api'
import { fmtDate, formatIssueCode, validateEpicName, validateDateOrder, NAME_MAX_LEN } from '@/lib/utils'
import IssueRow from '@/components/issue/IssueRow'

interface Props {
  project: Project
  currentMember: Member | null
  onClickIssue: (issue: Issue) => void
}

const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

function ProgressBar({ pct, color = 'bg-indigo-500' }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-full">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function ModuleCard({ mod, onView }: { mod: Module; onView: () => void }) {
  const statusColor = STATUS_COLORS[mod.status] ?? STATUS_COLORS.backlog

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={onView}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${statusColor}`}>
              {mod.status.replace('_', ' ')}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 truncate">{mod.name}</h3>
          {mod.description && <p className="text-sm text-gray-500 mt-0.5 truncate">{mod.description}</p>}
        </div>
        <div className="text-right shrink-0">
          {(mod.start_date || mod.target_date) && (
            <p className="text-xs text-gray-500">
              {mod.start_date ? fmtDate(mod.start_date) : '—'} → {mod.target_date ? fmtDate(mod.target_date) : '—'}
            </p>
          )}
          <p className="text-sm font-semibold text-gray-700 mt-1">{mod.issue_count} issues</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <ProgressBar pct={(mod.progress ?? 0)} />
        <span className="text-xs font-medium text-gray-600 shrink-0">{Math.round((mod.progress ?? 0))}%</span>
      </div>
    </div>
  )
}

function ModuleDetail({ mod: initialMod, project, isOwner, onClose, onClickIssue, onChange, onDeleted }: {
  mod: Module; project: Project; isOwner: boolean; onClose: () => void; onClickIssue: (i: Issue) => void; onChange?: () => void; onDeleted?: () => void
}) {
  const [mod, setMod] = useState(initialMod)
  const [issues, setIssues] = useState<Issue[]>([])
  const [allIssues, setAllIssues] = useState<Issue[]>([])
  const [adding, setAdding] = useState(false)

  // Edit form — same shape as the create form, populated from `mod`.
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: mod.name,
    description: mod.description ?? '',
    status: mod.status ?? 'backlog',
    start_date: mod.start_date ?? '',
    end_date: mod.target_date ?? '',
  })
  function beginEdit() {
    setForm({
      name: mod.name,
      description: mod.description ?? '',
      status: mod.status ?? 'backlog',
      start_date: mod.start_date ?? '',
      end_date: mod.target_date ?? '',
    })
    setEditing(true)
  }

  const nameError = form.name.trim() ? validateEpicName(form.name) : null
  const dateError = validateDateOrder(form.start_date, form.end_date)
  const canSave = !nameError && !dateError && form.name.trim().length > 0

  async function save() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const updated: any = await api.updateModule(project.id, mod.id, {
        name: form.name.trim(),
        description: form.description,
        status: form.status,
        start_date: form.start_date || null,
        target_date: form.end_date || null,
      })
      setMod(prev => ({ ...prev, ...updated }))
      setEditing(false)
      onChange?.()
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update epic')
    } finally { setSaving(false) }
  }

  async function deleteThisModule() {
    if (!isOwner) return
    if (!confirm(`Delete epic "${mod.name}"? Its ${issues.length} linked issue${issues.length === 1 ? '' : 's'} will remain but lose their epic link. This cannot be undone.`)) return
    try {
      await api.deleteModule(project.id, mod.id)
    } catch (e: any) {
      alert(e?.message ?? 'Failed to delete epic')
      return
    }
    onDeleted?.()
    onClose()
  }

  useEffect(() => {
    api.getModuleIssues(project.id, mod.id).then(setIssues)
    api.getIssues(project.id).then(setAllIssues)
  }, [mod.id, project.id])

  async function addIssue(issueId: string) {
    await api.addIssueToModule(project.id, mod.id, issueId)
    setIssues(await api.getModuleIssues(project.id, mod.id))
  }

  async function removeIssue(issueId: string) {
    await api.removeIssueFromModule(project.id, mod.id, issueId)
    setIssues(await api.getModuleIssues(project.id, mod.id))
  }

  const issueIds = new Set(issues.map(i => i.id))
  const available = allIssues.filter(i => !issueIds.has(i.id))
  const statusColor = STATUS_COLORS[mod.status] ?? STATUS_COLORS.backlog

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto flex flex-col bg-white shadow-2xl w-full max-w-2xl h-full overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${statusColor}`}>
                {mod.status.replace('_', ' ')}
              </span>
            </div>
            <h2 className="font-semibold text-gray-900">{mod.name}</h2>
            {mod.description && <p className="text-sm text-gray-500">{mod.description}</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right w-32">
              <p className="text-xs text-gray-500">{Math.round((mod.progress ?? 0))}% complete</p>
              <ProgressBar pct={(mod.progress ?? 0)} />
            </div>
            {!editing && isOwner && (
              <button onClick={beginEdit} title="Edit epic"
                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
            )}
            {!editing && isOwner && (
              <button onClick={deleteThisModule} title="Delete epic"
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
                    <option value="backlog">Backlog</option>
                    <option value="in_progress">In Progress</option>
                    <option value="paused">Paused</option>
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
              <p className="text-gray-400 text-sm">No issues in this module</p>
              <button onClick={() => setAdding(true)} className="mt-2 text-sm text-indigo-600 hover:underline">Add issues</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ModulesPage({ project, currentMember, onClickIssue }: Props) {
  const isOwner = currentMember?.role === 'owner'
  const [modules, setModules] = useState<Module[]>([])
  const [selected, setSelected] = useState<Module | null>(null)
  const [creating, setCreating] = useState(false)
  const EMPTY_FORM = { name: '', description: '', status: 'backlog', start_date: '', end_date: '' }
  const [form, setForm] = useState(EMPTY_FORM)

  const nameError = form.name.trim() ? validateEpicName(form.name) : null
  const dateError = validateDateOrder(form.start_date, form.end_date)
  const canCreate = !nameError && !dateError && form.name.trim().length > 0

  useEffect(() => {
    api.getModules(project.id).then(setModules)
  }, [project.id])

  function cancelCreate() {
    setForm(EMPTY_FORM)
    setCreating(false)
  }

  async function createModule() {
    if (!canCreate) return
    try {
      await api.createModule(project.id, { name: form.name.trim(), description: form.description, status: form.status as any, start_date: form.start_date || undefined, target_date: form.end_date || undefined })
    } catch (e: any) {
      alert(e?.message ?? 'Failed to create epic')
      return
    }
    setForm(EMPTY_FORM)
    setCreating(false)
    setModules(await api.getModules(project.id))
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Epics</h2>
            <p className="text-sm text-gray-500 mt-0.5">Feature areas and workstreams</p>
          </div>
          <button onClick={() => setCreating(c => !c)}
            className="flex items-center gap-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            New epic
          </button>
        </div>

        {creating && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-5">
            <h3 className="font-semibold text-gray-800 mb-4">Create epic</h3>
            <div className="space-y-3">
              <div>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  maxLength={NAME_MAX_LEN} aria-invalid={!!nameError}
                  placeholder="Epic name"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${nameError ? 'border-red-300 focus:ring-red-200' : 'focus:ring-indigo-300'}`} />
                {nameError && <p className="text-[11px] text-red-600 mt-1">{nameError}</p>}
              </div>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description (optional)" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <div className="flex gap-3">
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="backlog">Backlog</option>
                  <option value="in_progress">In Progress</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
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
                <button onClick={createModule} disabled={!canCreate}
                  className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors">Create</button>
                <button onClick={cancelCreate} className="text-sm text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map(mod => (
            <ModuleCard key={mod.id} mod={mod} onView={() => setSelected(mod)} />
          ))}
        </div>

        {modules.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <svg className="w-14 h-14 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
            <p className="text-gray-400">No modules yet</p>
            <button onClick={() => setCreating(true)} className="mt-2 text-sm text-indigo-600 hover:underline">Create your first module</button>
          </div>
        )}
      </div>

      {selected && (
        <ModuleDetail
          mod={selected}
          project={project}
          isOwner={isOwner}
          onClose={() => setSelected(null)}
          onClickIssue={i => { setSelected(null); onClickIssue(i) }}
          onChange={async () => setModules(await api.getModules(project.id))}
          onDeleted={async () => setModules(await api.getModules(project.id))}
        />
      )}
    </div>
  )
}
