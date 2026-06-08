import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Colors, FontFamily, Spacing } from '../src/constants/tokens'

export default function LoginScreen() {
  const notWired = () => Alert.alert('Coming soon', 'Sign-in is wired up in the next step.')

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.wordmark}>Shelf</Text>
        <Text style={styles.tagline}>Your saved internet</Text>
        <View style={styles.artCircle}>
          <Ionicons name="albums" size={72} color={Colors.primary} />
        </View>
      </View>

      <View style={styles.footer}>
        <AuthButton icon="logo-google" label="Continue with Google" onPress={notWired} variant="light" />
        <AuthButton icon="logo-apple" label="Continue with Apple" onPress={notWired} variant="dark" />
        <Text style={styles.legal}>By continuing, you agree to our Terms & Privacy Policy.</Text>
      </View>
    </SafeAreaView>
  )
}

type AuthButtonProps = {
  icon: 'logo-google' | 'logo-apple'
  label: string
  onPress: () => void
  variant: 'light' | 'dark'
}

function AuthButton({ icon, label, onPress, variant }: AuthButtonProps) {
  const isDark = variant === 'dark'
  return (
    <Pressable style={[styles.authBtn, isDark && styles.authBtnDark]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={isDark ? Colors.surface : Colors.primary} />
      <Text style={[styles.authBtnLabel, isDark && styles.authBtnLabelDark]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 32,
  },
  wordmark: {
    fontFamily: FontFamily.serif,
    fontSize: 56,
    color: Colors.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: FontFamily.sans,
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 32,
  },
  artCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.screenH,
    paddingBottom: 24,
    gap: 12,
  },
  authBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary + '30',
    gap: 10,
  },
  authBtnDark: {
    backgroundColor: Colors.primary,
    borderWidth: 0,
  },
  authBtnLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 16,
    color: Colors.primary,
  },
  authBtnLabelDark: {
    color: Colors.surface,
  },
  legal: {
    fontFamily: FontFamily.sans,
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
})
