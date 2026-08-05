import { useState, useSyncExternalStore } from 'react'
import { Moon, Palette, Shield, SlidersHorizontal, Sun } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import CampaignSafetyPanel from '../components/CampaignSafetyPanel'
import RoomManagementPanel from '../components/RoomManagementPanel'
import { getAppTheme, setAppTheme, subscribeAppTheme } from '../lib/appTheme'
import { getRoomSession } from '../lib/roomSession'
import { roomApiErrorMessage, updateRoomRules } from '../lib/roomApi'
import {
  getRoomRulesSnapshot,
  setRoomRulesSnapshot,
  subscribeRoomRules,
} from '../lib/roomRulesState'

type SettingsSection = 'appearance' | 'gameplay' | 'room'
type HouseRuleKey =
  | 'combatBannersEnabled'
  | 'spellAnimationsEnabled'
  | 'spellcastingPrerequisitesEnabled'
  | 'encumbranceEnabled'

const gameplayOptions: ReadonlyArray<{
  key: HouseRuleKey
  label: string
  description: string
}> = [
  {
    key: 'combatBannersEnabled',
    label: '战斗横幅',
    description: '显示回合开始、攻击、法术与连续击败横幅。关闭后只保留战斗结算与日志。',
  },
  {
    key: 'spellAnimationsEnabled',
    label: '法术动画',
    description: '播放投射物、命中特效、范围预览与持续区域动画；不会改变 Headless 结算。',
  },
  {
    key: 'spellcastingPrerequisitesEnabled',
    label: '施法条件校验',
    description: '校验语言、姿势、材料、变身与护甲熟练限制。法术位、行动、距离和目标始终校验。',
  },
  {
    key: 'encumbranceEnabled',
    label: '负重计算',
    description: '计算物品与钱币重量并显示负重阈值；关闭后不再展示负重信息。',
  },
]

export default function CampaignSettingsPage() {
  const [section, setSection] = useState<SettingsSection>('appearance')
  const [roomSession] = useState(() => getRoomSession())
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const appTheme = useSyncExternalStore(subscribeAppTheme, getAppTheme, getAppTheme)
  const roomRules = useSyncExternalStore(
    subscribeRoomRules,
    getRoomRulesSnapshot,
    getRoomRulesSnapshot,
  )
  const canManageRoom = roomSession?.role === 'dm'

  const updateHouseRule = async (key: HouseRuleKey, enabled: boolean) => {
    if (!roomSession || !canManageRoom || !roomRules) return
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      const next = await updateRoomRules(
        roomSession,
        roomRules.requiredPlugins,
        { ...roomRules.houseRules, [key]: enabled },
      )
      setRoomRulesSnapshot(next)
      setNotice('房间设置已更新，并同步给当前房间成员。')
    } catch (reason) {
      setError(roomApiErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  const sections = [
    { id: 'appearance' as const, label: '界面外观', icon: Palette },
    { id: 'gameplay' as const, label: '游戏与表现', icon: SlidersHorizontal },
    ...(canManageRoom ? [{ id: 'room' as const, label: '房间与恢复', icon: Shield }] : []),
  ]

  return (
    <div className="mx-auto max-w-5xl" data-testid="campaign-settings-page">
      <PageHeader
        title="设置"
        description="管理当前设备的界面外观，以及当前战役的表现、规则、房间权限和数据恢复。"
      />

      <nav
        className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-white/8 bg-black/15 p-2"
        aria-label="设置分类"
      >
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              section === id
                ? 'bg-arcane-500/15 text-arcane-200 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.25)]'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {section === 'appearance' && (
        <section className="rounded-2xl border border-white/8 bg-black/15 p-5" data-testid="appearance-settings">
          <h2 className="font-semibold text-slate-100">主题</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            主题只保存在当前浏览器，不会改变房间规则或其他玩家的界面。
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {([
              {
                id: 'dark',
                label: '深色主题',
                description: '黑底白字，适合暗光环境和地图战斗。',
                icon: Moon,
                previewClass: 'border-white/10 bg-[#080914] text-white',
              },
              {
                id: 'light',
                label: '浅色主题',
                description: '白底深色文字，适合明亮环境和长时间阅读。',
                icon: Sun,
                previewClass: 'border-slate-300 bg-white text-slate-950',
              },
            ] as const).map((option) => {
              const selected = appTheme === option.id
              const Icon = option.icon
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setAppTheme(option.id)}
                  className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${
                    selected
                      ? 'border-arcane-400/60 bg-arcane-500/10 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.2)]'
                      : 'border-white/10 bg-black/10 hover:border-arcane-400/30'
                  }`}
                >
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border ${option.previewClass}`}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block font-semibold text-slate-100">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {section === 'gameplay' && (
        <section className="rounded-2xl border border-white/8 bg-black/15 p-5" data-testid="campaign-gameplay-settings">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-100">游戏规则与战斗表现</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                由 DM 统一设置并同步给房间成员；玩家可以查看当前配置。
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
              {canManageRoom ? 'DM 可编辑' : '只读'}
            </span>
          </div>

          {!roomSession || !roomRules ? (
            <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-100/80">
              尚未连接到共享房间，当前没有可同步的战役设置。
            </p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {gameplayOptions.map((option) => {
                const checked = roomRules.houseRules?.[option.key] !== false
                return (
                  <label
                    key={option.key}
                    className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                      checked
                        ? 'border-violet-300/20 bg-violet-400/[0.07]'
                        : 'border-white/8 bg-black/15'
                    }`}
                  >
                    <input
                      type="checkbox"
                      data-testid={`room-rule-${option.key}`}
                      checked={checked}
                      disabled={busy || !canManageRoom}
                      onChange={(event) => void updateHouseRule(option.key, event.currentTarget.checked)}
                      className="mt-1 h-4 w-4 shrink-0 accent-violet-500 disabled:cursor-not-allowed"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-100">{option.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          )}

          {notice && <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-100">{notice}</p>}
          {error && <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-100">{error}</p>}
        </section>
      )}

      {section === 'room' && canManageRoom && (
        <section data-testid="campaign-room-settings">
          <RoomManagementPanel />
          <CampaignSafetyPanel />
        </section>
      )}
    </div>
  )
}
