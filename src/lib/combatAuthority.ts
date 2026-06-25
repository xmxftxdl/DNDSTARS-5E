import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import type { CombatMutation, PendingDamagePacket } from './combatResolutionPipeline'
import { statusRefreshTokenPatch } from './combatTokens'

export type CombatAuthorityRole = 'dm' | 'player'

export interface EnemyApState {
  current: number
  max: number
}

export interface CombatAuthorityState {
  characters: Character[]
  enemyApByToken: Record<string, EnemyApState>
}

export interface CombatMutationAuthorityState extends CombatAuthorityState {
  map: BattleMap
}

export interface AuthorityFailure {
  ok: false
  state: CombatAuthorityState
  reason: 'not-authority' | 'not-found' | 'dead' | 'invalid-amount' | 'insufficient-ap'
}

export interface AuthoritySuccess<T = undefined> {
  ok: true
  state: CombatAuthorityState
  value: T
}

export type AuthorityResult<T = undefined> = AuthoritySuccess<T> | AuthorityFailure

export interface CombatMutationExecutionFailure {
  mutation: CombatMutation
  reason: AuthorityFailure['reason'] | 'unsupported'
}

export interface CombatMutationExecutionResult {
  state: CombatMutationAuthorityState
  logs: Extract<CombatMutation, { type: 'log' }>[]
  custom: Extract<CombatMutation, { type: 'custom' }>[]
  failures: CombatMutationExecutionFailure[]
}

export interface SpendApValue {
  before: number
  after: number
  amount: number
}

export interface DodgeResolutionValue {
  wantsDodge: boolean
  dodgeApSpent: boolean
  dodged: boolean
  attackTotal?: number
  targetAc: number
  damageApplied: number
}

function cloneState(state: CombatAuthorityState): CombatAuthorityState {
  return {
    characters: state.characters.map((character) => ({
      ...character,
      combatBuffs: character.combatBuffs ? { ...character.combatBuffs } : undefined,
      traits: character.traits.map((trait) => ({ ...trait })),
      combatSkills: character.combatSkills.map((skill) => ({ ...skill })),
      conditions: [...character.conditions],
    })),
    enemyApByToken: Object.fromEntries(
      Object.entries(state.enemyApByToken).map(([id, ap]) => [id, { ...ap }]),
    ),
  }
}

function cloneMap(map: BattleMap): BattleMap {
  return {
    ...map,
    tokens: map.tokens.map((token) => ({ ...token })),
  }
}

function cloneMutationState(state: CombatMutationAuthorityState): CombatMutationAuthorityState {
  return {
    ...cloneState(state),
    map: cloneMap(state.map),
  }
}

function fail(
  state: CombatAuthorityState,
  reason: AuthorityFailure['reason'],
): AuthorityFailure {
  return { ok: false, state, reason }
}

function assertDm(
  state: CombatAuthorityState,
  role: CombatAuthorityRole,
): AuthorityFailure | null {
  return role === 'dm' ? null : fail(state, 'not-authority')
}

function updateCharacter(
  state: CombatAuthorityState,
  characterId: string,
  updater: (character: Character) => Character,
): CombatAuthorityState {
  return {
    ...state,
    characters: state.characters.map((character) =>
      character.id === characterId ? updater(character) : character,
    ),
  }
}

function updateCharacterInMutationState(
  state: CombatMutationAuthorityState,
  characterId: string,
  updater: (character: Character) => Character,
): CombatMutationAuthorityState {
  const nextCharacter = state.characters.find((character) => character.id === characterId)
  if (!nextCharacter) return state
  const updatedCharacter = updater(nextCharacter)
  return {
    ...state,
    characters: state.characters.map((character) =>
      character.id === characterId ? updatedCharacter : character,
    ),
    map: syncCharacterTokenHp(state.map, updatedCharacter),
  }
}

function updateTokenInMap(map: BattleMap, tokenId: string, updater: (token: Token) => Token): BattleMap {
  return {
    ...map,
    tokens: map.tokens.map((token) => (token.id === tokenId ? updater(token) : token)),
  }
}

function syncCharacterTokenHp(map: BattleMap, character: Character): BattleMap {
  return {
    ...map,
    tokens: map.tokens.map((token) =>
      token.characterId === character.id
        ? {
            ...token,
            hp: character.currentHp,
            maxHp: character.maxHp,
          }
        : token,
    ),
  }
}

