import { createMMKV } from 'react-native-mmkv'

// Auth storage backed by MMKV. With no `path` set and an `AppGroup` key in
// Info.plist (see `ios.infoPlist.AppGroup` in app.json), MMKV stores into the
// App Group container, so the Supabase session is shared between the main app
// and the share extension — the extension reuses the same client and refreshes
// the token on its own.
const mmkv = createMMKV({ id: 'shelf-auth' })

export const sharedAuthStorage = {
  getItem: (key: string): string | null => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string): void => mmkv.set(key, value),
  removeItem: (key: string): void => {
    mmkv.remove(key)
  },
}
