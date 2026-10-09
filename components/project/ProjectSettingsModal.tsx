'use client'
import { useState } from 'react'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { State, Label, Project, StateGroup } from '@/lib/types'
import { STATE_GROUP_CONFIG, validateLabelName, validateName, LABEL_NAME_MAX_LEN, NAME_MAX_LEN } from '@/lib/utils'
import { api } from '@/lib/api'

interface Props {
  projectId: string
  project: Project
  states: State[]
  labels: Label[]
  onClose: () => void
  onChange: () => void | Promise<void>
  onDelete: () => void | Promise<void>
}

const PALETTE = ['#6366F1','#8B5CF6','#EC4899','#EF4444','#F97316','#EAB308','#10B981','#14B8A6','#0EA5E9','#9CA3AF']

type Tab = 'general' | 'states' | 'labels'

export default function ProjectSettingsModal({ projectId, project, states, labels, onClose, onChange, onDelete }: Props) {
  const [tab, setTab] = useState<Tab>('general')
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    try { await fn(); await onChange() } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="font-semibold text-gray-800">Project settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 pt-3 border-b shrink-0">
          {(['general','states','labels'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm px-3 py-2 border-b-2 -mb-px transition-colors capitalize ${tab === t ? 'border-indigo-600 text-indigo-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'general' && <GeneralPanel project={project} busy={busy} run={run} onDelete={onDelete} />}
          {tab === 'states'  && <StatesPanel projectId={projectId} states={states} busy={busy} run={run} />}
          {tab === 'labels'  && <LabelsPanel projectId={projectId} labels={labels} busy={busy} run={run} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3 border-t bg-gray-50 shrink-0">
          <button onClick={onClose} className="text-sm text-gray-600 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors">Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── General (edit / delete) ─────────────────────────────────────────────

function GeneralPanel({ project, busy, run, onDelete }: {
  project: Project; busy: boolean
  run: (fn: () => Promise<unknown>) => Promise<void>
  onDelete: () => void | Promise<void>
}) {
  const [name, setName] = useState(project.name)
  const [identifier, setIdentifier] = useState(project.identifier)
  const [emoji, setEmoji] = useState(project.emoji)
  const [description, setDescription] = useState(project.description ?? '')
  const [savedFlash, setSavedFlash] = useState(false)

  const nameError = name.trim() ? validateName(name, 'Project name') : null
  const identError = identifier.trim() && !/^[A-Z][A-Z0-9_]{0,9}$/.test(identifier.trim().toUpperCase())
    ? 'Identifier: 1–10 chars, must start with a letter, letters/digits/underscores only.'
    : null
  const dirty = name !== project.name || identifier !== project.identifier || emoji !== project.emoji || description !== (project.description ?? '')
  const canSave = !nameError && !identError && name.trim().length > 0 && identifier.trim().length > 0 && dirty

  function save() {
    if (!canSave) return
    run(async () => {
      try {
        await api.updateProject(project.id, {
          name: name.trim(), identifier: identifier.trim().toUpperCase(),
          emoji: emoji || '📋', description,
        })
        setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500)
      } catch (e: any) { alert(e?.message ?? 'Failed to save') }
    })
  }

  function deleteProject() {
    const confirmText = project.name
    const typed = prompt(`This will permanently delete "${project.name}" and all of its issues, milestones, epics, wiki pages, and labels. This cannot be undone.\n\nType the project name to confirm:`)
    if (typed?.trim() !== confirmText) {
      if (typed !== null) alert('Project name did not match — deletion cancelled.')
      return
    }
    run(async () => {
      try {
        await api.deleteProject(project.id)
        await onDelete()
      } catch (e: any) {
        alert(e?.message ?? 'Failed to delete project (owner only).')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Project name</label>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={NAME_MAX_LEN}
          className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${nameError ? 'border-red-300 focus:ring-red-200' : 'focus:ring-indigo-200'}`} />
        {nameError && <p className="text-[11px] text-red-600 mt-1">{nameError}</p>}
      </div>

      <div className="flex gap-3">
        <div className="w-24">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Emoji</label>
          <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={4}
            className="w-full text-2xl text-center border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Identifier</label>
          <input value={identifier} onChange={e => setIdentifier(e.target.value.toUpperCase())} maxLength={10}
            className={`w-full text-sm font-mono uppercase border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${identError ? 'border-red-300 focus:ring-red-200' : 'focus:ring-indigo-200'}`} />
          {identError && <p className="text-[11px] text-red-600 mt-1">{identError}</p>}
          {!identError && <p className="text-[11px] text-gray-400 mt-1">Used as the issue prefix (e.g. <code>{identifier || 'MOBI'}-1</code>).</p>}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none" />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!canSave || busy}
          className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors font-medium">
          Save changes
        </button>
        {savedFlash && <span className="text-[11px] text-emerald-600">✓ Saved</span>}
      </div>

      {/* Danger zone */}
      <div className="mt-8 pt-5 border-t">
        <h3 className="text-sm font-semibold text-red-600 mb-1">Danger zone</h3>
        <p className="text-xs text-gray-500 mb-3">Deleting a project removes all its data permanently (issues, sub-issues, milestones, epics, wiki, labels, states, attachments). This action cannot be undone.</p>
        <button onClick={deleteProject} disabled={busy}
          className="text-sm text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors font-medium">
          Delete this project
        </button>
      </div>
    </div>
  )
}

// ─── States ───────────────────────────────────────────────────────────────

function StatesPanel({ projectId, states, busy, run }: { projectId: string; states: State[]; busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PALETTE[0])
  const [newGroup, setNewGroup] = useState<StateGroup>('unstarted')
  // Local order overrides the server order until the parent re-fetches (optimistic UX).
  const [localOrder, setLocalOrder] = useState<string[] | null>(null)
  const orderedStates = localOrder
    ? localOrder.map(id => states.find(s => s.id === id)!).filter(Boolean)
    : states

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = orderedStates.map(s => s.id)
    const oldIdx = ids.indexOf(active.id as string)
    const newIdx = ids.indexOf(over.id as string)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(ids, oldIdx, newIdx)
    setLocalOrder(next)  // optimistic
    run(() => api.reorderStates(projectId, next))
  }

  // Client-side inline errors: validate the name AND check for a case-insensitive duplicate
  // against the existing states. The server also enforces these (400 + 409) as authority.
  const trimmed = newName.trim()
  const nameError = trimmed ? validateName(newName, 'State name') : null
  const dupError = trimmed && states.some(s => s.name.toLowerCase() === trimmed.toLowerCase())
    ? `A state named "${trimmed}" already exists in this project.`
    : null
  const error = nameError ?? dupError
  const canAdd = !error && trimmed.length > 0 && !busy

  function add() {
    if (!canAdd) return
    run(async () => {
      try {
        await api.createState(projectId, { name: trimmed, color: newColor, group_type: newGroup })
        setNewName('')
        setLocalOrder(null)
      } catch (e: any) {
        alert(e?.message ?? 'Failed to create state')
      }
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-400 -mb-1">Drag the grip handle to reorder columns on the Board.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={orderedStates.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {orderedStates.map(s => <SortableStateRow key={s.id} projectId={projectId} state={s} busy={busy} run={run} otherNames={states.filter(x => x.id !== s.id).map(x => x.name.toLowerCase())} />)}
        </SortableContext>
      </DndContext>

      <div className="pt-3 border-t">
        <div className="flex items-center gap-2">
          <ColorDot color={newColor} options={PALETTE} onChange={setNewColor} />
          <input value={newName} onChange={e => setNewName(e.target.value)}
            maxLength={NAME_MAX_LEN} aria-invalid={!!error}
            placeholder="New state name"
            onKeyDown={e => e.key === 'Enter' && add()}
            className={`flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${error ? 'border-red-300 focus:ring-red-200' : 'focus:ring-indigo-200'}`} />
          <select value={newGroup} onChange={e => setNewGroup(e.target.value as StateGroup)}
            className="text-sm border rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200">
            {Object.entries(STATE_GROUP_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={add} disabled={!canAdd}
            className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-lg transition-colors font-medium">
            Add
          </button>
        </div>
        {error && <p className="text-[11px] text-red-600 mt-1.5 ml-9">{error}</p>}
      </div>
    </div>
  )
}

function SortableStateRow(props: { projectId: string; state: State; busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void>; otherNames: string[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.state.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2"
    >
      <button
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-1 -ml-1"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
        </svg>
      </button>
      <div className="flex-1 min-w-0">
        <StateRow {...props} />
      </div>
    </div>
  )
}

function StateRow({ projectId, state, busy, run, otherNames }: { projectId: string; state: State; busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void>; otherNames: string[] }) {
  const [name, setName] = useState(state.name)
  const trimmed = name.trim()
  const nameError = trimmed ? validateName(name, 'State name') : null
  const dupError = trimmed && otherNames.includes(trimmed.toLowerCase())
    ? `A state named "${trimmed}" already exists.`
    : null
  const error = nameError ?? dupError

  function rename() {
    if (error) { setName(state.name); return }        // invalid → revert silently
    if (trimmed === state.name) return                 // no change
    run(async () => {
      try { await api.updateState(projectId, state.id, { name: trimmed }) }
      catch (e: any) { alert(e?.message ?? 'Failed to rename state'); setName(state.name) }
    })
  }
  function recolor(color: string) { run(() => api.updateState(projectId, state.id, { color })) }
  function regroup(group_type: StateGroup) { run(() => api.updateState(projectId, state.id, { group_type })) }
  function remove() {
    if (!confirm(`Delete state "${state.name}"? Issues in this state will become un-stated.`)) return
    run(() => api.deleteState(projectId, state.id))
  }

  return (
    <div>
    <div className="flex items-center gap-2">
      <ColorDot color={state.color} options={PALETTE} onChange={recolor} />
      <input value={name} onChange={e => setName(e.target.value)} onBlur={rename}
        maxLength={NAME_MAX_LEN} aria-invalid={!!error}
        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className={`flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${error ? 'border-red-300 focus:ring-red-200' : 'focus:ring-indigo-200'}`} />
      <select value={state.group_type} onChange={e => regroup(e.target.value as StateGroup)}
        className="text-sm border rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200">
        {Object.entries(STATE_GROUP_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <button onClick={remove} disabled={busy}
        className="text-gray-400 hover:text-red-500 p-2 rounded transition-colors" title="Delete">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>
    </div>
    {error && trimmed !== state.name && <p className="text-[11px] text-red-600 mt-1 ml-9">{error}</p>}
    </div>
  )
}

// ─── Labels ───────────────────────────────────────────────────────────────

function LabelsPanel({ projectId, labels, busy, run }: { projectId: string; labels: Label[]; busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PALETTE[5])
  // Only show the error once the user has started typing — avoids "required" yelling at an empty field.
  const trimmed = newName.trim()
  const nameError = trimmed ? validateLabelName(newName) : null
  const dupError = trimmed && labels.some(l => l.name.toLowerCase() === trimmed.toLowerCase())
    ? `A label named "${trimmed}" already exists in this project.`
    : null
  const error = nameError ?? dupError
  const canAdd = !error && trimmed.length > 0 && !busy

  function add() {
    if (!canAdd) return
    run(async () => {
      try {
        await api.createLabel(projectId, { name: trimmed, color: newColor })
        setNewName('')
      } catch (e: any) {
        alert(e?.message ?? 'Failed to create label')
      }
    })
  }

  return (
    <div className="space-y-3">
      {labels.length === 0 && <p className="text-xs text-gray-400 italic">No labels yet</p>}
      {labels.map(l => <LabelRow key={l.id} projectId={projectId} label={l} busy={busy} run={run} otherNames={labels.filter(x => x.id !== l.id).map(x => x.name.toLowerCase())} />)}

      <div className="pt-3 border-t">
        <div className="flex items-center gap-2">
          <ColorDot color={newColor} options={PALETTE} onChange={setNewColor} />
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="New label name"
            maxLength={LABEL_NAME_MAX_LEN}
            aria-invalid={!!error}
            onKeyDown={e => e.key === 'Enter' && add()}
            className={`flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${error ? 'border-red-300 focus:ring-red-200' : 'focus:ring-indigo-200'}`} />
          <button onClick={add} disabled={!canAdd}
            className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors font-medium">
            Add
          </button>
        </div>
        {error && <p className="text-[11px] text-red-600 mt-1.5 ml-9">{error}</p>}
      </div>
    </div>
  )
}

function LabelRow({ projectId, label, busy, run, otherNames }: { projectId: string; label: Label; busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void>; otherNames: string[] }) {
  const [name, setName] = useState(label.name)
  const trimmed = name.trim()
  const nameError = trimmed ? validateLabelName(name) : null
  const dupError = trimmed && otherNames.includes(trimmed.toLowerCase())
    ? `A label named "${trimmed}" already exists.`
    : null
  const error = nameError ?? dupError

  function rename() {
    if (error) { setName(label.name); return }      // invalid → revert silently
    if (trimmed === label.name) return               // no change
    run(async () => {
      try { await api.updateLabel(projectId, label.id, { name: trimmed }) }
      catch (e: any) { alert(e?.message ?? 'Failed to rename label'); setName(label.name) }
    })
  }
  function recolor(color: string) { run(() => api.updateLabel(projectId, label.id, { color })) }
  function remove() {
    if (!confirm(`Delete label "${label.name}"?`)) return
    run(() => api.deleteLabel(projectId, label.id))
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <ColorDot color={label.color} options={PALETTE} onChange={recolor} />
        <input value={name} onChange={e => setName(e.target.value)} onBlur={rename}
          maxLength={LABEL_NAME_MAX_LEN}
          aria-invalid={!!error}
          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={`flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${error ? 'border-red-300 focus:ring-red-200' : 'focus:ring-indigo-200'}`} />
        <button onClick={remove} disabled={busy}
          className="text-gray-400 hover:text-red-500 p-2 rounded transition-colors" title="Delete">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600 mt-1.5 ml-9">{error}</p>}
    </div>
  )
}

// ─── Color swatch picker ─────────────────────────────────────────────────

function ColorDot({ color, options, onChange }: { color: string; options: string[]; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-6 h-6 rounded-full border-2 border-white shadow ring-1 ring-gray-200 shrink-0"
        style={{ backgroundColor: color }} title="Change color" />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-8 left-0 bg-white shadow-lg rounded-lg p-2 border grid grid-cols-5 gap-1.5 w-44">
            {options.map(c => (
              <button key={c} onClick={() => { onChange(c); setOpen(false) }}
                className="w-6 h-6 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
