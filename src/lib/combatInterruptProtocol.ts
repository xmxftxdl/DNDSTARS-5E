import type { Token } from '../store/maps'
import type { Character } from '../types/character'
import type { EnemyTurnResult } from './enemyAi'
import type { CombatInterruptKind, SharedCombatInterrupt } from './combatInterruptQueue'

export type GaleComboDecision = 'accepted' | 'declined' | 'timeout'

export type DodgeInterruptPayload = Record<string, unknown> & {
  result: EnemyTurnResult
  targetName: string
}
export type DodgeInterruptResponse = Record<string, unknown> & {
  wantsDodge: boolean
  dodgeD20?: number
}

export type StableMindInterruptPayload = Record<string, unknown> & {
  targetName: string
  fullDamage: number
  damageAfterSave: number
  saveD20: number
  saveMod: number
  saveTotal: number
  dc: number
}
export type StableMindInterruptResponse = Record<string, unknown> & { useStableMind: boolean }

export type GaleComboInterruptPayload = Record<string, unknown> & {
  casterName: string
  triggerLabel: string
}
export type GaleComboInterruptResponse = Record<string, unknown> & { useGaleCombo: boolean }

export type AgileLeapInterruptPayload = Record<string, unknown> & {
  targetName: string
  feet: number
  uses: number
  maxUses: number
}
export type AgileLeapInterruptResponse = Record<string, unknown> & { useAgileLeap: boolean }

export type OpportunityAttackInterruptPayload = Record<string, unknown> & {
  attackerName: string
  targetName: string
  attackerTokenId: string
  targetTokenId: string
  trigger?: 'movement' | 'berserker-retaliation' | 'hunter-giant-killer'
}
export type OpportunityAttackInterruptResponse = Record<string, unknown> & { useOpportunityAttack: boolean }

export type ProtectionInterruptPayload = Record<string, unknown> & {
  protectorName: string
  attackerName: string
  targetName: string
  attackName: string
}
export type ProtectionInterruptResponse = Record<string, unknown> & { useProtection: boolean }

export type ShieldSpellInterruptPayload = Record<string, unknown> & {
  attackerName: string
  targetName: string
  attackName: string
  attackTotal?: number
  armorClass?: number
  magicMissile?: boolean
}
export type ShieldSpellInterruptResponse = Record<string, unknown> & { useShieldSpell: boolean }

export type UncannyDodgeInterruptPayload = Record<string, unknown> & {
  attackerName: string
  targetName: string
  attackName: string
}
export type UncannyDodgeInterruptResponse = Record<string, unknown> & { useUncannyDodge: boolean }

export type DeflectMissilesInterruptPayload = Record<string, unknown> & {
  phase: 'reduce' | 'return'
  attackerName: string
  targetName: string
  attackName: string
  kiCurrent?: number
}
export type DeflectMissilesInterruptResponse = Record<string, unknown> & { accept: boolean }

export type SavingThrowRerollInterruptPayload = Record<string, unknown> & {
  targetName: string
  featureName: string
  total: number
  dc: number
}
export type SavingThrowRerollInterruptResponse = Record<string, unknown> & { useSavingThrowReroll: boolean }

export type BardicInspirationRollType = '攻击检定' | '豁免' | '属性检定'
export type BardicInspirationInterruptPayload = Record<string, unknown> & {
  targetName: string
  dieSides: number
  rollType: BardicInspirationRollType
  total: number
  targetNumber: number
  source?: 'held-inspiration' | 'peerless-skill'
}
export type BardicInspirationInterruptResponse = Record<string, unknown> & { useBardicInspiration: boolean }

export type CuttingWordsInterruptPayload = Record<string, unknown> & {
  bardName: string
  attackerName: string
  targetName: string
  attackName: string
  phase: 'attack' | 'damage' | 'ability-check'
  dieSides: number
  total: number
  targetNumber?: number
}
export type CuttingWordsInterruptResponse = Record<string, unknown> & { useCuttingWords: boolean }

export type DarkOnesOwnLuckInterruptPayload = Record<string, unknown> & {
  targetName: string
  rollType: '豁免' | '属性检定'
  total: number
  targetNumber?: number
}
export type DarkOnesOwnLuckInterruptResponse = Record<string, unknown> & { useDarkOnesOwnLuck: boolean }

export type StrokeOfLuckInterruptPayload = Record<string, unknown> & {
  targetName: string
  attackName: string
  total: number
  armorClass: number
  rollType?: 'attack' | 'ability-check'
}
export type StrokeOfLuckInterruptResponse = Record<string, unknown> & { useStrokeOfLuck: boolean }

