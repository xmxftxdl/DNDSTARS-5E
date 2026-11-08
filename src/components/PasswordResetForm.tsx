import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import {
  accountApiErrorMessage, requestAccountVerification, resetAccountPassword,
  type AccountAuthConfig, type AccountVerificationChannel, type AccountVerificationChallenge,
} from '../lib/accountApi'

export default function PasswordResetForm({ config, configLoading, onSuccess, onBack }: {
  config: AccountAuthConfig
  configLoading: boolean
  onSuccess: () => void
  onBack: () => void
}) {
  const [channel, setChannel] = useState<AccountVerificationChannel>('email')
  const [destination, setDestination] = useState('')
  const [challenge, setChallenge] = useState<AccountVerificationChallenge | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const effectiveChannel = !config.channels.email && config.channels.phone ? 'phone' : channel
  useEffect(() => {
    if (!cooldown) return
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const send = async () => {
    if (sending || busy || cooldown || !config.channels[effectiveChannel] || !destination.trim()) return
    setSending(true); setError(''); setNotice(''); setChallenge(null); setCode('')
    try {
      const next = await requestAccountVerification(effectiveChannel, destination, 'reset-password')
      setChallenge(next); setCooldown(60)
      if (next.debugCode) setCode(next.debugCode)
      setNotice(next.debugCode ? `开发环境验证码：${next.debugCode}` : '如果该联系方式已注册，重置验证码将发送至对应邮箱或手机。请检查收件箱及垃圾邮件。')
    } catch (cause) { setError(accountApiErrorMessage(cause)) }
    finally { setSending(false) }
  }
  const submit = async () => {
    if (busy || sending || !challenge || code.length !== 6 || password.length < config.passwordMinLength || password.length > 128) return
    if (password !== confirmation) { setError('两次输入的新密码不一致。'); return }
    setBusy(true); setError('')
    try {
      await resetAccountPassword({ challengeId: challenge.challengeId, verificationCode: code, newPassword: password })
      setPassword(''); setConfirmation(''); setCode('')
      onSuccess()
    } catch (cause) { setError(accountApiErrorMessage(cause)) }
    finally { setBusy(false) }
  }
  const field = 'w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-arcane-400/50'
  return (
    <div className="mt-4 space-y-3" data-testid="password-reset-form">
      <p className="text-sm font-semibold text-slate-100">找回密码</p>
      <p className="text-xs leading-5 text-slate-400">使用注册时验证的邮箱或手机号设置新密码。原账号中的角色、战役和资料会保留。</p>
      <div className="flex gap-2">
        {(['email', 'phone'] as const).map(value => <button key={value} type="button"
          disabled={busy || sending || !config.channels[value]}
          aria-pressed={effectiveChannel === value}
          onClick={() => { setChannel(value); setDestination(''); setChallenge(null); setCode(''); setNotice(''); setError('') }}
          className={`flex-1 rounded-lg border px-3 py-2 text-xs disabled:opacity-40 ${effectiveChannel === value ? 'border-arcane-400/35 text-arcane-100' : 'border-white/10 text-slate-400'}`}
        >{value === 'email' ? '邮箱找回' : '手机号找回'}</button>)}
      </div>
      {!configLoading && !config.channels.email && !config.channels.phone && <p role="alert" className="text-xs text-amber-200">服务器暂未启用邮件或短信发送服务，请联系站点管理员启用后重试。</p>}
      <input aria-label="注册邮箱或手机号" type={effectiveChannel === 'email' ? 'email' : 'tel'} value={destination}
        disabled={busy || sending} autoComplete={effectiveChannel === 'email' ? 'email' : 'tel'}
        placeholder={effectiveChannel === 'email' ? '注册时使用的邮箱' : '注册时使用的手机号'} className={field}
        onChange={event => { setDestination(event.target.value); setChallenge(null); setCode(''); setNotice('') }} />
      <button type="button" onClick={() => void send()}
        disabled={configLoading || busy || sending || cooldown > 0 || !config.channels[effectiveChannel] || !destination.trim()}
        className="rounded-lg border border-arcane-400/25 px-3 py-2 text-xs text-arcane-200 disabled:opacity-40"
      >{sending ? '发送中…' : cooldown ? `${cooldown}s 后可重新发送` : '发送重置验证码'}</button>
      <input aria-label="重置验证码" value={code} disabled={busy} inputMode="numeric" autoComplete="one-time-code"
        placeholder="6 位验证码" className={field} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
      <input aria-label="新密码" type="password" value={password} disabled={busy} autoComplete="new-password"
        maxLength={128} placeholder={`新密码（至少 ${config.passwordMinLength} 个字符）`} className={field} onChange={event => setPassword(event.target.value)} />
      <input aria-label="确认新密码" type="password" value={confirmation} disabled={busy} autoComplete="new-password"
        maxLength={128} placeholder="再次输入新密码" className={field} onChange={event => setConfirmation(event.target.value)} />
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      {notice && <p role="status" className="text-xs text-emerald-300">{notice}</p>}
      <button type="button" onClick={() => void submit()}
        disabled={busy || sending || !challenge || code.length !== 6 || password.length < config.passwordMinLength || password !== confirmation}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-arcane-500/20 px-3 py-2.5 text-xs font-semibold text-arcane-100 disabled:opacity-40"
      >{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}重置密码</button>
      <button type="button" disabled={busy || sending} onClick={onBack} className="text-xs text-slate-400 hover:text-white">返回登录</button>
    </div>
  )
}
