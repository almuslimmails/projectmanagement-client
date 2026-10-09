'use client'
import { useState } from 'react'

interface Props {
  onClose: () => void
  onCreate: (data: { name: string; email: string; role: string }) => void
}

export default function CreateMemberModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')

  function submit() {
    if (!name.trim()) return
    onCreate({ name: name.trim(), email: email.trim(), role })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Add member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="Full name"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200">
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="manager">Project manager</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <p className="text-[11px] text-gray-400 mt-1">Owners, Admins and Project managers can change start/due dates.</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} className="text-sm text-gray-600 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors">Cancel</button>
          <button onClick={submit} disabled={!name.trim()}
            className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-5 py-2 rounded-lg transition-colors font-medium">
            Add member
          </button>
        </div>
      </div>
    </div>
  )
}