export interface EmpoweredSpellDamageGroup extends Record<string, unknown> {
  key: string
  label: string
  sides: number
  rolls: number[]
}
export type EmpoweredSpellInterruptPayload = Record<string, unknown> & {
  casterName: string
  spellName: string
  maximumDice: number
  groups: EmpoweredSpellDamageGroup[]
}
export type EmpoweredSpellInterruptResponse = Record<string, unknown> & { rerollKeys: string[] }

export interface StandAgainstTideTarget extends Record<string, unknown> {
  tokenId: string
  label: string
}
export type StandAgainstTideInterruptPayload = Record<string, unknown> & {
  hunterName: string
  attackerName: string
  attackName: string
  candidates: StandAgainstTideTarget[]
}
export type StandAgainstTideInterruptResponse = Record<string, unknown> & { targetTokenId?: string }

export type DmAdjudicationOperation = 'damage' | 'healing' | 'temporary-hit-points'

export interface DmAdjudicationEffect extends Record<string, unknown> {
  targetTokenId: string
  operation?: DmAdjudicationOperation
  /** DM 填写的是完成抗性、豁免等裁定后的最终数值。 */
  amount?: number
  addCondition?: string
  removeCondition?: string
}

export type DmAdjudicationInterruptPayload = Record<string, unknown> & {
  actionId: string
  casterName: string
  spellId: string
  spellName: string
  spellLevel: number
  slotLevel: number
  castingTime: 'action' | 'bonus-action'
  description: string
  concentration: boolean
  suggestedConcentrationRounds?: number
}

export type DmAdjudicationInterruptResponse = Record<string, unknown> & {
  decision: 'approved' | 'cancelled'
  effects: DmAdjudicationEffect[]
  note?: string
  concentrationRounds?: number
}

export interface CombatInterruptPayloadMap {
  dodge: DodgeInterruptPayload
  'stable-mind': StableMindInterruptPayload
  'gale-combo': GaleComboInterruptPayload
  'agile-leap': AgileLeapInterruptPayload
  'opportunity-attack': OpportunityAttackInterruptPayload
  protection: ProtectionInterruptPayload
  'shield-spell': ShieldSpellInterruptPayload
  'uncanny-dodge': UncannyDodgeInterruptPayload
  'deflect-missiles': DeflectMissilesInterruptPayload
  'saving-throw-reroll': SavingThrowRerollInterruptPayload
  'bardic-inspiration': BardicInspirationInterruptPayload
  'cutting-words': CuttingWordsInterruptPayload
  'dark-ones-own-luck': DarkOnesOwnLuckInterruptPayload
  'stroke-of-luck': StrokeOfLuckInterruptPayload
  'empowered-spell': EmpoweredSpellInterruptPayload
  'stand-against-tide': StandAgainstTideInterruptPayload
  'dm-adjudication': DmAdjudicationInterruptPayload
}

export interface CombatInterruptResponseMap {
  dodge: DodgeInterruptResponse
  'stable-mind': StableMindInterruptResponse
  'gale-combo': GaleComboInterruptResponse
  'agile-leap': AgileLeapInterruptResponse
  'opportunity-attack': OpportunityAttackInterruptResponse
  protection: ProtectionInterruptResponse
  'shield-spell': ShieldSpellInterruptResponse
  'uncanny-dodge': UncannyDodgeInterruptResponse
  'deflect-missiles': DeflectMissilesInterruptResponse
  'saving-throw-reroll': SavingThrowRerollInterruptResponse
  'bardic-inspiration': BardicInspirationInterruptResponse
  'cutting-words': CuttingWordsInterruptResponse
  'dark-ones-own-luck': DarkOnesOwnLuckInterruptResponse
  'stroke-of-luck': StrokeOfLuckInterruptResponse
  'empowered-spell': EmpoweredSpellInterruptResponse
  'stand-against-tide': StandAgainstTideInterruptResponse
  'dm-adjudication': DmAdjudicationInterruptResponse
}

export type CombatInterruptByKind<K extends CombatInterruptKind> =
  SharedCombatInterrupt<CombatInterruptPayloadMap[K], CombatInterruptResponseMap[K]> & { kind: K }

export type TypedCombatInterrupt = {
  [K in CombatInterruptKind]: CombatInterruptByKind<K>
}[CombatInterruptKind]

export interface CombatInterruptAnswerContext {
  characters: Character[]
  visibleCharacters: Character[]
  playerCharId?: string
  assignedCharacterId?: string | null
  tokens?: Token[]
}

export interface CombatInterruptAnswerCandidate {
  character?: Character
  canAnswer: boolean
}

