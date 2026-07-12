import { ArrowUpCircle, Plus, Trash2, Sparkles } from 'lucide-react'
import { useCharacterStore } from '../../store/characters'
import {
  canUpgradeClassTrait,
  MAX_FEATURE_LEVEL,
  nextFeatureUpgradeCharacterLevel,
  pendingTraitChoices,
} from '../../lib/classFeatures'
import { formatFeatureDescription, getClassFeatureDef, usageLabel } from '../../lib/traitRegistry'
import type { ClassFeatureKey } from '../../types/character'
import { buildFeaturePresentation, type FeatureUiTone } from '../../lib/featureActivationRegistry'
import TraitChoicePanel from './TraitChoicePanel'
import FeatureAuxiliaryControls from './FeatureAuxiliaryControls'

const FEATURE_STATUS_COLORS = {
  amber: 'text-amber-200',
  sky: 'text-sky-300',
  rose: 'text-rose-300',
  cyan: 'text-cyan-300',
  lime: 'text-lime-300',
  emerald: 'text-emerald-300',
  teal: 'text-teal-300',
  orange: 'text-orange-300',
  fuchsia: 'text-fuchsia-200',
} as const

const FEATURE_BUTTON_COLORS: Record<FeatureUiTone, string> = {
  amber: 'bg-amber-500/25 text-amber-100 hover:bg-amber-500/35',
  sky: 'bg-sky-500/20 text-sky-100 hover:bg-sky-500/30',
  rose: 'bg-rose-500/20 text-rose-100 hover:bg-rose-500/30',
  fuchsia: 'bg-fuchsia-500/20 text-fuchsia-100 hover:bg-fuchsia-500/30',
}

