import { useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { MobileAccountSession, MobilePlayerWorkspace, MobileRenderQuality } from '../../../../packages/mobile-protocol/src'
import type { MobileConnectionState } from '../hooks/useMobileWorkspace'
import type { MobileRoomEventStreamStatusV1 } from '../services/roomEventStream'
import { colors } from '../theme'
import { QualitySelector } from './QualitySelector'

export function SettingsScreen({ account, workspace, connection, roomEventStream, quality, onQualityChange, serverUrl, onServerUrlChange, cacheBytes, gpuBytes, onClearCache, onReconnect, onLeaveRoom, onLogout, onUpdateProfile, onChangePassword }: {
  account: MobileAccountSession
  workspace: MobilePlayerWorkspace
  connection: MobileConnectionState
  roomEventStream: MobileRoomEventStreamStatusV1
  quality: MobileRenderQuality
  onQualityChange: (quality: MobileRenderQuality) => void
  serverUrl: string
  onServerUrlChange: (value: string) => void
  cacheBytes: number
  gpuBytes: number
  onClearCache: () => void
  onReconnect: () => void
  onLeaveRoom: () => Promise<void>
  onLogout: () => Promise<void>
  onUpdateProfile: (input: { displayName: string; avatar?: string }) => Promise<void>
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>
}) {
  const [displayName, setDisplayName] = useState(account.displayName)
  const [avatar, setAvatar] = useState(account.avatar ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => { setDisplayName(account.displayName); setAvatar(account.avatar ?? '') }, [account.avatar, account.displayName])
  const run = async (key: string, task: () => Promise<void>) => {
    if (busy) return
    setBusy(key); setMessage('')
    try { await task(); setMessage('操作已完成。') } catch (cause) { setMessage(cause instanceof Error ? cause.message : '操作失败') } finally { setBusy('') }
  }
  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>玩家端设置</Text>
    <View style={styles.profile}><Avatar value={avatar} /><View style={{ flex: 1 }}><Text style={styles.profileName}>{account.displayName || account.username}</Text><Text style={styles.meta}>{account.contactLabel || account.accountId}</Text></View></View>
    <Text style={styles.section}>个人资料</Text><View style={styles.card}><Text style={styles.fieldLabel}>公开显示名称</Text><TextInput value={displayName} maxLength={24} onChangeText={setDisplayName} style={styles.input} /><Text style={styles.fieldLabel}>头像（emoji、HTTPS 图片或 data URL）</Text><TextInput value={avatar} onChangeText={setAvatar} autoCapitalize="none" autoCorrect={false} multiline style={[styles.input, styles.avatarInput]} /><Pressable disabled={!!busy || !displayName.trim()} style={[styles.button, (!!busy || !displayName.trim()) && styles.disabled]} onPress={() => void run('profile', () => onUpdateProfile({ displayName: displayName.trim(), avatar: avatar.trim() || undefined }))}><Text style={styles.buttonText}>保存个人资料</Text></Pressable></View>
    <Text style={styles.section}>修改密码</Text><View style={styles.card}><TextInput value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="当前密码" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="新密码" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="再次输入新密码" placeholderTextColor={colors.muted} style={styles.input} /><Pressable disabled={!!busy || !currentPassword || newPassword.length < 8 || newPassword !== confirmPassword} style={[styles.button, (!!busy || !currentPassword || newPassword.length < 8 || newPassword !== confirmPassword) && styles.disabled]} onPress={() => void run('password', async () => { await onChangePassword(currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') })}><Text style={styles.buttonText}>更新密码</Text></Pressable></View>
    {!!message && <Text style={styles.message}>{message}</Text>}
    <Text style={styles.section}>房间</Text><View style={styles.card}><Row label="房间" value={`${workspace.room.roomName} · ${workspace.room.roomId}`} /><Row label="身份" value={workspace.room.role === 'spectator' ? '观战席' : `玩家 · ${workspace.room.slot || ''}`} /><Row label="连接" value={connection} /><Row label="实时事件流" value={`${streamLabel(roomEventStream.state)} · #${roomEventStream.sequence}`} /><Row label="规则包" value={workspace.rules?.member.ready ? '已就绪' : '缺少或版本不匹配'} /><Row label="行动注册" value={`${workspace.actionRegistry.actions.length} 项`} /><Row label="Interrupt 注册" value={`${workspace.interruptRegistry.entries.length} 项`} />{!!workspace.actionRegistry.rejectedPluginEntries.length && <View style={styles.registryWarning}><Text style={styles.registryWarningTitle}>扩展行动未加载</Text>{workspace.actionRegistry.rejectedPluginEntries.map((entry) => <Text key={`${entry.pluginId}:${entry.reason}`} style={styles.registryWarningText}>{entry.pluginId} · {entry.reason}</Text>)}</View>}</View>
    <Text style={styles.section}>画质档位</Text><QualitySelector value={quality} onChange={onQualityChange} />
    <Text style={styles.section}>服务器</Text><TextInput value={serverUrl} onChangeText={onServerUrlChange} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} /><Pressable style={styles.button} onPress={onReconnect}><Text style={styles.buttonText}>立即重新同步</Text></Pressable>
    <Text style={styles.section}>资源预算</Text><View style={styles.card}><Text style={styles.metric}>磁盘地图缓存：{(cacheBytes / 1024 / 1024).toFixed(1)} MB / 96 MB</Text><Text style={styles.metric}>估算 GPU 纹理：{(gpuBytes / 1024 / 1024).toFixed(1)} MB</Text><Pressable style={styles.clearButton} onPress={onClearCache}><Text style={styles.clearText}>清理地图缓存</Text></Pressable></View>
    <View style={styles.notice}><Text style={styles.noticeTitle}>iPhone 开发构建</Text><Text style={styles.noticeText}>基础玩家流程可使用 Expo Go；LiveKit 实时语音需使用包含原生模块的 Expo Development Build。</Text></View>
    <Pressable style={styles.leaveButton} onPress={() => void onLeaveRoom()}><Text style={styles.leaveText}>离开当前房间</Text></Pressable><Pressable style={styles.logoutButton} onPress={() => void onLogout()}><Text style={styles.logoutText}>退出账号</Text></Pressable>
  </ScrollView>
}

function Avatar({ value }: { value: string }) { return /^(data:image\/|https:\/\/)/i.test(value) ? <Image source={{ uri: value }} style={styles.avatarImage} /> : <View style={styles.avatar}><Text style={styles.avatarText}>{value || '✦'}</Text></View> }
function Row({ label, value }: { label: string; value: string }) { return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text numberOfLines={1} style={styles.rowValue}>{value}</Text></View> }
function streamLabel(state: MobileRoomEventStreamStatusV1['state']) { return state === 'open' ? '实时' : state === 'connecting' ? '正在连接' : state === 'reconnecting' ? '正在恢复' : '已关闭' }

const styles = StyleSheet.create({ content: { padding: 17, paddingBottom: 50, gap: 10 }, title: { color: colors.text, fontSize: 24, fontWeight: '900', marginBottom: 3 }, profile: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 17, padding: 14, backgroundColor: colors.surface }, avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }, avatarImage: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft }, avatarText: { color: '#d8ccff', fontSize: 23 }, profileName: { color: colors.text, fontWeight: '900', fontSize: 17 }, meta: { color: colors.muted, fontSize: 9, marginTop: 3 }, section: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: 10 }, card: { gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 12, backgroundColor: colors.surface }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 6 }, rowLabel: { color: colors.muted, fontSize: 10 }, rowValue: { flex: 1, color: colors.text, fontSize: 10, fontWeight: '800', textAlign: 'right' }, registryWarning: { marginTop: 4, padding: 9, borderRadius: 10, borderWidth: 1, borderColor: '#6d4d17', backgroundColor: '#2a200f' }, registryWarningTitle: { color: colors.warning, fontSize: 10, fontWeight: '900' }, registryWarningText: { color: '#d7bd84', fontSize: 8, marginTop: 4 }, fieldLabel: { color: colors.muted, fontSize: 9, fontWeight: '800' }, input: { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 }, avatarInput: { minHeight: 54, textAlignVertical: 'top', fontSize: 9 }, button: { backgroundColor: colors.primary, borderRadius: 12, padding: 12, alignItems: 'center' }, buttonText: { color: '#fff', fontWeight: '900' }, disabled: { opacity: .4 }, message: { color: colors.teal, borderWidth: 1, borderColor: '#185b54', backgroundColor: '#0b2424', borderRadius: 11, padding: 10, fontSize: 10 }, metric: { color: colors.muted, fontSize: 11, marginVertical: 3 }, clearButton: { marginTop: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 9, alignItems: 'center' }, clearText: { color: colors.text, fontWeight: '800', fontSize: 10 }, notice: { backgroundColor: '#102225', borderRadius: 15, borderColor: '#164e55', borderWidth: 1, padding: 13 }, noticeTitle: { color: colors.teal, fontWeight: '900' }, noticeText: { color: '#b8d8d3', lineHeight: 18, fontSize: 10, marginTop: 5 }, leaveButton: { borderWidth: 1, borderColor: colors.warning, borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 9 }, leaveText: { color: colors.warning, fontWeight: '900' }, logoutButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: 12, padding: 12, alignItems: 'center' }, logoutText: { color: colors.danger, fontWeight: '900' } })
