'use client'
import { useState } from 'react'

interface Props {
  onClose: () => void
  onCreate: (data: { name: string; identifier: string; emoji: string; description: string }) => void
}

const EMOJIS = ['📋', '🚀', '⚡', '🎯', '🔧', '🌟', '📦', '🎨', '🔥', '💡', '🧩', '🛠️', '📊', '🌈', '🏗️']

function genIdentifier(name: string) {
  return name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'PRJ'
}

export default function CreateProjectModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [emoji, setEmoji] = useState('📋')
  const [description, setDescription] = useState('')

  function handleNameChange(v: string) {
    setName(v)
    if (!identifier || identifier === genIdentifier(name)) {
      setIdentifier(genIdentifier(v))
    }
  }

  function submit() {
    if (!name.trim() || !identifier.trim()) return
    onCreate({ name: name.trim(), identifier: identifier.trim().toUpperCase(), emoji, description })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Create project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Emoji picker */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Icon</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  className={`text-2xl p-1.5 rounded-lg transition-colors ${emoji === e ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'hover:bg-gray-100'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Project name</label>
            <input autoFocus value={name} onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. Backend API"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Identifier</label>
            <input value={identifier} onChange={e => setIdentifier(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="e.g. BACK"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 font-mono" />
            <p className="text-xs text-gray-400 mt-1">Used as issue prefix: {identifier || 'PRJ'}-1, {identifier || 'PRJ'}-2…</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What is this project about?"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} className="text-sm text-gray-600 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors">Cancel</button>
          <button onClick={submit} disabled={!name.trim() || !identifier.trim()}
            className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-5 py-2 rounded-lg transition-colors font-medium">
            Create project
          </button>
        </div>
      </div>
    </div>
  )
}
