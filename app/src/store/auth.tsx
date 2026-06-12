import { createContext, useContext, useEffect, useState } from 'react'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

WebBrowser.maybeCompleteAuthSession()

type AuthCtx = {
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithApple: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

async function exchangeFromUrl(url: string) {
  const code = new URL(url).searchParams.get('code')
  if (!code) throw new Error('No authorization code in redirect URL')
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) throw error
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  const openOAuth = async (provider: 'google' | 'apple') => {
    const redirectTo = Linking.createURL('auth-callback')
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    })
    if (error || !data.url) throw error ?? new Error('No auth URL returned')
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
    if (result.type !== 'success') throw new Error(`Auth session ${result.type}`)
    await exchangeFromUrl(result.url)
  }

  return (
    <Ctx.Provider
      value={{
        session,
        loading,
        signInWithGoogle: () => openOAuth('google'),
        signInWithApple: () => openOAuth('apple'),
        signOut: async () => {
          await supabase.auth.signOut()
        },
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
