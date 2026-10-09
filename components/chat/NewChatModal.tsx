'use client'
import { useMemo, useState } from 'react'
import type { Member } from '@/lib/types'
import { Avatar } from '@/components/ui/Avatar'

const STATUS_DOT: Record<string, string> = {
  online: 'bg-emerald-500',
  break: 'bg-amber-400',
  offline: 'bg-gray-300',
}

// Curated emoji set for group icons (first is the default).
const GROUP_ICONS = ['💬', '👥', '🚀', '🎯', '🔥', '⭐', '📌', '🛠️', '🐛', '📣', '🎨', '💡', '📊', '🏆', '☕', '🎉']

interface Props {
  members: Member[]
  presence: Record<string, string>
  onClose: () => void
  onStartDM: (memberId: string) => void
  onCreateGroup: (name: string, memberIds: string[], opts: { description: string; icon: string }) => void
}

export default function NewChatModal({ members, presence, onClose, onStartDM, onCreateGroup }: Props) {
  const [tab, setTab] = useState<'dm' | 'group'>('dm')
  const [search, setSearch] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [icon, setIcon] = useState<string>(GROUP_ICONS[0])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return members
    return members.filter(m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
  }, [members, search])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const canCreateGroup = groupName.trim().length > 0 && selected.size >= 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        {/* Header + tabs */}
        <div className="px-5 pt-4 pb-0 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">New conversation</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex gap-1 -mb-px">
            {(['dm', 'group'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t === 'dm' ? 'Direct message' : 'Group'}
              </button>
            ))}
          </div>
        </div>

        {/* Group name + icon + description */}
        {tab === 'group' && (
          <div className="px-5 pt-3 space-y-2.5">
            <div className="flex items-center gap-2">
              {/* Live icon preview */}
              <span className="w-10 h-10 shrink-0 rounded-lg bg-indigo-50 flex items-center justify-center text-xl leading-none">
                {icon || '👥'}
              </span>
              <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
            </div>

            {/* Icon picker */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Icon</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {GROUP_ICONS.map(em => (
                  <button key={em} type="button" onClick={() => setIcon(em)}
                    className={`w-8 h-8 rounded-md flex items-center justify-center text-lg leading-none transition-colors ${icon === em ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'hover:bg-gray-100'}`}>
                    {em}
                  </button>
                ))}
              </div>
            </div>

            <textarea value={groupDesc} onChange={e => setGroupDesc(e.target.value)} rows={2}
              placeholder="Description (optional)"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
          </div>
        )}

        {/* Search */}
        <div className="px-5 pt-3 pb-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
        </div>

        {/* Member list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-6">No members found.</p>}
          {filtered.map(m => {
            const status = presence[m.id] ?? 'offline'
            const isSel = selected.has(m.id)
            return (
              <button key={m.id}
                onClick={() => tab === 'dm' ? onStartDM(m.id) : toggle(m.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${isSel ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                <div className="relative shrink-0">
                  <Avatar name={m.name} size={8} />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white ${STATUS_DOT[status] ?? STATUS_DOT.offline}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                  <p className="text-xs text-gray-400 truncate">{m.email || m.role}</p>
                </div>
                {tab === 'group' && (
                  <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSel ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                    {isSel && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Group footer */}
        {tab === 'group' && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">{selected.size} selected</span>
            <button disabled={!canCreateGroup} onClick={() => onCreateGroup(groupName.trim(), [...selected], { description: groupDesc.trim(), icon })}
              className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors">
              Create group
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
