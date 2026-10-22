import { useState } from 'react'
import { Hash, Plus, Volume2 } from 'lucide-react'
import { Avatar } from './Avatar'
import { canCreateRooms, type Profile, type Room } from '../lib/types'

type Props = {
  me: Profile
  rooms: Room[]
  selectedId: string | null
  voiceRoomId: string | null
  open: boolean
  onClose: () => void
  onSelect: (id: string) => void
  onOpenProfile: () => void
  onCreateRoom: (name: string) => Promise<void>
}

/** Left column from the wireframe: profile circle on top, rooms underneath. */
export function Sidebar({
  me,
  rooms,
  selectedId,
  voiceRoomId,
  open,
  onClose,
  onSelect,
  onOpenProfile,
  onCreateRoom,
}: Props) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await onCreateRoom(trimmed)
    setName('')
    setAdding(false)
  }

  return (
    <>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Rooms">
        <button className="me" onClick={onOpenProfile} aria-label="Open your profile">
          <Avatar name={me.display_name} src={me.avatar_url} size={64} />
          <span className="me-text">
            <strong>{me.display_name}</strong>
            <small>{me.position ?? (me.role === 'admin' ? 'Officer' : 'Member')}</small>
          </span>
        </button>

        <div className="rooms-head">
          <h2>Rooms</h2>
          {canCreateRooms(me) && (
            <button className="icon-btn on-ink" onClick={() => setAdding((v) => !v)} aria-label="New room">
              <Plus size={18} />
            </button>
          )}
        </div>

        {adding && (
          <form className="new-room" onSubmit={create}>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Room name"
              maxLength={40}
            />
            <button className="btn primary small">Add</button>
          </form>
        )}

        <nav className="rooms">
          {rooms.map((r) => (
            <button
              key={r.id}
              className={`room ${r.id === selectedId ? 'active' : ''}`}
              onClick={() => {
                onSelect(r.id)
                onClose()
              }}
            >
              <Hash size={16} />
              <span>{r.name}</span>
              {r.id === voiceRoomId && <Volume2 size={15} className="live-icon" aria-label="You are in voice here" />}
            </button>
          ))}
        </nav>
      </aside>
    </>
  )
}
