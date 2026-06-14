import { useEffect } from 'react'
import { Stack, usePathname, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { useFonts, PlayfairDisplay_400Regular } from '@expo-google-fonts/playfair-display'
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter'
import { AuthProvider, useAuth } from '../src/store/auth'
import { ShelfProvider } from '../src/store/shelf'

function RootNavigator() {
  const { session, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    const onLogin = pathname === '/login'
    if (!session && !onLogin) router.replace('/login')
    else if (session && onLogin) router.replace('/')
  }, [session, loading, pathname, router])

  if (loading) return null
  return (
    <ShelfProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </ShelfProvider>
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    Inter_400Regular,
    Inter_500Medium,
  })

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <BottomSheetModalProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </BottomSheetModalProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  )
}