function conditionTokenPatch(condition: string, turns?: number): Partial<Token> {
  const value = turns && turns > 0 ? turns : undefined
  switch (condition) {
    case '燃烧':
      return { burningTurns: value }
    case '点燃':
      return { igniteTurns: value }
    case '中毒':
      return { poisonTurns: value }
    case '眩晕':
      return { stunTurns: value }
    case '束缚':
      return { restrainedTurns: value }
    case '脆弱':
      return { vulnerableTurns: value }
    case '无法移动':
      return { noMoveTurns: value }
    default:
      return {}
  }
}

function findMutationTargetCharacter(
  state: CombatMutationAuthorityState,
  target: PendingDamagePacket['target'],
): Character | undefined {
  if (target.characterId) return state.characters.find((character) => character.id === target.characterId)
  const token = state.map.tokens.find((item) => item.id === target.tokenId)
  return token?.characterId ? state.characters.find((character) => character.id === token.characterId) : undefined
}

function applyCharacterDamage(character: Character, amount: number): Character {
  const beforeTemp = character.tempHp ?? 0
  const nextTemp = Math.max(0, beforeTemp - amount)
  const remainingDamage = Math.max(0, amount - beforeTemp)
  return {
    ...character,
    tempHp: nextTemp,
    currentHp: Math.max(0, character.currentHp - remainingDamage),
  }
}

function applyCharacterHeal(character: Character, amount: number): Character {
  return {
    ...character,
    currentHp: Math.min(character.maxHp, character.currentHp + amount),
  }
}

function applyTokenDamage(token: Token, amount: number): Token {
  if (typeof token.hp !== 'number') return token
  return {
    ...token,
    hp: Math.max(0, token.hp - amount),
  }
}

export function startCombatAuthority(
  state: CombatAuthorityState,
  params: { role: CombatAuthorityRole; enemyTokenIds?: string[] },
): AuthorityResult {
  const denied = assertDm(state, params.role)
  if (denied) return denied

  const next = cloneState(state)
  next.characters = next.characters.map((character) => ({
    ...character,
    currentAP: character.actionPoints,
  }))
  for (const tokenId of params.enemyTokenIds ?? Object.keys(next.enemyApByToken)) {
    next.enemyApByToken[tokenId] = { current: 2, max: 2 }
  }
  return { ok: true, state: next, value: undefined }
}

export function spendCharacterApAuthority(
  state: CombatAuthorityState,
  params: { role: CombatAuthorityRole; characterId: string; amount: number },
): AuthorityResult<SpendApValue> {
  const denied = assertDm(state, params.role)
  if (denied) return denied
  if (!Number.isFinite(params.amount) || params.amount <= 0) return fail(state, 'invalid-amount')

  const character = state.characters.find((item) => item.id === params.characterId)
  if (!character) return fail(state, 'not-found')
  if (character.currentHp <= 0) return fail(state, 'dead')
  if (character.currentAP < params.amount) return fail(state, 'insufficient-ap')

  const after = character.currentAP - params.amount
  return {
    ok: true,
    state: updateCharacter(cloneState(state), character.id, (item) => ({
      ...item,
      currentAP: after,
    })),
    value: { before: character.currentAP, after, amount: params.amount },
  }
}

export function spendEnemyApAuthority(
  state: CombatAuthorityState,
  params: { role: CombatAuthorityRole; tokenId: string; amount: number },
): AuthorityResult<SpendApValue> {
  const denied = assertDm(state, params.role)
  if (denied) return denied
  if (!Number.isFinite(params.amount) || params.amount <= 0) return fail(state, 'invalid-amount')

  const enemyAp = state.enemyApByToken[params.tokenId]
  if (!enemyAp) return fail(state, 'not-found')
  if (enemyAp.current < params.amount) return fail(state, 'insufficient-ap')

  const next = cloneState(state)
  const after = enemyAp.current - params.amount
  next.enemyApByToken[params.tokenId] = { ...enemyAp, current: after }
  return {
    ok: true,
    state: next,
    value: { before: enemyAp.current, after, amount: params.amount },
  }
}

export function activateFeatureAuthority(
  state: CombatAuthorityState,
  params: { role: CombatAuthorityRole; characterId: string },
): AuthorityResult<SpendApValue> {
  return spendCharacterApAuthority(state, { ...params, amount: 1 })
}

