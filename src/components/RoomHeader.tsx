import { Menu, Mic, MicOff, PhoneOff, Video, VideoOff, Headphones } from 'lucide-react'
import type { Room } from '../lib/types'
import type { VoiceApi } from '../hooks/useVoiceRoom'

type Props = {
  room: Room
  subtitle: string
  voice: VoiceApi
  onMenu: () => void
}

export function RoomHeader({ room, subtitle, voice, onMenu }: Props) {
  const here = voice.activeRoomId === room.id
  const connecting = here && voice.status === 'connecting'
  const connected = here && voice.status === 'connected'
  const elsewhere = voice.status === 'connected' && !here

  return (
    <header className="room-head">
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Open rooms">
        <Menu size={22} />
      </button>

      <div className="room-title">
        <h1># {room.name}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="voice-actions">
        {connected ? (
          <>
            <button
              className={`icon-btn ${voice.micOn ? '' : 'off'}`}
              onClick={voice.toggleMic}
              aria-label={voice.micOn ? 'Mute microphone' : 'Unmute microphone'}
            >
              {voice.micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button
              className={`icon-btn ${voice.camOn ? 'on' : ''}`}
              onClick={voice.toggleCam}
              aria-label={voice.camOn ? 'Turn camera off' : 'Turn camera on'}
            >
              {voice.camOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
            <button className="btn danger" onClick={voice.leave}>
              <PhoneOff size={18} />
              <span>Leave</span>
            </button>
          </>
        ) : (
          <>
            <button
              className="icon-btn"
              onClick={() => voice.join(room.id, { video: true })}
              disabled={connecting}
              aria-label="Join voice with camera"
              title="Join with camera"
            >
              <Video size={20} />
            </button>
            <button
              className="btn primary"
              onClick={() => voice.join(room.id)}
              disabled={connecting}
            >
              <Headphones size={18} />
              <span>{connecting ? 'Connecting…' : elsewhere ? 'Move voice here' : 'Join voice'}</span>
            </button>
          </>
        )}
      </div>

      {voice.error && (
        <p className="voice-error" role="alert" onClick={voice.clearError}>
          {voice.error}
        </p>
      )}
    </header>
  )
}
