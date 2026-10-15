import { useCallback, useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, Track, VideoPresets, type Participant } from 'livekit-client'
import { supabase } from '../lib/supabase'

export type VoiceStatus = 'idle' | 'connecting' | 'connected'

export function useVoiceRoom() {
  const roomRef = useRef<Room | null>(null)
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [micOn, setMicOn] = useState(false)
  const [camOn, setCamOn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sync = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    setParticipants([room.localParticipant, ...Array.from(room.remoteParticipants.values())])
    setMicOn(room.localParticipant.isMicrophoneEnabled)
    setCamOn(room.localParticipant.isCameraEnabled)
  }, [])

  const cleanupAudio = () => {
    document.querySelectorAll('audio[data-lk]').forEach((el) => el.remove())
  }

  const leave = useCallback(async () => {
    const room = roomRef.current
    roomRef.current = null
    if (room) await room.disconnect()
    cleanupAudio()
    setParticipants([])
    setMicOn(false)
    setCamOn(false)
    setStatus('idle')
    setActiveRoomId(null)
  }, [])

  const join = useCallback(
    async (roomId: string, opts: { video?: boolean } = {}) => {
      await leave()
      setStatus('connecting')
      setActiveRoomId(roomId)
      setError(null)

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const res = await fetch('/api/livekit-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ roomId }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `Could not get a voice token (${res.status})`)
        }
        const { token, url } = (await res.json()) as { token: string; url: string }

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
          publishDefaults: { simulcast: true },
        })
        roomRef.current = room

        room
          .on(RoomEvent.ParticipantConnected, sync)
          .on(RoomEvent.ParticipantDisconnected, sync)
          .on(RoomEvent.TrackMuted, sync)
          .on(RoomEvent.TrackUnmuted, sync)
          .on(RoomEvent.LocalTrackPublished, sync)
          .on(RoomEvent.LocalTrackUnpublished, sync)
          .on(RoomEvent.ActiveSpeakersChanged, sync)
          .on(RoomEvent.TrackSubscribed, (track) => {
            if (track.kind === Track.Kind.Audio) {
              const el = track.attach()
              el.dataset.lk = '1'
              document.body.appendChild(el)
            }
            sync()
          })
          .on(RoomEvent.TrackUnsubscribed, (track) => {
            track.detach().forEach((el) => el.remove())
            sync()
          })
          .on(RoomEvent.Disconnected, () => {
            if (roomRef.current === room) {
              roomRef.current = null
              cleanupAudio()
              setParticipants([])
              setMicOn(false)
              setCamOn(false)
              setStatus('idle')
              setActiveRoomId(null)
            }
          })

        await room.connect(url, token)
        await room.startAudio().catch(() => {})
        setStatus('connected')
        sync()

        try {
          await room.localParticipant.setMicrophoneEnabled(true)
        } catch {
          setError('Microphone is blocked. Allow it in your browser settings to talk.')
        }
        if (opts.video) {
          try {
            await room.localParticipant.setCameraEnabled(true)
          } catch {
            setError('Camera is blocked. Allow it in your browser settings to share video.')
          }
        }
        sync()
      } catch (e) {
        roomRef.current?.disconnect()
        roomRef.current = null
        setStatus('idle')
        setActiveRoomId(null)
        setError(e instanceof Error ? e.message : 'Could not join voice')
      }
    },
    [leave, sync],
  )

  const toggleMic = useCallback(async () => {
    const lp = roomRef.current?.localParticipant
    if (!lp) return
    try {
      await lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled)
      setError(null)
    } catch {
      setError('Microphone is blocked. Allow it in your browser settings.')
    }
    sync()
  }, [sync])

  const toggleCam = useCallback(async () => {
    const lp = roomRef.current?.localParticipant
    if (!lp) return
    try {
      await lp.setCameraEnabled(!lp.isCameraEnabled)
      setError(null)
    } catch {
      setError('Camera is blocked. Allow it in your browser settings.')
    }
    sync()
  }, [sync])

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect()
      roomRef.current = null
      cleanupAudio()
    }
  }, [])

  return {
    status,
    activeRoomId,
    participants,
    micOn,
    camOn,
    error,
    join,
    leave,
    toggleMic,
    toggleCam,
    clearError: () => setError(null),
  }
}

export type VoiceApi = ReturnType<typeof useVoiceRoom>
