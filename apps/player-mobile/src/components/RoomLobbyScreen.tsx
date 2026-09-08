import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { MobileAccountSession, MobileCampaignSummary } from '../../../../packages/mobile-protocol/src'
import { colors } from '../theme'

export function RoomLobbyScreen({ account, campaigns, busy, error, onJoin, onLogout }: {
  account: MobileAccountSession
  campaigns: MobileCampaignSummary[]
  busy: boolean
  error: string
  onJoin: (roomId: string, password?: string, role?: 'player' | 'spectator') => Promise<void>
  onLogout: () => Promise<void>
}) {
  const [roomId, setRoomId] = useState('')
  const [password, setPassword] = useState('')
  const [spectator, setSpectator] = useState(false)
  const rooms = campaigns.flatMap((campaign) => campaign.latestRoom ? [{ campaign, room: campaign.latestRoom }] : [])
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.account}><View><Text style={styles.greeting}>欢迎回来</Text><Text style={styles.name}>{account.displayName || account.username}</Text></View><Pressable onPress={() => void onLogout()}><Text style={styles.logout}>退出账号</Text></Pressable></View>
    <Text style={styles.title}>加入冒险房间</Text><Text style={styles.meta}>房间创建者需在线；重连会恢复同一玩家身份与角色归属。</Text>
    <View style={styles.joinCard}>
      <TextInput testID="lobby-room-id" value={roomId} onChangeText={(value) => setRoomId(value.toUpperCase())} autoCapitalize="characters" placeholder="6 位房间码" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput testID="lobby-room-password" value={password} onChangeText={setPassword} secureTextEntry placeholder="房间密码（如有）" placeholderTextColor={colors.muted} style={styles.input} />
      <Pressable style={styles.spectatorRow} onPress={() => setSpectator((value) => !value)}><View style={[styles.check, spectator && styles.checked]} /><Text style={styles.checkText}>以观战席位加入（只读）</Text></Pressable>
      <Pressable testID="lobby-join" disabled={busy || roomId.trim().length < 4} style={[styles.primary, (busy || roomId.trim().length < 4) && styles.disabled]} onPress={() => void onJoin(roomId, password, spectator ? 'spectator' : 'player')}><Text style={styles.primaryText}>{busy ? '正在连接…' : '加入房间'}</Text></Pressable>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
    <Text style={styles.section}>账号战役</Text>
    {rooms.length === 0 ? <Text style={styles.empty}>当前账号没有可恢复的战役房间，也可以直接输入房间码。</Text> : rooms.map(({ campaign, room }) => <Pressable key={`${campaign.campaignId}:${room.roomId}`} style={styles.campaign} onPress={() => void onJoin(room.roomId)}>
      <View style={{ flex: 1 }}><Text style={styles.campaignName}>{campaign.name}</Text><Text style={styles.campaignMeta}>{room.roomName} · {room.roomId}</Text></View><Text style={[styles.status, room.hostOnline ? styles.online : styles.offline]}>{room.hostOnline ? 'DM 在线' : 'DM 离线'}</Text>
    </Pressable>)}
  </ScrollView>
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 50, backgroundColor: colors.background, flexGrow: 1 }, account: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.surface, borderRadius: 17, borderWidth: 1, borderColor: colors.border }, greeting: { color: colors.muted, fontSize: 11 }, name: { color: colors.text, fontSize: 19, fontWeight: '900', marginTop: 2 }, logout: { color: colors.danger, fontWeight: '800', fontSize: 11 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: 24 }, meta: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 5 }, joinCard: { marginTop: 15, padding: 15, gap: 9, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, input: { color: colors.text, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 11, padding: 11 }, spectatorRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 4 }, check: { width: 17, height: 17, borderRadius: 5, borderWidth: 1, borderColor: colors.border }, checked: { backgroundColor: colors.teal, borderColor: colors.teal }, checkText: { color: colors.muted, fontSize: 11 }, primary: { backgroundColor: colors.primary, padding: 13, borderRadius: 12, alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '900' }, disabled: { opacity: .4 }, error: { color: colors.danger, fontSize: 11 },
  section: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 24, marginBottom: 9 }, empty: { color: colors.muted, lineHeight: 20 }, campaign: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 9 }, campaignName: { color: colors.text, fontWeight: '900' }, campaignMeta: { color: colors.muted, fontSize: 11, marginTop: 4 }, status: { fontSize: 10, fontWeight: '900' }, online: { color: colors.success }, offline: { color: colors.muted },
})
