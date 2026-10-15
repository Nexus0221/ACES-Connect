import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

/** Every member profile, kept fresh in realtime. Class-sized groups make this cheap. */
export function useProfiles() {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*')
    if (data) {
      setProfiles(Object.fromEntries((data as Profile[]).map((p) => [p.id, p])))
    }
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('profiles-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  return { profiles, reload: load }
}

/** Set of user ids that currently have the app open. */
export function usePresence(userId: string | undefined) {
  const [online, setOnline] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel('online-members', {
      config: { presence: { key: userId } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        setOnline(new Set(Object.keys(channel.presenceState())))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ at: Date.now() })
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return online
}
