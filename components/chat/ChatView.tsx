'use client'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { Member, Conversation, ChatMessage, ChatAttachment } from '@/lib/types'
import { api, resolveFileUrl } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'
import { relTime } from '@/lib/utils'
import NewChatModal from './NewChatModal'
import ChatMessageBody from './ChatMessageBody'

const STATUS_DOT: Record<string, string> = {
  online: 'bg-emerald-500',
  break: 'bg-amber-400',
  offline: 'bg-gray-300',
}

interface Props {
  members: Member[]
  currentMember: Member | null
}

// Title of a conversation from the current member's POV: group name, or the *other* DM member.
function convTitle(conv: Conversation, meId: string | null): string {
  if (conv.type === 'group') return conv.name || 'Group'
  const other = conv.members.find(m => m.id !== meId) ?? conv.members[0]
  return other?.name ?? 'Direct message'
}

function clockTime(ts: string): string {
  const s = /\dT\d/.test(ts) ? ts : ts.replace(' ', 'T') + 'Z'
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function dayLabel(ts: string): string {
  const s = /\dT\d/.test(ts) ? ts : ts.replace(' ', 'T') + 'Z'
  const d = new Date(s)
  const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(d, today)) return 'Today'
  if (same(d, yest)) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

export default function ChatView({ members, currentMember }: Props) {
  const meId = currentMember?.id ?? null
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [presence, setPresence] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = activeId

  // Wrap the current selection (or insert a placeholder) in a ``` fenced code block.
  function insertCodeBlock() {
    const ta = composerRef.current
    const start = ta?.selectionStart ?? draft.length
    const end = ta?.selectionEnd ?? draft.length
    const selected = draft.slice(start, end)
    const before = draft.slice(0, start)
    const after = draft.slice(end)
    const nlBefore = before && !before.endsWith('\n') ? '\n' : ''
    const nlAfter = after && !after.startsWith('\n') ? '\n' : ''
    const inner = selected || 'code here'
    const next = `${before}${nlBefore}\`\`\`\n${inner}\n\`\`\`${nlAfter}${after}`
    setDraft(next)
    requestAnimationFrame(() => {
      ta?.focus()
      const caret = `${before}${nlBefore}\`\`\`\n`.length
      ta?.setSelectionRange(caret, caret + inner.length)
    })
  }

  const activeConv = useMemo(() => conversations.find(c => c.id === activeId) ?? null, [conversations, activeId])

  const refreshConversations = useCallback(async () => {
    if (!meId) return
    try { setConversations(await api.getConversations() as Conversation[]) } catch {}
  }, [meId])

  // Initial load + conversation-list poll (drives unread counts) every 8s.
  useEffect(() => {
    if (!meId) return
    refreshConversations()
    const t = setInterval(refreshConversations, 8_000)
    return () => clearInterval(t)
  }, [meId, refreshConversations])

  // Presence dots — poll every 30s.
  useEffect(() => {
    async function pull() {
      try {
        const rows = await api.getLiveStatus() as { member_id: string; status: string }[]
        setPresence(Object.fromEntries(rows.map(r => [r.member_id, r.status])))
      } catch {}
    }
    pull()
    const t = setInterval(pull, 30_000)
    return () => clearInterval(t)
  }, [])

  // When a conversation is opened, load its full thread + mark read.
  const openConversation = useCallback(async (cid: string) => {
    setActiveId(cid)
    setMessages([])
    try {
      const msgs = await api.getMessages(cid) as ChatMessage[]
      setMessages(msgs)
      await api.markChatRead(cid)
      refreshConversations()
    } catch {}
  }, [refreshConversations])

  // Poll the open thread for new messages every 3s.
  useEffect(() => {
    if (!activeId) return
    const t = setInterval(async () => {
      const cid = activeIdRef.current
      if (!cid) return
      try {
        // ask only for messages newer than the last one we hold
        const last = messages[messages.length - 1]
        const fresh = await api.getMessages(cid, last?.created_at) as ChatMessage[]
        if (fresh.length) {
          setMessages(prev => {
            const seen = new Set(prev.map(m => m.id))
            const merged = [...prev, ...fresh.filter(m => !seen.has(m.id))]
            return merged
          })
          // we're looking at it → keep it marked read
          api.markChatRead(cid).then(refreshConversations).catch(() => {})
        }
      } catch {}
    }, 3_000)
    return () => clearInterval(t)
  }, [activeId, messages, refreshConversations])

  // Keep the thread pinned to the bottom as messages arrive.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, activeId])

  async function handleSend() {
    const text = draft.trim()
    const files = pendingFiles
    if ((!text && files.length === 0) || !activeId || sending) return
    setSending(true)
    setDraft('')
    setPendingFiles([])
    try {
      const msg = (files.length
        ? await api.sendMessageWithFiles(activeId, text, files)
        : await api.sendMessage(activeId, text)) as ChatMessage
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      refreshConversations()
    } catch (e: any) {
      alert(e?.message ?? 'Failed to send')
      setDraft(text)
      setPendingFiles(files)
    } finally {
      setSending(false)
    }
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length) setPendingFiles(prev => [...prev, ...picked].slice(0, 5))
    e.target.value = '' // allow re-picking the same file
  }

  async function startDM(memberId: string) {
    setShowNew(false)
    try {
      const conv = await api.startDM(memberId) as Conversation
      await refreshConversations()
      openConversation(conv.id)
    } catch (e: any) { alert(e?.message ?? 'Failed to start chat') }
  }

  async function createGroup(name: string, memberIds: string[], opts: { description: string; icon: string }) {
    setShowNew(false)
    try {
      const conv = await api.createGroupChat(name, memberIds, opts) as Conversation
      await refreshConversations()
      openConversation(conv.id)
    } catch (e: any) { alert(e?.message ?? 'Failed to create group') }
  }

  if (!currentMember) {
    return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Sign in to use chat.</div>
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-white">
      {/* Conversation list */}
      <div className="w-72 border-r border-gray-200 flex flex-col shrink-0 bg-gray-50">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <h2 className="text-sm font-bold text-gray-800">Messages</h2>
          <button onClick={() => setShowNew(true)} title="New chat"
            className="flex items-center gap-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 rounded-md transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
            New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="text-xs text-gray-400 px-4 py-6 text-center">No conversations yet.<br/>Start one with “New”.</p>
          )}
          {conversations.map(conv => {
            const title = convTitle(conv, meId)
            const isActive = conv.id === activeId
            const other = conv.type === 'dm' ? conv.members.find(m => m.id !== meId) : null
            const status = other ? (presence[other.id] ?? 'offline') : null
            return (
              <button key={conv.id} onClick={() => openConversation(conv.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-gray-100 transition-colors ${isActive ? 'bg-indigo-50' : 'hover:bg-gray-100'}`}>
                <div className="relative shrink-0">
                  {conv.type === 'group'
                    ? <span className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg leading-none">{conv.icon || <GroupIcon />}</span>
                    : <Avatar name={title} size={9} />}
                  {status && <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-gray-50 ${STATUS_DOT[status] ?? STATUS_DOT.offline}`} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className={`text-sm truncate ${conv.unread_count > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{title}</span>
                    {conv.last_message && <span className="ml-auto text-[10px] text-gray-400 shrink-0">{relTime(conv.last_message.created_at)}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs truncate ${conv.unread_count > 0 ? 'text-gray-700' : 'text-gray-400'}`}>
                      {conv.last_message
                        ? `${conv.last_message.sender_id === meId ? 'You: ' : ''}${conv.last_message.body}`
                        : (conv.type === 'group' ? `${conv.members.length} members` : 'No messages yet')}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="ml-auto shrink-0 text-[10px] font-bold text-white bg-indigo-600 rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{conv.unread_count}</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Thread */}
      {activeConv ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-5 py-3 border-b border-gray-200 shrink-0">
            {activeConv.type === 'group'
              ? <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-base leading-none">{activeConv.icon || <GroupIcon />}</span>
              : <Avatar name={convTitle(activeConv, meId)} size={8} />}
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">{convTitle(activeConv, meId)}</h3>
              <p className="text-[11px] text-gray-400 truncate">
                {activeConv.type === 'group'
                  ? (activeConv.description || `${activeConv.members.length} members · ${activeConv.members.map(m => m.name).join(', ')}`)
                  : (activeConv.members.find(m => m.id !== meId)?.email || 'Direct message')}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-1 bg-white">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-300">
                <ChatBubbleIcon />
                <p className="text-sm mt-2">No messages yet — say hello 👋</p>
              </div>
            )}
            {messages.map((m, i) => {
              const mine = m.sender_id === meId
              const prev = messages[i - 1]
              const showDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at)
              // Group consecutive messages from the same sender within ~5 min.
              const grouped = !!prev && !showDay && prev.sender_id === m.sender_id &&
                (new Date(clockKey(m.created_at)).getTime() - new Date(clockKey(prev.created_at)).getTime()) < 5 * 60_000
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{dayLabel(m.created_at)}</span>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>
                  )}
                  <div className={`flex items-start gap-2.5 ${mine ? 'flex-row-reverse' : ''} ${grouped ? 'mt-0.5' : 'mt-2'}`}>
                    {!grouped
                      ? <div className="shrink-0"><Avatar name={m.sender?.name ?? '?'} size={7} /></div>
                      : <div className="w-7 shrink-0" />}
                    <div className={`min-w-0 max-w-[68%] ${mine ? 'items-end text-right' : ''} flex flex-col`}>
                      {!grouped && (
                        <div className={`flex items-baseline gap-2 mb-0.5 ${mine ? 'flex-row-reverse' : ''}`}>
                          <span className="text-xs font-semibold text-gray-700">{mine ? 'You' : (m.sender?.name ?? 'Unknown')}</span>
                          <span className="text-[10px] text-gray-400">{clockTime(m.created_at)}</span>
                        </div>
                      )}
                      {(m.body || !m.attachments?.length) && (
                        <div className={`inline-block px-3 py-1.5 rounded-2xl text-left max-w-full ${mine ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                          <ChatMessageBody body={m.body} mine={mine} />
                        </div>
                      )}
                      {!!m.attachments?.length && (
                        <div className={`flex flex-col gap-1.5 mt-1 ${mine ? 'items-end' : 'items-start'}`}>
                          {m.attachments.map(att => <AttachmentView key={att.id} att={att} />)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Composer */}
          <div className="border-t border-gray-200 px-4 py-2.5 shrink-0">
            {/* Pending attachments */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {pendingFiles.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg pl-2 pr-1 py-1 max-w-[220px]">
                    {f.type.startsWith('image/')
                      ? <img src={URL.createObjectURL(f)} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                      : <span className="w-8 h-8 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><FileIcon /></span>}
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-gray-700 truncate">{f.name}</p>
                      <p className="text-[10px] text-gray-400">{fmtBytes(f.size)}</p>
                    </div>
                    <button onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-500 shrink-0 p-0.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1 mb-1.5">
              <button onClick={() => fileInputRef.current?.click()} type="button" title="Attach files"
                className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                Attach
              </button>
              <button onClick={insertCodeBlock} type="button" title="Insert code block"
                className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                Code
              </button>
              <span className="text-[10px] text-gray-300">Markdown · ``` for code · 10 MB/file</span>
              <input ref={fileInputRef} type="file" multiple hidden onChange={onPickFiles} />
            </div>
            <div className="flex items-end gap-2">
              <textarea
                ref={composerRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                rows={1}
                placeholder={`Message ${convTitle(activeConv, meId)}`}
                className="flex-1 resize-none max-h-40 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
              <button onClick={handleSend} disabled={(!draft.trim() && pendingFiles.length === 0) || sending}
                className="shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
          <ChatBubbleIcon large />
          <p className="text-sm mt-3 text-gray-400">Select a conversation or start a new one</p>
        </div>
      )}

      {showNew && (
        <NewChatModal
          members={members.filter(m => m.id !== meId)}
          presence={presence}
          onClose={() => setShowNew(false)}
          onStartDM={startDM}
          onCreateGroup={createGroup}
        />
      )}
    </div>
  )
}

// Normalize a SQLite/ISO timestamp to a Date-parseable string (UTC).
function clockKey(ts: string): string {
  return /\dT\d/.test(ts) ? ts : ts.replace(' ', 'T') + 'Z'
}

function GroupIcon() {
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-2.5-1.35"/></svg>
}
function ChatBubbleIcon({ large }: { large?: boolean }) {
  return <svg className={large ? 'w-14 h-14' : 'w-10 h-10'} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.3} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.9 7.9 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
}
function FileIcon() {
  return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// Renders a sent attachment: images inline (click to open full), other files as a download chip.
function AttachmentView({ att }: { att: ChatAttachment }) {
  const isImage = att.mime.startsWith('image/')
  if (isImage) {
    return (
      <a href={resolveFileUrl(att.url)} target="_blank" rel="noopener noreferrer" className="block">
        <img src={resolveFileUrl(att.url)} alt={att.filename}
          className="max-w-[260px] max-h-[260px] rounded-lg border border-gray-200 object-cover hover:opacity-90 transition-opacity" />
      </a>
    )
  }
  return (
    <a href={resolveFileUrl(att.url)} target="_blank" rel="noopener noreferrer" download
      className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors max-w-[260px]">
      <span className="w-9 h-9 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><FileIcon /></span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-700 truncate">{att.filename}</p>
        <p className="text-[10px] text-gray-400">{fmtBytes(att.size)} · Download</p>
      </div>
    </a>
  )
}
