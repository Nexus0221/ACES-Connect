import { useEffect, useLayoutEffect, useRef } from 'react'
import { MessageItem } from './MessageItem'
import type { Message, Profile } from '../lib/types'

type Props = {
  roomKey: string
  messages: Message[]
  profiles: Record<string, Profile>
  meId: string
  isAdmin: boolean
  loading: boolean
  hasMore: boolean
  onLoadOlder: () => Promise<void>
  onDelete: (id: string) => void
}

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString()

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

export function ChatView({
  roomKey,
  messages,
  profiles,
  meId,
  isAdmin,
  loading,
  hasMore,
  onLoadOlder,
  onDelete,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  useEffect(() => {
    stick.current = true
  }, [roomKey])

  useLayoutEffect(() => {
    const last = messages[messages.length - 1]
    if (last && last.user_id === meId && Date.now() - new Date(last.created_at).getTime() < 15000) {
      stick.current = true
    }
    const el = listRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [messages, roomKey, meId])

  // Images and videos finish loading after render and change the height; keep pinned to the bottom.
  useEffect(() => {
    const inner = innerRef.current
    if (!inner) return
    const ro = new ResizeObserver(() => {
      const el = listRef.current
      if (el && stick.current) el.scrollTop = el.scrollHeight
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [])

  function onScroll() {
    const el = listRef.current
    if (!el) return
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140
  }

  async function loadOlder() {
    const el = listRef.current
    const prev = el?.scrollHeight ?? 0
    await onLoadOlder()
    requestAnimationFrame(() => {
      if (el) el.scrollTop += el.scrollHeight - prev
    })
  }

  return (
    <div className="chat" ref={listRef} onScroll={onScroll}>
      <div ref={innerRef}>
        {hasMore && (
          <button className="btn link load-older" onClick={loadOlder}>
            Load earlier messages
          </button>
        )}

        {!loading && messages.length === 0 && (
          <div className="empty">
            <h3>No messages yet</h3>
            <p>Say hi to the class, or drop a photo, video or file here.</p>
          </div>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const newDay = !prev || !sameDay(prev.created_at, m.created_at)
          const compact =
            !!prev &&
            !newDay &&
            prev.user_id === m.user_id &&
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000
          return (
            <div key={m.id}>
              {newDay && <div className="day-sep">{dayLabel(m.created_at)}</div>}
              <MessageItem
                message={m}
                author={profiles[m.user_id]}
                compact={compact}
                canDelete={m.user_id === meId || isAdmin}
                onDelete={onDelete}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
