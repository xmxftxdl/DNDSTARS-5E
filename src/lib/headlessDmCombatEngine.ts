import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type { BattleMap, Token } from '../store/maps'
import type { Character, ClassFeatureKey, CombatSkill } from '../types/character'
import {
  applyAttackDefenseDamageModifier,
  characterToCombatInput,
  computeCritDamageMultiplier,
  getAc,
  isMagicDamageSkill,
  resolveAttackDamageTotal,
  type DamageReductionType,
} from './combatStats'
import { adjustDamageAgainstToken, enemyCombatInput, getTokenTargetAc } from './enemyCombatStats'
import { getEnemyStatBlock, getPrimaryAttackAction } from './enemyStatBlocks'
import {
  cellDistance,
  pixelToCell,
  snapTokenToGridCenter,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenFootprintDistanceCells,
} from './gridCombat'
import { checkCombatOutcome, decideTurnAction, hasActionableActor, isTokenAlive, shouldApplyDotTick } from './combatTokens'
import { resolveCombatMovement, type CombatMovementMode } from './combatMovementPipeline'
import { beginCalmMindTurn, calmBreathState, initCalmMindForCombat, isCalmMindActive, tickOutOfBreathOnEndTurn, triggerOutOfBreath } from './calmMind'
import { areOpposedCombatTokens, findOpportunityAttackersForMove } from './opportunityAttacks'
import { attackDamageDiceCount, getEffectiveAbilityMod } from './archerCombat'
import { ENEMY_MELEE_ATTACK_BONUS, agileLeapMoveFeet } from './archerBaseFeatures'
import { proficiencyBonus, type AbilityKey } from './dnd'
import { getTokenAbilityMod, KNOCKBACK_DEFAULT_TURNS, KNOCKBACK_STATUS_LABEL } from './knockback'
import { decideDodge } from './aiPolicy'
import { findClassTrait } from './classFeatures'
import { resetCombatTraitUses } from './traitRegistry'
import { IGNITE_STATUS_LABEL } from './ignite'
import { STUN_DEFAULT_TURNS, STUN_STATUS_LABEL } from './stun'
import {
  BURNING_STATUS_LABEL,
  NO_MOVE_STATUS_LABEL,
  POISON_STATUS_LABEL,
  RESTRAINED_STATUS_LABEL,
  VULNERABLE_STATUS_LABEL,
} from './tokenStatus'
import { TOKEN_STATUS_CLEAR_PATCH, isTokenMovementLocked } from './combatStatus'
import { dotDamageFor } from './statusDamage'
import { creatureSizeToFootprintCells, sizeFromTokenSize } from './monsterTypes'

export interface HeadlessEnemyApState {
  current: number
  max: number
}

export interface HeadlessDmCombatState {
  map: BattleMap
  characters: Character[]
  active: boolean
  round: number
  initiativeIndex: number
  initiativeOrder: InitiativeEntry[]
  enemyApByToken: Record<string, HeadlessEnemyApState>
  disengagedCharacterIds?: string[]
}

export interface HeadlessStartCombatOptions {
  clearStatuses?: boolean
}

export type HeadlessCombatEvent =
  | { type: 'ap-spent'; tokenId: string; characterId?: string; amount: number; before: number; after: number }
  | { type: 'dice-rolled'; notation: string; values: number[]; total: number }
  | { type: 'damage-applied'; targetTokenId: string; characterId?: string; amount: number; hpBefore: number; hpAfter: number }
  | {
      type: 'token-moved'
      tokenId: string
      from: { x: number; y: number }
      to: { x: number; y: number }
      feet: number
      triggersMoveEffects: boolean
    }
  | { type: 'turn-advanced'; round: number; initiativeIndex: number; tokenId?: string }
  | { type: 'turn-started'; round: number; initiativeIndex: number; tokenId: string; characterId?: string }
  | { type: 'combat-ended'; winner: 'ally' | 'enemy'; message: string }
  | { type: 'status-added'; targetTokenId: string; characterId?: string; condition: string; turns?: number }
  | {
      type: 'status-save-resolved'
      actorTokenId: string
      targetTokenId: string
      condition: string
      ability: AbilityKey
      d20Value: number
      saveMod: number
      total: number
      dc: number
      success: boolean
    }
  | { type: 'opportunity-triggered'; attackerTokenId: string; movingTokenId: string }
  | {
      type: 'attack-resolved'
      actorTokenId: string
      characterId: string
      targetTokenId: string
      skillId: string
      skillName: string
      damageValues: number[]
      diceTotal: number
      baseDamage: number
      damageBeforeDefense: number
      modifier: number
      diff: number
      total: number
      isCrit: boolean
      hit: boolean
      targetDodged: boolean
      waivedAp: boolean
      apCost: number
    }
  | {
      type: 'target-dodge-resolved'
      actorTokenId: string
      targetTokenId: string
      d20Value: number
      attackBonus: number
      total: number
      targetAc: number
      dodged: boolean
      reason: string
      successChance: number
    }
  | {
      type: 'enemy-attack-resolved'
      actorTokenId: string
      targetTokenId: string
      actionName: string
      damageValues: number[]
      diceTotal: number
      damageBonus: number
      rawDamage: number
      damageBeforeDefense: number
      modifier: number
      diff: number
      total: number
      targetDodged: boolean
      dodgeD20?: number
      dodgeAttackBonus?: number
      dodgeTotal?: number
      targetAc?: number
      saveD20?: number
      saveMod?: number
      saveTotal?: number
      saveDc?: number
      saveSuccess?: boolean
      stableMindUsed?: boolean
      arcaneSurgeUsed?: boolean
    }
  | {
      type: 'aoe-target-resolved'
      actorTokenId: string
      characterId: string
      targetTokenId: string
      skillId: string
      skillName: string
      damageValues: number[]
      diceTotal: number
      baseDamage: number
      damageBeforeSave: number
      modifier: number
      diff: number
      total: number
      saveD20?: number
      saveMod?: number
      saveTotal?: number
      saveDc?: number
      saveSuccess?: boolean
      saveMode?: 'half' | 'none' | 'fail-half'
      waivedAp: boolean
      apCost: number
    }
  | {
      type: 'opportunity-resolved'
      attackerTokenId: string
      targetTokenId: string
      d20Value: number
      attackBonus: number
      targetAc: number
      hit: boolean
      isCrit: boolean
      damageValues: number[]
      rawDamage: number
      damageBeforeDefense: number
      modifier: number
      diff: number
      total: number
    }
  | { type: 'log'; text: string }

export interface HeadlessPlayerMoveAction {
  type: 'move-token'
  actorTokenId: string
  characterId: string
  targetPosition: { x: number; y: number }
  mode?: Extract<CombatMovementMode, 'turn-move' | 'agile-leap' | 'skill-free-move' | 'calm-spirit-move'>
  deferTokenMove?: boolean
}

export interface HeadlessEnemyMoveAction {
  type: 'enemy-move-token'
  actorTokenId: string
  targetPosition: { x: number; y: number }
  apCost?: number
}

export interface HeadlessDisengageAction {
  type: 'disengage'
  actorTokenId: string
  characterId: string
}

export interface HeadlessUseSkillAction {
  type: 'use-skill'
  actorTokenId: string
  characterId: string
  skillId: string
}

export interface HeadlessPlayerAttackAction {
  type: 'attack-token'
  actorTokenId: string
  characterId: string
  targetTokenId: string
  skillId: string
  diceValues?: number[]
  targetDodgeD20?: number
  targetDodgeMode?: 'auto' | 'attempt' | 'skip'
  ignoreTargetDodge?: boolean
  attackRoll?: HeadlessAttackRollPacket
  isCrit?: boolean
  additionalCritMultiplier?: number
  targetPackets?: HeadlessPlayerAttackPacket[]
}

export interface HeadlessPlayerAttackPacket {
  targetTokenId: string
  damageDiceCount?: number
  diceValues?: number[]
  extraDamageGroups?: HeadlessExtraDamageGroup[]
  extraDamageValues?: number[]
  extraDamageSides?: number
  postCritDamageGroups?: HeadlessExtraDamageGroup[]
  postCritDamageValues?: number[]
  postCritDamageSides?: number
  halveDamageOnRangeFeet?: { minExclusive: number; maxInclusive: number }
  targetDodgeD20?: number
  targetDodgeMode?: 'auto' | 'attempt' | 'skip'
  ignoreTargetDodge?: boolean
  attackRoll?: HeadlessAttackRollPacket
  isCrit?: boolean
  additionalCritMultiplier?: number
  effectSave?: HeadlessAttackEffectSavePacket
  stunOnFailedEffectSave?: boolean
  knockbackOnFailedEffectSave?: boolean
  knockbackTurns?: number
  restrainedOnFailedEffectSave?: boolean
  pullOnFailedEffectSave?: boolean
  pullCells?: number
  smallOrMediumOnly?: boolean
  grantBurstKickExtraD6OnHit?: number
  clearBurstKickExtraD6OnUse?: boolean
  pushTargetOnHit?: boolean
  pushCells?: number
  selfCooldownReductionOnHit?: number
  clearWindKickTreatKnockbackOnUse?: boolean
  clearActorConditionOnHit?: string
  grantFreeMoveFeetOnHit?: number
  grantDisengageOnHit?: boolean
  grantWindKickTreatKnockbackOnHit?: boolean
  noMoveOnHit?: boolean
  noMoveTurns?: number
  burningOnHit?: boolean
  burningTurns?: number
  igniteOnHit?: boolean
  igniteTurns?: number
  cooldownReductionSkillId?: string
  cooldownReductionAmount?: number
  vulnerableOnHit?: boolean
  vulnerableTurns?: number
  clearTargetStatusesOnHit?: boolean
  selfCooldownReductionPerClearedStatus?: boolean
  armorPiercingSplashOnCrit?: boolean
  armorPiercingRangeFeet?: number
  spendArmorPiercingUseOnSplash?: boolean
  clearDoubleArrowReadyOnUse?: boolean
  spendDoubleArrowUseOnHit?: boolean
  clearPreciseStrikeReadyOnHit?: boolean
  spendPreciseStrikeUseOnHit?: boolean
  clearShadowVeilTargetOnUse?: boolean
  addHuntingMarkOnDamage?: boolean
  markSilentDrawUsedOnHit?: boolean
  clearCalmSpiritCritBonusOnUse?: boolean
}

export interface HeadlessExtraDamageGroup {
  values?: number[]
  sides: number
}

export interface HeadlessAttackRollPacket {
  d20?: number
  d20Second?: number
  ability?: AbilityKey
  targetAc?: number
  critThreshold?: number
  forceCrit?: boolean
}

export interface HeadlessAttackEffectSavePacket {
  ability: AbilityKey
  d20?: number
  d20Second?: number
  disadvantage?: boolean
}

export interface HeadlessEnemyAttackAction {
  type: 'enemy-attack-token'
  actorTokenId: string
  targetTokenId: string
  actionIndex?: number
  diceValues?: number[]
  huntingBacklashValues?: number[]
  saveD20?: number
  useStableMind?: boolean
  actorApAlreadySpent?: boolean
  targetWantsDodge?: boolean
  targetDodgeD20?: number
  targetDodgeApAlreadySpent?: boolean
  useArcaneSurgeOnLethal?: boolean
}

export interface HeadlessStableMindAction {
  type: 'stable-mind'
  actorTokenId: string
  characterId: string
}

export interface HeadlessArcaneSurgeAction {
  type: 'arcane-surge'
  actorTokenId: string
  characterId: string
}

export interface HeadlessAgileLeapReadyAction {
  type: 'agile-leap-ready'
  actorTokenId: string
  characterId: string
  feet: number
}

export interface HeadlessActivateFeatureAction {
  type: 'activate-feature'
  actorTokenId: string
  characterId: string
  featureKey: Extract<
    ClassFeatureKey,
    | 'eagleEye'
    | 'doubleArrow'
    | 'preciseStrike'
    | 'stillWater'
    | 'finale'
    | 'illusionDance'
    | 'shadowVeil'
    | 'trackingArrow'
    | 'flexibleBody'
    | 'showtime'
    | 'windBlade'
  >
  targetTokenId?: string
  targetTokenIds?: string[]
  targetPackets?: HeadlessFeatureTargetPacket[]
  finaleDamageValues?: number[]
}

export interface HeadlessFeatureTargetPacket {
  targetTokenId: string
  saveD20?: number
}

export interface HeadlessQiReduceCooldownAction {
  type: 'qi-reduce-cooldown'
  actorTokenId: string
  characterId: string
  skillId: string
}

export interface HeadlessCalmSpiritAction {
  type: 'calm-spirit'
  actorTokenId: string
  characterId: string
  effect: 'move' | 'crit' | 'cooldown' | 'extraTurn'
  skillId?: string
}

export interface HeadlessAoeAttackAction {
  type: 'aoe-attack'
  actorTokenId: string
  characterId: string
  skillId: string
  targetPackets: HeadlessAoeTargetPacket[]
  diceValues?: number[]
  cellCount?: number
  saveMode?: 'half' | 'none' | 'fail-half'
  knockbackOnFailedSave?: boolean
  knockbackTurns?: number
  stunOnFailedConSave?: boolean
  stunTurns?: number
  selfCooldownReduction?: number
}

export interface HeadlessAoeTargetPacket {
  targetTokenId: string
  saveD20?: number
  stunSaveD20?: number
  extraDamageGroups?: HeadlessExtraDamageGroup[]
}

export interface HeadlessOpportunityAttackAction {
  type: 'opportunity-attack-token'
  actorTokenId: string
  targetTokenId: string
  d20Value?: number
  damageValues?: number[]
}

export interface HeadlessEndTurnAction {
  type: 'end-turn'
  actorTokenId: string
  characterId?: string
}

export interface HeadlessCommitTokenMoveAction {
  type: 'commit-token-move'
  actorTokenId: string
  characterId: string
  targetPosition: { x: number; y: number }
  feet?: number
}

export type HeadlessCombatAction =
  | HeadlessPlayerMoveAction
  | HeadlessEnemyMoveAction
  | HeadlessDisengageAction
  | HeadlessUseSkillAction
  | HeadlessPlayerAttackAction
  | HeadlessEnemyAttackAction
  | HeadlessStableMindAction
  | HeadlessArcaneSurgeAction
  | HeadlessAgileLeapReadyAction
  | HeadlessActivateFeatureAction
  | HeadlessQiReduceCooldownAction
  | HeadlessCalmSpiritAction
  | HeadlessAoeAttackAction
  | HeadlessOpportunityAttackAction
  | HeadlessEndTurnAction
  | HeadlessCommitTokenMoveAction

export type HeadlessCombatFailureReason =
  | 'combat-ended'
  | 'stale-turn'
  | 'invalid-actor'
  | 'invalid-target'
  | 'invalid-action'
  | 'invalid-skill'
  | 'invalid-dice'
  | 'insufficient-ap'
  | 'insufficient-resource'
  | 'out-of-range'
  | 'movement-locked'
  | 'unsupported-action'

export interface HeadlessCombatSuccess {
  ok: true
  state: HeadlessDmCombatState
  events: HeadlessCombatEvent[]
}

export interface HeadlessCombatFailure {
  ok: false
  state: HeadlessDmCombatState
  reason: HeadlessCombatFailureReason
  events: HeadlessCombatEvent[]
}

export type HeadlessCombatResult = HeadlessCombatSuccess | HeadlessCombatFailure

export interface HeadlessGaleComboChoiceResult {
  ok: boolean
  state: HeadlessDmCombatState
  events: HeadlessCombatEvent[]
  reason?: 'not-found' | 'unavailable'
}

export interface HeadlessGaleComboConsumptionResult {
  ok: boolean
  state: HeadlessDmCombatState
  events: HeadlessCombatEvent[]
  reason?: 'not-found' | 'unavailable'
}

export interface HeadlessDiceRoller {
  rollDice(count: number, sides: number, label?: string): number[]
}

