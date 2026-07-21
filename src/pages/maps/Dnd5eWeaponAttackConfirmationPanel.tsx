import { X } from 'lucide-react'
import type {
  Dnd5eAttackCoverOverride,
  Dnd5eWeaponAttackOptions,
} from '../../lib/sharedCombatTypes'
import { DND5E_COVER_LABELS } from './dnd5eCoverPresentation'

export interface Dnd5eWeaponAttackConfirmation {
  actorCharacterId: string
  actorTokenId: string
  actorName: string
  targetTokenId: string
  targetName: string
  weaponName: string
  options?: Dnd5eWeaponAttackOptions
  automaticCover: Dnd5eAttackCoverOverride
  automaticArmorClass: number
  baseArmorClass: number
  sourceLabel?: string
  selectedCover: 'auto' | Dnd5eAttackCoverOverride
  /** Present only on the DM host while a submitted player action is transaction-locked. */
  authorityActionId?: string
}

export default function Dnd5eWeaponAttackConfirmationPanel(props: {
  confirmation: Dnd5eWeaponAttackConfirmation
  previewCover: Dnd5eAttackCoverOverride
  previewArmorClass: number
  isDm: boolean
  onDismiss: () => void
  onCoverChange: (cover: 'auto' | Dnd5eAttackCoverOverride) => void
  onConfirm: () => void
}) {
  const { confirmation, previewCover, previewArmorClass } = props
  return (
    <div
      data-testid="dnd5e-cover-preview"
      className="absolute inset-0 z-[80] flex items-center justify-center bg-void-950/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onDismiss()
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-violet-300/25 bg-void-950/95 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">攻击前判定</p>
            <h2 className="mt-1 text-lg font-bold text-slate-100">掩护预览</h2>
          </div>
          <button
            type="button"
            onClick={props.onDismiss}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-100"
            aria-label={confirmation.authorityActionId ? '采用自动掩护判定' : '取消攻击'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">
          <p className="font-semibold text-slate-100">
            {confirmation.actorName}<span className="px-2 text-slate-500">→</span>{confirmation.targetName}
          </p>
          <p className="mt-1 text-xs text-slate-400">武器：{confirmation.weaponName}</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] text-slate-500">自动判定</p>
            <p className="mt-1 text-sm font-semibold text-violet-100">{DND5E_COVER_LABELS[confirmation.automaticCover]}</p>
            {confirmation.sourceLabel ? <p className="mt-1 text-xs text-slate-400">来源：{confirmation.sourceLabel}</p> : null}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] text-slate-500">本次攻击目标 AC</p>
            <p className="mt-1 text-lg font-bold text-amber-200">{previewCover === 'total' ? '无法攻击' : previewArmorClass}</p>
            <p className="mt-1 text-xs text-slate-500">无掩护时 AC {confirmation.baseArmorClass}</p>
          </div>
        </div>

        {props.isDm ? (
          <label className="mt-4 block text-xs font-semibold text-slate-300">
            DM 本次攻击覆盖
            <select
              data-testid="dnd5e-cover-override"
              value={confirmation.selectedCover}
              onChange={(event) => props.onCoverChange(event.target.value as 'auto' | Dnd5eAttackCoverOverride)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/50"
            >
              <option value="auto">采用自动判定</option>
              <option value="none">无掩护</option>
              <option value="half">半身掩护（+2 AC）</option>
              <option value="three-quarters">四分之三掩护（+5 AC）</option>
              <option value="total">全身掩护（无法直接攻击）</option>
            </select>
            <span className="mt-1.5 block font-normal text-slate-500">
              覆盖只进入这一笔攻击事务，不会修改地图上的墙、门、窗或障碍物。
            </span>
          </label>
        ) : (
          <p className="mt-4 rounded-lg bg-violet-500/10 px-3 py-2 text-xs text-violet-100">
            掩护由地图与 Token 位置自动计算；如需调整，请由 DM 对本次攻击裁定。
          </p>
        )}

        {confirmation.selectedCover !== 'auto' ? (
          <p className="mt-3 text-xs font-medium text-amber-200">本次采用 DM 裁定：{DND5E_COVER_LABELS[previewCover]}</p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={props.onDismiss} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">
            {confirmation.authorityActionId ? '采用自动判定' : '取消'}
          </button>
          <button
            type="button"
            data-testid="dnd5e-cover-confirm"
            disabled={props.isDm && previewCover === 'total'}
            onClick={props.onConfirm}
            className="rounded-xl bg-violet-500/25 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/35 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {confirmation.authorityActionId ? '应用并继续结算' : !props.isDm && previewCover === 'total' ? '请求 DM 裁定' : '确认攻击'}
          </button>
        </div>
      </div>
    </div>
  )
}
