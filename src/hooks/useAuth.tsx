import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

type SignUpInput = {
  email: string
  password: string
  displayName: string
  inviteCode: string
}

type AuthState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  /** Resolves true when the member must confirm their email before signing in. */
  signUp: (input: SignUpInput) => Promise<boolean>
  sendMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile((data as Profile | null) ?? null)
  }, [userId])

  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading,
      refreshProfile,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      async signUp({ email, password, displayName, inviteCode }) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName.trim(), invite_code: inviteCode.trim() },
            emailRedirectTo: window.location.origin,
          },
        })
        if (error) throw error
        return !data.session
      },
      async sendMagicLink(email) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
        })
        if (error) throw error
      },
      async signOut() {
        await supabase.auth.signOut()
        setProfile(null)
      },
    }),
    [session, profile, loading, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
