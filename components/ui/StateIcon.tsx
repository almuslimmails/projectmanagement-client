import type { State } from '@/lib/types'

export function StateIcon({ state, size = 14 }: { state?: State | null; size?: number }) {
  const color = state?.color ?? '#9CA3AF'
  const group = state?.group_type ?? 'backlog'
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      {group === 'backlog' && <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" fill="none"/>}
      {group === 'unstarted' && <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/>}
      {group === 'started' && <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><path d="M8 8 L8 3 A5 5 0 0 1 12 11 Z" fill={color}/></>}
      {group === 'completed' && <circle cx="8" cy="8" r="6" fill={color}/>}
      {group === 'cancelled' && <><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none"/><line x1="5" y1="5" x2="11" y2="11" stroke={color} strokeWidth="1.5"/><line x1="11" y1="5" x2="5" y2="11" stroke={color} strokeWidth="1.5"/></>}
    </svg>
  )
}
