import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { usePresence, useProfiles } from './hooks/useDirectory'
import { useMessages } from './hooks/useMessages'
import { useVoiceRoom } from './hooks/useVoiceRoom'
import { supabase, supabaseConfigured } from './lib/supabase'
import { MAX_UPLOAD_MB, formatBytes, uploadAttachment } from './lib/files'
import type { Profile, Room } from './lib/types'
import { AuthScreen } from './components/AuthScreen'
import { Sidebar } from './components/Sidebar'
import { MemberStrip, type StripMember } from './components/MemberStrip'
import { RoomHeader } from './components/RoomHeader'
import { VoiceStage } from './components/VoiceStage'
import { ChatView } from './components/ChatView'
import { Composer } from './components/Composer'
import { ProfileModal, type InstallInfo } from './components/ProfileModal'

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> }

function useInstall(): InstallInfo {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setEvt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return {
    canPrompt: Boolean(evt),
    standalone,
    isIOS,
    prompt: async () => {
      if (!evt) return
      await evt.prompt()
      setEvt(null)
    },
  }
}

function Splash({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="splash">
      <img className="splash-logo" src="/logo.png" alt="" />
      <span className="spinner big" />
      <p>{text}</p>
    </div>
  )
}

function ConfigMissing() {
  return (
    <div className="splash">
      <h2>Almost there</h2>
      <p>
        Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your
        environment, then restart the app.
      </p>
    </div>
  )
}

function Shell({ me }: { me: Profile }) {
  const { session, signOut, refreshProfile } = useAuth()
  const { profiles } = useProfiles()
  const online = usePresence(me.id)
  const voice = useVoiceRoom()
  const install = useInstall()

  const [rooms, setRooms] = useState<Room[]>([])
  const [roomId, setRoomId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('aces:room')
    } catch {
      return null
    }
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number>()

  const notify = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 4500)
  }, [])

  // Rooms (live)
  const loadRooms = useCallback(async () => {
    const { data } = await supabase.from('rooms').select('*').order('created_at', { ascending: true })
    if (data) setRooms(data as Room[])
  }, [])

  useEffect(() => {
    loadRooms()
    const channel = supabase
      .channel('rooms-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => loadRooms())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadRooms])

  useEffect(() => {
    if (rooms.length > 0 && !rooms.some((r) => r.id === roomId)) setRoomId(rooms[0].id)
  }, [rooms, roomId])

  useEffect(() => {
    if (!roomId) return
    try {
      localStorage.setItem('aces:room', roomId)
    } catch {
      /* storage unavailable — fine */
    }
  }, [roomId])

  const room = rooms.find((r) => r.id === roomId) ?? null
  const { messages, loading, hasMore, loadOlder, send, remove } = useMessages(room?.id ?? null)

  // Members strip: voice participants while in a call, otherwise the whole roster.
  const members = useMemo<StripMember[]>(() => {
    if (voice.status === 'connected') {
      return voice.participants.map((p) => ({
        id: p.identity,
        name: p.name || profiles[p.identity]?.display_name || 'Member',
        avatar: profiles[p.identity]?.avatar_url ?? null,
        online: true,
        inVoice: true,
        speaking: p.isSpeaking,
        micOff: !p.isMicrophoneEnabled,
        you: p.isLocal,
      }))
    }
    return Object.values(profiles)
      .map((p) => ({
        id: p.id,
        name: p.display_name,
        avatar: p.avatar_url,
        online: online.has(p.id),
        inVoice: false,
        speaking: false,
        micOff: false,
        you: p.id === me.id,
      }))
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name))
  }, [voice.status, voice.participants, profiles, online, me.id])

  const onlineCount = members.filter((m) => m.online).length
  const subtitle =
    voice.status === 'connected' && voice.activeRoomId === room?.id
      ? `${voice.participants.length} in voice`
      : `${onlineCount} online`

  const addFiles = useCallback(
    (incoming: File[]) => {
      const limit = MAX_UPLOAD_MB * 1024 * 1024
      const ok: File[] = []
      for (const f of incoming) {
        if (f.size > limit) {
          notify(`${f.name} is ${formatBytes(f.size)}. The limit is ${MAX_UPLOAD_MB} MB per file.`)
        } else {
          ok.push(f)
        }
      }
      if (ok.length) setFiles((prev) => [...prev, ...ok])
    },
    [notify],
  )

  async function handleSend(text: string, toSend: File[]) {
    setSending(true)
    try {
      const attachments = await Promise.all(toSend.map((f) => uploadAttachment(f, me.id)))
      await send(text.trim(), attachments, me.id)
      setFiles([])
    } catch (e) {
      notify(e instanceof Error ? `Could not send: ${e.message}` : 'Could not send message')
      throw e
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await remove(id)
    } catch {
      notify('Could not delete that message.')
    }
  }

  async function createRoom(name: string) {
    const { error } = await supabase.from('rooms').insert({ name, created_by: me.id })
    if (error) notify(error.message.includes('duplicate') ? 'A room with that name exists.' : error.message)
    else loadRooms()
  }

  return (
    <div className="app">
      <Sidebar
        me={me}
        rooms={rooms}
        selectedId={roomId}
        voiceRoomId={voice.status === 'idle' ? null : voice.activeRoomId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={setRoomId}
        onOpenProfile={() => {
          setSidebarOpen(false)
          setProfileOpen(true)
        }}
        onCreateRoom={createRoom}
      />

      <main className="main">
        <MemberStrip members={members} />

        <section
          className="center"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault()
              setDragging(true)
            }
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDragging(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            addFiles(Array.from(e.dataTransfer.files))
          }}
        >
          {room ? (
            <>
              <RoomHeader
                room={room}
                subtitle={subtitle}
                voice={voice}
                onMenu={() => setSidebarOpen(true)}
              />
              {voice.status === 'connected' && (
                <VoiceStage participants={voice.participants} profiles={profiles} />
              )}
              <ChatView
                roomKey={room.id}
                messages={messages}
                profiles={profiles}
                meId={me.id}
                isAdmin={me.role === 'admin'}
                loading={loading}
                hasMore={hasMore}
                onLoadOlder={loadOlder}
                onDelete={handleDelete}
              />
            </>
          ) : (
            <div className="empty full">
              <h3>No rooms yet</h3>
              <p>An officer needs to create the first room.</p>
            </div>
          )}
          {dragging && <div className="drop-overlay">Drop to attach</div>}
        </section>

        {room && (
          <Composer
            roomName={room.name}
            files={files}
            sending={sending}
            onAddFiles={addFiles}
            onRemoveFile={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
            onSend={handleSend}
          />
        )}
      </main>

      {profileOpen && (
        <ProfileModal
          me={me}
          email={session?.user.email ?? ''}
          install={install}
          onClose={() => setProfileOpen(false)}
          onSaved={refreshProfile}
          onSignOut={async () => {
            await voice.leave()
            await signOut()
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

function Gate() {
  const { session, profile, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) return <AuthScreen />
  if (!profile) return <Splash text="Setting up your profile…" />
  return <Shell me={profile} />
}

export default function App() {
  if (!supabaseConfigured) return <ConfigMissing />
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
