import type {
  LocalParticipant,
  Participant,
  RemoteAudioTrack,
  RemoteParticipant,
  Room,
} from 'livekit-client'
import {
  INITIAL_VOICE_PROVIDER_SNAPSHOT,
  type VoiceAccessCredential,
  type VoiceParticipantSnapshot,
  type VoiceProviderAdapter,
  type VoiceProviderSnapshot,
} from './voiceTypes'
import type { RoomRole } from '../lib/roomSession'

function participantRole(participant: Participant): RoomRole {
  try {
    const metadata = participant.metadata ? JSON.parse(participant.metadata) as { role?: unknown } : undefined
    if (metadata?.role === 'dm' || metadata?.role === 'spectator') return metadata.role
  } catch {
    // Invalid provider metadata is untrusted display data, never room authority.
  }
  return 'player'
}

function participantSnapshot(participant: Participant, local: boolean): VoiceParticipantSnapshot {
  return {
    identity: participant.identity,
    displayName: participant.name?.trim() || '未命名成员',
    role: participantRole(participant),
    local,
    speaking: participant.isSpeaking,
    microphoneEnabled: participant.isMicrophoneEnabled,
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return '浏览器未允许使用麦克风。'
  if (error instanceof Error && error.message) return error.message
  return '语音连接失败。'
}

export class LiveKitVoiceProvider implements VoiceProviderAdapter {
  private room: Room | null = null
  private listeners = new Set<(snapshot: VoiceProviderSnapshot) => void>()
  private snapshot: VoiceProviderSnapshot = { ...INITIAL_VOICE_PROVIDER_SNAPSHOT }
  private attachedAudio = new Map<RemoteAudioTrack, HTMLMediaElement>()

  subscribe(listener: (snapshot: VoiceProviderSnapshot) => void): () => void {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => this.listeners.delete(listener)
  }

  private update(patch: Partial<VoiceProviderSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener(this.snapshot)
  }

  private syncParticipants() {
    if (!this.room) return this.update({ participants: [] })
    const participants = [
      participantSnapshot(this.room.localParticipant, true),
      ...Array.from(this.room.remoteParticipants.values()).map((participant) => participantSnapshot(participant, false)),
    ].sort((left, right) => Number(right.local) - Number(left.local) || left.displayName.localeCompare(right.displayName, 'zh-CN'))
    this.update({
      participants,
      microphoneEnabled: this.room.localParticipant.isMicrophoneEnabled,
    })
  }

  private attachRemoteAudio(track: RemoteAudioTrack) {
    if (this.attachedAudio.has(track)) return
    track.setVolume(this.snapshot.deafened ? 0 : 1)
    const element = track.attach()
    element.autoplay = true
    element.dataset.astraltraceVoice = 'remote-audio'
    element.className = 'sr-only'
    document.body.appendChild(element)
    this.attachedAudio.set(track, element)
  }

  private detachRemoteAudio(track: RemoteAudioTrack) {
    for (const element of track.detach()) {
      element.remove()
    }
    this.attachedAudio.delete(track)
  }

  private async enumerateDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return
    const devices = await navigator.mediaDevices.enumerateDevices()
    this.update({
      inputDevices: devices.filter((device) => device.kind === 'audioinput'),
      outputDevices: devices.filter((device) => device.kind === 'audiooutput'),
      activeInputDeviceId: this.room?.getActiveDevice('audioinput'),
      activeOutputDeviceId: this.room?.getActiveDevice('audiooutput'),
    })
  }

  async connect(credential: VoiceAccessCredential): Promise<void> {
    await this.disconnect()
    this.update({ connectionState: 'connecting', canPublish: credential.canPublish, error: undefined })
    try {
      const { Room, RoomEvent, Track } = await import('livekit-client')
      const room = new Room({ adaptiveStream: true, dynacast: true })
      this.room = room
      const sync = () => this.syncParticipants()
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        const connectionState = state === 'connected'
          ? 'connected'
          : state === 'reconnecting' || state === 'signalReconnecting'
            ? 'reconnecting'
            : state === 'connecting' ? 'connecting' : 'disconnected'
        this.update({ connectionState })
      })
      room.on(RoomEvent.ParticipantConnected, sync)
      room.on(RoomEvent.ParticipantDisconnected, sync)
      room.on(RoomEvent.ActiveSpeakersChanged, sync)
      room.on(RoomEvent.TrackMuted, sync)
      room.on(RoomEvent.TrackUnmuted, sync)
      room.on(RoomEvent.LocalTrackPublished, sync)
      room.on(RoomEvent.LocalTrackUnpublished, sync)
      room.on(RoomEvent.ParticipantMetadataChanged, sync)
      room.on(RoomEvent.MediaDevicesChanged, () => void this.enumerateDevices())
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) this.attachRemoteAudio(track as RemoteAudioTrack)
        sync()
      })
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) this.detachRemoteAudio(track as RemoteAudioTrack)
        sync()
      })
      await room.connect(credential.serverUrl, credential.token, { autoSubscribe: true })
      await room.startAudio()
      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.audioTrackPublications.values()) {
          if (publication.track) this.attachRemoteAudio(publication.track as RemoteAudioTrack)
        }
      }
      await this.enumerateDevices()
      this.syncParticipants()
    } catch (error) {
      await this.disconnect()
      this.update({ error: errorMessage(error) })
      throw error
    }
  }

  async disconnect(): Promise<void> {
    const room = this.room
    this.room = null
    if (room) {
      const localParticipant = room.localParticipant as LocalParticipant
      if (localParticipant.isMicrophoneEnabled) await localParticipant.setMicrophoneEnabled(false).catch(() => undefined)
      room.disconnect()
    }
    for (const element of this.attachedAudio.values()) element.remove()
    this.attachedAudio.clear()
    this.update({
      ...INITIAL_VOICE_PROVIDER_SNAPSHOT,
      inputDevices: this.snapshot.inputDevices,
      outputDevices: this.snapshot.outputDevices,
    })
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    if (!this.room || !this.snapshot.canPublish) return
    try {
      await this.room.localParticipant.setMicrophoneEnabled(enabled)
      await this.enumerateDevices()
      this.syncParticipants()
      this.update({ error: undefined })
    } catch (error) {
      this.update({ error: errorMessage(error) })
      throw error
    }
  }

  async setDeafened(deafened: boolean): Promise<void> {
    if (!this.room) return
    for (const participant of this.room.remoteParticipants.values() as Iterable<RemoteParticipant>) {
      participant.setVolume(deafened ? 0 : 1)
    }
    this.update({ deafened })
  }

  async setInputDevice(deviceId: string): Promise<void> {
    if (!this.room || !deviceId) return
    await this.room.switchActiveDevice('audioinput', deviceId, true)
    await this.enumerateDevices()
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    if (!this.room || !deviceId) return
    await this.room.switchActiveDevice('audiooutput', deviceId, true)
    await this.enumerateDevices()
  }

  refreshDevices(): Promise<void> {
    return this.enumerateDevices()
  }
}
