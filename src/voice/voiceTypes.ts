import type { RoomRole } from '../lib/roomSession'
import type { VoiceChangerSelection } from './voiceChanger'

export type VoiceConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface VoiceParticipantSnapshot {
  identity: string
  displayName: string
  role: RoomRole
  local: boolean
  speaking: boolean
  microphoneEnabled: boolean
}

export interface VoiceProviderSnapshot {
  connectionState: VoiceConnectionState
  microphoneEnabled: boolean
  deafened: boolean
  canPublish: boolean
  participants: VoiceParticipantSnapshot[]
  inputDevices: MediaDeviceInfo[]
  outputDevices: MediaDeviceInfo[]
  activeInputDeviceId?: string
  activeOutputDeviceId?: string
  voiceChangerSupported: boolean
  voiceChangerSelection: VoiceChangerSelection
  error?: string
}

export interface VoiceAccessStatus {
  schemaVersion: 1
  enabled: boolean
  provider: 'livekit'
}

export interface DisabledVoiceAccessStatus extends VoiceAccessStatus {
  enabled: false
}

export interface VoiceAccessCredential extends VoiceAccessStatus {
  enabled: true
  serverUrl: string
  token: string
  expiresAt: number
  role: RoomRole
  canPublish: boolean
}

export interface VoiceProviderAdapter {
  subscribe(listener: (snapshot: VoiceProviderSnapshot) => void): () => void
  connect(credential: VoiceAccessCredential): Promise<void>
  disconnect(): Promise<void>
  setMicrophoneEnabled(enabled: boolean): Promise<void>
  setDeafened(deafened: boolean): Promise<void>
  setInputDevice(deviceId: string): Promise<void>
  setOutputDevice(deviceId: string): Promise<void>
  setVoiceChangerSelection(selection: VoiceChangerSelection): Promise<void>
  refreshDevices(): Promise<void>
}

export const INITIAL_VOICE_PROVIDER_SNAPSHOT: VoiceProviderSnapshot = {
  connectionState: 'disconnected',
  microphoneEnabled: false,
  deafened: false,
  canPublish: false,
  participants: [],
  inputDevices: [],
  outputDevices: [],
  voiceChangerSupported: typeof AudioContext !== 'undefined',
  voiceChangerSelection: {
    baseProfileId: 'original',
    effectPresetId: 'natural',
  },
}
