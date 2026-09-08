import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import * as Network from 'expo-network'
import { applyPlayerSceneDelta, type MobilePlayerSession, type PlayerSceneSnapshot } from '../../../../packages/mobile-protocol/src'
import { createDemoSession, fetchDemoDeltas, fetchDemoSnapshot, submitDemoMove } from '../services/mobileApi'

export type ConnectionState = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline' | 'error'

export function usePlayerScene(baseUrl: string) {
  const [session, setSession] = useState<MobilePlayerSession | null>(null)
  const [snapshot, setSnapshot] = useState<PlayerSceneSnapshot | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('idle')
  const [error, setError] = useState('')
  const snapshotRef = useRef<PlayerSceneSnapshot | null>(null)
  snapshotRef.current = snapshot

  const connect = useCallback(async () => {
    setConnection('connecting')
    setError('')
    try {
      const nextSession = await createDemoSession(baseUrl)
      const nextSnapshot = await fetchDemoSnapshot(baseUrl, nextSession.sessionId)
      setSession(nextSession)
      setSnapshot(nextSnapshot)
      setConnection('online')
    } catch (cause) {
      setConnection('error')
      setError(cause instanceof Error ? cause.message : '连接失败')
    }
  }, [baseUrl])

  const resync = useCallback(async () => {
    if (!session) return
    setConnection('reconnecting')
    try {
      const next = await fetchDemoSnapshot(baseUrl, session.sessionId)
      setSnapshot(next)
      setConnection('online')
      setError('')
    } catch (cause) {
      setConnection('offline')
      setError(cause instanceof Error ? cause.message : '重连失败')
    }
  }, [baseUrl, session])

  useEffect(() => {
    if (!session || !snapshot) return
    let cancelled = false
    const poll = async () => {
      const network = await Network.getNetworkStateAsync().catch(() => null)
      if (network && network.isConnected === false) {
        if (!cancelled) setConnection('offline')
        return
      }
      try {
        const current = snapshotRef.current
        if (!current) return
        const batch = await fetchDemoDeltas(baseUrl, session.sessionId, current.revision)
        if (cancelled) return
        if (batch.requiresSnapshot) return void resync()
        let next = current
        for (const delta of batch.deltas) next = applyPlayerSceneDelta(next, delta)
        setSnapshot(next)
        setConnection('online')
      } catch {
        if (!cancelled) setConnection('offline')
      }
    }
    const timer = setInterval(poll, 2_000)
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void resync()
    })
    return () => {
      cancelled = true
      clearInterval(timer)
      appState.remove()
    }
  }, [baseUrl, resync, session, snapshot?.sceneId])

  const moveControlledToken = useCallback(async (tokenId: string, x: number, y: number) => {
    if (!session || !snapshotRef.current) throw new Error('scene-not-ready')
    try {
      const result = await submitDemoMove(baseUrl, session.sessionId, {
        schemaVersion: 1,
        transactionId: `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sceneId: snapshotRef.current.sceneId,
        tokenId,
        expectedRevision: snapshotRef.current.revision,
        destination: { x, y },
      })
      const current = snapshotRef.current
      if (result.delta.revision === current.revision + 1) setSnapshot(applyPlayerSceneDelta(current, result.delta))
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'revision-conflict') await resync()
      throw cause
    }
  }, [baseUrl, resync, session])

  return { session, snapshot, connection, error, connect, resync, moveControlledToken }
}

