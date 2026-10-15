import type { VercelRequest, VercelResponse } from '@vercel/node'
import { AccessToken } from 'livekit-server-sdk'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/livekit-token   { roomId: string }
 * Header: Authorization: Bearer <supabase access token>
 *
 * Verifies the caller is a signed-in ACES member, confirms the room exists,
 * and returns a short-lived LiveKit token for that room.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const jwt = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!jwt) return res.status(401).json({ error: 'Sign in first' })

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  const lkUrl = process.env.LIVEKIT_URL
  const lkKey = process.env.LIVEKIT_API_KEY
  const lkSecret = process.env.LIVEKIT_API_SECRET

  if (!supabaseUrl || !supabaseKey || !lkUrl || !lkKey || !lkSecret) {
    return res.status(500).json({ error: 'Server is missing environment variables' })
  }

  // Act as the signed-in user so Row Level Security applies to every query below.
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !userData.user) {
    return res.status(401).json({ error: 'Session expired — sign in again' })
  }
  const user = userData.user

  const roomId = typeof req.body?.roomId === 'string' ? req.body.roomId : ''
  if (!roomId) return res.status(400).json({ error: 'roomId is required' })

  const { data: room } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('id', roomId)
    .maybeSingle()
  if (!room) return res.status(404).json({ error: 'Room not found' })

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  const at = new AccessToken(lkKey, lkSecret, {
    identity: user.id,
    name: profile?.display_name ?? user.email ?? 'Member',
    metadata: JSON.stringify({ avatar_url: profile?.avatar_url ?? null }),
    ttl: '2h',
  })
  at.addGrant({
    room: `room-${room.id}`,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })

  return res.status(200).json({ token: await at.toJwt(), url: lkUrl })
}