export default function FeaturesTab({
  charId,
  isDM,
  battleMode = false,
  isPlayerTurn = false,
  onActivateFeature,
  allowUpgrade = true,
}: {
  charId: string
  isDM: boolean
  battleMode?: boolean
  isPlayerTurn?: boolean
  activeFeatureKey?: ClassFeatureKey | null
  onActivateFeature?: (key: ClassFeatureKey) => void | Promise<void>
  allowUpgrade?: boolean
}) {
  const c = useCharacterStore((s) => s.characters.find((x) => x.id === charId))
  const addTrait = useCharacterStore((s) => s.addTrait)
  const updateTrait = useCharacterStore((s) => s.updateTrait)
  const removeTrait = useCharacterStore((s) => s.removeTrait)
  const upgradeClassTrait = useCharacterStore((s) => s.upgradeClassTrait)
  const applyTraitChoice = useCharacterStore((s) => s.applyTraitChoice)

  if (!c) return null

  const classTraits = c.traits.filter((t) => t.featureKey)
  const customTraits = c.traits.filter((t) => !t.featureKey)
  const pendingChoices = pendingTraitChoices(c)
  const upgradePoints = c.featureUpgradePoints ?? 0
  const nextPointLevel = nextFeatureUpgradeCharacterLevel(c.level)

  return (
    <div className="space-y-5">
      {pendingChoices.map((group) => (
        <TraitChoicePanel
          key={group.id}
          group={group}
          onConfirm={(options) => applyTraitChoice(charId, group.id, options)}
        />
      ))}

      {classTraits.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-arcane-300" />
              职业特性
            </p>
            {upgradePoints > 0 && (
              <span className="rounded-lg bg-violet-500/20 px-3 py-1 text-sm font-bold tabular-nums text-violet-200">
                可用升级点 {upgradePoints}
              </span>
            )}
          </div>
          {upgradePoints === 0 && nextPointLevel != null && (
            <p className="mb-3 text-xs text-slate-500">
              角色升至 {nextPointLevel} 级可获得 1 个特性升级点（5 / 10 / 15 … 50 级各 1 点）
            </p>
          )}

          <div className="space-y-3">
            {classTraits.map((t) => {
              const canUpgrade = canUpgradeClassTrait(c, t)
              const def = t.featureKey ? getClassFeatureDef(t.featureKey) : undefined
              const usageSuffix = def ? usageLabel(def.usage) : t.maxUses > 0 ? '次/长休' : ''
              const displayDescription = def ? formatFeatureDescription(def, t.level) : t.description
              const presentation = buildFeaturePresentation(c, t)

              return (
                <div key={t.id} className="rounded-xl border border-emerald-500/25 bg-void-900/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-emerald-100">
                      {t.name}{' '}
                      <span className="text-base font-bold tabular-nums text-violet-300">LV{t.level}</span>
                    </h3>
                    {t.maxUses > 0 && usageSuffix && (
                      <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-sm font-bold tabular-nums text-emerald-200">
                        {t.uses} / {t.maxUses} {usageSuffix}
                      </span>
                    )}
                    {def?.usage === 'passive' && (
                      <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-slate-400">被动</span>
                    )}
                    {def?.usage === 'unlimited' && (
                      <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-slate-400">不限次数</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{displayDescription}</p>

                  {allowUpgrade && canUpgrade && (
                    <button
                      type="button"
                      onClick={() => upgradeClassTrait(charId, t.id)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500/20 px-3 py-2 text-sm font-semibold text-violet-100 transition-colors hover:bg-violet-500/30"
                    >
                      <ArrowUpCircle className="h-4 w-4" />
                      提升等级（消耗 1 升级点 → LV{t.level + 1}）
                    </button>
                  )}
                  {allowUpgrade && t.level >= MAX_FEATURE_LEVEL && (
                    <p className="mt-1.5 text-xs text-slate-500">该特性已达最高等级</p>
                  )}

                  {presentation.statuses.map((status) => (
                    <p key={`${status.tone}:${status.text}`} className={`mt-2 text-xs font-semibold ${FEATURE_STATUS_COLORS[status.tone]}`}>
                      {status.text}
                    </p>
                  ))}
                  {presentation.auxiliary === 'wilderness-checks' && (
                    <FeatureAuxiliaryControls
                      type={presentation.auxiliary}
                      charId={charId}
                      battleMode={battleMode}
                      onActivateFeature={onActivateFeature}
                    />
                  )}
                  {presentation.activation && t.featureKey && battleMode && isPlayerTurn && (
                    <button
                      type="button"
                      disabled={presentation.activation.disabled}
                      onClick={() => {
                        void onActivateFeature?.(t.featureKey!)
                      }}
                      className={[
                        'mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                        presentation.activation.disabled
                          ? 'cursor-not-allowed bg-white/5 text-slate-600'
                          : FEATURE_BUTTON_COLORS[presentation.activation.tone],
                      ].join(' ')}
                    >
                      {presentation.activation.label}
                    </button>
                  )}

                  {isDM && t.maxUses > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-slate-500">DM 调整剩余次数</span>
                      <input
                        type="number"
                        min={0}
                        max={t.maxUses}
                        value={t.uses}
                        onChange={(e) =>
                          updateTrait(charId, t.id, {
                            uses: Math.min(t.maxUses, Math.max(0, Number(e.target.value) || 0)),
                          })
                        }
                        className="w-16 rounded-md border border-white/10 bg-void-900/60 px-2 py-1 text-center text-sm text-slate-200 outline-none focus:border-arcane-500"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="glass rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">其他特性</p>
          {isDM && (
            <button
              onClick={() => addTrait(charId)}
              className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
            >
              <Plus className="h-4 w-4" />
              添加特性
            </button>
          )}
        </div>

        {customTraits.length === 0 ? (
          <p className="py-3 text-center text-sm text-slate-500">
            {isDM ? '暂无自定义特性。' : '暂无其他特性。'}
          </p>
        ) : isDM ? (
          <div className="space-y-2">
            {customTraits.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-1 gap-2 rounded-lg bg-void-900/40 p-2 lg:grid-cols-[1.5fr_70px_90px_3fr_36px] lg:items-center"
              >
                <input
                  value={t.name}
                  onChange={(e) => updateTrait(charId, t.id, { name: e.target.value })}
                  className="rounded-md border border-white/10 bg-void-900/60 px-2 py-1 text-sm text-slate-200 outline-none focus:border-arcane-500"
                />
                <input
                  type="number"
                  value={t.level}
                  onChange={(e) => updateTrait(charId, t.id, { level: Number(e.target.value) || 0 })}
                  className="rounded-md border border-white/10 bg-void-900/60 px-2 py-1 text-center text-sm text-slate-200 outline-none focus:border-arcane-500"
                />
                <div className="flex items-center justify-center gap-1">
                  <input
                    type="number"
                    value={t.uses}
                    onChange={(e) => updateTrait(charId, t.id, { uses: Number(e.target.value) || 0 })}
                    className="w-10 rounded-md border border-white/10 bg-void-900/60 px-1 py-1 text-center text-sm text-slate-200 outline-none focus:border-arcane-500"
                  />
                  <span className="text-xs text-slate-500">/</span>
                  <input
                    type="number"
                    value={t.maxUses}
                    onChange={(e) => updateTrait(charId, t.id, { maxUses: Number(e.target.value) || 0 })}
                    className="w-10 rounded-md border border-white/10 bg-void-900/60 px-1 py-1 text-center text-sm text-slate-200 outline-none focus:border-arcane-500"
                  />
                </div>
                <input
                  value={t.description}
                  onChange={(e) => updateTrait(charId, t.id, { description: e.target.value })}
                  className="rounded-md border border-white/10 bg-void-900/60 px-2 py-1 text-sm text-slate-300 outline-none focus:border-arcane-500"
                />
                <button
                  onClick={() => removeTrait(charId, t.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-rose-500/15 hover:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {customTraits.map((t) => (
              <div key={t.id} className="rounded-lg bg-void-900/40 px-3 py-2">
                <p className="font-medium text-slate-200">{t.name}</p>
                <p className="mt-1 text-sm text-slate-400">{t.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
