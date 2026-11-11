// Shared bits for the Procurement board (task intake, apart from the projects).
import type { ProcurementStatus } from '@/lib/types'

// Roles that process requests (review, send to a board, decline).
export const PROCESSOR_ROLES = ['owner', 'admin', 'manager']

export const OPEN_STATUSES: ProcurementStatus[] = ['new', 'review', 'accepted']

export const COLUMNS: { id: ProcurementStatus; label: string; hint: string; dot: string }[] = [
  { id: 'new',      label: 'New',           hint: 'Just raised — waiting for a look',  dot: '#6366F1' },
  { id: 'review',   label: 'In review',     hint: 'Being clarified or sized',          dot: '#F59E0B' },
  { id: 'accepted', label: 'Accepted',      hint: 'Agreed — ready to send to a board', dot: '#10B981' },
  { id: 'routed',   label: 'Sent to board', hint: 'Now a card on a project board',     dot: '#0EA5E9' },
  { id: 'declined', label: 'Declined',      hint: 'Not going ahead (reason given)',    dot: '#9CA3AF' },
]

// Fired after any change so the sidebar's pending-count badge refreshes.
export function notifyProcurementChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('tracker:procurement-changed'))
}
