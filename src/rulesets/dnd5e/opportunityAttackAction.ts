import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { DND_FEET_PER_CELL, tokenFootprintDistanceCells } from '../../lib/gridCombat'
import { mapGeometryRuntimeForMap, mapGeometryTokenElevation } from '../../lib/mapGeometry'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type { Dnd5eTurnEconomyByToken, Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eCharacterClassLevel } from './multiclass'
import type { D20RollMode } from '../contracts'
import type { Dnd5eRollModeResolution } from './rollMode'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eWeaponAttackProfile, dnd5eWeaponPropertyIds, dnd5eWearingUnproficientArmor } from './equipment'
import {
  dnd5eBlurImposesAttackDisadvantage,
  dnd5eAttackDisadvantageReasons,
  dnd5eAttackerIsUnseenForAttack,
  dnd5eCombatantHasConcentrationEffect,
  dnd5eCombatantCanSee,
  dnd5eCannotAttackSource,
  dnd5eFrightenedAttackDisadvantage,
  dnd5eHelpAttackApplies,
  dnd5eRageAllyProtectionDisadvantage,
  dnd5eRageOpportunityDisadvantage,
  dnd5eRageAllyMeleeAdvantage,
  dnd5eTargetArmorClassForAttack,
  dnd5eTargetIsUnseenForAttack,
  dnd5eTranquilityWardCheck,
  dnd5eWeaponClassDamageDefinitions,
  previewDnd5ePostD20AdjustedAttack,
  type Dnd5eActionResult,
  type Dnd5eClassDamageDefinition,
  type Dnd5eClassDamageRolls,
  type Dnd5eCuttingWordsUse,
  type Dnd5eHeadlessCombatState,
  type Dnd5ePostD20AdjustmentUse,
  type Dnd5eTranquilitySaveRoll,
  type Dnd5eStandAgainstTideUse,
  type Dnd5eWholeWeaponDamageRerollUse,
  type Dnd5eWeaponClassDamageContext,
} from './headlessCombatEngine'
import {
  resolveDnd5eActionWithAirborneFallPreview,
  type Dnd5eAirborneFallDamageRolls,
  type Dnd5eAirborneFallPreview,
} from './airborneFallActionResolution'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { getDnd5eSrdMonster, type Dnd5eDamageType } from './monsters'
import { dnd5eHasViciousMockeryAttackDisadvantage, dnd5ePreventsAttackAdvantage, dnd5eReactionsPrevented, dnd5eTargetAttackAdvantageReasons, dnd5eTargetIsDodging } from './passiveDefenses'
import {
  dnd5eCharacterHasPluginFeature,
  dnd5ePluginFeatureDefinition,
  registeredDnd5ePluginFeatures,
} from './pluginApi'
import { resolveDnd5eRollMode } from './rollMode'
import { dnd5eMonsterActionAutomation } from './monsterSchema'
import { dnd5eMonsterFlybyPreventsOpportunityAttacks } from './monsterGenericAbilities'
import type { Dnd5eTraversalMode } from './traversal'
import { dnd5eUtilityProjectionAttackAdvantageApplies } from './utilityProjection'
import { dnd5eNextD20AdvantageApplies } from './nextD20Advantage'
import { dnd5eMapTokenDistanceFeet } from './verticalCombatGeometry'

function dnd5eMeleeTargetOpportunityAttackSuppressed(
  mover: Character | undefined,
  attackerCombatantId: string,
): boolean {
  if (!mover?.dnd5eCombatState?.meleeAttackTargetIdsThisTurn?.includes(attackerCombatantId)) return false
  return registeredDnd5ePluginFeatures().some((feature) =>
    feature.staticModifiers?.preventOpportunityAttacksFromMeleeAttackTargets === true &&
    dnd5eCharacterHasPluginFeature(mover, feature.id))
}

function dnd5eOwnedOpportunityAttackModifiers(character: Character | undefined) {
  const features = character
    ? registeredDnd5ePluginFeatures().filter((feature) =>
        feature.automation !== 'manual' &&
        dnd5eCharacterHasPluginFeature(character, feature.id))
    : []
  return {
    ignoreDisengage: features.some((feature) =>
      feature.staticModifiers?.opportunityAttacksIgnoreDisengage === true),
    enterReachWeaponIds: new Set(features.flatMap((feature) =>
      feature.staticModifiers?.opportunityAttacksOnEnterReachWeaponIds ?? [])),
  }
}

