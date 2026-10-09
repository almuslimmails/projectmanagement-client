'use client'
import { useEffect, useState } from 'react'

interface Step {
  emoji: string
  title: string
  body: React.ReactNode
  accent: 'indigo' | 'amber' | 'emerald' | 'red' | 'violet'
}

const STEPS: Step[] = [
  {
    emoji: '👋',
    accent: 'indigo',
    title: 'Welcome to Tathkarah Project Tracker',
    body: (
      <>
        <p>A lightweight tool to plan, track, and document work across your team.</p>
        <p className="text-gray-500 mt-2">Takes about 60 seconds to walk through. You can re-open this tour anytime from the <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-[10px]">?</kbd> button in the project header.</p>
      </>
    ),
  },
  {
    emoji: '👥',
    accent: 'violet',
    title: 'Sign in as anyone',
    body: (
      <>
        <p>Use the <strong>Signed in as</strong> dropdown in the sidebar to switch between members.</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-600">
          <li><strong>Owner / Admin / Project manager</strong> can change dates and see all wiki pages.</li>
          <li><strong>Member / Viewer</strong> can update issues but cannot change dates.</li>
        </ul>
      </>
    ),
  },
  {
    emoji: '📊',
    accent: 'emerald',
    title: 'The Dashboard',
    body: (
      <>
        <p>Your project at a glance — total issues, in-progress, completed, overdue, and what's been created in the last 7 days.</p>
        <p className="text-gray-500 mt-2">Distribution panels show breakdown by state, priority, type, and workload. The Recent Activity feed surfaces every change anyone made.</p>
      </>
    ),
  },
  {
    emoji: '🐛',
    accent: 'amber',
    title: 'Issues — four levels of hierarchy',
    body: (
      <>
        <p>Every work item is one of:</p>
        <ul className="list-none mt-2 space-y-1 text-gray-700">
          <li>🎯 <strong>Milestone</strong> — a goal or release</li>
          <li>📋 <strong>Task</strong> — a chunk of work under a milestone</li>
          <li>🐛 <strong>Issue</strong> — a regular work item</li>
          <li>✓ <strong>Subtask</strong> — a small piece of an issue</li>
        </ul>
        <p className="text-gray-500 mt-2">Click an issue, then <strong>Add sub-issue</strong> to nest work.</p>
      </>
    ),
  },
  {
    emoji: '🗓️',
    accent: 'red',
    title: 'Start / Due dates + overdue alerts',
    body: (
      <>
        <p>Each issue can have a <strong>start date</strong> and <strong>due date</strong>. If you're a manager (Owner / Admin / Project manager) you can edit them; everyone else sees them locked.</p>
        <p className="text-gray-500 mt-2">When a due date passes, the issue gets an <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">OVERDUE · 3d 2h</span> badge with the elapsed time, and a red counter appears in the sidebar.</p>
      </>
    ),
  },
  {
    emoji: '📝',
    accent: 'indigo',
    title: 'Markdown descriptions + activity log',
    body: (
      <>
        <p>Open any issue and click the description to edit. You get a full markdown editor — headings, lists, task lists, code, links, tables.</p>
        <p className="text-gray-500 mt-2">Below the description, the <strong>Activity</strong> timeline records every change — who, what, when. Great for audits and onboarding.</p>
      </>
    ),
  },
  {
    emoji: '📚',
    accent: 'violet',
    title: 'Private wiki — only assigned members can see',
    body: (
      <>
        <p>The <strong>Wiki</strong> tab stores documentation. Every page is <strong>private by default</strong>: only members you assign to that page can read or edit it.</p>
        <p className="text-gray-500 mt-2">Owners can see every page (for admin oversight). Others see only pages they're assigned to. Useful for design notes, runbooks, decisions, and onboarding.</p>
      </>
    ),
  },
  {
    emoji: '🚀',
    accent: 'emerald',
    title: "You're ready",
    body: (
      <>
        <p>That's the core. Some other things you can explore:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-600">
          <li><strong>Board</strong> — drag-and-drop kanban</li>
          <li><strong>Spreadsheet</strong> — dense bulk view</li>
          <li><strong>Gantt</strong> — timeline view (needs due dates)</li>
          <li><strong>Milestones</strong> — time-boxed goals; <strong>Epics</strong> — feature groupings</li>
          <li><strong>⚙ Settings</strong> — customize states, labels</li>
        </ul>
      </>
    ),
  },
]

const ACCENTS: Record<Step['accent'], { bg: string; ring: string; text: string }> = {
  indigo:  { bg: 'bg-indigo-50',  ring: 'ring-indigo-200',  text: 'text-indigo-700'  },
  amber:   { bg: 'bg-amber-50',   ring: 'ring-amber-200',   text: 'text-amber-700'   },
  emerald: { bg: 'bg-emerald-50', ring: 'ring-emerald-200', text: 'text-emerald-700' },
  red:     { bg: 'bg-red-50',     ring: 'ring-red-200',     text: 'text-red-700'     },
  violet:  { bg: 'bg-violet-50',  ring: 'ring-violet-200',  text: 'text-violet-700'  },
}

const STORAGE_KEY = 'tour-completed-v1'

export function shouldAutoShowTour(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY) !== '1'
}

export default function ProductTour({ onClose }: { onClose: () => void }) {
  const [idx, setIdx] = useState(0)
  // Defensively clamp the index — if a stale click smuggles in an out-of-bounds value, fall back to the last step.
  const safeIdx = Math.max(0, Math.min(STEPS.length - 1, idx))
  const step = STEPS[safeIdx]
  const accent = ACCENTS[step.accent]
  const isLast = safeIdx === STEPS.length - 1

  // Keyboard nav: ← → for prev/next, Esc to dismiss.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') setIdx(i => Math.min(STEPS.length - 1, i + 1))
      else if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  function finish() {
    try { window.localStorage.setItem(STORAGE_KEY, '1') } catch {}
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={finish} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden ring-1 ring-gray-200">
        {/* Header art */}
        <div className={`${accent.bg} ring-1 ${accent.ring} px-8 pt-10 pb-7 text-center`}>
          <div className="text-5xl mb-3">{step.emoji}</div>
          <h2 className={`text-xl font-bold ${accent.text}`}>{step.title}</h2>
        </div>

        {/* Body */}
        <div className="p-8 text-sm text-gray-700 leading-relaxed min-h-[180px]">
          {step.body}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          {/* Dots */}
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-6 bg-indigo-600' : 'w-1.5 bg-gray-300 hover:bg-gray-400'}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={finish}
              className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5">
              {idx === 0 ? 'Skip' : 'Close'}
            </button>
            {idx > 0 && (
              <button onClick={() => setIdx(i => i - 1)}
                className="text-sm text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium">
                Back
              </button>
            )}
            <button onClick={() => isLast ? finish() : setIdx(i => Math.min(STEPS.length - 1, i + 1))}
              className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 px-4 py-1.5 rounded-lg">
              {isLast ? 'Get started' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
