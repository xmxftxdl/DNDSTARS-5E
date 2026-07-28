import { useEffect, useState, type FormEvent } from 'react'
import {
  Archive,
  ArrowRight,
  Clock3,
  DoorOpen,
  LibraryBig,
  LoaderCircle,
  LogIn,
  Plus,
  Puzzle,
  RotateCcw,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import AccountAuthPanel from '../components/AccountAuthPanel'
import Card from '../components/Card'
import PageHeader from '../components/PageHeader'
import {
  accountApiErrorMessage,
  createAccountCampaign,
  loadAccountCampaigns,
  updateAccountCampaign,
  type AccountCampaign,
} from '../lib/accountApi'
import {
  getRecentRoomPlayerResumeIdentity,
  saveRoomSession,
  type RoomSession,
} from '../lib/roomSession'
import { resumeCampaignRoom, roomApiErrorMessage } from '../lib/roomApi'
import { setRoomRulesSnapshot } from '../lib/roomRulesState'
import { activeDnd5eRulesPluginRequirements } from '../rulesets/dnd5e/pluginApi'
import type { AccountSession } from '../lib/accountSession'

function campaignStatusLabel(campaign: AccountCampaign): string {
  if (campaign.latestRoom?.status === 'online') return '游戏进行中'
  if (campaign.latestRoom?.status === 'grace') return 'DM 重连中'
  if (campaign.latestRoom?.status === 'offline') return '上一房间已离线'
  if (campaign.roomCount > 0) return '可以继续开团'
  return '尚未开团'
}

export default function AccountCampaignsPage({
  account,
  roomSession,
}: {
  account: AccountSession | null
  roomSession: RoomSession | null
}) {
  const [campaigns, setCampaigns] = useState<AccountCampaign[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const recentRoom = getRecentRoomPlayerResumeIdentity()

  useEffect(() => {
    let disposed = false
    void (async () => {
      await Promise.resolve()
      if (disposed) return
      if (!account) {
        setCampaigns([])
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const loaded = await loadAccountCampaigns()
        if (!disposed) setCampaigns(loaded)
      } catch (cause) {
        if (!disposed) setError(accountApiErrorMessage(cause))
      } finally {
        if (!disposed) setLoading(false)
      }
    })()
    return () => {
      disposed = true
    }
  }, [account])

  const submitCampaign = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || busyId) return
    setBusyId('create')
    setError(null)
    try {
      const created = await createAccountCampaign({ name, description })
      setCampaigns((current) => [created, ...current])
      setName('')
      setDescription('')
      setCreating(false)
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    } finally {
      setBusyId(null)
    }
  }

  const setArchived = async (campaign: AccountCampaign, archived: boolean) => {
    setBusyId(campaign.campaignId)
    setError(null)
    try {
      const updated = await updateAccountCampaign(campaign.campaignId, { archived })
      setCampaigns((current) => current.map((item) =>
        item.campaignId === updated.campaignId ? updated : item))
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    } finally {
      setBusyId(null)
    }
  }

  const resumeRoom = async (campaign: AccountCampaign) => {
    if (!account) return
    const accountSession = account
    if (
      (campaign.latestRoom?.status === 'online' || campaign.latestRoom?.status === 'grace') &&
      !window.confirm('当前房间可能仍在另一台设备上运行。继续会让旧设备的 DM 凭证立即失效，是否接管？')
    ) return
    setBusyId(campaign.campaignId)
    setError(null)
    try {
      const connection = await resumeCampaignRoom({
        campaignId: campaign.campaignId,
        displayName: accountSession.displayName,
        activePlugins: activeDnd5eRulesPluginRequirements(),
      })
      saveRoomSession(connection.session)
      setRoomRulesSnapshot(connection.rules)
      window.location.assign(`/campaign/${encodeURIComponent(campaign.campaignId)}/overview`)
    } catch (cause) {
      setError(roomApiErrorMessage(cause))
      setBusyId(null)
    }
  }

  if (!account) {
    return (
      <div className="mx-auto grid min-h-[calc(100vh-12rem)] max-w-5xl items-center gap-8 lg:grid-cols-[1fr_0.9fr]">
        <section>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-arcane-400/20 bg-arcane-500/10 px-3 py-1.5 text-xs font-semibold text-arcane-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            账号绑定的战役、角色与扩展
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight text-slate-50 sm:text-5xl">
            登录星痕，<span className="text-gradient">继续你的冒险</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
            战役长期保存在账号中。每次开团会生成新的临时房间，但地图、角色、日志与共享资源会继续沿用。
          </p>
        </section>
        <AccountAuthPanel
          key={searchParams.get('auth') === 'register' ? 'register' : 'login'}
          account={account}
          initialMode={searchParams.get('auth') === 'register' ? 'register' : 'login'}
        />
      </div>
    )
  }

  const visibleCampaigns = campaigns.filter((campaign) => showArchived || !campaign.archived)
  const currentSessionCampaignId = roomSession?.campaignId ?? roomSession?.roomId
  const currentSessionOwned = campaigns.some((campaign) => campaign.campaignId === currentSessionCampaignId)

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="我的战役"
        description="战役归账号长期保存；房间只代表某一次在线游戏。同一战役结束房间后，可以再次开房继续。"
        actions={(
          <button
            type="button"
            onClick={() => setCreating((value) => !value)}
            className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-4 py-2.5 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            新建战役
          </button>
        )}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Link to="/app/rooms?mode=join" className="group">
          <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-cyan-400/30">
            <Users className="h-7 w-7 text-cyan-300" />
            <h2 className="mt-4 font-bold text-slate-100">加入游戏房间</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">输入六位房间码，以玩家或观战者身份进入当前场次。</p>
          </Card>
        </Link>
        <Link to="/app/extensions" className="group">
          <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-emerald-400/30">
            <Puzzle className="h-7 w-7 text-emerald-300" />
            <h2 className="mt-4 font-bold text-slate-100">我的扩展</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">管理账号规则包，并在每次开房时选择启用的精确版本。</p>
          </Card>
        </Link>
        <Card className="h-full border-arcane-400/15">
          <LibraryBig className="h-7 w-7 text-arcane-300" />
          <h2 className="mt-4 font-bold text-slate-100">长期战役资料</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">地图、角色、日志、时间、迷雾与共享资源不再随房间关闭而丢失。</p>
        </Card>
      </section>

      {creating && (
        <form onSubmit={submitCampaign} className="mt-7 rounded-2xl border border-arcane-400/20 bg-arcane-500/[0.06] p-5">
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr_auto] lg:items-end">
            <label>
              <span className="mb-2 block text-xs font-semibold text-slate-400">战役名称</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                required
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none focus:border-arcane-400/50"
                placeholder="例如：失落矿坑"
              />
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold text-slate-400">战役简介（可选）</span>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={800}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none focus:border-arcane-400/50"
                placeholder="记录冒险主题、队伍或当前章节"
              />
            </label>
            <button
              type="submit"
              disabled={busyId != null}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-arcane-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busyId === 'create' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              保存战役
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {roomSession && !currentSessionOwned && (
        <section className="mt-7 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-5">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">{roomSession.roomName}</h2>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  当前加入
                </span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-slate-400">
                  {roomSession.role === 'spectator' ? '观战' : roomSession.role === 'player' ? '玩家' : 'DM'}
                </span>
              </div>
              <p className="mt-2 font-mono text-xs text-slate-500">房间 {roomSession.roomId}</p>
            </div>
            <Link
              to={`/campaign/${encodeURIComponent(currentSessionCampaignId ?? roomSession.roomId)}/${roomSession.role === 'player' || roomSession.role === 'spectator' ? 'maps' : 'overview'}`}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              返回当前游戏
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
            <LibraryBig className="h-4 w-4" />
            我的战役
          </div>
          {campaigns.some((campaign) => campaign.archived) && (
            <button
              type="button"
              onClick={() => setShowArchived((value) => !value)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-200"
            >
              {showArchived ? '隐藏已收起战役' : '显示已收起战役'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 py-14 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            正在读取账号战役……
          </div>
        ) : visibleCampaigns.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleCampaigns.map((campaign) => {
              const currentRoom = roomSession?.campaignId === campaign.campaignId
              const campaignPath = currentRoom
                ? `/campaign/${encodeURIComponent(campaign.campaignId)}/${roomSession.role === 'player' || roomSession.role === 'spectator' ? 'maps' : 'overview'}`
                : null
              return (
                <article
                  key={campaign.campaignId}
                  data-testid={`account-campaign-${campaign.campaignId}`}
                  className={`rounded-2xl border p-5 ${
                    currentRoom
                      ? 'border-arcane-400/30 bg-gradient-to-br from-arcane-500/[0.1] to-cyan-500/[0.03]'
                      : 'border-white/10 bg-black/15'
                  } ${campaign.archived ? 'opacity-65' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-bold text-slate-100">{campaign.name}</h2>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          currentRoom
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'bg-white/5 text-slate-400'
                        }`}>
                          {currentRoom ? '当前房间' : campaignStatusLabel(campaign)}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">
                        {campaign.description || '尚未填写战役简介。'}
                      </p>
                      <p className="mt-3 text-xs text-slate-600">
                        已创建 {campaign.roomCount} 次游戏房间
                        {campaign.latestRoom ? ` · 最近房间 ${campaign.latestRoom.roomId}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      title={campaign.archived ? '恢复到战役列表' : '从列表收起（不会删除数据）'}
                      disabled={busyId != null || currentRoom}
                      onClick={() => void setArchived(campaign, !campaign.archived)}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-white/5 hover:text-slate-200 disabled:opacity-30"
                    >
                      {busyId === campaign.campaignId
                        ? <LoaderCircle className="h-4 w-4 animate-spin" />
                        : campaign.archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      {campaign.archived ? '恢复' : '收起'}
                    </button>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {campaignPath ? (
                      <Link
                        to={campaignPath}
                        data-testid="open-active-campaign"
                        className="inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-4 py-2.5 text-sm font-bold text-white"
                      >
                        打开战役工作台
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : campaign.latestRoom && campaign.latestRoom.status !== 'closed' ? (
                      <button
                        type="button"
                        disabled={busyId != null}
                        onClick={() => void resumeRoom(campaign)}
                        className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
                      >
                        {busyId === campaign.campaignId
                          ? <LoaderCircle className="h-4 w-4 animate-spin" />
                          : <RotateCcw className="h-4 w-4" />}
                        {campaign.latestRoom.status === 'online' || campaign.latestRoom.status === 'grace'
                          ? '接管当前 DM 房间'
                          : '恢复上次 DM 房间'}
                      </button>
                    ) : (
                      <Link
                        to={`/app/rooms?mode=create&campaign=${encodeURIComponent(campaign.campaignId)}`}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${
                          campaign.archived
                            ? 'pointer-events-none border border-white/10 text-slate-600'
                            : 'bg-arcane-500 text-white'
                        }`}
                      >
                        <DoorOpen className="h-4 w-4" />
                        {campaign.roomCount > 0 ? '创建下一场房间' : '开始第一场游戏'}
                      </Link>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        ) : recentRoom ? (
          <article className="rounded-2xl border border-white/10 bg-black/15 p-5">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div>
                <div className="flex items-center gap-2">
                  <Clock3 className="h-5 w-5 text-slate-500" />
                  <h2 className="font-bold text-slate-200">最近加入的旧版房间</h2>
                </div>
                <p className="mt-2 text-sm text-slate-400">{recentRoom.displayName} · 房间 {recentRoom.roomId}</p>
              </div>
              <Link
                to={`/app/rooms?mode=join&join=${encodeURIComponent(recentRoom.roomId)}`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200"
              >
                <LogIn className="h-4 w-4" />
                重新加入
              </Link>
            </div>
          </article>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center">
            <LibraryBig className="mx-auto h-9 w-9 text-slate-700" />
            <p className="mt-3 font-semibold text-slate-400">还没有战役</p>
            <p className="mt-1 text-sm text-slate-600">先建立一个长期战役档案，再为它创建游戏房间。</p>
          </div>
        )}
        {campaigns.length > 0 && (
          <p className="mt-4 text-xs leading-5 text-slate-600">
            “收起战役”只会把暂时不玩的战役隐藏起来，不会关闭仍在运行的房间，也不会删除地图、角色或记录；之后可随时恢复。
          </p>
        )}
      </section>
    </div>
  )
}
