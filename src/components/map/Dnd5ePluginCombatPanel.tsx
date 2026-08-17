import { useState, useSyncExternalStore } from 'react'
import { PlugZap } from 'lucide-react'
import { DND_FEET_PER_CELL, tokenFootprintDistanceCells } from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type {
  Dnd5ePluginActionPayload,
  Dnd5eTurnEconomyCounts,
} from '../../lib/sharedCombatTypes'
import {
  dnd5ePluginFeatureAvailableForCharacter,
  dnd5ePluginFeatureDefinition,
  dnd5eCharacterHasPluginFeature,
  dnd5eDeclarativeAttackIntentsForCharacter,
  dnd5eDeclarativeCombatManeuverDefinition,
  dnd5eUtilityProjectionTargetDistanceFeet,
  registeredDnd5ePluginFeatures,
  dnd5eRulesPluginRegistrySnapshot,
  subscribeDnd5eRulesPluginRegistry,
} from '../../rulesets/dnd5e'
import type { Dnd5ePluginTargeting } from '../../rulesets/dnd5e'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  getRoomRulesSnapshot,
  roomAllowsPlugin,
  subscribeRoomRules,
} from '../../lib/roomRulesState'
import { getRoomSession } from '../../lib/roomSession'

function economyAvailable(
  economy: 'action' | 'bonusAction' | 'reaction' | 'none',
  turn: Dnd5eTurnEconomyCounts,
): boolean {
  if (economy === 'none') return true
  return turn[economy].current > 0
}

