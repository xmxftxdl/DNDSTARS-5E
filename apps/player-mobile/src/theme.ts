import AsyncStorage from '@react-native-async-storage/async-storage'
import { Appearance, DynamicColorIOS, Platform, type ColorValue } from 'react-native'

export type MobileThemePreference = 'dark' | 'light' | 'system'

const THEME_STORAGE_KEY = 'stars.mobile.theme'

function adaptive(light: string, dark: string): ColorValue {
  return Platform.OS === 'ios' ? DynamicColorIOS({ light, dark }) : dark
}

/** Semantic colors update natively when Appearance.setColorScheme changes. */
export const colors = {
  background: adaptive('#f6f7fb', '#070711'),
  surface: adaptive('#ffffff', '#11111d'),
  elevated: adaptive('#f0eef9', '#191628'),
  border: adaptive('#d8d4e3', '#302b46'),
  text: adaptive('#17131f', '#f6f3ff'),
  muted: adaptive('#686276', '#9c96b2'),
  primary: adaptive('#7042d4', '#8b5cf6'),
  primarySoft: adaptive('#e8e0fb', '#2e2353'),
  teal: adaptive('#087e74', '#2dd4bf'),
  warning: adaptive('#9a6700', '#fbbf24'),
  danger: adaptive('#be2645', '#fb7185'),
  success: adaptive('#087f5b', '#34d399'),
  fog: '#02030a',
} as const

export function applyMobileThemePreference(preference: MobileThemePreference): void {
  Appearance.setColorScheme(preference === 'system' ? null : preference)
}

export async function loadMobileThemePreference(): Promise<MobileThemePreference> {
  const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY)
  const preference: MobileThemePreference = stored === 'light' || stored === 'system' ? stored : 'dark'
  applyMobileThemePreference(preference)
  return preference
}

export async function saveMobileThemePreference(preference: MobileThemePreference): Promise<void> {
  applyMobileThemePreference(preference)
  await AsyncStorage.setItem(THEME_STORAGE_KEY, preference)
}
