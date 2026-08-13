import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { AudioSession, LiveKitRoom, useParticipants, useRoomContext } from '@livekit/react-native'
import type { Participant } from 'livekit-client'
import type { MobileCredentials } from '../services/mobileApi'
import { fetchVoiceCredential } from '../services/mobileApi'
import { colors } from '../theme'

interface Credential { serverUrl: string; token: string; canPublish: boolean }

export function VoiceRoomPanel({ credentials, enabled, reason }: { credentials: MobileCredentials; enabled: boolean; reason?: string }) {
  const [access, setAccess] = useState<Credential | null>(null)
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const connect = async () => {
    setConnecting(true); setError('')
    try {
      const next = await fetchVoiceCredential(credentials)
      await AudioSession.startAudioSession()
      setAccess(next)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '语音连接失败') } finally { setConnecting(false) }
  }
  if (!enabled) return <View style={styles.card}><Text style={styles.title}>语音房间</Text><Text style={styles.meta}>{reason || '当前房间未启用语音。'}</Text></View>
  if (!access) return <View style={styles.card}><Text style={styles.title}>语音房间</Text><Text style={styles.meta}>通过房间凭证加入同一 LiveKit 语音空间。</Text><Pressable style={styles.button} onPress={() => void connect()}><Text style={styles.buttonText}>{connecting ? '连接中…' : '加入语音'}</Text></Pressable>{!!error && <Text style={styles.error}>{error}</Text>}</View>
  return <LiveKitRoom serverUrl={access.serverUrl} token={access.token} connect audio={access.canPublish} video={false} onError={(cause) => setError(cause.message)} onDisconnected={() => { void AudioSession.stopAudioSession(); setAccess(null) }}><ConnectedVoice onLeave={() => { void AudioSession.stopAudioSession(); setAccess(null) }} /></LiveKitRoom>
}

function ConnectedVoice({ onLeave }: { onLeave: () => void }) {
  const room = useRoomContext()
  const participants = useParticipants() as Participant[]
  const [muted, setMuted] = useState(!room.localParticipant.isMicrophoneEnabled)
  const toggle = async () => {
    const next = !muted
    await room.localParticipant.setMicrophoneEnabled(!next)
    setMuted(next)
  }
  return <View style={styles.card}><View style={styles.head}><View><Text style={styles.title}>语音已连接</Text><Text style={styles.meta}>{participants.length} 人在线</Text></View><View style={styles.live}><Text style={styles.liveText}>LIVE</Text></View></View><View style={styles.people}>{participants.map((participant) => <View key={participant.identity} style={[styles.person, participant.isSpeaking && styles.speaking]}><Text style={styles.personName}>{participant.name || participant.identity}</Text><Text style={styles.personState}>{participant.isMicrophoneEnabled ? '麦克风开启' : '已静音'}</Text></View>)}</View><View style={styles.actions}><Pressable style={styles.secondary} onPress={() => void toggle()}><Text style={styles.secondaryText}>{muted ? '开启麦克风' : '静音'}</Text></Pressable><Pressable style={styles.leave} onPress={() => { void room.disconnect(); onLeave() }}><Text style={styles.leaveText}>离开语音</Text></Pressable></View></View>
}

const styles = StyleSheet.create({ card: { margin: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: colors.text, fontWeight: '900', fontSize: 15 }, meta: { color: colors.muted, fontSize: 10, marginTop: 4 }, live: { backgroundColor: '#11362d', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }, liveText: { color: colors.success, fontSize: 9, fontWeight: '900' }, button: { backgroundColor: colors.primary, borderRadius: 11, alignItems: 'center', padding: 11, marginTop: 11 }, buttonText: { color: '#fff', fontWeight: '900' }, error: { color: colors.danger, fontSize: 10, marginTop: 7 }, people: { gap: 6, marginTop: 11 }, person: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 9 }, speaking: { borderColor: colors.teal, backgroundColor: '#0b2b2a' }, personName: { color: colors.text, fontWeight: '800', fontSize: 11 }, personState: { color: colors.muted, fontSize: 9 }, actions: { flexDirection: 'row', gap: 8, marginTop: 11 }, secondary: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: colors.primarySoft }, secondaryText: { color: '#d8ccff', fontWeight: '900', fontSize: 10 }, leave: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.danger }, leaveText: { color: colors.danger, fontWeight: '900', fontSize: 10 } })
