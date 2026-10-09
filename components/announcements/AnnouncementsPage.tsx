'use client'
import { useEffect, useMemo, useState } from 'react'
import type { Member } from '@/lib/types'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'
import { fmtDate, relTime } from '@/lib/utils'

interface Announcement {
  id: string
  body: string
  target_roles: string[]
  target_users: string[]
  created_by: string | null
  created_at: string
  updated_at: string | null
  expires_at: string | null
  author?: { id: string; name: string } | null
  audience?: { id: string; name: string; role: string }[]
}

interface Props {
  members: Member[]
  currentMember: Member | null
}

const ALL_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'] as const
type RoleName = typeof ALL_ROLES[number]

// Full-page CRUD for announcements. Owner-only — the sidebar hides the menu
// for other roles, and the API also enforces this on every mutation.
export default function AnnouncementsPage({ members, currentMember }: Props) {
  const [items, setItems] = useState<Announcement[] | null>(null)
  const [editing, setEditing] = useState<Announcement | 'new' | null>(null)

  const isOwner = currentMember?.role === 'owner'

  async function refresh() {
    try { setItems(await api.listAllAnnouncements() as Announcement[]) }
    catch { setItems([]) }
  }
  useEffect(() => { refresh() }, [])

  async function remove(a: Announcement) {
    if (!confirm(`Delete this announcement? It will disappear from the ticker immediately.\n\n"${a.body.slice(0, 80)}${a.body.length > 80 ? '…' : ''}"`)) return
    try { await api.deleteAnnouncement(a.id); await refresh() }
    catch (e: any) { alert(e?.message ?? 'Failed to delete') }
  }

  if (!isOwner) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-lg font-bold text-gray-900">Owners only</h2>
          <p className="text-sm text-gray-500 mt-1">Only workspace owners can manage the announcement ticker. You'll still see any announcements targeted at your role in the ticker at the top of the page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase">📣 Announcements</p>
            <h2 className="text-xl font-bold text-gray-900">Ticker messages</h2>
            <p className="text-sm text-gray-500 mt-0.5">Broadcast a message to everyone, a role, or specific teammates. Anything you post here scrolls across the top of the app for the audience you choose.</p>
          </div>
          <button onClick={() => setEditing('new')}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            New announcement
          </button>
        </div>

        {/* List */}
        {items === null ? (
          <p className="text-sm text-gray-400 italic">Loading…</p>
        ) : items.length === 0 ? (
          <div className="bg-white ring-1 ring-gray-100 rounded-2xl p-8 text-center">
            <div className="text-3xl mb-2">📢</div>
            <p className="text-sm text-gray-500">No announcements yet.</p>
            <button onClick={() => setEditing('new')} className="mt-2 text-sm text-indigo-600 hover:underline">
              Post the first one
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map(a => (
              <AnnouncementRow key={a.id} a={a} members={members}
                onEdit={() => setEditing(a)}
                onDelete={() => remove(a)} />
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <Composer
          initial={editing === 'new' ? null : editing}
          members={members}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await refresh() }}
        />
      )}
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────

function AnnouncementRow({ a, members, onEdit, onDelete }: {
  a: Announcement; members: Member[]; onEdit: () => void; onDelete: () => void
}) {
  const expired = a.expires_at && new Date(a.expires_at.replace(' ', 'T') + 'Z').getTime() < Date.now()
  const audienceLabel = (() => {
    const roles = a.target_roles.length
    const users = a.target_users.length
    if (roles === 0 && users === 0) return 'Everyone'
    const parts: string[] = []
    if (roles) parts.push(`${roles} role${roles === 1 ? '' : 's'}`)
    if (users) parts.push(`${users} user${users === 1 ? '' : 's'}`)
    return parts.join(' + ')
  })()

  return (
    <li className={`bg-white ring-1 rounded-2xl p-4 transition-shadow ${expired ? 'ring-gray-200 opacity-70' : 'ring-gray-100 hover:shadow-sm'}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg leading-none">📣</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 leading-relaxed">
            <RenderBody body={a.body} />
          </p>

          {/* Audience chips */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {a.target_roles.length === 0 && a.target_users.length === 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Everyone
              </span>
            )}
            {a.target_roles.map(r => (
              <span key={r} className="text-[10px] font-semibold capitalize text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200 px-2 py-0.5 rounded-full">
                @{r}
              </span>
            ))}
            {a.audience?.map(u => (
              <span key={u.id} className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-50 ring-1 ring-violet-200 px-1.5 py-0.5 rounded-full">
                <Avatar name={u.name} size={3} /> {u.name}
              </span>
            ))}
          </div>

          {/* Meta line */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
            {a.author && <span>by <span className="font-medium text-gray-700">{a.author.name}</span></span>}
            <span title={a.created_at}>· posted {relTime(a.created_at)}</span>
            {a.updated_at && a.updated_at !== a.created_at && (
              <span title={a.updated_at}>· edited {relTime(a.updated_at)}</span>
            )}
            {a.expires_at && (
              <span className={expired ? 'text-red-600 font-semibold' : ''}>· {expired ? 'expired' : 'expires'} {fmtDate(a.expires_at)}</span>
            )}
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">visible to {audienceLabel}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={onEdit}
            title="Edit"
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button onClick={onDelete}
            title="Delete"
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    </li>
  )
}

function RenderBody({ body }: { body: string }) {
  const parts = body.split(/(@owner|@admin|@manager|@member|@viewer)\b/gi)
  return (
    <>
      {parts.map((p, i) =>
        /^@(owner|admin|manager|member|viewer)$/i.test(p)
          ? <span key={i} className="font-semibold text-indigo-700 bg-indigo-50 px-1 rounded">{p}</span>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}

// ── Composer (create + edit) ───────────────────────────────────────────────

function Composer({ initial, members, onClose, onSaved }: {
  initial: Announcement | null
  members: Member[]
  onClose: () => void
  onSaved: () => void
}) {
  const [body, setBody] = useState(initial?.body ?? '')
  const [roles, setRoles] = useState<RoleName[]>((initial?.target_roles ?? []) as RoleName[])
  const [userIds, setUserIds] = useState<string[]>(initial?.target_users ?? [])
  const [expiresAt, setExpiresAt] = useState(() => {
    if (!initial?.expires_at) return ''
    // DB shape: "YYYY-MM-DD HH:MM:SS" → datetime-local wants "YYYY-MM-DDTHH:MM"
    return initial.expires_at.replace(' ', 'T').slice(0, 16)
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userQuery, setUserQuery] = useState('')

  const isEdit = !!initial

  function toggleRole(r: RoleName) {
    setRoles(prev => {
      const has = prev.includes(r)
      const next = has ? prev.filter(x => x !== r) : [...prev, r]
      // Auto-mention on add; strip on remove.
      const token = `@${r}`
      setBody(b => {
        if (has) return b.replace(new RegExp(`\\s*${token}\\b`, 'i'), '').replace(/\s{2,}/g, ' ').trim()
        return b.includes(token) ? b : (b ? `${b} ${token}` : token)
      })
      return next
    })
  }
  function toggleUser(id: string) {
    setUserIds(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id])
  }

  const matchingUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    return members
      .filter(m => !q || m.name.toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [members, userQuery])

  const selectedMembers = members.filter(m => userIds.includes(m.id))

  async function submit() {
    const trimmed = body.trim()
    if (!trimmed) { setError('Body is required.'); return }
    setSaving(true); setError(null)
    try {
      const iso = expiresAt ? expiresAt.replace('T', ' ') + ':00' : null
      const payload = { body: trimmed, target_roles: roles, target_users: userIds, expires_at: iso }
      if (isEdit && initial) await api.updateAnnouncement(initial.id, payload)
      else                   await api.createAnnouncement(payload)
      onSaved()
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">📣 Announcement</p>
            <h2 className="text-sm font-semibold text-gray-900">{isEdit ? 'Edit announcement' : 'Post to the workspace ticker'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Body */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Message <span className="text-gray-300 normal-case">({body.length}/500)</span>
            </label>
            <textarea value={body} onChange={e => setBody(e.target.value.slice(0, 500))}
              rows={3} autoFocus
              placeholder="Deploy freeze at 5pm today — @manager please close open PRs first."
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none" />
            <p className="text-[10px] text-gray-400 mt-1">Type <code className="bg-gray-100 px-1 rounded">@role</code> anywhere. Selecting a role chip auto-inserts the mention.</p>
          </div>

          {/* Role targeting */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Target by role
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setRoles([])}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${roles.length === 0 && userIds.length === 0 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Everyone
              </button>
              {ALL_ROLES.map(r => (
                <button key={r} onClick={() => toggleRole(r)}
                  className={`text-[11px] font-medium capitalize px-2.5 py-1 rounded-full transition-colors ${roles.includes(r) ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  @{r}
                </button>
              ))}
            </div>
          </div>

          {/* User targeting */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Target specific users
            </label>
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedMembers.map(m => (
                  <button key={m.id} onClick={() => toggleUser(m.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 bg-violet-50 ring-1 ring-violet-200 hover:bg-violet-100 px-1.5 py-0.5 rounded-full">
                    <Avatar name={m.name} size={3} /> {m.name}
                    <span className="text-violet-500 ml-0.5">×</span>
                  </button>
                ))}
              </div>
            )}
            <input value={userQuery} onChange={e => setUserQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            {userQuery && (
              <div className="mt-1 max-h-40 overflow-y-auto ring-1 ring-gray-100 rounded-lg divide-y divide-gray-50">
                {matchingUsers.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic px-3 py-2">No matches</p>
                ) : matchingUsers.map(m => {
                  const on = userIds.includes(m.id)
                  return (
                    <button key={m.id} onClick={() => toggleUser(m.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-indigo-50/40 text-left">
                      <Avatar name={m.name} size={5} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{m.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">{m.email} · <span className="capitalize">{m.role}</span></p>
                      </div>
                      {on && (
                        <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Effective audience summary */}
          <div className="text-[11px] bg-gray-50 ring-1 ring-gray-100 rounded-lg px-3 py-2 text-gray-600">
            <span className="font-semibold text-gray-500 mr-1">Visible to:</span>
            {roles.length === 0 && userIds.length === 0
              ? 'every signed-in user'
              : [
                  roles.length ? roles.join(', ') : null,
                  userIds.length ? `${userIds.length} specific user${userIds.length === 1 ? '' : 's'}` : null,
                ].filter(Boolean).join(' + ')
            }
            <span className="text-gray-400"> · plus workspace owners (always)</span>
          </div>

          {/* Expiry */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Auto-retire at (optional)
            </label>
            <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
              className="text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            {expiresAt && (
              <button onClick={() => setExpiresAt('')} className="ml-2 text-[10px] text-gray-500 hover:text-red-500 hover:underline">
                clear
              </button>
            )}
          </div>

          {error && <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-gray-50 shrink-0">
          <button onClick={onClose} disabled={saving}
            className="text-sm text-gray-600 hover:bg-gray-200 px-4 py-1.5 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={saving || !body.trim()}
            className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-1.5 rounded-lg shadow-sm">
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Post announcement')}
          </button>
        </div>
      </div>
    </div>
  )
}