export function defaultCombatInterruptResponse<K extends CombatInterruptKind>(
  kind: K,
): CombatInterruptResponseMap[K] {
  switch (kind) {
    case 'dodge':
      return { wantsDodge: false } as CombatInterruptResponseMap[K]
    case 'stable-mind':
      return { useStableMind: false } as CombatInterruptResponseMap[K]
    case 'gale-combo':
      return { useGaleCombo: false } as CombatInterruptResponseMap[K]
    case 'agile-leap':
      return { useAgileLeap: false } as CombatInterruptResponseMap[K]
    case 'opportunity-attack':
      return { useOpportunityAttack: false } as CombatInterruptResponseMap[K]
    case 'protection':
      return { useProtection: false } as CombatInterruptResponseMap[K]
    case 'shield-spell':
      return { useShieldSpell: false } as CombatInterruptResponseMap[K]
    case 'uncanny-dodge':
      return { useUncannyDodge: false } as CombatInterruptResponseMap[K]
    case 'deflect-missiles':
      return { accept: false } as CombatInterruptResponseMap[K]
    case 'saving-throw-reroll':
      return { useSavingThrowReroll: false } as CombatInterruptResponseMap[K]
    case 'bardic-inspiration':
      return { useBardicInspiration: false } as CombatInterruptResponseMap[K]
    case 'cutting-words':
      return { useCuttingWords: false } as CombatInterruptResponseMap[K]
    case 'dark-ones-own-luck':
      return { useDarkOnesOwnLuck: false } as CombatInterruptResponseMap[K]
    case 'stroke-of-luck':
      return { useStrokeOfLuck: false } as CombatInterruptResponseMap[K]
    case 'empowered-spell':
      return { rerollKeys: [] } as unknown as CombatInterruptResponseMap[K]
    case 'stand-against-tide':
      return {} as CombatInterruptResponseMap[K]
    case 'dm-adjudication':
      return { decision: 'cancelled', effects: [] } as unknown as CombatInterruptResponseMap[K]
  }
}

export function isCombatInterruptKind<K extends CombatInterruptKind>(
  interrupt: SharedCombatInterrupt,
  kind: K,
): interrupt is CombatInterruptByKind<K> {
  return interrupt.kind === kind
}

export function resolveCombatInterruptCharacter(
  interrupt: Pick<SharedCombatInterrupt, 'kind' | 'actorCharId' | 'targetCharId'>,
  characters: Character[],
): Character | undefined {
  const characterId =
    interrupt.kind === 'gale-combo' || interrupt.kind === 'opportunity-attack' || interrupt.kind === 'protection' || interrupt.kind === 'cutting-words' || interrupt.kind === 'stroke-of-luck' || interrupt.kind === 'empowered-spell' || interrupt.kind === 'dm-adjudication'
      ? interrupt.actorCharId
      : interrupt.targetCharId
  return characterId ? characters.find((character) => character.id === characterId) : undefined
}

export function resolveCombatInterruptAnswerCandidate(
  interrupt: SharedCombatInterrupt,
  context: CombatInterruptAnswerContext,
): CombatInterruptAnswerCandidate {
  const character = resolveCombatInterruptCharacter(interrupt, context.characters)
  // dm-adjudication is deliberately invisible to player prompt selection. Only
  // the DM-side authority loop may answer it.
  if (interrupt.kind === 'dm-adjudication') return { character, canAnswer: false }
  if (!character || (character.currentHp <= 0 && interrupt.kind !== 'bardic-inspiration')) {
    return { character, canAnswer: false }
  }

  const visibleIds = new Set(context.visibleCharacters.map((visible) => visible.id))
  const isPlayerCharacter = character.id === context.playerCharId
  const isAssignedCharacter = character.id === context.assignedCharacterId
  const isVisibleCharacter = visibleIds.has(character.id)
  const isPublicCharacter = !character.dmNotes

  if (interrupt.kind === 'dodge' || interrupt.kind === 'stable-mind') {
    return {
      character,
      canAnswer: isPlayerCharacter || isVisibleCharacter || isPublicCharacter,
    }
  }

  if (interrupt.kind === 'agile-leap') {
    return {
      character,
      canAnswer: isPlayerCharacter || isAssignedCharacter || isVisibleCharacter || isPublicCharacter,
    }
  }

  const linkedPlayerCharIds = new Set(
    (context.tokens ?? [])
      .filter((token) => token.type === 'player' && !!token.characterId)
      .map((token) => token.characterId!),
  )
  const visibleLinkedPlayerCharIds = [...linkedPlayerCharIds].filter((id) =>
    context.characters.some(
      (candidate) => candidate.id === id && candidate.visibleToPlayers !== false,
    ),
  )
  const isOnlyVisibleLinkedPlayer =
    !context.assignedCharacterId &&
    visibleLinkedPlayerCharIds.length === 1 &&
    visibleLinkedPlayerCharIds[0] === character.id

  return {
    character,
    canAnswer:
      isPlayerCharacter ||
      isAssignedCharacter ||
      isVisibleCharacter ||
      isOnlyVisibleLinkedPlayer ||
      isPublicCharacter,
  }
}
