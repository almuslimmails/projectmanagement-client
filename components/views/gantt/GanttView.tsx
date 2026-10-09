'use client'
import { useMemo } from 'react'
import type { Issue, Project } from '@/lib/types'
import { StateIcon } from '@/components/ui/StateIcon'
import { PriorityIcon } from '@/components/ui/PriorityIcon'
import { fmtDate, formatIssueCode } from '@/lib/utils'

interface Props {
  issues: Issue[]
  project: Project
  onClickIssue: (issue: Issue) => void
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_PX = 28

function daysFromEpoch(date: Date) {
  return Math.floor(date.getTime() / 86400000)
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export default function GanttView({ issues, project, onClickIssue }: Props) {
  const issuesWithDates = issues.filter(i => i.due_date)

  const { start, end, months } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (issuesWithDates.length === 0) {
      const s = new Date(today); s.setDate(1)
      const e = addDays(s, 90)
      return { start: s, end: e, months: [] as { label: string; days: number }[] }
    }

    const dates = issuesWithDates.map(i => new Date(i.due_date!))
    const minDate = new Date(Math.min(...dates.map(d => d.getTime()), today.getTime()))
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime()), today.getTime()))

    minDate.setDate(1)
    maxDate.setDate(maxDate.getDate() + 14)

    // Build months array
    const mths: { label: string; days: number }[] = []
    const cur = new Date(minDate)
    while (cur <= maxDate) {
      const year = cur.getFullYear()
      const month = cur.getMonth()
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      // how many days of this month fall in range
      const monthStart = new Date(year, month, 1)
      const monthEnd = new Date(year, month + 1, 0)
      const visible = Math.min(monthEnd.getTime(), new Date(maxDate).getTime()) - Math.max(monthStart.getTime(), new Date(minDate).getTime())
      const days = Math.floor(visible / 86400000) + 1
      mths.push({ label: `${MONTH_NAMES[month]} ${year}`, days })
      cur.setMonth(cur.getMonth() + 1)
    }

    return { start: minDate, end: maxDate, months: mths }
  }, [issuesWithDates])

  const startDay = daysFromEpoch(start)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayOffset = (daysFromEpoch(today) - startDay) * DAY_PX

  function barStyle(issue: Issue) {
    if (!issue.due_date) return null
    const due = new Date(issue.due_date)
    // Assume issues start 7 days before due by default; or use created_at
    const created = new Date(issue.created_at)
    const barStart = new Date(Math.max(created.getTime(), start.getTime()))
    const left = (daysFromEpoch(barStart) - startDay) * DAY_PX
    const width = Math.max((daysFromEpoch(due) - daysFromEpoch(barStart) + 1) * DAY_PX, DAY_PX)
    const isComplete = issue.state?.group_type === 'completed'
    const isOverdue = due < today && !isComplete
    return { left, width, isComplete, isOverdue }
  }

  if (issuesWithDates.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
        <svg className="w-14 h-14 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <p className="text-gray-400 text-sm">No issues with due dates</p>
        <p className="text-gray-300 text-xs mt-1">Set due dates on issues to see them on the Gantt chart</p>
      </div>
    )
  }

  const totalWidth = months.reduce((sum, m) => sum + m.days * DAY_PX, 0)

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex" style={{ minWidth: totalWidth + 280 }}>
        {/* Left panel - issue list */}
        <div className="w-72 shrink-0 border-r border-gray-200 bg-white">
          <div className="h-10 border-b border-gray-200 px-4 flex items-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Issue</span>
          </div>
          {issuesWithDates.map(issue => (
            <div key={issue.id}
              onClick={() => onClickIssue(issue)}
              className="flex items-center gap-2 px-4 h-10 border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
              <StateIcon state={issue.state} size={13} />
              <PriorityIcon priority={issue.priority} size={12} />
              <span className="text-xs font-mono text-gray-400 shrink-0">{project.identifier}-{formatIssueCode(issue)}</span>
              <span className="text-sm text-gray-800 truncate flex-1">{issue.title}</span>
            </div>
          ))}
        </div>

        {/* Right panel - timeline */}
        <div className="flex-1 overflow-x-auto relative">
          {/* Month headers */}
          <div className="flex h-10 border-b border-gray-200 bg-gray-50 sticky top-0">
            {months.map((m, i) => (
              <div key={i} style={{ width: m.days * DAY_PX }} className="flex items-center justify-center border-r border-gray-200 shrink-0">
                <span className="text-xs font-semibold text-gray-600">{m.label}</span>
              </div>
            ))}
          </div>

          {/* Today line */}
          {todayOffset >= 0 && (
            <div className="absolute top-10 bottom-0 w-px bg-indigo-400 z-10 pointer-events-none" style={{ left: todayOffset + 'px' }}>
              <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-indigo-500" />
            </div>
          )}

          {/* Rows */}
          {issuesWithDates.map(issue => {
            const bar = barStyle(issue)
            if (!bar) return null
            return (
              <div key={issue.id} className="relative h-10 border-b border-gray-100 flex items-center">
                {/* Grid lines */}
                {months.map((m, mi) => (
                  <div key={mi} className="absolute h-full border-r border-gray-100" style={{ width: m.days * DAY_PX, left: months.slice(0, mi).reduce((s, mm) => s + mm.days * DAY_PX, 0) }} />
                ))}
                {/* Bar */}
                <div
                  onClick={() => onClickIssue(issue)}
                  className={`absolute h-5 rounded cursor-pointer flex items-center px-2 text-[10px] font-medium text-white shadow-sm hover:brightness-95 transition-all ${bar.isComplete ? 'bg-green-400' : bar.isOverdue ? 'bg-red-400' : 'bg-indigo-500'}`}
                  style={{ left: bar.left, width: bar.width }}
                  title={`${issue.title} — due ${fmtDate(issue.due_date!)}`}
                >
                  <span className="truncate">{issue.title}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
