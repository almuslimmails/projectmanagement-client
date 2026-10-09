'use client'
import { useEffect, useState } from 'react'
import type { Member } from '@/lib/types'
import { api } from '@/lib/api'

interface Announcement {
  id: string
  body: string
  target_roles: string[]
  created_at: string
  expires_at: string | null
  author?: { id: string; name: string } | null
}

interface Props { currentMember: Member | null }

const ALL_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'] as const
type RoleName = typeof ALL_ROLES[number]

// Marquee ticker + owner-only composer. Renders under the "Test" env badge.
// Non-owners see only the marquee; the server has already filtered items by
// target_roles, so what they see is by definition what they're allowed to see.
export default function AnnouncementTicker({ currentMember }: Props) {
  const [items, setItems] = useState<Announcement[]>([])
  const [composing, setComposing] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const isOwner = currentMember?.role === 'owner'

  async function refresh() {
    try { setItems(await api.listAnnouncements() as Announcement[]) } catch { setItems([]) }
  }

  useEffect(() => {
    if (!currentMember) return
    refresh()
    // Re-poll every 60s so a new broadcast surfaces without a full page reload.
    const t = setInterval(refresh, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMember?.id])

  if (!currentMember) return null
  // Empty AND no owner controls → nothing to render.
  if (items.length === 0 && !isOwner) return null

  return (
    <>
      {/* Ticker bar */}
      <div className={`fixed left-1/2 -translate-x-1/2 z-[190] transition-all ${collapsed ? 'top-2' : 'top-8'}`}
        style={{ pointerEvents: 'none' }}>
        <div className="pointer-events-auto flex items-center gap-1">
          {items.length > 0 && !collapsed && (
            <div className="max-w-[70vw] min-w-[280px] overflow-hidden bg-white/95 backdrop-blur ring-1 ring-black/10 rounded-full shadow-sm px-3 py-1 flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-600 shrink-0">📣</span>
              <div className="marquee-viewport flex-1 min-w-0 overflow-hidden">
                <div className="marquee-track inline-flex gap-8">
                  {[...items, ...items].map((a, i) => (
                    <span key={`${a.id}-${i}`} className="whitespace-nowrap text-[12px] text-gray-800">
                      <RenderBody body={a.body} /> <span className="text-gray-400">· {a.author?.name ?? 'Owner'}</span>
                      {isOwner && i < items.length && (
                        <button
                          onClick={async () => {
                            if (!confirm('Delete this announcement?')) return
                            try { await api.deleteAnnouncement(a.id); await refresh() }
                            catch (e: any) { alert(e?.message ?? 'Failed to delete') }
                          }}
                          className="ml-1 text-gray-400 hover:text-red-500"
                          title="Delete announcement">
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => setCollapsed(true)}
                title="Hide" className="text-gray-400 hover:text-gray-700 text-[13px] leading-none shrink-0">−</button>
            </div>
          )}
          {collapsed && items.length > 0 && (
            <button onClick={() => setCollapsed(false)}
              className="pointer-events-auto text-[10px] font-bold uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-0.5 rounded-full shadow-md">
              📣 {items.length} announcement{items.length === 1 ? '' : 's'}
            </button>
          )}
          {isOwner && !collapsed && (
            <button onClick={() => setComposing(true)}
              title="Post an announcement"
              className="pointer-events-auto shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-0.5 rounded-full shadow-sm">
              <span className="text-xs leading-none">+</span> Post
            </button>
          )}
        </div>
      </div>

      {composing && isOwner && (
        <Composer onClose={() => setComposing(false)} onCreated={async () => { setComposing(false); await refresh() }} />
      )}

      {/* Marquee keyframes — scoped to this component. */}
      <style jsx global>{`
        .marquee-viewport { -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent); mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent); }
        .marquee-track { animation: marquee 45s linear infinite; }
        .marquee-viewport:hover .marquee-track { animation-play-state: paused; }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>
    </>
  )
}

// Highlights any @role mention (@owner, @admin, @manager, @member, @viewer)
// so the audience is obvious inside the ticker.
function RenderBody({ body }: { body: string }) {
  const parts = body.split(/(@owner|@admin|@manager|@member|@viewer)\b/gi)
  return (
    <>
      {parts.map((p, i) => {
        if (/^@(owner|admin|manager|member|viewer)$/i.test(p)) {
          return <span key={i} className="font-semibold text-indigo-700 bg-indigo-50 px-1 rounded">{p}</span>
        }
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

// Owner-only compose modal. Roles picker doubles as @-mention suggestions —
// selecting them both narrows the audience and inserts an @role token in the
// body so the ticker calls out who it's for.
function Composer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [body, setBody] = useState('')
  const [roles, setRoles] = useState<RoleName[]>([])
  const [expiresAt, setExpiresAt] = useState('') // datetime-local string
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleRole(r: RoleName) {
    setRoles(prev => {
      const next = prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
      // Auto-mention when adding; auto-strip when removing.
      const token = `@${r}`
      setBody(b => {
        if (prev.includes(r)) {
          return b.replace(new RegExp(`\\s*${token}\\b`, 'i'), '').replace(/\s{2,}/g, ' ').trim()
        }
        return b.includes(token) ? b : (b ? `${b} ${token}` : token)
      })
      return next
    })
  }

  async function submit() {
    const trimmed = body.trim()
    if (!trimmed) { setError('Body is required.'); return }
    setSaving(true); setError(null)
    try {
      // datetime-local yields "YYYY-MM-DDTHH:MM"; convert to the DB's " " form.
      const iso = expiresAt ? expiresAt.replace('T', ' ') + ':00' : null
      await api.createAnnouncement({ body: trimmed, target_roles: roles, expires_at: iso })
      onCreated()
    } catch (e: any) {
      setError(e?.message ?? 'Failed to post')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">📣 Announcement</p>
            <h2 className="text-sm font-semibold text-gray-900">Post to the workspace ticker</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Message <span className="text-gray-300 normal-case">({body.length}/500)</span>
            </label>
            <textarea value={body} onChange={e => setBody(e.target.value.slice(0, 500))}
              rows={3} autoFocus
              placeholder="Deploy freeze at 5pm today — @manager please close open PRs first."
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none" />
            <p className="text-[10px] text-gray-400 mt-1">Type <code className="bg-gray-100 px-1 rounded">@role</code> to call someone out. Selecting a target role below auto-inserts the mention.</p>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Target audience
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setRoles([])}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${roles.length === 0 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Everyone
              </button>
              {ALL_ROLES.map(r => (
                <button key={r} onClick={() => toggleRole(r)}
                  className={`text-[11px] font-medium capitalize px-2.5 py-1 rounded-full transition-colors ${roles.includes(r) ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  @{r}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              {roles.length === 0 ? 'Visible to every signed-in user.' : `Visible to: ${roles.join(', ')}, plus owners.`}
            </p>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Auto-retire at (optional)
            </label>
            <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
              className="text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>

          {error && <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-gray-50">
          <button onClick={onClose} disabled={saving}
            className="text-sm text-gray-600 hover:bg-gray-200 px-4 py-1.5 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={saving || !body.trim()}
            className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-1.5 rounded-lg shadow-sm">
            {saving ? 'Posting…' : 'Post announcement'}
          </button>
        </div>
      </div>
    </div>
  )
}
