import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, MicOff } from 'lucide-react'
import { Avatar } from './Avatar'

export type StripMember = {
  id: string
  name: string
  avatar: string | null
  online: boolean
  inVoice: boolean
  speaking: boolean
  micOff: boolean
  you: boolean
}

/** The top bar from the wireframe: a horizontally scrolling row of member circles. */
export function MemberStrip({
  members,
  onMessage,
}: {
  members: StripMember[]
  onMessage?: (userId: string) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  const update = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setAtStart(el.scrollLeft < 4)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    update()
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [update, members.length])

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' })
  }

  return (
    <div className="strip">
      <button
        className="strip-arrow"
        onClick={() => scroll(-1)}
        disabled={atStart}
        aria-label="Scroll members left"
      >
        <ChevronLeft size={22} />
      </button>

      <div className="strip-track" ref={trackRef} onScroll={update}>
        {members.map((m) => (
          <button
            type="button"
            key={m.id}
            disabled={m.you || !onMessage}
            onClick={() => onMessage?.(m.id)}
            className={[
              'member',
              m.online ? 'online' : 'offline',
              m.speaking ? 'speaking' : '',
              !m.you && onMessage ? 'clickable' : '',
            ].join(' ')}
            title={m.you ? m.name : `Message ${m.name}`}
          >
            <div className="ring">
              <Avatar name={m.name} src={m.avatar} size={52} />
              {m.inVoice && m.micOff && (
                <span className="badge mic-off" aria-label="Muted">
                  <MicOff size={11} />
                </span>
              )}
              {!m.inVoice && m.online && <span className="badge dot" aria-label="Online" />}
            </div>
            <span className="member-name">{m.you ? 'You' : m.name.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      <button
        className="strip-arrow"
        onClick={() => scroll(1)}
        disabled={atEnd}
        aria-label="Scroll members right"
      >
        <ChevronRight size={22} />
      </button>
    </div>
  )
}
