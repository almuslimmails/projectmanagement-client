'use client'

// Raise a task request on the Procurement board. Open to every signed-in
// member; a manager processes it afterwards.
import { useState } from 'react'
import type { Project, ProcurementRequest, ProcurementType, Priority } from '@/lib/types'
import { api, errorMessage } from '@/lib/api'
import { PRIORITY_CONFIG, ISSUE_TYPE_CONFIG } from '@/lib/utils'

const TYPES: ProcurementType[] = ['task', 'issue', 'enhancement']
const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low', 'none']

export default function NewRequestModal({ projects, onClose, onCreated }: {
  projects: Project[]
  onClose: () => void
  onCreated: (r: ProcurementRequest) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<ProcurementType>('task')
  const [priority, setPriority] = useState<Priority>('none')
  const [neededBy, setNeededBy] = useState('')
  const [board, setBoard] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Give the request a title.'); return }
    setBusy(true); setError(null)
    try {
      const r = await api.createProcurementRequest({
        title: title.trim(), description, type, priority,
        needed_by: neededBy || null, suggested_project_id: board || null,
      }) as ProcurementRequest
      onCreated(r)
    } catch (err) {
      setError(errorMessage(err, 'Could not raise the request'))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form onSubmit={submit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">New request</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">A manager reviews it and sends it to the right board.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <label className="block">
            <span className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold block mb-1">What do you need?</span>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} maxLength={200}
              placeholder="e.g. Add a CSV export to the bookings report"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold block mb-1">Details</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5}
              placeholder="Why it's needed, what done looks like, links, who asked…"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold block mb-1">Type</span>
              <select value={type} onChange={e => setType(e.target.value as ProcurementType)}
                className="w-full text-sm border rounded-lg px-2.5 py-2 bg-white">
                {TYPES.map(t => <option key={t} value={t}>{ISSUE_TYPE_CONFIG[t].icon} {ISSUE_TYPE_CONFIG[t].label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold block mb-1">Priority</span>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
                className="w-full text-sm border rounded-lg px-2.5 py-2 bg-white">
                {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold block mb-1">Needed by</span>
              <input type="date" value={neededBy} onChange={e => setNeededBy(e.target.value)}
                className="w-full text-sm border rounded-lg px-2.5 py-1.5" />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold block mb-1">Probably for</span>
              <select value={board} onChange={e => setBoard(e.target.value)}
                className="w-full text-sm border rounded-lg px-2.5 py-2 bg-white">
                <option value="">Not sure</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
              </select>
            </label>
          </div>
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-3 border-t bg-gray-50 shrink-0">
          <button type="button" onClick={onClose} className="text-sm text-gray-600 hover:bg-gray-200 px-4 py-2 rounded-lg">Cancel</button>
          <button type="submit" disabled={busy || !title.trim()}
            className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg">
            {busy ? 'Raising…' : 'Raise request'}
          </button>
        </div>
      </form>
    </div>
  )
}