function dnd5eOpportunityAttackerCanSeeMoverAtPosition(input: {
  map: BattleMap
  characters: readonly Character[]
  attacker: Token
  movingToken: Token
  movingPosition: { x: number; y: number; elevationFeet: number }
}): boolean {
  const mapAtTrigger: BattleMap = {
    ...input.map,
    tokens: input.map.tokens.map((token) => token.id === input.movingToken.id
      ? { ...token, ...input.movingPosition }
      : token),
  }
  const initiativeOrder: InitiativeEntry[] = mapAtTrigger.tokens.flatMap((token, index) =>
    token.type === 'player' || token.type === 'enemy'
      ? [{
          tokenId: token.id,
          label: token.label,
          emoji: token.emoji,
          color: token.color,
          roll: Math.max(1, 20 - index),
        }]
      : [],
  )
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: `opportunity-visibility:${input.attacker.id}:${input.movingToken.id}`,
    map: mapAtTrigger,
    characters: input.characters,
    initiativeOrder,
  })
  return dnd5eCombatantCanSee(snapshot.state, input.attacker.id, input.movingToken.id)
}

export function findDnd5eOpportunityAttackersForMove(input: {
  map: BattleMap
  characters: readonly Character[]
  movingToken: Token
  to: { x: number; y: number }
  path?: Array<{ x: number; y: number }>
  pathElevationsFeet?: readonly number[]
  toElevationFeet?: number
  turnEconomyByToken: Dnd5eTurnEconomyByToken
  disengaged?: boolean
  movementMode?: Dnd5eTraversalMode
}): Token[] {
  const movingMonster = input.movingToken.poolId
    ? getDnd5eSrdMonster(input.movingToken.poolId)
    : undefined
  if (dnd5eMonsterFlybyPreventsOpportunityAttacks(movingMonster, input.movementMode)) return []
  const movingCharacter = input.movingToken.characterId
    ? input.characters.find((candidate) => candidate.id === input.movingToken.characterId)
    : undefined
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  const fromElevationFeet = mapGeometryTokenElevation(geometry, input.movingToken)
  const declaredDestinationElevationFeet = Number.isFinite(input.toElevationFeet)
    ? Number(input.toElevationFeet)
    : undefined
  // Always retain the authoritative pre-move sample. A purely vertical move
  // has only one path point (the destination), so deriving samples from the
  // path alone would erase the instant where takeoff leaves melee reach.
  const pathSamples: Array<{ x: number; y: number; elevationFeet: number }> = [{
    x: input.movingToken.x,
    y: input.movingToken.y,
    elevationFeet: fromElevationFeet,
  }]
  const movementPoints = input.path?.length ? input.path : [input.to]
  movementPoints.forEach((point, index) => {
    const pathElevationFeet = input.pathElevationsFeet?.[index]
    const isDestination = index === movementPoints.length - 1
    const elevationFeet = Number.isFinite(pathElevationFeet)
      ? Number(pathElevationFeet)
      : input.movementMode === 'fly' && declaredDestinationElevationFeet != null
        ? declaredDestinationElevationFeet
        : isDestination && declaredDestinationElevationFeet != null
          ? declaredDestinationElevationFeet
          : fromElevationFeet
    const previous = pathSamples.at(-1)
    if (
      previous && Math.abs(previous.x - point.x) <= 1e-4 &&
      Math.abs(previous.y - point.y) <= 1e-4 &&
      Math.abs(previous.elevationFeet - elevationFeet) <= 1e-4
    ) return
    pathSamples.push({ x: point.x, y: point.y, elevationFeet })
  })
  return input.map.tokens.filter((token) => {
    if (token.id === input.movingToken.id || !areOpposedCombatTokens(token, input.movingToken)) return false
    if (dnd5eMeleeTargetOpportunityAttackSuppressed(movingCharacter, token.id)) return false
    const character = token.characterId
      ? input.characters.find((candidate) => candidate.id === token.characterId)
      : undefined
    if (character ? character.currentHp <= 0 : (token.hp ?? 1) <= 0) return false
    if ((input.turnEconomyByToken[token.id]?.reaction.current ?? 1) < 1) return false
    const noReactions = character
      ? Object.keys(character.dnd5eCombatState?.openHandNoReactionsAppliedTurnKeysBySource ?? {}).length > 0
      : Object.keys(token.dnd5eCombatState?.openHandNoReactionsAppliedTurnKeysBySource ?? {}).length > 0
    if (noReactions) return false
    const playerProfile = character?.rulesetId === 'dnd5e-2014-srd-5.1'
      ? dnd5eWeaponAttackProfile(character)
      : undefined
    const opportunityModifiers = dnd5eOwnedOpportunityAttackModifiers(character)
    if (input.disengaged && !opportunityModifiers.ignoreDisengage) return false
    const monster = token.poolId ? getDnd5eSrdMonster(token.poolId) : undefined
    const monsterReach = monster?.actions
      .filter((action) => dnd5eMonsterActionAutomation(action) === 'headless' && action.attack && (action.attack.mode === 'melee' || action.attack.mode === 'melee-or-ranged'))
      .reduce((maximum, action) => Math.max(maximum, action.attack?.reachFeet ?? 5), 0)
    const reachFeet = playerProfile?.mode === 'melee' ? (playerProfile.reachFeet ?? 5) : (monsterReach ?? 0)
    if (reachFeet <= 0) return false
    const playerWeaponIds = playerProfile
      ? new Set([playerProfile.weaponId, playerProfile.baseWeaponId])
      : new Set<string>()
    const mayAttackOnEnterReach = playerProfile?.mode === 'melee' &&
      [...playerWeaponIds].some((weaponId) =>
        opportunityModifiers.enterReachWeaponIds.has(weaponId))
    const distanceAt = (sample: { x: number; y: number; elevationFeet: number }) =>
      dnd5eMapTokenDistanceFeet({
        map: input.map,
        geometry,
        left: token,
        right: { ...input.movingToken, ...sample },
      })
    return pathSamples.slice(0, -1).some((sample, index) => {
      const before = distanceAt(sample)
      const nextSample = pathSamples[index + 1]
      const after = distanceAt(nextSample)
      const leavesReach = before <= reachFeet && after > reachFeet
      const entersReach = mayAttackOnEnterReach && before > reachFeet && after <= reachFeet
      if (!leavesReach && !entersReach) return false
      return dnd5eOpportunityAttackerCanSeeMoverAtPosition({
        map: input.map,
        characters: input.characters,
        attacker: token,
        movingToken: input.movingToken,
        movingPosition: leavesReach ? sample : nextSample,
      })
    })
  })
}

