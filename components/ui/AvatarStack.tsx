'use client'
import type { Member } from '@/lib/types'
import { Avatar } from './Avatar'

interface Props {
  members: Pick<Member, 'id' | 'name'>[]
  max?: number
  size?: number
}

export default function AvatarStack({ members, max = 3, size = 5 }: Props) {
  if (!members?.length) return null
  const shown = members.slice(0, max)
  const overflow = members.length - shown.length

  return (
    <span className="flex items-center" title={members.map(m => m.name).join(', ')}>
      {shown.map((m, idx) => (
        <span key={m.id ?? idx}
          className="ring-2 ring-white rounded-full inline-block"
          style={{ marginLeft: idx === 0 ? 0 : -6 }}>
          <Avatar name={m.name} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="ring-2 ring-white rounded-full bg-gray-200 text-gray-600 text-[9px] font-bold flex items-center justify-center"
          style={{ marginLeft: -6, width: size * 4, height: size * 4 }}>
          +{overflow}
        </span>
      )}
    </span>
  )
}
