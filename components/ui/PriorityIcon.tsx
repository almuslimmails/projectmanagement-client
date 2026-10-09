import { PRIORITY_CONFIG } from '@/lib/utils'
import type { Priority } from '@/lib/types'

export function PriorityIcon({ priority, size = 14 }: { priority: Priority; size?: number }) {
  const cfg = PRIORITY_CONFIG[priority]
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      {priority === 'urgent' && <><rect x="2" y="2" width="3" height="12" rx="1" fill={cfg.color}/><rect x="7" y="2" width="3" height="12" rx="1" fill={cfg.color}/><rect x="12" y="2" width="3" height="12" rx="1" fill={cfg.color}/></>}
      {priority === 'high' && <><rect x="2" y="6" width="3" height="8" rx="1" fill={cfg.color}/><rect x="7" y="4" width="3" height="10" rx="1" fill={cfg.color}/><rect x="12" y="2" width="3" height="12" rx="1" fill={cfg.color}/></>}
      {priority === 'medium' && <><rect x="2" y="8" width="3" height="6" rx="1" fill={cfg.color}/><rect x="7" y="5" width="3" height="9" rx="1" fill={cfg.color}/><rect x="12" y="2" width="3" height="12" rx="1" fill={cfg.color}/></>}
      {priority === 'low' && <><rect x="2" y="10" width="3" height="4" rx="1" fill={cfg.color}/><rect x="7" y="7" width="3" height="7" rx="1" fill={cfg.color}/><rect x="12" y="2" width="3" height="12" rx="1" fill={cfg.color}/></>}
      {priority === 'none' && <circle cx="8" cy="8" r="5" stroke={cfg.color} strokeWidth="2" fill="none"/>}
    </svg>
  )
}
