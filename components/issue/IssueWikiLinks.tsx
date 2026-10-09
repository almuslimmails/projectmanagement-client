'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { relTime } from '@/lib/utils'

interface WikiLink {
  id: string
  project_id: string
  title: string
  updated_at: string
}

interface Props {
  projectId: string
  issueId: string
  // Optional: called when the caller wants to open a wiki page in-app. If
  // omitted the panel just shows the links read-only.
  onOpenPage?: (page: WikiLink) => void
}

// Read-only list of wiki pages that link this issue AND that the current
// member is authorised to see. The server filters by wiki ACL — pages the
// caller can't access simply aren't returned, so they can't infer that a
// link they can't see exists.
export default function IssueWikiLinks({ projectId, issueId, onOpenPage }: Props) {
  const [items, setItems] = useState<WikiLink[] | null>(null)

  useEffect(() => {
    let cancelled = false
    api.listIssueWikiLinks(projectId, issueId)
      .then((rows: WikiLink[]) => { if (!cancelled) setItems(rows) })
      .catch(() => { if (!cancelled) setItems([]) })
    return () => { cancelled = true }
  }, [projectId, issueId])

  // Loading → render nothing (no skeleton — this panel is often empty).
  if (items === null) return null
  // If the caller has zero visible links, hide the whole section — showing
  // "0 wiki pages" would tempt them to wonder whether there are hidden ones.
  if (items.length === 0) return null

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Wiki pages <span className="text-gray-300 normal-case ml-1">({items.length})</span>
      </p>
      <ul className="space-y-1">
        {items.map(p => {
          const inner = (
            <>
              <span className="text-base leading-none shrink-0">📄</span>
              <span className="text-sm text-gray-800 truncate flex-1">{p.title}</span>
              <span className="text-[10px] text-gray-400 shrink-0">updated {relTime(p.updated_at)}</span>
            </>
          )
          return (
            <li key={p.id}>
              {onOpenPage ? (
                <button onClick={() => onOpenPage(p)}
                  className="w-full flex items-center gap-2 text-left ring-1 ring-gray-200 hover:ring-indigo-300 hover:bg-indigo-50/30 rounded-lg px-3 py-2 transition-all">
                  {inner}
                </button>
              ) : (
                <div className="w-full flex items-center gap-2 ring-1 ring-gray-200 rounded-lg px-3 py-2">
                  {inner}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
