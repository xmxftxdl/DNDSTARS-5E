import type { Token } from '../store/maps'
import type { Character } from '../types/character'
import type { EnemyTurnResult } from './enemyAi'
import type { CombatInterruptKind, SharedCombatInterrupt } from './combatInterruptQueue'
import type { CombatTransaction } from './combatTransaction'
import { dnd5eCombatTokenSide } from './opportunityAttacks'
import type { Dnd5eDamageType } from '../rulesets/dnd5e/damageTypes'

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
  trigger?: 'movement' | 'berserker-retaliation' | 'hunter-giant-killer' | 'declarative-reaction-weapon-attack'
  featureName?: string
}
export type OpportunityAttackInterruptResponse = Record<string, unknown> & { useOpportunityAttack: boolean }

export type ProtectionInterruptPayload = Record<string, unknown> & {
  protectorName: string
  featureName?: string
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

export type CounterspellInterruptPayload = Record<string, unknown> & {
  reactorName: string
  casterName: string
  spellName: string
  spellLevel: number
  counterspellSlotLevel: number
  counterspellSlotLevels?: number[]
  abilityCheckDc?: number
}
export type CounterspellInterruptResponse = Record<string, unknown> & {
  useCounterspell: boolean
  counterspellSlotLevel?: number
  abilityCheckTotal?: number
}

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

export type LegendaryResistanceInterruptPayload = Record<string, unknown> & {
  targetName: string
  effectName: string
  total: number
  dc: number
  remainingUses: number
}
export type LegendaryResistanceInterruptResponse = Record<string, unknown> & { useLegendaryResistance: boolean }

export type BardicInspirationRollType = '攻击检定' | '豁免' | '属性检定' | '武器伤害' | '护甲等级'
export type BardicInspirationInterruptPayload = Record<string, unknown> & {
  targetName: string
  /**
   * Authoritative map token that owns the roll being modified. Character ids
   * alone are not enough because an enemy token may retain a character link.
   */
  rollerTokenId?: string
  dieSides: number
  rollType: BardicInspirationRollType
  total: number
  targetNumber: number
  source?: 'held-inspiration' | 'peerless-skill' | 'active-effect'
  sourceLabel?: string
  effectId?: string
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

export interface PluginChoiceInterruptOption extends Record<string, unknown> {
  id: string
  label: string
  description?: string
}

export type PluginChoiceInterruptPayload = Record<string, unknown> & {
  pluginId: string
  featureId: string
  featureName: string
  prompt: string
  audience: 'actor' | 'target' | 'dm'
  options: PluginChoiceInterruptOption[]
  defaultOptionId: string
}
export type PluginChoiceInterruptResponse = Record<string, unknown> & { optionId: string }

/**
 * Reserved, data-only handshake used by assisted Activities and declarative
 * workshop features.  Requiring the DM audience and both fail-closed options
 * prevents an arbitrary plugin choice from pausing the authoritative combat
 * flow or being mistaken for an adjudication receipt.
 */
export function isAssistedDmBoundaryChoice(input: {
  audience: PluginChoiceInterruptPayload['audience']
  options: readonly { id: string; label?: string; description?: string }[]
}): boolean {
  if (input.audience !== 'dm') return false
  const optionIds = new Set(input.options.map((option) => option.id))
  return optionIds.has('dm-apply') && optionIds.has('dm-cancel')
}

export type DmAdjudicationOperation = 'damage' | 'healing' | 'temporary-hit-points'

export type DmAdjudicationConditionTurnBoundary =
  | 'source-turn-start'
  | 'source-turn-end'
  | 'target-turn-start'
  | 'target-turn-end'

export interface DmAdjudicationEffect extends Record<string, unknown> {
  targetTokenId: string
  operation?: DmAdjudicationOperation
  /**
   * When damageType is omitted, amount is the fully adjudicated final damage.
   * When damageType is present, amount is post-save but pre-defense damage and
   * the Host applies immunity, resistance and vulnerability.
   */
  amount?: number
  damageType?: Dnd5eDamageType
  addCondition?: string
  /** Optional finite lifetime for an explicitly added condition. Omit for permanent/manual removal. */
  conditionDurationRounds?: number
  conditionDurationTickOn?: DmAdjudicationConditionTurnBoundary
  removeCondition?: string
}

export interface DmAdjudicationTerrainEffect extends Record<string, unknown> {
  /** Existing authoritative persistent area whose plant terrain is being changed. */
  areaId: string
  /** 1 makes the selected plant terrain ordinary; 2 makes it difficult terrain. */
  movementCostMultiplier: 1 | 2
}

export type DmAdjudicationInterruptPayload = Record<string, unknown> & {
  contextKind?: 'spell' | 'activity-boundary' | 'persistent-area-trigger' | 'map-interaction' | 'basic-action' | 'post-spell-random-table' | 'monster-action' | 'monster-spell' | 'monster-legendary-action'
  actionId: string
  casterName: string
  /** Authoritative caster token used by self-targeting adjudication presets. */
  casterTokenId?: string
  spellId: string
  spellName: string
  spellLevel: number
  slotLevel: number
  castingTime: 'action' | 'bonus-action' | 'reaction' | 'long'
  /** True when the request started outside initiative; casting time is descriptive and spends no combat turn resource. */
  exploration?: true
  /** Whole shared campaign-clock minutes elapsed before the spell takes effect. */
  elapsedCastingMinutes?: number
  ritual?: true
  /** The ordinary audited Headless spell effect will run after confirmation; DM must not duplicate it manually. */
  automatedRitual?: true
  description: string
  concentration: boolean
  suggestedConcentrationRounds?: number
  proposedHit?: boolean
  proposedDamage?: number
  /** Same rolled damage projected through an explicit successful save. */
  proposedDamageOnSaveSuccess?: number
  /** Same rolled damage projected through an explicit failed save. */
  proposedDamageOnSaveFailure?: number
  /** Fixed damage type declared by the authoritative source; prefilled for DM review. */
  proposedDamageType?: Dnd5eDamageType
  proposedSaveSuccess?: boolean
  proposedConditionIds?: string[]
  targetTokenId?: string
  triggerTiming?: 'on-create' | 'on-enter' | 'on-move-distance' | 'on-area-move-impact' | 'turn-start' | 'turn-end' | 'source-turn-start' | 'on-detonate'
  proposedDc?: number
  doorId?: string
  mapInteractionOperation?: string
  randomTableRoll?: number
  randomTableFeatureId?: string
  randomTableOutcomeId?: string
  sourceSpellId?: string
  legendaryActionCost?: number
  legendaryActionPointsBefore?: number
  requiresMonsterSpellSelection?: boolean
  monsterSpellOptions?: readonly {
    spellId: string
    spellName: string
    level: number
    availableSlotLevels: readonly number[]
    resourceLabels: Readonly<Record<string, string>>
  }[]
  /** Host-normalized Sending declaration shown read-only to the DM. */
  sending?: import('./sharedCombatTypes').Dnd5eSendingDeclarationV1
  /** Host-normalized Animal Messenger declaration shown read-only to the DM. */
  animalMessenger?: import('./sharedCombatTypes').Dnd5eAnimalMessengerDeclarationV1
  /** Host-normalized Animate Dead mode and exact remains/controlled-undead targets. */
  animateDead?: import('./sharedCombatTypes').Dnd5eAnimateDeadDeclarationV1
  /** Host-normalized Animate Objects targets and Host-derived object profiles. */
  animateObjects?: import('./sharedCombatTypes').Dnd5eAnimateObjectsDeclarationV1
  /** Host-normalized Creation object, material mix, size and placement. */
  creation?: import('./sharedCombatTypes').Dnd5eCreationDeclarationV1
  /** Host-normalized Create or Destroy Water mode, volume/area and target. */
  createOrDestroyWater?: import('./sharedCombatTypes').Dnd5eCreateOrDestroyWaterDeclarationV1
  /** Host-normalized Sequester target and optional early-ending condition. */
  sequester?: import('./sharedCombatTypes').Dnd5eSequesterDeclarationV1
  /** Host-normalized Word of Recall mode and bounded declaration. */
  wordOfRecall?: import('./sharedCombatTypes').Dnd5eWordOfRecallDeclarationV1
  /** Host-derived destination snapshot. In designation mode this is the proposed current location. */
  wordOfRecallSanctuary?: {
    mapId: string
    mapName: string
    x: number
    y: number
    elevationFeet: number
    sanctuaryName: string
    deityConnection: string
  }
  /** Host-normalized Wish mode and exact player declaration shown read-only to the DM. */
  wish?: import('./sharedCombatTypes').Dnd5eWishDeclarationV1
}

export type DmDamageAdjustment =
  | { mode: 'set'; value: number }
  | { mode: 'add'; value: number }
  | { mode: 'multiply'; value: number }

export type DmAdjudicationInterruptResponse = Record<string, unknown> & {
  decision: 'approved' | 'cancelled'
  effects: DmAdjudicationEffect[]
  /** Explicit map-state effects approved by the DM, currently used by Speak with Plants. */
  terrainEffects?: DmAdjudicationTerrainEffect[]
  note?: string
  concentrationRounds?: number
  hitOverride?: boolean
  damageAdjustment?: DmDamageAdjustment
  saveSuccessOverride?: boolean
  blockedConditionIds?: string[]
  useLegendaryResistance?: boolean
  adjustedDc?: number
  mapInteractionOverride?: 'roll' | 'success' | 'failure'
  selectedMonsterSpellId?: string
  selectedMonsterSpellSlotLevel?: number
  /** Host-authored Sending delivery result; validated again before resources are spent. */
  sending?: import('./sharedCombatTypes').Dnd5eSendingResolutionV1
  /** Host confirmation of Animal Messenger's visibility and previously-visited destination gates. */
  animalMessenger?: import('./sharedCombatTypes').Dnd5eAnimalMessengerResolutionV1
  /** Host confirmation of Animate Dead's displayed target conversion/control plan. */
  animateDead?: import('./sharedCombatTypes').Dnd5eAnimateDeadResolutionV1
  /** Host confirmation of Animate Objects' displayed weighted replacement plan. */
  animateObjects?: import('./sharedCombatTypes').Dnd5eAnimateObjectsResolutionV1
  /** Host confirmation for Sequester's creature-willingness boundary. */
  sequester?: import('./sharedCombatTypes').Dnd5eSequesterResolutionV1
  /** Host confirmation for Word of Recall's consecration or willing-creature boundary. */
  wordOfRecall?: import('./sharedCombatTypes').Dnd5eWordOfRecallResolutionV1
}

export type RollConfirmationInterruptPayload = Record<string, unknown> & {
  rollId: string
  label: string
  targetName: string
  originalValue: number
  visibility: 'public' | 'dm-only'
  reason?: 'enemy-feature' | 'dm-secret-roll'
  eligibleModifiers?: Array<{
    characterId: string
    featureId: string
    featureLabel: string
    modifierKind?: 'replace-d20' | 'adjust-d20' | 'choice-reroll'
    sourceTokenId?: string
    dieSides?: number
    fixedAmount?: number
    replacementValues?: number[]
    direction?: 'add' | 'subtract'
    rerollScope?: 'self-roll' | 'attack-against-self'
    additionalDice?: 1 | 2
    selectionPolicy?: 'owner-chooses' | 'highest' | 'lowest' | 'must-use-latest'
    resourceCosts?: Array<{ resourceKey: string; amount: number }>
    decisionRequired?: boolean
  }>
  rollOptions?: { contributionId: string; values: number[] }
  allowDmOverride?: boolean
  transaction: CombatTransaction
}

export type RollConfirmationInterruptResponse = Record<string, unknown> & {
  decision: 'continue' | 'cancelled'
  finalValue?: number
  acceptedContributionId?: string
  adjustment?: {
    sourceId: string
    featureId: string
    direction: 'add' | 'subtract'
    roll: number
  }
  choiceReroll?: {
    characterId: string
    featureId: string
    resourceCosts: Array<{ resourceKey: string; amount: number }>
    scope: 'self-roll' | 'attack-against-self'
    originalValue: number
    rerollValue: number
    rerollValues?: number[]
    selectedIndex?: number
    selectionPolicy?: 'owner-chooses' | 'highest' | 'lowest' | 'must-use-latest'
    selectedValue: number
  }
  dmOverrideApplied?: boolean
  transaction?: CombatTransaction
}

export interface CombatInterruptPayloadMap {
  dodge: DodgeInterruptPayload
  'stable-mind': StableMindInterruptPayload
  'gale-combo': GaleComboInterruptPayload
  'agile-leap': AgileLeapInterruptPayload
  'opportunity-attack': OpportunityAttackInterruptPayload
  protection: ProtectionInterruptPayload
  'shield-spell': ShieldSpellInterruptPayload
  counterspell: CounterspellInterruptPayload
  'uncanny-dodge': UncannyDodgeInterruptPayload
  'deflect-missiles': DeflectMissilesInterruptPayload
  'saving-throw-reroll': SavingThrowRerollInterruptPayload
  'legendary-resistance': LegendaryResistanceInterruptPayload
  'bardic-inspiration': BardicInspirationInterruptPayload
  'cutting-words': CuttingWordsInterruptPayload
  'dark-ones-own-luck': DarkOnesOwnLuckInterruptPayload
  'stroke-of-luck': StrokeOfLuckInterruptPayload
  'empowered-spell': EmpoweredSpellInterruptPayload
  'stand-against-tide': StandAgainstTideInterruptPayload
  'plugin-choice': PluginChoiceInterruptPayload
  'dm-adjudication': DmAdjudicationInterruptPayload
  'roll-confirmation': RollConfirmationInterruptPayload
}

export interface CombatInterruptResponseMap {
  dodge: DodgeInterruptResponse
  'stable-mind': StableMindInterruptResponse
  'gale-combo': GaleComboInterruptResponse
  'agile-leap': AgileLeapInterruptResponse
  'opportunity-attack': OpportunityAttackInterruptResponse
  protection: ProtectionInterruptResponse
  'shield-spell': ShieldSpellInterruptResponse
  counterspell: CounterspellInterruptResponse
  'uncanny-dodge': UncannyDodgeInterruptResponse
  'deflect-missiles': DeflectMissilesInterruptResponse
  'saving-throw-reroll': SavingThrowRerollInterruptResponse
  'legendary-resistance': LegendaryResistanceInterruptResponse
  'bardic-inspiration': BardicInspirationInterruptResponse
  'cutting-words': CuttingWordsInterruptResponse
  'dark-ones-own-luck': DarkOnesOwnLuckInterruptResponse
  'stroke-of-luck': StrokeOfLuckInterruptResponse
  'empowered-spell': EmpoweredSpellInterruptResponse
  'stand-against-tide': StandAgainstTideInterruptResponse
  'plugin-choice': PluginChoiceInterruptResponse
  'dm-adjudication': DmAdjudicationInterruptResponse
  'roll-confirmation': RollConfirmationInterruptResponse
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
  roomMemberId?: string
  tokens?: Token[]
  authority?: 'player' | 'dm'
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
    case 'counterspell':
      return { useCounterspell: false } as CombatInterruptResponseMap[K]
    case 'uncanny-dodge':
      return { useUncannyDodge: false } as CombatInterruptResponseMap[K]
    case 'deflect-missiles':
      return { accept: false } as CombatInterruptResponseMap[K]
    case 'saving-throw-reroll':
      return { useSavingThrowReroll: false } as CombatInterruptResponseMap[K]
    case 'legendary-resistance':
      return { useLegendaryResistance: false } as CombatInterruptResponseMap[K]
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
    case 'plugin-choice':
      return { optionId: '' } as CombatInterruptResponseMap[K]
    case 'dm-adjudication':
      return { decision: 'cancelled', effects: [] } as unknown as CombatInterruptResponseMap[K]
    case 'roll-confirmation':
      return { decision: 'cancelled' } as CombatInterruptResponseMap[K]
  }
}

export function isCombatInterruptKind<K extends CombatInterruptKind>(
  interrupt: SharedCombatInterrupt,
  kind: K,
): interrupt is CombatInterruptByKind<K> {
  return interrupt.kind === kind
}

export function resolveCombatInterruptCharacter(
  interrupt: Pick<SharedCombatInterrupt, 'kind' | 'actorCharId' | 'targetCharId' | 'payload'>,
  characters: Character[],
): Character | undefined {
  const pluginAudience = interrupt.kind === 'plugin-choice'
    ? (interrupt.payload as Partial<PluginChoiceInterruptPayload>).audience
    : undefined
  const characterId = pluginAudience === 'target'
    ? interrupt.targetCharId
    : pluginAudience === 'actor' || pluginAudience === 'dm'
      ? interrupt.actorCharId
      : interrupt.kind === 'gale-combo' || interrupt.kind === 'opportunity-attack' || interrupt.kind === 'protection' || interrupt.kind === 'counterspell' || interrupt.kind === 'cutting-words' || interrupt.kind === 'stroke-of-luck' || interrupt.kind === 'empowered-spell' || interrupt.kind === 'dm-adjudication'
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
  if (
    interrupt.kind === 'dm-adjudication' || interrupt.kind === 'roll-confirmation' || interrupt.kind === 'legendary-resistance' ||
    (interrupt.kind === 'plugin-choice' && interrupt.payload.audience === 'dm')
  ) return { character, canAnswer: false }
  if (!character || (character.currentHp <= 0 && interrupt.kind !== 'bardic-inspiration')) {
    return { character, canAnswer: false }
  }

  if (interrupt.kind === 'bardic-inspiration' && interrupt.payload.rollerTokenId) {
    const rollerToken = context.tokens?.find(
      (token) => token.id === interrupt.payload.rollerTokenId,
    )
    // The side controlling the actual d20 owns this decision. In particular,
    // a character link on a DM-controlled monster must never route that
    // monster's attack/save prompt to a player client.
    if (rollerToken && dnd5eCombatTokenSide(rollerToken) === 'enemy' && context.authority !== 'dm') {
      return { character, canAnswer: false }
    }
  }

  const isOwnedRoomCharacter =
    !!context.roomMemberId && character.roomMemberId === context.roomMemberId
  const isDmControlledCharacter = context.tokens?.some(
    (token) => token.type === 'enemy' && token.characterId === character.id,
  ) ?? false
  if (isDmControlledCharacter && context.authority !== 'dm' && !isOwnedRoomCharacter) {
    return { character, canAnswer: false }
  }

  const visibleIds = new Set(context.visibleCharacters.map((visible) => visible.id))
  const isPlayerCharacter = character.id === context.playerCharId
  const isAssignedCharacter = character.id === context.assignedCharacterId
  const isVisibleCharacter = visibleIds.has(character.id)
  const isPublicCharacter = !character.dmNotes

  if (interrupt.kind === 'plugin-choice') {
    return {
      character,
      canAnswer: isOwnedRoomCharacter || (
        !character.roomMemberId && (isPlayerCharacter || isAssignedCharacter)
      ),
    }
  }

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
