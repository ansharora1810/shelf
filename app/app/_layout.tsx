import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useFonts, PlayfairDisplay_400Regular } from '@expo-google-fonts/playfair-display'
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter'

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    Inter_400Regular,
    Inter_500Medium,
  })

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </GestureHandlerRootView>
  )
}
