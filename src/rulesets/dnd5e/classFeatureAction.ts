import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import {
  DND_FEET_PER_CELL,
  cellKey,
  occupiedCells,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenFootprintDistanceCells,
  tokenOccupiedCellsAt,
} from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type {
  Dnd5eClassFeaturePayload,
  Dnd5eTurnEconomyCounts,
  SharedPlayerActionState,
} from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eMonkUnarmedStrikeProfile, type Dnd5eUnarmedStrikeProfile } from './equipment'
import {
  dnd5eAttackerIsUnseenForAttack,
  dnd5eCombatantHasConcentrationEffect,
  dnd5eCombatantClassLevel,
  dnd5eCombatantHasSubclass,
  dnd5eTargetArmorClassForAttack,
  dnd5eTargetIsUnseenForAttack,
  resolveDnd5eHeadlessAction,
  dnd5eTranquilityWardCheck,
  type Dnd5eAction,
  type Dnd5eActionResult,
  type Dnd5eCuttingWordsUse,
  type Dnd5eHeadlessCombatState,
  type Dnd5eSpellTargetSavingThrowRoll,
  type Dnd5eTranquilitySaveRoll,
  type Dnd5eStandAgainstTideUse,
} from './headlessCombatEngine'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import { dnd5eHasViciousMockeryAttackDisadvantage, dnd5ePreventsAttackAdvantage, dnd5eSavingThrowMode, dnd5eTargetGrantsAttackAdvantage, dnd5eTargetIsDodging } from './passiveDefenses'
import { mapGeometryMovementBlocked, mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
import { resolveDnd5eRollMode } from './rollMode'
import { dnd5eCharacterClassLevel } from './multiclass'

export type Dnd5eClassFeatureRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'wrong-class'
  | 'feature-locked'
  | 'invalid-target'
  | 'target-out-of-range'
  | 'combatant-missing'

export interface PreparedDnd5eClassFeature {
  action: SharedPlayerActionState
  payload: Dnd5eClassFeaturePayload
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  actorToken: Token
  headlessAction: Dnd5eAction
  monkBonusAttack?: PreparedDnd5eMonkBonusAttack
  quiveringPalmRelease?: {
    target: Token
    targetName: string
    saveDc: number
    saveModifier: number
    saveMode: 'normal' | 'advantage' | 'disadvantage'
    blessed: boolean
    baned: boolean
  }
  intimidatingPresence?: {
    target: Token
    targetName: string
    saveDc: number
    saveModifier: number
    saveMode: 'normal' | 'advantage' | 'disadvantage'
    blessed: boolean
    baned: boolean
    extending: boolean
  }
  turnUndead?: {
    targets: readonly {
      token: Token
      targetName: string
      saveDc: number
      saveModifier: number
      saveMode: 'normal' | 'advantage' | 'disadvantage'
      blessed: boolean
      baned: boolean
    }[]
  }
  rogueAbilityCheck?: {
    label: string
    modifier: number
    mode: 'normal' | 'advantage' | 'disadvantage'
    passivePerceptionDc?: number
  }
}

export interface PreparedDnd5eMonkBonusAttack {
  mode: 'martial-arts' | 'flurry'
  profile: Dnd5eUnarmedStrikeProfile
  blessed: boolean
  baned: boolean
  targets: readonly {
    token: Token
    armorClass: number
    attackMode: 'normal' | 'advantage' | 'disadvantage'
    stunningStrike?: {
      saveDc: number
      saveModifier: number
      saveMode: 'normal' | 'disadvantage'
      blessed: boolean
      baned: boolean
    }
    openHandTechnique?: {
      effect: 'prone' | 'push' | 'no-reactions'
      saveDc?: number
      saveModifier?: number
      saveMode?: 'normal' | 'advantage' | 'disadvantage'
      blessed?: boolean
      baned?: boolean
      pushTo?: { x: number; y: number }
      pushDistanceFeet?: number
    }
    quiveringPalm?: boolean
    tranquilityWard?: ReturnType<typeof dnd5eTranquilityWardCheck>
  }[]
}

export interface Dnd5eMonkBonusAttackRoll {
  d20: number
  d20Second?: number
  blessRoll?: number
  baneRoll?: number
  bardicInspirationRoll?: number
  cuttingWords?: Dnd5eCuttingWordsUse
  cuttingWordsDamage?: Dnd5eCuttingWordsUse
  shieldSpellReaction?: boolean
  damageRolls: readonly number[]
  stunningStrikeSaveD20?: number
  stunningStrikeSaveD20Second?: number
  stunningStrikeSaveBlessRoll?: number
  stunningStrikeSaveBaneRoll?: number
  stunningStrikeSaveRerollD20?: number
  stunningStrikeSaveRerollD20Second?: number
  stunningStrikeBardicInspirationRoll?: number
  stunningStrikeDarkOnesOwnLuckRoll?: number
  openHandSavingThrowD20?: number
  openHandSavingThrowD20Second?: number
  openHandBlessRoll?: number
  openHandBaneRoll?: number
  openHandSavingThrowRerollD20?: number
  openHandSavingThrowRerollD20Second?: number
  openHandBardicInspirationRoll?: number
  openHandDarkOnesOwnLuckRoll?: number
  tranquilitySave?: Dnd5eTranquilitySaveRoll
  standAgainstTide?: Dnd5eStandAgainstTideUse
}

function openHandPushDestination(map: BattleMap, actor: Token, target: Token): {
  to: { x: number; y: number }
  distanceFeet: number
} {
  const feetPerCell = Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
  const maximumSteps = Math.max(0, Math.floor(15 / feetPerCell))
  const actorAnchor = tokenAnchorCellFromPixel(actor.x, actor.y, actor, map)
  const targetAnchor = tokenAnchorCellFromPixel(target.x, target.y, target, map)
  const dc = Math.sign(targetAnchor.col - actorAnchor.col)
  const dr = Math.sign(targetAnchor.row - actorAnchor.row)
  if (maximumSteps < 1 || (dc === 0 && dr === 0)) return { to: { x: target.x, y: target.y }, distanceFeet: 0 }
  const blocked = occupiedCells(map.tokens, map, target.id)
  const columns = Math.max(1, Math.floor((map.width - map.gridOffsetX) / Math.max(1, map.gridSize)))
  const rows = Math.max(1, Math.floor((map.height - map.gridOffsetY) / Math.max(1, map.gridSize)))
  let destination = { x: target.x, y: target.y }
  let steps = 0
  const geometry = mapGeometryRuntimeForMap(map.id)
  for (let step = 1; step <= maximumSteps; step += 1) {
    const anchor = { col: targetAnchor.col + dc * step, row: targetAnchor.row + dr * step }
    const position = tokenCenterForAnchorCell(anchor, target, map)
    const footprint = tokenOccupiedCellsAt(target, map, position)
    if (footprint.some((cell) =>
      cell.col < 0 || cell.row < 0 || cell.col >= columns || cell.row >= rows || blocked.has(cellKey(cell)),
    )) break
    if (mapGeometryMovementBlocked({
      geometry, map, token: { ...target, ...destination }, to: position,
    }).blocked) break
    destination = position
    steps = step
  }
  return { to: destination, distanceFeet: steps * feetPerCell }
}

const FEATURE_LABELS: Record<Dnd5eClassFeaturePayload['feature'], string> = {
  'barbarian-rage': '狂暴',
  'barbarian-intimidating-presence': '威吓气势',
  'rogue-cunning-action': '巧妙动作',
  'rogue-fast-hands': '快手',
  'bardic-inspiration': '吟游激励',
  'bard-countercharm': '反魅惑',
  'paladin-lay-on-hands': '圣疗',
  'paladin-cleansing-touch': '净化之触',
  'monk-wholeness-of-body': '身心合一',
  'monk-step-of-the-wind': '疾风步',
  'monk-patient-defense': '耐心防御',
  'monk-unarmed-bonus': '武僧徒手连击',
  'monk-quivering-palm-release': '引爆渗透劲',
  'monk-quivering-palm-end': '结束渗透劲',
  'paladin-sacred-weapon': '神圣武器',
  'paladin-divine-sense': '神圣感知',
  'paladin-turn-the-unholy': '驱散邪魔',
  'paladin-holy-nimbus': '神圣光轮',
  'cleric-turn-undead': '驱散亡灵',
  'cleric-preserve-life': '维持生命',
  'cleric-divine-intervention': '神圣干预',
  'sorcerer-create-spell-slot': '创造法术位',
  'sorcerer-convert-spell-slot': '转换法术位',
  'sorcerer-draconic-wings': '龙翼',
  'sorcerer-draconic-presence': '龙威',
  'ranger-move-hunters-mark': '转移猎人印记',
  'ranger-primeval-awareness': '原初感知',
  'ranger-hide-in-plain-sight': '隐匿无踪',
  'ranger-vanish': '无踪步',
  'monk-stillness-of-mind': '心如止水',
  'monk-empty-body': '空灵体',
  'druid-wild-shape': '荒野变形',
  'druid-end-wild-shape': '恢复原形',
  'warlock-hurl-through-hell-ready': '坠入地狱',
}

export function dnd5eClassFeatureLabel(payload: Dnd5eClassFeaturePayload): string {
  return FEATURE_LABELS[payload.feature]
}

function targetDistanceFeet(actor: Token, target: Token, map: BattleMap): number {
  return tokenFootprintDistanceCells(actor, target, map) * Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
}

function featureClassRequirement(payload: Dnd5eClassFeaturePayload): {
  classId: 'barbarian' | 'bard' | 'paladin' | 'monk' | 'cleric' | 'rogue' | 'ranger' | 'sorcerer' | 'druid' | 'warlock'
  minimumLevel: number
  subclassId?: string
} {
  switch (payload.feature) {
    case 'barbarian-rage': return { classId: 'barbarian', minimumLevel: 1 }
    case 'barbarian-intimidating-presence': return { classId: 'barbarian', minimumLevel: 10, subclassId: 'berserker' }
    case 'rogue-cunning-action': return { classId: 'rogue', minimumLevel: 2 }
    case 'rogue-fast-hands': return { classId: 'rogue', minimumLevel: 3, subclassId: 'thief' }
    case 'bardic-inspiration': return { classId: 'bard', minimumLevel: 1 }
    case 'bard-countercharm': return { classId: 'bard', minimumLevel: 6 }
    case 'paladin-lay-on-hands': return { classId: 'paladin', minimumLevel: 1 }
    case 'paladin-cleansing-touch': return { classId: 'paladin', minimumLevel: 14 }
    case 'monk-wholeness-of-body': return { classId: 'monk', minimumLevel: 6, subclassId: 'open-hand' }
    case 'monk-step-of-the-wind': return { classId: 'monk', minimumLevel: 2 }
    case 'monk-patient-defense': return { classId: 'monk', minimumLevel: 2 }
    case 'monk-unarmed-bonus': return { classId: 'monk', minimumLevel: payload.mode === 'flurry' ? 2 : 1 }
    case 'monk-quivering-palm-release': return { classId: 'monk', minimumLevel: 17, subclassId: 'open-hand' }
    case 'monk-quivering-palm-end': return { classId: 'monk', minimumLevel: 17, subclassId: 'open-hand' }
    case 'paladin-sacred-weapon': return { classId: 'paladin', minimumLevel: 3, subclassId: 'devotion' }
    case 'paladin-divine-sense': return { classId: 'paladin', minimumLevel: 1 }
    case 'paladin-turn-the-unholy': return { classId: 'paladin', minimumLevel: 3, subclassId: 'devotion' }
    case 'paladin-holy-nimbus': return { classId: 'paladin', minimumLevel: 20, subclassId: 'devotion' }
    case 'cleric-turn-undead': return { classId: 'cleric', minimumLevel: 2 }
    case 'cleric-preserve-life': return { classId: 'cleric', minimumLevel: 2, subclassId: 'life' }
    case 'cleric-divine-intervention': return { classId: 'cleric', minimumLevel: 10 }
    case 'sorcerer-create-spell-slot':
    case 'sorcerer-convert-spell-slot':
      return { classId: 'sorcerer', minimumLevel: 2 }
    case 'sorcerer-draconic-wings':
      return { classId: 'sorcerer', minimumLevel: 14, subclassId: 'draconic' }
    case 'sorcerer-draconic-presence':
      return { classId: 'sorcerer', minimumLevel: 18, subclassId: 'draconic' }
    case 'ranger-move-hunters-mark':
      return { classId: 'ranger', minimumLevel: 2 }
    case 'ranger-primeval-awareness':
      return { classId: 'ranger', minimumLevel: 3 }
    case 'ranger-hide-in-plain-sight':
      return { classId: 'ranger', minimumLevel: 10 }
    case 'ranger-vanish':
      return { classId: 'ranger', minimumLevel: 14 }
    case 'monk-stillness-of-mind':
      return { classId: 'monk', minimumLevel: 7 }
    case 'monk-empty-body':
      return { classId: 'monk', minimumLevel: 18 }
    case 'druid-wild-shape':
    case 'druid-end-wild-shape':
      return { classId: 'druid', minimumLevel: 2 }
    case 'warlock-hurl-through-hell-ready':
      return { classId: 'warlock', minimumLevel: 14, subclassId: 'fiend' }
  }
}

function buildHeadlessAction(
  payload: Dnd5eClassFeaturePayload,
  actorTokenId: string,
  detectedTargetIds: readonly string[] = [],
  turnUndeadTargetIds: readonly string[] = [],
  monkBonusAttack?: PreparedDnd5eMonkBonusAttack,
): Dnd5eAction | undefined {
  switch (payload.feature) {
    case 'barbarian-rage':
      return { type: payload.feature, actorId: actorTokenId, frenzy: payload.frenzy, end: payload.end }
    case 'barbarian-intimidating-presence':
      return { type: payload.feature, actorId: actorTokenId, targetId: payload.targetTokenId }
    case 'rogue-cunning-action':
      return {
        type: payload.feature, actorId: actorTokenId, option: payload.option,
        ...(payload.option === 'hide' ? { hideAllowed: false, d20: 1 } : {}),
      }
    case 'rogue-fast-hands':
      return { type: payload.feature, actorId: actorTokenId, option: payload.option, d20: 1 }
    case 'bardic-inspiration':
      return { type: payload.feature, actorId: actorTokenId, targetId: payload.targetTokenId }
    case 'bard-countercharm':
      return { type: payload.feature, actorId: actorTokenId }
    case 'paladin-lay-on-hands': {
      if ('cure' in payload) {
        if (payload.cure !== 'disease' && payload.cure !== 'poisoned') return undefined
        return { type: payload.feature, actorId: actorTokenId, targetId: payload.targetTokenId, cure: payload.cure }
      }
      if (!Number.isInteger(payload.amount) || payload.amount <= 0) return undefined
      return { type: payload.feature, actorId: actorTokenId, targetId: payload.targetTokenId, amount: payload.amount }
    }
    case 'paladin-cleansing-touch':
      if (!payload.spellId || !payload.sourceTokenId) return undefined
      return {
        type: payload.feature,
        actorId: actorTokenId,
        targetId: payload.targetTokenId,
        sourceId: payload.sourceTokenId,
        spellId: payload.spellId,
      }
    case 'monk-wholeness-of-body':
      return { type: payload.feature, actorId: actorTokenId }
    case 'monk-step-of-the-wind':
      return { type: payload.feature, actorId: actorTokenId, option: payload.option }
    case 'monk-patient-defense':
    case 'paladin-sacred-weapon':
    case 'paladin-holy-nimbus':
      return { type: payload.feature, actorId: actorTokenId }
    case 'monk-unarmed-bonus': {
      const expectedTargets = payload.mode === 'flurry' ? 2 : 1
      if (!monkBonusAttack || payload.targetTokenIds.length !== expectedTargets) return undefined
      return {
        type: payload.feature,
        actorId: actorTokenId,
        mode: payload.mode,
        attackModifier: monkBonusAttack.profile.attackModifier,
        damage: {
          count: monkBonusAttack.profile.damage.count,
          sides: monkBonusAttack.profile.damage.sides,
          bonus: monkBonusAttack.profile.damage.bonus,
        },
        attacks: monkBonusAttack.targets.map((target) => ({
          targetId: target.token.id,
          d20: 1,
          mode: target.attackMode,
          damageRolls: [],
          stunningStrike: !!target.stunningStrike,
          openHandTechnique: target.openHandTechnique ? {
            effect: target.openHandTechnique.effect,
            pushTo: target.openHandTechnique.pushTo,
            pushDistanceFeet: target.openHandTechnique.pushDistanceFeet,
          } : undefined,
          quiveringPalm: target.quiveringPalm,
        })),
      }
    }
    case 'monk-quivering-palm-release':
      return {
        type: payload.feature,
        actorId: actorTokenId,
        targetId: payload.targetTokenId,
        damageRolls: [],
      }
    case 'monk-quivering-palm-end':
      return { type: payload.feature, actorId: actorTokenId }
    case 'paladin-divine-sense':
      return { type: payload.feature, actorId: actorTokenId, targetIds: detectedTargetIds }
    case 'cleric-turn-undead':
      return {
        type: payload.feature,
        actorId: actorTokenId,
        targets: turnUndeadTargetIds.map((targetId) => ({ targetId, d20: 1 })),
      }
    case 'paladin-turn-the-unholy':
      return {
        type: payload.feature,
        actorId: actorTokenId,
        targets: turnUndeadTargetIds.map((targetId) => ({ targetId, d20: 1 })),
      }
    case 'cleric-preserve-life':
      if (
        payload.allocations.length === 0 ||
        payload.allocations.some((allocation) => !allocation.targetTokenId || !Number.isInteger(allocation.amount) || allocation.amount <= 0)
      ) return undefined
      return {
        type: payload.feature,
        actorId: actorTokenId,
        allocations: payload.allocations.map((allocation) => ({ targetId: allocation.targetTokenId, amount: allocation.amount })),
      }
    case 'cleric-divine-intervention':
      return { type: payload.feature, actorId: actorTokenId, d100: 1 }
    case 'sorcerer-create-spell-slot':
      if (![1, 2, 3, 4, 5].includes(payload.slotLevel)) return undefined
      return { type: payload.feature, actorId: actorTokenId, slotLevel: payload.slotLevel }
    case 'sorcerer-convert-spell-slot':
      if (!Number.isInteger(payload.slotLevel) || payload.slotLevel < 1 || payload.slotLevel > 9) return undefined
      return { type: payload.feature, actorId: actorTokenId, slotLevel: payload.slotLevel }
    case 'sorcerer-draconic-wings':
      return { type: payload.feature, actorId: actorTokenId, active: payload.active }
    case 'sorcerer-draconic-presence':
      if (payload.mode !== 'awe' && payload.mode !== 'fear') return undefined
      return { type: payload.feature, actorId: actorTokenId, mode: payload.mode }
    case 'ranger-move-hunters-mark':
      return { type: payload.feature, actorId: actorTokenId, targetId: payload.targetTokenId }
    case 'ranger-primeval-awareness':
      return { type: payload.feature, actorId: actorTokenId, slotLevel: payload.slotLevel, targetIds: detectedTargetIds }
    case 'ranger-hide-in-plain-sight':
      return { type: payload.feature, actorId: actorTokenId }
    case 'ranger-vanish':
      return { type: payload.feature, actorId: actorTokenId, hideAllowed: false, d20: 1 }
    case 'monk-stillness-of-mind':
      return { type: payload.feature, actorId: actorTokenId, condition: payload.condition }
    case 'monk-empty-body':
      return { type: payload.feature, actorId: actorTokenId }
    case 'druid-wild-shape':
      return { type: payload.feature, actorId: actorTokenId, formId: payload.formId }
    case 'druid-end-wild-shape':
      return { type: payload.feature, actorId: actorTokenId }
    case 'warlock-hurl-through-hell-ready':
      return { type: payload.feature, actorId: actorTokenId, active: payload.active }
  }
}

export function prepareDnd5eClassFeature(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy?: Dnd5eTurnEconomyCounts
}): { ok: true; prepared: PreparedDnd5eClassFeature } | { ok: false; reason: Dnd5eClassFeatureRejectReason } {
  const { action } = input
  const payload = action.dnd5eClassFeature
  if (action.type !== 'dnd5e-class-feature' || !payload) return { ok: false, reason: 'invalid-action' }

  const actor = input.characters.find((character) => character.id === action.characterId)
  const actorToken = input.map.tokens.find((token) => token.id === action.actorTokenId && token.characterId === action.characterId)
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }

  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: action.combatId ?? `map-${input.map.id}`,
    round: action.round,
    turnSlotId: input.initiativeOrder[action.initiativeIndex]?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (actorIndex < 0 || !actorCombatant) return { ok: false, reason: 'combatant-missing' }

  const requirement = featureClassRequirement(payload)
  if (actorCombatant.classId !== requirement.classId) return { ok: false, reason: 'wrong-class' }
  if (
    dnd5eCombatantClassLevel(actorCombatant, requirement.classId) < requirement.minimumLevel ||
    (requirement.subclassId && !dnd5eCombatantHasSubclass(actorCombatant, requirement.classId, requirement.subclassId))
  ) {
    return { ok: false, reason: 'feature-locked' }
  }

  const divineSenseCreatureTypes = new Set(['天界', '天界生物', '邪魔', '亡灵'])
  const primevalAwarenessCreatureTypes = new Set([
    '异怪', 'aberration', '天界', '天界生物', 'celestial', '龙', '龙类', 'dragon',
    '元素', '元素生物', 'elemental', '妖精', 'fey', '邪魔', 'fiend', '亡灵', 'undead',
  ])
  const detectedTargetIds = payload.feature === 'paladin-divine-sense' || payload.feature === 'ranger-primeval-awareness'
    ? input.map.tokens.flatMap((token) => {
        const rangeFeet = payload.feature === 'paladin-divine-sense' ? 60 : 5_280
        if (token.id === actorToken.id || token.type === 'obstacle' || targetDistanceFeet(actorToken, token, input.map) > rangeFeet) return []
        const combatant = snapshot.state.combatants[token.id]
        const sensedTypes = payload.feature === 'paladin-divine-sense' ? divineSenseCreatureTypes : primevalAwarenessCreatureTypes
        return combatant && sensedTypes.has((combatant.creatureType ?? '').toLowerCase()) ? [token.id] : []
      })
    : []
  const turnUndeadTargetIds = payload.feature === 'cleric-turn-undead' || payload.feature === 'paladin-turn-the-unholy'
    ? input.map.tokens.flatMap((token) => {
        if (
          token.id === actorToken.id || token.type === 'obstacle' ||
          targetDistanceFeet(actorToken, token, input.map) > 30
        ) return []
        const combatant = snapshot.state.combatants[token.id]
        const creatureType = (combatant?.creatureType ?? '').toLowerCase()
        const isUndead = creatureType === '亡灵' || creatureType === 'undead' || creatureType.includes('亡灵')
        const isFiend = creatureType === '邪魔' || creatureType === 'fiend' || creatureType.includes('邪魔')
        return combatant && combatant.currentHp > 0 && !combatant.deathSaves.dead &&
          (isUndead || payload.feature === 'paladin-turn-the-unholy' && isFiend)
          ? [token.id]
          : []
      })
    : []
  let monkBonusAttack: PreparedDnd5eMonkBonusAttack | undefined
  let quiveringPalmRelease: PreparedDnd5eClassFeature['quiveringPalmRelease']
  let intimidatingPresence: PreparedDnd5eClassFeature['intimidatingPresence']
  let turnUndead: PreparedDnd5eClassFeature['turnUndead']
  let rogueAbilityCheck: PreparedDnd5eClassFeature['rogueAbilityCheck']
  if (payload.feature === 'cleric-turn-undead' || payload.feature === 'paladin-turn-the-unholy') {
    const saveAbility = payload.feature === 'cleric-turn-undead' ? actor.abilities.wis : actor.abilities.cha
    const saveDc = 8 + actorCombatant.proficiencyBonus + rules.abilityModifier(saveAbility)
    turnUndead = {
      targets: turnUndeadTargetIds.map((targetId) => {
        const token = input.map.tokens.find((candidate) => candidate.id === targetId)!
        const target = snapshot.state.combatants[targetId]
        return {
          token,
          targetName: token.label,
          saveDc,
          saveModifier: target.savingThrowBonuses.wis ?? rules.abilityModifier(target.abilities.wis),
          saveMode: dnd5eSavingThrowMode(target, 'wis', { effectVisible: true }),
          blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, targetId, 'bless'),
          baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, targetId, 'bane'),
        }
      }),
    }
  }
  if (payload.feature === 'barbarian-intimidating-presence') {
    const target = input.map.tokens.find((token) => token.id === payload.targetTokenId)
    const targetCombatant = target ? snapshot.state.combatants[target.id] : undefined
    if (!target || !targetCombatant || !areOpposedCombatTokens(actorToken, target)) return { ok: false, reason: 'invalid-target' }
    if (targetDistanceFeet(actorToken, target, input.map) > 30) return { ok: false, reason: 'target-out-of-range' }
    intimidatingPresence = {
      target,
      targetName: target.label,
      saveDc: 8 + actorCombatant.proficiencyBonus + rules.abilityModifier(actor.abilities.cha),
      saveModifier: targetCombatant.savingThrowBonuses.wis ?? rules.abilityModifier(targetCombatant.abilities.wis),
      saveMode: dnd5eSavingThrowMode(targetCombatant, 'wis', { effectVisible: true, condition: 'frightened' }),
      blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, targetCombatant.id, 'bless'),
      baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, targetCombatant.id, 'bane'),
      extending: targetCombatant.classState.intimidatingPresenceSourceId === actorToken.id &&
        (targetCombatant.classState.intimidatingPresenceRoundsRemaining ?? 0) > 0,
    }
  }
  if (
    payload.feature === 'rogue-fast-hands' && payload.option !== 'use-object' ||
    payload.feature === 'rogue-cunning-action' && payload.option === 'hide' ||
    payload.feature === 'ranger-vanish'
  ) {
    const skill = payload.feature === 'rogue-cunning-action' || payload.feature === 'ranger-vanish'
      ? 'stealth'
      : payload.option === 'sleight-of-hand' ? 'sleightOfHand' : 'thievesTools'
    const proficient = skill === 'thievesTools' || actorCombatant.skillProficiencies.includes(skill)
    const expertise = actorCombatant.classSelections.expertise?.includes(skill) === true
    const rank = expertise ? 2 : proficient ? 1 : 0
    const modifier = rules.abilityModifier(actorCombatant.abilities.dex) + actorCombatant.proficiencyBonus * rank +
      (skill === 'stealth' && actorCombatant.classState.hideInPlainSightPrepared ? 10 : 0)
    const movementSpent = Math.max(0, actorCombatant.speed - (input.turnEconomy?.movement.current ?? actorCombatant.turn.movementRemaining))
    const supremeSneak = payload.feature === 'rogue-cunning-action' &&
      dnd5eCombatantHasSubclass(actorCombatant, 'rogue', 'thief') &&
      dnd5eCombatantClassLevel(actorCombatant, 'rogue') >= 9 && movementSpent <= actorCombatant.speed / 2
    const disadvantage = actorCombatant.exhaustionLevel >= 1
    const mode = resolveDnd5eRollMode({
      advantage: [{ active: supremeSneak, reason: 'supreme-sneak' }],
      disadvantage: [{ active: disadvantage, reason: 'exhaustion' }],
    }).mode
    const observers = Object.values(snapshot.state.combatants).filter((candidate) =>
      candidate.id !== actorCombatant.id && candidate.currentHp > 0 && !candidate.deathSaves.dead &&
      candidate.controller !== actorCombatant.controller,
    )
    rogueAbilityCheck = {
      label: skill === 'stealth' ? '敏捷（隐匿）检定' : skill === 'sleightOfHand' ? '敏捷（巧手）检定' : '敏捷（盗贼工具）检定',
      modifier,
      mode,
      ...(skill === 'stealth' ? {
        passivePerceptionDc: observers.reduce((maximum, observer) => Math.max(maximum, observer.passivePerception), 0),
      } : {}),
    }
  }
  if (payload.feature === 'monk-unarmed-bonus') {
    const expectedTargets = payload.mode === 'flurry' ? 2 : 1
    if (payload.targetTokenIds.length !== expectedTargets) return { ok: false, reason: 'invalid-action' }
    const profile = dnd5eMonkUnarmedStrikeProfile(actor)
    if (!profile) return { ok: false, reason: 'wrong-class' }
    const monkLevel = dnd5eCharacterClassLevel(actor, 'monk')
    if (payload.stunningStrike && monkLevel < 5) return { ok: false, reason: 'feature-locked' }
    if (
      payload.quiveringPalmAttackIndex != null &&
      (!Number.isInteger(payload.quiveringPalmAttackIndex) || payload.quiveringPalmAttackIndex < 0 ||
        payload.quiveringPalmAttackIndex >= expectedTargets || monkLevel < 17 ||
        actor.dnd5eClassChoices?.classes?.monk?.subclass !== 'open-hand')
    ) return { ok: false, reason: 'feature-locked' }
    const requestedOpenHandTechniques = payload.openHandTechniques ?? []
    if (
      requestedOpenHandTechniques.length > expectedTargets ||
      (requestedOpenHandTechniques.some(Boolean) &&
        (payload.mode !== 'flurry' || monkLevel < 3 || actor.dnd5eClassChoices?.classes?.monk?.subclass !== 'open-hand'))
    ) return { ok: false, reason: 'feature-locked' }
    if (
      requestedOpenHandTechniques[0] === 'push' &&
      payload.targetTokenIds[0] === payload.targetTokenIds[1]
    ) return { ok: false, reason: 'invalid-action' }
    const targets: PreparedDnd5eMonkBonusAttack['targets'][number][] = []
    for (let targetIndex = 0; targetIndex < payload.targetTokenIds.length; targetIndex += 1) {
      const tokenId = payload.targetTokenIds[targetIndex]
      const targetToken = input.map.tokens.find((token) => token.id === tokenId)
      const targetCombatant = targetToken ? snapshot.state.combatants[targetToken.id] : undefined
      if (!targetToken || !targetCombatant || !areOpposedCombatTokens(actorToken, targetToken)) return { ok: false, reason: 'invalid-target' }
      if (targetDistanceFeet(actorToken, targetToken, input.map) > 5) return { ok: false, reason: 'target-out-of-range' }
      const actorProne = actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
      const targetProne = targetCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
      const targetGrantsAdvantage = !dnd5ePreventsAttackAdvantage(targetCombatant) &&
        (dnd5eTargetGrantsAttackAdvantage(targetCombatant) || (targetIndex === 0 && actorCombatant.classState.hiddenCheckTotal != null) ||
          !!targetCombatant.classState.recklessAttackTurnKey || !!targetCombatant.classState.stunnedByActorId ||
          dnd5eAttackerIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id) || targetProne)
      const targetImposesDisadvantage = dnd5eTargetIsDodging(targetCombatant) || (actor.exhaustionLevel ?? 0) >= 3 ||
        (targetIndex === 0 && dnd5eHasViciousMockeryAttackDisadvantage(actorCombatant)) ||
        dnd5eTargetIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id) || actorProne
      const attackMode = resolveDnd5eRollMode({
        advantage: [{ active: targetGrantsAdvantage, reason: 'monk-attack-advantage' }],
        disadvantage: [{ active: targetImposesDisadvantage, reason: 'monk-attack-disadvantage' }],
      }).mode
      const openHandEffect = requestedOpenHandTechniques[targetIndex]
      const openHandAbility = openHandEffect === 'prone' ? 'dex' : openHandEffect === 'push' ? 'str' : undefined
      const push = openHandEffect === 'push' ? openHandPushDestination(input.map, actorToken, targetToken) : undefined
      targets.push({
        token: targetToken,
        armorClass: dnd5eTargetArmorClassForAttack(snapshot.state, actorToken.id, targetToken.id),
        attackMode,
        ...(payload.stunningStrike ? {
          stunningStrike: {
            saveDc: 8 + actorCombatant.proficiencyBonus + rules.abilityModifier(actor.abilities.wis),
            saveModifier: targetCombatant.savingThrowBonuses.con ?? rules.abilityModifier(targetCombatant.abilities.con),
            saveMode: targetCombatant.exhaustionLevel >= 3 ? 'disadvantage' as const : 'normal' as const,
            blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, targetCombatant.id, 'bless'),
            baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, targetCombatant.id, 'bane'),
          },
        } : {}),
        ...(openHandEffect ? {
          openHandTechnique: {
            effect: openHandEffect,
            ...(openHandAbility ? {
              saveDc: 8 + actorCombatant.proficiencyBonus + rules.abilityModifier(actor.abilities.wis),
              saveModifier: targetCombatant.savingThrowBonuses[openHandAbility] ?? rules.abilityModifier(targetCombatant.abilities[openHandAbility]),
              saveMode: dnd5eSavingThrowMode(targetCombatant, openHandAbility, {
                effectVisible: true,
                condition: openHandEffect === 'prone' ? 'prone' : undefined,
              }),
              blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, targetCombatant.id, 'bless'),
              baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, targetCombatant.id, 'bane'),
            } : {}),
            ...(push ? { pushTo: push.to, pushDistanceFeet: push.distanceFeet } : {}),
          },
        } : {}),
        quiveringPalm: payload.quiveringPalmAttackIndex === targetIndex,
        tranquilityWard: dnd5eTranquilityWardCheck(actorCombatant, targetCombatant, snapshot.state),
      })
    }
    monkBonusAttack = {
      mode: payload.mode,
      profile,
      targets,
      blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bless'),
      baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bane'),
    }
  }
  if (payload.feature === 'monk-quivering-palm-release') {
    const target = input.map.tokens.find((token) => token.id === payload.targetTokenId && token.type !== 'obstacle')
    const targetCombatant = target ? snapshot.state.combatants[target.id] : undefined
    if (
      !target || !targetCombatant || actorCombatant.classState.quiveringPalmTargetId !== target.id ||
      targetCombatant.currentHp <= 0 || targetCombatant.deathSaves.dead
    ) return { ok: false, reason: 'invalid-target' }
    quiveringPalmRelease = {
      target,
      targetName: target.label,
      saveDc: 8 + actorCombatant.proficiencyBonus + rules.abilityModifier(actor.abilities.wis),
      saveModifier: targetCombatant.savingThrowBonuses.con ?? rules.abilityModifier(targetCombatant.abilities.con),
      saveMode: dnd5eSavingThrowMode(targetCombatant, 'con', { effectVisible: true }),
      blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, targetCombatant.id, 'bless'),
      baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, targetCombatant.id, 'bane'),
    }
  }
  if (payload.feature === 'monk-quivering-palm-end' && !actorCombatant.classState.quiveringPalmTargetId) {
    return { ok: false, reason: 'invalid-action' }
  }
  if (payload.feature === 'paladin-cleansing-touch') {
    const targetToken = input.map.tokens.find((token) => token.id === payload.targetTokenId && token.type !== 'obstacle')
    const sourceToken = input.map.tokens.find((token) => token.id === payload.sourceTokenId && token.type !== 'obstacle')
    const targetCombatant = targetToken ? snapshot.state.combatants[targetToken.id] : undefined
    const sourceCombatant = sourceToken ? snapshot.state.combatants[sourceToken.id] : undefined
    if (
      !targetToken || !sourceToken || !targetCombatant || !sourceCombatant ||
      (targetToken.id !== actorToken.id && areOpposedCombatTokens(actorToken, targetToken)) ||
      targetCombatant.classState.concentrationEffectsBySource?.[sourceCombatant.id] !== payload.spellId ||
      sourceCombatant.classState.concentrationSpellId !== payload.spellId ||
      !sourceCombatant.classState.concentrationTargetIds?.includes(targetCombatant.id) ||
      !sourceCombatant.concentrating
    ) return { ok: false, reason: 'invalid-target' }
  }
  const headlessAction = buildHeadlessAction(payload, actorToken.id, detectedTargetIds, turnUndeadTargetIds, monkBonusAttack)
  if (!headlessAction) return { ok: false, reason: 'invalid-action' }

  const rangeTargets: Array<{ tokenId: string; rangeFeet: number }> = []
  if (payload.feature === 'bardic-inspiration') rangeTargets.push({ tokenId: payload.targetTokenId, rangeFeet: 60 })
  if (payload.feature === 'paladin-lay-on-hands') rangeTargets.push({ tokenId: payload.targetTokenId, rangeFeet: 5 })
  if (payload.feature === 'paladin-cleansing-touch') rangeTargets.push({ tokenId: payload.targetTokenId, rangeFeet: 5 })
  if (payload.feature === 'cleric-preserve-life') {
    rangeTargets.push(...payload.allocations.map((allocation) => ({ tokenId: allocation.targetTokenId, rangeFeet: 30 })))
  }
  if (payload.feature === 'ranger-move-hunters-mark') {
    rangeTargets.push({ tokenId: payload.targetTokenId, rangeFeet: 90 })
  }
  for (const target of rangeTargets) {
    const targetToken = input.map.tokens.find((token) => token.id === target.tokenId && token.type !== 'obstacle')
    if (!targetToken) return { ok: false, reason: 'invalid-target' }
    if (!snapshot.state.combatants[targetToken.id]) return { ok: false, reason: 'combatant-missing' }
    if (targetDistanceFeet(actorToken, targetToken, input.map) > target.rangeFeet) {
      return { ok: false, reason: 'target-out-of-range' }
    }
  }
  if (payload.feature === 'ranger-move-hunters-mark') {
    const targetToken = input.map.tokens.find((token) => token.id === payload.targetTokenId)
    if (!targetToken || !areOpposedCombatTokens(actorToken, targetToken)) return { ok: false, reason: 'invalid-target' }
  }

  if (input.turnEconomy) {
    actorCombatant.turn = {
      ...actorCombatant.turn,
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
      movementRemaining: input.turnEconomy.movement.current,
    }
  }

  return {
    ok: true,
    prepared: {
      action,
      payload,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      actorToken,
      headlessAction,
      monkBonusAttack,
      quiveringPalmRelease,
      intimidatingPresence,
      turnUndead,
      rogueAbilityCheck,
    },
  }
}

