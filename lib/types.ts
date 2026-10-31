export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none'
export type StateGroup = 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled'
// `issue` = bug (surfaced as "Bug" in the UI; kept as `issue` in the DB enum
// so no destructive migration). `enhancement` is a new primary type owners can
// pick alongside Task and Bug when creating an issue.
export type IssueType = 'milestone' | 'task' | 'issue' | 'enhancement' | 'subtask'
export type Role = 'owner' | 'admin' | 'manager' | 'member' | 'viewer'

export interface Workspace { id: string; name: string; slug: string; logo: string; created_at: string }
// The entity above the workspace: profile + master feature switches
// (hierarchy: Company features → role menus → board access → card visibility).
export interface Company {
  id: string; workspace_id: string; name: string; created_at: string
  features: Record<string, boolean>
  catalog: { id: string; label: string }[]
}
export interface Member { id: string; workspace_id: string; name: string; email: string; avatar: string; role: Role }
export interface Project { id: string; workspace_id: string; name: string; identifier: string; description: string; emoji: string; created_at: string }
export interface State { id: string; project_id: string; name: string; color: string; group_type: StateGroup; position: number; is_default: number }
export interface Label { id: string; project_id: string; name: string; color: string }
export interface Issue {
  id: string; project_id: string; sequence_id: number
  // Per-(project, type) counter that drives the friendly card code (TS001,
  // STS001, BG001). Nullable during the migration window; formatIssueCode()
  // falls back to sequence_id when this hasn't been backfilled yet.
  type_seq?: number | null
  title: string; description: string
  type: IssueType
  state_id: string | null; state?: State
  priority: Priority
  assignee_id: string | null; assignee?: Member       // legacy "primary" assignee (== assignees[0])
  assignees: Member[]
  parent_id: string | null
  start_date: string | null
  due_date: string | null; completed_at: string | null
  estimate: number | null
  labels: Label[]
  sub_issues?: Issue[]
  created_by: string | null; creator?: Member
  milestone?: { id: string; name: string } | null
  epic?: { id: string; name: string } | null
  created_at: string; updated_at: string
}
export interface Attachment {
  id: string
  issue_id: string
  // URL attachments: the actual link the user pasted. File uploads: the internal
  // serve endpoint (`/api/projects/.../attachments/<id>/file`).
  url: string
  title: string
  description: string
  image_url: string
  site_name: string
  favicon_url: string
  // File-upload fields — empty string / 0 for URL-only rows.
  filename: string
  mime: string
  size: number
  // Kind derived server-side so the client doesn't have to sniff the URL.
  kind: 'link' | 'file'
  added_by: string | null
  adder?: Member
  created_at: string
}

export interface WikiPage {
  id: string
  project_id: string
  title: string
  content: string
  created_by: string | null; creator?: Member
  updated_by: string | null; editor?: Member
  created_at: string
  updated_at: string
  members: Member[]
}

export interface ActivityEntry {
  id: string
  issue_id: string
  actor_id: string | null
  actor?: Member
  action: 'created' | 'updated' | 'label_added' | 'label_removed' | 'assignee_added' | 'assignee_removed'
  field: string | null
  old_value: string | null
  new_value: string | null
  created_at: string
}
export interface ChatAttachment {
  id: string
  message_id: string
  filename: string
  mime: string
  size: number
  url: string
}
export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string | null
  sender?: Member
  body: string
  created_at: string
  attachments?: ChatAttachment[]
}
export interface Conversation {
  id: string
  type: 'dm' | 'group'
  name: string
  description: string
  icon: string
  created_by: string | null
  created_at: string
  updated_at: string
  members: Member[]
  last_message?: ChatMessage | null
  unread_count: number
}

export interface Cycle { id: string; project_id: string; name: string; description: string; start_date: string | null; end_date: string | null; status: string; issues?: Issue[]; progress?: number; issue_count?: number }
export interface Module { id: string; project_id: string; name: string; description: string; status: string; lead_id: string | null; lead?: Member; start_date: string | null; target_date: string | null; cycle_id?: string | null; milestone?: { id: string; name: string } | null; issues?: Issue[]; progress?: number; issue_count?: number }
