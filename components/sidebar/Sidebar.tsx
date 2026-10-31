'use client'
import { useEffect, useState } from 'react'
import type { Workspace, Project, Member, Company } from '@/lib/types'
import { Avatar } from '@/components/ui/Avatar'
import ClockWidget from './ClockWidget'
import { api } from '@/lib/api'

const STATUS_COLOR: Record<string, string> = {
  online:  'bg-emerald-400',
  break:   'bg-amber-400',
  offline: 'bg-gray-500',
}

type View = 'dashboard' | 'sprints' | 'board' | 'list' | 'spreadsheet' | 'gantt' | 'cycles' | 'modules' | 'wiki' | 'attendance' | 'chat' | 'announcements' | 'exams'
  | 'ai-syllabus' | 'ai-workbook' | 'ai-dictionary' | 'ai-assessment' | 'ai-answer-key'

interface Props {
  workspace: Workspace | null
  projects: Project[]
  members: Member[]
  activeProject: Project | null
  activeView: View
  currentMember: Member | null
  overdueCount: number
  /** Per-role allowed menu ids — filters NAV_ITEMS for the current member. */
  rolePermissions?: Record<string, string[]>
  /** Company entity — its master feature switches cap every role's menus. */
  company?: Company | null
  /** Whether the current member may create boards (owner/admin/manager). */
  canCreateBoard?: boolean
  /** True when the current member has at least one exam assigned. The Exams
      menu is visible only to owners (management) or assignees — everyone else
      never learns it exists. */
  examAssigned?: boolean
  onSelectProject: (p: Project) => void
  onSelectView: (v: View) => void
  onCreateProject: () => void
  onCreateMember: () => void
  onSwitchUser: (memberId: string | null) => void
  onOpenWorkspaceSettings?: () => void
  onSignOut?: () => void
}

type NavItem = { id: View; label: string; icon: React.ReactNode }

// Primary workspace views.
const MAIN_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { id: 'sprints', label: 'Sprints', icon: <SprintIcon /> },
  { id: 'board', label: 'Board', icon: <BoardIcon /> },
  { id: 'list', label: 'Issues', icon: <ListIcon /> },
  { id: 'cycles', label: 'Milestones', icon: <CycleIcon /> },
  { id: 'modules', label: 'Epics', icon: <ModuleIcon /> },
  { id: 'wiki', label: 'Wiki', icon: <WikiIcon /> },
  { id: 'announcements', label: 'Announcements', icon: <MegaphoneIcon /> },
]

// "Reports" is a collapsible group holding the analytical / tabular views.
const REPORTS_CHILDREN: NavItem[] = [
  { id: 'spreadsheet', label: 'Spreadsheet', icon: <SpreadIcon /> },
  { id: 'gantt', label: 'Gantt', icon: <GanttIcon /> },
  { id: 'attendance', label: 'Attendance', icon: <AttendanceIcon /> },
]

// "Artificial Intelligence" — collapsible group of the bundled AI Foundations
// documents (public/ai/*.html). Gated by the single 'ai' menu id; the Answer
// Key child is additionally restricted to owner/admin/manager so course
// answers don't leak to trainees.
const AI_CHILDREN: NavItem[] = [
  { id: 'ai-syllabus',   label: 'Syllabus',   icon: <DocIcon /> },
  { id: 'ai-workbook',   label: 'Workbook',   icon: <DocIcon /> },
  { id: 'ai-dictionary', label: 'Dictionary', icon: <DocIcon /> },
  { id: 'ai-assessment', label: 'Assessment', icon: <DocIcon /> },
  { id: 'ai-answer-key', label: 'Answer Key', icon: <DocIcon /> },
]
const ANSWER_KEY_ROLES = ['owner', 'admin', 'manager']

