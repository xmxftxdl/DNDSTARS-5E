import { createContext, useContext } from 'react'
import type { RoomSession } from '../lib/roomSession'
import type { VoiceProviderSnapshot } from './voiceTypes'
import type {
  VoiceChangerConfigV1,
  VoiceChangerSelection,
  VoiceNpcQuickSlot,
} from './voiceChanger'

export interface VoiceRoomContextValue {
  session: RoomSession | null
  state: VoiceProviderSnapshot
  enabled: boolean | null
  joining: boolean
  connected: boolean
  notice: string | null
  voiceChangerConfig: VoiceChangerConfigV1
  connect(): Promise<void>
  disconnect(): Promise<void>
  setMicrophoneEnabled(enabled: boolean): Promise<void>
  setDeafened(deafened: boolean): Promise<void>
  setInputDevice(deviceId: string): Promise<void>
  setOutputDevice(deviceId: string): Promise<void>
  setVoiceChangerSelection(selection: VoiceChangerSelection): void
  setVoiceNpcQuickSlot(slot: VoiceNpcQuickSlot | { shortcut: number; clear: true }): void
  activateVoiceNpcQuickSlot(shortcut: number): void
}

export const VoiceRoomContext = createContext<VoiceRoomContextValue | null>(null)

export function useVoiceRoom(): VoiceRoomContextValue {
  const value = useContext(VoiceRoomContext)
  if (!value) throw new Error('VoiceRoomProvider is missing')
  return value
}
