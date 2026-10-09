'use client'
import { useEffect, useMemo, useState } from 'react'
import type { Issue } from '@/lib/types'
import { api } from '@/lib/api'
import { StateIcon } from '@/components/ui/StateIcon'
import { PriorityIcon } from '@/components/ui/PriorityIcon'
import { formatIssueCode, ISSUE_TYPE_CONFIG } from '@/lib/utils'
import type { IssueType } from '@/lib/types'

interface LinkedIssue {
  id: string
  sequence_id: number
  type_seq: number | null
  title: string
  priority: string
  type: string
  project_id: string
  project_identifier: string
  state: { name: string; color: string; group_type: string } | null
}

interface Props {
  projectId: string
  pageId: string
  onClickIssue?: (issueId: string, projectId: string) => void
}

// Linked-issues panel for a wiki page. Anyone who can see the page can add
// or remove links here — the API gate uses canSeeWikiPage(). Users who can't
// see the page never reach this panel at all.
export default function WikiPageIssueLinks({ projectId, pageId, onClickIssue }: Props) {
  const [links, setLinks] = useState<LinkedIssue[] | null>(null)
  const [candidates, setCandidates] = useState<Issue[]>([])
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    try {
      const rows: LinkedIssue[] = await api.listWikiPageIssues(projectId, pageId)
      setLinks(rows)
    } catch { setLinks([]) }
  }

  useEffect(() => {
    refresh()
    // Preload every issue in the current project for the picker — same
    // approach the milestone/epic drawers use. Small dataset, easy filter.
    api.getIssues(projectId).then((rows: Issue[]) => setCandidates(rows ?? [])).catch(() => setCandidates([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, pageId])

  const linkedIds = useMemo(() => new Set((links ?? []).map(l => l.id)), [links])
  const available = useMemo(() => {
    const q = query.trim().toLowerCase()
    return candidates
      .filter(i => !linkedIds.has(i.id))
      .filter(i => !q || i.title.toLowerCase().includes(q) || `${i.sequence_id}`.includes(q))
      .slice(0, 25)
  }, [candidates, linkedIds, query])

  async function add(issue: Issue) {
    setBusy(true); setError(null)
    try {
      await api.linkWikiPageIssue(projectId, pageId, issue.id)
      await refresh()
      setQuery('')
    } catch (e: any) {
      setError(e?.message ?? 'Failed to link issue')
    } finally { setBusy(false) }
  }

  async function remove(id: string) {
    setBusy(true); setError(null)
    try {
      await api.unlinkWikiPageIssue(projectId, pageId, id)
      await refresh()
    } catch (e: any) {
      setError(e?.message ?? 'Failed to unlink issue')
    } finally { setBusy(false) }
  }

  return (
    <div className="bg-white ring-1 ring-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
          Linked issues {links && links.length > 0 && <span className="text-gray-300 normal-case ml-1">({links.length})</span>}
        </p>
        {!adding && (
          <button onClick={() => { setAdding(true); setError(null) }}
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Link issue
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-3 ring-1 ring-indigo-100 bg-indigo-50/30 rounded-lg p-2 space-y-2">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && (setAdding(false), setQuery(''))}
            placeholder="Search by title or issue number…"
            disabled={busy}
            className="w-full text-sm bg-white border border-indigo-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          <div className="max-h-56 overflow-y-auto -mx-1 px-1">
            {available.length === 0 ? (
              <p className="text-[11px] text-gray-400 italic py-1.5 px-1">
                {query ? 'No matching issues' : 'No unlinked issues in this project'}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {available.map(i => (
                  <li key={i.id}>
                    <button onClick={() => add(i)} disabled={busy}
                      className="w-full text-left flex items-center gap-2 hover:bg-indigo-100/60 rounded px-2 py-1.5 transition-colors">
                      <StateIcon state={i.state} size={12} />
                      <span className="text-[10px] font-mono text-gray-400 shrink-0">{formatIssueCode(i)}</span>
                      <span className="text-sm text-gray-800 truncate flex-1">{i.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between">
            {error && <p className="text-[11px] text-red-600">{error}</p>}
            <button onClick={() => { setAdding(false); setQuery(''); setError(null) }}
              className="ml-auto text-[11px] text-gray-600 hover:text-gray-800">Done</button>
          </div>
        </div>
      )}

      {links === null ? (
        <p className="text-xs text-gray-400 italic">Loading…</p>
      ) : links.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No issues linked to this page yet</p>
      ) : (
        <ul className="space-y-1.5">
          {links.map(l => {
            const t = ISSUE_TYPE_CONFIG[(l.type as IssueType) ?? 'issue'] ?? ISSUE_TYPE_CONFIG.issue
            // `l.state` carries only the three fields StateIcon reads (name,
            // color, group_type). Cast because we don't send the full State
            // shape from the API for a link summary.
            const stateForIcon = l.state as any
            return (
              <li key={l.id} className="group flex items-center gap-2 ring-1 ring-gray-200 hover:ring-indigo-300 rounded-lg px-3 py-2 transition-colors">
                <StateIcon state={stateForIcon} size={13} />
                <span className="text-[10px] font-mono text-gray-400 shrink-0">
                  {l.project_identifier}-{formatIssueCode(l as any)}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: t.color + '20', color: t.color }} title={t.label}>
                  <span aria-hidden>{t.icon}</span>{t.label}
                </span>
                <button onClick={() => onClickIssue?.(l.id, l.project_id)}
                  className="text-sm text-gray-800 truncate flex-1 text-left hover:text-indigo-700 hover:underline"
                  title="Open issue">
                  {l.title}
                </button>
                <PriorityIcon priority={l.priority as any} size={12} />
                <button onClick={() => remove(l.id)} disabled={busy}
                  title="Unlink"
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