export default function Sidebar({ workspace, projects, members, activeProject, activeView, currentMember, overdueCount, rolePermissions, company, canCreateBoard, examAssigned, onSelectProject, onSelectView, onCreateProject, onCreateMember, onSwitchUser, onOpenWorkspaceSettings, onSignOut }: Props) {
  // Menu visibility is the hierarchy top-down: a feature must be ON for the
  // company AND granted to the member's role. Missing data defaults to
  // visible (safe fallback before company/permissions arrive).
  const allowedMenus = (currentMember && rolePermissions?.[currentMember.role]) || null
  const featureOn = (id: string) => company?.features?.[id] !== false
  const isAllowed = (id: string) => featureOn(id) && (!allowedMenus || allowedMenus.includes(id))
  // Exams: assignment-driven visibility (owners always see it to manage),
  // capped by the company's AI feature switch.
  const examsVisible = featureOn('ai') && (currentMember?.role === 'owner' || !!examAssigned)
  const visibleMain: NavItem[] = [
    ...MAIN_NAV.filter(it => isAllowed(it.id)),
    ...(examsVisible ? [{ id: 'exams' as View, label: 'Exams', icon: <ExamIcon /> }] : []),
  ]
  const visibleReports = REPORTS_CHILDREN.filter(it => isAllowed(it.id))
  const chatAllowed = isAllowed('chat')

  // AI docs group: gated by the single 'ai' menu id; the Answer Key child is
  // further restricted to privileged roles.
  const aiAllowed = isAllowed('ai')
  const visibleAI = aiAllowed
    ? AI_CHILDREN.filter(c => c.id !== 'ai-answer-key' || ANSWER_KEY_ROLES.includes(currentMember?.role ?? ''))
    : []

  // Reports group: auto-expand whenever one of its children is the active view.
  const reportsActive = REPORTS_CHILDREN.some(c => c.id === activeView)
  const [reportsOpen, setReportsOpen] = useState(reportsActive)
  useEffect(() => { if (reportsActive) setReportsOpen(true) }, [reportsActive])

  // AI group: same auto-expand behaviour.
  const aiActive = AI_CHILDREN.some(c => c.id === activeView)
  const [aiOpen, setAiOpen] = useState(aiActive)
  useEffect(() => { if (aiActive) setAiOpen(true) }, [aiActive])

  // Live attendance status for the member-avatar dots.
  // Polled every 30 s; cheap (one-row-per-member snapshot).
  const [liveStatus, setLiveStatus] = useState<Record<string, string>>({})
  useEffect(() => {
    async function pull() {
      try {
        const rows = await api.getLiveStatus() as { member_id: string; status: string }[]
        setLiveStatus(Object.fromEntries(rows.map(r => [r.member_id, r.status])))
      } catch {}
    }
    pull()
    const t = setInterval(pull, 30_000)
    return () => clearInterval(t)
  }, [])

  // Total unread chat messages — drives the badge next to the Chat nav item.
  const [chatUnread, setChatUnread] = useState(0)
  useEffect(() => {
    if (!currentMember) return
    async function pull() {
      try {
        const r = await api.getChatUnread() as { total: number }
        setChatUnread(r?.total ?? 0)
      } catch {}
    }
    pull()
    const t = setInterval(pull, 8_000)
    return () => clearInterval(t)
  }, [currentMember, activeView])

  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <aside className="w-12 bg-[#3F0E40] flex flex-col items-center py-3 gap-3 border-r border-black/20">
        <button onClick={() => setCollapsed(false)} className="text-white/50 hover:text-white/90 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
      </aside>
    )
  }

  return (
    <aside className="w-64 bg-[#3F0E40] text-white flex flex-col border-r border-black/20 shrink-0">
      {/* Workspace header — Slack-style: tighter, bigger square brand badge */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-black/20">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-md bg-white text-[#3F0E40] flex items-center justify-center text-sm font-extrabold shrink-0 shadow-sm">
            {(company?.name ?? workspace?.name)?.[0]?.toUpperCase() ?? 'P'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-extrabold truncate text-white leading-tight">{company?.name ?? workspace?.name ?? 'My Workspace'}</p>
            {currentMember && (
              <p className="text-[11px] text-white/60 leading-tight truncate capitalize">
                {currentMember.name} <span className="text-white/40 normal-case">· {currentMember.role}</span>
              </p>
            )}
          </div>
          {overdueCount > 0 && (
            <span title={`${overdueCount} overdue issue${overdueCount === 1 ? '' : 's'}`}
              className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 shrink-0">
              {overdueCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {currentMember && onSignOut && (
            <button onClick={onSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="text-white/50 hover:text-white/95 hover:bg-white/10 p-1 rounded transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          )}
          <button onClick={() => setCollapsed(true)} title="Collapse sidebar"
            className="text-white/40 hover:text-white/80 p-1 rounded hover:bg-white/10 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </button>
        </div>
      </div>

      {/* Explicit text Sign-out row for maximum discoverability — visible to every role. */}
      {currentMember && onSignOut && (
        <div className="px-4 py-1.5 border-b border-black/20 flex items-center justify-end">
          <button onClick={onSignOut}
            className="text-[11px] font-medium text-white/70 hover:text-white underline-offset-2 hover:underline">
            Sign out
          </button>
        </div>
      )}

      {/* Time-tracking clock — visible to every signed-in member, all roles. */}
      {currentMember && <ClockWidget />}

      {/* Owner-only impersonation picker — lets the workspace owner test the app as any member */}
      {currentMember?.role === 'owner' && members.length > 0 && (
        <div className="px-4 py-3 border-b border-black/20">
          <label className="text-[10px] uppercase tracking-widest text-white/50 font-semibold mb-1.5 block">
            Impersonate <span className="text-white/30 normal-case">(owner only)</span>
          </label>
          <select value={currentMember?.id ?? ''} onChange={e => onSwitchUser(e.target.value || null)}
            className="w-full bg-black/20 text-white text-[13px] rounded-md px-2.5 py-1.5 border border-white/10 hover:bg-black/30 focus:outline-none focus:ring-1 focus:ring-white/30">
            <option value="" className="bg-[#3F0E40]">— pick a user —</option>
            {members.map(m => (
              <option key={m.id} value={m.id} className="bg-[#3F0E40]">
                {m.name} · {m.role}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Projects — Slack-style channel section */}
      <div className="pt-3 pb-1">
        <div className="flex items-center justify-between px-4 mb-1">
          <span className="text-[11px] font-bold tracking-wide text-white/60">Projects</span>
          {/* Board creation is manager+ — hidden for members/viewers (server enforces too). */}
          {canCreateBoard && (
            <button onClick={onCreateProject} title="New project"
              className="text-white/50 hover:text-white transition-colors w-5 h-5 rounded hover:bg-white/10 flex items-center justify-center">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
            </button>
          )}
        </div>
        {/* Board picker — a dropdown, so a long board list doesn't eat the sidebar. */}
        <div className="px-4 pb-1">
          {projects.length ? (
            <select
              value={activeProject?.id ?? ''}
              onChange={e => {
                const p = projects.find(x => x.id === e.target.value)
                if (p) onSelectProject(p)
              }}
              className="w-full bg-black/20 text-white text-[14px] rounded-md px-2.5 py-1.5 border border-white/10 hover:bg-black/30 focus:outline-none focus:ring-1 focus:ring-white/30">
              {!activeProject && <option value="" className="bg-[#3F0E40]">— pick a board —</option>}
              {projects.map(p => (
                <option key={p.id} value={p.id} className="bg-[#3F0E40]">
                  {p.emoji} {p.name} · {p.identifier}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-[11px] text-white/40 py-1">No projects yet</p>
          )}
        </div>
      </div>

      {/* Nav views — Slack-style: full-width blue active state */}
      {activeProject && (
        <div className="pt-3 pb-2 border-t border-black/20 mt-2">
          <span className="text-[11px] font-bold tracking-wide text-white/60 px-4 block mb-1">{activeProject.name}</span>
          <div>
            {visibleMain.map(item => {
              const isActive = activeView === item.id
              return (
                <button key={item.id} onClick={() => onSelectView(item.id)}
                  className={`w-full flex items-center gap-2.5 px-4 py-1.5 text-[15px] transition-colors ${isActive ? 'bg-[#1164A3] text-white font-semibold' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                  <span className="shrink-0 opacity-90">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              )
            })}

            {/* Reports — collapsible group (Spreadsheet · Gantt · Attendance) */}
            {visibleReports.length > 0 && (
              <>
                <button onClick={() => setReportsOpen(o => !o)}
                  className={`w-full flex items-center gap-2.5 px-4 py-1.5 text-[15px] transition-colors ${reportsActive && !reportsOpen ? 'text-white font-semibold' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                  <span className="shrink-0 opacity-90"><ReportsIcon /></span>
                  <span>Reports</span>
                  <svg className={`ml-auto w-3.5 h-3.5 transition-transform ${reportsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                {reportsOpen && visibleReports.map(child => {
                  const isActive = activeView === child.id
                  return (
                    <button key={child.id} onClick={() => onSelectView(child.id)}
                      className={`w-full flex items-center gap-2.5 pl-10 pr-4 py-1.5 text-[14px] transition-colors ${isActive ? 'bg-[#1164A3] text-white font-semibold' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                      <span className="shrink-0 opacity-90">{child.icon}</span>
                      <span>{child.label}</span>
                    </button>
                  )
                })}
              </>
            )}

            {/* Artificial Intelligence — collapsible group of AI Foundations docs */}
            {visibleAI.length > 0 && (
              <>
                <button onClick={() => setAiOpen(o => !o)}
                  className={`w-full flex items-center gap-2.5 px-4 py-1.5 text-[15px] transition-colors ${aiActive && !aiOpen ? 'text-white font-semibold' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                  <span className="shrink-0 opacity-90"><AIIcon /></span>
                  <span>Artificial Intelligence</span>
                  <svg className={`ml-auto w-3.5 h-3.5 transition-transform ${aiOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                {aiOpen && visibleAI.map(child => {
                  const isActive = activeView === child.id
                  return (
                    <button key={child.id} onClick={() => onSelectView(child.id)}
                      className={`w-full flex items-center gap-2.5 pl-10 pr-4 py-1.5 text-[14px] transition-colors ${isActive ? 'bg-[#1164A3] text-white font-semibold' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                      <span className="shrink-0 opacity-90">{child.icon}</span>
                      <span>{child.label}</span>
                    </button>
                  )
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* Bottom region — Chat launcher + Members */}
      <div className="mt-auto">
        {/* Chat — lives at the bottom as a quick-access icon */}
        {activeProject && chatAllowed && (
          <div className="border-t border-black/20 px-2 py-2">
            <button onClick={() => onSelectView('chat')}
              title="Chat"
              className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-md transition-colors ${activeView === 'chat' ? 'bg-[#1164A3] text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
              <span className="relative shrink-0 w-7 h-7 rounded-md bg-white/10 flex items-center justify-center">
                <ChatIcon />
                {chatUnread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center ring-2 ring-[#3F0E40]">
                    {chatUnread > 99 ? '99+' : chatUnread}
                  </span>
                )}
              </span>
              <span className="text-[15px] font-medium">Chat</span>
            </button>
          </div>
        )}

      {/* Members */}
      <div className="border-t border-black/20 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold tracking-wide text-white/60">Members</span>
          <div className="flex items-center gap-2">
            {onOpenWorkspaceSettings && (
              <button onClick={onOpenWorkspaceSettings}
                title="Workspace settings (members + role permissions)"
                className="text-white/30 hover:text-white/70 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </button>
            )}
            {/* Adding users is a company-level action — owner only (server enforces too). */}
            {currentMember?.role === 'owner' && (
              <button onClick={onCreateMember} className="text-white/30 hover:text-white/70 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {members.slice(0, 8).map(m => {
            const status = liveStatus[m.id] ?? 'offline'
            const dot = STATUS_COLOR[status] ?? STATUS_COLOR.offline
            return (
              <div key={m.id} title={`${m.name} · ${m.role} · ${status}`} className="relative ring-2 ring-[#3F0E40] rounded-full">
                <Avatar name={m.name} size={6} />
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#3F0E40] ${dot}`} />
              </div>
            )
          })}
          {members.length > 8 && (
            <span className="self-center text-[10px] text-white/60 bg-black/20 rounded-full w-6 h-6 flex items-center justify-center font-bold">+{members.length - 8}</span>
          )}
        </div>
      </div>
      </div>
    </aside>
  )
}

function DashboardIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg> }
function BoardIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="5" height="18" rx="1" strokeWidth="1.5"/><rect x="10" y="3" width="5" height="12" rx="1" strokeWidth="1.5"/><rect x="17" y="3" width="5" height="15" rx="1" strokeWidth="1.5"/></svg> }
function ListIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6h16M4 12h16M4 18h10"/></svg> }
function SpreadIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="1" strokeWidth="1.5"/><path strokeLinecap="round" strokeWidth="1.5" d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg> }
function GanttIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="1.5" d="M4 6h8M4 12h12M4 18h6"/><rect x="4" y="4" width="8" height="4" rx="1" fill="currentColor" opacity="0.3"/><rect x="4" y="10" width="12" height="4" rx="1" fill="currentColor" opacity="0.3"/><rect x="4" y="16" width="6" height="4" rx="1" fill="currentColor" opacity="0.3"/></svg> }
function SprintIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg> }
function CycleIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> }
function ModuleIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg> }
function WikiIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg> }
function MegaphoneIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg> }
function ExamIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg> }
function AIIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"/></svg> }
function DocIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg> }
function AttendanceIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> }
function ChatIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.9 7.9 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg> }
function ReportsIcon() { return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg> }
