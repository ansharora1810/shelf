import AsyncStorage from 'expo-sqlite/kv-store'
import { createClient } from '@supabase/supabase-js'
import { CryptoDigestAlgorithm, digest } from 'expo-crypto'
import { AppState } from 'react-native'

if (globalThis.crypto && !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    configurable: true,
    value: {
      digest: (algorithm: AlgorithmIdentifier, data: BufferSource) => {
        const name = typeof algorithm === 'string' ? algorithm : algorithm.name
        if (name !== 'SHA-256') throw new Error(`Unsupported digest algorithm: ${name}`)
        return digest(CryptoDigestAlgorithm.SHA256, data)
      },
    },
  })
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  },
)

AppState.addEventListener('change', state => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})
