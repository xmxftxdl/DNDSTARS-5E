import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import type { MobileAccountSession, MobileRoomSession } from '../../../../packages/mobile-protocol/src'

const ACCOUNT_KEY = 'stars.mobile.account:v1'
const ROOM_KEY = 'stars.mobile.room:v1'
const SERVER_KEY = 'stars.mobile.gameServer:v1'
const CLIENT_KEY = 'stars.mobile.clientId:v1'
const ACTIVE_CHARACTER_KEY = 'stars.mobile.activeCharacter:v1'

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

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

async function readSecureJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(key, SECURE_OPTIONS)
    return raw ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

async function migrateLegacySecret<T>(key: string): Promise<T | null> {
  const secured = await readSecureJson<T>(key)
  if (secured) return secured
  const legacy = await readJson<T>(key)
  if (!legacy) return null
  await SecureStore.setItemAsync(key, JSON.stringify(legacy), SECURE_OPTIONS)
  await AsyncStorage.removeItem(key)
  return legacy
}

async function writeSecureJson(key: string, value: unknown) {
  await SecureStore.setItemAsync(key, JSON.stringify(value), SECURE_OPTIONS)
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
    SecureStore.deleteItemAsync(ROOM_KEY),
    AsyncStorage.removeItem(ROOM_KEY),
    AsyncStorage.removeItem(ACTIVE_CHARACTER_KEY),
  ])
}

export async function clearMobileAccount() {
  await Promise.all([
    clearMobileRoom(),
    SecureStore.deleteItemAsync(ACCOUNT_KEY),
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