export function createSeededHeadlessDiceRoller(seed: string | number): HeadlessDiceRoller {
  let state = hashSeed(String(seed)) || 1
  const nextUnit = () => {
    state = (state + 0x6d2b79f5) | 0
    let next = Math.imul(state ^ (state >>> 15), 1 | state)
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
  return {
    rollDice(count, sides) {
      return Array.from({ length: Math.max(0, Math.floor(count)) }, () =>
        1 + Math.floor(nextUnit() * Math.max(2, Math.floor(sides))),
      )
    },
  }
}

export function createFixedHeadlessDiceRoller(values: number[]): HeadlessDiceRoller {
  let index = 0
  return {
    rollDice(count, sides) {
      return Array.from({ length: Math.max(0, Math.floor(count)) }, () => {
        const value = values[index++] ?? 1
        return Math.max(1, Math.min(Math.floor(sides), Math.floor(value)))
      })
    },
  }
}

function hashSeed(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function cloneCharacter(character: Character): Character {
  return {
    ...character,
    abilities: { ...character.abilities },
    savingThrows: [...character.savingThrows],
    skills: [...character.skills],
    traits: character.traits.map((trait) => ({ ...trait })),
    combatSkills: character.combatSkills.map((skill) => ({
      ...skill,
      tags: skill.tags ? [...skill.tags] : undefined,
    })),
    conditions: [...character.conditions],
    combatBuffs: character.combatBuffs ? { ...character.combatBuffs } : undefined,
    skillRanks: character.skillRanks ? { ...character.skillRanks } : undefined,
    equipment: character.equipment ? { ...character.equipment } : undefined,
  }
}

function cloneMap(map: BattleMap): BattleMap {
  return {
    ...map,
    tokens: map.tokens.map((token) => ({
      ...token,
      creatureTypes: token.creatureTypes ? [...token.creatureTypes] : undefined,
    })),
  }
}

export function cloneHeadlessCombatState(state: HeadlessDmCombatState): HeadlessDmCombatState {
  return {
    ...state,
    map: cloneMap(state.map),
    characters: state.characters.map(cloneCharacter),
    initiativeOrder: state.initiativeOrder.map((entry) => ({ ...entry })),
    enemyApByToken: Object.fromEntries(
      Object.entries(state.enemyApByToken).map(([tokenId, ap]) => [tokenId, { ...ap }]),
    ),
    disengagedCharacterIds: state.disengagedCharacterIds?.slice(),
  }
}

export function startHeadlessCombat(
  state: HeadlessDmCombatState,
  dice: HeadlessDiceRoller = createSeededHeadlessDiceRoller(`${state.round}:start-combat`),
  options: HeadlessStartCombatOptions = {},
): HeadlessDmCombatState {
  const next = cloneHeadlessCombatState(state)
  const events: HeadlessCombatEvent[] = []
  next.active = next.initiativeOrder.length > 0
  next.round = Math.max(1, next.round || 1)
  next.initiativeIndex = Math.min(Math.max(0, next.initiativeIndex || 0), Math.max(0, next.initiativeOrder.length - 1))
  if (options.clearStatuses) clearCombatStartStatuses(next)
  resetCombatStartCharacters(next, dice, events)
  resetRoundAp(next)
  applyHeadlessCurrentTurnStart(next, events)
  return next
}

export function resolveHeadlessDmAction(
  state: HeadlessDmCombatState,
  action: HeadlessCombatAction,
  dice: HeadlessDiceRoller = createSeededHeadlessDiceRoller(`${state.round}:${state.initiativeIndex}:${action.type}`),
): HeadlessCombatResult {
  const next = cloneHeadlessCombatState(state)
  const events: HeadlessCombatEvent[] = []
  if (!next.active) return fail(next, 'combat-ended', events)

  const turn = getCurrentTurn(next)
  if (
    action.type !== 'opportunity-attack-token' &&
    action.type !== 'stable-mind' &&
    action.type !== 'arcane-surge' &&
    action.type !== 'agile-leap-ready' &&
    (!turn || turn.tokenId !== action.actorTokenId)
  ) {
    return fail(next, 'stale-turn', events)
  }

  switch (action.type) {
    case 'move-token':
      return resolveMove(next, action, events)
    case 'enemy-move-token':
      return resolveEnemyMove(next, action, events)
    case 'disengage':
      return resolveDisengage(next, action, events)
    case 'use-skill':
      return resolveUseSkill(next, action, events)
    case 'attack-token':
      return resolvePlayerAttack(next, action, dice, events)
    case 'aoe-attack':
      return resolveAoeAttack(next, action, dice, events)
    case 'enemy-attack-token':
      return resolveEnemyAttack(next, action, dice, events)
    case 'stable-mind':
      return resolveStableMind(next, action, events)
    case 'arcane-surge':
      return resolveArcaneSurge(next, action, events)
    case 'agile-leap-ready':
      return resolveAgileLeapReady(next, action, events)
    case 'activate-feature':
      return resolveActivateFeature(next, action, dice, events)
    case 'qi-reduce-cooldown':
      return resolveQiReduceCooldown(next, action, events)
    case 'calm-spirit':
      return resolveCalmSpirit(next, action, events)
    case 'opportunity-attack-token':
      return resolveOpportunityAttack(next, action, dice, events)
    case 'commit-token-move':
      return resolveCommitTokenMove(next, action, events)
    case 'end-turn': {
      if (action.characterId) {
        const actor = findCharacter(next, action.characterId)
        if (!actor) return fail(next, 'invalid-actor', events)
        applyHeadlessEndTurnEffects(next, actor.id, dice, events)
      }
      advanceHeadlessTurn(next, events)
      return succeed(next, events)
    }
    default:
      return fail(next, 'unsupported-action', events)
  }
}

export function resolveHeadlessGaleComboChoice(
  state: HeadlessDmCombatState,
  params: { characterId: string; accepted: boolean; triggerLabel?: string },
): HeadlessGaleComboChoiceResult {
  const next = cloneHeadlessCombatState(state)
  const events: HeadlessCombatEvent[] = []
  const character = findCharacter(next, params.characterId)
  if (!character) return { ok: false, state: next, events, reason: 'not-found' }
  if (!params.accepted) {
    events.push({ type: 'log', text: `${character.name} 暂不发动疾风连击。` })
    return { ok: true, state: next, events }
  }
  const trait = character.traits.find((item) => item.featureKey === 'galeCombo')
  if (!trait || trait.uses <= 0 || character.combatBuffs?.galeComboReady) {
    return { ok: false, state: next, events, reason: 'unavailable' }
  }
  updateCharacter(next, character.id, (item) => ({
    ...item,
    combatBuffs: { ...item.combatBuffs, galeComboReady: true },
  }))
  events.push({
    type: 'log',
    text: `${character.name} 发动疾风连击：下一次技能或基础射击不消耗 AP。`,
  })
  return { ok: true, state: next, events }
}

export function resolveHeadlessGaleComboConsumption(
  state: HeadlessDmCombatState,
  params: { characterId: string; actionLabel: string },
): HeadlessGaleComboConsumptionResult {
  const next = cloneHeadlessCombatState(state)
  const events: HeadlessCombatEvent[] = []
  const character = findCharacter(next, params.characterId)
  if (!character) return { ok: false, state: next, events, reason: 'not-found' }
  if (!character.combatBuffs?.galeComboReady) {
    return { ok: false, state: next, events, reason: 'unavailable' }
  }
  consumeGaleComboReady(next, character.id, params.actionLabel, events)
  return { ok: true, state: next, events }
}

function resolveMove(
  state: HeadlessDmCombatState,
  action: HeadlessPlayerMoveAction,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  const mode = action.mode ?? 'turn-move'
  const movement = resolveCombatMovement({
    map: state.map,
    characters: state.characters,
    actorTokenId: action.actorTokenId,
    characterId: action.characterId,
    targetPosition: action.targetPosition,
    mode,
    active: state.active,
    currentTurnTokenId: getCurrentTurn(state)?.tokenId,
  })
  if (!movement.ok) return fail(state, movement.reason, events)
  const actor = movement.actor
  if (!actor) return fail(state, 'invalid-actor', events)

  if (movement.characterPatch) {
    const before = actor.currentAP
    updateCharacter(state, actor.id, (item) => {
      let next: Character = {
        ...item,
        ...movement.characterPatch,
        combatBuffs: movement.characterPatch?.combatBuffs
          ? { ...item.combatBuffs, ...movement.characterPatch.combatBuffs }
          : item.combatBuffs,
      }
      if (movement.triggersMoveEffects) {
        next = {
          ...next,
          combatBuffs: {
            ...triggerOutOfBreath(next, 'move'),
            movedFeetThisTurn: Math.max(1, next.combatBuffs?.movedFeetThisTurn ?? 0),
          },
        }
      }
      return {
        ...next,
      }
    })
    if (movement.apCost > 0 && movement.characterPatch.currentAP != null) {
      events.push({
        type: 'ap-spent',
        tokenId: movement.token.id,
        characterId: actor.id,
        amount: movement.apCost,
        before,
        after: movement.characterPatch.currentAP,
      })
    }
  }

  if (mode === 'turn-move') {
    const opportunityAttackers = findOpportunityAttackersForMove({
      map: state.map,
      characters: state.characters,
      movingToken: movement.token,
      to: movement.to,
      disengagedCharacterIds: new Set(state.disengagedCharacterIds ?? []),
      enemyApByToken: state.enemyApByToken,
    })
    for (const attacker of opportunityAttackers) {
      events.push({
        type: 'opportunity-triggered',
        attackerTokenId: attacker.id,
        movingTokenId: movement.token.id,
      })
    }
  }

  if (!action.deferTokenMove) {
    updateToken(state, movement.token.id, (item) => ({ ...item, ...movement.to }))
  }
  events.push({
    type: 'token-moved',
    tokenId: movement.token.id,
    from: movement.from,
    to: movement.to,
    feet: movement.feet,
    triggersMoveEffects: movement.triggersMoveEffects,
  })
  if (!action.deferTokenMove) {
    events.push({
      type: 'log',
      text:
        mode === 'agile-leap'
          ? `${actor.name} 灵巧跳跃移动 ${movement.feet} 尺。`
          : mode === 'skill-free-move'
            ? `${actor.name} 技能移动 ${movement.feet} 尺。`
            : mode === 'calm-spirit-move'
              ? `${actor.name} 安定心神移动 ${movement.feet} 尺。`
            : `${actor.name} 移动 ${movement.feet} 尺。`,
    })
  }
  return succeed(state, events)
}

function resolveCommitTokenMove(
  state: HeadlessDmCombatState,
  action: HeadlessCommitTokenMoveAction,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  const actorToken = state.map.tokens.find((item) => item.id === action.actorTokenId)
  const actor = findCharacter(state, action.characterId)
  if (
    !actorToken ||
    actorToken.type !== 'player' ||
    actorToken.characterId !== action.characterId ||
    !actor ||
    !isTokenAlive(actorToken, state.characters)
  ) {
    return fail(state, 'invalid-actor', events)
  }
  const to = snapTokenToGridCenter(action.targetPosition.x, action.targetPosition.y, actorToken, state.map)
  const from = { x: actorToken.x, y: actorToken.y }
  updateToken(state, actorToken.id, (item) => ({ ...item, ...to }))
  const feet =
    action.feet ??
    cellDistance(pixelToCell(from.x, from.y, state.map), pixelToCell(to.x, to.y, state.map)) *
      (state.map.feetPerCell ?? 5)
  events.push({
    type: 'token-moved',
    tokenId: actorToken.id,
    from,
    to,
    feet,
    triggersMoveEffects: false,
  })
  events.push({ type: 'log', text: `${actor.name} 移动 ${feet} 尺。` })
  return succeed(state, events)
}

function resolveDisengage(
  state: HeadlessDmCombatState,
  action: HeadlessDisengageAction,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  const actorToken = state.map.tokens.find((item) => item.id === action.actorTokenId)
  if (
    !actorToken ||
    actorToken.type !== 'player' ||
    actorToken.characterId !== action.characterId ||
    !isTokenAlive(actorToken, state.characters)
  ) {
    return fail(state, 'invalid-actor', events)
  }
  const actor = findCharacter(state, action.characterId)
  if (!actor || actor.currentHp <= 0) return fail(state, 'invalid-actor', events)
  if ((state.disengagedCharacterIds ?? []).includes(actor.id)) {
    return fail(state, 'invalid-action', events)
  }
  if (!spendCharacterAp(state, actor.id, 2, actorToken.id, events)) return fail(state, 'insufficient-ap', events)
  grantDisengage(state, actor.id)
  events.push({
    type: 'log',
    text: `${actor.name} 撤离：本回合移动不触发借机攻击。`,
  })
  return succeed(state, events)
}

function resolveUseSkill(
  state: HeadlessDmCombatState,
  action: HeadlessUseSkillAction,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  const actorToken = state.map.tokens.find((item) => item.id === action.actorTokenId)
  if (
    !actorToken ||
    actorToken.type !== 'player' ||
    actorToken.characterId !== action.characterId ||
    !isTokenAlive(actorToken, state.characters)
  ) {
    return fail(state, 'invalid-actor', events)
  }
  const actor = findCharacter(state, action.characterId)
  const skill = actor?.combatSkills.find((item) => item.id === action.skillId)
  if (!actor || actor.currentHp <= 0 || !skill || skill.damageCount > 0) return fail(state, 'invalid-skill', events)
  if (skill.remaining > 0 || (skill.usedThisTurn && skill.cooldown > 0)) return fail(state, 'invalid-skill', events)

  const waiveAp = !!actor.combatBuffs?.galeComboReady
  const apCost = Math.max(0, skill.apCost)
  if (!waiveAp && apCost > 0 && !spendCharacterAp(state, actor.id, apCost, actorToken.id, events)) {
    return fail(state, 'insufficient-ap', events)
  }
  markSkillUsed(state, actor.id, skill.id)
  if (waiveAp) consumeGaleComboReady(state, actor.id, skill.name, events)
  events.push({
    type: 'log',
    text: `${actor.name} 使用 ${skill.name}${waiveAp ? '（疾风连击，不消耗 AP）' : apCost > 0 ? `，消耗 ${apCost} AP` : ''}。`,
  })
  return succeed(state, events)
}

function resolveAgileLeapReady(
  state: HeadlessDmCombatState,
  action: HeadlessAgileLeapReadyAction,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  const actorToken = state.map.tokens.find((token) => token.id === action.actorTokenId)
  const actor = findCharacter(state, action.characterId)
  if (!actorToken || !actor || actorToken.type !== 'player' || actorToken.characterId !== actor.id || actor.currentHp <= 0) {
    return fail(state, 'invalid-actor', events)
  }
  const trait = actor.traits.find((item) => item.featureKey === 'agileLeap')
  if (!trait || trait.uses <= 0 || (actor.combatBuffs?.agileLeapMoveFeet ?? 0) > 0) {
    return fail(state, 'invalid-skill', events)
  }
  const maxFeet = agileLeapMoveFeet(actor)
  const feet = Math.min(Math.max(0, action.feet), maxFeet)
  if (feet <= 0) return fail(state, 'invalid-skill', events)

  updateCharacter(state, actor.id, (item) => ({
    ...item,
    traits: item.traits.map((existing) =>
      existing.featureKey === 'agileLeap' ? { ...existing, uses: Math.max(0, existing.uses - 1) } : existing,
    ),
    combatBuffs: {
      ...item.combatBuffs,
      agileLeapMoveFeet: feet,
    },
  }))
  events.push({
    type: 'log',
    text: `${actor.name} 发动灵巧跳跃：可移动至多 ${feet} 尺，不消耗 AP。`,
  })
  return succeed(state, events)
}

function resolveEnemyMove(
  state: HeadlessDmCombatState,
  action: HeadlessEnemyMoveAction,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  const actorToken = state.map.tokens.find((item) => item.id === action.actorTokenId)
  if (!actorToken || actorToken.type !== 'enemy' || !actorToken.poolId || !isTokenAlive(actorToken, state.characters)) {
    return fail(state, 'invalid-actor', events)
  }
  if (isTokenMovementLocked(actorToken)) return fail(state, 'movement-locked', events)

  const apCost = Math.max(1, Math.floor(action.apCost ?? 1))
  const to = snapTokenToGridCenter(action.targetPosition.x, action.targetPosition.y, actorToken, state.map)
  const from = { x: actorToken.x, y: actorToken.y }
  const feetPerCell = state.map.feetPerCell ?? 5
  const feet = cellDistance(pixelToCell(from.x, from.y, state.map), pixelToCell(to.x, to.y, state.map)) * feetPerCell
  const maxFeet = apCost * 30
  if (feet > maxFeet) return fail(state, 'out-of-range', events)
  if (!spendEnemyAp(state, actorToken.id, apCost, events)) return fail(state, 'insufficient-ap', events)

  updateToken(state, actorToken.id, (item) => ({ ...item, ...to }))
  events.push({
    type: 'token-moved',
    tokenId: actorToken.id,
    from,
    to,
    feet,
    triggersMoveEffects: false,
  })
  events.push({ type: 'log', text: `${actorToken.label} 移动 ${feet} 尺。` })
  return succeed(state, events)
}

function resolveActivateFeature(
  state: HeadlessDmCombatState,
  action: HeadlessActivateFeatureAction,
  dice: HeadlessDiceRoller,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  const actorToken = state.map.tokens.find((item) => item.id === action.actorTokenId)
  if (
    !actorToken ||
    actorToken.type !== 'player' ||
    actorToken.characterId !== action.characterId ||
    !isTokenAlive(actorToken, state.characters)
  ) {
    return fail(state, 'invalid-actor', events)
  }
  const current = getCurrentTurn(state)
  if (current?.tokenId !== actorToken.id) return fail(state, 'stale-turn', events)
  const actor = findCharacter(state, action.characterId)
  if (!actor || actor.currentHp <= 0) return fail(state, 'invalid-actor', events)
  const trait = actor.traits.find((item) => item.featureKey === action.featureKey)
  const isToggleOff =
    (action.featureKey === 'doubleArrow' && !!actor.combatBuffs?.doubleArrowReady) ||
    (action.featureKey === 'preciseStrike' && !!actor.combatBuffs?.preciseStrikeReady) ||
    (action.featureKey === 'finale' && !!actor.combatBuffs?.finaleReady)
  const requiresUse =
    action.featureKey !== 'stillWater' &&
    action.featureKey !== 'flexibleBody' &&
    action.featureKey !== 'windBlade'
  if (!trait || (!isToggleOff && requiresUse && trait.uses <= 0)) return fail(state, 'invalid-skill', events)

  if (action.featureKey === 'eagleEye') {
    if (trait.uses <= 0) return fail(state, 'invalid-skill', events)
    if (!spendCharacterAp(state, actor.id, 1, actorToken.id, events)) return fail(state, 'insufficient-ap', events)
    updateCharacter(state, actor.id, (item) => ({
      ...item,
      combatBuffs: { ...item.combatBuffs, eagleEyeTurns: 3 },
      traits: item.traits.map((currentTrait) =>
        currentTrait.featureKey === 'eagleEye'
          ? { ...currentTrait, uses: Math.max(0, currentTrait.uses - 1) }
          : currentTrait,
      ),
    }))
    events.push({ type: 'log', text: `${actor.name} 激活鹰眼。` })
    return succeed(state, events)
  }

  if (action.featureKey === 'doubleArrow') {
    if (actor.combatBuffs?.doubleArrowReady) {
      updateCharacter(state, actor.id, (item) => ({
        ...item,
        combatBuffs: { ...item.combatBuffs, doubleArrowReady: undefined },
      }))
      events.push({ type: 'log', text: `${actor.name} 取消双箭。` })
      return succeed(state, events)
    }
    if (!spendCharacterAp(state, actor.id, 1, actorToken.id, events)) return fail(state, 'insufficient-ap', events)
    updateCharacter(state, actor.id, (item) => ({
      ...item,
      combatBuffs: { ...item.combatBuffs, doubleArrowReady: true },
    }))
    events.push({ type: 'log', text: `${actor.name} 激活双箭。` })
    return succeed(state, events)
  }

  if (action.featureKey === 'stillWater') {
    if (!isCalmMindActive(actor)) return fail(state, 'invalid-skill', events)
    if (!spendCharacterAp(state, actor.id, 1, actorToken.id, events)) return fail(state, 'insufficient-ap', events)
    const tempHp = Math.max(1, trait.level) * 10
    let affected = 0
    for (const allyToken of state.map.tokens) {
      if (allyToken.type !== 'player' || !allyToken.characterId) continue
      const ally = findCharacter(state, allyToken.characterId)
      if (!ally || ally.currentHp <= 0) continue
      const distanceFeet = tokenFootprintDistanceCells(actorToken, allyToken, state.map) * (state.map.feetPerCell ?? 5)
      if (distanceFeet > 15) continue
      affected += 1
      updateCharacter(state, ally.id, (item) => ({
        ...item,
        tempHp: Math.max(item.tempHp ?? 0, tempHp),
        combatBuffs: {
          ...item.combatBuffs,
          stillWaterBreathImmunityTurns: 2,
          stillWaterTempHpTurns: 10,
          outOfBreathTurns: undefined,
          calmMind: findClassTrait(item, 'calmMind') ? true : item.combatBuffs?.calmMind,
        },
      }))
    }
    events.push({
      type: 'log',
      text: `${actor.name} 激活心如止水：15尺内 ${affected} 名友方获得 ${tempHp} 临时生命，2回合免气喘。`,
    })
    return succeed(state, events)
  }

  if (action.featureKey === 'finale') {
    if (actor.combatBuffs?.finaleReady) {
      updateCharacter(state, actor.id, (item) => ({
        ...item,
        combatBuffs: { ...item.combatBuffs, finaleReady: undefined },
      }))
      events.push({ type: 'log', text: `${actor.name} 取消曲终待触发。` })
      return succeed(state, events)
    }
    if (!spendCharacterAp(state, actor.id, 2, actorToken.id, events)) return fail(state, 'insufficient-ap', events)
    updateCharacter(state, actor.id, (item) => ({
      ...item,
      combatBuffs: { ...item.combatBuffs, finaleReady: true },
      traits: item.traits.map((currentTrait) =>
        currentTrait.featureKey === 'finale'
          ? { ...currentTrait, uses: Math.max(0, currentTrait.uses - 1) }
          : currentTrait,
      ),
    }))
    events.push({ type: 'log', text: `${actor.name} 激活曲终：等待下一名敌对生物狩猎印记叠至 4 层。` })
    return succeed(state, events)
  }

  if (action.featureKey === 'illusionDance') {
    return resolveIllusionDanceFeature(state, action, actorToken, actor, trait, dice, events)
  }

  if (action.featureKey === 'shadowVeil') {
    const targetToken = state.map.tokens.find((item) => item.id === action.targetTokenId)
    if (!targetToken || targetToken.type !== 'enemy' || !isTokenAlive(targetToken, state.characters)) {
      return fail(state, 'invalid-target', events)
    }
    if ((targetToken.huntingMarkStacks ?? 0) < 2) return fail(state, 'invalid-target', events)
    if (!spendCharacterAp(state, actor.id, 1, actorToken.id, events)) return fail(state, 'insufficient-ap', events)
    updateToken(state, targetToken.id, (token) => ({
      ...token,
      huntingMarkStacks: Math.max(0, (token.huntingMarkStacks ?? 0) - 2),
    }))
    updateCharacter(state, actor.id, (item) => ({
      ...item,
      combatBuffs: { ...item.combatBuffs, shadowVeilTargetId: targetToken.id },
      traits: item.traits.map((currentTrait) =>
        currentTrait.featureKey === 'shadowVeil'
          ? { ...currentTrait, uses: Math.max(0, currentTrait.uses - 1) }
          : currentTrait,
      ),
    }))
    events.push({ type: 'log', text: `${actor.name} 激活影遁之术：${targetToken.label} 印记 -2，本回合攻击 +1D6。` })
    return succeed(state, events)
  }

  if (action.featureKey === 'trackingArrow') {
    const targetToken = state.map.tokens.find((item) => item.id === action.targetTokenId)
    if (!targetToken || targetToken.type !== 'enemy' || !isTokenAlive(targetToken, state.characters)) {
      return fail(state, 'invalid-target', events)
    }
    if ((targetToken.huntingMarkStacks ?? 0) <= 0) return fail(state, 'invalid-target', events)
    const nextStacks = Math.min(4, (targetToken.huntingMarkStacks ?? 0) + 1)
    const finaleWillTrigger = nextStacks === 4 && !!actor.combatBuffs?.finaleReady
    const finaleDamageValues = finaleWillTrigger
      ? resolveFinaleDamageValues(action.finaleDamageValues, dice, findClassTrait(actor, 'finale')?.level ?? 1)
      : []
    if (!finaleDamageValues) return fail(state, 'invalid-dice', events)
    if (!spendCharacterAp(state, actor.id, 1, actorToken.id, events)) return fail(state, 'insufficient-ap', events)
    updateToken(state, targetToken.id, (token) => ({ ...token, huntingMarkStacks: nextStacks }))
    updateCharacter(state, actor.id, (item) => ({
      ...item,
      traits: item.traits.map((currentTrait) =>
        currentTrait.featureKey === 'trackingArrow'
          ? { ...currentTrait, uses: Math.max(0, currentTrait.uses - 1) }
          : currentTrait,
      ),
    }))
    events.push({ type: 'log', text: `${actor.name} 激活追踪箭：${targetToken.label} 狩猎印记 +1（${nextStacks}/4）。` })
    if (finaleWillTrigger) {
      const latestTarget = state.map.tokens.find((token) => token.id === targetToken.id) ?? targetToken
      resolveFinaleTrigger(state, actor, latestTarget, finaleDamageValues, events)
    }
    return succeed(state, events)
  }

  if (action.featureKey === 'flexibleBody') {
    if ((actor.qi ?? 0) < 1) return fail(state, 'insufficient-resource', events)
    if (!spendCharacterAp(state, actor.id, 1, actorToken.id, events)) return fail(state, 'insufficient-ap', events)
    const bonus = 5 + (Math.max(1, trait.level) - 1) * 2
    updateCharacter(state, actor.id, (item) => ({
      ...item,
      qi: Math.max(0, (item.qi ?? 0) - 1),
      combatBuffs: { ...item.combatBuffs, flexibleBodyBonus: bonus },
    }))
    events.push({ type: 'log', text: `${actor.name} 激活灵活身躯：下次闪避/敏捷豁免 +${bonus}。` })
    return succeed(state, events)
  }

  if (action.featureKey === 'showtime') {
    if ((actor.qi ?? 0) < 1) return fail(state, 'insufficient-resource', events)
    if (!spendCharacterAp(state, actor.id, 1, actorToken.id, events)) return fail(state, 'insufficient-ap', events)
    updateCharacter(state, actor.id, (item) => ({
      ...item,
      qi: Math.max(0, (item.qi ?? 0) - 1),
      combatBuffs: { ...item.combatBuffs, showtimeTurns: 2 },
      traits: item.traits.map((currentTrait) =>
        currentTrait.featureKey === 'showtime'
          ? { ...currentTrait, uses: Math.max(0, currentTrait.uses - 1) }
          : currentTrait,
      ),
    }))
    events.push({ type: 'log', text: `${actor.name} 激活演出时间：持续 2 回合。` })
    return succeed(state, events)
  }

  if (action.featureKey === 'windBlade') {
    if ((actor.qi ?? 0) < 1) return fail(state, 'insufficient-resource', events)
    updateCharacter(state, actor.id, (item) => ({
      ...item,
      qi: Math.max(0, (item.qi ?? 0) - 1),
      combatBuffs: { ...item.combatBuffs, windBladeFreeDodgeTurns: 1 },
    }))
    events.push({ type: 'log', text: `${actor.name} 激活风刃乱舞：下回合开始前，回合外闪避不消耗 AP。` })
    return succeed(state, events)
  }

  if (actor.combatBuffs?.preciseStrikeReady) {
    updateCharacter(state, actor.id, (item) => ({
      ...item,
      combatBuffs: { ...item.combatBuffs, preciseStrikeReady: undefined },
    }))
    events.push({ type: 'log', text: `${actor.name} 取消精准打击。` })
    return succeed(state, events)
  }
  if (!spendCharacterAp(state, actor.id, 1, actorToken.id, events)) return fail(state, 'insufficient-ap', events)
  updateCharacter(state, actor.id, (item) => ({
    ...item,
    combatBuffs: { ...item.combatBuffs, preciseStrikeReady: true },
  }))
  events.push({ type: 'log', text: `${actor.name} 准备精准打击。` })
  return succeed(state, events)
}

function resolveStableMind(
  state: HeadlessDmCombatState,
  action: HeadlessStableMindAction,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  const actorToken = state.map.tokens.find((item) => item.id === action.actorTokenId)
  if (
    !actorToken ||
    actorToken.type !== 'player' ||
    actorToken.characterId !== action.characterId ||
    !isTokenAlive(actorToken, state.characters)
  ) {
    return fail(state, 'invalid-actor', events)
  }
  const actor = findCharacter(state, action.characterId)
  if (!actor || actor.currentHp <= 0) return fail(state, 'invalid-actor', events)
  const stableMind = consumeStableMind(state, actorToken, actor, events)
  if (stableMind === 'invalid') return fail(state, 'invalid-skill', events)
  if (stableMind === 'insufficient-ap') return fail(state, 'insufficient-ap', events)
  return succeed(state, events)
}

function consumeStableMind(
  state: HeadlessDmCombatState,
  actorToken: Token,
  actor: Character,
  events: HeadlessCombatEvent[],
): 'ok' | 'invalid' | 'insufficient-ap' {
  const trait = actor.traits.find((item) => item.featureKey === 'stableMind')
  if (!trait || trait.uses <= 0) return 'invalid'
  if (!spendCharacterAp(state, actor.id, 1, actorToken.id, events)) return 'insufficient-ap'
  updateCharacter(state, actor.id, (item) => ({
    ...item,
    traits: item.traits.map((currentTrait) =>
      currentTrait.featureKey === 'stableMind'
        ? { ...currentTrait, uses: Math.max(0, currentTrait.uses - 1) }
        : currentTrait,
    ),
  }))
  events.push({ type: 'log', text: `${actor.name} 发动残影脱身：抵消敏捷豁免后仍会受到的伤害。` })
  return 'ok'
}

function resolveArcaneSurge(
  state: HeadlessDmCombatState,
  action: HeadlessArcaneSurgeAction,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  const actorToken = state.map.tokens.find((item) => item.id === action.actorTokenId)
  if (
    !actorToken ||
    actorToken.type !== 'player' ||
    actorToken.characterId !== action.characterId
  ) {
    return fail(state, 'invalid-actor', events)
  }
  const actor = findCharacter(state, action.characterId)
  if (!actor) return fail(state, 'invalid-actor', events)
  const trait = actor.traits.find((item) => item.featureKey === 'arcaneSurge')
  if (!trait || trait.uses <= 0) return fail(state, 'invalid-skill', events)
  updateCharacter(state, actor.id, (item) => ({
    ...item,
    currentHp: 1,
    traits: item.traits.map((currentTrait) =>
      currentTrait.featureKey === 'arcaneSurge'
        ? { ...currentTrait, uses: Math.max(0, currentTrait.uses - 1) }
        : currentTrait,
    ),
  }))
  syncCharacterTokenHp(state, actor.id)
  events.push({ type: 'log', text: `${actor.name} 发动魔法浪涌：生命保留为 1。` })
  return succeed(state, events)
}

function resolveIllusionDanceFeature(
  state: HeadlessDmCombatState,
  action: HeadlessActivateFeatureAction,
  actorToken: Token,
  actor: Character,
  trait: NonNullable<Character['traits'][number]>,
  dice: HeadlessDiceRoller,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  if ((actor.qi ?? 0) < 1) return fail(state, 'insufficient-resource', events)
  const limit = Math.min(3, Math.max(1, trait.level))
  const packetByTarget = new Map((action.targetPackets ?? []).map((packet) => [packet.targetTokenId, packet]))
  const requestedIds =
    action.targetPackets?.map((packet) => packet.targetTokenId) ??
    action.targetTokenIds ??
    []
  const uniqueIds = Array.from(new Set(requestedIds.filter(Boolean))).slice(0, limit)
  const orderIndex = new Map(state.initiativeOrder.map((entry, index) => [entry.tokenId, index]))
  const targets = uniqueIds
    .map((id) => state.map.tokens.find((token) => token.id === id))
    .filter((token): token is Token => !!token && token.type === 'enemy' && isTokenAlive(token, state.characters))
    .sort(
      (a, b) =>
        (orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
        a.label.localeCompare(b.label),
    )
  if (targets.length === 0) return fail(state, 'invalid-target', events)

  const saveRolls = new Map<string, number>()
  for (const target of targets) {
    const packet = packetByTarget.get(target.id)
    const values = resolveDiceValues(packet?.saveD20 != null ? [packet.saveD20] : undefined, dice, 1, 20)
    if (!values) return fail(state, 'invalid-dice', events)
    saveRolls.set(target.id, values[0])
  }

  if (!spendCharacterAp(state, actor.id, 1, actorToken.id, events)) return fail(state, 'insufficient-ap', events)
  updateCharacter(state, actor.id, (item) => ({
    ...item,
    qi: Math.max(0, (item.qi ?? 0) - 1),
    traits: item.traits.map((currentTrait) =>
      currentTrait.featureKey === 'illusionDance'
        ? { ...currentTrait, uses: Math.max(0, currentTrait.uses - 1) }
        : currentTrait,
    ),
  }))

  const labels: string[] = []
  for (const target of targets) {
    const latestTarget = state.map.tokens.find((token) => token.id === target.id) ?? target
    const targetCharacter = latestTarget.characterId ? findCharacter(state, latestTarget.characterId) : undefined
    const d20Value = saveRolls.get(target.id) ?? 1
    const saveMod = getTokenAbilityMod(latestTarget, 'wis', targetCharacter)
    const total = d20Value + saveMod
    const success = total >= actor.saveDC
    events.push({ type: 'dice-rolled', notation: '1d20', values: [d20Value], total: d20Value })
    events.push({
      type: 'status-save-resolved',
      actorTokenId: actorToken.id,
      targetTokenId: latestTarget.id,
      condition: '迷幻舞步',
      ability: 'wis',
      d20Value,
      saveMod,
      total,
      dc: actor.saveDC,
      success,
    })
    if (!success) {
      const distanceCells = tokenFootprintDistanceCells(actorToken, latestTarget, state.map)
      pullTargetTowardActor(state, actorToken, latestTarget, Math.max(0, distanceCells - 2), events)
      const pulledTarget = state.map.tokens.find((token) => token.id === latestTarget.id) ?? latestTarget
      applyNoMoveToTarget(state, pulledTarget, 1, events)
      updateToken(state, pulledTarget.id, (token) => ({
        ...token,
        illusionDanceTurns: Math.max(token.illusionDanceTurns ?? 0, 1),
      }))
    }
    labels.push(`${latestTarget.label}：感知豁免 ${d20Value}+${saveMod} vs DC${actor.saveDC} ${success ? '成功' : '失败，被拉近且不能移动'}`)
  }
  events.push({ type: 'log', text: `${actor.name} 激活迷幻舞步：${labels.join('；')}。` })
  return succeed(state, events)
}

function resolveQiReduceCooldown(
  state: HeadlessDmCombatState,
  action: HeadlessQiReduceCooldownAction,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  const actorToken = state.map.tokens.find((item) => item.id === action.actorTokenId)
  if (
    !actorToken ||
    actorToken.type !== 'player' ||
    actorToken.characterId !== action.characterId ||
    !isTokenAlive(actorToken, state.characters)
  ) {
    return fail(state, 'invalid-actor', events)
  }
  const current = getCurrentTurn(state)
  if (current?.tokenId !== actorToken.id) return fail(state, 'stale-turn', events)
  const actor = findCharacter(state, action.characterId)
  const skill = actor?.combatSkills.find((item) => item.id === action.skillId)
  if (!actor || actor.currentHp <= 0 || !skill || skill.remaining <= 0) {
    return fail(state, 'invalid-skill', events)
  }
  if ((actor.qi ?? 0) < 1) return fail(state, 'insufficient-resource', events)

  updateCharacter(state, actor.id, (item) => ({
    ...item,
    qi: Math.max(0, (item.qi ?? 0) - 1),
    combatSkills: item.combatSkills.map((currentSkill) =>
      currentSkill.id === action.skillId
        ? { ...currentSkill, remaining: Math.max(0, currentSkill.remaining - 1) }
        : currentSkill,
    ),
  }))
  const updated = findCharacter(state, actor.id)
  const updatedSkill = updated?.combatSkills.find((item) => item.id === action.skillId)
  events.push({
    type: 'log',
    text: `${actor.name} 消耗 1 点气：${skill.name} 冷却 -1。剩余气 ${updated?.qi ?? 0}，剩余冷却 ${
      updatedSkill?.remaining ?? 0
    }。`,
  })
  return succeed(state, events)
}

function resolveCalmSpirit(
  state: HeadlessDmCombatState,
  action: HeadlessCalmSpiritAction,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  const actorToken = state.map.tokens.find((item) => item.id === action.actorTokenId)
  if (
    !actorToken ||
    actorToken.type !== 'player' ||
    actorToken.characterId !== action.characterId ||
    !isTokenAlive(actorToken, state.characters)
  ) {
    return fail(state, 'invalid-actor', events)
  }
  const current = getCurrentTurn(state)
  if (current?.tokenId !== actorToken.id) return fail(state, 'stale-turn', events)
  const actor = findCharacter(state, action.characterId)
  if (!actor || actor.currentHp <= 0) return fail(state, 'invalid-actor', events)
  const trait = findClassTrait(actor, 'calmSpirit')
  if (!trait) return fail(state, 'invalid-skill', events)
  const cost =
    action.effect === 'move'
      ? 1
      : action.effect === 'crit'
        ? 2
        : action.effect === 'cooldown'
          ? 3
          : 4
  const stacks = actor.combatBuffs?.calmSpiritStacks ?? 0
  if (stacks < cost) return fail(state, 'insufficient-resource', events)
  const nextStacks = stacks - cost
  if (action.effect === 'move') {
    const feet = 10 + (Math.max(1, trait.level) - 1) * 5
    updateCharacter(state, actor.id, (item) => ({
      ...item,
      combatBuffs: {
        ...item.combatBuffs,
        calmSpiritStacks: nextStacks > 0 ? nextStacks : undefined,
        calmSpiritMoveFeet: feet,
      },
    }))
    events.push({ type: 'log', text: `${actor.name} 发动安定心神：消耗 1 枚静心标记，可移动至多 ${feet} 尺且不失去静心。` })
    return succeed(state, events)
  }
  if (action.effect === 'cooldown') {
    const skill = actor.combatSkills.find((item) => item.id === action.skillId)
    if (!skill || skill.remaining <= 0) return fail(state, 'invalid-skill', events)
    updateCharacter(state, actor.id, (item) => ({
      ...item,
      combatBuffs: {
        ...item.combatBuffs,
        calmSpiritStacks: nextStacks > 0 ? nextStacks : undefined,
      },
      combatSkills: item.combatSkills.map((currentSkill) =>
        currentSkill.id === skill.id ? { ...currentSkill, remaining: Math.max(0, currentSkill.remaining - 1) } : currentSkill,
      ),
    }))
    events.push({ type: 'log', text: `${actor.name} 发动安定心神：消耗 3 枚静心标记，${skill.name} CD -1。` })
    return succeed(state, events)
  }
  if (action.effect === 'extraTurn') {
    updateCharacter(state, actor.id, (item) => ({
      ...item,
      currentAP: item.actionPoints,
      combatSkills: item.combatSkills.map((skill) => ({ ...skill, usedThisTurn: false })),
      combatBuffs: {
        ...item.combatBuffs,
        calmSpiritStacks: undefined,
      },
    }))
    events.push({
      type: 'log',
      text: `${actor.name} 发动安定心神：消耗 4 枚静心标记，获得一个完整回合，AP 回满为 ${actor.actionPoints}/${actor.actionPoints}。`,
    })
    return succeed(state, events)
  }
  const bonus = 20 + (Math.max(1, trait.level) - 1) * 10
  updateCharacter(state, actor.id, (item) => ({
    ...item,
    combatBuffs: {
      ...item.combatBuffs,
      calmSpiritStacks: nextStacks > 0 ? nextStacks : undefined,
      calmSpiritCritBonusPercent: bonus,
    },
  }))
  events.push({ type: 'log', text: `${actor.name} 发动安定心神：消耗 2 枚静心标记，下一次攻击暴击率 +${bonus}%。` })
  return succeed(state, events)
}

function resolvePlayerAttack(
  state: HeadlessDmCombatState,
  action: HeadlessPlayerAttackAction,
  dice: HeadlessDiceRoller,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  const actor = findCharacter(state, action.characterId)
  const actorToken = state.map.tokens.find((item) => item.id === action.actorTokenId)
  const skill = actor?.combatSkills.find((item) => item.id === action.skillId)
  if (!actor || !actorToken || actorToken.characterId !== actor.id || actorToken.type !== 'player') {
    return fail(state, 'invalid-actor', events)
  }
  if (!skill || skill.damageCount < 0 || skill.damageSides < 0 || skill.remaining > 0) {
    return fail(state, 'invalid-skill', events)
  }
  if (skill.skillTreeId === 'riseKick' && !actor.conditions.includes('倒地')) {
    return fail(state, 'invalid-skill', events)
  }
  const packets = action.targetPackets?.length
    ? action.targetPackets
    : [{ targetTokenId: action.targetTokenId, diceValues: action.diceValues, targetDodgeD20: action.targetDodgeD20, isCrit: action.isCrit }]
  if (packets.length === 0) return fail(state, 'invalid-target', events)
  for (const packet of packets) {
    const targetToken = state.map.tokens.find((item) => item.id === packet.targetTokenId)
    if (!targetToken || targetToken.id === actorToken.id || !isTokenAlive(targetToken, state.characters)) {
      return fail(state, 'invalid-target', events)
    }
    const rangeFeet = singleTargetRangeFeet(skill)
    if (rangeFeet != null) {
      const distanceFeet = tokenFootprintDistanceCells(actorToken, targetToken, state.map) * (state.map.feetPerCell ?? 5)
      if (distanceFeet > rangeFeet) return fail(state, 'out-of-range', events)
    }
  }
  const waiveAp = !!actor.combatBuffs?.galeComboReady
  const apCost = Math.max(0, skill.apCost)
  if (!waiveAp && apCost > 0 && !spendCharacterAp(state, actor.id, apCost, actorToken.id, events)) {
    return fail(state, 'insufficient-ap', events)
  }

  let resolvedCount = 0
  let selfCooldownReduction = 0
  let shouldClearDoubleArrowReady = false
  let shouldSpendDoubleArrowUse = false
  let shouldClearPreciseStrikeReady = false
  let shouldSpendPreciseStrikeUse = false
  let shouldClearShadowVeilTarget = false
  let shouldSpendArmorPiercingUse = false
  let shouldClearCalmSpiritCritBonus = false
  const cooldownReductions: Array<{ skillId: string; amount: number }> = []
  for (const [packetIndex, packet] of packets.entries()) {
    const targetToken = state.map.tokens.find((item) => item.id === packet.targetTokenId)
    if (!targetToken || !isTokenAlive(targetToken, state.characters)) continue
    const packetAction: HeadlessPlayerAttackAction = {
      ...action,
      targetTokenId: packet.targetTokenId,
      diceValues: packet.diceValues,
      targetDodgeD20: packet.targetDodgeD20,
      targetDodgeMode: packet.targetDodgeMode,
      ignoreTargetDodge: packet.ignoreTargetDodge,
      attackRoll: packet.attackRoll,
      isCrit: packet.isCrit,
      additionalCritMultiplier: packet.additionalCritMultiplier,
      targetPackets: undefined,
    }
    let effectiveIsCrit = !!packet.isCrit
    if (packet.clearCalmSpiritCritBonusOnUse) shouldClearCalmSpiritCritBonus = true
    if (packet.attackRoll) {
      const attackRoll = resolveHeadlessPlayerAttackRoll(actor, targetToken, skill, packet.attackRoll, dice, events)
      if (!attackRoll) return fail(state, 'invalid-dice', events)
      effectiveIsCrit = attackRoll.isCrit
      if (!attackRoll.hit) {
        if (packet.clearCalmSpiritCritBonusOnUse) {
          updateCharacter(state, actor.id, (item) => ({
            ...item,
            combatBuffs: { ...item.combatBuffs, calmSpiritCritBonusPercent: undefined },
          }))
        }
        events.push({
          type: 'attack-resolved',
          actorTokenId: actorToken.id,
          characterId: actor.id,
          targetTokenId: targetToken.id,
          skillId: skill.id,
          skillName: skill.name,
          damageValues: [],
          diceTotal: 0,
          baseDamage: 0,
          damageBeforeDefense: 0,
          modifier: 0,
          diff: 0,
          total: 0,
          isCrit: false,
          hit: false,
          targetDodged: false,
          waivedAp: waiveAp,
          apCost: packetIndex === 0 ? apCost : 0,
        })
        events.push({
          type: 'log',
          text: `${actor.name} misses ${targetToken.label} with ${skill.name}: ${attackRoll.d20}+${attackRoll.attackBonus} vs AC ${attackRoll.targetAc}.`,
        })
        resolvedCount += 1
        continue
      }
    }
    const targetDodge = resolveTargetDodgeAgainstPlayerAttack(
      state,
      actorToken,
      actor,
      targetToken,
      skill,
      packetAction,
      dice,
      events,
    )
    if (!targetDodge) return fail(state, 'invalid-dice', events)
    if (targetDodge.dodged) {
      if (packet.clearDoubleArrowReadyOnUse) shouldClearDoubleArrowReady = true
      if (packet.clearShadowVeilTargetOnUse) shouldClearShadowVeilTarget = true
      if (packet.clearBurstKickExtraD6OnUse) clearBurstKickExtraD6(state, actor.id)
      if (packet.clearWindKickTreatKnockbackOnUse) clearWindKickTreatKnockback(state, actor.id)
      events.push({
        type: 'attack-resolved',
        actorTokenId: actorToken.id,
        characterId: actor.id,
        targetTokenId: targetToken.id,
        skillId: skill.id,
        skillName: skill.name,
        damageValues: [],
        diceTotal: 0,
        baseDamage: 0,
        damageBeforeDefense: 0,
        modifier: 0,
        diff: 0,
        total: 0,
        isCrit: false,
        hit: false,
        targetDodged: true,
        waivedAp: waiveAp,
        apCost: packetIndex === 0 ? apCost : 0,
      })
      events.push({
        type: 'log',
        text: `${targetToken.label} 闪避 ${actor.name} 的 ${skill.name} 第 ${packetIndex + 1} 段成功。`,
      })
      resolvedCount += 1
      continue
    }

    const damageDiceCount = packet.damageDiceCount ?? skill.damageCount
    const diceValues = resolveDiceValues(packet.diceValues, dice, damageDiceCount, skill.damageSides)
    if (!diceValues) return fail(state, 'invalid-dice', events)
    const extraDamageGroups: Array<{ values: number[]; sides: number }> = []
    if (packet.extraDamageValues) {
      const values = resolveDiceValues(
        packet.extraDamageValues,
        dice,
        packet.extraDamageValues.length,
        packet.extraDamageSides ?? 6,
      )
      if (!values) return fail(state, 'invalid-dice', events)
      extraDamageGroups.push({ values, sides: packet.extraDamageSides ?? 6 })
    }
    for (const group of packet.extraDamageGroups ?? []) {
      const values = resolveDiceValues(group.values, dice, group.values?.length ?? 0, group.sides)
      if (!values) return fail(state, 'invalid-dice', events)
      if (values.length > 0) extraDamageGroups.push({ values, sides: group.sides })
    }
    const extraDamageValues = extraDamageGroups.flatMap((group) => group.values)
    const postCritDamageGroups: Array<{ values: number[]; sides: number }> = []
    if (packet.postCritDamageValues) {
      const values = resolveDiceValues(
        packet.postCritDamageValues,
        dice,
        packet.postCritDamageValues.length,
        packet.postCritDamageSides ?? 6,
      )
      if (!values) return fail(state, 'invalid-dice', events)
      postCritDamageGroups.push({ values, sides: packet.postCritDamageSides ?? 6 })
    }
    for (const group of packet.postCritDamageGroups ?? []) {
      const values = resolveDiceValues(group.values, dice, group.values?.length ?? 0, group.sides)
      if (!values) return fail(state, 'invalid-dice', events)
      if (values.length > 0) postCritDamageGroups.push({ values, sides: group.sides })
    }
    const postCritDamageValues = postCritDamageGroups.flatMap((group) => group.values)
    const preCritDamageValues = [...diceValues, ...extraDamageValues]
    const combinedDamageValues = [...preCritDamageValues, ...postCritDamageValues]
    events.push({
      type: 'dice-rolled',
      notation: `${damageDiceCount}d${skill.damageSides}`,
      values: diceValues,
      total: diceValues.reduce((sum, value) => sum + value, 0),
    })
    for (const group of extraDamageGroups) {
      events.push({
        type: 'dice-rolled',
        notation: `${group.values.length}d${group.sides}`,
        values: group.values,
        total: group.values.reduce((sum, value) => sum + value, 0),
      })
    }
    for (const group of postCritDamageGroups) {
      events.push({
        type: 'dice-rolled',
        notation: `${group.values.length}d${group.sides}`,
        values: group.values,
        total: group.values.reduce((sum, value) => sum + value, 0),
      })
    }

    const preCritRawDamage = preCritDamageValues.reduce((sum, value) => sum + value, 0) + skill.damageBonus
    const additionalCritDamage =
      effectiveIsCrit && packet.additionalCritMultiplier
        ? Math.floor(preCritRawDamage * packet.additionalCritMultiplier)
        : 0
    const baseDamage =
      resolveAttackDamageTotal(actor, skill, preCritDamageValues, { isCrit: effectiveIsCrit }) +
      additionalCritDamage +
      postCritDamageValues.reduce((sum, value) => sum + value, 0)
    const damageType = isMagicDamageSkill(skill) ? 'magic' : 'physical'
    const adjustedBase = adjustDamageForTarget(state, baseDamage, actor, targetToken, damageType)
    const rangeFeet = tokenFootprintDistanceCells(actorToken, targetToken, state.map) * (state.map.feetPerCell ?? 5)
    const shouldHalveByRange =
      !!packet.halveDamageOnRangeFeet &&
      rangeFeet > packet.halveDamageOnRangeFeet.minExclusive &&
      rangeFeet <= packet.halveDamageOnRangeFeet.maxInclusive
    const adjusted = shouldHalveByRange
      ? { ...adjustedBase, damage: Math.floor(adjustedBase.damage / 2) }
      : adjustedBase
    applyDamageToTarget(state, targetToken, adjusted.damage, events)
    if (packet.armorPiercingSplashOnCrit && effectiveIsCrit && adjusted.damage > 0) {
      const splashDamage = Math.floor(adjusted.damage / 2)
      const splashTargets =
        splashDamage > 0
          ? findArmorPiercingSplashTargets(state, actorToken, targetToken, packet.armorPiercingRangeFeet ?? 15)
          : []
      if (splashTargets.length > 0) {
        for (const splashTarget of splashTargets) {
          applyDamageToTarget(state, splashTarget, splashDamage, events)
        }
        if (packet.spendArmorPiercingUseOnSplash) shouldSpendArmorPiercingUse = true
        events.push({
          type: 'log',
          text: `${actor.name} armor piercing splash hits ${splashTargets.length} target(s) for ${splashDamage}.`,
        })
      }
    }
    applyStatusOnHit(state, targetToken, skill, events)
    if (packet.clearDoubleArrowReadyOnUse) shouldClearDoubleArrowReady = true
    if (packet.clearShadowVeilTargetOnUse) shouldClearShadowVeilTarget = true
    if (packet.spendDoubleArrowUseOnHit && adjusted.damage > 0) shouldSpendDoubleArrowUse = true
    if (packet.clearPreciseStrikeReadyOnHit && adjusted.damage > 0) shouldClearPreciseStrikeReady = true
    if (packet.spendPreciseStrikeUseOnHit && adjusted.damage > 0) shouldSpendPreciseStrikeUse = true
    if (packet.clearBurstKickExtraD6OnUse) clearBurstKickExtraD6(state, actor.id)
    if (packet.clearWindKickTreatKnockbackOnUse) clearWindKickTreatKnockback(state, actor.id)
    if (packet.grantBurstKickExtraD6OnHit && adjusted.damage > 0) {
      grantBurstKickExtraD6(state, actor.id, packet.grantBurstKickExtraD6OnHit)
    }
    if (packet.selfCooldownReductionOnHit && adjusted.damage > 0) {
      selfCooldownReduction = Math.max(selfCooldownReduction, packet.selfCooldownReductionOnHit)
    }
    if (packet.pushTargetOnHit && adjusted.damage > 0) {
      pushTargetAwayFromActor(state, actorToken, targetToken, packet.pushCells ?? 1, events)
    }
    if (packet.clearActorConditionOnHit && adjusted.damage > 0) {
      clearActorCondition(state, actor.id, packet.clearActorConditionOnHit, events)
    }
    if (packet.grantFreeMoveFeetOnHit && adjusted.damage > 0) {
      grantSkillFreeMove(state, actor.id, packet.grantFreeMoveFeetOnHit, events)
    }
    if (packet.grantDisengageOnHit && adjusted.damage > 0) {
      grantDisengage(state, actor.id)
    }
    if (packet.grantWindKickTreatKnockbackOnHit && adjusted.damage > 0) {
      grantWindKickTreatKnockback(state, actor.id, targetToken.id)
    }
    if (packet.noMoveOnHit && adjusted.damage > 0) {
      applyNoMoveToTarget(state, targetToken, packet.noMoveTurns ?? 1, events)
    }
    if (packet.burningOnHit && adjusted.damage > 0) {
      applyBurningToTarget(state, targetToken, packet.burningTurns ?? 1, events)
    }
    if (packet.igniteOnHit && adjusted.damage > 0) {
      applyIgniteToTarget(state, targetToken, packet.igniteTurns ?? 1, events)
    }
    if (packet.addHuntingMarkOnDamage && adjusted.damage > 0 && targetToken.type === 'enemy') {
      updateToken(state, targetToken.id, (token) => ({
        ...token,
        huntingMarkStacks: Math.min(4, (token.huntingMarkStacks ?? 0) + 1),
      }))
      events.push({ type: 'log', text: `${targetToken.label} 获得 1 层狩猎印记。` })
    }
    if (packet.markSilentDrawUsedOnHit && adjusted.damage > 0) {
      updateCharacter(state, actor.id, (item) => ({
        ...item,
        combatBuffs: { ...item.combatBuffs, silentDrawUsed: true },
      }))
      events.push({ type: 'log', text: `${actor.name} 的无声起弦已生效。` })
    }
    if (packet.cooldownReductionSkillId && packet.cooldownReductionAmount && packet.cooldownReductionAmount > 0) {
      cooldownReductions.push({ skillId: packet.cooldownReductionSkillId, amount: packet.cooldownReductionAmount })
    }
    const clearedStatuses = packet.clearTargetStatusesOnHit ? clearTargetStatusesFromTarget(state, targetToken) : 0
    if (clearedStatuses > 0) {
      events.push({
        type: 'log',
        text: `${skill.name} 移除 ${targetToken.label} ${clearedStatuses} 个状态。`,
      })
    }
    if (packet.selfCooldownReductionPerClearedStatus && clearedStatuses > 0) {
      selfCooldownReduction = Math.max(selfCooldownReduction, clearedStatuses)
    }
    if (packet.vulnerableOnHit) {
      applyVulnerableToTarget(state, targetToken, packet.vulnerableTurns ?? 1, events)
    }
    const effectSave = resolveAttackEffectSave(state, actorToken, actor, targetToken, packet, dice, events)
    if (!effectSave) return fail(state, 'invalid-dice', events)
    if (!effectSave.success) {
      const effectAllowedBySize = !packet.smallOrMediumOnly || isSmallOrMediumToken(targetToken)
      if (packet.stunOnFailedEffectSave) {
        applyStunToTarget(state, targetToken, STUN_DEFAULT_TURNS, events)
      }
      if (packet.knockbackOnFailedEffectSave) {
        applyKnockbackToTarget(state, targetToken, packet.knockbackTurns ?? KNOCKBACK_DEFAULT_TURNS, events)
      }
      if (packet.restrainedOnFailedEffectSave && effectAllowedBySize) {
        applyRestrainedToTarget(state, targetToken, 1, events)
      }
      if (packet.pullOnFailedEffectSave && effectAllowedBySize) {
        pullTargetTowardActor(state, actorToken, targetToken, packet.pullCells ?? 2, events)
      }
    }
    events.push({
      type: 'attack-resolved',
      actorTokenId: actorToken.id,
      characterId: actor.id,
      targetTokenId: targetToken.id,
      skillId: skill.id,
      skillName: skill.name,
      damageValues: combinedDamageValues,
      diceTotal: combinedDamageValues.reduce((sum, value) => sum + value, 0),
      baseDamage,
      damageBeforeDefense: baseDamage,
      modifier: adjusted.modifier,
      diff: adjusted.diff,
      total: adjusted.damage,
      isCrit: effectiveIsCrit,
      hit: true,
      targetDodged: false,
      waivedAp: waiveAp,
      apCost: packetIndex === 0 ? apCost : 0,
    })
    events.push({
      type: 'log',
      text: `${actor.name} 使用 ${skill.name} 第 ${packetIndex + 1} 段攻击 ${targetToken.label}：骰值 ${combinedDamageValues.join(
        '+',
      )}，攻防修正 ${adjusted.modifier}，最终 ${adjusted.damage} 点。`,
    })
    resolvedCount += 1
  }
  if (resolvedCount === 0) return fail(state, 'invalid-target', events)
  markSkillUsed(state, actor.id, skill.id)
  if (shouldSpendDoubleArrowUse) spendFeatureUse(state, actor.id, 'doubleArrow')
  if (shouldClearDoubleArrowReady) {
    updateCharacter(state, actor.id, (item) => ({
      ...item,
      combatBuffs: { ...item.combatBuffs, doubleArrowReady: undefined },
    }))
    events.push({ type: 'log', text: `${actor.name} 的双箭效果已结算。` })
  }
  if (shouldSpendPreciseStrikeUse) spendFeatureUse(state, actor.id, 'preciseStrike')
  if (shouldSpendArmorPiercingUse) spendFeatureUse(state, actor.id, 'armorPiercingArrow')
  if (shouldClearPreciseStrikeReady) {
    updateCharacter(state, actor.id, (item) => ({
      ...item,
      combatBuffs: { ...item.combatBuffs, preciseStrikeReady: undefined },
    }))
    events.push({ type: 'log', text: `${actor.name} 的精准打击效果已结算。` })
  }
  if (shouldClearShadowVeilTarget) {
    updateCharacter(state, actor.id, (item) => ({
      ...item,
      combatBuffs: { ...item.combatBuffs, shadowVeilTargetId: undefined },
    }))
    events.push({ type: 'log', text: `${actor.name} 的影遁之术效果已结算。` })
  }
  if (shouldClearCalmSpiritCritBonus) {
    updateCharacter(state, actor.id, (item) => ({
      ...item,
      combatBuffs: { ...item.combatBuffs, calmSpiritCritBonusPercent: undefined },
    }))
  }
  for (const reduction of cooldownReductions) {
    const result = reduceSkillCooldown(state, actor.id, reduction.skillId, reduction.amount)
    if (result.reduced > 0) {
      events.push({
        type: 'log',
        text: `${actor.name}：${result.skillName} 冷却 -${result.reduced}（${result.before}→${result.after}）。`,
      })
    }
  }
  const selfReduction = reduceSkillCooldown(state, actor.id, skill.id, selfCooldownReduction)
  if (selfReduction.reduced > 0) {
    events.push({
      type: 'log',
      text: `${actor.name}：${selfReduction.skillName} 冷却 -${selfReduction.reduced}（${selfReduction.before}→${selfReduction.after}）。`,
    })
  }
  if (waiveAp) consumeGaleComboReady(state, actor.id, skill.name, events)
  maybeEndCombat(state, events)
  return succeed(state, events)
}

function resolveAoeAttack(
  state: HeadlessDmCombatState,
  action: HeadlessAoeAttackAction,
  dice: HeadlessDiceRoller,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  const actor = findCharacter(state, action.characterId)
  const actorToken = state.map.tokens.find((item) => item.id === action.actorTokenId)
  const skill = actor?.combatSkills.find((item) => item.id === action.skillId)
  if (!actor || !actorToken || actorToken.characterId !== actor.id || actorToken.type !== 'player') {
    return fail(state, 'invalid-actor', events)
  }
  if (!skill || skill.remaining > 0 || skill.damageSides <= 0) return fail(state, 'invalid-skill', events)
  if (action.targetPackets.length === 0) return fail(state, 'invalid-target', events)
  for (const packet of action.targetPackets) {
    const targetToken = state.map.tokens.find((item) => item.id === packet.targetTokenId)
    if (!targetToken || targetToken.id === actorToken.id || !isTokenAlive(targetToken, state.characters)) {
      return fail(state, 'invalid-target', events)
    }
  }

  const waiveAp = !!actor.combatBuffs?.galeComboReady
  const apCost = Math.max(0, skill.apCost)
  if (!waiveAp && apCost > 0 && !spendCharacterAp(state, actor.id, apCost, actorToken.id, events)) {
    return fail(state, 'insufficient-ap', events)
  }

  const diceCount = Math.max(skill.damageCount, action.diceValues?.length ?? 0)
  const diceValues = resolveDiceValues(action.diceValues, dice, diceCount, skill.damageSides)
  if (!diceValues) return fail(state, 'invalid-dice', events)
  events.push({
    type: 'dice-rolled',
    notation: `${diceCount}d${skill.damageSides}`,
    values: diceValues,
    total: diceValues.reduce((sum, value) => sum + value, 0),
  })

  const baseDamage = resolveAttackDamageTotal(actor, skill, diceValues)
  const damageType = isMagicDamageSkill(skill) ? 'magic' : 'physical'
  let resolvedCount = 0
  for (const [packetIndex, packet] of action.targetPackets.entries()) {
    const targetToken = state.map.tokens.find((item) => item.id === packet.targetTokenId)
    if (!targetToken || !isTokenAlive(targetToken, state.characters)) continue
    const extraDamageGroups: Array<{ values: number[]; sides: number }> = []
    for (const group of packet.extraDamageGroups ?? []) {
      const values = resolveDiceValues(group.values, dice, group.values?.length ?? 0, group.sides)
      if (!values) return fail(state, 'invalid-dice', events)
      if (values.length > 0) extraDamageGroups.push({ values, sides: group.sides })
    }
    for (const group of extraDamageGroups) {
      events.push({
        type: 'dice-rolled',
        notation: `${group.values.length}d${group.sides}`,
        values: group.values,
        total: group.values.reduce((sum, value) => sum + value, 0),
      })
    }
    const targetDamageValues = [...diceValues, ...extraDamageGroups.flatMap((group) => group.values)]
    const targetBaseDamage =
      extraDamageGroups.length > 0 ? resolveAttackDamageTotal(actor, skill, targetDamageValues) : baseDamage
    const adjusted = adjustDamageForTarget(state, targetBaseDamage, actor, targetToken, damageType)
    let total = adjusted.damage
    let saveD20: number | undefined
    let saveMod: number | undefined
    let saveTotal: number | undefined
    let saveSuccess: boolean | undefined
    const saveMode = action.saveMode
    const targetCharacter = targetToken.characterId ? findCharacter(state, targetToken.characterId) : undefined
    if (saveMode && packet.saveD20 != null) {
      const saveValues = resolveDiceValues([packet.saveD20], dice, 1, 20)
      if (!saveValues) return fail(state, 'invalid-dice', events)
      saveD20 = saveValues[0]
      saveMod = getTokenAbilityMod(targetToken, 'dex', targetCharacter)
      saveTotal = saveD20 + saveMod
      saveSuccess = saveTotal >= actor.saveDC
      if (saveMode === 'half') total = saveSuccess ? Math.floor(adjusted.damage / 2) : adjusted.damage
      if (saveMode === 'none') total = saveSuccess ? 0 : adjusted.damage
      if (saveMode === 'fail-half') total = saveSuccess ? adjusted.damage : Math.floor(adjusted.damage / 2)
      events.push({ type: 'dice-rolled', notation: '1d20', values: [saveD20], total: saveD20 })
    }
    if (total > 0) applyDamageToTarget(state, targetToken, total, events)
    if (action.knockbackOnFailedSave && saveSuccess === false) {
      applyKnockbackToTarget(state, targetToken, action.knockbackTurns ?? KNOCKBACK_DEFAULT_TURNS, events)
    }
    if (action.stunOnFailedConSave && packet.stunSaveD20 != null) {
      const stunValues = resolveDiceValues([packet.stunSaveD20], dice, 1, 20)
      if (!stunValues) return fail(state, 'invalid-dice', events)
      const stunD20 = stunValues[0]
      const stunMod = getTokenAbilityMod(targetToken, 'con', targetCharacter)
      const stunTotal = stunD20 + stunMod
      const stunSuccess = stunTotal >= actor.saveDC
      events.push({ type: 'dice-rolled', notation: '1d20', values: [stunD20], total: stunD20 })
      events.push({
        type: 'status-save-resolved',
        actorTokenId: actorToken.id,
        targetTokenId: targetToken.id,
        condition: STUN_STATUS_LABEL,
        ability: 'con',
        d20Value: stunD20,
        saveMod: stunMod,
        total: stunTotal,
        dc: actor.saveDC,
        success: stunSuccess,
      })
      if (!stunSuccess) {
        applyStunToTarget(state, targetToken, action.stunTurns ?? STUN_DEFAULT_TURNS, events)
      }
    }
    events.push({
      type: 'aoe-target-resolved',
      actorTokenId: actorToken.id,
      characterId: actor.id,
      targetTokenId: targetToken.id,
      skillId: skill.id,
      skillName: skill.name,
      damageValues: targetDamageValues,
      diceTotal: targetDamageValues.reduce((sum, value) => sum + value, 0),
      baseDamage: targetBaseDamage,
      damageBeforeSave: adjusted.damage,
      modifier: adjusted.modifier,
      diff: adjusted.diff,
      total,
      saveD20,
      saveMod,
      saveTotal,
      saveDc: saveMode ? actor.saveDC : undefined,
      saveSuccess,
      saveMode,
      waivedAp: waiveAp,
      apCost: packetIndex === 0 ? apCost : 0,
    })
    events.push({
      type: 'log',
      text: `${actor.name} 的 ${skill.name} 命中 ${targetToken.label}：基础 ${adjusted.damage}${
        saveMode && saveD20 != null
          ? `，敏捷豁免 ${saveD20}+${saveMod} vs DC${actor.saveDC} ${saveSuccess ? '成功' : '失败'}`
          : ''
      }，最终 ${total} 点。`,
    })
    resolvedCount += 1
  }
  if (resolvedCount === 0) return fail(state, 'invalid-target', events)
  markSkillUsed(state, actor.id, skill.id)
  const selfReduction = reduceSkillCooldown(state, actor.id, skill.id, action.selfCooldownReduction ?? 0)
  if (selfReduction.reduced > 0) {
    events.push({
      type: 'log',
      text: `${actor.name}：${selfReduction.skillName} 冷却 -${selfReduction.reduced}（${selfReduction.before}→${selfReduction.after}）。`,
    })
  }
  if (waiveAp) consumeGaleComboReady(state, actor.id, skill.name, events)
  maybeEndCombat(state, events)
  return succeed(state, events)
}

function resolveTargetDodgeAgainstPlayerAttack(
  state: HeadlessDmCombatState,
  actorToken: Token,
  actor: Character,
  targetToken: Token,
  skill: CombatSkill,
  action: HeadlessPlayerAttackAction,
  dice: HeadlessDiceRoller,
  events: HeadlessCombatEvent[],
): { attempted: boolean; dodged: boolean } | null {
  if (targetToken.type !== 'enemy') return { attempted: false, dodged: false }
  if (action.ignoreTargetDodge) {
    events.push({
      type: 'log',
      text: `${actor.name} ignores ${targetToken.label} dodge with ${skill.name}.`,
    })
    return { attempted: false, dodged: false }
  }
  const ap = state.enemyApByToken[targetToken.id]
  if (!ap || ap.current < 1) return { attempted: false, dodged: false }
  const dodgeMode = action.targetDodgeMode ?? 'auto'
  if (dodgeMode === 'skip') return { attempted: false, dodged: false }
  const attackAbility = skill.tags?.includes('melee') ? 'str' : 'dex'
  const attackBonus = getEffectiveAbilityMod(actor, attackAbility) + proficiencyBonus(actor.level)
  const targetAc = getTokenTargetAc(targetToken) ?? 12
  const diceCount = attackDamageDiceCount(skill, false)
  const estimatedDamage = diceCount * ((skill.damageSides + 1) / 2) + (skill.damageBonus ?? 0)
  const baseDecision = decideDodge({
    currentAp: ap.current,
    currentHp: targetToken.hp ?? targetToken.maxHp ?? 1,
    maxHp: targetToken.maxHp ?? targetToken.hp ?? 1,
    targetAc,
    incomingAttackBonus: attackBonus,
    estimatedDamage,
  })
  const decision =
    dodgeMode === 'attempt'
      ? { ...baseDecision, shouldDodge: true, reason: baseDecision.reason || 'forced-attempt' }
      : baseDecision
  if (!decision.shouldDodge) {
    events.push({
      type: 'log',
      text: `${targetToken.label} 保留 AP：不闪避 ${skill.name}（${decision.reason}）。`,
    })
    return { attempted: false, dodged: false }
  }
  if (!spendEnemyAp(state, targetToken.id, 1, events)) return { attempted: false, dodged: false }
  const d20Values = resolveDiceValues(
    action.targetDodgeD20 != null ? [action.targetDodgeD20] : undefined,
    dice,
    1,
    20,
  )
  if (!d20Values) return null
  const d20Value = d20Values[0]
  events.push({ type: 'dice-rolled', notation: '1d20', values: [d20Value], total: d20Value })
  const total = d20Value + attackBonus
  const dodged = total < targetAc
  events.push({
    type: 'target-dodge-resolved',
    actorTokenId: actorToken.id,
    targetTokenId: targetToken.id,
    d20Value,
    attackBonus,
    total,
    targetAc,
    dodged,
    reason: decision.reason,
    successChance: decision.successChance,
  })
  events.push({
    type: 'log',
    text: `${targetToken.label} 花费 1 AP：尝试闪避 ${skill.name}。判定 ${d20Value}+${attackBonus}=${total} vs AC ${targetAc}，${dodged ? '闪避成功' : '闪避失败'}。`,
  })
  return { attempted: true, dodged }
}

function findArmorPiercingSplashTargets(
  state: HeadlessDmCombatState,
  actorToken: Token,
  primaryTarget: Token,
  rangeFeet: number,
): Token[] {
  const dx = primaryTarget.x - actorToken.x
  const dy = primaryTarget.y - actorToken.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return []
  const ux = dx / len
  const uy = dy / len
  const rangePx = (rangeFeet / (state.map.feetPerCell ?? 5)) * Math.max(1, state.map.gridSize)
  const halfWidthPx = Math.max(6, Math.max(1, state.map.gridSize) * 0.5)
  return state.map.tokens.filter((token) => {
    if (token.id === actorToken.id || token.id === primaryTarget.id) return false
    if (token.type !== 'enemy') return false
    if (!isTokenAlive(token, state.characters)) return false
    const tx = token.x - primaryTarget.x
    const ty = token.y - primaryTarget.y
    const forward = tx * ux + ty * uy
    if (forward <= 0 || forward > rangePx) return false
    const perpendicular = Math.abs(tx * -uy + ty * ux)
    return perpendicular <= halfWidthPx
  })
}

function resolveHeadlessPlayerAttackRoll(
  actor: Character,
  targetToken: Token,
  skill: CombatSkill,
  packet: HeadlessAttackRollPacket,
  dice: HeadlessDiceRoller,
  events: HeadlessCombatEvent[],
): { d20: number; attackBonus: number; attackTotal: number; targetAc: number; hit: boolean; isCrit: boolean } | null {
  const firstValues = resolveDiceValues(packet.d20 != null ? [packet.d20] : undefined, dice, 1, 20)
  if (!firstValues) return null
  const secondValues =
    packet.d20Second != null ? resolveDiceValues([packet.d20Second], dice, 1, 20) : undefined
  if (secondValues === null) return null
  const d20 = secondValues ? Math.max(firstValues[0], secondValues[0]) : firstValues[0]
  events.push({
    type: 'dice-rolled',
    notation: secondValues ? '2d20' : '1d20',
    values: secondValues ? [firstValues[0], secondValues[0]] : [firstValues[0]],
    total: d20,
  })
  const ability = packet.ability ?? (skill.tags?.includes('melee') ? 'str' : 'dex')
  const attackBonus = getEffectiveAbilityMod(actor, ability) + proficiencyBonus(actor.level)
  const targetAc = packet.targetAc ?? getTokenTargetAc(targetToken) ?? 12
  const attackTotal = d20 + attackBonus
  const critThreshold = Math.max(1, Math.min(20, packet.critThreshold ?? 20))
  const isCrit = !!packet.forceCrit || d20 >= critThreshold
  const hit = !!packet.forceCrit || isCrit || attackTotal >= targetAc
  events.push({
    type: 'log',
    text: `${actor.name} attack roll ${skill.name}: ${d20}+${attackBonus}=${attackTotal} vs AC ${targetAc}${isCrit ? ' crit' : ''}${hit ? '' : ' miss'}.`,
  })
  return { d20, attackBonus, attackTotal, targetAc, hit, isCrit }
}

function resolveAttackEffectSave(
  state: HeadlessDmCombatState,
  actorToken: Token,
  actor: Character,
  targetToken: Token,
  packet: HeadlessPlayerAttackPacket,
  dice: HeadlessDiceRoller,
  events: HeadlessCombatEvent[],
): { success: boolean } | null {
  const save = packet.effectSave
  if (!save) return { success: true }
  const firstValues = resolveDiceValues(save.d20 != null ? [save.d20] : undefined, dice, 1, 20)
  if (!firstValues) return null
  const secondValues =
    save.disadvantage || save.d20Second != null
      ? resolveDiceValues(save.d20Second != null ? [save.d20Second] : undefined, dice, 1, 20)
      : undefined
  if (secondValues === null) return null
  const first = firstValues[0]
  const second = secondValues?.[0]
  const d20Value = second != null ? Math.min(first, second) : first
  const targetCharacter = targetToken.characterId ? findCharacter(state, targetToken.characterId) : undefined
  const saveMod = getTokenAbilityMod(targetToken, save.ability, targetCharacter)
  const total = d20Value + saveMod
  const success = total >= actor.saveDC
  events.push({
    type: 'dice-rolled',
    notation: second != null ? '2d20' : '1d20',
    values: second != null ? [first, second] : [first],
    total: d20Value,
  })
  events.push({
    type: 'status-save-resolved',
    actorTokenId: actorToken.id,
    targetTokenId: targetToken.id,
    condition: packet.stunOnFailedEffectSave
      ? STUN_STATUS_LABEL
      : packet.restrainedOnFailedEffectSave
        ? RESTRAINED_STATUS_LABEL
        : '效果',
    ability: save.ability,
    d20Value,
    saveMod,
    total,
    dc: actor.saveDC,
    success,
  })
  return { success }
}

function resolveEnemyAttack(
  state: HeadlessDmCombatState,
  action: HeadlessEnemyAttackAction,
  dice: HeadlessDiceRoller,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  const actorToken = state.map.tokens.find((item) => item.id === action.actorTokenId)
  const targetToken = state.map.tokens.find((item) => item.id === action.targetTokenId)
  if (!actorToken || actorToken.type !== 'enemy' || !actorToken.poolId || !isTokenAlive(actorToken, state.characters)) {
    return fail(state, 'invalid-actor', events)
  }
  if (!targetToken || targetToken.type !== 'player' || !targetToken.characterId || !isTokenAlive(targetToken, state.characters)) {
    return fail(state, 'invalid-target', events)
  }
  const block = getEnemyStatBlock(actorToken.poolId)
  const actionDef = block?.actions[action.actionIndex ?? 0] ?? (block ? getPrimaryAttackAction(block) : undefined)
  const parsed = parseDamageDice(actionDef?.damageDice)
  if (!actionDef || !parsed) return fail(state, 'invalid-skill', events)
  const rangeFeet = actionDef.range ?? (actionDef.kind === 'ranged' ? 60 : 5)
  const distanceFeet = tokenFootprintDistanceCells(actorToken, targetToken, state.map) * (state.map.feetPerCell ?? 5)
  if (distanceFeet > rangeFeet) return fail(state, 'out-of-range', events)
  if (!action.actorApAlreadySpent && !spendEnemyAp(state, actorToken.id, 1, events)) return fail(state, 'insufficient-ap', events)

  const target = findCharacter(state, targetToken.characterId)
  const attackBonus = actionDef.toHit ?? ENEMY_MELEE_ATTACK_BONUS
  if (actionDef.kind === 'aoe' && actionDef.save) {
    if (!target) return fail(state, 'invalid-target', events)
    const diceValues = resolveDiceValues(action.diceValues, dice, parsed.count, parsed.sides)
    if (!diceValues) return fail(state, 'invalid-dice', events)
    const diceTotal = diceValues.reduce((sum, value) => sum + value, 0)
    events.push({ type: 'dice-rolled', notation: `${parsed.count}d${parsed.sides}`, values: diceValues, total: diceTotal })
    const fullDamage = Math.max(0, diceTotal + parsed.bonus)
    const saveValues = resolveDiceValues(action.saveD20 != null ? [action.saveD20] : undefined, dice, 1, 20)
    if (!saveValues) return fail(state, 'invalid-dice', events)
    const saveD20 = saveValues[0]
    events.push({ type: 'dice-rolled', notation: '1d20', values: [saveD20], total: saveD20 })
    const saveMod = getEffectiveAbilityMod(target, actionDef.save.ability)
    const saveTotal = saveD20 + saveMod
    const saveSuccess = saveTotal >= actionDef.save.dc
    let finalDamage = saveSuccess ? Math.floor(fullDamage / 2) : fullDamage
    let stableMindUsed = false
    if (action.useStableMind && saveSuccess && finalDamage > 0) {
      const stableMind = consumeStableMind(state, targetToken, target, events)
      if (stableMind === 'invalid') return fail(state, 'invalid-skill', events)
      if (stableMind === 'insufficient-ap') return fail(state, 'insufficient-ap', events)
      stableMindUsed = true
      finalDamage = 0
    }
    const damageApplication =
      finalDamage > 0
        ? applyDamageToTarget(state, targetToken, finalDamage, events, {
            useArcaneSurgeOnLethal: action.useArcaneSurgeOnLethal,
          })
        : undefined
    events.push({
      type: 'log',
      text: `${actorToken.label} 使用 ${actionDef.name}：${target.name} 豁免 ${saveD20}+${saveMod}=${saveTotal} vs DC ${actionDef.save.dc}，${saveSuccess ? `成功，受到 ${finalDamage} 点` : `失败，受到 ${finalDamage} 点`}。`,
    })
    events.push({
      type: 'enemy-attack-resolved',
      actorTokenId: actorToken.id,
      targetTokenId: targetToken.id,
      actionName: actionDef.name,
      damageValues: diceValues,
      diceTotal,
      damageBonus: parsed.bonus,
      rawDamage: fullDamage,
      damageBeforeDefense: fullDamage,
      modifier: 0,
      diff: 0,
      total: finalDamage,
      targetDodged: false,
      saveD20,
      saveMod,
      saveTotal,
      saveDc: actionDef.save.dc,
      saveSuccess,
      stableMindUsed,
      arcaneSurgeUsed: damageApplication?.arcaneSurgeUsed,
    })
    maybeEndCombat(state, events)
    return succeed(state, events)
  }
  let targetDodged = false
  let dodgeD20: number | undefined
  let dodgeTotal: number | undefined
  let targetAc: number | undefined
  if (action.targetWantsDodge && target) {
    const windBladeFreeDodge = (target.combatBuffs?.windBladeFreeDodgeTurns ?? 0) > 0
    const flexibleBodyBonus = Math.max(0, target.combatBuffs?.flexibleBodyBonus ?? 0)
    if (
      !windBladeFreeDodge &&
      !action.targetDodgeApAlreadySpent &&
      !spendCharacterAp(state, target.id, 1, targetToken.id, events)
    ) {
      events.push({ type: 'log', text: `${target.name} 尝试闪避，但 AP 不足。` })
    } else {
      const d20Values = resolveDiceValues(
        action.targetDodgeD20 != null ? [action.targetDodgeD20] : undefined,
        dice,
        1,
        20,
      )
      if (!d20Values) return fail(state, 'invalid-dice', events)
      dodgeD20 = d20Values[0]
      events.push({ type: 'dice-rolled', notation: '1d20', values: [dodgeD20], total: dodgeD20 })
      targetAc = getAc(target) + flexibleBodyBonus
      dodgeTotal = dodgeD20 + attackBonus
      targetDodged = dodgeTotal < targetAc
      if (flexibleBodyBonus > 0) {
        updateCharacter(state, target.id, (item) => ({
          ...item,
          combatBuffs: { ...item.combatBuffs, flexibleBodyBonus: undefined },
        }))
        events.push({ type: 'log', text: `${target.name} 的灵活身躯生效：本次闪避 AC +${flexibleBodyBonus}。` })
      }
      if (windBladeFreeDodge && !action.targetDodgeApAlreadySpent) {
        events.push({ type: 'log', text: `${target.name} 的风刃乱舞生效：本次闪避不消耗 AP。` })
      }
      events.push({
        type: 'log',
        text: `${target.name} 闪避 ${actorToken.label} 的 ${actionDef.name}：${dodgeD20}+${attackBonus}=${dodgeTotal} vs AC ${targetAc}，${targetDodged ? '闪避成功' : '闪避失败'}。`,
      })
    }
  }

  if (targetDodged) {
    events.push({
      type: 'enemy-attack-resolved',
      actorTokenId: actorToken.id,
      targetTokenId: targetToken.id,
      actionName: actionDef.name,
      damageValues: [],
      diceTotal: 0,
      damageBonus: parsed.bonus,
      rawDamage: 0,
      damageBeforeDefense: 0,
      modifier: 0,
      diff: 0,
      total: 0,
      targetDodged: true,
      dodgeD20,
      dodgeAttackBonus: attackBonus,
      dodgeTotal,
      targetAc,
    })
    maybeEndCombat(state, events)
    return succeed(state, events)
  }

  const diceValues = resolveDiceValues(action.diceValues, dice, parsed.count, parsed.sides)
  if (!diceValues) return fail(state, 'invalid-dice', events)
  let allDamageValues = [...diceValues]
  let diceTotal = diceValues.reduce((sum, value) => sum + value, 0)
  events.push({ type: 'dice-rolled', notation: `${parsed.count}d${parsed.sides}`, values: diceValues, total: diceTotal })
  const huntingBacklashRank = actorToken.huntingMarkStacks && actorToken.huntingMarkStacks > 0 ? huntingMarkTraitRank(target) : 0
  if (huntingBacklashRank > 0) {
    const backlashValues = resolveDiceValues(action.huntingBacklashValues, dice, huntingBacklashRank, 4)
    if (!backlashValues) return fail(state, 'invalid-dice', events)
    const backlashTotal = backlashValues.reduce((sum, value) => sum + value, 0)
    events.push({ type: 'dice-rolled', notation: `${huntingBacklashRank}d4`, values: backlashValues, total: backlashTotal })
    events.push({ type: 'log', text: `${target?.name ?? targetToken.label} 受到狩猎印记反噬 +${huntingBacklashRank}d4。` })
    allDamageValues = [...allDamageValues, ...backlashValues]
    diceTotal += backlashTotal
  }
  const baseDamage = diceTotal + parsed.bonus
  const attacker = enemyCombatInput(actorToken.poolId)
  const adjusted = applyAttackDefenseDamageModifier(
    baseDamage,
    attacker,
    target ? characterToCombatInput(target) : undefined,
    enemyDamageType(actionDef.damageType),
    target?.conditions.includes('脆弱') ?? false,
  )
  const damageApplication = applyDamageToTarget(state, targetToken, adjusted.damage, events, {
    useArcaneSurgeOnLethal: action.useArcaneSurgeOnLethal,
  })
  events.push({
    type: 'log',
    text: `${actorToken.label} 使用 ${actionDef.name} 攻击 ${targetToken.label}：骰值 ${allDamageValues.join('+')}，加值 ${parsed.bonus}，攻防修正 ${adjusted.modifier}，最终 ${adjusted.damage} 点。`,
  })
  events.push({
    type: 'enemy-attack-resolved',
    actorTokenId: actorToken.id,
    targetTokenId: targetToken.id,
    actionName: actionDef.name,
    damageValues: allDamageValues,
    diceTotal,
    damageBonus: parsed.bonus,
    rawDamage: baseDamage,
    damageBeforeDefense: baseDamage,
    modifier: adjusted.modifier,
    diff: adjusted.diff,
    total: adjusted.damage,
    targetDodged: false,
    dodgeD20,
    dodgeAttackBonus: dodgeD20 != null ? attackBonus : undefined,
    dodgeTotal,
    targetAc,
    arcaneSurgeUsed: damageApplication.arcaneSurgeUsed,
  })
  maybeEndCombat(state, events)
  return succeed(state, events)
}

function resolveOpportunityAttack(
  state: HeadlessDmCombatState,
  action: HeadlessOpportunityAttackAction,
  dice: HeadlessDiceRoller,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  const actorToken = state.map.tokens.find((item) => item.id === action.actorTokenId)
  const targetToken = state.map.tokens.find((item) => item.id === action.targetTokenId)
  if (
    !actorToken ||
    !targetToken ||
    actorToken.id === targetToken.id ||
    !areOpposedCombatTokens(actorToken, targetToken) ||
    !isTokenAlive(actorToken, state.characters) ||
    !isTokenAlive(targetToken, state.characters)
  ) {
    return fail(state, 'invalid-target', events)
  }
  const distanceFeet = tokenFootprintDistanceCells(actorToken, targetToken, state.map) * (state.map.feetPerCell ?? 5)
  if (distanceFeet > 5) return fail(state, 'out-of-range', events)

  const attacker = actorToken.characterId ? findCharacter(state, actorToken.characterId) : undefined
  const target = targetToken.characterId ? findCharacter(state, targetToken.characterId) : undefined
  if (actorToken.characterId) {
    if (!attacker || actorToken.type !== 'player') return fail(state, 'invalid-actor', events)
    if (!spendCharacterAp(state, attacker.id, 1, actorToken.id, events)) return fail(state, 'insufficient-ap', events)
  } else if (actorToken.type === 'enemy' && actorToken.poolId) {
    if (!spendEnemyAp(state, actorToken.id, 1, events)) return fail(state, 'insufficient-ap', events)
  } else {
    return fail(state, 'invalid-actor', events)
  }

  const d20Values = resolveDiceValues(
    action.d20Value != null ? [action.d20Value] : undefined,
    dice,
    1,
    20,
  )
  if (!d20Values) return fail(state, 'invalid-dice', events)
  const d20Value = d20Values[0]
  events.push({ type: 'dice-rolled', notation: '1d20', values: [d20Value], total: d20Value })

  const attackBonus = attacker
    ? getEffectiveAbilityMod(attacker, 'str') + proficiencyBonus(attacker.level)
    : getTokenAbilityMod(actorToken, 'str') + 2
  const targetAc = target ? getAc(target) : (getTokenTargetAc(targetToken) ?? 12)
  const hit = d20Value + attackBonus >= targetAc || d20Value >= 20
  const isCrit = d20Value >= 20
  let damageValues: number[] = []
  let rawDamage = 0
  let damageBeforeDefense = 0
  let modifier = 0
  let diff = 0
  let total = 0

  if (hit) {
    const resolvedDamageValues = resolveDiceValues(action.damageValues, dice, 1, 6)
    if (!resolvedDamageValues) return fail(state, 'invalid-dice', events)
    damageValues = resolvedDamageValues
    rawDamage = damageValues.reduce((sum, value) => sum + value, 0)
    events.push({ type: 'dice-rolled', notation: '1d6', values: damageValues, total: rawDamage })
    const attackerInput = attacker ? characterToCombatInput(attacker) : enemyCombatInput(actorToken.poolId ?? '')
    const critMultiplier = attackerInput ? computeCritDamageMultiplier(attackerInput) : 1.25
    damageBeforeDefense = isCrit ? Math.floor(rawDamage * critMultiplier) : rawDamage
    const adjusted = target
      ? applyAttackDefenseDamageModifier(
          damageBeforeDefense,
          attackerInput,
          characterToCombatInput(target),
          'physical',
          (targetToken.vulnerableTurns ?? 0) > 0 || target.conditions.includes('脆弱'),
        )
      : adjustDamageAgainstToken(damageBeforeDefense, attackerInput, targetToken, 'physical')
    modifier = adjusted.modifier
    diff = adjusted.diff
    total = adjusted.damage
    if (total > 0) applyDamageToTarget(state, targetToken, total, events)
  }

  events.push({
    type: 'opportunity-resolved',
    attackerTokenId: actorToken.id,
    targetTokenId: targetToken.id,
    d20Value,
    attackBonus,
    targetAc,
    hit,
    isCrit,
    damageValues,
    rawDamage,
    damageBeforeDefense,
    modifier,
    diff,
    total,
  })
  events.push({
    type: 'log',
    text: `${attacker?.name ?? actorToken.label} 借机攻击 ${target?.name ?? targetToken.label}：D20 ${d20Value}+${attackBonus} vs AC ${targetAc}，${hit ? `最终 ${total} 点` : '未命中'}。`,
  })
  maybeEndCombat(state, events)
  return succeed(state, events)
}

function resolveDiceValues(
  provided: number[] | undefined,
  roller: HeadlessDiceRoller,
  count: number,
  sides: number,
): number[] | null {
  if (count <= 0) return []
  const roundedSides = Math.max(2, Math.floor(sides))
  const values = provided ?? roller.rollDice(count, roundedSides)
  if (values.length !== count) return null
  if (values.some((value) => !Number.isInteger(value) || value < 1 || value > roundedSides)) return null
  return values
}

function spendCharacterAp(
  state: HeadlessDmCombatState,
  characterId: string,
  amount: number,
  tokenId: string,
  events: HeadlessCombatEvent[],
): boolean {
  const character = findCharacter(state, characterId)
  if (!character || character.currentAP < amount || character.currentHp <= 0) return false
  const before = character.currentAP
  updateCharacter(state, characterId, (item) => ({ ...item, currentAP: item.currentAP - amount }))
  events.push({ type: 'ap-spent', tokenId, characterId, amount, before, after: before - amount })
  return true
}

function spendEnemyAp(
  state: HeadlessDmCombatState,
  tokenId: string,
  amount: number,
  events: HeadlessCombatEvent[],
): boolean {
  const ap = state.enemyApByToken[tokenId]
  if (!ap || ap.current < amount) return false
  const before = ap.current
  state.enemyApByToken[tokenId] = { ...ap, current: before - amount }
  events.push({ type: 'ap-spent', tokenId, amount, before, after: before - amount })
  return true
}

interface HeadlessDamageApplicationOptions {
  useArcaneSurgeOnLethal?: boolean
}

interface HeadlessDamageApplicationResult {
  hpBefore: number
  hpAfter: number
  arcaneSurgeUsed: boolean
}

function applyDamageToTarget(
  state: HeadlessDmCombatState,
  targetToken: Token,
  amount: number,
  events: HeadlessCombatEvent[],
  options: HeadlessDamageApplicationOptions = {},
): HeadlessDamageApplicationResult {
  const character = targetToken.characterId ? findCharacter(state, targetToken.characterId) : undefined
  if (character) {
    const hpBefore = character.currentHp
    const tempBefore = character.tempHp ?? 0
    const remainingAfterTemp = Math.max(0, amount - tempBefore)
    const wouldBeLethal = hpBefore > 0 && hpBefore - remainingAfterTemp <= 0
    const arcaneTrait = character.traits.find((trait) => trait.featureKey === 'arcaneSurge')
    if (options.useArcaneSurgeOnLethal && wouldBeLethal && arcaneTrait && arcaneTrait.uses > 0) {
      updateCharacter(state, character.id, (item) => ({
        ...item,
        currentHp: 1,
        traits: item.traits.map((trait) =>
          trait.featureKey === 'arcaneSurge' ? { ...trait, uses: Math.max(0, trait.uses - 1) } : trait,
        ),
      }))
      updateToken(state, targetToken.id, (item) => ({ ...item, hp: 1, maxHp: character.maxHp }))
      events.push({ type: 'damage-applied', targetTokenId: targetToken.id, characterId: character.id, amount, hpBefore, hpAfter: 1 })
      events.push({ type: 'log', text: `${character.name} 发动魔法浪涌：生命保留为 1。` })
      return { hpBefore, hpAfter: 1, arcaneSurgeUsed: true }
    }
    const nextTemp = Math.max(0, tempBefore - amount)
    const remaining = remainingAfterTemp
    const hpAfter = Math.max(0, hpBefore - remaining)
    updateCharacter(state, character.id, (item) => ({
      ...item,
      currentHp: hpAfter,
      tempHp: nextTemp,
      combatBuffs: {
        ...triggerOutOfBreath(item, 'damage'),
        tookDamageThisTurn: true,
      },
    }))
    updateToken(state, targetToken.id, (item) => ({ ...item, hp: hpAfter, maxHp: character.maxHp }))
    events.push({ type: 'damage-applied', targetTokenId: targetToken.id, characterId: character.id, amount, hpBefore, hpAfter })
    return { hpBefore, hpAfter, arcaneSurgeUsed: false }
  }
  const hpBefore = targetToken.hp ?? targetToken.maxHp ?? 0
  const hpAfter = Math.max(0, hpBefore - amount)
  updateToken(state, targetToken.id, (item) => ({ ...item, hp: hpAfter }))
  events.push({ type: 'damage-applied', targetTokenId: targetToken.id, amount, hpBefore, hpAfter })
  return { hpBefore, hpAfter, arcaneSurgeUsed: false }
}

function resolveFinaleDamageValues(
  provided: number[] | undefined,
  roller: HeadlessDiceRoller,
  traitLevel: number,
): number[] | null {
  const d10 = resolveDiceValues(provided?.slice(0, 6), roller, 6, 10)
  if (!d10) return null
  const extraCount = Math.max(0, traitLevel - 1)
  const d8 = resolveDiceValues(provided?.slice(6), roller, extraCount, 8)
  if (!d8) return null
  return [...d10, ...d8]
}

function resolveFinaleTrigger(
  state: HeadlessDmCombatState,
  actor: Character,
  targetToken: Token,
  damageValues: number[],
  events: HeadlessCombatEvent[],
) {
  const total = damageValues.reduce((sum, value) => sum + value, 0)
  updateCharacter(state, actor.id, (item) => ({
    ...item,
    combatBuffs: { ...item.combatBuffs, finaleReady: undefined },
  }))
  updateToken(state, targetToken.id, (token) => ({
    ...token,
    huntingMarkStacks: 0,
  }))
  applyStunToTarget(state, targetToken, STUN_DEFAULT_TURNS, events)
  const latestTarget = state.map.tokens.find((token) => token.id === targetToken.id) ?? targetToken
  applyDamageToTarget(state, latestTarget, total, events)
  events.push({
    type: 'dice-rolled',
    notation: `6d10${damageValues.length > 6 ? `+${damageValues.length - 6}d8` : ''}`,
    values: damageValues,
    total,
  })
  events.push({
    type: 'log',
    text: `${actor.name} 的曲终触发：${targetToken.label} 狩猎印记达到 4 层，${damageValues.join(' + ')} = ${total} 点力场伤害，眩晕并移除所有狩猎印记。`,
  })
}

function adjustDamageForTarget(
  state: HeadlessDmCombatState,
  baseDamage: number,
  attacker: Character,
  targetToken: Token,
  damageType: DamageReductionType,
) {
  const targetCharacter = targetToken.characterId ? findCharacter(state, targetToken.characterId) : undefined
  if (targetCharacter) {
    return applyAttackDefenseDamageModifier(
      baseDamage,
      characterToCombatInput(attacker),
      characterToCombatInput(targetCharacter),
      damageType,
      targetCharacter.conditions.includes('脆弱'),
    )
  }
  return adjustDamageAgainstToken(baseDamage, characterToCombatInput(attacker), targetToken, damageType)
}

function applyStatusOnHit(
  state: HeadlessDmCombatState,
  targetToken: Token,
  skill: CombatSkill,
  events: HeadlessCombatEvent[],
) {
  if (!skill.statusOnHit) return
  if (skill.skillTreeId === 'explosiveArrow') return
  const condition = skill.statusOnHit === 'burning' ? '燃烧' : '中毒'
  const turns = skill.statusDuration ?? (skill.statusOnHit === 'burning' ? 3 : 4)
  if (targetToken.characterId) {
    updateCharacter(state, targetToken.characterId, (character) => ({
      ...character,
      conditions: Array.from(new Set([...character.conditions, condition])),
    }))
  }
  const patch = skill.statusOnHit === 'burning' ? { burningTurns: turns } : { poisonTurns: turns }
  updateToken(state, targetToken.id, (token) => ({ ...token, ...patch }))
  events.push({ type: 'status-added', targetTokenId: targetToken.id, characterId: targetToken.characterId, condition, turns })
}

function applyKnockbackToTarget(
  state: HeadlessDmCombatState,
  targetToken: Token,
  turns: number,
  events: HeadlessCombatEvent[],
) {
  const nextTurns = Math.max(KNOCKBACK_DEFAULT_TURNS, turns)
  if (targetToken.characterId) {
    updateCharacter(state, targetToken.characterId, (character) => ({
      ...character,
      conditions: Array.from(new Set([...character.conditions, KNOCKBACK_STATUS_LABEL])),
    }))
  }
  updateToken(state, targetToken.id, (token) => ({
    ...token,
    knockbackTurns: Math.max(token.knockbackTurns ?? 0, nextTurns),
  }))
  events.push({
    type: 'status-added',
    targetTokenId: targetToken.id,
    characterId: targetToken.characterId,
    condition: KNOCKBACK_STATUS_LABEL,
    turns: nextTurns,
  })
}

function applyStunToTarget(
  state: HeadlessDmCombatState,
  targetToken: Token,
  turns: number,
  events: HeadlessCombatEvent[],
) {
  const nextTurns = Math.max(STUN_DEFAULT_TURNS, turns)
  if (targetToken.characterId) {
    updateCharacter(state, targetToken.characterId, (character) => ({
      ...character,
      conditions: Array.from(new Set([...character.conditions, STUN_STATUS_LABEL])),
    }))
  }
  updateToken(state, targetToken.id, (token) => ({
    ...token,
    stunTurns: Math.max(token.stunTurns ?? 0, nextTurns),
  }))
  events.push({
    type: 'status-added',
    targetTokenId: targetToken.id,
    characterId: targetToken.characterId,
    condition: STUN_STATUS_LABEL,
    turns: nextTurns,
  })
}

function applyRestrainedToTarget(
  state: HeadlessDmCombatState,
  targetToken: Token,
  turns: number,
  events: HeadlessCombatEvent[],
) {
  const nextTurns = Math.max(1, turns)
  if (targetToken.characterId) {
    updateCharacter(state, targetToken.characterId, (character) => ({
      ...character,
      conditions: Array.from(new Set([...character.conditions, RESTRAINED_STATUS_LABEL])),
    }))
  }
  updateToken(state, targetToken.id, (token) => ({
    ...token,
    restrainedTurns: Math.max(token.restrainedTurns ?? 0, nextTurns),
  }))
  events.push({
    type: 'status-added',
    targetTokenId: targetToken.id,
    characterId: targetToken.characterId,
    condition: RESTRAINED_STATUS_LABEL,
    turns: nextTurns,
  })
}

function applyNoMoveToTarget(
  state: HeadlessDmCombatState,
  targetToken: Token,
  turns: number,
  events: HeadlessCombatEvent[],
) {
  const nextTurns = Math.max(1, turns)
  if (targetToken.characterId) {
    updateCharacter(state, targetToken.characterId, (character) => ({
      ...character,
      conditions: Array.from(new Set([...character.conditions, NO_MOVE_STATUS_LABEL])),
    }))
  }
  updateToken(state, targetToken.id, (token) => ({
    ...token,
    noMoveTurns: Math.max(token.noMoveTurns ?? 0, nextTurns),
  }))
  events.push({
    type: 'status-added',
    targetTokenId: targetToken.id,
    characterId: targetToken.characterId,
    condition: NO_MOVE_STATUS_LABEL,
    turns: nextTurns,
  })
}

function applyBurningToTarget(
  state: HeadlessDmCombatState,
  targetToken: Token,
  turns: number,
  events: HeadlessCombatEvent[],
) {
  const nextTurns = Math.max(1, turns)
  if (targetToken.characterId) {
    updateCharacter(state, targetToken.characterId, (character) => ({
      ...character,
      conditions: Array.from(new Set([...character.conditions, '燃烧'])),
    }))
  }
  updateToken(state, targetToken.id, (token) => ({
    ...token,
    burningTurns: Math.max(token.burningTurns ?? 0, nextTurns),
  }))
  events.push({
    type: 'status-added',
    targetTokenId: targetToken.id,
    characterId: targetToken.characterId,
    condition: '燃烧',
    turns: nextTurns,
  })
}

function applyIgniteToTarget(
  state: HeadlessDmCombatState,
  targetToken: Token,
  turns: number,
  events: HeadlessCombatEvent[],
) {
  const nextTurns = Math.max(1, turns)
  if (targetToken.characterId) {
    updateCharacter(state, targetToken.characterId, (character) => ({
      ...character,
      conditions: Array.from(new Set([...character.conditions, '点燃'])),
    }))
  }
  updateToken(state, targetToken.id, (token) => ({
    ...token,
    igniteTurns: Math.max(token.igniteTurns ?? 0, nextTurns),
  }))
  events.push({
    type: 'status-added',
    targetTokenId: targetToken.id,
    characterId: targetToken.characterId,
    condition: '点燃',
    turns: nextTurns,
  })
}

function applyVulnerableToTarget(
  state: HeadlessDmCombatState,
  targetToken: Token,
  turns: number,
  events: HeadlessCombatEvent[],
) {
  const nextTurns = Math.max(1, turns)
  if (targetToken.characterId) {
    updateCharacter(state, targetToken.characterId, (character) => ({
      ...character,
      conditions: Array.from(new Set([...character.conditions, VULNERABLE_STATUS_LABEL])),
    }))
  }
  updateToken(state, targetToken.id, (token) => ({
    ...token,
    vulnerableTurns: Math.max(token.vulnerableTurns ?? 0, nextTurns),
  }))
  events.push({
    type: 'status-added',
    targetTokenId: targetToken.id,
    characterId: targetToken.characterId,
    condition: VULNERABLE_STATUS_LABEL,
    turns: nextTurns,
  })
}

function clearTargetStatusesFromTarget(state: HeadlessDmCombatState, targetToken: Token): number {
  const statusFields = [
    'burningTurns',
    'igniteTurns',
    'poisonTurns',
    'stunTurns',
    'knockbackTurns',
    'restrainedTurns',
    'vulnerableTurns',
  ] as const
  let removed = 0
  updateToken(state, targetToken.id, (token) => {
    const patch: Partial<Token> = {}
    for (const field of statusFields) {
      if ((token[field] ?? 0) > 0) {
        patch[field] = 0
        removed += 1
      }
    }
    return Object.keys(patch).length > 0 ? { ...token, ...patch } : token
  })
  if (targetToken.characterId) {
    const targetCharacter = findCharacter(state, targetToken.characterId)
    if (targetCharacter && targetCharacter.conditions.length > 0) {
      removed += targetCharacter.conditions.length
      updateCharacter(state, targetCharacter.id, (character) => ({ ...character, conditions: [] }))
    }
  }
  return removed
}

function pullTargetTowardActor(
  state: HeadlessDmCombatState,
  actorToken: Token,
  targetToken: Token,
  cells: number,
  events: HeadlessCombatEvent[],
) {
  const from = { x: targetToken.x, y: targetToken.y }
  const targetAnchor = tokenAnchorCellFromPixel(targetToken.x, targetToken.y, targetToken, state.map)
  const actorAnchor = tokenAnchorCellFromPixel(actorToken.x, actorToken.y, actorToken, state.map)
  const dx = actorAnchor.col - targetAnchor.col
  const dy = actorAnchor.row - targetAnchor.row
  const len = Math.hypot(dx, dy)
  if (len <= 0.0001 || cells <= 0) return
  const nextAnchor = {
    col: targetAnchor.col + Math.round((dx / len) * cells),
    row: targetAnchor.row + Math.round((dy / len) * cells),
  }
  const to = tokenCenterForAnchorCell(nextAnchor, targetToken, state.map)
  updateToken(state, targetToken.id, (token) => ({ ...token, ...to }))
  events.push({
    type: 'token-moved',
    tokenId: targetToken.id,
    from,
    to,
    feet: Math.round(Math.hypot(to.x - from.x, to.y - from.y) / Math.max(1, state.map.gridSize) * (state.map.feetPerCell ?? 5)),
    triggersMoveEffects: false,
  })
}

function isSmallOrMediumToken(token: Token): boolean {
  return creatureSizeToFootprintCells(token.creatureSize ?? sizeFromTokenSize(token.size)) <= 1
}

function pushTargetAwayFromActor(
  state: HeadlessDmCombatState,
  actorToken: Token,
  targetToken: Token,
  cells: number,
  events: HeadlessCombatEvent[],
) {
  const from = { x: targetToken.x, y: targetToken.y }
  const targetAnchor = tokenAnchorCellFromPixel(targetToken.x, targetToken.y, targetToken, state.map)
  const actorAnchor = tokenAnchorCellFromPixel(actorToken.x, actorToken.y, actorToken, state.map)
  const dx = targetAnchor.col - actorAnchor.col
  const dy = targetAnchor.row - actorAnchor.row
  const len = Math.hypot(dx, dy)
  if (len <= 0.0001 || cells <= 0) return
  const nextAnchor = {
    col: targetAnchor.col + Math.round((dx / len) * cells),
    row: targetAnchor.row + Math.round((dy / len) * cells),
  }
  const to = tokenCenterForAnchorCell(nextAnchor, targetToken, state.map)
  updateToken(state, targetToken.id, (token) => ({ ...token, ...to }))
  events.push({
    type: 'token-moved',
    tokenId: targetToken.id,
    from,
    to,
    feet: Math.round(Math.hypot(to.x - from.x, to.y - from.y) / Math.max(1, state.map.gridSize) * (state.map.feetPerCell ?? 5)),
    triggersMoveEffects: false,
  })
}

function grantBurstKickExtraD6(state: HeadlessDmCombatState, characterId: string, count: number) {
  updateCharacter(state, characterId, (character) => ({
    ...character,
    combatBuffs: {
      ...character.combatBuffs,
      burstKickExtraD6: Math.max(character.combatBuffs?.burstKickExtraD6 ?? 0, count),
    },
  }))
}

function clearBurstKickExtraD6(state: HeadlessDmCombatState, characterId: string) {
  updateCharacter(state, characterId, (character) => ({
    ...character,
    combatBuffs: {
      ...character.combatBuffs,
      burstKickExtraD6: undefined,
    },
  }))
}

function clearWindKickTreatKnockback(state: HeadlessDmCombatState, characterId: string) {
  updateCharacter(state, characterId, (character) => ({
    ...character,
    combatBuffs: {
      ...character.combatBuffs,
      windKickTreatKnockbackTargetId: undefined,
    },
  }))
}

function clearActorCondition(
  state: HeadlessDmCombatState,
  characterId: string,
  condition: string,
  events: HeadlessCombatEvent[],
) {
  const actor = findCharacter(state, characterId)
  if (!actor?.conditions.includes(condition)) return
  updateCharacter(state, characterId, (character) => ({
    ...character,
    conditions: character.conditions.filter((item) => item !== condition),
  }))
  events.push({ type: 'log', text: `${actor.name} 解除${condition}状态。` })
}

function grantSkillFreeMove(
  state: HeadlessDmCombatState,
  characterId: string,
  feet: number,
  events: HeadlessCombatEvent[],
) {
  const amount = Math.max(0, Math.floor(feet))
  if (amount <= 0) return
  updateCharacter(state, characterId, (character) => ({
    ...character,
    combatBuffs: {
      ...character.combatBuffs,
      freeMoveFeet: Math.max(character.combatBuffs?.freeMoveFeet ?? 0, amount),
    },
  }))
  const character = findCharacter(state, characterId)
  events.push({ type: 'log', text: `${character?.name ?? characterId} 获得 ${amount} 尺技能移动，不触发借机攻击。` })
}

function grantDisengage(state: HeadlessDmCombatState, characterId: string) {
  state.disengagedCharacterIds = Array.from(new Set([...(state.disengagedCharacterIds ?? []), characterId]))
}

function grantWindKickTreatKnockback(state: HeadlessDmCombatState, characterId: string, targetTokenId: string) {
  updateCharacter(state, characterId, (character) => ({
    ...character,
    combatBuffs: {
      ...character.combatBuffs,
      windKickTreatKnockbackTargetId: targetTokenId,
    },
  }))
}

function markSkillUsed(state: HeadlessDmCombatState, characterId: string, skillId: string) {
  updateCharacter(state, characterId, (character) => ({
    ...character,
    combatSkills: character.combatSkills.map((skill) =>
      skill.id === skillId
        ? {
            ...skill,
            usedThisTurn: true,
            remaining: skillCooldownRemaining(skill),
          }
        : skill,
    ),
  }))
}

function spendFeatureUse(state: HeadlessDmCombatState, characterId: string, featureKey: ClassFeatureKey): boolean {
  const character = findCharacter(state, characterId)
  const trait = character?.traits.find((item) => item.featureKey === featureKey)
  if (!character || !trait || trait.maxUses <= 0 || trait.uses <= 0) return false
  updateCharacter(state, characterId, (item) => ({
    ...item,
    traits: item.traits.map((currentTrait) =>
      currentTrait.featureKey === featureKey
        ? { ...currentTrait, uses: Math.max(0, currentTrait.uses - 1) }
        : currentTrait,
    ),
  }))
  return true
}

function reduceSkillCooldown(
  state: HeadlessDmCombatState,
  characterId: string,
  skillId: string,
  amount: number,
): { skillName: string; before: number; after: number; reduced: number } {
  const character = findCharacter(state, characterId)
  const skill = character?.combatSkills.find((item) => item.id === skillId)
  if (!skill || amount <= 0) {
    const current = skill?.remaining ?? 0
    return { skillName: skill?.name ?? skillId, before: current, after: current, reduced: 0 }
  }
  const before = skill.remaining
  const after = Math.max(0, before - amount)
  updateCharacter(state, characterId, (character) => ({
    ...character,
    combatSkills: character.combatSkills.map((skill) =>
      skill.id === skillId ? { ...skill, remaining: after } : skill,
    ),
  }))
  return { skillName: skill.name, before, after, reduced: before - after }
}

function consumeGaleComboReady(
  state: HeadlessDmCombatState,
  characterId: string,
  actionLabel: string,
  events: HeadlessCombatEvent[],
): boolean {
  const character = findCharacter(state, characterId)
  if (!character?.combatBuffs?.galeComboReady) return false
  updateCharacter(state, characterId, (item) => ({
    ...item,
    traits: item.traits.map((trait) =>
      trait.featureKey === 'galeCombo' && trait.maxUses > 0
        ? { ...trait, uses: Math.max(0, trait.uses - 1) }
        : trait,
    ),
    combatBuffs: { ...item.combatBuffs, galeComboReady: undefined },
  }))
  events.push({ type: 'log', text: `${character.name} 消耗疾风连击：${actionLabel} 不消耗 AP。` })
  return true
}

function applyStillWatersHealingOnBreathShift(
  before: Character,
  after: Character,
  dice: HeadlessDiceRoller,
  events: HeadlessCombatEvent[],
): Character {
  const trait = findClassTrait(after, 'swiftShot')
  if (!trait || after.currentHp <= 0) return after
  const beforeState = calmBreathState(before)
  const afterState = calmBreathState(after)
  const switched =
    (beforeState === 'calm' && afterState === 'outOfBreath') ||
    (beforeState === 'outOfBreath' && afterState === 'calm')
  if (!switched) return after
  const count = Math.max(1, trait.level)
  const values = dice.rollDice(count, 4)
  const heal = values.reduce((sum, value) => sum + value, 0)
  events.push({ type: 'dice-rolled', notation: `${count}d4`, values, total: heal })
  if (heal <= 0) return after
  const healed = { ...after, currentHp: Math.min(after.maxHp, after.currentHp + heal) }
  events.push({ type: 'log', text: `${after.name} 波澜不惊回复 ${heal} 点生命值。` })
  return healed
}

function syncCharacterTokenHp(state: HeadlessDmCombatState, characterId: string) {
  const character = findCharacter(state, characterId)
  if (!character) return
  for (const token of state.map.tokens) {
    if (token.characterId !== characterId) continue
    updateToken(state, token.id, (item) => ({ ...item, hp: character.currentHp, maxHp: character.maxHp }))
  }
}

function applyHeadlessEndTurnEffects(
  state: HeadlessDmCombatState,
  characterId: string,
  dice: HeadlessDiceRoller,
  events: HeadlessCombatEvent[],
) {
  const before = findCharacter(state, characterId)
  if (!before) return
  updateCharacter(state, characterId, (character) => {
    const beforeTick = character.combatBuffs ?? {}
    const firstCalmMindCheck = !!beforeTick.calmMindFirstTurnPending && !!findClassTrait(character, 'calmMind')
    const canGainInitialCalmMind =
      firstCalmMindCheck &&
      !beforeTick.movedFeetThisTurn &&
      !beforeTick.tookDamageThisTurn &&
      (beforeTick.outOfBreathTurns ?? 0) <= 0
    const checkedBuffs = firstCalmMindCheck
      ? {
          ...beforeTick,
          calmMind: canGainInitialCalmMind ? true : undefined,
          calmMindFirstTurnPending: undefined,
        }
      : beforeTick
    const calmSpirit = findClassTrait(character, 'calmSpirit')
    const calmStacks =
      calmSpirit && isCalmMindActive({ ...character, combatBuffs: checkedBuffs })
        ? Math.min(4, (checkedBuffs.calmSpiritStacks ?? 0) + 1)
        : checkedBuffs.calmSpiritStacks
    const stillWaterTempTurns = checkedBuffs.stillWaterTempHpTurns ?? 0
    const nextStillWaterTempTurns = stillWaterTempTurns > 0 ? stillWaterTempTurns - 1 : 0
    const stillWaterTempExpired = stillWaterTempTurns > 0 && nextStillWaterTempTurns <= 0
    const after: Character = {
      ...character,
      tempHp: stillWaterTempExpired ? 0 : character.tempHp,
      combatBuffs: {
        ...tickOutOfBreathOnEndTurn({ ...character, combatBuffs: checkedBuffs }),
        calmSpiritStacks: calmStacks && calmStacks > 0 ? calmStacks : undefined,
        stillWaterTempHpTurns: nextStillWaterTempTurns > 0 ? nextStillWaterTempTurns : undefined,
      },
      combatSkills: character.combatSkills.map((skill) => ({
        ...skill,
        remaining: Math.max(0, skill.remaining - 1),
      })),
    }
    return applyStillWatersHealingOnBreathShift(character, after, dice, events)
  })
  syncCharacterTokenHp(state, characterId)
}

function advanceHeadlessTurn(state: HeadlessDmCombatState, events: HeadlessCombatEvent[]) {
  if (!state.initiativeOrder.length) {
    state.active = false
    return
  }
  if (!hasActionableActor(state.initiativeOrder, state.map.tokens, state.characters)) {
    state.active = false
    return
  }
  let guard = state.initiativeOrder.length + 1
  do {
    const wrapped = state.initiativeIndex + 1 >= state.initiativeOrder.length
    state.initiativeIndex = wrapped ? 0 : state.initiativeIndex + 1
    if (wrapped) {
      applyHeadlessRoundWrapEffects(state, events)
      maybeEndCombat(state, events)
      if (!state.active) return
      state.round += 1
      resetRoundAp(state)
    }
    const turn = getCurrentTurn(state)
    const token = turn ? state.map.tokens.find((item) => item.id === turn.tokenId) : undefined
    const decision = decideTurnAction(token, state.characters)
    if (decision === 'player' || decision === 'enemy') {
      applyHeadlessCurrentTurnStart(state, events)
      events.push({ type: 'turn-advanced', round: state.round, initiativeIndex: state.initiativeIndex, tokenId: turn?.tokenId })
      return
    }
    guard -= 1
  } while (guard > 0)
}

function applyHeadlessCurrentTurnStart(state: HeadlessDmCombatState, events: HeadlessCombatEvent[]) {
  const turn = getCurrentTurn(state)
  const token = turn ? state.map.tokens.find((item) => item.id === turn.tokenId) : undefined
  if (!token || token.type !== 'player' || !token.characterId) return
  if (!isTokenAlive(token, state.characters)) return
  applyHeadlessBeginTurnEffects(state, token, events)
}

function applyHeadlessBeginTurnEffects(
  state: HeadlessDmCombatState,
  token: Token,
  events: HeadlessCombatEvent[],
) {
  if (!token.characterId) return
  const key = `turn-${state.round}-${state.initiativeIndex}-${token.id}`
  const current = findCharacter(state, token.characterId)
  if (!current || current.combatBuffs?.turnStartKey === key) return

  updateCharacter(state, token.characterId, (character) => {
    let combatBuffs = beginCalmMindTurn(character)
    const eagleTurns = combatBuffs.eagleEyeTurns ?? 0
    if (eagleTurns > 0) {
      const next = eagleTurns - 1
      combatBuffs = { ...combatBuffs, eagleEyeTurns: next > 0 ? next : undefined }
    }
    return {
      ...character,
      combatBuffs: {
        ...combatBuffs,
        steadyDrawUsedThisTurn: undefined,
        movedFeetThisTurn: undefined,
        tookDamageThisTurn: undefined,
        turnStartKey: key,
      },
      combatSkills: character.combatSkills.map((skill) => ({ ...skill, usedThisTurn: false })),
    }
  })
  events.push({
    type: 'turn-started',
    round: state.round,
    initiativeIndex: state.initiativeIndex,
    tokenId: token.id,
    characterId: token.characterId,
  })
}

function decrementTokenStatus(
  token: Token,
  patch: Partial<Token>,
  field: 'burningTurns' | 'igniteTurns' | 'poisonTurns' | 'knockbackTurns' | 'stunTurns' | 'restrainedTurns' | 'vulnerableTurns' | 'noMoveTurns' | 'illusionDanceTurns',
  conditions: string[] | null,
  conditionLabel?: string,
): string[] | null {
  const current = token[field] ?? 0
  if (current <= 0) return conditions
  patch[field] = Math.max(0, current - 1)
  if (patch[field] === 0 && conditions && conditionLabel) {
    return conditions.filter((condition) => condition !== conditionLabel)
  }
  return conditions
}

function applyHeadlessRoundWrapEffects(state: HeadlessDmCombatState, events: HeadlessCombatEvent[]) {
  const tokens = [...state.map.tokens]
  for (const token of tokens) {
    const latestToken = state.map.tokens.find((item) => item.id === token.id)
    if (!latestToken) continue
    const dot = dotDamageFor(latestToken)
    if (shouldApplyDotTick(latestToken, state.characters, dot)) {
      applyDamageToTarget(state, latestToken, dot, events)
    }

    const afterDamageToken = state.map.tokens.find((item) => item.id === token.id) ?? latestToken
    const character = afterDamageToken.characterId ? findCharacter(state, afterDamageToken.characterId) : undefined
    let conditions = character ? [...character.conditions] : null
    const patch: Partial<Token> = {}
    conditions = decrementTokenStatus(afterDamageToken, patch, 'burningTurns', conditions, BURNING_STATUS_LABEL)
    conditions = decrementTokenStatus(afterDamageToken, patch, 'igniteTurns', conditions, IGNITE_STATUS_LABEL)
    conditions = decrementTokenStatus(afterDamageToken, patch, 'poisonTurns', conditions, POISON_STATUS_LABEL)
    conditions = decrementTokenStatus(afterDamageToken, patch, 'knockbackTurns', conditions, KNOCKBACK_STATUS_LABEL)
    conditions = decrementTokenStatus(afterDamageToken, patch, 'stunTurns', conditions, STUN_STATUS_LABEL)
    conditions = decrementTokenStatus(afterDamageToken, patch, 'restrainedTurns', conditions, RESTRAINED_STATUS_LABEL)
    conditions = decrementTokenStatus(afterDamageToken, patch, 'vulnerableTurns', conditions, VULNERABLE_STATUS_LABEL)
    conditions = decrementTokenStatus(afterDamageToken, patch, 'noMoveTurns', conditions, NO_MOVE_STATUS_LABEL)
    conditions = decrementTokenStatus(afterDamageToken, patch, 'illusionDanceTurns', conditions)

    if (Object.keys(patch).length > 0) {
      updateToken(state, afterDamageToken.id, (item) => ({ ...item, ...patch }))
    }
    if (character && conditions && conditions.length !== character.conditions.length) {
      updateCharacter(state, character.id, (item) => ({ ...item, conditions }))
    }
  }

  if (state.round === 1) {
    const characterIds = new Set(state.map.tokens.map((token) => token.characterId).filter((id): id is string => !!id))
    for (const characterId of characterIds) {
      const character = findCharacter(state, characterId)
      if (!character || !findClassTrait(character, 'silentDraw') || character.combatBuffs?.silentDrawUsed) continue
      updateCharacter(state, character.id, (item) => ({
        ...item,
        combatBuffs: { ...item.combatBuffs, silentDrawUsed: true },
      }))
    }
  }
}

function resetRoundAp(state: HeadlessDmCombatState) {
  const participantIds = activeCharacterIds(state)
  state.characters = state.characters.map((character) => ({
    ...character,
    currentAP:
      participantIds.has(character.id) && character.currentHp > 0
        ? character.actionPoints
        : character.currentAP,
  }))
  const nextEnemyApByToken: Record<string, HeadlessEnemyApState> = {}
  for (const token of state.map.tokens) {
    if (token.type !== 'enemy') continue
    const existing = state.enemyApByToken[token.id]
    if (isTokenAlive(token, state.characters)) {
      nextEnemyApByToken[token.id] = { current: existing?.max ?? 2, max: existing?.max ?? 2 }
    }
  }
  state.enemyApByToken = nextEnemyApByToken
}

function maybeEndCombat(state: HeadlessDmCombatState, events: HeadlessCombatEvent[]) {
  const outcome = checkCombatOutcome(state.map.tokens, state.characters)
  if (!outcome.ended) return
  state.active = false
  events.push({ type: 'combat-ended', winner: outcome.winner, message: outcome.message })
}

function activeCharacterIds(state: HeadlessDmCombatState): Set<string> {
  return new Set(state.map.tokens.map((token) => token.characterId).filter((id): id is string => !!id))
}

function huntingMarkTraitRank(character?: Character): number {
  if (!character) return 0
  return Math.max(0, findClassTrait(character, 'huntingMark')?.level ?? 0)
}

function skillCooldownRemaining(skill: Pick<CombatSkill, 'cooldown' | 'cdReduction'>): number {
  if (skill.cooldown <= 0) return 0
  return Math.max(1, skill.cooldown - skill.cdReduction)
}

function clearCombatStartStatuses(state: HeadlessDmCombatState) {
  const participantIds = activeCharacterIds(state)
  for (const token of state.map.tokens) {
    updateToken(state, token.id, (item) => ({ ...item, ...TOKEN_STATUS_CLEAR_PATCH }))
  }
  for (const characterId of participantIds) {
    updateCharacter(state, characterId, (character) => ({
      ...character,
      conditions: [],
      combatBuffs: {},
      tempHp: 0,
    }))
  }
}

function resetCombatStartCharacters(
  state: HeadlessDmCombatState,
  dice: HeadlessDiceRoller,
  events: HeadlessCombatEvent[],
) {
  const participantIds = activeCharacterIds(state)
  for (const characterId of participantIds) {
    if (!findCharacter(state, characterId)) continue
    updateCharacter(state, characterId, (character) => {
      const hasRuneArrow = !!findClassTrait(character, 'runeArrow')
      let runeArrowApplied = false
      const reset = resetCombatTraitUses({
        ...character,
        currentAP: character.actionPoints,
        combatSkills: character.combatSkills.map((skill) => {
          const runeReset = hasRuneArrow && !runeArrowApplied && isMagicDamageSkill(skill)
          if (runeReset) runeArrowApplied = true
          return {
            ...skill,
            remaining: runeReset ? 0 : skillCooldownRemaining(skill),
            usedThisTurn: false,
          }
        }),
      })
      return applyStillWatersHealingOnBreathShift(
        reset,
        {
          ...reset,
          combatBuffs: initCalmMindForCombat(reset),
        },
        dice,
        events,
      )
    })
    syncCharacterTokenHp(state, characterId)
  }
}

function singleTargetRangeFeet(skill: CombatSkill): number | null {
  if (skill.skillTreeId === 'burstKick') return 5
  if (skill.skillTreeId === 'riseKick') return 5
  if (skill.skillTreeId === 'windKickCombo') return 5
  if (skill.skillTreeId === 'shadowDance') return 15
  if (!skill.tags?.includes('ranged') && skill.skillTreeId !== 'basicShot' && skill.name !== '基础射击') return null
  switch (skill.skillTreeId) {
    case 'multiShot':
      return 30
    case 'clusterShot':
    case 'vineHookShot':
    case 'bindShot':
      return 20
    case 'basicShot':
      return 90
    case 'netArrow':
    case 'explosiveArrow':
    case 'magicArrow':
    case 'rageShot':
    case 'refluxMagicArrow':
    case 'windStepShot':
      return 60
    case 'arcaneBreak':
    case 'antiMagicArrow':
      return 90
    default:
      return 90
  }
}

function parseDamageDice(value?: string): { count: number; sides: number; bonus: number } | null {
  if (!value) return null
  const match = value.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i)
  if (!match) return null
  return {
    count: Number(match[1]),
    sides: Number(match[2]),
    bonus: match[3] ? Number(match[3]) : 0,
  }
}

function enemyDamageType(value?: string): DamageReductionType {
  if (value === 'force' || value === 'fire' || value === 'cold' || value === 'lightning' || value === 'poison') {
    return 'magic'
  }
  return 'physical'
}

function updateCharacter(
  state: HeadlessDmCombatState,
  characterId: string,
  updater: (character: Character) => Character,
) {
  state.characters = state.characters.map((character) =>
    character.id === characterId ? updater(character) : character,
  )
}

function updateToken(state: HeadlessDmCombatState, tokenId: string, updater: (token: Token) => Token) {
  state.map = {
    ...state.map,
    tokens: state.map.tokens.map((token) => (token.id === tokenId ? updater(token) : token)),
  }
}

function getCurrentTurn(state: HeadlessDmCombatState): InitiativeEntry | undefined {
  return state.initiativeOrder[state.initiativeIndex]
}

function findCharacter(state: HeadlessDmCombatState, characterId: string): Character | undefined {
  return state.characters.find((character) => character.id === characterId)
}

function succeed(state: HeadlessDmCombatState, events: HeadlessCombatEvent[]): HeadlessCombatSuccess {
  clearDefeatedCombatStatuses(state)
  return { ok: true, state, events }
}

function clearDefeatedCombatStatuses(state: HeadlessDmCombatState): void {
  for (const token of state.map.tokens) {
    const character = token.characterId ? findCharacter(state, token.characterId) : undefined
    const defeated = character ? character.currentHp <= 0 : (token.hp ?? token.maxHp ?? 1) <= 0
    if (!defeated) continue
    updateToken(state, token.id, (item) => ({ ...item, ...TOKEN_STATUS_CLEAR_PATCH }))
    if (character) {
      updateCharacter(state, character.id, (item) => ({ ...item, conditions: [] }))
    }
  }
}

function fail(
  state: HeadlessDmCombatState,
  reason: HeadlessCombatFailureReason,
  events: HeadlessCombatEvent[],
): HeadlessCombatFailure {
  return { ok: false, state, reason, events }
}
