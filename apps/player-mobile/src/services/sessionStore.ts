import AsyncStorage from '@react-native-async-storage/async-storage'
import { requireOptionalNativeModule } from 'expo-modules-core'
import type { MobileAccountSession, MobileRoomSession } from '../../../../packages/mobile-protocol/src'

const ACCOUNT_KEY = 'stars.mobile.account:v1'
const ROOM_KEY = 'stars.mobile.room:v1'
const SERVER_KEY = 'stars.mobile.gameServer:v1'
const CLIENT_KEY = 'stars.mobile.clientId:v1'
const ACTIVE_CHARACTER_KEY = 'stars.mobile.activeCharacter:v1'

interface ExpoSecureStoreModule {
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY?: string | number
  getValueWithKeyAsync: (key: string, options?: Record<string, unknown>) => Promise<string | null>
  setValueWithKeyAsync: (value: string, key: string, options?: Record<string, unknown>) => Promise<void>
  deleteValueWithKeyAsync: (key: string, options?: Record<string, unknown>) => Promise<void>
}

const secureStoreModule = requireOptionalNativeModule<ExpoSecureStoreModule>('ExpoSecureStore')
const volatileSecrets = new Map<string, string>()

function randomId(): string {
  const nativeUuid = globalThis.crypto?.randomUUID?.()
  return nativeUuid ?? `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

const SECURE_OPTIONS: Record<string, unknown> = secureStoreModule?.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY == null
  ? {}
  : { keychainAccessible: secureStoreModule.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }

async function readSecret(key: string) {
  if (!secureStoreModule) return volatileSecrets.get(key) ?? null
  return secureStoreModule.getValueWithKeyAsync(key, SECURE_OPTIONS)
}

async function writeSecret(key: string, value: string) {
  if (!secureStoreModule) {
    volatileSecrets.set(key, value)
    return
  }
  await secureStoreModule.setValueWithKeyAsync(value, key, SECURE_OPTIONS)
}

async function deleteSecret(key: string) {
  volatileSecrets.delete(key)
  if (secureStoreModule) await secureStoreModule.deleteValueWithKeyAsync(key, SECURE_OPTIONS)
}

async function readSecureJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await readSecret(key)
    return raw ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

async function migrateLegacySecret<T>(key: string): Promise<T | null> {
  const secured = await readSecureJson<T>(key)
  if (secured) return secured
  // Never restore an old plaintext token when this build has no Keychain module.
  // The player may log in for the current process, but credentials remain volatile.
  if (!secureStoreModule) return null
  const legacy = await readJson<T>(key)
  if (!legacy) return null
  await writeSecret(key, JSON.stringify(legacy))
  await AsyncStorage.removeItem(key)
  return legacy
}

async function writeSecureJson(key: string, value: unknown) {
  await writeSecret(key, JSON.stringify(value))
  // Successful writes also remove tokens left by pre-Keychain app versions.
  await AsyncStorage.removeItem(key)
}

export async function loadMobileAuthState() {
  const [account, room, serverUrl, activeCharacterId] = await Promise.all([
    migrateLegacySecret<MobileAccountSession>(ACCOUNT_KEY),
    migrateLegacySecret<MobileRoomSession>(ROOM_KEY),
    AsyncStorage.getItem(SERVER_KEY),
    AsyncStorage.getItem(ACTIVE_CHARACTER_KEY),
  ])
  return { account, room, serverUrl, activeCharacterId }
}

export async function saveMobileAccount(serverUrl: string, account: MobileAccountSession) {
  await Promise.all([
    AsyncStorage.setItem(SERVER_KEY, serverUrl),
    writeSecureJson(ACCOUNT_KEY, account),
  ])
}

export async function saveMobileServerUrl(serverUrl: string) {
  await AsyncStorage.setItem(SERVER_KEY, serverUrl)
}

export async function saveMobileRoom(room: MobileRoomSession) {
  await writeSecureJson(ROOM_KEY, room)
}

export async function saveActiveCharacterId(id: string | null) {
  if (id) await AsyncStorage.setItem(ACTIVE_CHARACTER_KEY, id)
  else await AsyncStorage.removeItem(ACTIVE_CHARACTER_KEY)
}

export async function clearMobileRoom() {
  await Promise.all([
    deleteSecret(ROOM_KEY),
    AsyncStorage.removeItem(ROOM_KEY),
    AsyncStorage.removeItem(ACTIVE_CHARACTER_KEY),
  ])
}

export async function clearMobileAccount() {
  await Promise.all([
    clearMobileRoom(),
    deleteSecret(ACCOUNT_KEY),
    AsyncStorage.removeItem(ACCOUNT_KEY),
  ])
}

export async function mobileClientId(): Promise<string> {
  const existing = await AsyncStorage.getItem(CLIENT_KEY)
  if (existing) return existing
  const id = randomId()
  await AsyncStorage.setItem(CLIENT_KEY, id)
  return id
}
