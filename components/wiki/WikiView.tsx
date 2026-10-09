'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Member, WikiPage } from '@/lib/types'
import { api } from '@/lib/api'
import MarkdownView from '@/components/ui/MarkdownView'
import AssigneePicker from '@/components/ui/AssigneePicker'
import { Avatar } from '@/components/ui/Avatar'
import WikiPageIssueLinks from '@/components/wiki/WikiPageIssueLinks'
import { relTime } from '@/lib/utils'
import '@uiw/react-md-editor/markdown-editor.css'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface Props {
  projectId: string
  members: Member[]
  currentMember: Member | null
}

export default function WikiView({ projectId, members, currentMember, onClickIssue }: Props & { onClickIssue?: (issueId: string, projectId: string) => void }) {
  const [pages, setPages] = useState<WikiPage[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [creatingTitle, setCreatingTitle] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const active = pages.find(p => p.id === activeId) ?? null

  async function refresh(selectId?: string) {
    setLoading(true)
    try {
      const list = await api.listWiki(projectId) as WikiPage[]
      setPages(list)
      const next = selectId ?? activeId ?? list[0]?.id ?? null
      setActiveId(next)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [projectId, currentMember?.id])

  function startCreate() {
    setCreatingTitle('')
    setError(null)
  }

  async function submitCreate() {
    const title = (creatingTitle ?? '').trim()
    if (!title) { setCreatingTitle(null); return }
    try {
      const page = await api.createWikiPage(projectId, { title })
      setCreatingTitle(null)
      await refresh(page.id)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create page')
    }
  }

  async function deletePage() {
    if (!active) return
    if (!confirm(`Delete "${active.title}"?`)) return
    await api.deleteWikiPage(projectId, active.id)
    setActiveId(null)
    await refresh()
  }

  function startEdit() {
    if (!active) return
    setDraftTitle(active.title)
    setDraftContent(active.content)
    setEditing(true)
  }

  async function saveEdit() {
    if (!active) return
    await api.updateWikiPage(projectId, active.id, { title: draftTitle, content: draftContent })
    setEditing(false)
    await refresh(active.id)
  }

  async function syncMembers(newIds: string[]) {
    if (!active) return
    const currentIds = active.members.map(m => m.id)
    const toAdd = newIds.filter(id => !currentIds.includes(id))
    const toRemove = currentIds.filter(id => !newIds.includes(id))
    for (const id of toAdd) await api.addWikiPageMember(projectId, active.id, id)
    for (const id of toRemove) await api.removeWikiPageMember(projectId, active.id, id)
    await refresh(active.id)
  }

  if (loading && pages.length === 0) {
    return <div className="p-8 text-sm text-gray-500">Loading wiki…</div>
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: page list */}
      <aside className="w-64 shrink-0 border-r bg-white overflow-y-auto">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Pages ({pages.length})</p>
          <button onClick={startCreate}
            title="Create a new wiki page"
            className="flex items-center gap-1 text-[11px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-md shadow-sm">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
            New
          </button>
        </div>
        {creatingTitle !== null && (
          <div className="px-3 py-2 border-b bg-indigo-50/40">
            <input
              autoFocus
              value={creatingTitle}
              onChange={e => setCreatingTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitCreate()
                else if (e.key === 'Escape') { setCreatingTitle(null); setError(null) }
              }}
              placeholder="Page title…"
              className="w-full text-sm bg-white border border-indigo-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <div className="flex justify-end gap-2 mt-1.5">
              <button onClick={() => { setCreatingTitle(null); setError(null) }}
                className="text-[11px] text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={submitCreate} disabled={!creatingTitle?.trim()}
                className="text-[11px] text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-2 py-0.5 rounded">Create</button>
            </div>
            {error && <p className="text-[10px] text-red-600 mt-1">{error}</p>}
          </div>
        )}
        {pages.length === 0 && creatingTitle === null ? (
          <p className="text-xs text-gray-400 italic px-4 py-3">No pages you can see yet</p>
        ) : pages.length === 0 ? null : (
          <ul>
            {pages.map(p => (
              <li key={p.id}>
                <button onClick={() => { setActiveId(p.id); setEditing(false) }}
                  className={`w-full text-left px-4 py-2.5 border-b border-gray-100 hover:bg-indigo-50/40 transition-colors ${p.id === activeId ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : 'border-l-2 border-l-transparent'}`}>
                  <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{p.members.length} member{p.members.length === 1 ? '' : 's'} · updated {relTime(p.updated_at)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Right: page content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {!active ? (
          <EmptyState onCreate={startCreate} canCreate={true} />
        ) : editing ? (
          <Editor
            title={draftTitle}
            content={draftContent}
            onTitleChange={setDraftTitle}
            onContentChange={setDraftContent}
            onCancel={() => setEditing(false)}
            onSave={saveEdit}
          />
        ) : (
          <PageView page={active} projectId={projectId} members={members} onEdit={startEdit} onDelete={deletePage} onMembersChange={syncMembers} onClickIssue={onClickIssue} />
        )}
      </main>
    </div>
  )
}

function EmptyState({ onCreate, canCreate }: { onCreate: () => void; canCreate: boolean }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8">
      <div className="text-5xl mb-4">📚</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Project wiki</h2>
      <p className="text-sm text-gray-500 max-w-md mb-6">
        Private documentation for this project. Each page is visible only to members you explicitly assign — keep design notes, runbooks, decisions, and onboarding docs.
      </p>
      {canCreate && (
        <button onClick={onCreate}
          className="flex items-center gap-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 px-4 py-2.5 rounded-lg">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
          Create your first page
        </button>
      )}
    </div>
  )
}

function PageView({ page, projectId, members, onEdit, onDelete, onMembersChange, onClickIssue }: {
  page: WikiPage; projectId: string; members: Member[]; onEdit: () => void; onDelete: () => void
  onMembersChange: (ids: string[]) => void
  onClickIssue?: (issueId: string, projectId: string) => void
}) {
  return (
    <div className="max-w-3xl mx-auto p-8 space-y-5">
      <div className="flex items-start gap-3">
        <h1 className="text-3xl font-bold text-gray-900 flex-1 leading-tight">{page.title}</h1>
        <button onClick={onEdit}
          className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 rounded-lg shadow-sm">Edit</button>
        <button onClick={onDelete}
          className="text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">Delete</button>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500">
        {page.creator && (
          <span className="inline-flex items-center gap-1.5">
            <Avatar name={page.creator.name} size={4} /> {page.creator.name}
          </span>
        )}
        <span>· created {relTime(page.created_at)}</span>
        {page.editor && page.updated_at !== page.created_at && (
          <span>· edited by {page.editor.name} {relTime(page.updated_at)}</span>
        )}
      </div>

      <div className="bg-white ring-1 ring-gray-100 rounded-2xl p-6 min-h-[200px]">
        {page.content ? (
          <MarkdownView value={page.content} />
        ) : (
          <p className="text-sm text-gray-400 italic">No content yet — click Edit to add some.</p>
        )}
      </div>

      <div className="bg-white ring-1 ring-gray-100 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
            Access ({page.members.length})
          </p>
          <span className="text-[11px] text-gray-400">Only listed members + owners can view</span>
        </div>
        <AssigneePicker
          members={members}
          selectedIds={page.members.map(m => m.id)}
          onChange={onMembersChange}
        />
      </div>

      {/* Wiki ↔ issue link panel. Anyone who can see this page can add or
          remove links; users who can't see the page never reach this panel. */}
      <WikiPageIssueLinks projectId={projectId} pageId={page.id} onClickIssue={onClickIssue} />
    </div>
  )
}

function Editor({ title, content, onTitleChange, onContentChange, onCancel, onSave }: {
  title: string; content: string
  onTitleChange: (v: string) => void; onContentChange: (v: string) => void
  onCancel: () => void; onSave: () => void
}) {
  return (
    <div className="max-w-3xl mx-auto p-8 space-y-4">
      <input
        autoFocus
        value={title}
        onChange={e => onTitleChange(e.target.value)}
        placeholder="Page title"
        className="w-full text-3xl font-bold text-gray-900 border-0 focus:outline-none placeholder-gray-300 bg-transparent"
      />
      <div data-color-mode="light" className="bg-white ring-1 ring-gray-100 rounded-2xl overflow-hidden">
        <MDEditor
          value={content}
          onChange={v => onContentChange(v ?? '')}
          height={500}
          preview="edit"
          visibleDragbar={false}
          textareaProps={{ placeholder: 'Write your documentation in markdown…' }}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel}
          className="text-sm text-gray-600 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors">Cancel</button>
        <button onClick={onSave}
          className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 px-5 py-2 rounded-lg">Save</button>
      </div>
    </div>
  )
}
