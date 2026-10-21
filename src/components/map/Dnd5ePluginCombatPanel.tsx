import { dnd5eSightingWorldMinute } from '../../rulesets/dnd5e/recentCreatureSightings'
import { PlanarPortalReports } from './PlanarPortalReports'
import { DamageTraitReports } from './DamageTraitReports'
import { recentSightingTargetOptions } from '../../presentation/maps/recentSightingTargets'
import { createDnd5eMapCombatSnapshot } from '../../rulesets/dnd5e/mapBridge'
import { dnd5eCreatureSensorActivity } from '../../rulesets/dnd5e/creatureSensorTarget'
import { dnd5eAttackableMapObject } from '../../rulesets/dnd5e/mapObjectCombatProfile'
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
import { useCharacterStore } from '../../store/characters'
import { getRegisteredDnd5eActivity } from '../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import { dnd5eActivityInventorySelectionOptions, dnd5eActivitySelectsInventoryItem } from '../../rulesets/dnd5e/activities/dnd5eActivityInventorySelection'
import { dnd5eActivityChoiceIsRelevantV1, dnd5eActivityLanguageChoicesV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityChoices'
import { useCampaignTimeStore } from '../../store/campaignTime'
import { resolveDnd5eActivityInvocationV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityInvocation'
import { openDnd5eRestActivityWindow, dnd5eRestActivityReceiptKey } from '../../rulesets/dnd5e/restActivityWindows'
import {openDnd5eRestStartActivityWindow} from '../../rulesets/dnd5e/restStartActivityWindows'
import { dnd5eFeatureActivityControls } from '../../rulesets/dnd5e/activities/dnd5eFeatureActivityControls'
import { dnd5eActivityControlUnavailableReason } from '../../rulesets/dnd5e/activities/dnd5eActivityControlAvailability'
import { companionHelpOperationIds, companionHelpTargetOptions, companionHelpSelectionPayload, type CompanionHelpSelection } from './companionHelpSelection'
import { dnd5eCharacterAttackTeleportRange } from '../../rulesets/dnd5e/characterWeaponAttackSlot'
import { dnd5eActivityWithTargetChoicesV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityChoices'

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
  canUseExplorationActivities = false,
  canUseRestActivities = false,
  pending,
  turnEconomy,
  armedAttackIntentFeatureIds,
  onAction,
  onBeginAreaTargeting,
  onToggleAttackIntent,
  onInspectKnownLocation,
}: {
  character: Character
  map: BattleMap
  actorToken: Token
  onInspectKnownLocation?: (location: import('../../rulesets/dnd5e/knownCreatureLocations').Dnd5eKnownCreatureLocation) => void
  canAct: boolean
  /** The owned map actor may invoke active Activities outside combat. */
  canUseExplorationActivities?: boolean
  /** The controlled character may answer a rest choice outside combat. */
  canUseRestActivities?: boolean
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
    featurePayload?: Dnd5ePluginActionPayload['payload']
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
  const [inventoryByFeature, setInventoryByFeature] = useState<Record<string,string>>({})
  const [activityByFeature, setActivityByFeature] = useState<Record<string,string>>({})
  const [helpByActivity, setHelpByActivity] = useState<Record<string, Record<string, CompanionHelpSelection>>>({})
  const characters = useCharacterStore(state => state.characters)
  const campaignClock = useCampaignTimeStore(state => state.state)
  const worldMinute = campaignClock.worldMinute
  const roomRules = useSyncExternalStore(
    subscribeRoomRules,
    getRoomRulesSnapshot,
    getRoomRulesSnapshot,
  )
  const hasRoomSession = getRoomSession() != null
  void pluginRevision
  const features = registeredDnd5ePluginFeatures().flatMap((feature) => {
    const controls = dnd5eFeatureActivityControls(feature)
    return dnd5eCharacterHasPluginFeature(character, feature.id) &&
      (feature.action || controls.length > 0) &&
      (controls.length > 0 || !feature.action?.trigger || feature.action.trigger.kind === 'active-use') &&
      (feature.automation !== 'manual' || controls.length > 0) &&
      dnd5ePluginFeatureAvailableForCharacter(feature, character)
      ? [{...dnd5ePluginFeatureDefinition(feature.id)!,action:feature.action ?? controls[0].action}]
      : []
  })
  const attackIntents = dnd5eDeclarativeAttackIntentsForCharacter(character)
  const portalReports = Object.values(character.dnd5eCombatState?.planarPortalReports ?? {})
    .filter(receipt => receipt.mapId === map.id)
  const damageReports = Object.values(character.dnd5eCombatState?.damageTraitReports ?? {})
    .filter(receipt => !receipt.mapId || receipt.mapId === map.id)
  if (features.length === 0 && attackIntents.length === 0 && portalReports.length === 0 && damageReports.length === 0) return null

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
        <PlanarPortalReports reports={portalReports} />
        <DamageTraitReports reports={damageReports} />
        {Object.values(character.dnd5eCombatState?.knownCreatureLocations ?? {}).filter(location => location.mapId === map.id).map(location => (
          <div key={location.targetId} data-testid={`known-creature-location-${location.targetId}`} className="rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-2 text-xs text-cyan-100">
            <div>{location.label} · 第 {location.round} 回合获知的位置</div>
            <div className="mt-1 text-slate-400">位置记录不会随目标移动更新。高度 {location.elevationFeet} 尺。</div>
            {onInspectKnownLocation && <button type="button" className="mt-2 rounded bg-cyan-500/15 px-2 py-1" onClick={() => onInspectKnownLocation(location)}>在地图查看记录位置</button>}
          </div>
        ))}
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
          const controls = dnd5eFeatureActivityControls(feature, { actor: {
            level: character.level, proficiencyBonus: 2 + Math.floor((Math.max(1, character.level) - 1) / 4),
            classLevels: character.dnd5eClassLevels, abilities: character.abilities,
          } })
          const selectedControl = controls.find(control => control.activity.id === activityByFeature[feature.id])
            ?? controls.find(control => !dnd5eActivityControlUnavailableReason(control.activity, character))
            ?? controls.find(control => control.activity.id === feature.action!.id)
            ?? controls[0]
          const featureAction = selectedControl?.action ?? feature.action!
          const activity = getRegisteredDnd5eActivity(feature.ownerPluginId, featureAction.id)
          const unavailableReason = activity && dnd5eActivityControlUnavailableReason(activity, character)
          const activeEffectGrant = activity?.requiresEffectGrant
            ? character.dnd5eCombatState?.activeEffects?.find(effect =>
              !effect.suspendedBy?.length &&
              (effect.grantedActivityCharges == null || effect.grantedActivityCharges.current > 0) &&
              (effect.source.pluginId ?? (effect.source.kind === 'spell' ? 'srd-5.1' : undefined)) === feature.ownerPluginId &&
              effect.grantedActivities?.includes(featureAction.id))
            : undefined
          const invocation=activity && resolveDnd5eActivityInvocationV1(activity)
          const requiresRest=invocation?.kind==='triggered' && ['long-rest-complete','short-rest-complete','long-rest-started','short-rest-started'].includes(invocation.event)
          const explorationActive = canUseExplorationActivities && invocation?.kind === 'active' && featureAction.economy !== 'reaction'
          const restWindow=requiresRest ? (invocation?.kind==='triggered'&&invocation.event.endsWith('-started')
            ?openDnd5eRestStartActivityWindow(character,campaignClock):openDnd5eRestActivityWindow(character,worldMinute)) : undefined
          const restAvailable=!!restWindow && invocation?.kind==='triggered' && restWindow.event===invocation.event && !restWindow.receipts[dnd5eRestActivityReceiptKey(feature.ownerPluginId,featureAction.id)]
          const activityChoices = activity?.choices?.map(choice =>
            activity && choice.optionsFrom === 'combat-creatures'
              ? dnd5eActivityLanguageChoicesV1({ ...activity, choices: [choice] }, [], undefined,
                map.tokens.filter(token => ['player', 'enemy', 'npc'].includes(token.type)).map(token => ({
                  id: token.id, name: characters.find(candidate => candidate.id === token.characterId)?.name ?? token.label,
                }))).choices![0]
              : choice) ?? (activity ? [] : feature.declarativeAbility?.choices ?? [])
          const selectedChoices = Object.fromEntries(activityChoices.map(choice => [choice.id, activityChoicesByFeature[feature.id]?.[choice.id] ?? choice.defaultOptionId ?? choice.options[0]?.id ?? '']))
          const creatureSensor = activity && dnd5eCreatureSensorActivity(activity)
          const targeting = creatureSensor ? {kind:'self' as const} : featureAction.targeting
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
          const recentTargetOptions = activity?.target.kind === 'creature' && activity.target.requiresSeenWithinSeconds != null
            ? recentSightingTargetOptions({ actorId: actorToken.id, worldMinute: dnd5eSightingWorldMinute(worldMinute,campaignClock.worldSecondRemainder ?? 0),
              maximumAgeSeconds: activity.target.requiresSeenWithinSeconds,
              detectedUnseenIds: new Set(map.tokens.filter(token => token.perceptionVisibility === 'detected-unseen').map(token => token.id)),
              state: createDnd5eMapCombatSnapshot({ combatId: `recent-target-preview:${map.id}`, map, characters,
                initiativeOrder: [], additionalCreatureTokenIds: map.tokens.filter(token => ['player', 'enemy', 'npc'].includes(token.type)).map(token => token.id),
              }).state }) : undefined
          const selectedAttackActivity = activity && dnd5eActivityWithTargetChoicesV1(activity, selectedChoices)
          const attackTeleportRange = canAct && selectedAttackActivity?.usesAttackActionAttack &&
            selectedAttackActivity.checks?.some(check => check.kind === 'attack-roll')
            ? dnd5eCharacterAttackTeleportRange(character) ?? 0 : 0
          const targetOptions = targeting.kind === 'self'
            ? [actorToken]
            : targeting.kind === 'area'
              ? []
              : map.tokens.filter((token) => {
                if (recentTargetOptions && !recentTargetOptions.has(token.id)) return false
                if (token.type === 'obstacle' && !(targeting.kind === 'single-creature' && targeting.allowObjectAttack && dnd5eAttackableMapObject(token))) return false
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
                return targeting.rangeFeet == null || distanceFeet <= targeting.rangeFeet + attackTeleportRange
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
              : (targetsByFeature[feature.id] && (!recentTargetOptions || recentTargetOptions.has(targetsByFeature[feature.id])) ? targetsByFeature[feature.id] : targetOptions[0]?.id) ?? ''
          const selectedTargetToken = map.tokens.find((token) => token.id === selectedTargetId)
          const helpKey = `${feature.id}:${featureAction.id}`
          const helpOperationIds = companionHelpOperationIds(activity, selectedChoices)
          const helpOptions = companionHelpTargetOptions(map.tokens,
            targeting.kind === 'multiple-creatures' ? selectedMultipleTargetIds : [selectedTargetId])
          const companionHelpTargets = companionHelpSelectionPayload(helpOperationIds, helpOptions, helpByActivity[helpKey] ?? {})
          const selectedTargetCharacterIds = new Set((targeting.kind === 'multiple-creatures' ? selectedMultipleTargetIds : [selectedTargetId])
            .flatMap(id => map.tokens.find(token => token.id === id)?.characterId ?? []))
          const inventoryRequired = activity != null && dnd5eActivitySelectsInventoryItem(activity, selectedChoices)
          const inventoryOptions = inventoryRequired ? dnd5eActivityInventorySelectionOptions(activity!, selectedChoices, character,
            [...new Map([character,...characters].filter(owner => selectedTargetCharacterIds.has(owner.id)).map(owner => [owner.id,owner])).values()]) : []
          const selectedInventory = inventoryOptions.find(option => option.id === inventoryByFeature[feature.id]) ?? inventoryOptions[0]
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
          const disabled = !!unavailableReason || companionHelpTargets == null || pending || !(requiresRest ? canAct || canUseRestActivities : canAct || explorationActive) || !roomReady || !allowedForRoom ||
            (activity?.requiresEffectGrant === true && !activeEffectGrant) ||
            (requiresRest && !restAvailable) ||
            (inventoryRequired && !selectedInventory) ||
            (!explorationActive && !economyAvailable(featureAction.economy, turnEconomy)) || !selectedTargetId ||
            (targeting.kind === 'multiple-creatures' && (selectedMultipleTargetIds.length < 1 || selectedMultipleTargetIds.length > targeting.maximumTargets)) ||
            (isAllyReactionAttack && !selectedReactionAttackEnemyId)
          return (
            <article key={feature.id} className="rounded-lg border border-white/8 bg-black/15 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">{feature.name}</h4>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{featureAction.description ?? feature.summary}</p>
                  {requiresRest && <p className="mt-1 text-[11px] text-slate-400">
                    {invocation?.kind==='triggered' && invocation.event.endsWith('-started')
                      ? restAvailable ? '休息已开始，可选择本次效果。' : '仅在对应休息刚开始时选择一次；使用或跳过后需等待下一次休息。'
                      : restAvailable ? '休息已完成，可选择本次效果。' : '仅在对应休息完成后选择一次；使用或跳过后需等待下一次休息。'}
                  </p>}
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
              {controls.length > 1 && <label className="mt-3 block">
                <span className="mb-1 block text-[11px] text-slate-500">选择能力</span>
                <select data-testid={`dnd5e-plugin-activity-${feature.id}`} value={featureAction.id}
                  onChange={event => setActivityByFeature(current => ({...current,[feature.id]:event.target.value}))}
                  className="w-full rounded-lg border border-white/10 bg-void-950/80 px-2 py-1.5 text-xs text-slate-200">
                  {controls.map(control => {
                    const reason = dnd5eActivityControlUnavailableReason(control.activity, character)
                    return <option key={control.activity.id} value={control.activity.id} disabled={!!reason}>{control.activity.name}{reason ? `（${reason}）` : ''}</option>
                  })}
                </select>
              </label>}
              {unavailableReason && <p className="mt-2 text-xs text-amber-300">{unavailableReason}</p>}
              {creatureSensor && <p className="mt-2 text-xs text-slate-400">发起后由 DM 确认你指定的已知生物。</p>}
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
                      if (recentTargetOptions?.get(token.id)?.currentlyVisible === false) return <option key={token.id} value={token.id}>{recentTargetOptions.get(token.id)?.label ?? '曾见生物'} · 最近见过（当前位置未知）</option>
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
              {activityChoices.filter(choice => !activity || dnd5eActivityChoiceIsRelevantV1(activity, choice, selectedChoices)).map((choice) => {
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
              {helpOperationIds.map(operationId => {
                const selection = helpByActivity[helpKey]?.[operationId]
                const update = (patch: Partial<CompanionHelpSelection>) => setHelpByActivity(current => ({ ...current,
                  [helpKey]: { ...current[helpKey], [operationId]: {
                    ...(current[helpKey]?.[operationId] ?? { targetId: '', helpKind: 'attack' as const }), ...patch,
                  } },
                }))
                return <fieldset key={operationId} className="mt-3 space-y-2">
                  <legend className="text-[11px] font-semibold text-slate-400">协助指令</legend>
                  <label className="block text-xs text-slate-400">协助方式
                    <select aria-label="协助方式" value={selection?.helpKind ?? 'attack'}
                      onChange={event => update({ helpKind: event.target.value as CompanionHelpSelection['helpKind'] })}
                      className="ml-2 rounded border border-white/10 bg-void-950 px-2 py-1">
                      <option value="attack">干扰敌人，协助攻击</option>
                      <option value="ability-check">协助角色检定</option>
                    </select>
                  </label>
                  <label className="block text-xs text-slate-400">{selection?.helpKind === 'ability-check' ? '接受协助的角色' : '要干扰的敌人'}
                    <select aria-label="协助对象" value={helpOptions.some(option => option.id === selection?.targetId) ? selection!.targetId : ''}
                      onChange={event => update({ targetId: event.target.value })}
                      className="ml-2 rounded border border-white/10 bg-void-950 px-2 py-1">
                      <option value="">请选择</option>
                      {helpOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                  </label>
                  <p className="text-[10px] text-slate-500">召唤物在自己的回合执行，届时检查距离并消耗动作。</p>
                </fieldset>
              })}
              {inventoryRequired && <label className="mt-3 block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-500">附魔物品</span>
                <select data-testid={`dnd5e-plugin-inventory-${feature.id}`} value={selectedInventory?.id ?? ''}
                  onChange={event => setInventoryByFeature(current => ({...current,[feature.id]:event.target.value}))}
                  className="w-full rounded-lg border border-white/10 bg-void-950/80 px-2 py-1.5 text-xs text-slate-200">
                  {!inventoryOptions.length && <option value="">目标背包中没有符合类型的物品</option>}
                  {inventoryOptions.map(option => <option key={option.id} value={option.id}>{option.label} · {option.equipped ? '已装备' : '背包中'}</option>)}
                </select>
              </label>}
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
                    onBeginAreaTargeting({ featureId: feature.id, featureName: feature.name, targeting,
                      featurePayload:{...(selectedControl?{selectedActivityId:featureAction.id}:{}),
                        ...(activeEffectGrant ? {activeEffectId:activeEffectGrant.id} : {}),
                        ...(requiresRest && restAvailable?{restEventId:restWindow!.eventId}:{}),
                        ...(activityChoices.length?{activityChoices:selectedChoices}:{}),
                        ...(helpOperationIds.length && companionHelpTargets ? {companionHelpTargets} : {})} })
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
                        ...(selectedControl ? {selectedActivityId:featureAction.id} : {}),
                        ...(activeEffectGrant ? {activeEffectId:activeEffectGrant.id} : {}),
                        ...(requiresRest && restAvailable ? {restEventId:restWindow!.eventId} : {}),
                        ...(isAllyReactionAttack ? { enemyTargetId: selectedReactionAttackEnemyId } : {}),
                        ...(activityChoices.length > 0 ? {activityChoices:selectedChoices} : {}),
                        ...(helpOperationIds.length && companionHelpTargets ? {companionHelpTargets} : {}),
                        ...(inventoryRequired && selectedInventory ? {activityInventoryCharacterId:selectedInventory.ownerId,
                          activityInventoryInstanceId:selectedInventory.instanceId,expectedActivityInventoryRevision:selectedInventory.revision} : {}),
                      },
                    },
                  })
                }}
                className="mt-3 w-full rounded-lg bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {featureAction.label}
              </button>
              {requiresRest && targeting.kind !== 'area' && <button
                type="button"
                data-testid={`dnd5e-plugin-rest-decline-${feature.id}`}
                disabled={pending || !(canAct || canUseRestActivities) || !roomReady || !allowedForRoom || !restAvailable || !selectedTargetId}
                onClick={() => onAction({targetTokenId:selectedTargetId,
                  targetTokenIds:targeting.kind==='multiple-creatures'?selectedMultipleTargetIds:undefined,
                  payload:{featureId:feature.id,payload:{restEventId:restWindow!.eventId,restDecision:'decline',...(selectedControl?{selectedActivityId:featureAction.id}:{})}}})}
                className="mt-2 w-full rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 disabled:opacity-35"
              >本次不使用</button>}
            </article>
          )
        })}
      </div>
    </section>
  )
}