export function moveCharacterAuthority(
  state: CombatAuthorityState,
  params: { role: CombatAuthorityRole; characterId: string },
): AuthorityResult<SpendApValue> {
  return spendCharacterApAuthority(state, { ...params, amount: 1 })
}

export function attackCharacterAuthority(
  state: CombatAuthorityState,
  params: { role: CombatAuthorityRole; characterId: string },
): AuthorityResult<SpendApValue> {
  return spendCharacterApAuthority(state, { ...params, amount: 1 })
}

export function applyDamageAuthority(
  state: CombatAuthorityState,
  params: { role: CombatAuthorityRole; characterId: string; amount: number },
): AuthorityResult<{ hpBefore: number; tempBefore: number; hpAfter: number; tempAfter: number }> {
  const denied = assertDm(
    state,
    params.role,
  )
  if (denied) return denied
  if (!Number.isFinite(params.amount) || params.amount < 0) return fail(state, 'invalid-amount')

  const character = state.characters.find((item) => item.id === params.characterId)
  if (!character) return fail(state, 'not-found')

  const hpBefore = character.currentHp
  const tempBefore = character.tempHp ?? 0
  const tempAfter = Math.max(0, tempBefore - params.amount)
  const remainingDamage = Math.max(0, params.amount - tempBefore)
  const hpAfter = Math.max(0, hpBefore - remainingDamage)
  return {
    ok: true,
    state: updateCharacter(cloneState(state), character.id, (item) => ({
      ...item,
      currentHp: hpAfter,
      tempHp: tempAfter,
    })),
    value: { hpBefore, tempBefore, hpAfter, tempAfter },
  }
}

export function resolveDodgeAuthority(
  state: CombatAuthorityState,
  params: {
    role: CombatAuthorityRole
    targetCharacterId: string
    wantsDodge: boolean
    d20?: number
    attackBonus: number
    damage: number
  },
): AuthorityResult<DodgeResolutionValue> {
  const denied = assertDm(state, params.role)
  if (denied) return denied

  const target = state.characters.find((item) => item.id === params.targetCharacterId)
  if (!target) return fail(state, 'not-found')
  if (target.currentHp <= 0) return fail(state, 'dead')

  let next = cloneState(state)
  let dodgeApSpent = false
  let attackTotal: number | undefined
  let dodged = false

  if (params.wantsDodge) {
    const spent = spendCharacterApAuthority(next, {
      role: 'dm',
      characterId: target.id,
      amount: 1,
    })
    if (!spent.ok) return spent
    next = spent.state
    dodgeApSpent = true
    attackTotal = (params.d20 ?? 0) + params.attackBonus
    dodged = attackTotal < target.ac
  }

  if (dodged) {
    return {
      ok: true,
      state: next,
      value: {
        wantsDodge: params.wantsDodge,
        dodgeApSpent,
        dodged,
        attackTotal,
        targetAc: target.ac,
        damageApplied: 0,
      },
    }
  }

  const damaged = applyDamageAuthority(next, {
    role: 'dm',
    characterId: target.id,
    amount: params.damage,
  })
  if (!damaged.ok) return damaged
  return {
    ok: true,
    state: damaged.state,
    value: {
      wantsDodge: params.wantsDodge,
      dodgeApSpent,
      dodged,
      attackTotal,
      targetAc: target.ac,
      damageApplied: params.damage,
    },
  }
}

