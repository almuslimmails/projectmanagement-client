'use client'
import { useState } from 'react'
import type { State, Label, Member, IssueType, Priority } from '@/lib/types'
import { PRIORITY_CONFIG, ISSUE_TYPE_CONFIG } from '@/lib/utils'

export interface IssueFilters {
  search: string
  state_id: string | null
  priority: Priority | null
  type: IssueType | null
  assignee_id: string | null
  label_id: string | null
  milestone_id: string | null
  epic_id: string | null
  sort: 'recent' | 'oldest' | 'updated' | 'priority' | 'due_asc' | 'due_desc' | 'seq_desc' | 'seq_asc'
}

export const EMPTY_FILTERS: IssueFilters = {
  search: '',
  state_id: null,
  priority: null,
  type: null,
  assignee_id: null,
  label_id: null,
  milestone_id: null,
  epic_id: null,
  sort: 'seq_desc',
}

const SORT_OPTIONS: { value: IssueFilters['sort']; label: string }[] = [
  { value: 'seq_desc', label: 'Newest first' },
  { value: 'seq_asc',  label: 'Oldest first' },
  { value: 'recent',   label: 'Recently created' },
  { value: 'updated',  label: 'Recently updated' },
  { value: 'priority', label: 'Priority (high → low)' },
  { value: 'due_asc',  label: 'Due date (earliest)' },
  { value: 'due_desc', label: 'Due date (latest)' },
]

interface Props {
  filters: IssueFilters
  onChange: (next: IssueFilters) => void
  total: number
  shown: number
  states: State[]
  labels: Label[]
  members: Member[]
  milestones: { id: string; name: string }[]
  epics: { id: string; name: string }[]
  onExport?: () => void
}

export default function IssueFilterBar({ filters, onChange, total, shown, states, labels, members, milestones, epics, onExport }: Props) {
  const [search, setSearch] = useState(filters.search)

  function set<K extends keyof IssueFilters>(key: K, value: IssueFilters[K]) {
    onChange({ ...filters, [key]: value })
  }
  function clear() { onChange({ ...EMPTY_FILTERS, sort: filters.sort }) }

  const activeCount = [
    filters.search, filters.state_id, filters.priority, filters.type,
    filters.assignee_id, filters.label_id, filters.milestone_id, filters.epic_id,
  ].filter(Boolean).length

  // Chip definitions for any non-empty filter — clicking the × clears that filter.
  const chips: { key: keyof IssueFilters; label: string }[] = []
  if (filters.search)       chips.push({ key: 'search',        label: `“${filters.search}”` })
  if (filters.state_id)     chips.push({ key: 'state_id',      label: `State: ${states.find(s => s.id === filters.state_id)?.name ?? '?'}` })
  if (filters.priority)     chips.push({ key: 'priority',      label: `Priority: ${PRIORITY_CONFIG[filters.priority].label}` })
  if (filters.type)         chips.push({ key: 'type',          label: `Type: ${ISSUE_TYPE_CONFIG[filters.type].label}` })
  if (filters.assignee_id)  chips.push({ key: 'assignee_id',   label: `Assignee: ${members.find(m => m.id === filters.assignee_id)?.name ?? '?'}` })
  if (filters.label_id)     chips.push({ key: 'label_id',      label: `Label: ${labels.find(l => l.id === filters.label_id)?.name ?? '?'}` })
  if (filters.milestone_id) chips.push({ key: 'milestone_id',  label: `🎯 ${milestones.find(m => m.id === filters.milestone_id)?.name ?? '?'}` })
  if (filters.epic_id)      chips.push({ key: 'epic_id',       label: `📦 ${epics.find(e => e.id === filters.epic_id)?.name ?? '?'}` })

  return (
    <div className="bg-white border-b border-gray-200 px-5 py-3 sticky top-0 z-20 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative">
          <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') set('search', search.trim()) }}
            onBlur={() => { if (search !== filters.search) set('search', search.trim()) }}
            placeholder="Search issues…"
            className="pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-transparent hover:border-gray-200 focus:bg-white focus:border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 w-52" />
        </div>

        {/* Filter dropdowns */}
        <FilterSelect
          label="State"
          value={filters.state_id}
          onChange={v => set('state_id', v)}
          options={states.map(s => ({ value: s.id, label: s.name }))} />

        <FilterSelect
          label="Priority"
          value={filters.priority}
          onChange={v => set('priority', v as Priority | null)}
          options={Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} />

        <FilterSelect
          label="Type"
          value={filters.type}
          onChange={v => set('type', v as IssueType | null)}
          options={Object.entries(ISSUE_TYPE_CONFIG).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` }))} />

        <FilterSelect
          label="Assignee"
          value={filters.assignee_id}
          onChange={v => set('assignee_id', v)}
          options={members.map(m => ({ value: m.id, label: m.name }))} />

        <FilterSelect
          label="Label"
          value={filters.label_id}
          onChange={v => set('label_id', v)}
          options={labels.map(l => ({ value: l.id, label: l.name }))} />

        <FilterSelect
          label="Milestone"
          value={filters.milestone_id}
          onChange={v => set('milestone_id', v)}
          options={milestones.map(m => ({ value: m.id, label: `🎯 ${m.name}` }))} />

        <FilterSelect
          label="Epic"
          value={filters.epic_id}
          onChange={v => set('epic_id', v)}
          options={epics.map(e => ({ value: e.id, label: `📦 ${e.name}` }))} />

        {/* Sort + Export — pinned right */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Sort</span>
          <select
            value={filters.sort}
            onChange={e => set('sort', e.target.value as IssueFilters['sort'])}
            className="text-sm bg-gray-50 border border-gray-200 hover:bg-white hover:border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {onExport && (
            <button
              onClick={onExport}
              title={`Export ${shown} issue${shown === 1 ? '' : 's'} as CSV`}
              className="text-sm bg-gray-50 border border-gray-200 hover:bg-white hover:border-indigo-300 hover:text-indigo-700 rounded-md px-3 py-1.5 inline-flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-5l-4 4m0 0l-4-4m4 4V4"/></svg>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Chips row */}
      <div className="flex items-center gap-2 flex-wrap min-h-[24px]">
        <span className="text-[11px] text-gray-500 font-medium">
          Showing <span className="font-bold text-gray-900">{shown}</span> of <span className="font-bold text-gray-900">{total}</span>
        </span>
        {chips.map(c => (
          <button key={c.key as string}
            onClick={() => set(c.key, (c.key === 'search' ? '' : null) as any)}
            className="inline-flex items-center gap-1 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5 hover:bg-indigo-100">
            {c.label}
            <span className="text-indigo-500/70 hover:text-red-500">×</span>
          </button>
        ))}
        {activeCount > 0 && (
          <button onClick={clear}
            className="text-[11px] text-gray-500 hover:text-red-600 underline-offset-2 hover:underline ml-1">
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
  options: { value: string; label: string }[]
}) {
  const active = !!value
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
      className={`text-sm rounded-md px-2 py-1.5 border focus:outline-none focus:ring-2 focus:ring-indigo-100 ${active ? 'bg-indigo-50 border-indigo-200 text-indigo-800 font-medium' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-white hover:border-gray-300'}`}
    >
      <option value="">{label}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
