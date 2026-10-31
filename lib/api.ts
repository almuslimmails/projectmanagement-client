export function getCurrentMemberId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('currentMemberId')
}
export function setCurrentMemberId(id: string | null) {
  if (typeof window === 'undefined') return
  if (id) window.localStorage.setItem('currentMemberId', id)
  else window.localStorage.removeItem('currentMemberId')
}

// ── JWT session ─────────────────────────────────────────────────────────
// The token lives in localStorage (sent as Authorization: Bearer on every
// API call) and is mirrored into a cookie so middleware.ts can gate page
// loads server-side. Real security is the API's signature check — the cookie
// is purely a UX redirect hint.
export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('trackerToken')
}
export function setToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) {
    window.localStorage.setItem('trackerToken', token)
    document.cookie = `tracker_token=1; path=/; max-age=${30 * 24 * 3600}; samesite=lax`
  } else {
    window.localStorage.removeItem('trackerToken')
    document.cookie = 'tracker_token=; path=/; max-age=0; samesite=lax'
  }
}

// ── Strangler routing ───────────────────────────────────────────────────
// Domains listed here are served by the standalone Fastify API (tracker-api)
// instead of the Next.js /api routes. Grows one domain at a time until the
// monolith's API layer is empty, then this whole mechanism collapses to a
// single base URL.
const TRACKER_API_BASE =
  process.env.NEXT_PUBLIC_TRACKER_API ?? 'http://localhost:4000'
// Every domain is migrated to tracker-api. The only client path still served
// by Next.js is /me (it reads the NextAuth cookie session, which only the
// Next server can see — goes away when web login moves to JWT).
const MIGRATED_PREFIXES = [
  '/announcements', '/dashboard', '/workspace', '/admin', '/projects',
  '/attendance', '/chat', '/exams', '/company',
]

// Resolve a file/link URL coming from API data: external links pass through,
// API-relative paths (attachments, chat files) resolve against tracker-api.
export function resolveFileUrl(u: string): string {
  if (!u) return u
  return /^https?:\/\//i.test(u) ? u : urlFor(u)
}

