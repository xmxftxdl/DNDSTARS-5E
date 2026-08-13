import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { MobileAccountSession } from '../../../../packages/mobile-protocol/src'
import {
  fetchMobileAccountAuthConfig,
  registerMobileAccount,
  requestMobileAccountVerification,
  type MobileAccountAuthConfig,
} from '../services/mobileApi'
import { mobileClientId } from '../services/sessionStore'
import { colors } from '../theme'

export function AuthScreen({
  serverUrl, onServerUrlChange, busy, error, onLogin, onRegistered,
}: {
  serverUrl: string
  onServerUrlChange: (value: string) => void
  busy: boolean
  error: string
  onLogin: (identifier: string, password: string) => Promise<void>
  onRegistered: (account: MobileAccountSession) => Promise<void>
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [destination, setDestination] = useState('')
  const [channel, setChannel] = useState<'email' | 'phone'>('email')
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode] = useState('')
  const [localError, setLocalError] = useState('')
  const [hint, setHint] = useState('')
  const [config, setConfig] = useState<MobileAccountAuthConfig | null>(null)

  useEffect(() => {
    void fetchMobileAccountAuthConfig(serverUrl).then(setConfig).catch(() => setConfig(null))
  }, [serverUrl])

  const requestCode = async () => {
    setLocalError('')
    try {
      const challenge = await requestMobileAccountVerification(serverUrl, channel, destination)
      setChallengeId(challenge.challengeId)
      setHint(`验证码已发送至 ${challenge.destinationLabel}${challenge.debugCode ? `；开发验证码 ${challenge.debugCode}` : ''}`)
    } catch (cause) { setLocalError(cause instanceof Error ? cause.message : '验证码发送失败') }
  }

  const register = async () => {
    setLocalError('')
    try {
      const account = await registerMobileAccount({
        serverUrl, challengeId, verificationCode: code, username, password, clientId: await mobileClientId(),
      })
      await onRegistered(account)
    } catch (cause) { setLocalError(cause instanceof Error ? cause.message : '注册失败') }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.logo}><Text style={styles.logoText}>✦</Text></View>
      <Text style={styles.brand}>星痕</Text>
      <Text style={styles.subtitle}>移动玩家端</Text>
      <View style={styles.card}>
        <View style={styles.tabs}>
          <Pressable style={[styles.tab, mode === 'login' && styles.tabActive]} onPress={() => setMode('login')}><Text style={styles.tabText}>登录</Text></Pressable>
          <Pressable style={[styles.tab, mode === 'register' && styles.tabActive]} onPress={() => setMode('register')}><Text style={styles.tabText}>注册</Text></Pressable>
        </View>
        <Text style={styles.label}>服务器</Text>
        <TextInput value={serverUrl} onChangeText={onServerUrlChange} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} />
        {mode === 'login' ? <>
          <Text style={styles.label}>用户名 / 邮箱 / 手机号</Text>
          <TextInput value={identifier} onChangeText={setIdentifier} autoCapitalize="none" style={styles.input} />
          <Text style={styles.label}>密码</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
          <Pressable disabled={busy || !identifier || !password} style={[styles.primary, (busy || !identifier || !password) && styles.disabled]} onPress={() => void onLogin(identifier, password)}><Text style={styles.primaryText}>{busy ? '登录中…' : '登录并恢复冒险'}</Text></Pressable>
        </> : <>
          <View style={styles.channelRow}>
            {(['email', 'phone'] as const).map((value) => <Pressable key={value} disabled={config ? !config.channels[value] : false} style={[styles.channel, channel === value && styles.channelActive]} onPress={() => setChannel(value)}><Text style={styles.channelText}>{value === 'email' ? '邮箱' : '手机号'}</Text></Pressable>)}
          </View>
          <Text style={styles.label}>{channel === 'email' ? '邮箱' : '手机号'}</Text>
          <View style={styles.inline}><TextInput value={destination} onChangeText={setDestination} autoCapitalize="none" style={[styles.input, styles.flex]} /><Pressable style={styles.secondary} onPress={() => void requestCode()}><Text style={styles.secondaryText}>发送验证码</Text></Pressable></View>
          <Text style={styles.label}>验证码</Text><TextInput value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} style={styles.input} />
          <Text style={styles.label}>用户名</Text><TextInput value={username} onChangeText={setUsername} style={styles.input} />
          <Text style={styles.label}>密码（至少 {config?.passwordMinLength ?? 8} 位）</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
          {!!hint && <Text style={styles.hint}>{hint}</Text>}
          <Pressable disabled={!challengeId || code.length !== 6 || !username || password.length < (config?.passwordMinLength ?? 8)} style={[styles.primary, (!challengeId || code.length !== 6 || !username) && styles.disabled]} onPress={() => void register()}><Text style={styles.primaryText}>建立账号</Text></Pressable>
        </>}
        {!!(localError || error) && <Text style={styles.error}>{localError || error}</Text>}
      </View>
      <Text style={styles.safeText}>所有角色、地图与结算均由房间 Host 权威验证。</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 22, backgroundColor: colors.background },
  logo: { width: 70, height: 70, borderRadius: 23, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#c4b5fd', fontSize: 34 }, brand: { color: colors.text, fontSize: 32, fontWeight: '900', marginTop: 12 }, subtitle: { color: colors.muted, marginTop: 2 },
  card: { width: '100%', maxWidth: 520, marginTop: 24, borderRadius: 22, padding: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 }, tab: { flex: 1, padding: 10, borderRadius: 11, alignItems: 'center', backgroundColor: colors.background }, tabActive: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary }, tabText: { color: colors.text, fontWeight: '900' },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 5 }, input: { color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 10, backgroundColor: colors.background },
  primary: { marginTop: 15, backgroundColor: colors.primary, borderRadius: 12, padding: 13, alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '900' }, disabled: { opacity: 0.4 },
  channelRow: { flexDirection: 'row', gap: 8 }, channel: { flex: 1, padding: 9, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border }, channelActive: { borderColor: colors.teal, backgroundColor: '#0b2b2a' }, channelText: { color: colors.text, fontWeight: '800' },
  inline: { flexDirection: 'row', gap: 8, alignItems: 'center' }, flex: { flex: 1 }, secondary: { paddingHorizontal: 12, paddingVertical: 11, borderRadius: 11, backgroundColor: colors.primarySoft }, secondaryText: { color: '#d8ccff', fontWeight: '900', fontSize: 11 }, hint: { color: colors.teal, fontSize: 11, marginTop: 10 }, error: { color: colors.danger, marginTop: 10, fontSize: 11 }, safeText: { color: colors.muted, fontSize: 10, marginTop: 15 },
})