export type Dnd5eOpportunityAttackRejectReason =
  | 'invalid-actor'
  | 'invalid-target'
  | 'reaction-unavailable'
  | 'no-melee-weapon'
  | 'target-out-of-range'
  | 'target-not-visible'
  | 'combatant-missing'

export interface PreparedDnd5eOpportunityAttack {
  map: BattleMap
  characters: readonly Character[]
  state: Dnd5eHeadlessCombatState
  characterIdByCombatantId: Record<string, string>
  actorToken: Token
  targetToken: Token
  actorName: string
  targetName: string
  weaponName: string
  attackModifier: number
  criticalThreshold: number
  attackMode: D20RollMode
  attackModeResolution?: Dnd5eRollModeResolution
  targetArmorClass: number
  damage: { count: number; sides: number; bonus: number; type: Dnd5eDamageType }
  classDamageContext?: Dnd5eWeaponClassDamageContext
  reachFeet: number
  reactionFeature?: 'berserker-retaliation' | 'hunter-giant-killer' | 'declarative-reaction-weapon-attack'
  reactionFeatureId?: string
  tranquilityWard?: ReturnType<typeof dnd5eTranquilityWardCheck>
  blessed: boolean
  baned: boolean
}

export function prepareDnd5eOpportunityAttack(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  targetTokenId: string
  turnEconomy: Dnd5eTurnEconomyCounts
  targetTurnEconomy?: Dnd5eTurnEconomyCounts
  reactionFeature?: 'berserker-retaliation' | 'hunter-giant-killer' | 'declarative-reaction-weapon-attack'
  reactionFeatureId?: string
}): { ok: true; prepared: PreparedDnd5eOpportunityAttack } | { ok: false; reason: Dnd5eOpportunityAttackRejectReason } {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorTokenId)
  const targetToken = input.map.tokens.find((token) => token.id === input.targetTokenId)
  if (!actorToken || !targetToken || !areOpposedCombatTokens(actorToken, targetToken)) return { ok: false, reason: 'invalid-actor' }
  if (input.turnEconomy.reaction.current < 1) return { ok: false, reason: 'reaction-unavailable' }

  const actor = actorToken.characterId
    ? input.characters.find((character) => character.id === actorToken.characterId)
    : undefined
  const target = targetToken.characterId
    ? input.characters.find((character) => character.id === targetToken.characterId)
    : undefined
  if (actor ? actor.currentHp <= 0 : (actorToken.hp ?? 1) <= 0) return { ok: false, reason: 'invalid-actor' }
  if (target ? target.currentHp <= 0 : (targetToken.hp ?? 1) <= 0) return { ok: false, reason: 'invalid-target' }
  if (dnd5eMeleeTargetOpportunityAttackSuppressed(target, actorToken.id)) {
    return { ok: false, reason: 'invalid-target' }
  }
  if (
    input.reactionFeature === 'berserker-retaliation' &&
    (
      !actor ||
      dnd5eCharacterClassLevel(actor, 'barbarian') < 14 ||
      actor.dnd5eClassChoices?.classes?.barbarian?.subclass !== 'berserker' ||
      actor.dnd5eCombatState?.berserkerRetaliationTrigger?.sourceId !== targetToken.id ||
      actor.dnd5eCombatState.berserkerRetaliationTrigger.round !== Math.max(1, input.round ?? 1)
    )
  ) return { ok: false, reason: 'invalid-actor' }
  if (
    input.reactionFeature === 'hunter-giant-killer' &&
    (
      !actor || dnd5eCharacterClassLevel(actor, 'ranger') < 3 ||
      actor.dnd5eClassChoices?.classes?.ranger?.subclass !== 'hunter' ||
      !actor.dnd5eClassChoices?.classes?.ranger?.selections?.['hunters-prey']?.includes('giant-killer')
    )
  ) return { ok: false, reason: 'invalid-actor' }
  const declarativeReactionFeature = input.reactionFeature === 'declarative-reaction-weapon-attack' &&
    input.reactionFeatureId
    ? dnd5ePluginFeatureDefinition(input.reactionFeatureId)
    : undefined
  const declarativeReactionAbility = declarativeReactionFeature?.declarativeAbility
  if (input.reactionFeature === 'declarative-reaction-weapon-attack') {
    const opportunity = input.reactionFeatureId
      ? actor?.dnd5eCombatState?.declarativeReactionWeaponAttackOpportunities?.[input.reactionFeatureId]
      : undefined
    if (
      !actor || !input.reactionFeatureId || !declarativeReactionFeature ||
      declarativeReactionFeature.automation === 'manual' || declarativeReactionAbility?.automation !== 'full' ||
      declarativeReactionAbility?.mechanic?.kind !== 'reaction-weapon-attack' ||
      !dnd5eCharacterHasPluginFeature(actor, input.reactionFeatureId) ||
      opportunity?.targetId !== targetToken.id ||
      opportunity.round !== Math.max(1, input.round ?? 1)
    ) return { ok: false, reason: 'invalid-actor' }
  } else if (input.reactionFeatureId != null) return { ok: false, reason: 'invalid-actor' }

  const playerProfile = actor?.rulesetId === 'dnd5e-2014-srd-5.1' ? dnd5eWeaponAttackProfile(actor) : undefined
  const monster = actorToken.poolId ? getDnd5eSrdMonster(actorToken.poolId) : undefined
  const monsterAction = monster?.actions.find((action) =>
    dnd5eMonsterActionAutomation(action) === 'headless' && action.kind === 'weapon-attack' && action.attack && (action.attack.mode === 'melee' || action.attack.mode === 'melee-or-ranged'),
  )
  const monsterDamage = monsterAction?.attack?.damage[0]
  const isPlayerMelee = playerProfile?.mode === 'melee'
  if (!isPlayerMelee && (!monsterAction?.attack || !monsterDamage)) return { ok: false, reason: 'no-melee-weapon' }
  const reachFeet = input.reactionFeature === 'declarative-reaction-weapon-attack'
    ? declarativeReactionAbility?.targeting.kind === 'single-creature'
      ? (declarativeReactionAbility.targeting.rangeFeet ?? 5)
      : 5
    : input.reactionFeature
      ? 5
    : isPlayerMelee ? (playerProfile.reachFeet ?? 5) : (monsterAction!.attack!.reachFeet ?? 5)
  const distanceFeet = dnd5eMapTokenDistanceFeet({
    map: input.map,
    geometry: mapGeometryRuntimeForMap(input.map.id),
    left: actorToken,
    right: targetToken,
  })
  if (distanceFeet > reachFeet) return { ok: false, reason: 'target-out-of-range' }

  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  const targetCombatant = snapshot.state.combatants[targetToken.id]
  if (!actorCombatant || !targetCombatant) return { ok: false, reason: 'combatant-missing' }
  // Reject before opening a reaction/roll prompt. The Headless attack resolver
  // repeats this check at commit time, but effects such as Calm Emotions and
  // charmed must also suppress the UI interrupt itself rather than asking for
  // and confirming dice that can never produce a legal attack.
  if (dnd5eCannotAttackSource(actorCombatant, targetCombatant.id)) {
    return { ok: false, reason: 'invalid-target' }
  }
  const targetInitiativeIndex = snapshot.state.initiativeOrder.indexOf(targetToken.id)
  if (targetInitiativeIndex >= 0) snapshot.state.initiativeIndex = targetInitiativeIndex
  if (dnd5eReactionsPrevented(actorCombatant)) return { ok: false, reason: 'reaction-unavailable' }
  if (!dnd5eCombatantCanSee(snapshot.state, actorToken.id, targetToken.id)) {
    return { ok: false, reason: 'target-not-visible' }
  }
  actorCombatant.turn = {
    actionAvailable: input.turnEconomy.action.current > 0,
    bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
    reactionAvailable: true,
    movementRemaining: input.turnEconomy.movement.current,
  }
  if (input.targetTurnEconomy) {
    targetCombatant.turn = {
      actionAvailable: input.targetTurnEconomy.action.current > 0,
      bonusActionAvailable: input.targetTurnEconomy.bonusAction.current > 0,
      reactionAvailable: input.targetTurnEconomy.reaction.current > 0,
      movementRemaining: input.targetTurnEconomy.movement.current,
    }
  }
  const classDamageContext: Dnd5eWeaponClassDamageContext | undefined = isPlayerMelee
    ? {
        weaponId: playerProfile.weaponId,
        weaponProperties: [...dnd5eWeaponPropertyIds(playerProfile.properties)],
        proficient: playerProfile.proficient,
        mode: 'melee',
        finesse: playerProfile.finesse,
        strengthBased: playerProfile.attackAbility === 'str',
        weaponDamageSides: playerProfile.damage.sides,
        damageType: playerProfile.damage.type,
        adjacentEnemyOfTarget: input.map.tokens.some((candidate) => {
          if (
            candidate.id === actorToken.id || candidate.id === targetToken.id ||
            candidate.type === 'obstacle' || !areOpposedCombatTokens(candidate, targetToken)
          ) return false
          const combatant = snapshot.state.combatants[candidate.id]
          return !!combatant && combatant.currentHp > 0 &&
            tokenFootprintDistanceCells(candidate, targetToken, input.map) *
              Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL) <= 5
        }),
      }
    : undefined
  const advantageAllowed = !dnd5ePreventsAttackAdvantage(targetCombatant)
  const targetProne = targetCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const actorProne = actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const attackModeResolution = resolveDnd5eRollMode({
    advantage: [
      ...dnd5eTargetAttackAdvantageReasons(targetCombatant)
        .map((reason) => ({ active: advantageAllowed, reason })),
      { active: advantageAllowed && dnd5eHelpAttackApplies(snapshot.state, actorCombatant, targetCombatant), reason: '协助动作' },
      { active: advantageAllowed && dnd5eUtilityProjectionAttackAdvantageApplies(snapshot.state, actorCombatant, targetCombatant), reason: '规则效果提供攻击优势' },
      { active: advantageAllowed && dnd5eNextD20AdvantageApplies(actorCombatant, 'attack'), reason: '下一次 d20 攻击优势' },
      { active: advantageAllowed && dnd5eAttackerIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id), reason: '目标看不见攻击者' },
      { active: advantageAllowed && actorCombatant.classState.hiddenCheckTotal != null, reason: '攻击者处于隐藏状态' },
      { active: advantageAllowed && targetProne, reason: '目标倒地且攻击者在 5 尺内' },
      { active: advantageAllowed && dnd5eRageAllyMeleeAdvantage(snapshot.state, actorCombatant, targetCombatant, true), reason: '狂暴盟友能力提供近战优势' },
    ],
    disadvantage: [
      ...dnd5eAttackDisadvantageReasons(snapshot.state, actorToken.id, targetToken.id)
        .map((reason) => ({ active: true, reason })),
      { active: dnd5eHasViciousMockeryAttackDisadvantage(actorCombatant), reason: '恶毒嘲笑' },
      { active: !!actor && dnd5eWearingUnproficientArmor(actor), reason: '穿着不熟练的护甲' },
      { active: actorCombatant.exhaustionLevel >= 3, reason: '3 级或更高力竭' },
      { active: dnd5eFrightenedAttackDisadvantage(snapshot.state, actorCombatant), reason: '攻击者处于恐慌且能看见恐惧源' },
      { active: dnd5eTargetIsDodging(targetCombatant), reason: '目标正在闪避' },
      { active: dnd5eBlurImposesAttackDisadvantage(snapshot.state, actorToken.id, targetToken.id), reason: '目标受朦胧术影响' },
      { active: dnd5eTargetIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id), reason: '攻击者看不见目标' },
      { active: actorProne, reason: '攻击者处于倒地状态' },
      { active: targetCombatant.classId === 'ranger' && targetCombatant.subclassId === 'hunter' && targetCombatant.level >= 7 && targetCombatant.classSelections['defensive-tactics']?.includes('escape-the-horde'), reason: '逃脱众敌令借机攻击具有劣势' },
      { active: dnd5eRageAllyProtectionDisadvantage(snapshot.state, actorCombatant, targetCombatant), reason: '目标受到盟友保护能力影响' },
      { active: dnd5eRageOpportunityDisadvantage(targetCombatant, true), reason: '目标能力令借机攻击具有劣势' },
    ],
  })
  const attackMode = attackModeResolution.mode
  return {
    ok: true,
    prepared: {
      map: input.map,
      characters: input.characters,
      state: snapshot.state,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      actorToken,
      targetToken,
      actorName: actor?.name ?? actorToken.label,
      targetName: target?.name ?? targetToken.label,
      weaponName: isPlayerMelee ? playerProfile.weaponName : monsterAction!.name,
      attackModifier: isPlayerMelee ? playerProfile.attackModifier : monsterAction!.attack!.toHit,
      criticalThreshold: isPlayerMelee ? playerProfile.criticalThreshold : 20,
      attackMode,
      attackModeResolution,
      targetArmorClass: dnd5eTargetArmorClassForAttack(snapshot.state, actorToken.id, targetToken.id),
      damage: isPlayerMelee ? { ...playerProfile.damage } : { ...monsterDamage! },
      classDamageContext,
      reachFeet,
      reactionFeature: input.reactionFeature,
      reactionFeatureId: input.reactionFeatureId,
      tranquilityWard: dnd5eTranquilityWardCheck(actorCombatant, targetCombatant, snapshot.state),
      blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bless'),
      baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bane'),
    },
  }
}

