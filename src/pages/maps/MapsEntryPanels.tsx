import type { ReactNode } from 'react'
import { Crown, Map as MapIcon, Upload, User } from 'lucide-react'
import EmptyState from '../../components/EmptyState'
import type { Mode } from '../../lib/sharedCombatTypes'

export interface MapsModeOption {
  mode: Mode
  title: string
  description: string
}

const MAPS_MODE_OPTIONS: readonly MapsModeOption[] = [
  { mode: 'dm', title: 'DM 界面', description: '管理地图、怪物详情、状态、血量、网格和障碍物。' },
  { mode: 'player', title: '玩家界面', description: '只显示玩家操作、可见角色、战斗 Log 和可见怪物信息。' },
]

export function MapsModeToggle(props: {
  mode: Mode
  onChooseMode: (mode: Mode) => void
}) {
  return (
    <div className="flex items-center rounded-lg bg-void-900/60 p-0.5">
      <button
        type="button"
        onClick={() => props.onChooseMode('player')}
        className={[
          'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
          props.mode === 'player' ? 'bg-arcane-500/30 text-arcane-100' : 'text-slate-400 hover:text-slate-200',
        ].join(' ')}
      >
        <User className="h-3.5 w-3.5" />
        玩家
      </button>
      <button
        type="button"
        onClick={() => props.onChooseMode('dm')}
        className={[
          'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
          props.mode === 'dm' ? 'bg-ember-500/30 text-ember-400' : 'text-slate-400 hover:text-slate-200',
        ].join(' ')}
      >
        <Crown className="h-3.5 w-3.5" />
        DM
      </button>
    </div>
  )
}

export function MapsModeSelectionPanel(props: { onChooseMode: (mode: Mode) => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-void-950 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-void-900/80 p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-arcane-300">Stars Battle Map</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-100">选择进入模式</h1>
        <p className="mt-2 text-sm text-slate-400">
          DM 端负责地图、怪物、状态、血量和障碍物；玩家端只显示玩家可见的战斗信息和操作。
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {MAPS_MODE_OPTIONS.map((option) => {
            const Icon = option.mode === 'dm' ? Crown : User
            const className = option.mode === 'dm'
              ? 'rounded-xl border border-ember-400/30 bg-ember-500/15 px-4 py-5 text-left hover:bg-ember-500/25'
              : 'rounded-xl border border-arcane-400/30 bg-arcane-500/15 px-4 py-5 text-left hover:bg-arcane-500/25'
            return (
              <button key={option.mode} type="button" onClick={() => props.onChooseMode(option.mode)} className={className}>
                <Icon className={`mb-3 h-6 w-6 ${option.mode === 'dm' ? 'text-ember-300' : 'text-arcane-200'}`} />
                <p className={`font-bold ${option.mode === 'dm' ? 'text-ember-100' : 'text-arcane-100'}`}>{option.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{option.description}</p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function MapsEmptyMapPanel(props: {
  modeToggle?: ReactNode
  isDm: boolean
  onUpload: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      {props.modeToggle && <div className="mb-4">{props.modeToggle}</div>}
      <div className="flex flex-1 items-center">
        <div className="w-full">
          <EmptyState
            icon={MapIcon}
            title="还没有地图"
            description="上传一张图片作为战斗地图，之后可以叠加网格、放置 token、开始战斗。"
            hint="支持 PNG / JPG · 图片本地存储，刷新不丢失"
            action={props.isDm ? (
              <button
                type="button"
                onClick={props.onUpload}
                className="flex items-center gap-2 rounded-xl bg-arcane-500/20 px-4 py-2 text-sm font-semibold text-arcane-200 transition-colors hover:bg-arcane-500/30"
              >
                <Upload className="h-4 w-4" />
                选择图片上传
              </button>
            ) : undefined}
          />
        </div>
      </div>
    </div>
  )
}
