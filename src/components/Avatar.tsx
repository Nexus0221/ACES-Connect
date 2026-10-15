const COLORS = ['#2D5BFF', '#7A3CFF', '#D6336C', '#E8590C', '#0C8599', '#5C7CFA', '#2B8A3E', '#C2255C']

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

type Props = { name: string; src?: string | null; size?: number }

export function Avatar({ name, src, size = 40 }: Props) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) }
  if (src) {
    return <img className="avatar" style={style} src={src} alt={name} loading="lazy" />
  }
  return (
    <span
      className="avatar avatar-fallback"
      style={{ ...style, background: COLORS[hash(name) % COLORS.length] }}
      aria-label={name}
    >
      {initials(name)}
    </span>
  )
}