export function urlFor(path: string): string {
  return MIGRATED_PREFIXES.some(p => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`))
    ? `${TRACKER_API_BASE}${path}`
    : `/api${path}`
}

// Auth headers for every API call: the JWT identifies the signed-in user;
// X-Current-Member-Id is the act-as header — the server honours it only when
// the token belongs to an owner (powers the impersonation picker).
// Download an API file (CSV export) with the auth headers attached — the
// export routes are gated, so a bare window.open would come back 401.
export async function downloadFile(path: string): Promise<void> {
  const res = await fetch(urlFor(path), { headers: authHeaders() })
  if (!res.ok) {
    let msg = `export failed (${res.status})`
    try { msg = (await res.json()).error ?? msg } catch { /* keep default */ }
    throw new Error(msg)
  }
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') ?? ''
  const fname = /filename="([^"]+)"/.exec(cd)?.[1] ?? 'export.csv'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fname
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const me = getCurrentMemberId()
  if (me) headers['X-Current-Member-Id'] = me
  return headers
}

const r = async (method: string, path: string, body?: object) => {
  const headers: Record<string, string> = authHeaders()
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(urlFor(path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return res.json()
}
const get = (p: string) => r('GET', p)
const post = (p: string, b: object) => r('POST', p, b)
const patch = (p: string, b: object) => r('PATCH', p, b)
const del = (p: string) => r('DELETE', p)

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'

type Dict = Record<string, unknown>

export const api = {
  // current signed-in user (auto-provisions a workspace member on first sign-in)
  getMe: () => get('/me'),   // legacy NextAuth-session lookup — unused after the JWT switch

  // ── JWT auth against tracker-api ──────────────────────────────────
  login: async (email: string, password: string) => {
    const res = await fetch(`${TRACKER_API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Sign-in failed')
    const { token, member } = await res.json()
    setToken(token)
    setCurrentMemberId(member.id)
    return member
  },
  // ── first-run setup wizard ────────────────────────────────────────
  getSetupStatus: async () => {
    const res = await fetch(`${TRACKER_API_BASE}/setup/status`)
    if (!res.ok) throw new Error('setup status unavailable')
    return res.json()
  },
  runSetup: async (data: { workspace_name?: string; name: string; email: string; password: string; load_demo?: boolean }) => {
    const res = await fetch(`${TRACKER_API_BASE}/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Setup failed')
    const { token, member } = await res.json()
    setToken(token)
    setCurrentMemberId(member.id)
    return member
  },

  authMe: async () => {
    // Identify the REAL signed-in account: never send the act-as header here,
    // or a persisted impersonation masquerades as the login and sticks across
    // reloads with no way back.
    const headers: Record<string, string> = {}
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${TRACKER_API_BASE}/auth/me`, { headers })
    if (!res.ok) throw new Error('not signed in')
    return res.json()
  },
  logout: () => { setToken(null); setCurrentMemberId(null) },

  // company — the entity above the workspace; master feature switches.
  getCompany: () => get('/company'),
  updateCompany: (data: Dict) => patch('/company', data),
  setCompanyFeatures: (features: Record<string, boolean>) => r('PUT', '/company/features', { features }),

  // workspace
  getWorkspace: () => get('/workspace'),
  createWorkspace: (data: { name: string; slug?: string }) =>
    post('/workspace', { name: data.name, slug: data.slug ?? slugify(data.name) }),

  // members
  getMembers: () => get('/workspace/members'),
  // Assignable members for a board (attached members when restricted, everyone when open).
  getProjectAssignees: (pid: string) => get(`/projects/${pid}/members`),
  getProjectAccess: (pid: string) => get(`/projects/${pid}/access`),
  setProjectAccess: (pid: string, memberIds: string[]) => r('PUT', `/projects/${pid}/access`, { member_ids: memberIds }),
  createMember: (data: Dict) => post('/workspace/members', data),
  updateMember: (mid: string, data: Dict) => patch(`/workspace/members/${mid}`, data),
  deleteMember: (mid: string) => del(`/workspace/members/${mid}`),
  getRolePermissions: () => get('/admin/role-permissions'),
  setRoleMenus: (role: string, menuIds: string[]) => r('PUT', '/admin/role-permissions', { role, menu_ids: menuIds }),
  resetDemoData: () => post('/admin/demo-reset', {}),

  // attendance / clock-in
  getMySession: () => get('/attendance/me'),
  clockIn: () => post('/attendance/clock-in', {}),
  getClockReport: (from?: string, to?: string) =>
    get(`/attendance/clock-report${from && to ? `?from=${from}&to=${to}` : ''}`),
  clockOut: () => post('/attendance/clock-out', {}),
  toggleBreak: () => post('/attendance/break', {}),
  getAttendance: (date?: string) => get(`/attendance${date ? `?date=${date}` : ''}`),
  getLiveStatus: () => get('/attendance?live=1'),

  // projects
  getProjects: () => get('/projects'),
  getProjectById: (pid: string) => get(`/projects/${pid}`),
  createProject: (data: Dict) => post('/projects', data),
  updateProject: (pid: string, data: Dict) => patch(`/projects/${pid}`, data),
  deleteProject: (pid: string) => del(`/projects/${pid}`),
  getDashboard: (pid: string) => get(`/projects/${pid}/dashboard`),
  getWorkspaceOverview: () => get('/dashboard/overview'),
  getAgentFeed: () => get('/dashboard/agent-feed'),
  getSprints: () => get('/dashboard/sprints'),
  getWorkspaceEpics: () => get('/dashboard/epics'),

  // issues
  getIssues: (pid: string, filters?: Record<string, string>) =>
    get(`/projects/${pid}/issues${filters ? '?' + new URLSearchParams(filters) : ''}`),
  getIssue: (pid: string, iid: string) => get(`/projects/${pid}/issues/${iid}`),
  createIssue: (pid: string, data: Dict) => post(`/projects/${pid}/issues`, data),
  updateIssue: (pid: string, iid: string, data: Dict) => patch(`/projects/${pid}/issues/${iid}`, data),
  deleteIssue: (pid: string, iid: string) => del(`/projects/${pid}/issues/${iid}`),
  getActivity: (pid: string, iid: string) => get(`/projects/${pid}/issues/${iid}/activity`),

  // milestone / epic assignment from the issue side (single-select)
  setIssueMilestone: (pid: string, iid: string, milestoneId: string | null) =>
    milestoneId ? r('PUT', `/projects/${pid}/issues/${iid}/milestone`, { milestone_id: milestoneId })
                : del(`/projects/${pid}/issues/${iid}/milestone`),
  setIssueEpic: (pid: string, iid: string, epicId: string | null) =>
    epicId ? r('PUT', `/projects/${pid}/issues/${iid}/epic`, { epic_id: epicId })
           : del(`/projects/${pid}/issues/${iid}/epic`),

  // attachments
  getAttachments: (pid: string, iid: string) => get(`/projects/${pid}/issues/${iid}/attachments`),
  addAttachment: (pid: string, iid: string, url: string) => post(`/projects/${pid}/issues/${iid}/attachments`, { url }),
  uploadAttachments: async (pid: string, iid: string, files: File[]) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    // Deliberately no Content-Type header — the browser adds the correct
    // multipart/form-data boundary when it sees a FormData body.
    const res = await fetch(urlFor(`/projects/${pid}/issues/${iid}/attachments`), {
      method: 'POST',
      body: fd,
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Upload failed (${res.status})`)
    return res.json() as Promise<any[]>
  },
  deleteAttachment: (pid: string, iid: string, aid: string) => del(`/projects/${pid}/issues/${iid}/attachments/${aid}`),

  // wiki
  listWiki: (pid: string) => get(`/projects/${pid}/wiki`),
  getWikiPage: (pid: string, wid: string) => get(`/projects/${pid}/wiki/${wid}`),
  createWikiPage: (pid: string, data: Dict) => post(`/projects/${pid}/wiki`, data),
  updateWikiPage: (pid: string, wid: string, data: Dict) => patch(`/projects/${pid}/wiki/${wid}`, data),
  deleteWikiPage: (pid: string, wid: string) => del(`/projects/${pid}/wiki/${wid}`),
  addWikiPageMember: (pid: string, wid: string, memberId: string) => post(`/projects/${pid}/wiki/${wid}/members`, { member_id: memberId }),
  removeWikiPageMember: (pid: string, wid: string, mid: string) => del(`/projects/${pid}/wiki/${wid}/members/${mid}`),
  // Wiki ↔ issue links
  listWikiPageIssues:   (pid: string, wid: string) => get(`/projects/${pid}/wiki/${wid}/issues`),
  linkWikiPageIssue:    (pid: string, wid: string, iid: string) => post(`/projects/${pid}/wiki/${wid}/issues`, { issue_id: iid }),
  unlinkWikiPageIssue:  (pid: string, wid: string, iid: string) => del(`/projects/${pid}/wiki/${wid}/issues/${iid}`),
  listIssueWikiLinks:   (pid: string, iid: string) => get(`/projects/${pid}/issues/${iid}/wiki-links`),

  // issue comments
  listComments:   (pid: string, iid: string) => get(`/projects/${pid}/issues/${iid}/comments`),
  addComment:     (pid: string, iid: string, data: Dict) => post(`/projects/${pid}/issues/${iid}/comments`, data),
  updateComment:  (pid: string, iid: string, cid: string, data: Dict) => patch(`/projects/${pid}/issues/${iid}/comments/${cid}`, data),
  deleteComment:  (pid: string, iid: string, cid: string) => del(`/projects/${pid}/issues/${iid}/comments/${cid}`),

  // exams (online proctored assessments)
  listExams:        () => get(`/exams`),
  listMyExams:      () => get(`/exams?mine=1`),
  createExam:       (data: Dict) => post(`/exams`, data),
  updateExam:       (eid: string, data: Dict) => patch(`/exams/${eid}`, data),
  deleteExam:       (eid: string) => del(`/exams/${eid}`),
  getMyExam:        (eid: string) => get(`/exams/${eid}`),
  assignExam:       (eid: string, memberIds: string[]) => post(`/exams/${eid}/assign`, { member_ids: memberIds }),
  startExam:        (eid: string) => post(`/exams/${eid}/start`, {}),
  reportViolation:  (eid: string) => post(`/exams/${eid}/violation`, {}),
  submitExam:       (eid: string, answers: string, auto = false) => post(`/exams/${eid}/submit`, { answers, auto }),

  // announcements (owner broadcast ticker)
  listAnnouncements:      () => get(`/announcements`),
  listAllAnnouncements:   () => get(`/announcements?manage=1`),
  createAnnouncement:     (data: Dict) => post(`/announcements`, data),
  updateAnnouncement:     (id: string, data: Dict) => patch(`/announcements/${id}`, data),
  deleteAnnouncement:     (id: string) => del(`/announcements/${id}`),

  // states
  getStates: (pid: string) => get(`/projects/${pid}/states`),
  createState: (pid: string, data: Dict) => post(`/projects/${pid}/states`, data),
  updateState: (pid: string, sid: string, data: Dict) => patch(`/projects/${pid}/states/${sid}`, data),
  deleteState: (pid: string, sid: string) => del(`/projects/${pid}/states/${sid}`),
  reorderStates: (pid: string, order: string[]) => post(`/projects/${pid}/states/reorder`, { order }),

  // labels
  getLabels: (pid: string) => get(`/projects/${pid}/labels`),
  createLabel: (pid: string, data: Dict) => post(`/projects/${pid}/labels`, data),
  updateLabel: (pid: string, lid: string, data: Dict) => patch(`/projects/${pid}/labels/${lid}`, data),
  deleteLabel: (pid: string, lid: string) => del(`/projects/${pid}/labels/${lid}`),

  // cycles
  getCycles: (pid: string) => get(`/projects/${pid}/cycles`),
  createCycle: (pid: string, data: Dict) => post(`/projects/${pid}/cycles`, data),
  updateCycle: (pid: string, cid: string, data: Dict) => patch(`/projects/${pid}/cycles/${cid}`, data),
  deleteCycle: (pid: string, cid: string) => del(`/projects/${pid}/cycles/${cid}`),
  getCycleIssues: (pid: string, cid: string) => get(`/projects/${pid}/cycles/${cid}/issues`),
  addIssueToCycle: (pid: string, cid: string, issueId: string) =>
    post(`/projects/${pid}/cycles/${cid}/issues`, { issue_id: issueId }),
  removeIssueFromCycle: (pid: string, cid: string, issueId: string) =>
    del(`/projects/${pid}/cycles/${cid}/issues/${issueId}`),

  // chat
  getConversations: () => get('/chat'),
  getConversation: (cid: string) => get(`/chat/${cid}`),
  startDM: (memberId: string) => post('/chat', { type: 'dm', member_id: memberId }),
  createGroupChat: (name: string, memberIds: string[], opts?: { description?: string; icon?: string }) =>
    post('/chat', { type: 'group', name, member_ids: memberIds, description: opts?.description ?? '', icon: opts?.icon ?? '' }),
  getMessages: (cid: string, after?: string) => get(`/chat/${cid}/messages${after ? `?after=${encodeURIComponent(after)}` : ''}`),
  sendMessage: (cid: string, body: string) => post(`/chat/${cid}/messages`, { body }),
  // Multipart send (text + files). Browser sets the multipart boundary, so no Content-Type header.
  sendMessageWithFiles: async (cid: string, body: string, files: File[]) => {
    const fd = new FormData()
    fd.append('body', body)
    for (const f of files) fd.append('files', f)
    const res = await fetch(urlFor(`/chat/${cid}/messages`), { method: 'POST', headers: authHeaders(), body: fd })
    if (!res.ok) throw new Error((await res.text()) || `Upload failed: ${res.status}`)
    return res.json()
  },
  markChatRead: (cid: string) => post(`/chat/${cid}/read`, {}),
  getChatUnread: () => get('/chat/unread'),

  // modules
  getModules: (pid: string) => get(`/projects/${pid}/modules`),
  createModule: (pid: string, data: Dict) => post(`/projects/${pid}/modules`, data),
  updateModule: (pid: string, mid: string, data: Dict) => patch(`/projects/${pid}/modules/${mid}`, data),
  deleteModule: (pid: string, mid: string) => del(`/projects/${pid}/modules/${mid}`),
  getModuleIssues: (pid: string, mid: string) => get(`/projects/${pid}/modules/${mid}/issues`),
  addIssueToModule: (pid: string, mid: string, issueId: string) =>
    post(`/projects/${pid}/modules/${mid}/issues`, { issue_id: issueId }),
  removeIssueFromModule: (pid: string, mid: string, issueId: string) =>
    del(`/projects/${pid}/modules/${mid}/issues/${issueId}`),
}
