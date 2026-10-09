'use client'
import { useState } from 'react'
import type { Member } from '@/lib/types'
import { Avatar } from './Avatar'
import AvatarStack from './AvatarStack'

interface Props {
  members: Member[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

export default function AssigneePicker({ members, selectedIds, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const selectedMembers = members.filter(m => selectedIds.includes(m.id))

  function toggle(id: string) {
    if (selectedIds.includes(id)) onChange(selectedIds.filter(x => x !== id))
    else onChange([...selectedIds, id])
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`w-full text-left text-xs border rounded p-1.5 bg-white flex items-center gap-2 min-h-[28px] ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-indigo-300'}`}>
        {selectedMembers.length > 0 ? (
          <>
            <AvatarStack members={selectedMembers} size={5} />
            <span className="text-gray-600 truncate">
              {selectedMembers.length === 1 ? selectedMembers[0].name : `${selectedMembers.length} assignees`}
            </span>
          </>
        ) : (
          <span className="text-gray-400 italic">Unassigned</span>
        )}
        <svg className="w-3 h-3 text-gray-400 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 right-0 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {members.length === 0 && <p className="text-xs text-gray-400 p-2 italic">No members</p>}
            {members.map(m => {
              const isSelected = selectedIds.includes(m.id)
              return (
                <button type="button" key={m.id} onClick={() => toggle(m.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-gray-50 ${isSelected ? 'bg-indigo-50' : ''}`}>
                  <input type="checkbox" checked={isSelected} readOnly className="rounded shrink-0" />
                  <Avatar name={m.name} size={5} />
                  <span className="text-gray-800 truncate flex-1 text-left">{m.name}</span>
                  <span className="text-[10px] text-gray-400">{m.role}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
