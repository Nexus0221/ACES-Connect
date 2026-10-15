import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Attachment, Message } from '../lib/types'

const PAGE = 50

export function useMessages(roomId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    setMessages([])
    setHasMore(false)
    if (!roomId) return
    let cancelled = false
    setLoading(true)

    supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(PAGE)
      .then(({ data }) => {
        if (cancelled) return
        const rows = ((data ?? []) as Message[]).reverse()
        setMessages(rows)
        setHasMore((data?.length ?? 0) === PAGE)
        setLoading(false)
      })

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const m = payload.new as Message
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
        },
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const id = (payload.old as { id?: string }).id
        if (id) setMessages((prev) => prev.filter((m) => m.id !== id))
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [roomId])

  const loadOlder = useCallback(async () => {
    if (!roomId || messages.length === 0) return
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .lt('created_at', messages[0].created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE)
    const rows = ((data ?? []) as Message[]).reverse()
    setMessages((prev) => [...rows, ...prev])
    setHasMore((data?.length ?? 0) === PAGE)
  }, [roomId, messages])

  const send = useCallback(
    async (content: string, attachments: Attachment[], userId: string) => {
      if (!roomId) return
      const { data, error } = await supabase
        .from('messages')
        .insert({ room_id: roomId, user_id: userId, content, attachments })
        .select()
        .single()
      if (error) throw error
      const m = data as Message
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
    },
    [roomId],
  )

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('messages').delete().eq('id', id)
    if (error) throw error
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }, [])

  return { messages, loading, hasMore, loadOlder, send, remove }
}
