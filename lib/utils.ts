import type { Priority, StateGroup, IssueType, Member, Role } from './types'

export const DATE_MANAGER_ROLES: Role[] = ['owner', 'admin', 'manager']
export function canManageDates(member?: Member | null): boolean {
  return !!member && DATE_MANAGER_ROLES.includes(member.role)
}

// Shared name validator for user-named entities (labels, milestones, epics, …).
// Rules: required, 1-50 chars, only letters/numbers/spaces/hyphens/underscores,
// and must contain at least one letter (rejects pure-numeric or pure-symbol names
// like "123" or "---"). Used by both the client (inline error) and the server (400).
export const NAME_MAX_LEN = 50
export function validateName(raw: string, kind = 'Name'): string | null {
  const name = (raw ?? '').trim()
  if (!name) return `${kind} is required.`
  if (name.length > NAME_MAX_LEN) return `${kind} must be ${NAME_MAX_LEN} characters or fewer.`
  if (!/^[\p{L}\p{N} _-]+$/u.test(name)) return `${kind} can only contain letters, numbers, spaces, hyphens, and underscores.`
  if (!/\p{L}/u.test(name)) return `${kind} must include at least one letter.`
  return null
}
// Back-compat aliases — each carries the right "kind" prefix in error messages.
export const LABEL_NAME_MAX_LEN = NAME_MAX_LEN
export const validateLabelName     = (raw: string) => validateName(raw, 'Label name')
export const validateMilestoneName = (raw: string) => validateName(raw, 'Milestone name')
export const validateEpicName      = (raw: string) => validateName(raw, 'Epic name')

// Validate that a start date isn't after an end date. Empty values are allowed (optional).
export function validateDateOrder(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null
  if (start > end) return 'Start date cannot be after the end date.'
  return null
}

export const ISSUE_TYPE_CONFIG: Record<IssueType, { label: string; icon: string; color: string }> = {
  milestone:   { label: 'Milestone',   icon: '🎯', color: '#8B5CF6' },
  task:        { label: 'Task',        icon: '📋', color: '#6366F1' },
  // `issue` in the DB enum surfaces as "Bug" everywhere in the UI — user-facing
  // vocabulary; the enum value stays `issue` so no destructive migration.
  issue:       { label: 'Bug',         icon: '🐛', color: '#EAB308' },
  enhancement: { label: 'Enhancement', icon: '✨', color: '#0EA5E9' },
  subtask:     { label: 'Subtask',     icon: '✓',  color: '#9CA3AF' },
}

// Per-type prefix for the friendly card code.
export const ISSUE_TYPE_PREFIX: Record<IssueType, string> = {
  task:        'TS',
  subtask:     'STS',
  issue:       'BG',
  enhancement: 'EN',
  milestone:   'MS',
}

// Primary types offered in the create-issue picker. Subtask is auto-set when
// a parent_id is passed; milestone is a specialised type not created inline
// from the general issue modal — both are hidden from the picker.
export const PRIMARY_ISSUE_TYPES: IssueType[] = ['task', 'issue', 'enhancement']

// Format the display code shown on every card, e.g. TS001 / STS042 / BG007.
// Falls back to a bare number when the row hasn't been type_seq-backfilled
// (nullable to keep the migration safe).
export function formatIssueCode(issue: { type?: IssueType | null; type_seq?: number | null; sequence_id?: number }): string {
  const type = (issue.type ?? 'issue') as IssueType
  const prefix = ISSUE_TYPE_PREFIX[type] ?? 'ISS'
  const n = issue.type_seq ?? issue.sequence_id ?? 0
  return `${prefix}${String(n).padStart(3, '0')}`
}

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; icon: string }> = {
  urgent: { label: 'Urgent', color: '#EF4444', icon: '🔴' },
  high:   { label: 'High',   color: '#F97316', icon: '🟠' },
  medium: { label: 'Medium', color: '#EAB308', icon: '🟡' },
  low:    { label: 'Low',    color: '#22C55E', icon: '🟢' },
  none:   { label: 'None',   color: '#9CA3AF', icon: '⚪' },
}

export const STATE_GROUP_CONFIG: Record<StateGroup, { label: string; color: string }> = {
  backlog:   { label: 'Backlog',     color: '#9CA3AF' },
  unstarted: { label: 'Unstarted',   color: '#6366F1' },
  started:   { label: 'In Progress', color: '#F59E0B' },
  completed: { label: 'Done',        color: '#10B981' },
  cancelled: { label: 'Cancelled',   color: '#EF4444' },
}

export function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

export function avatarColor(name: string) {
  const colors = ['#6366F1','#8B5CF6','#EC4899','#14B8A6','#F97316','#EAB308','#22C55E']
  return colors[name.charCodeAt(0) % colors.length]
}

export function fmtDate(d?: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Relative time ("just now", "5m ago", "2h ago", "3d ago") for activity feeds.
export function relTime(d?: string | null): string {
  if (!d) return ''
  // SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC by default — append Z so Date parses it as UTC.
  const ts = /\dT\d/.test(d) ? d : d.replace(' ', 'T') + 'Z'
  const t = new Date(ts).getTime()
  if (isNaN(t)) return d
  const sec = Math.floor((Date.now() - t) / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d2 = Math.floor(h / 24)
  if (d2 < 30) return `${d2}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Treat the deadline as end-of-day (local time) on the due_date — same way humans read "due May 1".
function overdueMs(d: string): number {
  const due = new Date(d)
  if (isNaN(due.getTime())) return 0
  due.setHours(23, 59, 59, 999)
  return Date.now() - due.getTime()
}

export function isOverdue(d?: string | null) {
  if (!d) return false
  return overdueMs(d) > 0
}

// Returns a short string like "3d 2h" / "5h" / "12m" describing how long past due.
// Returns null if the date is missing or not yet overdue.
export function overdueDuration(d?: string | null): string | null {
  if (!d) return null
  const ms = overdueMs(d)
  if (ms <= 0) return null
  const mins = Math.floor(ms / 60_000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days >= 1) {
    const remH = hours - days * 24
    return remH > 0 ? `${days}d ${remH}h` : `${days}d`
  }
  if (hours >= 1) {
    const remM = mins - hours * 60
    return remM > 0 ? `${hours}h ${remM}m` : `${hours}h`
  }
  return `${Math.max(mins, 1)}m`
}
