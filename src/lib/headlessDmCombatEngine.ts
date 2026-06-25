import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type { BattleMap, Token } from '../store/maps'
import type { Character, CombatSkill } from '../types/character'
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
import { tokenFootprintDistanceCells } from './gridCombat'
import { checkCombatOutcome, decideTurnAction, hasActionableActor, isTokenAlive } from './combatTokens'
import { resolveCombatMovement } from './combatMovementPipeline'
import { triggerOutOfBreath } from './calmMind'
import { areOpposedCombatTokens, findOpportunityAttackersForMove } from './opportunityAttacks'
import { attackDamageDiceCount, getEffectiveAbilityMod } from './archerCombat'
import { proficiencyBonus } from './dnd'
import { getTokenAbilityMod } from './knockback'
import { decideDodge } from './aiPolicy'

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
  | { type: 'combat-ended'; winner: 'ally' | 'enemy'; message: string }
  | { type: 'status-added'; targetTokenId: string; characterId?: string; condition: string; turns?: number }
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
}

export interface HeadlessPlayerAttackAction {
  type: 'attack-token'
  actorTokenId: string
  characterId: string
  targetTokenId: string
  skillId: string
  diceValues?: number[]
  targetDodgeD20?: number
  isCrit?: boolean
}

export interface HeadlessEnemyAttackAction {
  type: 'enemy-attack-token'
  actorTokenId: string
  targetTokenId: string
  actionIndex?: number
  diceValues?: number[]
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

export type HeadlessCombatAction =
  | HeadlessPlayerMoveAction
  | HeadlessPlayerAttackAction
  | HeadlessEnemyAttackAction
  | HeadlessOpportunityAttackAction
  | HeadlessEndTurnAction

export type HeadlessCombatFailureReason =
  | 'combat-ended'
  | 'stale-turn'
  | 'invalid-actor'
  | 'invalid-target'
  | 'invalid-skill'
  | 'invalid-dice'
  | 'insufficient-ap'
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

export function startHeadlessCombat(state: HeadlessDmCombatState): HeadlessDmCombatState {
  const next = cloneHeadlessCombatState(state)
  next.active = next.initiativeOrder.length > 0
  next.round = Math.max(1, next.round || 1)
  next.initiativeIndex = Math.min(Math.max(0, next.initiativeIndex || 0), Math.max(0, next.initiativeOrder.length - 1))
  resetRoundAp(next)
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
  if (action.type !== 'opportunity-attack-token' && (!turn || turn.tokenId !== action.actorTokenId)) {
    return fail(next, 'stale-turn', events)
  }

  switch (action.type) {
    case 'move-token':
      return resolveMove(next, action, events)
    case 'attack-token':
      return resolvePlayerAttack(next, action, dice, events)
    case 'enemy-attack-token':
      return resolveEnemyAttack(next, action, dice, events)
    case 'opportunity-attack-token':
      return resolveOpportunityAttack(next, action, dice, events)
    case 'end-turn': {
      if (action.characterId) {
        const actor = findCharacter(next, action.characterId)
        if (!actor) return fail(next, 'invalid-actor', events)
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

function resolveMove(
  state: HeadlessDmCombatState,
  action: HeadlessPlayerMoveAction,
  events: HeadlessCombatEvent[],
): HeadlessCombatResult {
  const movement = resolveCombatMovement({
    map: state.map,
    characters: state.characters,
    actorTokenId: action.actorTokenId,
    characterId: action.characterId,
    targetPosition: action.targetPosition,
    mode: 'turn-move',
    active: state.active,
    currentTurnTokenId: getCurrentTurn(state)?.tokenId,
  })
  if (!movement.ok) return fail(state, movement.reason, events)
  const actor = movement.actor
  if (!actor) return fail(state, 'invalid-actor', events)

  if (movement.characterPatch?.currentAP != null) {
    const before = actor.currentAP
    updateCharacter(state, actor.id, (item) => {
      const withAp = { ...item, currentAP: movement.characterPatch!.currentAP! }
      if (!movement.triggersMoveEffects) return withAp
      return {
        ...withAp,
        combatBuffs: {
          ...triggerOutOfBreath(withAp, 'move'),
          movedFeetThisTurn: Math.max(1, withAp.combatBuffs?.movedFeetThisTurn ?? 0),
        },
      }
    })
    events.push({
      type: 'ap-spent',
      tokenId: movement.token.id,
      characterId: actor.id,
      amount: movement.apCost,
      before,
      after: movement.characterPatch.currentAP,
    })
  }

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

  updateToken(state, movement.token.id, (item) => ({ ...item, ...movement.to }))
  events.push({
    type: 'token-moved',
    tokenId: movement.token.id,
    from: movement.from,
    to: movement.to,
    feet: movement.feet,
    triggersMoveEffects: movement.triggersMoveEffects,
  })
  events.push({ type: 'log', text: `${actor.name} 移动 ${movement.feet} 尺。` })
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
  const targetToken = state.map.tokens.find((item) => item.id === action.targetTokenId)
  const skill = actor?.combatSkills.find((item) => item.id === action.skillId)
  if (!actor || !actorToken || actorToken.characterId !== actor.id || actorToken.type !== 'player') {
    return fail(state, 'invalid-actor', events)
  }
  if (!targetToken || targetToken.id === actorToken.id || !isTokenAlive(targetToken, state.characters)) {
    return fail(state, 'invalid-target', events)
  }
  if (!skill || skill.damageCount < 0 || skill.damageSides < 0 || skill.remaining > 0) {
    return fail(state, 'invalid-skill', events)
  }
  const rangeFeet = singleTargetRangeFeet(skill)
  if (rangeFeet != null) {
    const distanceFeet = tokenFootprintDistanceCells(actorToken, targetToken, state.map) * (state.map.feetPerCell ?? 5)
    if (distanceFeet > rangeFeet) return fail(state, 'out-of-range', events)
  }
  const waiveAp = !!actor.combatBuffs?.galeComboReady
  const apCost = Math.max(0, skill.apCost)
  if (!waiveAp && apCost > 0 && !spendCharacterAp(state, actor.id, apCost, actorToken.id, events)) {
    return fail(state, 'insufficient-ap', events)
  }

  const targetDodge = resolveTargetDodgeAgainstPlayerAttack(state, actorToken, actor, targetToken, skill, action, dice, events)
  if (!targetDodge) return fail(state, 'invalid-dice', events)
  if (targetDodge.dodged) {
    markSkillUsed(state, actor.id, skill.id)
    if (waiveAp) consumeGaleComboReady(state, actor.id, skill.name, events)
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
      apCost,
    })
    events.push({
      type: 'log',
      text: `${targetToken.label} 闪避 ${actor.name} 的 ${skill.name} 成功。`,
    })
    return succeed(state, events)
  }

  const diceValues = resolveDiceValues(action.diceValues, dice, skill.damageCount, skill.damageSides)
  if (!diceValues) return fail(state, 'invalid-dice', events)
  events.push({
    type: 'dice-rolled',
    notation: `${skill.damageCount}d${skill.damageSides}`,
    values: diceValues,
    total: diceValues.reduce((sum, value) => sum + value, 0),
  })

  const baseDamage = resolveAttackDamageTotal(actor, skill, diceValues, { isCrit: action.isCrit })
  const damageType = isMagicDamageSkill(skill) ? 'magic' : 'physical'
  const adjusted = adjustDamageForTarget(state, baseDamage, actor, targetToken, damageType)
  applyDamageToTarget(state, targetToken, adjusted.damage, events)
  markSkillUsed(state, actor.id, skill.id)
  if (waiveAp) consumeGaleComboReady(state, actor.id, skill.name, events)
  applyStatusOnHit(state, targetToken, skill, events)
  events.push({
    type: 'attack-resolved',
    actorTokenId: actorToken.id,
    characterId: actor.id,
    targetTokenId: targetToken.id,
    skillId: skill.id,
    skillName: skill.name,
    damageValues: diceValues,
    diceTotal: diceValues.reduce((sum, value) => sum + value, 0),
    baseDamage,
    damageBeforeDefense: baseDamage,
    modifier: adjusted.modifier,
    diff: adjusted.diff,
    total: adjusted.damage,
    isCrit: !!action.isCrit,
    hit: true,
    targetDodged: false,
    waivedAp: waiveAp,
    apCost,
  })
  events.push({
    type: 'log',
    text: `${actor.name} 使用 ${skill.name} 攻击 ${targetToken.label}：骰值 ${diceValues.join('+')}，攻防修正 ${adjusted.modifier}，最终 ${adjusted.damage} 点。`,
  })
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
  const ap = state.enemyApByToken[targetToken.id]
  if (!ap || ap.current < 1) return { attempted: false, dodged: false }
  const attackAbility = skill.tags?.includes('melee') ? 'str' : 'dex'
  const attackBonus = getEffectiveAbilityMod(actor, attackAbility) + proficiencyBonus(actor.level)
  const targetAc = getTokenTargetAc(targetToken) ?? 12
  const diceCount = attackDamageDiceCount(skill, false)
  const estimatedDamage = diceCount * ((skill.damageSides + 1) / 2) + (skill.damageBonus ?? 0)
  const decision = decideDodge({
    currentAp: ap.current,
    currentHp: targetToken.hp ?? targetToken.maxHp ?? 1,
    maxHp: targetToken.maxHp ?? targetToken.hp ?? 1,
    targetAc,
    incomingAttackBonus: attackBonus,
    estimatedDamage,
  })
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
  if (!spendEnemyAp(state, actorToken.id, 1, events)) return fail(state, 'insufficient-ap', events)

  const diceValues = resolveDiceValues(action.diceValues, dice, parsed.count, parsed.sides)
  if (!diceValues) return fail(state, 'invalid-dice', events)
  const diceTotal = diceValues.reduce((sum, value) => sum + value, 0)
  events.push({ type: 'dice-rolled', notation: `${parsed.count}d${parsed.sides}`, values: diceValues, total: diceTotal })
  const baseDamage = diceTotal + parsed.bonus
  const attacker = enemyCombatInput(actorToken.poolId)
  const target = findCharacter(state, targetToken.characterId)
  const adjusted = applyAttackDefenseDamageModifier(
    baseDamage,
    attacker,
    target ? characterToCombatInput(target) : undefined,
    enemyDamageType(actionDef.damageType),
    target?.conditions.includes('脆弱') ?? false,
  )
  applyDamageToTarget(state, targetToken, adjusted.damage, events)
  events.push({
    type: 'log',
    text: `${actorToken.label} 使用 ${actionDef.name} 攻击 ${targetToken.label}：骰值 ${diceValues.join('+')}，加值 ${parsed.bonus}，攻防修正 ${adjusted.modifier}，最终 ${adjusted.damage} 点。`,
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

function applyDamageToTarget(
  state: HeadlessDmCombatState,
  targetToken: Token,
  amount: number,
  events: HeadlessCombatEvent[],
) {
  const character = targetToken.characterId ? findCharacter(state, targetToken.characterId) : undefined
  if (character) {
    const hpBefore = character.currentHp
    const tempBefore = character.tempHp ?? 0
    const nextTemp = Math.max(0, tempBefore - amount)
    const remaining = Math.max(0, amount - tempBefore)
    const hpAfter = Math.max(0, hpBefore - remaining)
    updateCharacter(state, character.id, (item) => ({ ...item, currentHp: hpAfter, tempHp: nextTemp }))
    updateToken(state, targetToken.id, (item) => ({ ...item, hp: hpAfter, maxHp: character.maxHp }))
    events.push({ type: 'damage-applied', targetTokenId: targetToken.id, characterId: character.id, amount, hpBefore, hpAfter })
    return
  }
  const hpBefore = targetToken.hp ?? targetToken.maxHp ?? 0
  const hpAfter = Math.max(0, hpBefore - amount)
  updateToken(state, targetToken.id, (item) => ({ ...item, hp: hpAfter }))
  events.push({ type: 'damage-applied', targetTokenId: targetToken.id, amount, hpBefore, hpAfter })
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

function markSkillUsed(state: HeadlessDmCombatState, characterId: string, skillId: string) {
  updateCharacter(state, characterId, (character) => ({
    ...character,
    combatSkills: character.combatSkills.map((skill) =>
      skill.id === skillId
        ? {
            ...skill,
            usedThisTurn: true,
            remaining: Math.max(0, skill.cooldown - skill.cdReduction),
          }
        : skill,
    ),
  }))
}

function consumeGaleComboReady(
  state: HeadlessDmCombatState,
  characterId: string,
  actionLabel: string,
  events: HeadlessCombatEvent[],
) {
  const character = findCharacter(state, characterId)
  if (!character?.combatBuffs?.galeComboReady) return
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
      state.round += 1
      resetRoundAp(state)
    }
    const turn = getCurrentTurn(state)
    const token = turn ? state.map.tokens.find((item) => item.id === turn.tokenId) : undefined
    const decision = decideTurnAction(token, state.characters)
    if (decision === 'player' || decision === 'enemy') {
      events.push({ type: 'turn-advanced', round: state.round, initiativeIndex: state.initiativeIndex, tokenId: turn?.tokenId })
      return
    }
    guard -= 1
  } while (guard > 0)
}

function resetRoundAp(state: HeadlessDmCombatState) {
  state.characters = state.characters.map((character) => ({
    ...character,
    currentAP: character.currentHp > 0 ? character.actionPoints : character.currentAP,
  }))
  for (const token of state.map.tokens) {
    if (token.type !== 'enemy') continue
    const existing = state.enemyApByToken[token.id]
    state.enemyApByToken[token.id] = { current: existing?.max ?? 2, max: existing?.max ?? 2 }
  }
}

function maybeEndCombat(state: HeadlessDmCombatState, events: HeadlessCombatEvent[]) {
  const outcome = checkCombatOutcome(state.map.tokens, state.characters)
  if (!outcome.ended) return
  state.active = false
  events.push({ type: 'combat-ended', winner: outcome.winner, message: outcome.message })
}

function singleTargetRangeFeet(skill: CombatSkill): number | null {
  if (!skill.tags?.includes('ranged') && skill.skillTreeId !== 'basicShot' && skill.name !== '基础射击') return null
  switch (skill.skillTreeId) {
    case 'multiShot':
      return 30
    case 'clusterShot':
    case 'vineHookShot':
      return 20
    case 'basicShot':
      return 90
    case 'netArrow':
    case 'explosiveArrow':
    case 'magicArrow':
    case 'windStepShot':
      return 60
    case 'arcaneBreak':
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
  return { ok: true, state, events }
}

function fail(
  state: HeadlessDmCombatState,
  reason: HeadlessCombatFailureReason,
  events: HeadlessCombatEvent[],
): HeadlessCombatFailure {
  return { ok: false, state, reason, events }
}
