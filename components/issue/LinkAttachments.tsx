'use client'
import { useEffect, useRef, useState } from 'react'
import type { Attachment } from '@/lib/types'
import { api, resolveFileUrl } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'
import { relTime } from '@/lib/utils'

interface Props {
  projectId: string
  issueId: string
}

const MAX_FILES_PER_UPLOAD = 10
const MAX_FILE_MB = 25

// Attachments panel for an issue. Two ways to add:
//   1. Paste a link → OpenGraph preview card (existing behaviour).
//   2. Pick a file (or several) → uploads to /data/uploads and shows an inline
//      image thumb or a generic file chip.
export default function LinkAttachments({ projectId, issueId }: Props) {
  const [items, setItems] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancel = false
    api.getAttachments(projectId, issueId).then((rows: Attachment[]) => {
      if (!cancel) setItems(rows ?? [])
    }).catch(() => {})
    return () => { cancel = true }
  }, [projectId, issueId])

  async function submitLink() {
    const trimmed = url.trim()
    if (!trimmed) return
    const fullUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    setError(null)
    setLoading(true)
    try {
      const att = await api.addAttachment(projectId, issueId, fullUrl)
      setItems(prev => [att, ...prev])
      setUrl('')
      setAdding(false)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to fetch link')
    } finally {
      setLoading(false)
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (list.length === 0) return
    if (list.length > MAX_FILES_PER_UPLOAD) {
      setError(`Please select up to ${MAX_FILES_PER_UPLOAD} files at a time.`)
      return
    }
    const oversized = list.find(f => f.size > MAX_FILE_MB * 1024 * 1024)
    if (oversized) {
      setError(`"${oversized.name}" is larger than ${MAX_FILE_MB} MB.`)
      return
    }
    setError(null)
    setUploading(true)
    try {
      const created: Attachment[] = await api.uploadAttachments(projectId, issueId, list)
      setItems(prev => [...created, ...prev])
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this attachment?')) return
    await api.deleteAttachment(projectId, issueId, id)
    setItems(prev => prev.filter(a => a.id !== id))
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!dragOver) setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={dragOver ? 'ring-2 ring-indigo-300 rounded-lg -m-1 p-1 bg-indigo-50/30 transition-colors' : ''}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Attachments{items.length > 0 && <span className="text-gray-300 normal-case ml-1">({items.length})</span>}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12V4m0 0l-4 4m4-4l4 4" />
            </svg>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
          {!adding && (
            <button onClick={() => { setAdding(true); setError(null) }}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
              Add link
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={e => e.target.files && uploadFiles(e.target.files)}
      />

      {adding && (
        <div className="mb-2 bg-indigo-50/40 ring-1 ring-indigo-100 rounded-lg p-2">
          <input
            autoFocus
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitLink()
              else if (e.key === 'Escape') { setAdding(false); setUrl(''); setError(null) }
            }}
            disabled={loading}
            placeholder="Paste a link (e.g. github.com/...)"
            className="w-full text-sm bg-white border border-indigo-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <div className="flex items-center justify-end gap-2 mt-1.5">
            {loading && <p className="text-[11px] text-indigo-600 mr-auto">Fetching preview…</p>}
            <button onClick={() => { setAdding(false); setUrl(''); setError(null) }}
              disabled={loading}
              className="text-[11px] text-gray-600 hover:text-gray-800">Cancel</button>
            <button onClick={submitLink} disabled={!url.trim() || loading}
              className="text-[11px] text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-2.5 py-1 rounded font-medium">
              {loading ? 'Loading…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mb-2 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>
      )}

      {items.length === 0 && !adding && !uploading ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full text-[11px] text-gray-400 italic border border-dashed border-gray-200 rounded-lg py-3 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/40 transition-colors">
          Drop files here, click <span className="underline">Upload</span>, or add a link
        </button>
      ) : (
        <ul className="space-y-2">
          {uploading && <li className="text-[11px] text-indigo-600 italic">Uploading…</li>}
          {items.map(a => <AttachmentCard key={a.id} att={a} onRemove={() => remove(a.id)} />)}
        </ul>
      )}
    </div>
  )
}

// ── Card renderers ─────────────────────────────────────────────────────────

function AttachmentCard({ att, onRemove }: { att: Attachment; onRemove: () => void }) {
  if (att.kind === 'file') return <FileCard att={att} onRemove={onRemove} />
  return <LinkCard att={att} onRemove={onRemove} />
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function FileCard({ att, onRemove }: { att: Attachment; onRemove: () => void }) {
  const isImage = att.mime.startsWith('image/')
  return (
    <li className="group ring-1 ring-gray-200 rounded-lg overflow-hidden bg-white hover:ring-indigo-300 transition-all">
      <div className="flex">
        {isImage ? (
          <a href={resolveFileUrl(att.url)} target="_blank" rel="noopener noreferrer"
            className="shrink-0 w-24 h-24 bg-gray-50 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveFileUrl(att.url)} alt={att.filename} className="w-full h-full object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          </a>
        ) : (
          <div className="shrink-0 w-24 h-24 bg-gray-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 3v6h6" />
            </svg>
          </div>
        )}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start gap-2">
            <a href={resolveFileUrl(att.url)} target="_blank" rel="noopener noreferrer"
              download={isImage ? undefined : att.filename}
              className="block flex-1 min-w-0">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                {isImage ? 'Image' : (att.mime.split('/')[1] || 'File')}
              </span>
              <p className="text-sm font-semibold text-gray-900 truncate">{att.filename}</p>
              <p className="text-xs text-gray-500 mt-0.5">{fmtBytes(att.size)}</p>
            </a>
            <button onClick={onRemove}
              title="Remove"
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity shrink-0 -mr-1 -mt-1 p-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-gray-400">
            {att.adder && <Avatar name={att.adder.name} size={3} />}
            <span>{att.adder?.name ?? 'Someone'} · uploaded {relTime(att.created_at)}</span>
          </div>
        </div>
      </div>
    </li>
  )
}

function LinkCard({ att, onRemove }: { att: Attachment; onRemove: () => void }) {
  let host = ''
  try { host = new URL(att.url).hostname } catch {}
  const hasImage = !!att.image_url

  return (
    <li className="group ring-1 ring-gray-200 rounded-lg overflow-hidden bg-white hover:ring-indigo-300 transition-all">
      <div className="flex">
        {hasImage && (
          <a href={resolveFileUrl(att.url)} target="_blank" rel="noopener noreferrer"
            className="shrink-0 w-24 h-24 bg-gray-50 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveFileUrl(att.image_url)} alt="" className="w-full h-full object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          </a>
        )}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start gap-2">
            <a href={resolveFileUrl(att.url)} target="_blank" rel="noopener noreferrer"
              className="block flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                {att.favicon_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={att.favicon_url} alt="" className="w-3.5 h-3.5 rounded-sm shrink-0"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                )}
                <span className="text-[10px] text-gray-500 truncate">{att.site_name || host}</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 truncate">{att.title || att.url}</p>
              {att.description && (
                <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{att.description}</p>
              )}
            </a>
            <button onClick={onRemove}
              title="Remove"
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity shrink-0 -mr-1 -mt-1 p-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-gray-400">
            {att.adder && <Avatar name={att.adder.name} size={3} />}
            <span>{att.adder?.name ?? 'Someone'} · added {relTime(att.created_at)}</span>
          </div>
        </div>
      </div>
    </li>
  )
}
