import { Camera, KeyRound, LoaderCircle, Save, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  accountApiErrorMessage,
  changeAccountPassword,
  loadAccountProfile,
  updateAccountProfile,
  type AccountProfile,
} from '../lib/accountApi'
import { getAccountSession, saveAccountSession } from '../lib/accountSession'

async function resizeAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件。')
  const source = await createImageBitmap(file)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法处理头像。')
  const side = Math.min(source.width, source.height)
  const sourceX = (source.width - side) / 2
  const sourceY = (source.height - side) / 2
  context.drawImage(source, sourceX, sourceY, side, side, 0, 0, size, size)
  source.close()
  return canvas.toDataURL('image/webp', 0.84)
}

function Avatar({ profile }: { profile: AccountProfile | null }) {
  if (profile?.avatar) {
    return <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
  }
  return <UserRound className="h-12 w-12 text-arcane-200" />
}

export default function AccountProfilePage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [avatar, setAvatar] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState<'profile' | 'password' | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void loadAccountProfile()
      .then((loaded) => {
        setProfile(loaded)
        setDisplayName(loaded.displayName)
        setAvatar(loaded.avatar ?? '')
        const session = getAccountSession()
        if (session) saveAccountSession({
          ...session,
          displayName: loaded.displayName,
          avatar: loaded.avatar,
        })
      })
      .catch((cause) => setError(accountApiErrorMessage(cause)))
  }, [])

  const saveProfile = async () => {
    setBusy('profile')
    setError('')
    setNotice('')
    try {
      const updated = await updateAccountProfile({ displayName, avatar })
      setProfile(updated)
      const session = getAccountSession()
      if (session) saveAccountSession({ ...session, displayName: updated.displayName, avatar: updated.avatar })
      setNotice('个人资料已保存。')
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    } finally {
      setBusy(null)
    }
  }

  const savePassword = async () => {
    if (newPassword !== confirmPassword) return setError('两次输入的新密码不一致。')
    setBusy('password')
    setError('')
    setNotice('')
    try {
      await changeAccountPassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setNotice('密码已更新，其他设备上的旧登录会话已退出。')
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-arcane-300">Account</p>
        <h1 className="mt-2 text-3xl font-bold text-white">个人资料</h1>
        <p className="mt-2 text-sm text-slate-400">管理公开显示名称、账号头像与登录密码。</p>
      </div>

      {notice && <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div>}
      {error && <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>}

      <section className="grid gap-6 rounded-3xl border border-white/10 bg-black/20 p-6 md:grid-cols-[180px_1fr]">
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-arcane-500/10"
          >
            <Avatar profile={profile ? { ...profile, avatar } : null} />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/70 py-2 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
              <Camera className="h-4 w-4" />更换头像
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file) void resizeAvatar(file).then(setAvatar).catch((cause) => setError(String(cause)))
              event.currentTarget.value = ''
            }}
          />
          {avatar && (
            <button type="button" onClick={() => setAvatar('')} className="mt-3 text-xs text-slate-500 hover:text-slate-200">
              移除头像
            </button>
          )}
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-400">显示名称</span>
            <input value={displayName} maxLength={24} onChange={(event) => setDisplayName(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-xs text-slate-500">用户名</p>
              <p className="mt-1 font-semibold text-slate-200">{profile?.username ?? '旧版账号'}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-xs text-slate-500">验证方式</p>
              <p className="mt-1 font-semibold text-slate-200">{profile?.contactLabel ?? '未绑定'}</p>
            </div>
          </div>
          <button type="button" disabled={busy != null || !displayName.trim()} onClick={() => void saveProfile()} className="inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {busy === 'profile' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存个人资料
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-black/20 p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-cyan-500/10 p-2 text-cyan-200"><KeyRound className="h-5 w-5" /></span>
          <div>
            <h2 className="text-lg font-bold text-white">修改密码</h2>
            <p className="mt-1 text-sm text-slate-500">修改后会保留当前设备，并退出其他设备上的旧会话。</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <input type="password" autoComplete="current-password" placeholder="当前密码" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100" />
          <input type="password" autoComplete="new-password" placeholder="新密码（至少 8 位）" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100" />
          <input type="password" autoComplete="new-password" placeholder="再次输入新密码" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100" />
        </div>
        <button type="button" disabled={busy != null || !currentPassword || !newPassword || !confirmPassword} onClick={() => void savePassword()} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-bold text-cyan-100 disabled:opacity-50">
          {busy === 'password' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          更新密码
        </button>
      </section>
    </div>
  )
}
