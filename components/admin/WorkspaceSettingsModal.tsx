'use client'
import { useEffect, useMemo, useState } from 'react'
import type { Member, Role } from '@/lib/types'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'

interface Props {
  members: Member[]
  currentMember: Member | null
  onClose: () => void
  onMembersChanged: () => void | Promise<void>
  onPermissionsChanged?: (perms: Record<string, string[]>) => void
}

const ROLES: Role[] = ['owner', 'admin', 'manager', 'member', 'viewer']
const MENU_OPTIONS: { id: string; label: string }[] = [
  { id: 'dashboard',   label: 'Dashboard' },
  { id: 'board',       label: 'Board' },
  { id: 'list',        label: 'Issues' },
  { id: 'spreadsheet', label: 'Spreadsheet' },
  { id: 'gantt',       label: 'Gantt' },
  { id: 'cycles',      label: 'Milestones' },
  { id: 'modules',     label: 'Epics' },
  { id: 'wiki',        label: 'Wiki' },
  { id: 'attendance',  label: 'Attendance' },
  { id: 'chat',        label: 'Chat' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'ai',            label: 'Artificial Intelligence' },
]

export default function WorkspaceSettingsModal({ members, currentMember, onClose, onMembersChanged, onPermissionsChanged }: Props) {
  const [tab, setTab] = useState<'members' | 'roles' | 'data'>('members')
  const [busy, setBusy] = useState(false)
  const isOwner = currentMember?.role === 'owner'

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    try { await fn() } catch (e: any) { alert(e?.message ?? 'Action failed') } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">Workspace settings</h2>
            {!isOwner && <p className="text-[11px] text-gray-500 mt-0.5">Read-only — only owners can change roles or permissions.</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>

        <div className="flex gap-2 px-6 pt-3 border-b shrink-0">
          {(isOwner ? ['members','roles','data'] as const : ['members','roles'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm px-3 py-2 border-b-2 -mb-px transition-colors capitalize ${tab === t ? 'border-indigo-600 text-indigo-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t === 'members' ? `Members (${members.length})` : t === 'roles' ? 'Role permissions' : 'Demo data'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'members'
            ? <MembersTab members={members} isOwner={isOwner} busy={busy} run={run} onChanged={onMembersChanged} />
            : tab === 'roles'
            ? <RolePermissionsTab isOwner={isOwner} busy={busy} run={run} onChanged={onPermissionsChanged} />
            : <DemoDataTab busy={busy} run={run} />}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-3 border-t bg-gray-50 shrink-0">
          <button onClick={onClose} className="text-sm text-gray-600 hover:bg-gray-200 px-4 py-2 rounded-lg">Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Members tab ─────────────────────────────────────────────────────────────

function MembersTab({ members, isOwner, busy, run, onChanged }: {
  members: Member[]; isOwner: boolean; busy: boolean
  run: (fn: () => Promise<unknown>) => Promise<void>
  onChanged: () => void | Promise<void>
}) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<Role>('member')
  const [newPassword, setNewPassword] = useState('')

  function add() {
    if (!newName.trim()) return
    run(async () => {
      await api.createMember({ name: newName.trim(), email: newEmail.trim(), role: newRole, password: newPassword || undefined })
      setNewName(''); setNewEmail(''); setNewRole('member'); setNewPassword(''); setAdding(false)
      await onChanged()
    })
  }

  return (
    <div className="space-y-3">
      {members.length === 0 && <p className="text-xs text-gray-400 italic">No members yet</p>}
      {members.map(m => <MemberRow key={m.id} member={m} isOwner={isOwner} busy={busy} run={run} onChanged={onChanged} />)}

      {isOwner && (
        adding ? (
          <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-3 space-y-2">
            <div className="flex gap-2">
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Full name"
                onKeyDown={e => e.key === 'Enter' && add()}
                className="flex-1 text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com"
                className="flex-1 text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              <select value={newRole} onChange={e => setNewRole(e.target.value as Role)}
                className="text-sm border rounded px-2 py-1.5">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password"
              placeholder="Login password (optional — without one the member cannot sign in)"
              className="w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setAdding(false); setNewName(''); setNewEmail('') }}
                className="text-xs text-gray-600 hover:bg-gray-200 px-3 py-1 rounded">Cancel</button>
              <button onClick={add} disabled={!newName.trim() || busy}
                className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1 rounded">Add member</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 hover:border-indigo-300 hover:bg-indigo-50/30 text-sm text-gray-500 hover:text-indigo-700 rounded-xl py-2 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add member
          </button>
        )
      )}
    </div>
  )
}

function MemberRow({ member, isOwner, busy, run, onChanged }: {
  member: Member; isOwner: boolean; busy: boolean
  run: (fn: () => Promise<unknown>) => Promise<void>
  onChanged: () => void | Promise<void>
}) {
  const [role, setRole] = useState<Role>(member.role)
  // Keep the dropdown in sync if the list is refetched.
  useEffect(() => { setRole(member.role) }, [member.role])

  function changeRole(next: Role) {
    setRole(next)
    run(async () => { await api.updateMember(member.id, { role: next }); await onChanged() })
  }
  function remove() {
    if (!confirm(`Remove ${member.name} from the workspace?`)) return
    run(async () => { await api.deleteMember(member.id); await onChanged() })
  }
  function setPassword() {
    const pw = prompt(`New login password for ${member.name}:`)
    if (!pw) return
    run(async () => { await api.updateMember(member.id, { password: pw } as any) })
  }

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100">
      <Avatar name={member.name} size={8} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
        <p className="text-xs text-gray-500 truncate">{member.email || '—'}</p>
      </div>
      <select value={role} onChange={e => changeRole(e.target.value as Role)}
        disabled={!isOwner || busy}
        className={`text-xs border rounded px-2 py-1 ${isOwner ? 'bg-white' : 'bg-gray-50 cursor-not-allowed'}`}>
        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      {isOwner && (
        <button onClick={setPassword} disabled={busy}
          title="Set login password"
          className="text-gray-400 hover:text-indigo-600 p-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
        </button>
      )}
      {isOwner && (
        <button onClick={remove} disabled={busy}
          title="Remove member"
          className="text-gray-400 hover:text-red-500 p-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      )}
    </div>
  )
}

// ─── Demo data tab (owner-only) ──────────────────────────────────────────────

function DemoDataTab({ busy, run }: { busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [arming, setArming] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  function reset() {
    run(async () => {
      const r: any = await api.resetDemoData()
      setArming(false)
      setDone(`Rebuilt ${r.projects} projects with ${r.issues} issues. Reloading…`)
      // Everything project-scoped changed — a full reload is the honest refresh.
      setTimeout(() => window.location.reload(), 1200)
    })
  }

  return (
    <div className="space-y-4">
      <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-900">Reset demo data</p>
        <p className="text-xs text-gray-600 mt-1">
          Deletes <b>every project</b> — including all issues, comments, attachments, milestones,
          epics and wiki pages — and rebuilds the standard three-project demo set
          (Web Dashboard, Mobile App, API Platform) with fresh dates.
        </p>
        <p className="text-xs text-gray-600 mt-1">
          Members, passwords, exams, announcements, chat and attendance are <b>not</b> touched;
          missing demo members are re-created.
        </p>

        {done ? (
          <p className="text-xs font-medium text-emerald-700 mt-3">{done}</p>
        ) : arming ? (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs font-medium text-red-700">This cannot be undone. Replace all projects with demo data?</span>
            <button onClick={reset} disabled={busy}
              className="text-xs text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 px-3 py-1.5 rounded-lg">
              {busy ? 'Resetting…' : 'Yes, reset everything'}
            </button>
            <button onClick={() => setArming(false)} disabled={busy}
              className="text-xs text-gray-600 hover:bg-gray-200 px-3 py-1.5 rounded-lg">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setArming(true)} disabled={busy}
            className="mt-3 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 px-3 py-1.5 rounded-lg">
            Reset demo data…
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Role permissions tab ────────────────────────────────────────────────────

function RolePermissionsTab({ isOwner, busy, run, onChanged }: {
  isOwner: boolean; busy: boolean
  run: (fn: () => Promise<unknown>) => Promise<void>
  onChanged?: (perms: Record<string, string[]>) => void
}) {
  const [perms, setPerms] = useState<Record<string, string[]> | null>(null)

  useEffect(() => {
    api.getRolePermissions().then(setPerms).catch(() => setPerms({}))
  }, [])

  function toggle(role: Role, menuId: string) {
    if (!perms) return
    const current = new Set(perms[role] ?? [])
    if (current.has(menuId)) current.delete(menuId)
    else current.add(menuId)
    const next = Array.from(current)
    // Optimistic update.
    setPerms({ ...perms, [role]: next })
    run(async () => {
      const fresh = await api.setRoleMenus(role, next)
      setPerms(fresh)
      onChanged?.(fresh)
    })
  }

  if (!perms) return <p className="text-sm text-gray-500">Loading…</p>

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Toggle which sidebar menus each role can see. Changes are saved immediately.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left font-semibold text-gray-500 py-2 pr-4 uppercase tracking-wider text-[10px]">Menu</th>
              {ROLES.map(r => (
                <th key={r} className="text-center font-semibold text-gray-500 py-2 px-2 uppercase tracking-wider text-[10px]">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MENU_OPTIONS.map(opt => (
              <tr key={opt.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className="py-2 pr-4 font-medium text-gray-800">{opt.label}</td>
                {ROLES.map(r => {
                  const allowed = perms[r]?.includes(opt.id) ?? false
                  return (
                    <td key={r} className="text-center py-2 px-2">
                      <input
                        type="checkbox"
                        checked={allowed}
                        disabled={!isOwner || busy}
                        onChange={() => toggle(r, opt.id)}
                        className="rounded cursor-pointer disabled:cursor-not-allowed"
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
