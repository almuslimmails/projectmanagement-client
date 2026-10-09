'use client'
import { useState } from 'react'
import type { Label } from '@/lib/types'

interface Props {
  labels: Label[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  /** A custom trigger; default is a small "+ label" chip. */
  trigger?: React.ReactNode
  align?: 'left' | 'right'
  /** Hide already-applied labels — picker becomes add-only (removal handled elsewhere). */
  hideSelected?: boolean
}

export default function LabelPicker({ labels, selectedIds, onChange, trigger, align = 'left', hideSelected = false }: Props) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')

  function toggle(id: string) {
    if (selectedIds.includes(id)) onChange(selectedIds.filter(x => x !== id))
    else onChange([...selectedIds, id])
  }

  const visible = labels
    .filter(l => !filter || l.name.toLowerCase().includes(filter.toLowerCase()))
    .filter(l => !hideSelected || !selectedIds.includes(l.id))

  return (
    <span
      className="relative inline-block"
      // Stop card-level click handlers (open issue detail) from firing.
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-indigo-700 hover:bg-indigo-50 px-1.5 py-0.5 rounded-full border border-dashed border-gray-300 hover:border-indigo-300 transition-colors"
      >
        {trigger ?? (
          <>
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
            </svg>
            label
          </>
        )}
      </button>

      {open && (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-20 mt-1 w-56 bg-white border rounded-lg shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}
          >
            <div className="p-2 border-b">
              <input
                autoFocus
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filter labels…"
                className="w-full text-xs bg-gray-50 border-0 rounded px-2 py-1 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200"
              />
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {visible.length === 0 ? (
                <p className="text-[11px] text-gray-400 italic px-3 py-2">
                  {hideSelected && selectedIds.length === labels.length
                    ? 'All labels already added'
                    : 'No matching labels'}
                </p>
              ) : visible.map(l => {
                const isSelected = selectedIds.includes(l.id)
                return (
                  <button
                    key={l.id}
                    onClick={() => toggle(l.id)}
                    title={isSelected ? 'Click to remove' : 'Click to add'}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-gray-50 ${isSelected ? 'bg-indigo-50/60 font-semibold text-indigo-900' : 'text-gray-700'}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                    <span className="flex-1 text-left truncate">{l.name}</span>
                    {isSelected && <span className="text-[10px] text-indigo-500/70 shrink-0">added</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </span>
  )
}