export function previewDnd5eOpportunityAttack(prepared: PreparedDnd5eOpportunityAttack, d20: number, d20Second?: number, blessRoll?: number, baneRoll?: number, postD20Adjustment?: Dnd5ePostD20AdjustmentUse) {
  const rolls = prepared.attackMode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  const resolved = rules.resolveAttack({ rolls, mode: prepared.attackMode, modifier: prepared.attackModifier + (blessRoll ?? 0) - (baneRoll ?? 0), targetAc: prepared.targetArmorClass })
  const adjusted = previewDnd5ePostD20AdjustedAttack({
    state: prepared.state,
    affectedId: prepared.actorToken.id,
    targetAc: prepared.targetArmorClass,
    resolution: resolved,
    use: postD20Adjustment,
  })
  // Expanded critical thresholds (e.g. Champion 19) only crit on a hit.
  // Natural 20 still auto-hits via the attack resolver.
  const critical = adjusted.hit && adjusted.roll.d20 >= prepared.criticalThreshold
  return { ...adjusted, hit: adjusted.hit, critical }
}

export function dnd5eOpportunityAttackClassDamageDefinitions(
  prepared: PreparedDnd5eOpportunityAttack,
  critical: boolean,
): readonly Dnd5eClassDamageDefinition[] {
  if (!prepared.classDamageContext) return []
  return dnd5eWeaponClassDamageDefinitions({
    state: prepared.state,
    actorId: prepared.actorToken.id,
    targetId: prepared.targetToken.id,
    context: prepared.classDamageContext,
    effectiveMode: prepared.attackMode,
    critical,
  })
}

