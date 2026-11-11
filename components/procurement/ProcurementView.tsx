'use client'

// Procurement — the task intake board that sits apart from the project boards.
// Anyone raises a request; owners/admins/managers process it: review it, move
// it through New → In review → Accepted, then send it to a project board
// (which creates a real card there) or decline it with a reason.
// Non-processors see only the requests they raised.
import { useEffect, useMemo, useState } from 'react'
import {
  DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent,
} from '@dnd-kit/core'
import type { Member, Project, ProcurementRequest, ProcurementStatus, Priority } from '@/lib/types'
import { api, errorMessage } from '@/lib/api'
import { fmtDate, isOverdue, PRIORITY_CONFIG, ISSUE_TYPE_CONFIG } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { PriorityIcon } from '@/components/ui/PriorityIcon'
import RequestDetail from './RequestDetail'
import NewRequestModal from './NewRequestModal'
import { COLUMNS, PROCESSOR_ROLES, OPEN_STATUSES as OPEN, notifyProcurementChanged } from './shared'

interface Props {
  currentMember: Member | null
  members: Member[]
  projects: Project[]
  onOpenCard: (projectId: string, issueId: string) => void
  header?: React.ReactNode
}

export default function ProcurementView({ currentMember, members, projects, onOpenCard, header }: Props) {
  const isProcessor = PROCESSOR_ROLES.includes(currentMember?.role ?? '')
  const [requests, setRequests] = useState<ProcurementRequest[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [mineOnly, setMineOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)


  useEffect(() => {
    let alive = true
    api.getProcurementRequests({ mine: mineOnly })
      .then((rows: ProcurementRequest[]) => { if (alive) { setRequests(rows); setFailed(null) } })
      .catch(e => { if (alive) setFailed(errorMessage(e, 'Could not load requests')) })
    return () => { alive = false }
  }, [mineOnly, currentMember?.id])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!requests) return []
    if (!q) return requests
    return requests.filter(r =>
      r.title.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) ||
      (r.requester?.name ?? '').toLowerCase().includes(q))
  }, [requests, search])

  const byStatus = useMemo(() => {
    const out: Record<string, ProcurementRequest[]> = {}
    for (const c of COLUMNS) out[c.id] = []
    for (const r of visible) (out[r.status] ??= []).push(r)
    return out
  }, [visible])

  function replaceRequest(r: ProcurementRequest) {
    setRequests(prev => prev ? prev.map(x => x.id === r.id ? { ...x, ...r } : x) : prev)
    notifyProcurementChanged()
  }
  function removeRequest(id: string) {
    setRequests(prev => prev ? prev.filter(x => x.id !== id) : prev)
    setSelectedId(null)
    notifyProcurementChanged()
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  async function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id)
    const to = e.over?.id ? String(e.over.id).replace(/^col:/, '') as ProcurementStatus : null
    const req = requests?.find(r => r.id === id)
    if (!req || !to || req.status === to) return
    if (!OPEN.includes(to) || !OPEN.includes(req.status)) {
      setMoveError(to === 'routed' ? 'Open the request and use "Send to board" — it needs a board and assignees.'
        : to === 'declined' ? 'Open the request and use "Decline" — the requester needs a reason.'
        : 'Only open requests can be moved.')
      return
    }
    setMoveError(null)
    const prevStatus = req.status
    setRequests(prev => prev ? prev.map(x => x.id === id ? { ...x, status: to } : x) : prev)  // optimistic
    try {
      const fresh = await api.updateProcurementRequest(id, { status: to }) as ProcurementRequest
      replaceRequest(fresh)
    } catch (err) {
      setRequests(prev => prev ? prev.map(x => x.id === id ? { ...x, status: prevStatus } : x) : prev)
      setMoveError(errorMessage(err, 'Could not move the request'))
    }
  }

  const openCount = (requests ?? []).filter(r => OPEN.includes(r.status)).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {header}
      {/* Title bar */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="min-w-0">
          <h1 className="font-extrabold text-gray-900 text-[15px] leading-tight flex items-center gap-2">
            <span aria-hidden>📥</span> Procurement
            <span className="text-[11px] font-mono text-gray-400 tracking-wider">{openCount} open</span>
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {isProcessor
              ? 'Every task request lands here first. Review it, then send it to the right board or decline it.'
              : 'Raise a task request here. A manager reviews it and sends it to the right board.'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requests…"
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          {isProcessor && (
            <div className="flex text-xs border border-gray-200 rounded-lg overflow-hidden">
              {[false, true].map(m => (
                <button key={String(m)} onClick={() => setMineOnly(m)}
                  className={`px-2.5 py-1.5 ${mineOnly === m ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {m ? 'Raised by me' : 'All requests'}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 px-3.5 py-2 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
            New request
          </button>
        </div>
      </div>

      {moveError && (
        <div className="mx-5 mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex justify-between gap-3">
          <span>{moveError}</span>
          <button onClick={() => setMoveError(null)} className="text-amber-700 hover:text-amber-900">Dismiss</button>
        </div>
      )}

      {/* Board */}
      {failed ? (
        <div className="p-8 text-sm text-gray-500">{failed}</div>
      ) : requests === null ? (
        <div className="p-8 text-sm text-gray-400">Loading requests…</div>
      ) : requests.length === 0 && !isProcessor ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-3xl">📥</div>
          <p className="text-gray-700 font-semibold">You haven&apos;t raised any requests yet</p>
          <p className="text-sm text-gray-500 max-w-sm">Need something done? Raise a request and a manager will pick it up and put it on the right board.</p>
          <button onClick={() => setShowNew(true)} className="mt-1 text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg">Raise a request</button>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 p-4 h-full min-w-max">
              {COLUMNS.map(col => (
                <Column key={col.id} col={col} items={byStatus[col.id] ?? []}
                  droppable={isProcessor && OPEN.includes(col.id)} draggable={isProcessor}
                  onOpen={setSelectedId} />
              ))}
            </div>
          </div>
        </DndContext>
      )}

      {showNew && (
        <NewRequestModal projects={projects}
          onClose={() => setShowNew(false)}
          onCreated={r => {
            setRequests(prev => [r, ...(prev ?? [])])
            setShowNew(false)
            setSelectedId(r.id)
            notifyProcurementChanged()
          }} />
      )}

      {selectedId && (
        <RequestDetail key={selectedId} requestId={selectedId} currentMember={currentMember} members={members} projects={projects}
          onClose={() => setSelectedId(null)}
          onChanged={replaceRequest}
          onDeleted={removeRequest}
          onOpenCard={onOpenCard} />
      )}
    </div>
  )
}

function Column({ col, items, droppable, draggable, onOpen }: {
  col: typeof COLUMNS[number]; items: ProcurementRequest[]
  droppable: boolean; draggable: boolean
  onOpen: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col.id}`, disabled: !droppable })
  return (
    <div ref={setNodeRef}
      className={`w-72 shrink-0 flex flex-col rounded-xl border ${isOver ? 'border-indigo-300 bg-indigo-50/60' : 'border-gray-200 bg-gray-50'} max-h-full`}>
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.dot }} />
          <span className="text-sm font-semibold text-gray-800">{col.label}</span>
          <span className="text-xs text-gray-400">{items.length}</span>
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">{col.hint}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {items.map(r => <Card key={r.id} r={r} draggable={draggable && OPEN.includes(r.status)} onOpen={onOpen} />)}
        {items.length === 0 && <p className="text-[11px] text-gray-300 text-center py-6">Nothing here</p>}
      </div>
    </div>
  )
}

function Card({ r, draggable, onOpen }: { r: ProcurementRequest; draggable: boolean; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: r.id, disabled: !draggable })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined
  const overdue = r.needed_by && OPEN.includes(r.status) && isOverdue(r.needed_by)
  const type = ISSUE_TYPE_CONFIG[r.type]
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      onClick={() => onOpen(r.id)}
      className={`bg-white border border-gray-200 rounded-lg px-3 py-2.5 shadow-sm hover:border-indigo-200 hover:shadow cursor-pointer select-none ${isDragging ? 'opacity-70 shadow-lg z-10 relative' : ''}`}>
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-mono">
        <span title={type?.label}>{type?.icon}</span>
        <span>{r.code}</span>
        <span className="ml-auto flex items-center gap-1" title={`Priority: ${PRIORITY_CONFIG[r.priority as Priority]?.label}`}>
          <PriorityIcon priority={r.priority as Priority} size={12} />
        </span>
      </div>
      <p className="text-sm text-gray-800 font-medium mt-1 line-clamp-2">{r.title}</p>
      {r.status === 'routed' && r.routed_issue && (
        <p className="text-[11px] text-sky-700 mt-1">→ {r.routed_issue.code}</p>
      )}
      {r.status === 'declined' && r.decline_reason && (
        <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">“{r.decline_reason}”</p>
      )}
      <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-500">
        {r.requester && <span className="flex items-center gap-1 min-w-0"><Avatar name={r.requester.name} size={4} /><span className="truncate max-w-[90px]">{r.requester.name}</span></span>}
        {r.suggested_project && r.status !== 'routed' && (
          <span className="truncate max-w-[80px] bg-gray-100 rounded px-1.5" title={`Suggested board: ${r.suggested_project.name}`}>{r.suggested_project.identifier}</span>
        )}
        <span className="ml-auto flex items-center gap-2 shrink-0">
          {r.comment_count > 0 && <span title="Comments">💬 {r.comment_count}</span>}
          {r.needed_by && <span className={overdue ? 'text-red-600 font-medium' : ''} title="Needed by">{fmtDate(r.needed_by)}</span>}
        </span>
      </div>
      {r.handler && OPEN.includes(r.status) && (
        <p className="text-[10px] text-gray-400 mt-1">Handler: {r.handler.name}</p>
      )}
    </div>
  )
}