export function executeCombatMutationsAuthority(
  state: CombatMutationAuthorityState,
  params: { role: CombatAuthorityRole; mutations: CombatMutation[] },
): CombatMutationExecutionResult {
  const denied = assertDm(state, params.role)
  if (denied) {
    return {
      state,
      logs: [],
      custom: [],
      failures: params.mutations.map((mutation) => ({ mutation, reason: denied.reason })),
    }
  }

  let next = cloneMutationState(state)
  const logs: CombatMutationExecutionResult['logs'] = []
  const custom: CombatMutationExecutionResult['custom'] = []
  const failures: CombatMutationExecutionFailure[] = []

  for (const mutation of params.mutations) {
    switch (mutation.type) {
      case 'spend-ap': {
        const character = next.characters.find((item) => item.id === mutation.characterId)
        if (!character) {
          failures.push({ mutation, reason: 'not-found' })
          break
        }
        if (character.currentHp <= 0) {
          failures.push({ mutation, reason: 'dead' })
          break
        }
        if (!Number.isFinite(mutation.amount) || mutation.amount <= 0) {
          failures.push({ mutation, reason: 'invalid-amount' })
          break
        }
        if (character.currentAP < mutation.amount) {
          failures.push({ mutation, reason: 'insufficient-ap' })
          break
        }
        next = updateCharacterInMutationState(next, character.id, (item) => ({
          ...item,
          currentAP: item.currentAP - mutation.amount,
        }))
        break
      }
      case 'spend-qi': {
        const character = next.characters.find((item) => item.id === mutation.characterId)
        if (!character) {
          failures.push({ mutation, reason: 'not-found' })
          break
        }
        if (character.currentHp <= 0) {
          failures.push({ mutation, reason: 'dead' })
          break
        }
        if (!Number.isFinite(mutation.amount) || mutation.amount <= 0) {
          failures.push({ mutation, reason: 'invalid-amount' })
          break
        }
        if ((character.qi ?? 0) < mutation.amount) {
          failures.push({ mutation, reason: 'insufficient-ap' })
          break
        }
        next = updateCharacterInMutationState(next, character.id, (item) => ({
          ...item,
          qi: Math.max(0, (item.qi ?? 0) - mutation.amount),
        }))
        break
      }
      case 'spend-feature-use': {
        const character = next.characters.find((item) => item.id === mutation.characterId)
        if (!character) {
          failures.push({ mutation, reason: 'not-found' })
          break
        }
        const trait = character.traits.find((item) => item.featureKey === mutation.featureKey)
        if (!trait) {
          failures.push({ mutation, reason: 'not-found' })
          break
        }
        if (trait.maxUses > 0 && trait.uses <= 0) {
          failures.push({ mutation, reason: 'insufficient-ap' })
          break
        }
        next = updateCharacterInMutationState(next, character.id, (item) => ({
          ...item,
          traits: item.traits.map((entry) =>
            entry.id === trait.id && entry.maxUses > 0
              ? { ...entry, uses: Math.max(0, entry.uses - 1) }
              : entry,
          ),
        }))
        break
      }
      case 'damage': {
        if (!Number.isFinite(mutation.packet.amount) || mutation.packet.amount < 0) {
          failures.push({ mutation, reason: 'invalid-amount' })
          break
        }
        const character = findMutationTargetCharacter(next, mutation.packet.target)
        if (character) {
          next = updateCharacterInMutationState(next, character.id, (item) =>
            applyCharacterDamage(item, mutation.packet.amount),
          )
          break
        }
        const token = next.map.tokens.find((item) => item.id === mutation.packet.target.tokenId)
        if (!token) {
          failures.push({ mutation, reason: 'not-found' })
          break
        }
        next = {
          ...next,
          map: updateTokenInMap(next.map, token.id, (item) => applyTokenDamage(item, mutation.packet.amount)),
        }
        break
      }
      case 'heal': {
        if (!Number.isFinite(mutation.amount) || mutation.amount < 0) {
          failures.push({ mutation, reason: 'invalid-amount' })
          break
        }
        const character = next.characters.find((item) => item.id === mutation.characterId)
        if (!character) {
          failures.push({ mutation, reason: 'not-found' })
          break
        }
        next = updateCharacterInMutationState(next, character.id, (item) =>
          applyCharacterHeal(item, mutation.amount),
        )
        break
      }
      case 'condition': {
        const character = findMutationTargetCharacter(next, mutation.target)
        if (character) {
          next = updateCharacterInMutationState(next, character.id, (item) => {
            const conditions =
              mutation.mode === 'add'
                ? Array.from(new Set([...item.conditions, mutation.condition]))
                : item.conditions.filter((condition) => condition !== mutation.condition)
            return { ...item, conditions }
          })
        }
        const token = next.map.tokens.find((item) => item.id === mutation.target.tokenId)
        if (token) {
          const patch =
            mutation.mode === 'add'
              ? statusRefreshTokenPatch(token, mutation.condition, mutation.turns)
              : conditionTokenPatch(mutation.condition, 0)
          if (Object.keys(patch).length > 0) {
            next = {
              ...next,
              map: updateTokenInMap(next.map, token.id, (item) => ({ ...item, ...patch })),
            }
          }
        }
        if (!character && !token) failures.push({ mutation, reason: 'not-found' })
        break
      }
      case 'log':
        logs.push(mutation)
        break
      case 'custom':
        custom.push(mutation)
        break
      default:
        failures.push({ mutation, reason: 'unsupported' })
        break
    }
  }

  return { state: next, logs, custom, failures }
}
