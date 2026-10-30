'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import type { Workspace, Project, Issue, State, Label, Member, Cycle, Module, Company } from '@/lib/types'
import { api, downloadFile, getCurrentMemberId, setCurrentMemberId } from '@/lib/api'
import { isOverdue } from '@/lib/utils'
import { EMPTY_FILTERS, type IssueFilters } from '@/components/issue/IssueFilterBar'

import Sidebar from '@/components/sidebar/Sidebar'
import HeaderUserStrip from '@/components/sidebar/HeaderUserStrip'
import BoardView from '@/components/views/board/BoardView'
import ListView from '@/components/views/list/ListView'
import SpreadsheetView from '@/components/views/spreadsheet/SpreadsheetView'
import GanttView from '@/components/views/gantt/GanttView'
import CyclesPage from '@/components/cycles/CyclesPage'
import ModulesPage from '@/components/modules/ModulesPage'
import DashboardView from '@/components/dashboard/DashboardView'
import SprintsView from '@/components/dashboard/SprintsView'
import WikiView from '@/components/wiki/WikiView'
import AttendanceView from '@/components/attendance/AttendanceView'
import ChatView from '@/components/chat/ChatView'
import ProductTour, { shouldAutoShowTour } from '@/components/tour/ProductTour'
import WelcomeSplash from '@/components/tour/WelcomeSplash'
import AnnouncementTicker from '@/components/announcements/AnnouncementTicker'
import AnnouncementsPage from '@/components/announcements/AnnouncementsPage'
import AIDocView, { AI_DOCS } from '@/components/ai/AIDocView'
import ExamsPage from '@/components/exams/ExamsPage'
import WorkspaceSettingsModal from '@/components/admin/WorkspaceSettingsModal'
import IssueDetail from '@/components/issue/IssueDetail'
import CreateIssueModal from '@/components/issue/CreateIssueModal'
import CreateProjectModal from '@/components/project/CreateProjectModal'
import ProjectSettingsModal from '@/components/project/ProjectSettingsModal'
import CreateMemberModal from '@/components/workspace/CreateMemberModal'

type View = 'dashboard' | 'sprints' | 'board' | 'list' | 'spreadsheet' | 'gantt' | 'cycles' | 'modules' | 'wiki' | 'attendance' | 'chat' | 'announcements' | 'exams'
  | 'ai-syllabus' | 'ai-workbook' | 'ai-dictionary' | 'ai-assessment' | 'ai-answer-key'

// Views where the project-header "New issue" button makes no sense.
const NO_NEW_ISSUE_VIEWS: View[] = [
  'cycles', 'modules', 'dashboard', 'sprints', 'wiki', 'attendance', 'chat', 'announcements', 'exams',
  'ai-syllabus', 'ai-workbook', 'ai-dictionary', 'ai-assessment', 'ai-answer-key',
]

