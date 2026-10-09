'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, resolveFileUrl } from '@/lib/api'
import type { Attachment, Member } from '@/lib/types'
import { Avatar } from '@/components/ui/Avatar'
import { relTime } from '@/lib/utils'

interface Comment {
  id: string
  issue_id: string
  author_id: string | null
  body: string
  attachment_ids: string[]
  mentioned_ids: string[]
  created_at: string
  updated_at: string | null
  author?: { id: string; name: string; role: string } | null
  mentions?: { id: string; name: string; role: string }[]
}

interface Props {
  projectId: string
  issueId: string
  currentMember?: Member | null
  // Workspace members — used by the @-mention picker. Passed from IssueDetail
  // which already has the list, so we don't refetch.
  members?: Member[]
}

const MAX_BODY = 5000

// Comments thread with file quotes ([[att:<id>]]) and @-mentions ([[user:<id>]]).
export default function IssueComments({ projectId, issueId, currentMember, members = [] }: Props) {
  const [items, setItems] = useState<Comment[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [draft, setDraft] = useState('')
  const [draftAtts, setDraftAtts] = useState<string[]>([])
  const [draftMentions, setDraftMentions] = useState<string[]>([])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editAtts, setEditAtts] = useState<string[]>([])
  const [editMentions, setEditMentions] = useState<string[]>([])

  async function refresh() {
    try {
      const [c, a] = await Promise.all([
        api.listComments(projectId, issueId),
        api.getAttachments(projectId, issueId),
      ])
      setItems(c as Comment[])
      setAttachments(a as Attachment[])
    } catch { setItems([]); setAttachments([]) }
    finally { setLoading(false) }
  }
  useEffect(() => { setLoading(true); refresh() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId, issueId])

  const attById = useMemo(() => new Map(attachments.map(a => [a.id, a])), [attachments])
  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members])
  const isOwner = currentMember?.role === 'owner'

  async function submit() {
    const trimmed = draft.trim()
    if (!trimmed) return
    setBusy(true); setError(null)
    try {
      await api.addComment(projectId, issueId, { body: trimmed, attachment_ids: draftAtts, mentioned_ids: draftMentions })
      setDraft(''); setDraftAtts([]); setDraftMentions([])
      await refresh()
    } catch (e: any) { setError(e?.message ?? 'Failed to post') }
    finally { setBusy(false) }
  }

  function beginEdit(c: Comment) {
    setEditingId(c.id)
    setEditBody(c.body)
    setEditAtts(c.attachment_ids)
    setEditMentions(c.mentioned_ids)
    setError(null)
  }
  function cancelEdit() { setEditingId(null); setEditBody(''); setEditAtts([]); setEditMentions([]) }
  async function saveEdit(id: string) {
    const trimmed = editBody.trim()
    if (!trimmed) return
    setBusy(true); setError(null)
    try {
      await api.updateComment(projectId, issueId, id, { body: trimmed, attachment_ids: editAtts, mentioned_ids: editMentions })
      cancelEdit()
      await refresh()
    } catch (e: any) { setError(e?.message ?? 'Failed to save') }
    finally { setBusy(false) }
  }
  async function remove(c: Comment) {
    if (!confirm('Delete this comment? This cannot be undone.')) return
    setBusy(true); setError(null)
    try {
      await api.deleteComment(projectId, issueId, c.id)
      await refresh()
    } catch (e: any) { setError(e?.message ?? 'Failed to delete') }
    finally { setBusy(false) }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Comments</p>
        {items.length > 0 && <span className="text-[10px] text-gray-300">({items.length})</span>}
      </div>

      {loading ? (
        <p className="text-[11px] text-gray-400 italic">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic mb-3">No comments yet. Start the thread below.</p>
      ) : (
        <ul className="space-y-3 mb-4">
          {items.map(c => {
            const isAuthor = c.author_id === currentMember?.id
            const canEdit = isAuthor
            const canDelete = isAuthor || isOwner
            const editingThis = editingId === c.id
            return (
              <li key={c.id} className="group flex gap-2.5">
                {c.author
                  ? <Avatar name={c.author.name} size={7} />
                  : <span className="block w-7 h-7 rounded-full bg-gray-200 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="ring-1 ring-gray-200 rounded-lg bg-white p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-gray-800 truncate">{c.author?.name ?? 'Unknown'}</span>
                      {c.author?.role && (
                        <span className="text-[9px] uppercase tracking-widest text-gray-400 capitalize">{c.author.role}</span>
                      )}
                      <span className="text-[10px] text-gray-400 ml-auto" title={c.created_at}>{relTime(c.created_at)}{c.updated_at && ' · edited'}</span>
                    </div>

                    {editingThis ? (
                      <>
                        <MentionTextarea
                          value={editBody}
                          onChange={setEditBody}
                          onMention={id => setEditMentions(prev => prev.includes(id) ? prev : [...prev, id])}
                          members={members}
                          rows={4}
                        />
                        <AttachmentPicker
                          attachments={attachments}
                          selectedIds={editAtts}
                          onToggle={(id) => setEditAtts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                          onInsertMarker={(id) => setEditBody(prev => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}[[att:${id}]] `)}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button onClick={cancelEdit} disabled={busy}
                            className="text-[11px] text-gray-600 hover:text-gray-800">Cancel</button>
                          <button onClick={() => saveEdit(c.id)} disabled={busy || !editBody.trim()}
                            className="text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-2.5 py-1 rounded">
                            {busy ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <CommentBody body={c.body} attById={attById} memberById={memberById} />
                        {c.attachment_ids.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {c.attachment_ids
                              .filter(id => !c.body.includes(`[[att:${id}]]`))
                              .map(id => {
                                const a = attById.get(id)
                                if (!a) return null
                                return <AttachmentInline key={id} att={a} />
                              })}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {!editingThis && (canEdit || canDelete) && (
                    <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                        <button onClick={() => beginEdit(c)}
                          className="text-[10px] text-gray-500 hover:text-indigo-700">Edit</button>
                      )}
                      {canDelete && (
                        <button onClick={() => remove(c)}
                          className="text-[10px] text-gray-500 hover:text-red-600">Delete</button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Compose */}
      {currentMember && (
        <div className="ring-1 ring-gray-200 rounded-lg bg-white p-3">
          <MentionTextarea
            value={draft}
            onChange={setDraft}
            onMention={id => setDraftMentions(prev => prev.includes(id) ? prev : [...prev, id])}
            members={members}
            placeholder="Write a comment… type @ to mention a teammate"
            rows={3}
          />
          <AttachmentPicker
            attachments={attachments}
            selectedIds={draftAtts}
            onToggle={(id) => setDraftAtts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
            onInsertMarker={(id) => setDraft(prev => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}[[att:${id}]] `)}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-gray-400">
              {draft.length}/{MAX_BODY}
              {draftAtts.length > 0 && ` · ${draftAtts.length} attachment${draftAtts.length === 1 ? '' : 's'}`}
              {draftMentions.length > 0 && ` · ${draftMentions.length} mention${draftMentions.length === 1 ? '' : 's'}`}
            </span>
            {error && <span className="text-[11px] text-red-600">{error}</span>}
            <button onClick={submit} disabled={busy || !draft.trim()}
              className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 rounded-md shadow-sm">
              {busy ? 'Posting…' : 'Comment'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Textarea with @-mention popover ────────────────────────────────────────
// Watches for a bare "@query" immediately before the cursor. When present,
// pops a floating list of matching members below the textarea. Clicking a
// row (or hitting Enter) inserts a `[[user:<id>]] ` marker in place of the
// "@query" text and calls onMention with the id.
function MentionTextarea({ value, onChange, onMention, members, placeholder, rows = 3 }: {
  value: string
  onChange: (next: string) => void
  onMention: (memberId: string) => void
  members: Member[]
  placeholder?: string
  rows?: number
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [anchor, setAnchor] = useState(0)          // cursor position where "@" starts
  const [activeIdx, setActiveIdx] = useState(0)

  const matches = useMemo(() => {
    if (!open) return []
    const q = query.trim().toLowerCase()
    return members
      .filter(m => !q || m.name.toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [members, query, open])

  // Reset the active row whenever the visible match set changes.
  useEffect(() => { setActiveIdx(0) }, [query, open])

  function detect(text: string, caret: number) {
    // Walk back from the caret to find a "@" that starts a mention token.
    let i = caret - 1
    while (i >= 0 && /[^\s@]/.test(text[i])) i--
    if (i < 0 || text[i] !== '@') { setOpen(false); return }
    // The character just before "@" must be whitespace or start-of-string,
    // otherwise this is an email or similar — don't hijack it.
    if (i > 0 && !/\s/.test(text[i - 1])) { setOpen(false); return }
    const q = text.slice(i + 1, caret)
    setAnchor(i)
    setQuery(q)
    setOpen(true)
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value.slice(0, MAX_BODY)
    onChange(next)
    detect(next, e.target.selectionStart ?? next.length)
  }

  function pickMember(m: Member) {
    const ta = taRef.current
    const caret = ta?.selectionStart ?? value.length
    // Replace "@query" (inclusive of the @) with the marker + a trailing space.
    const before = value.slice(0, anchor)
    const after  = value.slice(caret)
    const marker = `[[user:${m.id}]] `
    const next = before + marker + after
    onChange(next)
    onMention(m.id)
    setOpen(false)
    // Restore caret past the inserted marker on the next tick.
    setTimeout(() => {
      const pos = (before + marker).length
      ta?.focus()
      ta?.setSelectionRange(pos, pos)
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || matches.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % matches.length); return }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => (i - 1 + matches.length) % matches.length); return }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const m = matches[activeIdx]
      if (m) pickMember(m)
      return
    }
    if (e.key === 'Escape') { setOpen(false); return }
  }

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder ?? 'Write a comment…'}
        rows={rows}
        className="w-full text-sm text-gray-700 border-0 focus:outline-none resize-y min-h-[64px]"
      />
      {open && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-56 overflow-y-auto ring-1 ring-gray-200 shadow-lg rounded-lg bg-white divide-y divide-gray-50">
          <div className="px-3 py-1.5 text-[9px] uppercase tracking-widest text-gray-400 font-semibold bg-gray-50">
            Mention a teammate
          </div>
          {matches.map((m, i) => (
            <button key={m.id} type="button"
              onMouseDown={(e) => e.preventDefault() /* keep the textarea from losing focus first */}
              onClick={() => pickMember(m)}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${i === activeIdx ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
              <Avatar name={m.name} size={5} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{m.name}</p>
                <p className="text-[10px] text-gray-500 truncate capitalize">{m.role}</p>
              </div>
              <span className="text-[10px] text-gray-400 shrink-0">@{m.name.split(' ')[0].toLowerCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Body renderer ──────────────────────────────────────────────────────────
// Splits body on `[[att:<id>]]` and `[[user:<id>]]` markers. Attachments
// become inline cards, mentions become highlighted @Name chips.
function CommentBody({ body, attById, memberById }: {
  body: string
  attById: Map<string, Attachment>
  memberById: Map<string, Member>
}) {
  const parts = body.split(/(\[\[(?:att|user):[a-zA-Z0-9]+\]\])/g)
  return (
    <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((p, i) => {
        const att = p.match(/^\[\[att:([a-zA-Z0-9]+)\]\]$/)
        if (att) {
          const a = attById.get(att[1])
          if (!a) return <span key={i} className="text-[11px] text-gray-400 italic">[deleted attachment]</span>
          return <span key={i} className="inline-block align-middle mx-0.5 my-0.5"><AttachmentInline att={a} /></span>
        }
        const user = p.match(/^\[\[user:([a-zA-Z0-9]+)\]\]$/)
        if (user) {
          const m = memberById.get(user[1])
          const name = m?.name ?? 'someone'
          return (
            <span key={i}
              title={m ? `${m.name} · ${m.role}` : 'unknown user'}
              className="inline-flex items-center align-middle gap-1 mx-0.5 px-1.5 py-0.5 rounded font-semibold text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200 text-[12px]">
              <span>@</span>{name}
            </span>
          )
        }
        return <span key={i}>{p}</span>
      })}
    </div>
  )
}

function AttachmentInline({ att }: { att: Attachment }) {
  const isImage = att.kind === 'file' && att.mime?.startsWith('image/')
  const isFile = att.kind === 'file'
  if (isImage) {
    return (
      <a href={resolveFileUrl(att.url)} target="_blank" rel="noopener noreferrer"
        className="inline-block ring-1 ring-gray-200 hover:ring-indigo-300 rounded-md overflow-hidden bg-gray-50 max-w-[220px] max-h-[140px] align-middle">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resolveFileUrl(att.url)} alt={att.filename || att.title || ''}
          className="w-full h-full object-cover block max-w-[220px] max-h-[140px]" />
      </a>
    )
  }
  const label = isFile ? att.filename : (att.title || att.url)
  return (
    <a href={resolveFileUrl(att.url)} target={isFile ? undefined : '_blank'} rel="noopener noreferrer"
      download={isFile && !isImage ? att.filename : undefined}
      title={label}
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200 hover:bg-indigo-100 px-2 py-0.5 rounded-md align-middle max-w-[240px]">
      <span aria-hidden>{isFile ? '📎' : '🔗'}</span>
      <span className="truncate">{label}</span>
    </a>
  )
}

function AttachmentPicker({ attachments, selectedIds, onToggle, onInsertMarker }: {
  attachments: Attachment[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onInsertMarker: (id: string) => void
}) {
  if (attachments.length === 0) return null
  return (
    <div className="mt-1 pt-2 border-t border-gray-100">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">📎 Quote attachment</span>
        <span className="text-[10px] text-gray-300">click a chip to insert an inline reference</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {attachments.map(a => {
          const selected = selectedIds.includes(a.id)
          const label = a.kind === 'file' ? (a.filename || a.title) : (a.title || a.url)
          const isImage = a.kind === 'file' && a.mime?.startsWith('image/')
          return (
            <button key={a.id}
              type="button"
              onClick={() => { onToggle(a.id); onInsertMarker(a.id) }}
              title={label}
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors max-w-[220px] ${selected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              <span aria-hidden>{isImage ? '🖼️' : (a.kind === 'file' ? '📎' : '🔗')}</span>
              <span className="truncate">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
