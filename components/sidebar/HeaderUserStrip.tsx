'use client'
import { Avatar } from '@/components/ui/Avatar'
import type { Member } from '@/lib/types'

interface Props {
  currentMember: Member | null
  onSignOut: () => void
}

// Always-visible top-header strip: user chip + sign out, reachable even when
// the sidebar is collapsed. Clock in/out lives only in the sidebar's
// ClockWidget now — the header stays clean.
export default function HeaderUserStrip({ currentMember, onSignOut }: Props) {
  if (!currentMember) return null

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* User chip */}
      <div className="hidden sm:flex items-center gap-1.5">
        <Avatar name={currentMember.name} size={6} />
        <div className="min-w-0 leading-tight">
          <p className="text-[11px] font-semibold text-gray-800 truncate max-w-[120px]">{currentMember.name}</p>
          <p className="text-[9px] uppercase tracking-widest text-gray-400 capitalize">{currentMember.role}</p>
        </div>
      </div>

      {/* Sign out — icon-only on narrow, keeps working when the sidebar is collapsed. */}
      <button onClick={onSignOut}
        title="Sign out"
        aria-label="Sign out"
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-md transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        <span className="hidden md:inline">Sign out</span>
      </button>
    </div>
  )
}