export function previewDnd5eMonkBonusAttack(
  prepared: PreparedDnd5eClassFeature,
  attackIndex: number,
  d20: number,
  d20Second?: number,
  modeOverride?: 'normal' | 'advantage' | 'disadvantage',
  blessRoll?: number,
  baneRoll?: number,
) {
  const attack = prepared.monkBonusAttack
  const target = attack?.targets[attackIndex]
  if (!attack || !target) throw new RangeError('monk bonus attack index is out of range')
  const mode = modeOverride ?? target.attackMode
  const rolls = mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  return rules.resolveAttack({ rolls, mode, modifier: attack.profile.attackModifier + (blessRoll ?? 0) - (baneRoll ?? 0), targetAc: target.armorClass })
}

export function resolvePreparedDnd5eClassFeature(input: {
  prepared: PreparedDnd5eClassFeature
  monkAttackRolls?: readonly Dnd5eMonkBonusAttackRoll[]
  turnUndeadSavingThrows?: readonly Dnd5eSpellTargetSavingThrowRoll[]
  savingThrowD20?: number
  savingThrowD20Second?: number
  savingThrowBlessRoll?: number
  savingThrowBaneRoll?: number
  savingThrowRerollD20?: number
  savingThrowRerollD20Second?: number
  bardicInspirationRoll?: number
  darkOnesOwnLuckRoll?: number
  effectRolls?: readonly number[]
  abilityCheckD20?: number
  abilityCheckD20Second?: number
  hideAllowed?: boolean
  divineInterventionD100?: number
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const headlessAction: Dnd5eAction = prepared.headlessAction.type === 'monk-unarmed-bonus'
    ? {
        ...prepared.headlessAction,
        attacks: prepared.headlessAction.attacks.map((attack, index) => ({
          ...attack,
          d20: input.monkAttackRolls?.[index]?.d20 ?? 0,
          d20Second: input.monkAttackRolls?.[index]?.d20Second,
          blessRoll: input.monkAttackRolls?.[index]?.blessRoll,
          baneRoll: input.monkAttackRolls?.[index]?.baneRoll,
          bardicInspirationRoll: input.monkAttackRolls?.[index]?.bardicInspirationRoll,
          cuttingWords: input.monkAttackRolls?.[index]?.cuttingWords,
          cuttingWordsDamage: input.monkAttackRolls?.[index]?.cuttingWordsDamage,
          shieldSpellReaction: input.monkAttackRolls?.[index]?.shieldSpellReaction,
          tranquilitySave: input.monkAttackRolls?.[index]?.tranquilitySave,
          standAgainstTide: input.monkAttackRolls?.[index]?.standAgainstTide,
          damageRolls: input.monkAttackRolls?.[index]?.damageRolls ?? [],
          stunningStrikeSaveD20: input.monkAttackRolls?.[index]?.stunningStrikeSaveD20,
          stunningStrikeSaveD20Second: input.monkAttackRolls?.[index]?.stunningStrikeSaveD20Second,
          stunningStrikeSaveBlessRoll: input.monkAttackRolls?.[index]?.stunningStrikeSaveBlessRoll,
          stunningStrikeSaveBaneRoll: input.monkAttackRolls?.[index]?.stunningStrikeSaveBaneRoll,
          stunningStrikeSaveRerollD20: input.monkAttackRolls?.[index]?.stunningStrikeSaveRerollD20,
          stunningStrikeSaveRerollD20Second: input.monkAttackRolls?.[index]?.stunningStrikeSaveRerollD20Second,
          stunningStrikeBardicInspirationRoll: input.monkAttackRolls?.[index]?.stunningStrikeBardicInspirationRoll,
          stunningStrikeDarkOnesOwnLuckRoll: input.monkAttackRolls?.[index]?.stunningStrikeDarkOnesOwnLuckRoll,
          openHandTechnique: attack.openHandTechnique ? {
            ...attack.openHandTechnique,
            savingThrowD20: input.monkAttackRolls?.[index]?.openHandSavingThrowD20,
            savingThrowD20Second: input.monkAttackRolls?.[index]?.openHandSavingThrowD20Second,
            blessRoll: input.monkAttackRolls?.[index]?.openHandBlessRoll,
            baneRoll: input.monkAttackRolls?.[index]?.openHandBaneRoll,
            savingThrowRerollD20: input.monkAttackRolls?.[index]?.openHandSavingThrowRerollD20,
            savingThrowRerollD20Second: input.monkAttackRolls?.[index]?.openHandSavingThrowRerollD20Second,
            bardicInspirationRoll: input.monkAttackRolls?.[index]?.openHandBardicInspirationRoll,
            darkOnesOwnLuckRoll: input.monkAttackRolls?.[index]?.openHandDarkOnesOwnLuckRoll,
          } : undefined,
        })),
      }
    : (prepared.headlessAction.type === 'rogue-cunning-action' && prepared.headlessAction.option === 'hide') ||
        prepared.headlessAction.type === 'ranger-vanish'
      ? {
          ...prepared.headlessAction,
          hideAllowed: input.hideAllowed,
          d20: input.abilityCheckD20,
          d20Second: input.abilityCheckD20Second,
        }
      : prepared.headlessAction.type === 'rogue-fast-hands'
        ? {
            ...prepared.headlessAction,
            d20: input.abilityCheckD20,
            d20Second: input.abilityCheckD20Second,
          }
    : prepared.headlessAction.type === 'cleric-turn-undead' || prepared.headlessAction.type === 'paladin-turn-the-unholy'
      ? {
          ...prepared.headlessAction,
          targets: prepared.headlessAction.targets.map((target) => {
            const supplied = input.turnUndeadSavingThrows?.find((roll) => roll.targetId === target.targetId)
            return supplied ? { ...supplied } : { targetId: target.targetId, d20: 0 }
          }),
        }
    : prepared.headlessAction.type === 'cleric-divine-intervention'
      ? { ...prepared.headlessAction, d100: input.divineInterventionD100 }
    : prepared.headlessAction.type === 'barbarian-intimidating-presence' ||
        prepared.headlessAction.type === 'monk-quivering-palm-release'
      ? {
          ...prepared.headlessAction,
          savingThrowD20: input.savingThrowD20,
          savingThrowD20Second: input.savingThrowD20Second,
          savingThrowBlessRoll: input.savingThrowBlessRoll,
          savingThrowBaneRoll: input.savingThrowBaneRoll,
          savingThrowRerollD20: input.savingThrowRerollD20,
          savingThrowRerollD20Second: input.savingThrowRerollD20Second,
          bardicInspirationRoll: input.bardicInspirationRoll,
          darkOnesOwnLuckRoll: input.darkOnesOwnLuckRoll,
          ...(prepared.headlessAction.type === 'monk-quivering-palm-release'
            ? { damageRolls: input.effectRolls ?? [] }
            : {}),
        }
      : prepared.headlessAction
  const result = resolveDnd5eHeadlessAction(prepared.state, headlessAction)
  if (!result.ok) return { result }
  return {
    result,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: prepared.map,
      characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
    }),
  }
}
