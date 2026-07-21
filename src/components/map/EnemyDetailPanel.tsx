import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { ABILITIES, abilityMod, formatMod } from '../../lib/dnd'
import { getEnemyTemplate, type EnemyTemplate } from '../../lib/enemyPool'
import { getEnemyStatBlock, type EnemyStatBlock } from '../../lib/enemyStatBlocks'
import {
  getEnemyDerivedCombatStats,
  getEnemyEquipmentSlots,
} from '../../lib/enemyCombatStats'
import {
  CREATURE_SIZES,
  CREATURE_TYPES,
  creatureSizeToTokenSize,
  inferCreatureSizeFromTags,
  inferCreatureTypesFromTags,
  type CreatureSize,
  type CreatureType,
} from '../../lib/monsterTypes'
import { X, Shield, Footprints, Sparkles, Swords, Backpack } from 'lucide-react'
import Dnd5eConditionEditor, { Dnd5eConditionTags } from './Dnd5eConditionEditor'
import type { Dnd5eActiveEffectInstance } from '../../rulesets/dnd5e/activeEffects'

function resolveEnemyDetail(token: Token): {
  template: EnemyTemplate | undefined
  stats: EnemyStatBlock | undefined
} {
  const template = token.poolId ? getEnemyTemplate(token.poolId) : undefined
  const stats = token.poolId ? getEnemyStatBlock(token.poolId) : undefined
  return { template, stats }
}