export default function Home() {
  // ── Data ────────────────────────────────────────────────────────
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [members, setMembers] = useState<Member[]>([])
  // Assignable members for the ACTIVE board (server-filtered for restricted boards).
  const [projectMembers, setProjectMembers] = useState<Member[]>([])
  const [currentMemberId, _setCurrentMemberId] = useState<string | null>(null)
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [issues, setIssues] = useState<Issue[]>([])
  const [states, setStates] = useState<State[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [milestones, setMilestones] = useState<Cycle[]>([])
  const [epics, setEpics] = useState<Module[]>([])
  // Issue filter state — server-side filtered through api.getIssues.
  const [issueFilters, setIssueFilters] = useState<IssueFilters>(EMPTY_FILTERS)
  const [totalIssueCount, setTotalIssueCount] = useState(0)

  // ── UI ──────────────────────────────────────────────────────────
  // View persists across reloads so a refresh keeps you on the current screen.
  const [view, _setView] = useState<View>('board')
  function setView(v: View) {
    _setView(v)
    if (typeof window !== 'undefined') window.localStorage.setItem('activeView', v)
  }
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [showCreateIssue, setShowCreateIssue] = useState(false)
  const [createIssueStateId, setCreateIssueStateId] = useState<string | undefined>()
  const [createIssueParent, setCreateIssueParent] = useState<{ id: string; label: string } | null>(null)
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [showProjectSettings, setShowProjectSettings] = useState(false)
  const [showCreateMember, setShowCreateMember] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false)
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({})
  // Company entity — master feature switches that cap every role's menus.
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Bootstrap ────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        let ws = await api.getWorkspace()
        if (!ws) {
          ws = await api.createWorkspace({ name: 'My Workspace' })
        }
        setWorkspace(ws)

        // JWT session → member identity. No token (or a dead one) bounces to
        // sign-in; middleware normally catches this first via the cookie.
        const me: any = await api.authMe().catch(() => null)
        if (!me) {
          api.logout()
          window.location.href = '/sign-in'
          return
        }
        const [projs, mems, perms, comp] = await Promise.all([
          api.getProjects(), api.getMembers(), api.getRolePermissions(),
          api.getCompany().catch(() => null),
        ])
        setProjects(projs)
        setMembers(mems)
        setRolePermissions(perms ?? {})
        setCompany(comp ?? null)

        // Always start as the real signed-in member. Owner impersonation (via the sidebar
        // picker) is session-only — it must NOT persist across reloads, otherwise the owner
        // gets stuck acting as a member (dates disabled, etc.).
        const chosen = me?.id ?? null
        _setCurrentMemberId(chosen)
        setCurrentMemberId(chosen)

        if (projs.length > 0) {
          await loadProject(projs[0])
        }
      } catch (e) {
        console.error('Init error:', e)
      } finally {
        setLoading(false)
      }
    }
    init()
    // Restore the last-viewed screen so a browser refresh doesn't bounce to the Board.
    const savedView = typeof window !== 'undefined' ? window.localStorage.getItem('activeView') : null
    if (savedView) _setView(savedView as View)
    // Auto-show the tour on a user's first visit; they can re-open it from the ? button.
    if (shouldAutoShowTour()) setShowTour(true)
  }, [])

  async function loadProject(project: Project) {
    setActiveProject(project)
    // include_children=1 → subtasks show up as their own cards on the Board/Spreadsheet/etc.
    const [iss, sts, lbls, cyc, mods, pMembers] = await Promise.all([
      api.getIssues(project.id, { include_children: '1' }),
      api.getStates(project.id),
      api.getLabels(project.id),
      api.getCycles(project.id),
      api.getModules(project.id),
      // Restricted boards only offer their attached members for assignment.
      api.getProjectAssignees(project.id).catch(() => null),
    ])
    setIssues(iss)
    setTotalIssueCount(iss.length)
    setStates(sts)
    setLabels(lbls)
    setMilestones(cyc)
    setEpics(mods)
    setProjectMembers(Array.isArray(pMembers) ? pMembers : [])
  }

  // Re-fetch milestones/epics so issue side-changes (set from issue picker) flow back in.
  async function refreshMilestonesEpics() {
    if (!activeProject) return
    const [cyc, mods] = await Promise.all([api.getCycles(activeProject.id), api.getModules(activeProject.id)])
    setMilestones(cyc)
    setEpics(mods)
  }

  // Translate the filter object into the {key: string} dictionary api.getIssues expects.
  function filtersToParams(f: IssueFilters): Record<string, string> {
    const out: Record<string, string> = {}
    if (f.search) out.search = f.search
    if (f.state_id) out.state_id = f.state_id
    if (f.priority) out.priority = f.priority
    if (f.type) out.type = f.type
    if (f.assignee_id) out.assignee_id = f.assignee_id
    if (f.label_id) out.label_id = f.label_id
    if (f.milestone_id) out.milestone_id = f.milestone_id
    if (f.epic_id) out.epic_id = f.epic_id
    if (f.sort) out.sort = f.sort
    return out
  }

  // Always holds the FULL issue set (incl. subtasks). Filtering happens client-side in
  // the Issues list view only — so the Board/Spreadsheet/Gantt are never affected by filters.
  async function refreshIssues() {
    if (!activeProject) return
    const all = await api.getIssues(activeProject.id, { include_children: '1' })
    setIssues(all)
    setTotalIssueCount(all.length)
  }

  // Download the CSV export with the auth headers attached — the route is
  // gated and returns only the viewer's own card scope.
  function handleExportIssues() {
    if (!activeProject) return
    const qs = new URLSearchParams(filtersToParams(issueFilters)).toString()
    downloadFile(`/projects/${activeProject.id}/issues/export${qs ? '?' + qs : ''}`)
      .catch(e => alert(e.message))
  }

  async function refreshStatesAndLabels() {
    if (!activeProject) return
    const [sts, lbls] = await Promise.all([api.getStates(activeProject.id), api.getLabels(activeProject.id)])
    setStates(sts)
    setLabels(lbls)
    await refreshIssues()
  }

  // ── Project CRUD ─────────────────────────────────────────────────
  async function handleCreateProject(data: { name: string; identifier: string; emoji: string; description: string }) {
    const proj = await api.createProject(data)
    const projs = await api.getProjects()
    setProjects(projs)
    setShowCreateProject(false)
    await loadProject(proj)
    setView('board')
  }

  // ── Member CRUD ──────────────────────────────────────────────────
  async function handleCreateMember(data: { name: string; email: string; role: string }) {
    await api.createMember(data)
    const fresh = await api.getMembers()
    setMembers(fresh)
    // If no current user yet, adopt the new one.
    if (!currentMemberId && fresh.length === 1) {
      _setCurrentMemberId(fresh[0].id)
      setCurrentMemberId(fresh[0].id)
    }
    setShowCreateMember(false)
  }

  function switchUser(id: string | null) {
    _setCurrentMemberId(id)
    setCurrentMemberId(id)
  }

  const currentMember = useMemo(() => members.find(m => m.id === currentMemberId) ?? null, [members, currentMemberId])
  const overdueCount = useMemo(() => issues.filter(i => isOverdue(i.due_date) && i.state?.group_type !== 'completed' && i.state?.group_type !== 'cancelled').length, [issues])

  // Whether the current member has any exam assigned — drives the Exams menu's
  // visibility for non-owners (owners always see it). Cheap single fetch per
  // member switch.
  const [examAssigned, setExamAssigned] = useState(false)
  useEffect(() => {
    let cancelled = false
    if (!currentMember) { setExamAssigned(false); return }
    if (currentMember.role === 'owner') { setExamAssigned(true); return }
    api.listMyExams()
      .then((rows: any[]) => { if (!cancelled) setExamAssigned(rows.length > 0) })
      .catch(() => { if (!cancelled) setExamAssigned(false) })
    return () => { cancelled = true }
  }, [currentMember?.id, currentMember?.role])
  // Inline-edit on cards (label add/remove via dbl-click) is gated to the same roles as date-editing.
  const canEditCards = useMemo(() => ['owner','admin','manager'].includes(currentMember?.role ?? ''), [currentMember])

  // Open the issue detail panel with the FULL hydrated issue (incl. sub_issues),
  // not whatever the list view happens to hold. Without this, sub-issues don't
  // appear in the detail panel when an issue is opened from Board/List/etc.
  async function openIssueDetail(issue: Issue) {
    if (!activeProject) return
    setSelectedIssue(issue)  // optimistic: paint immediately
    const full = await api.getIssue(activeProject.id, issue.id).catch(() => null)
    if (full) setSelectedIssue(full)
  }

  // Refetch everything for the active project — issues, states, labels, milestones,
  // epics — without a full browser reload. Powers the header's Reload button.
  async function reloadProject() {
    if (!activeProject || reloading) return
    setReloading(true)
    try { await loadProject(activeProject) } finally { setReloading(false) }
  }

  // ── Issue CRUD ───────────────────────────────────────────────────
  async function handleCreateIssue(data: {
    title: string; description: string; state_id: string; priority: string
    assignee_ids: string[]; label_ids: string[]; start_date: string; due_date: string; estimate: string
    type: import('@/lib/types').IssueType; parent_id?: string
  }) {
    if (!activeProject) return
    try {
      await api.createIssue(activeProject.id, {
        title: data.title,
        description: data.description,
        type: data.type,
        parent_id: data.parent_id,
        state_id: data.state_id || states[0]?.id,
        priority: data.priority as any,
        assignee_ids: data.assignee_ids,
        label_ids: data.label_ids,
        start_date: data.start_date || undefined,
        due_date: data.due_date || undefined,
        estimate: data.estimate ? parseInt(data.estimate) : undefined,
      })
    } catch (e: any) {
      alert(e?.message ?? 'Failed to create issue')
      return
    }
    setShowCreateIssue(false)
    setCreateIssueParent(null)
    await refreshIssues()
    if (data.parent_id && selectedIssue && selectedIssue.id === data.parent_id) {
      const fresh = await api.getIssue(activeProject.id, selectedIssue.id)
      setSelectedIssue(fresh)
    }
  }

  async function handleUpdateIssue(patch: Partial<Issue> & { label_ids?: string[] }) {
    if (!selectedIssue || !activeProject) return
    try {
      await api.updateIssue(activeProject.id, selectedIssue.id, patch)
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update issue')
      return
    }
    const updated = await api.getIssue(activeProject.id, selectedIssue.id)
    setSelectedIssue(updated)
    await refreshIssues()
  }

  async function handleDeleteIssue() {
    if (!selectedIssue || !activeProject) return
    await api.deleteIssue(activeProject.id, selectedIssue.id)
    setSelectedIssue(null)
    await refreshIssues()
  }

  async function handleMoveIssue(issueId: string, stateId: string) {
    if (!activeProject) return
    await api.updateIssue(activeProject.id, issueId, { state_id: stateId })
    await refreshIssues()
  }

  // Generic per-issue patch used by inline editors on cards (label add/remove, etc.).
  async function handlePatchIssue(issueId: string, patch: { label_ids?: string[] }) {
    if (!activeProject) return
    try {
      await api.updateIssue(activeProject.id, issueId, patch)
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update issue')
      return
    }
    await refreshIssues()
  }

  async function handleSetMilestone(issueId: string, milestoneId: string | null) {
    if (!activeProject) return
    try {
      await api.setIssueMilestone(activeProject.id, issueId, milestoneId)
    } catch (e: any) {
      alert(e?.message ?? 'Failed to set milestone'); return
    }
    await refreshIssues()
    if (selectedIssue?.id === issueId) {
      const fresh = await api.getIssue(activeProject.id, issueId)
      setSelectedIssue(fresh)
    }
  }

  async function handleSetEpic(issueId: string, epicId: string | null) {
    if (!activeProject) return
    try {
      await api.setIssueEpic(activeProject.id, issueId, epicId)
    } catch (e: any) {
      alert(e?.message ?? 'Failed to set epic'); return
    }
    await refreshIssues()
    if (selectedIssue?.id === issueId) {
      const fresh = await api.getIssue(activeProject.id, issueId)
      setSelectedIssue(fresh)
    }
  }

  async function handleReorderStates(orderedIds: string[]) {
    if (!activeProject) return
    const fresh = await api.reorderStates(activeProject.id, orderedIds)
    setStates(fresh)
  }

  function openCreateIssue(stateId?: string) {
    setCreateIssueStateId(stateId)
    setCreateIssueParent(null)
    setShowCreateIssue(true)
  }

  function openCreateSubIssue() {
    if (!selectedIssue || !activeProject) return
    setCreateIssueStateId(undefined)
    setCreateIssueParent({
      id: selectedIssue.id,
      label: `${activeProject.identifier}-${selectedIssue.sequence_id}`,
    })
    setShowCreateIssue(true)
  }

  async function openSubIssue(sub: Issue) {
    if (!activeProject) return
    const full = await api.getIssue(activeProject.id, sub.id)
    setSelectedIssue(full)
  }

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading workspace…</p>
        </div>
      </div>
    )
  }

  return (
    <>
    <WelcomeSplash />
    <AnnouncementTicker currentMember={currentMember} />
    <div className="flex h-screen overflow-hidden bg-[#F8F8F8]">
      <Sidebar
        workspace={workspace}
        projects={projects}
        members={members}
        activeProject={activeProject}
        activeView={view}
        currentMember={currentMember}
        overdueCount={overdueCount}
        rolePermissions={rolePermissions}
        company={company}
        examAssigned={examAssigned}
        canCreateBoard={canEditCards}
        onSelectProject={async p => { await loadProject(p); setView('board') }}
        onSelectView={setView}
        onCreateProject={() => setShowCreateProject(true)}
        onCreateMember={() => setShowCreateMember(true)}
        onSwitchUser={switchUser}
        onOpenWorkspaceSettings={() => setShowWorkspaceSettings(true)}
        onSignOut={() => { api.logout(); window.location.href = '/sign-in' }}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {activeProject ? (
          <>
            {/* Top bar — Slack channel-header style */}
            <header className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white shrink-0">
              <span className="text-xl leading-none">{activeProject.emoji}</span>
              <div className="flex items-baseline gap-2 min-w-0">
                <h1 className="font-extrabold text-gray-900 text-[15px] leading-tight">{activeProject.name}</h1>
                <span className="text-[11px] font-mono text-gray-400 tracking-wider">{activeProject.identifier}</span>
              </div>

              <div className="ml-auto flex items-center gap-3">
                {/* Always-visible user + clock strip — reachable even when the
                    sidebar is collapsed. Every signed-in member sees this. */}
                <HeaderUserStrip
                  currentMember={currentMember}
                  onSignOut={() => { api.logout(); window.location.href = '/sign-in' }}
                />
                <span className="hidden md:inline-block w-px h-6 bg-gray-200" aria-hidden />
                {!NO_NEW_ISSUE_VIEWS.includes(view) && (
                  <button onClick={() => openCreateIssue()}
                    className="flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-sm shadow-indigo-600/20 px-3.5 py-2 rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                    New issue
                  </button>
                )}
                <button onClick={reloadProject} disabled={reloading}
                  title="Reload project data"
                  aria-label="Reload project"
                  className="p-2 text-gray-500 hover:text-indigo-700 hover:bg-indigo-50 disabled:hover:bg-transparent disabled:hover:text-gray-500 disabled:cursor-not-allowed rounded-lg transition-colors">
                  <svg className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                </button>
                <button onClick={() => setShowTour(true)}
                  title="Product tour"
                  className="p-2 text-gray-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093V14m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </button>
                <button onClick={() => setShowProjectSettings(true)}
                  title="Project settings"
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </button>
              </div>
            </header>

            {/* View content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {view === 'dashboard' && (
                <DashboardView
                  projects={projects}
                  initialProjectId={activeProject.id}
                  onSelectProject={(pid) => {
                    const p = projects.find(x => x.id === pid)
                    if (p && p.id !== activeProject.id) setActiveProject(p)
                  }}
                  onClickIssue={async (pid, iid) => {
                    const full = await api.getIssue(pid, iid)
                    setSelectedIssue(full)
                  }}
                />
              )}
              {view === 'sprints' && (
                <SprintsView
                  onClickIssue={async (pid, iid) => {
                    const full = await api.getIssue(pid, iid)
                    setSelectedIssue(full)
                  }}
                />
              )}
              {view === 'board' && (
                <BoardView
                  issues={issues}
                  states={states}
                  labels={labels}
                  project={activeProject}
                  canEdit={canEditCards}
                  onClickIssue={openIssueDetail}
                  onMoveIssue={handleMoveIssue}
                  onCreateIssue={openCreateIssue}
                  onReorderStates={handleReorderStates}
                  onUpdateIssue={handlePatchIssue}
                />
              )}
              {view === 'list' && (
                <ListView
                  issues={issues}
                  states={states}
                  labels={labels}
                  members={projectMembers}
                  milestones={milestones.map(m => ({ id: m.id, name: m.name }))}
                  epics={epics.map(e => ({ id: e.id, name: e.name }))}
                  project={activeProject}
                  canEdit={canEditCards}
                  filters={issueFilters}
                  onFiltersChange={setIssueFilters}
                  totalCount={totalIssueCount}
                  onClickIssue={openIssueDetail}
                  onCreateIssue={openCreateIssue}
                  onUpdateIssue={handlePatchIssue}
                  onExport={handleExportIssues}
                />
              )}
              {view === 'spreadsheet' && (
                <SpreadsheetView
                  issues={issues}
                  states={states}
                  labels={labels}
                  members={projectMembers}
                  project={activeProject}
                  onClickIssue={openIssueDetail}
                  onUpdateIssue={async (id, patch) => {
                    await api.updateIssue(activeProject.id, id, patch)
                    await refreshIssues()
                  }}
                  onCreateIssue={() => openCreateIssue()}
                />
              )}
              {view === 'gantt' && (
                <GanttView
                  issues={issues}
                  project={activeProject}
                  onClickIssue={openIssueDetail}
                />
              )}
              {view === 'cycles' && (
                <CyclesPage
                  project={activeProject}
                  currentMember={currentMember}
                  onClickIssue={openIssueDetail}
                />
              )}
              {view === 'modules' && (
                <ModulesPage
                  project={activeProject}
                  currentMember={currentMember}
                  onClickIssue={openIssueDetail}
                />
              )}
              {view === 'wiki' && (
                <WikiView
                  projectId={activeProject.id}
                  members={members}
                  currentMember={currentMember}
                  onClickIssue={async (iid, pid) => {
                    const full = await api.getIssue(pid, iid).catch(() => null)
                    if (full) setSelectedIssue(full)
                  }}
                />
              )}
              {view === 'attendance' && (
                <AttendanceView projectId={activeProject.id} />
              )}
              {view === 'announcements' && (
                <AnnouncementsPage members={members} currentMember={currentMember} />
              )}
              {view === 'exams' && (
                <ExamsPage members={members} currentMember={currentMember} />
              )}
              {view.startsWith('ai-') && (() => {
                const doc = AI_DOCS.find(d => `ai-${d.slug}` === view)
                return doc ? <AIDocView doc={doc} /> : null
              })()}
              {view === 'chat' && (
                <ChatView members={members} currentMember={currentMember} />
              )}
            </div>
          </>
        ) : (
          <>
            {/* No-project fallback still needs a top strip so signed-in members
                can clock in and sign out even before they've created a project. */}
            <header className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white shrink-0">
              <span className="text-sm font-semibold text-gray-500">No project selected</span>
              <div className="ml-auto">
                <HeaderUserStrip
                  currentMember={currentMember}
                  onSignOut={() => { api.logout(); window.location.href = '/sign-in' }}
                />
              </div>
            </header>
            <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center p-8">
              <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center text-4xl">📋</div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Tathkarah Project Tracker</h2>
                <p className="text-gray-500">Create your first project to get started</p>
              </div>
              {canEditCards ? (
                <button onClick={() => setShowCreateProject(true)}
                  className="flex items-center gap-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl transition-colors font-medium shadow-md">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                  Create project
                </button>
              ) : (
                <p className="text-xs text-gray-400">Ask a manager to set up the first board.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Overlays */}
      {selectedIssue && activeProject && (
        <IssueDetail
          issue={selectedIssue}
          project={activeProject}
          states={states}
          labels={labels}
          members={projectMembers}
          milestones={milestones.map(m => ({ id: m.id, name: m.name }))}
          epics={epics.map(e => ({ id: e.id, name: e.name }))}
          currentMember={currentMember}
          onClose={() => setSelectedIssue(null)}
          onUpdate={handleUpdateIssue}
          onDelete={handleDeleteIssue}
          onAddSubIssue={openCreateSubIssue}
          onClickSubIssue={openSubIssue}
          onSetMilestone={id => handleSetMilestone(selectedIssue.id, id)}
          onSetEpic={id => handleSetEpic(selectedIssue.id, id)}
        />
      )}

      {showCreateIssue && activeProject && (
        <CreateIssueModal
          states={states}
          labels={labels}
          members={projectMembers}
          currentMember={currentMember}
          defaultStateId={createIssueStateId}
          parentId={createIssueParent?.id}
          parentLabel={createIssueParent?.label}
          onClose={() => { setShowCreateIssue(false); setCreateIssueParent(null) }}
          onCreate={handleCreateIssue}
        />
      )}

      {showCreateProject && (
        <CreateProjectModal
          onClose={() => setShowCreateProject(false)}
          onCreate={handleCreateProject}
        />
      )}

      {showCreateMember && (
        <CreateMemberModal
          onClose={() => setShowCreateMember(false)}
          onCreate={handleCreateMember}
        />
      )}

      {showTour && (
        <ProductTour onClose={() => setShowTour(false)} />
      )}

      {showWorkspaceSettings && (
        <WorkspaceSettingsModal
          members={members}
          currentMember={currentMember}
          company={company}
          onClose={() => setShowWorkspaceSettings(false)}
          onMembersChanged={async () => setMembers(await api.getMembers())}
          onPermissionsChanged={(perms) => setRolePermissions(perms)}
          onCompanyChanged={(c) => setCompany(c)}
        />
      )}

      {showProjectSettings && activeProject && (
        <ProjectSettingsModal
          projectId={activeProject.id}
          project={activeProject}
          states={states}
          labels={labels}
          allMembers={members}
          currentMember={currentMember}
          onClose={() => setShowProjectSettings(false)}
          onChange={async () => {
            // Project metadata, states/labels or board access may have changed.
            const projs = await api.getProjects()
            setProjects(projs)
            const updatedActive = projs.find((p: any) => p.id === activeProject.id) ?? activeProject
            setActiveProject(updatedActive)
            await refreshStatesAndLabels()
            setProjectMembers(await api.getProjectAssignees(activeProject.id).catch(() => members))
          }}
          onDelete={async () => {
            setShowProjectSettings(false)
            const projs = await api.getProjects()
            setProjects(projs)
            // Switch to another project (or clear) so the UI doesn't reference a deleted one.
            const next = projs[0] ?? null
            if (next) await loadProject(next)
            else {
              setActiveProject(null)
              setIssues([]); setStates([]); setLabels([]); setMilestones([]); setEpics([])
            }
          }}
        />
      )}
    </div>
    </>
  )
}