export default function Dnd5ePluginCombatPanel({
  character,
  map,
  actorToken,
  canAct,
  pending,
  turnEconomy,
  armedAttackIntentFeatureIds,
  onAction,
  onBeginAreaTargeting,
  onToggleAttackIntent,
}: {
  character: Character
  map: BattleMap
  actorToken: Token
  canAct: boolean
  pending: boolean
  turnEconomy: Dnd5eTurnEconomyCounts
  armedAttackIntentFeatureIds: ReadonlySet<string>
  onAction: (request: {
    targetTokenId?: string
    targetTokenIds?: string[]
    payload: Dnd5ePluginActionPayload
  }) => void
  onBeginAreaTargeting: (request: {
    featureId: string
    featureName: string
    targeting: Extract<Dnd5ePluginTargeting, { kind: 'area' }>
  }) => void
  onToggleAttackIntent: (featureId: string) => void
}) {
  const pluginRevision = useSyncExternalStore(
    subscribeDnd5eRulesPluginRegistry,
    dnd5eRulesPluginRegistrySnapshot,
    dnd5eRulesPluginRegistrySnapshot,
  )
  const [targetsByFeature, setTargetsByFeature] = useState<Record<string, string>>({})
  const [multipleTargetsByFeature, setMultipleTargetsByFeature] = useState<Record<string, string[]>>({})
  const [secondaryTargetsByFeature, setSecondaryTargetsByFeature] = useState<Record<string, string>>({})
  const [activityChoicesByFeature, setActivityChoicesByFeature] = useState<Record<string, Record<string, string>>>({})
  const [modifierByFeature, setModifierByFeature] = useState<Record<string, string>>({})
  const roomRules = useSyncExternalStore(
    subscribeRoomRules,
    getRoomRulesSnapshot,
    getRoomRulesSnapshot,
  )
  const hasRoomSession = getRoomSession() != null
  void pluginRevision
  const features = registeredDnd5ePluginFeatures().flatMap((feature) => {
    return dnd5eCharacterHasPluginFeature(character, feature.id) &&
      feature.action &&
      (!feature.action.trigger || feature.action.trigger.kind === 'active-use') &&
      feature.automation !== 'manual' &&
      dnd5ePluginFeatureAvailableForCharacter(feature, character)
      ? [dnd5ePluginFeatureDefinition(feature.id)!]
      : []
  })
  const attackIntents = dnd5eDeclarativeAttackIntentsForCharacter(character)
  if (features.length === 0 && attackIntents.length === 0) return null

  return (
    <section data-testid="dnd5e-plugin-combat-panel" className="rounded-xl border border-violet-400/15 bg-violet-500/5 p-3">
      <div className="mb-3 flex items-center gap-2">
        <PlugZap className="h-4 w-4 text-violet-300" />
        <h3 className="text-sm font-semibold text-violet-100">扩展规则行动</h3>
        <span className="ml-auto rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200">
          DM Headless
        </span>
      </div>
      <div className="space-y-3">
        {attackIntents.map(({ feature, hook }) => {
          const armed = armedAttackIntentFeatureIds.has(feature.id)
          const allowedForRoom = !hasRoomSession || (
            roomRules != null && roomAllowsPlugin(feature.ownerPluginId, roomRules)
          )
          const roomReady = !hasRoomSession || roomRules?.member.ready === true
          const retentionLabel = hook.retention === 'until-triggered'
            ? '未命中时保留'
            : hook.retention === 'until-turn-end'
              ? '持续到本回合结束'
              : '仅下一次攻击'
          const timingLabel = hook.timing === 'before-attack-roll'
            ? '在攻击掷骰前生效'
            : hook.timing === 'after-attack-roll'
              ? '在攻击骰确定后结算'
              : '命中后结算'
          return (
            <article
              key={`attack-intent:${feature.id}`}
              data-testid={`dnd5e-plugin-attack-intent-${feature.id}`}
              className={[
                'rounded-lg border p-3 transition',
                armed
                  ? 'border-violet-300/45 bg-violet-500/15'
                  : 'border-white/8 bg-black/15',
              ].join(' ')}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">{feature.name}</h4>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {feature.action?.description ?? feature.summary}
                  </p>
                  <p className="mt-1 text-[11px] text-violet-200">
                    先激活，{timingLabel} · {retentionLabel}
                  </p>
                  {(!allowedForRoom || !roomReady) && (
                    <p className="mt-1 text-[11px] text-amber-300">
                      {!allowedForRoom ? '当前房间未启用这个规则包。' : '本地规则包与房间版本尚未同步。'}
                    </p>
                  )}
                </div>
                <span className={[
                  'rounded-full px-2 py-0.5 text-[10px]',
                  armed ? 'bg-violet-300/20 text-violet-100' : 'bg-white/5 text-slate-400',
                ].join(' ')}>
                  {armed ? '已激活' : '未激活'}
                </span>
              </div>
              <button
                data-testid={`dnd5e-plugin-toggle-attack-intent-${feature.id}`}
                type="button"
                disabled={pending || !canAct || !roomReady || !allowedForRoom}
                onClick={() => onToggleAttackIntent(feature.id)}
                className={[
                  'mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-35',
                  armed
                    ? 'border border-violet-300/25 bg-violet-400/20 text-violet-50 hover:bg-violet-400/30'
                    : 'bg-violet-500/15 text-violet-100 hover:bg-violet-500/25',
                ].join(' ')}
              >
                {armed ? '取消激活' : '为下一次攻击激活'}
              </button>
            </article>
          )
        })}
        {features.map((feature) => {
          const featureAction = feature.action!
          const targeting = featureAction.targeting
          const featureDamageTypes = new Set((feature.declarativeAbility?.rolls ?? []).flatMap((roll) =>
            roll.kind === 'damage' && roll.damageType !== 'parent-weapon' ? [roll.damageType] : [],
          ))
          const compatibleDamageMaximizers = attackIntents.filter(({ feature: modifier }) => {
            const mechanic = modifier.declarativeAbility?.mechanic
            return mechanic?.kind === 'damage-roll-maximization' &&
              mechanic.deliveries.includes('feature') &&
              dnd5ePluginFeatureAvailableForCharacter(modifier, character) &&
              mechanic.damageTypes.some((damageType) => featureDamageTypes.has(damageType))
          })
          const selectedModifierId = compatibleDamageMaximizers.some(({ feature: modifier }) =>
            modifier.id === modifierByFeature[feature.id])
            ? modifierByFeature[feature.id]
            : ''
          const combatManeuverOperation = dnd5eDeclarativeCombatManeuverDefinition(feature.id)
            ?.mechanic.operation
          const isAllyReactionAttack = combatManeuverOperation === 'ally-reaction-attack'
          const projectionAttackMechanic =
            feature.declarativeAbility?.mechanic?.kind === 'utility-projection-attack-advantage'
              ? feature.declarativeAbility.mechanic
              : undefined
          const targetOptions = targeting.kind === 'self'
            ? [actorToken]
            : targeting.kind === 'area'
              ? []
              : map.tokens.filter((token) => {
                if (token.type === 'obstacle') return false
                if (token.id === actorToken.id && targeting.includeSelf !== true) return false
                const opposed = areOpposedCombatTokens(actorToken, token)
                if (targeting.relation === 'ally' && opposed) return false
                if (targeting.relation === 'enemy' && !opposed) return false
                if (projectionAttackMechanic) {
                  const projectionDistance = dnd5eUtilityProjectionTargetDistanceFeet({
                    character,
                    featureId: feature.id,
                    map,
                    targetToken: token,
                  })
                  return projectionDistance != null &&
                    projectionDistance <= projectionAttackMechanic.maximumDistanceFeet
                }
                const distanceFeet = tokenFootprintDistanceCells(actorToken, token, map) *
                  Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
                return targeting.rangeFeet == null || distanceFeet <= targeting.rangeFeet
              })
          const selectedMultipleTargetIds = targeting.kind === 'multiple-creatures'
            ? (multipleTargetsByFeature[feature.id] ?? []).filter((targetId) =>
                targetOptions.some((token) => token.id === targetId))
            : []
          const selectedTargetId = targeting.kind === 'self'
            ? actorToken.id
            : targeting.kind === 'area'
              ? '__area__'
              : targeting.kind === 'multiple-creatures'
                ? selectedMultipleTargetIds[0] ?? ''
              : targetsByFeature[feature.id] ?? targetOptions[0]?.id ?? ''
          const selectedTargetToken = map.tokens.find((token) => token.id === selectedTargetId)
          const reactionAttackEnemyOptions = isAllyReactionAttack && selectedTargetToken
            ? map.tokens.filter((token) => {
                return token.type !== 'obstacle' && areOpposedCombatTokens(actorToken, token)
              })
            : []
          const selectedReactionAttackEnemyId = isAllyReactionAttack
            ? secondaryTargetsByFeature[feature.id] ?? reactionAttackEnemyOptions[0]?.id ?? ''
            : ''
          const allowedForRoom = !hasRoomSession || (
            roomRules != null && roomAllowsPlugin(feature.ownerPluginId, roomRules)
          )
          const roomReady = !hasRoomSession || roomRules?.member.ready === true
          const disabled = pending || !canAct || !roomReady || !allowedForRoom ||
            !economyAvailable(featureAction.economy, turnEconomy) || !selectedTargetId ||
            (targeting.kind === 'multiple-creatures' && selectedMultipleTargetIds.length < 1) ||
            (isAllyReactionAttack && !selectedReactionAttackEnemyId)
          return (
            <article key={feature.id} className="rounded-lg border border-white/8 bg-black/15 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">{feature.name}</h4>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{featureAction.description ?? feature.summary}</p>
                  {(!allowedForRoom || !roomReady) && (
                    <p className="mt-1 text-[11px] text-amber-300">
                      {!allowedForRoom ? '该规则包未在本房间启用' : '本机规则包与房间版本不一致'}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                  {featureAction.economy === 'action'
                    ? '动作'
                    : featureAction.economy === 'bonusAction'
                      ? '附赠动作'
                      : featureAction.economy === 'reaction'
                        ? '反应'
                        : '免费'}
                </span>
              </div>
              {targeting.kind === 'single-creature' && (
                <label className="mt-3 block">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                    {isAllyReactionAttack ? '受令盟友' : '地图目标'}
                  </span>
                  <select
                    data-testid={`dnd5e-plugin-target-${feature.id}`}
                    value={selectedTargetId}
                    onChange={(event) => setTargetsByFeature((current) => ({
                      ...current,
                      [feature.id]: event.target.value,
                    }))}
                    className="w-full rounded-lg border border-white/10 bg-void-950/80 px-2 py-1.5 text-xs text-slate-200"
                  >
                    {targetOptions.length === 0 && <option value="">没有符合条件的目标</option>}
                    {targetOptions.map((token) => {
                      const distanceFeet = projectionAttackMechanic
                        ? dnd5eUtilityProjectionTargetDistanceFeet({
                            character,
                            featureId: feature.id,
                            map,
                            targetToken: token,
                          }) ?? Number.POSITIVE_INFINITY
                        : tokenFootprintDistanceCells(actorToken, token, map) *
                          Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
                      return <option key={token.id} value={token.id}>{token.label} · {distanceFeet}尺</option>
                    })}
                  </select>
                </label>
              )}
              {targeting.kind === 'multiple-creatures' && (
                <fieldset className="mt-3 rounded-lg border border-white/8 bg-black/10 p-2">
                  <legend className="px-1 text-[11px] font-semibold text-slate-500">
                    选择目标（最多 {targeting.maximumTargets} 个）
                  </legend>
                  <div className="mt-1 max-h-40 space-y-1 overflow-y-auto pr-1">
                    {targetOptions.length === 0 && <p className="px-2 py-1 text-xs text-slate-500">没有符合条件的目标</p>}
                    {targetOptions.map((token) => {
                      const selected = selectedMultipleTargetIds.includes(token.id)
                      const atLimit = !selected && selectedMultipleTargetIds.length >= targeting.maximumTargets
                      const distanceFeet = tokenFootprintDistanceCells(actorToken, token, map) *
                        Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
                      return <label key={token.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-300 hover:bg-white/5">
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={atLimit}
                          onChange={() => setMultipleTargetsByFeature((current) => ({
                            ...current,
                            [feature.id]: selected
                              ? selectedMultipleTargetIds.filter((id) => id !== token.id)
                              : [...selectedMultipleTargetIds, token.id],
                          }))}
                        />
                        <span>{token.label} · {distanceFeet}尺</span>
                      </label>
                    })}
                  </div>
                </fieldset>
              )}
              {isAllyReactionAttack && (
                <label className="mt-3 block">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-500">被攻击目标</span>
                  <select
                    data-testid={`dnd5e-plugin-secondary-target-${feature.id}`}
                    value={selectedReactionAttackEnemyId}
                    onChange={(event) => setSecondaryTargetsByFeature((current) => ({
                      ...current,
                      [feature.id]: event.target.value,
                    }))}
                    className="w-full rounded-lg border border-white/10 bg-void-950/80 px-2 py-1.5 text-xs text-slate-200"
                  >
                    {reactionAttackEnemyOptions.length === 0 && <option value="">没有符合条件的敌人</option>}
                    {reactionAttackEnemyOptions.map((token) => (
                      <option key={token.id} value={token.id}>{token.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {(feature.declarativeAbility?.choices ?? []).map((choice) => {
                const selected = activityChoicesByFeature[feature.id]?.[choice.id] ??
                  choice.defaultOptionId ?? choice.options[0]?.id ?? ''
                return <label key={choice.id} className="mt-3 block">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-500">{choice.label}</span>
                  <select
                    data-testid={`dnd5e-plugin-choice-${feature.id}-${choice.id}`}
                    value={selected}
                    onChange={(event) => setActivityChoicesByFeature((current) => ({
                      ...current,
                      [feature.id]: { ...current[feature.id], [choice.id]: event.target.value },
                    }))}
                    className="w-full rounded-lg border border-white/10 bg-void-950/80 px-2 py-1.5 text-xs text-slate-200"
                  >
                    {choice.options.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
              })}
              {compatibleDamageMaximizers.length > 0 && (
                <label className="mt-3 block">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                    本次伤害修饰（可选）
                  </span>
                  <select
                    data-testid={`dnd5e-plugin-modifier-${feature.id}`}
                    value={selectedModifierId}
                    onChange={(event) => setModifierByFeature((current) => ({
                      ...current,
                      [feature.id]: event.target.value,
                    }))}
                    className="w-full rounded-lg border border-white/10 bg-void-950/80 px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="">正常掷伤害骰</option>
                    {compatibleDamageMaximizers.map(({ feature: modifier }) => (
                      <option key={modifier.id} value={modifier.id}>{modifier.name} · 伤害骰取最大值</option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[10px] leading-4 text-slate-500">
                    Host 会重新校验伤害类型、来源和资源，并在同一事务内消耗次数。
                  </span>
                </label>
              )}
              <button
                data-testid={`dnd5e-plugin-action-${feature.id}`}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (targeting.kind === 'area') {
                    onBeginAreaTargeting({ featureId: feature.id, featureName: feature.name, targeting })
                    return
                  }
                  onAction({
                    targetTokenId: selectedTargetId,
                    targetTokenIds: targeting.kind === 'multiple-creatures'
                      ? selectedMultipleTargetIds
                      : undefined,
                    payload: {
                      featureId: feature.id,
                      modifierFeatureIds: selectedModifierId ? [selectedModifierId] : undefined,
                      payload: {
                        ...(isAllyReactionAttack ? { enemyTargetId: selectedReactionAttackEnemyId } : {}),
                        ...((feature.declarativeAbility?.choices?.length ?? 0) > 0 ? {
                          activityChoices: Object.fromEntries(feature.declarativeAbility!.choices!.map((choice) => [
                            choice.id,
                            activityChoicesByFeature[feature.id]?.[choice.id] ?? choice.defaultOptionId ?? choice.options[0]?.id ?? '',
                          ])),
                        } : {}),
                      },
                    },
                  })
                }}
                className="mt-3 w-full rounded-lg bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {featureAction.label}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