export default function EnemyDetailPanel({
  token,
  onClose,
  isDM = false,
  mapId,
  characters = [],
  updateToken,
  updateChar,
  removeToken,
  canManageConditions = false,
  onConditionsChange,
  conditionSourceOptions = [],
}: {
  token: Token
  onClose: () => void
  closable?: boolean
  isDM?: boolean
  mapId?: string
  characters?: Character[]
  updateToken?: (mapId: string, tokenId: string, patch: Partial<Token>) => void
  updateChar?: (charId: string, patch: Partial<Character>) => void
  removeToken?: (mapId: string, tokenId: string) => void
  canManageConditions?: boolean
  onConditionsChange?: (conditions: string[], activeEffects: Dnd5eActiveEffectInstance[]) => void
  conditionSourceOptions?: readonly { id: string; label: string }[]
}) {
  const { template, stats } = resolveEnemyDetail(token)
  const derived = token.poolId ? getEnemyDerivedCombatStats(token.poolId) : undefined
  const isSrd5eMonster = stats?.source === 'SRD 5.1'
  const maxHp = token.maxHp ?? derived?.maxHp ?? template?.maxHp ?? 20
  const curHp = token.hp ?? maxHp
  const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, (curHp / maxHp) * 100)) : 0

  const name = token.label || template?.name || '敌人'
  const emoji = token.emoji || template?.emoji || '👹'
  const color = token.color || template?.color || '#f87171'
  const templateTags = template?.tags ?? []
  const creatureTypes = token.creatureTypes?.length
    ? token.creatureTypes
    : template?.creatureTypes ?? inferCreatureTypesFromTags(templateTags)
  const creatureSize = token.creatureSize ?? template?.creatureSize ?? inferCreatureSizeFromTags(templateTags)
  const tags = [
    ...creatureTypes,
    creatureSize,
    ...templateTags.filter((tag) => !creatureTypes.includes(tag as CreatureType) && tag !== creatureSize),
  ]
  const description = template?.description
  const linked = token.characterId ? characters.find((c) => c.id === token.characterId) : undefined
  const canEdit = isDM && !!mapId && !!updateToken
  const standardConditions = linked?.conditions ?? token.dnd5eCombatState?.conditions ?? []

  return (
    <div className="glass absolute bottom-3 right-3 z-40 flex max-h-[min(720px,calc(100%-6rem))] w-[min(340px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
      <div className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 bg-void-900 text-2xl"
          style={{ borderColor: color }}
        >
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-100">{name}</h2>
            {stats && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                CR {stats.cr}
              </span>
            )}
          </div>
          {tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {(
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-200"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {canEdit && (
          <section className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="grid grid-cols-[auto,1fr] items-center gap-2">
              <span className="text-xs text-slate-500">名称</span>
              <input
                value={token.label}
                onChange={(e) => updateToken!(mapId!, token.id, { label: e.target.value })}
                className="rounded-lg border border-white/10 bg-void-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-arcane-500"
              />
              <span className="text-xs text-slate-500">体型</span>
              <select
                value={creatureSize}
                onChange={(e) => {
                  const next = e.target.value as CreatureSize
                  updateToken!(mapId!, token.id, {
                    creatureSize: next,
                    size: creatureSizeToTokenSize(next),
                  })
                }}
                className="rounded-lg border border-white/10 bg-void-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-arcane-500"
              >
                {CREATURE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500">种类</span>
              <div className="flex flex-wrap gap-1">
                {CREATURE_TYPES.map((type) => {
                  const checked = creatureTypes.includes(type)
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const next = checked
                          ? creatureTypes.filter((item) => item !== type)
                          : [...creatureTypes, type]
                        updateToken!(mapId!, token.id, { creatureTypes: next })
                      }}
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        checked
                          ? 'bg-arcane-500/30 text-arcane-100'
                          : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300'
                      }`}
                    >
                      {type}
                    </button>
                  )
                })}
              </div>
              <span className="text-xs text-slate-500">HP</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={linked?.currentHp ?? curHp}
                  onChange={(e) => {
                    const nextHp = Math.max(0, Number(e.target.value) || 0)
                    if (linked && updateChar) {
                      updateChar(linked.id, { currentHp: Math.min(linked.maxHp, nextHp) })
                      updateToken!(mapId!, token.id, { hp: Math.min(linked.maxHp, nextHp), maxHp: linked.maxHp })
                    } else {
                      updateToken!(mapId!, token.id, { hp: Math.min(maxHp, nextHp) })
                    }
                  }}
                  className="w-16 rounded border border-white/10 bg-void-950/70 px-1 py-0.5 text-center text-xs text-slate-100 outline-none focus:border-arcane-500"
                />
                <span className="text-xs text-slate-500">/</span>
                <input
                  type="number"
                  min={1}
                  value={linked?.maxHp ?? maxHp}
                  onChange={(e) => {
                    const nextMax = Math.max(1, Number(e.target.value) || 1)
                    if (linked && updateChar) {
                      updateChar(linked.id, {
                        maxHp: nextMax,
                        currentHp: Math.min(linked.currentHp, nextMax),
                        ...(linked.rulesetId === 'dnd5e-2014-srd-5.1'
                          ? { hitPointMaximumMode: 'manual' as const, hitPointRolls: undefined }
                          : {}),
                      })
                      updateToken!(mapId!, token.id, { hp: Math.min(linked.currentHp, nextMax), maxHp: nextMax })
                    } else {
                      updateToken!(mapId!, token.id, { maxHp: nextMax, hp: Math.min(curHp, nextMax) })
                    }
                  }}
                  className="w-16 rounded border border-white/10 bg-void-950/70 px-1 py-0.5 text-center text-xs text-slate-100 outline-none focus:border-arcane-500"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={token.showHpOnToken !== false}
                  onChange={(e) => updateToken!(mapId!, token.id, { showHpOnToken: e.target.checked })}
                  className="accent-arcane-500"
                />
                玩家可见血条
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={token.showDetailOnToken !== false}
                  onChange={(e) => updateToken!(mapId!, token.id, { showDetailOnToken: e.target.checked })}
                  className="accent-arcane-500"
                />
                玩家可见详情
              </label>
              {removeToken && (
                <button
                  type="button"
                  onClick={() => {
                    removeToken(mapId!, token.id)
                    onClose()
                  }}
                  className="rounded-lg bg-rose-500/15 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/25"
                >
                  删除
                </button>
              )}
            </div>
          </section>
        )}
        {canManageConditions && onConditionsChange ? (
          <div className="mb-4">
            <Dnd5eConditionEditor
              conditions={standardConditions}
              activeEffects={linked?.dnd5eCombatState?.activeEffects ?? token.dnd5eCombatState?.activeEffects}
              targetId={token.id}
              sourceOptions={conditionSourceOptions}
              conditionImmunities={stats?.conditionImmunities}
              onChange={onConditionsChange}
            />
          </div>
        ) : standardConditions.length > 0 ? (
          <section className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">D&D 5e 状态</h3>
            <Dnd5eConditionTags conditions={standardConditions} />
          </section>
        ) : null}
        {/* 生命值 */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-rose-300">生命值</span>
            <span className="tabular-nums text-slate-300">
              {curHp} / {maxHp}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-void-900/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all"
              style={{ width: `${hpPct}%` }}
            />
          </div>
        </div>

        {description && (
          <p className="mb-4 text-sm leading-relaxed text-slate-400">{description}</p>
        )}

        {!stats ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-3 py-6 text-center">
            <p className="text-sm text-slate-400">该敌人尚未关联怪物种类</p>
            <p className="mt-1 text-xs text-slate-500">DM 可通过「添加怪物」为其指定种类</p>
          </div>
        ) : (
          <>
            {/* 基础数据 */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                <Shield className="h-4 w-4 text-sky-400" />
                <div>
                  <p className="text-[10px] text-slate-500">AC</p>
                  <p className="text-sm font-semibold text-slate-100">{isSrd5eMonster ? stats.ac : derived?.ac ?? stats.ac}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                <Footprints className="h-4 w-4 text-emerald-400" />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500">速度</p>
                  <p className="truncate text-sm font-semibold text-slate-100">{stats.speed}</p>
                </div>
              </div>
            </div>

            {isSrd5eMonster && (
              <section className="mb-4 space-y-1.5 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] px-3 py-2 text-xs text-slate-300">
                {stats.hitDice && <p><span className="text-slate-500">生命骰 · </span>{stats.hitDice}</p>}
                {stats.alignment && <p><span className="text-slate-500">阵营 · </span>{stats.alignment}</p>}
                <p><span className="text-slate-500">来源 · </span>{stats.source}{stats.sourcePage ? `，第 ${stats.sourcePage} 页` : ''}</p>
                {stats.damageVulnerabilities?.length ? <p><span className="text-slate-500">伤害易伤 · </span>{stats.damageVulnerabilities.join('、')}</p> : null}
                {stats.damageResistances?.length ? <p><span className="text-slate-500">伤害抗性 · </span>{stats.damageResistances.join('、')}</p> : null}
                {stats.damageImmunities?.length ? <p><span className="text-slate-500">伤害免疫 · </span>{stats.damageImmunities.join('、')}</p> : null}
                {stats.conditionImmunities?.length ? <p><span className="text-slate-500">状态免疫 · </span>{stats.conditionImmunities.join('、')}</p> : null}
              </section>
            )}

            {/* 主攻击命中 + 伤害：对所有怪物渲染（含 ogre/owlbear 等无装备怪）。 */}
            {derived?.damageDice && (
              <section className="mb-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Swords className="h-3.5 w-3.5" />
                  主攻击
                </h3>
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2">
                  {derived.attackName && (
                    <span className="text-sm font-medium text-rose-200">{derived.attackName}</span>
                  )}
                  {derived.toHit != null && (
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-xs tabular-nums text-slate-200">
                      命中 {derived.toHit >= 0 ? `+${derived.toHit}` : derived.toHit}
                    </span>
                  )}
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-xs tabular-nums text-slate-200">
                    伤害 {derived.damageDice}
                  </span>
                </div>
              </section>
            )}

            {token.poolId && getEnemyEquipmentSlots(token.poolId).some((s) => s.name) && (
              <section className="mb-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Backpack className="h-3.5 w-3.5" />
                  装备
                </h3>
                <ul className="space-y-1.5">
                  {getEnemyEquipmentSlots(token.poolId)
                    .filter((s) => s.name)
                    .map((s) => (
                      <li key={s.slot} className="rounded-xl bg-amber-500/10 px-3 py-2">
                        <p className="text-[10px] text-slate-500">{s.label}</p>
                        <p className="text-sm font-medium text-amber-100">{s.name}</p>
                        {s.stats ? <p className="mt-0.5 text-[11px] text-slate-500">{s.stats}</p> : null}
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {/* 六维属性 */}
            <section className="mb-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">属性</h3>
              <div className="grid grid-cols-3 gap-2">
                {ABILITIES.map(({ key, label }) => {
                  const score = stats.abilities[key]
                  const mod = abilityMod(score)
                  return (
                    <div
                      key={key}
                      className="flex flex-col items-center rounded-xl border border-white/5 bg-void-900/40 px-2 py-2"
                    >
                      <span className="text-[10px] font-medium text-slate-500">{label}</span>
                      <span className="text-lg font-bold text-arcane-200">{formatMod(mod)}</span>
                      <span className="text-[10px] tabular-nums text-slate-500">{score}</span>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* 技能 / 感官 / 语言 */}
            {(stats.skills?.length || stats.senses || stats.languages) && (
              <section className="mb-4 space-y-1.5 text-xs text-slate-400">
                {stats.skills?.map((s) => (
                  <p key={s.name}>
                    <span className="text-slate-500">技能 · </span>
                    {s.name} {s.bonus}
                  </p>
                ))}
                {stats.senses && (
                  <p>
                    <span className="text-slate-500">感官 · </span>
                    {stats.senses}
                  </p>
                )}
                {stats.languages && (
                  <p>
                    <span className="text-slate-500">语言 · </span>
                    {stats.languages}
                  </p>
                )}
              </section>
            )}

            {/* 特性 */}
            {stats.traits.length > 0 && (
              <section className="mb-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Sparkles className="h-3.5 w-3.5" />
                  特性
                </h3>
                <ul className="space-y-2">
                  {stats.traits.map((t) => (
                    <li key={t.name} className="rounded-xl bg-violet-500/10 px-3 py-2">
                      <p className="text-sm font-medium text-violet-200">{t.name}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{t.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 动作 */}
            {stats.actions.length > 0 && (
              <section className="mb-2">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Swords className="h-3.5 w-3.5" />
                  动作
                </h3>
                <ul className="space-y-2">
                  {stats.actions.map((a) => (
                    <li key={a.name} className="rounded-xl bg-rose-500/10 px-3 py-2">
                      <p className="text-sm font-medium text-rose-200">{a.name}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{a.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

      </div>
    </div>
  )
}
