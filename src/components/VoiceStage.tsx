import { useEffect, useRef } from 'react'
import { Track, type Participant, type VideoTrack } from 'livekit-client'
import { MicOff } from 'lucide-react'
import type { Profile } from '../lib/types'

function Tile({ p, name }: { p: Participant; name: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const pub = p.getTrackPublication(Track.Source.Camera)
  const track = pub?.track as VideoTrack | undefined

  useEffect(() => {
    const el = ref.current
    if (!el || !track) return
    track.attach(el)
    return () => {
      track.detach(el)
    }
  }, [track])

  return (
    <div className={`tile ${p.isSpeaking ? 'speaking' : ''}`}>
      <video ref={ref} autoPlay playsInline muted className={p.isLocal ? 'mirror' : ''} />
      <span className="tile-name">
        {!p.isMicrophoneEnabled && <MicOff size={13} />}
        {p.isLocal ? 'You' : name}
      </span>
    </div>
  )
}

type Props = { participants: Participant[]; profiles: Record<string, Profile> }

/** Shows camera tiles only for people who have their camera on. */
export function VoiceStage({ participants, profiles }: Props) {
  const withVideo = participants.filter((p) => p.isCameraEnabled)
  if (withVideo.length === 0) return null
  return (
    <section className="stage" aria-label="Video">
      {withVideo.map((p) => (
        <Tile
          key={p.identity}
          p={p}
          name={p.name || profiles[p.identity]?.display_name || 'Member'}
        />
      ))}
    </section>
  )
}