export function resolvePreparedDnd5eOpportunityAttack(input: {
  prepared: PreparedDnd5eOpportunityAttack
  d20: number
  d20Second?: number
  halflingLuckyD20?: number
  halflingLuckyD20Second?: number
  blessRoll?: number
  baneRoll?: number
  bardicInspirationRoll?: number
  strokeOfLuck?: boolean
  cuttingWords?: Dnd5eCuttingWordsUse
  cuttingWordsDamage?: Dnd5eCuttingWordsUse
  postD20Adjustment?: Dnd5ePostD20AdjustmentUse
  shieldSpellReaction?: boolean
  uncannyDodge?: boolean
  tranquilitySave?: Dnd5eTranquilitySaveRoll
  hurlThroughHellDamageRolls?: readonly number[]
  standAgainstTide?: Dnd5eStandAgainstTideUse
  damageRolls: readonly number[]
  savageAttacksRoll?: number
  wholeWeaponDamageReroll?: Dnd5eWholeWeaponDamageRerollUse
  classDamageRolls?: readonly Dnd5eClassDamageRolls[]
  inventoryEffectRolls?: Readonly<Record<string, readonly number[]>>
  airborneFallDamageRollsByCombatantId?: Dnd5eAirborneFallDamageRolls
  attackDecoyRolls?: readonly import('./headlessCombatEngine').Dnd5eAttackDecoyOccurrenceRoll[]
}): {
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  airborneFalls?: readonly Dnd5eAirborneFallPreview[]
} {
  const { prepared } = input
  const { result, airborneFalls } = resolveDnd5eActionWithAirborneFallPreview(prepared.state, {
    type: 'opportunity-attack',
    attackDecoyRolls: input.attackDecoyRolls,
    actorId: prepared.actorToken.id,
    targetId: prepared.targetToken.id,
    attackModifier: prepared.attackModifier,
    criticalThreshold: prepared.criticalThreshold,
    d20: input.d20,
    d20Second: input.d20Second,
    halflingLuckyD20: input.halflingLuckyD20,
    halflingLuckyD20Second: input.halflingLuckyD20Second,
    blessRoll: input.blessRoll,
    baneRoll: input.baneRoll,
    bardicInspirationRoll: input.bardicInspirationRoll,
    strokeOfLuck: input.strokeOfLuck,
    cuttingWords: input.cuttingWords,
    cuttingWordsDamage: input.cuttingWordsDamage,
    postD20Adjustment: input.postD20Adjustment,
    shieldSpellReaction: input.shieldSpellReaction,
    uncannyDodge: input.uncannyDodge,
    tranquilitySave: input.tranquilitySave,
    hurlThroughHellDamageRolls: input.hurlThroughHellDamageRolls,
    standAgainstTide: input.standAgainstTide,
    mode: prepared.attackMode,
    reactionFeature: prepared.reactionFeature,
    reactionFeatureId: prepared.reactionFeatureId,
    damage: { ...prepared.damage, rolls: input.damageRolls },
    savageAttacksRoll: input.savageAttacksRoll,
    wholeWeaponDamageReroll: input.wholeWeaponDamageReroll,
    classDamageContext: prepared.classDamageContext,
    classDamageRolls: input.classDamageRolls,
    inventoryEffectRolls: input.inventoryEffectRolls,
  }, input.airborneFallDamageRollsByCombatantId)
  if (!result.ok) return { result, airborneFalls }
  return {
    result,
    airborneFalls,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: prepared.map,
      characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
      events: [...result.events],
    }),
  }
}
