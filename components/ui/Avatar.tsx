import { initials, avatarColor } from '@/lib/utils'

export function Avatar({ name, size = 6 }: { name: string; size?: number }) {
  const bg = avatarColor(name)
  const px = size * 4
  return (
    <span className={`rounded-full text-white font-semibold flex items-center justify-center shrink-0`}
      style={{ width: px, height: px, backgroundColor: bg, fontSize: px * 0.38 }}>
      {initials(name)}
    </span>
  )
}
