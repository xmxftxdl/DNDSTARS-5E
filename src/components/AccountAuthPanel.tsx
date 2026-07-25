import { useEffect, useState } from 'react'
import {
  KeyRound,
  LoaderCircle,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  Smartphone,
  UserPlus,
} from 'lucide-react'
import {
  accountApiErrorMessage,
  loadAccountAuthConfig,
  loginAccount,
  logoutAccount,
  registerAccount,
  requestAccountVerification,
  type AccountAuthConfig,
  type AccountVerificationChannel,
  type AccountVerificationChallenge,
} from '../lib/accountApi'
import {
  clearAccountSession,
  saveAccountSession,
  type AccountSession,
} from '../lib/accountSession'
import { getRoomClientId } from '../lib/roomSession'

interface AccountAuthPanelProps {
  account: AccountSession | null
  onAuthenticated?: (session: AccountSession) => void
  onLoggedOut?: () => void
  onError?: (message: string | null) => void
}

const EMPTY_CONFIG: AccountAuthConfig = {
  schemaVersion: 1,
  channels: { email: false, phone: false },
  developmentDelivery: false,
  verificationExpiresInSeconds: 600,
  passwordMinLength: 8,
}

export default function AccountAuthPanel({
  account,
  onAuthenticated,
  onLoggedOut,
  onError,
}: AccountAuthPanelProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [config, setConfig] = useState<AccountAuthConfig>(EMPTY_CONFIG)
  const [configLoading, setConfigLoading] = useState(true)
  const [channel, setChannel] = useState<AccountVerificationChannel>('email')
  const [destination, setDestination] = useState('')
  const [challenge, setChallenge] = useState<AccountVerificationChallenge | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    void loadAccountAuthConfig()
      .then((next) => {
        if (disposed) return
        setConfig(next)
        if (!next.channels.email && next.channels.phone) setChannel('phone')
      })
      .catch((cause) => {
        if (!disposed) onError?.(accountApiErrorMessage(cause))
      })
      .finally(() => {
        if (!disposed) setConfigLoading(false)
      })
    return () => {
      disposed = true
    }
  }, [onError])

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return
    const timer = window.setInterval(() => {
      const next = Date.now()
      setNow(next)
      if (next >= cooldownUntil) window.clearInterval(timer)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldownUntil])

  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
  const channelAvailable = config.channels[channel]

  const finishAuthentication = (session: AccountSession) => {
    saveAccountSession(session)
    onAuthenticated?.(session)
    onError?.(null)
    setNotice(null)
  }

  const sendVerification = async () => {
    if (sending || cooldownSeconds > 0 || !channelAvailable || !destination.trim()) return
    setSending(true)
    setNotice(null)
    onError?.(null)
    try {
      const next = await requestAccountVerification(channel, destination)
      setChallenge(next)
      setCooldownUntil(Date.now() + 60_000)
      setNow(Date.now())
      if (next.debugCode) {
        setVerificationCode(next.debugCode)
        setNotice(`开发环境验证码：${next.debugCode}`)
      } else {
        setNotice(`验证码已发送至 ${next.destinationLabel}`)
      }
    } catch (cause) {
      onError?.(accountApiErrorMessage(cause))
    } finally {
      setSending(false)
    }
  }

  const submitRegistration = async () => {
    if (busy) return
    if (!challenge) {
      onError?.('请先发送并取得验证码。')
      return
    }
    if (password !== confirmPassword) {
      onError?.('两次输入的密码不一致。')
      return
    }
    setBusy(true)
    onError?.(null)
    try {
      const session = await registerAccount({
        challengeId: challenge.challengeId,
        verificationCode,
        username,
        password,
        clientId: getRoomClientId(),
      })
      finishAuthentication(session)
    } catch (cause) {
      onError?.(accountApiErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const submitLogin = async () => {
    if (busy || !identifier.trim() || !loginPassword) return
    setBusy(true)
    onError?.(null)
    try {
      finishAuthentication(await loginAccount(identifier, loginPassword, getRoomClientId()))
    } catch (cause) {
      onError?.(accountApiErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    if (busy) return
    if (!window.confirm('退出登录不会删除云端角色；之后可使用用户名和密码重新登录。确定退出吗？')) return
    setBusy(true)
    try {
      await logoutAccount()
    } catch {
      // A lost network must not trap the local browser in a stale session.
    } finally {
      clearAccountSession()
      onLoggedOut?.()
      setBusy(false)
    }
  }

  if (account) {
    return (
      <div
        className="mb-6 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.055] p-4"
        data-testid="account-identity-panel"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-100">已登录</p>
            <p className="mt-1 text-sm text-emerald-300">{account.username ?? account.displayName}</p>
            {account.contactLabel && (
              <p className="mt-1 text-xs text-slate-500">
                {account.contactChannel === 'phone' ? '手机号' : '邮箱'}：{account.contactLabel}
              </p>
            )}
            <p className="mt-1 font-mono text-[11px] text-slate-600">账号 ID：{account.accountId}</p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:bg-white/5 hover:text-slate-200 disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
            退出
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="mb-6 rounded-2xl border border-arcane-400/15 bg-arcane-500/[0.055] p-4"
      data-testid="account-identity-panel"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-arcane-500/15 p-2.5 text-arcane-300">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">星痕账号</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                登录后角色与房间身份归属于账号，换设备也能恢复。
              </p>
            </div>
            {configLoading && <LoaderCircle className="h-4 w-4 animate-spin text-slate-500" />}
          </div>

          <div className="mt-4 grid grid-cols-2 rounded-xl bg-black/20 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                onError?.(null)
              }}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                mode === 'login' ? 'bg-arcane-500/20 text-arcane-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register')
                onError?.(null)
              }}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                mode === 'register' ? 'bg-arcane-500/20 text-arcane-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              注册
            </button>
          </div>

          {mode === 'login' ? (
            <div className="mt-4 space-y-3">
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                placeholder="用户名、邮箱或手机号"
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-arcane-400/50"
              />
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void submitLogin()
                  }
                }}
                autoComplete="current-password"
                placeholder="密码"
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-arcane-400/50"
              />
              <button
                type="button"
                disabled={busy || !identifier.trim() || !loginPassword}
                onClick={() => void submitLogin()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-arcane-500/20 px-3 py-2.5 text-xs font-semibold text-arcane-100 hover:bg-arcane-500/30 disabled:opacity-40"
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                登录账号
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!config.channels.email}
                  onClick={() => {
                    setChannel('email')
                    setChallenge(null)
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                    channel === 'email'
                      ? 'border-arcane-400/35 bg-arcane-500/15 text-arcane-100'
                      : 'border-white/10 text-slate-500'
                  } disabled:cursor-not-allowed disabled:opacity-30`}
                >
                  <Mail className="h-3.5 w-3.5" />邮箱注册
                </button>
                <button
                  type="button"
                  disabled={!config.channels.phone}
                  onClick={() => {
                    setChannel('phone')
                    setChallenge(null)
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                    channel === 'phone'
                      ? 'border-arcane-400/35 bg-arcane-500/15 text-arcane-100'
                      : 'border-white/10 text-slate-500'
                  } disabled:cursor-not-allowed disabled:opacity-30`}
                >
                  <Smartphone className="h-3.5 w-3.5" />手机号注册
                </button>
              </div>

              {!configLoading && !config.channels.email && !config.channels.phone && (
                <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
                  服务器尚未配置邮件或短信验证码发送服务，暂时不能注册新账号。
                </p>
              )}

              <div className="flex gap-2">
                <input
                  value={destination}
                  onChange={(event) => {
                    setDestination(event.target.value)
                    setChallenge(null)
                  }}
                  autoComplete={channel === 'email' ? 'email' : 'tel'}
                  placeholder={channel === 'email' ? '邮箱地址' : '手机号（中国号码可直接输入）'}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-arcane-400/50"
                />
                <button
                  type="button"
                  disabled={sending || cooldownSeconds > 0 || !channelAvailable || !destination.trim()}
                  onClick={() => void sendVerification()}
                  className="min-w-24 rounded-lg border border-arcane-400/25 px-3 py-2 text-xs font-semibold text-arcane-200 hover:bg-arcane-500/10 disabled:opacity-40"
                >
                  {sending ? '发送中…' : cooldownSeconds > 0 ? `${cooldownSeconds}s` : '发送验证码'}
                </button>
              </div>

              <input
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 位验证码"
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-arcane-400/50"
              />
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                maxLength={24}
                placeholder="用户名（3～24 个字符）"
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-arcane-400/50"
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder={`密码（至少 ${config.passwordMinLength} 个字符）`}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-arcane-400/50"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="再次输入密码"
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-arcane-400/50"
              />
              {notice && <p className="text-xs text-emerald-300">{notice}</p>}
              <button
                type="button"
                disabled={
                  busy || !challenge || verificationCode.length !== 6 || username.trim().length < 3 ||
                  password.length < config.passwordMinLength || password !== confirmPassword
                }
                onClick={() => void submitRegistration()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-arcane-500/20 px-3 py-2.5 text-xs font-semibold text-arcane-100 hover:bg-arcane-500/30 disabled:opacity-40"
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                创建账号
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
