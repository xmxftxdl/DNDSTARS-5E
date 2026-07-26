import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Check,
  Crown,
  DoorOpen,
  Eye,
  Dices,
  LoaderCircle,
  Network,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import {
  getAccountSession,
  subscribeAccountSession,
} from '../lib/accountSession'
import AccountAuthPanel from '../components/AccountAuthPanel'
import {
  joinRoom,
  launchCampaignRoom,
  loadRoomPreview,
  roomApiErrorMessage,
  type RoomPreview,
} from '../lib/roomApi'
import {
  accountApiErrorMessage,
  loadAccountCampaigns,
  type AccountCampaign,
} from '../lib/accountApi'
import {
  DND5E_2014_RULESET_ID,
  DND5E_2014_RULESET_LABEL,
  getRecentRoomPlayerResumeIdentity,
  getRoomPlayerResumeIdentity,
  saveRoomSession,
} from '../lib/roomSession'
import { setRoomRulesSnapshot } from '../lib/roomRulesState'
import { activeDnd5eRulesPluginRequirements } from '../rulesets/dnd5e/pluginApi'
import {
  clearLocalRoomCampaignCache,
  requestedRoomLobbyMode,
  type RoomLobbyMode,
} from '../lib/campaignNavigation'

export default function RoomLobbyPage({
  notice,
  embedded = false,
}: {
  notice?: string | null
  embedded?: boolean
}) {
  const recentResume = typeof window === 'undefined' ? null : getRecentRoomPlayerResumeIdentity()
  const requestedMode = typeof window === 'undefined' ? null : requestedRoomLobbyMode(window.location.search)
  const invitedRoomCode = typeof window === 'undefined'
    ? ''
    : (new URLSearchParams(window.location.search).get('join') ?? '').toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 6)
  const initialRoomCode = requestedMode === 'create' ? '' : invitedRoomCode || recentResume?.roomId || ''
  const requestedCampaignId = typeof window === 'undefined'
    ? ''
    : (new URLSearchParams(window.location.search).get('campaign') ?? '').toUpperCase()
  const [mode, setMode] = useState<RoomLobbyMode>(
    requestedMode ?? (initialRoomCode.length === 6 ? 'join' : 'create'),
  )
  const [roomName, setRoomName] = useState('我的 D&D 5e 战役')
  const [dmName, setDmName] = useState('地下城主')
  const [roomCode, setRoomCode] = useState(initialRoomCode)
  const [playerName, setPlayerName] = useState(
    recentResume?.roomId === initialRoomCode ? recentResume.displayName : '',
  )
  const [joinRole, setJoinRole] = useState<'player' | 'spectator'>('player')
  const [roomPassword, setRoomPassword] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<RoomPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [account, setAccount] = useState(() => getAccountSession())
  const [campaigns, setCampaigns] = useState<AccountCampaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [selectedCampaignId, setSelectedCampaignId] = useState(requestedCampaignId)
  const resumeIdentity = mode === 'join' ? getRoomPlayerResumeIdentity(roomCode) : null

  useEffect(() => subscribeAccountSession(setAccount), [])

  useEffect(() => {
    let disposed = false
    void (async () => {
      await Promise.resolve()
      if (disposed) return
      if (!account) {
        setCampaigns([])
        setSelectedCampaignId('')
        setCampaignsLoading(false)
        return
      }
      setCampaignsLoading(true)
      try {
        const loaded = await loadAccountCampaigns()
        if (disposed) return
        const available = loaded.filter((campaign) => !campaign.archived)
        setCampaigns(available)
        setSelectedCampaignId((current) =>
          available.some((campaign) => campaign.campaignId === current)
            ? current
            : available[0]?.campaignId ?? '')
      } catch (cause) {
        if (!disposed) setError(accountApiErrorMessage(cause))
      } finally {
        if (!disposed) setCampaignsLoading(false)
      }
    })()
    return () => {
      disposed = true
    }
  }, [account])

  useEffect(() => {
    if (mode !== 'join' || roomCode.length !== 6) return
    let disposed = false
    const timer = window.setTimeout(() => {
      setPreviewLoading(true)
      setPreviewError(null)
      void loadRoomPreview(roomCode)
        .then((next) => {
          if (!disposed) setPreview(next)
        })
        .catch((cause) => {
          if (!disposed) {
            setPreview(null)
            setPreviewError(roomApiErrorMessage(cause))
          }
        })
        .finally(() => {
          if (!disposed) setPreviewLoading(false)
        })
    }, 250)
    return () => {
      disposed = true
      window.clearTimeout(timer)
    }
  }, [mode, roomCode])

  const selectMode = (next: RoomLobbyMode) => {
    setMode(next)
    setError(null)
    setPreview(null)
    setPreviewError(null)
    setPreviewLoading(false)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (!account) {
        setError('请先注册或登录星痕账号。')
        setBusy(false)
        return
      }
      const activePlugins = activeDnd5eRulesPluginRequirements()
      const connection = mode === 'create'
        ? await launchCampaignRoom({
            campaignId: selectedCampaignId,
            roomName,
            displayName: dmName,
            password: roomPassword,
            maxPlayers,
            activePlugins,
          })
        : await joinRoom({ roomId: roomCode, displayName: playerName, password: roomPassword, activePlugins, role: joinRole })
      if (mode === 'create') clearLocalRoomCampaignCache(window.localStorage)
      saveRoomSession(connection.session)
      setRoomRulesSnapshot(connection.rules)
      const campaignBase = `/campaign/${encodeURIComponent(connection.session.campaignId ?? connection.session.roomId)}`
      window.location.assign(
        connection.session.role === 'dm'
          ? `${campaignBase}/overview`
          : connection.rules.member.ready ? `${campaignBase}/maps` : `${campaignBase}/settings`,
      )
    } catch (cause) {
      setError(roomApiErrorMessage(cause))
      setBusy(false)
    }
  }

  return (
    <main className={`relative overflow-hidden ${embedded ? 'min-h-[calc(100vh-12rem)] rounded-3xl border border-white/8 px-5' : 'min-h-screen px-5 py-8 sm:px-8 lg:px-12'}`}>
      <div className="pointer-events-none absolute left-[-12rem] top-[-14rem] h-[34rem] w-[34rem] rounded-full bg-arcane-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-16rem] right-[-10rem] h-[36rem] w-[36rem] rounded-full bg-ember-500/10 blur-[130px]" />

      <div className={`relative mx-auto flex max-w-6xl flex-col ${embedded ? 'min-h-[calc(100vh-12rem)]' : 'min-h-[calc(100vh-4rem)]'}`}>
        {!embedded && <header className="flex items-center gap-3">
          <div className="glow-arcane flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-arcane-500 to-arcane-600">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gradient">星界</h1>
            <p className="text-xs text-slate-500">D&D 5e 跑团助手</p>
          </div>
        </header>}

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-arcane-400/20 bg-arcane-500/10 px-3 py-1.5 text-xs font-medium text-arcane-200">
              <Dices className="h-3.5 w-3.5" />
              D&D 5e 2014 · SRD 5.1
            </div>
            <h2 className="font-display text-4xl font-bold leading-tight text-slate-50 sm:text-5xl">
              建立你的冒险房间，
              <span className="text-gradient">让队伍立即入场</span>
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-400">
              创建者自动成为 DM；其他玩家凭房间码加入后，由服务端分配空闲玩家席位。地图、角色、骰子与战斗仍通过现有 Headless 权威链路同步。
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                [Crown, 'DM 权威', '创建者主持房间'],
                [Network, '实时同步', '共享同一战役状态'],
                [ShieldCheck, '在线校验', '房主在线才可加入'],
              ].map(([Icon, title, description]) => {
                const FeatureIcon = Icon as typeof Crown
                return (
                  <div key={String(title)} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                    <FeatureIcon className="mb-3 h-5 w-5 text-arcane-300" />
                    <p className="text-sm font-semibold text-slate-200">{String(title)}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{String(description)}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="glass overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/25">
            <div className="grid grid-cols-2 border-b border-white/10 p-2">
              <button
                type="button"
                onClick={() => selectMode('create')}
                className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                  mode === 'create'
                    ? 'bg-arcane-500/20 text-arcane-100 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.25)]'
                    : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <Crown className="h-4 w-4" />
                创建房间
              </button>
              <button
                type="button"
                onClick={() => selectMode('join')}
                className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                  mode === 'join'
                    ? 'bg-arcane-500/20 text-arcane-100 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.25)]'
                    : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <Users className="h-4 w-4" />
                加入房间
              </button>
            </div>

            <form onSubmit={submit} className="p-6 sm:p-8">
              <div className="mb-7">
                <p className="text-lg font-bold text-slate-100">
                  {mode === 'create' ? '开启一场新战役' : '加入冒险队伍'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {mode === 'create'
                    ? '创建成功后，你将以 DM 身份进入管理端。'
                    : '房间创建者必须在线；可加入玩家席位，或使用只读观战席位。'}
                </p>
              </div>

              {!account && (
                <AccountAuthPanel
                  account={account}
                  onAuthenticated={(session) => {
                    if (!playerName.trim()) setPlayerName(session.displayName)
                    if (!dmName.trim() || dmName === '地下城主') setDmName(session.displayName)
                  }}
                  onLoggedOut={() => setError(null)}
                  onError={setError}
                />
              )}

              {mode === 'create' ? (
                <div className="space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">长期战役</span>
                    {campaignsLoading ? (
                      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-400">
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        正在读取账号战役……
                      </div>
                    ) : campaigns.length > 0 ? (
                      <select
                        value={selectedCampaignId}
                        onChange={(event) => {
                          const campaignId = event.target.value
                          setSelectedCampaignId(campaignId)
                          const selected = campaigns.find((campaign) => campaign.campaignId === campaignId)
                          if (selected) setRoomName(`${selected.name} · 游戏房间`)
                        }}
                        required
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200 outline-none focus:border-arcane-400/50"
                      >
                        {campaigns.map((campaign) => (
                          <option key={campaign.campaignId} value={campaign.campaignId}>
                            {campaign.name}（已开团 {campaign.roomCount} 次）
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                        还没有可用的长期战役。请先在战役页建立战役档案。
                        <a href="/app" className="ml-2 font-bold underline">返回新建战役</a>
                      </div>
                    )}
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">房间名称</span>
                    <input
                      value={roomName}
                      onChange={(event) => setRoomName(event.target.value)}
                      maxLength={40}
                      required
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-arcane-400/50 focus:ring-2 focus:ring-arcane-500/10"
                      placeholder="例如：失落矿坑"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">玩家人数</span>
                      <select
                        value={maxPlayers}
                        onChange={(event) => setMaxPlayers(Number(event.target.value))}
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200 outline-none focus:border-arcane-400/50"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count} 名玩家</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">加入密码（可选）</span>
                      <input
                        type="password"
                        value={roomPassword}
                        onChange={(event) => setRoomPassword(event.target.value)}
                        maxLength={64}
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none focus:border-arcane-400/50"
                        placeholder="留空则无需密码"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">DM 称呼</span>
                    <input
                      value={dmName}
                      onChange={(event) => setDmName(event.target.value)}
                      maxLength={24}
                      required
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-arcane-400/50 focus:ring-2 focus:ring-arcane-500/10"
                      placeholder="地下城主"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">游戏规则</span>
                    <div className="relative">
                      <select
                        value={DND5E_2014_RULESET_ID}
                        disabled
                        className="w-full appearance-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300 opacity-100"
                      >
                        <option value={DND5E_2014_RULESET_ID}>{DND5E_2014_RULESET_LABEL}</option>
                      </select>
                      <Check className="pointer-events-none absolute right-4 top-3.5 h-4 w-4 text-emerald-400" />
                    </div>
                  </label>
                </div>
              ) : (
                <div className="space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">六位房间码</span>
                    <input
                      value={roomCode}
                      onChange={(event) => {
                        setRoomCode(event.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 6))
                        setPreview(null)
                        setPreviewError(null)
                        setPreviewLoading(false)
                      }}
                      minLength={6}
                      maxLength={6}
                      required
                      autoComplete="off"
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.35em] text-slate-50 outline-none transition placeholder:text-slate-700 focus:border-arcane-400/50 focus:ring-2 focus:ring-arcane-500/10"
                      placeholder="ABC234"
                    />
                  </label>
                  <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">房间称呼</span>
                    <input
                      value={playerName}
                      onChange={(event) => setPlayerName(event.target.value)}
                      maxLength={24}
                      required
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-arcane-400/50 focus:ring-2 focus:ring-arcane-500/10"
                      placeholder="输入你的称呼"
                    />
                  </label>
                  <div>
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">加入身份</span>
                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/20 p-1.5">
                      <button
                        type="button"
                        onClick={() => setJoinRole('player')}
                        className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${joinRole === 'player' ? 'bg-arcane-500/20 text-arcane-100' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'}`}
                      >
                        <Users className="h-4 w-4" />玩家
                      </button>
                      <button
                        type="button"
                        onClick={() => setJoinRole('spectator')}
                        className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${joinRole === 'spectator' ? 'bg-sky-500/20 text-sky-100' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'}`}
                      >
                        <Eye className="h-4 w-4" />只读观战
                      </button>
                    </div>
                    {joinRole === 'spectator' && (
                      <p className="mt-2 text-xs leading-5 text-sky-200/75">观战者使用玩家安全视野，不占玩家名额，不能移动单位、掷骰或修改房间数据。</p>
                    )}
                  </div>
                  {preview?.passwordRequired && (
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">房间密码</span>
                      <input
                        type="password"
                        value={roomPassword}
                        onChange={(event) => setRoomPassword(event.target.value)}
                        maxLength={64}
                        required
                        autoComplete="current-password"
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none focus:border-arcane-400/50"
                        placeholder="请输入 DM 设置的密码"
                      />
                    </label>
                  )}
                  {(previewLoading || preview || previewError) && (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      {previewLoading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          正在读取房间规则…
                        </div>
                      ) : preview ? (
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-100">{preview.roomName}</p>
                              <p className="mt-1 text-xs text-slate-400">DM：{preview.dmDisplayName}</p>
                              <p className="mt-1 text-xs text-slate-500">玩家：{preview.playerCount}/{preview.maxPlayers} · 观战：{preview.spectatorCount ?? 0} · {preview.passwordRequired ? '需要密码' : '无需密码'} · 游戏协议 v{preview.gameProtocolVersion}</p>
                              {preview.hostStatus === 'grace' && (
                                <p className="mt-1 text-[11px] text-amber-300">DM 暂时断线，房间正处于重连宽限期。</p>
                              )}
                              {preview.hostStatus === 'offline' && preview.hostLastSeenAt > 0 && (
                                <p className="mt-1 text-[11px] text-red-300">DM 已离线；原 DM 可用账号恢复身份，其他玩家需等待 DM 恢复在线。</p>
                              )}
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              preview.hostStatus === 'online'
                                ? 'bg-emerald-500/10 text-emerald-300'
                                : preview.hostStatus === 'grace'
                                  ? 'bg-amber-500/10 text-amber-300'
                                  : 'bg-red-500/10 text-red-300'
                            }`}>
                              {preview.locked ? '房间已锁定' : preview.hostStatus === 'online' ? 'DM 在线' : preview.hostStatus === 'grace' ? 'DM 重连中' : 'DM 离线'}
                            </span>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">房间规则包</p>
                            {preview.plugins.length === 0 ? (
                              <p className="mt-2 text-xs text-slate-400">仅使用 {DND5E_2014_RULESET_LABEL}，无附加规则包。</p>
                            ) : (
                              <div className="mt-2 space-y-2">
                                {preview.plugins.map((plugin) => (
                                  <div key={plugin.id} className="rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2.5">
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                      <span className="text-xs font-semibold text-slate-200">{plugin.name}</span>
                                      <span className="font-mono text-[11px] text-arcane-300">v{plugin.version}</span>
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-500">发布者：{plugin.publisher} · 许可证：{plugin.license}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-red-300">{previewError}</p>
                      )}
                    </div>
                  )}
                  <div className="flex gap-3 rounded-xl border border-arcane-400/15 bg-arcane-500/[0.06] p-3 text-xs leading-5 text-slate-400">
                    <DoorOpen className="mt-0.5 h-4 w-4 shrink-0 text-arcane-300" />
                    <span>
                      {resumeIdentity
                        ? `检测到「${resumeIdentity.displayName}」在该房间的旧席位；重新加入后会恢复原角色归属。`
                        : '加入后会自动获得空闲席位；若缺少房间规则包，会先进入规则包页面完成校验。'}
                    </span>
                  </div>
                </div>
              )}

              {(notice || error) && (
                <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                  error
                    ? 'border-red-400/20 bg-red-500/10 text-red-200'
                    : 'border-amber-400/20 bg-amber-500/10 text-amber-100'
                }`}>
                  {error ?? notice}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  busy ||
                  !account ||
                  (mode === 'create' && (!selectedCampaignId || campaignsLoading)) ||
                  (mode === 'join' && preview?.locked === true)
                }
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-arcane-600 to-arcane-500 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-arcane-900/30 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {busy
                  ? '正在连接…'
                  : !account
                    ? '请先注册或登录'
                    : mode === 'create' ? '创建并以 DM 身份进入' : joinRole === 'spectator' ? '以观战者身份进入' : '加入并进入玩家端'}
              </button>
            </form>
          </div>
        </section>

        <footer className="flex items-center justify-between gap-4 border-t border-white/5 pt-5 text-xs text-slate-600">
          <span>SRD 5.1 · D&D 5e 2014 RulesetAdapter</span>
          <span>Headless DM Authority</span>
        </footer>
      </div>
    </main>
  )
}
