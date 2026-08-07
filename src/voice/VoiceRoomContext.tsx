import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getRoomVoiceStatus, requestRoomVoiceAccess, roomApiErrorMessage } from '../lib/roomApi'
import type { RoomSession } from '../lib/roomSession'
import { LiveKitVoiceProvider } from './liveKitVoiceProvider'
import {
  INITIAL_VOICE_PROVIDER_SNAPSHOT,
  type VoiceProviderSnapshot,
} from './voiceTypes'
import { VoiceRoomContext, type VoiceRoomContextValue } from './useVoiceRoom'
import {
  loadVoiceChangerConfig,
  saveVoiceChangerConfig,
  voiceChangerStorageKey,
  voiceShortcutFromKeyboardEvent,
  type VoiceChangerSelection,
  type VoiceNpcQuickSlot,
} from './voiceChanger'

export function VoiceRoomProvider({ session, children }: { session: RoomSession | null; children: ReactNode }) {
  const providerKey = session ? `${session.roomId}:${session.memberId}:${session.role}` : 'no-session'
  return (
    <VoiceRoomProviderSession key={providerKey} session={session}>
      {children}
    </VoiceRoomProviderSession>
  )
}

function VoiceRoomProviderSession({ session, children }: { session: RoomSession | null; children: ReactNode }) {
  const [provider] = useState(() => new LiveKitVoiceProvider())
  const [state, setState] = useState<VoiceProviderSnapshot>(INITIAL_VOICE_PROVIDER_SNAPSHOT)
  const [enabled, setEnabled] = useState<boolean | null>(session ? null : false)
  const [joining, setJoining] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const voiceChangerKey = session
    ? voiceChangerStorageKey(session.roomId, session.memberId)
    : voiceChangerStorageKey('no-room', 'anonymous')
  const [voiceChangerConfig, setVoiceChangerConfig] = useState(() => loadVoiceChangerConfig(
    typeof window === 'undefined' ? undefined : window.localStorage,
    voiceChangerKey,
  ))
  const connected = state.connectionState === 'connected' || state.connectionState === 'reconnecting'

  useEffect(() => provider.subscribe(setState), [provider])

  useEffect(() => {
    let disposed = false
    if (session) {
      void getRoomVoiceStatus(session).then((status) => {
        if (!disposed) setEnabled(status.enabled)
      }).catch((error) => {
        if (!disposed) {
          setEnabled(false)
          setNotice(roomApiErrorMessage(error))
        }
      })
    }
    return () => {
      disposed = true
      void provider.disconnect()
    }
  }, [provider, session])

  useEffect(() => {
    saveVoiceChangerConfig(
      typeof window === 'undefined' ? undefined : window.localStorage,
      voiceChangerKey,
      voiceChangerConfig,
    )
  }, [voiceChangerConfig, voiceChangerKey])

  useEffect(() => {
    void provider.setVoiceChangerSelection(voiceChangerConfig.selection).catch(() => undefined)
  }, [provider, voiceChangerConfig.selection])

  const setVoiceChangerSelection = useCallback((selection: VoiceChangerSelection) => {
    setVoiceChangerConfig((current) => ({
      ...current,
      selection,
      activeShortcut: undefined,
    }))
  }, [])

  const setVoiceNpcQuickSlot = useCallback((input: VoiceNpcQuickSlot | { shortcut: number; clear: true }) => {
    setVoiceChangerConfig((current) => {
      const slots = current.slots.filter((slot) => slot.shortcut !== input.shortcut)
      if (!('clear' in input)) slots.push(input)
      slots.sort((left, right) => left.shortcut - right.shortcut)
      const activeSlot = 'clear' in input && current.activeShortcut === input.shortcut
        ? undefined
        : current.activeShortcut
      return {
        ...current,
        ...(activeSlot ? { activeShortcut: activeSlot } : { activeShortcut: undefined }),
        slots,
        ...(!('clear' in input) && current.activeShortcut === input.shortcut
          ? { selection: input.selection }
          : {}),
      }
    })
  }, [])

  const activateVoiceNpcQuickSlot = useCallback((shortcut: number) => {
    setVoiceChangerConfig((current) => {
      const slot = current.slots.find((candidate) => candidate.shortcut === shortcut)
      if (!slot) return current
      return {
        ...current,
        selection: slot.selection,
        activeShortcut: shortcut,
      }
    })
  }, [])

  useEffect(() => {
    if (session?.role !== 'dm') return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = voiceShortcutFromKeyboardEvent(event)
      if (!shortcut || !voiceChangerConfig.slots.some((slot) => slot.shortcut === shortcut)) return
      event.preventDefault()
      activateVoiceNpcQuickSlot(shortcut)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [activateVoiceNpcQuickSlot, session?.role, voiceChangerConfig.slots])

  const connect = useCallback(async () => {
    if (!session || joining || connected) return
    setJoining(true)
    setNotice(null)
    try {
      const access = await requestRoomVoiceAccess(session)
      if (!access.enabled) {
        setEnabled(false)
        setNotice('当前服务器尚未启用房间语音。')
        return
      }
      await provider.connect(access)
    } catch (error) {
      setNotice(roomApiErrorMessage(error))
    } finally {
      setJoining(false)
    }
  }, [connected, joining, provider, session])

  const value = useMemo<VoiceRoomContextValue>(() => ({
    session,
    state,
    enabled,
    joining,
    connected,
    notice,
    voiceChangerConfig,
    connect,
    disconnect: () => provider.disconnect(),
    setMicrophoneEnabled: (next) => provider.setMicrophoneEnabled(next),
    setDeafened: (next) => provider.setDeafened(next),
    setInputDevice: (deviceId) => provider.setInputDevice(deviceId),
    setOutputDevice: (deviceId) => provider.setOutputDevice(deviceId),
    setVoiceChangerSelection,
    setVoiceNpcQuickSlot,
    activateVoiceNpcQuickSlot,
  }), [activateVoiceNpcQuickSlot, connect, connected, enabled, joining, notice, provider, session, setVoiceChangerSelection, setVoiceNpcQuickSlot, state, voiceChangerConfig])

  return <VoiceRoomContext.Provider value={value}>{children}</VoiceRoomContext.Provider>
}
