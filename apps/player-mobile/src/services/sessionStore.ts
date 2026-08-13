import AsyncStorage from '@react-native-async-storage/async-storage'
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

export async function loadMobileAuthState() {
  const [account, room, serverUrl, activeCharacterId] = await Promise.all([
    readJson<MobileAccountSession>(ACCOUNT_KEY),
    readJson<MobileRoomSession>(ROOM_KEY),
    AsyncStorage.getItem(SERVER_KEY),
    AsyncStorage.getItem(ACTIVE_CHARACTER_KEY),
  ])
  return { account, room, serverUrl, activeCharacterId }
}

export async function saveMobileAccount(serverUrl: string, account: MobileAccountSession) {
  await Promise.all([
    AsyncStorage.setItem(SERVER_KEY, serverUrl),
    AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(account)),
  ])
}

export async function saveMobileRoom(room: MobileRoomSession) {
  await AsyncStorage.setItem(ROOM_KEY, JSON.stringify(room))
}

export async function saveActiveCharacterId(id: string | null) {
  if (id) await AsyncStorage.setItem(ACTIVE_CHARACTER_KEY, id)
  else await AsyncStorage.removeItem(ACTIVE_CHARACTER_KEY)
}

export async function clearMobileRoom() {
  await Promise.all([AsyncStorage.removeItem(ROOM_KEY), AsyncStorage.removeItem(ACTIVE_CHARACTER_KEY)])
}

export async function clearMobileAccount() {
  await Promise.all([clearMobileRoom(), AsyncStorage.removeItem(ACCOUNT_KEY)])
}

export async function mobileClientId(): Promise<string> {
  const existing = await AsyncStorage.getItem(CLIENT_KEY)
  if (existing) return existing
  const id = randomId()
  await AsyncStorage.setItem(CLIENT_KEY, id)
  return id
}
