import type { Character } from '../types/character'
import {
  isCombatInterruptExpired,
  type CombatInterruptKind,
  type SharedCombatInterrupt,
  type SharedCombatInterruptQueueState,
} from './combatInterruptQueue'
import {
  isCombatInterruptKind,
  resolveCombatInterruptAnswerCandidate,
  type CombatInterruptAnswerContext,
  type CombatInterruptByKind,
} from './combatInterruptProtocol'

export type CombatInterruptSuppression = Partial<Record<CombatInterruptKind, ReadonlySet<string>>>

export interface CombatInterruptPrompt<K extends CombatInterruptKind> {
  interrupt: CombatInterruptByKind<K>
  character: Character
}

export interface CombatInterruptPromptSelection {
  dodge?: CombatInterruptPrompt<'dodge'>
  'stable-mind'?: CombatInterruptPrompt<'stable-mind'>
  'gale-combo'?: CombatInterruptPrompt<'gale-combo'>
  'agile-leap'?: CombatInterruptPrompt<'agile-leap'>
  'opportunity-attack'?: CombatInterruptPrompt<'opportunity-attack'>
  protection?: CombatInterruptPrompt<'protection'>
  'shield-spell'?: CombatInterruptPrompt<'shield-spell'>
  counterspell?: CombatInterruptPrompt<'counterspell'>
  'uncanny-dodge'?: CombatInterruptPrompt<'uncanny-dodge'>
  'deflect-missiles'?: CombatInterruptPrompt<'deflect-missiles'>
  'saving-throw-reroll'?: CombatInterruptPrompt<'saving-throw-reroll'>
  'bardic-inspiration'?: CombatInterruptPrompt<'bardic-inspiration'>
  'cutting-words'?: CombatInterruptPrompt<'cutting-words'>
  'dark-ones-own-luck'?: CombatInterruptPrompt<'dark-ones-own-luck'>
  'stroke-of-luck'?: CombatInterruptPrompt<'stroke-of-luck'>
  'empowered-spell'?: CombatInterruptPrompt<'empowered-spell'>
  'stand-against-tide'?: CombatInterruptPrompt<'stand-against-tide'>
  'plugin-choice'?: CombatInterruptPrompt<'plugin-choice'>
}

export interface SharedDodgePromptView {
  id: string
  result: CombatInterruptByKind<'dodge'>['payload']['result']
  targetChar: Character
  expiresAt?: number
}

export interface SharedStableMindPromptView {
  id: string
  targetChar: Character
  fullDamage: number
  damageAfterSave: number
  saveD20: number
  saveMod: number
  saveTotal: number
  dc: number
  expiresAt?: number
}

export interface SharedGaleComboPromptView {
  id: string
  casterChar: Character
  triggerLabel: string
  expiresAt?: number
}

export interface SharedAgileLeapPromptView {
  id: string
  targetChar: Character
  feet: number
  uses: number
  maxUses: number
  expiresAt?: number
}

export interface SharedOpportunityAttackPromptView {
  id: string
  attackerChar: Character
  targetName: string
  trigger?: CombatInterruptByKind<'opportunity-attack'>['payload']['trigger']
  expiresAt?: number
}

export interface SharedUncannyDodgePromptView {
  id: string
  targetChar: Character
  attackerName: string
  attackName: string
  expiresAt?: number
}

export interface SharedDeflectMissilesPromptView {
  id: string
  targetChar: Character
  phase: 'reduce' | 'return'
  attackerName: string
  attackName: string
  kiCurrent?: number
  expiresAt?: number
}

export interface SharedProtectionPromptView {
  id: string
  protectorChar: Character
  attackerName: string
  targetName: string
  attackName: string
  expiresAt?: number
}

export interface SharedShieldSpellPromptView {
  id: string
  targetChar: Character
  attackerName: string
  attackName: string
  attackTotal?: number
  armorClass?: number
  magicMissile?: boolean
  expiresAt?: number
}

export interface SharedCounterspellPromptView {
  id: string
  reactorChar: Character
  casterName: string
  spellName: string
  spellLevel: number
  counterspellSlotLevel: number
  abilityCheckDc?: number
  expiresAt?: number
}

export interface SharedSavingThrowRerollPromptView {
  id: string
  targetChar: Character
  featureName: string
  total: number
  dc: number
  expiresAt?: number
}

export interface SharedBardicInspirationPromptView {
  id: string
  targetChar: Character
  dieSides: number
  rollType: CombatInterruptByKind<'bardic-inspiration'>['payload']['rollType']
  total: number
  targetNumber: number
  source?: 'held-inspiration' | 'peerless-skill'
  expiresAt?: number
}

export interface SharedCuttingWordsPromptView {
  id: string
  bardChar: Character
  attackerName: string
  targetName: string
  attackName: string
  phase: 'attack' | 'damage' | 'ability-check'
  dieSides: number
  total: number
  targetNumber?: number
  expiresAt?: number
}

export interface SharedDarkOnesOwnLuckPromptView {
  id: string
  targetChar: Character
  rollType: CombatInterruptByKind<'dark-ones-own-luck'>['payload']['rollType']
  total: number
  targetNumber?: number
  expiresAt?: number
}

export interface SharedStrokeOfLuckPromptView {
  id: string
  actorChar: Character
  targetName: string
  attackName: string
  total: number
  armorClass: number
  rollType?: 'attack' | 'ability-check'
  expiresAt?: number
}

export interface SharedEmpoweredSpellPromptView {
  id: string
  casterChar: Character
  spellName: string
  maximumDice: number
  groups: CombatInterruptByKind<'empowered-spell'>['payload']['groups']
  expiresAt?: number
}

export interface SharedStandAgainstTidePromptView {
  id: string
  hunterChar: Character
  attackerName: string
  attackName: string
  candidates: CombatInterruptByKind<'stand-against-tide'>['payload']['candidates']
  expiresAt?: number
}

export interface SharedPluginChoicePromptView {
  id: string
  character?: Character
  payload: CombatInterruptByKind<'plugin-choice'>['payload']
  expiresAt?: number
}

export interface CombatInterruptPromptViews {
  dodge?: SharedDodgePromptView
  stableMind?: SharedStableMindPromptView
  galeCombo?: SharedGaleComboPromptView
  agileLeap?: SharedAgileLeapPromptView
  opportunityAttack?: SharedOpportunityAttackPromptView
  protection?: SharedProtectionPromptView
  shieldSpell?: SharedShieldSpellPromptView
  counterspell?: SharedCounterspellPromptView
  uncannyDodge?: SharedUncannyDodgePromptView
  deflectMissiles?: SharedDeflectMissilesPromptView
  savingThrowReroll?: SharedSavingThrowRerollPromptView
  bardicInspiration?: SharedBardicInspirationPromptView
  cuttingWords?: SharedCuttingWordsPromptView
  darkOnesOwnLuck?: SharedDarkOnesOwnLuckPromptView
  strokeOfLuck?: SharedStrokeOfLuckPromptView
  empoweredSpell?: SharedEmpoweredSpellPromptView
  standAgainstTide?: SharedStandAgainstTidePromptView
  pluginChoice?: SharedPluginChoicePromptView
}

function findAnswerableInterrupt<K extends CombatInterruptKind>(
  pendingInterrupts: SharedCombatInterrupt[],
  kind: K,
  suppressedIds: ReadonlySet<string> | undefined,
  answerContext: CombatInterruptAnswerContext,
): CombatInterruptPrompt<K> | undefined {
  const interrupt = pendingInterrupts.find(
    (candidate): candidate is CombatInterruptByKind<K> =>
      isCombatInterruptKind(candidate, kind) && !suppressedIds?.has(candidate.id),
  )
  if (!interrupt) return undefined

  const candidate = resolveCombatInterruptAnswerCandidate(interrupt, answerContext)
  if (!candidate.canAnswer || !candidate.character) return undefined
  return { interrupt, character: candidate.character }
}

export function resolveCombatInterruptPromptSelection(input: {
  queue: SharedCombatInterruptQueueState | null | undefined
  mapId: string
  now: number
  answerContext: CombatInterruptAnswerContext
  suppressed: CombatInterruptSuppression
}): CombatInterruptPromptSelection {
  const queue = input.queue
  if (!queue || queue.mapId !== input.mapId) return {}
  const pendingInterrupts = queue.interrupts.filter(
    (interrupt) =>
      interrupt.mapId === input.mapId &&
      interrupt.status === 'pending' &&
      !isCombatInterruptExpired(interrupt, input.now),
  )

  return {
    dodge: findAnswerableInterrupt(pendingInterrupts, 'dodge', input.suppressed.dodge, input.answerContext),
    'stable-mind': findAnswerableInterrupt(
      pendingInterrupts,
      'stable-mind',
      input.suppressed['stable-mind'],
      input.answerContext,
    ),
    'gale-combo': findAnswerableInterrupt(
      pendingInterrupts,
      'gale-combo',
      input.suppressed['gale-combo'],
      input.answerContext,
    ),
    'agile-leap': findAnswerableInterrupt(
      pendingInterrupts,
      'agile-leap',
      input.suppressed['agile-leap'],
      input.answerContext,
    ),
    'opportunity-attack': findAnswerableInterrupt(
      pendingInterrupts,
      'opportunity-attack',
      input.suppressed['opportunity-attack'],
      input.answerContext,
    ),
    protection: findAnswerableInterrupt(
      pendingInterrupts,
      'protection',
      input.suppressed.protection,
      input.answerContext,
    ),
    'shield-spell': findAnswerableInterrupt(
      pendingInterrupts,
      'shield-spell',
      input.suppressed['shield-spell'],
      input.answerContext,
    ),
    counterspell: findAnswerableInterrupt(
      pendingInterrupts,
      'counterspell',
      input.suppressed.counterspell,
      input.answerContext,
    ),
    'uncanny-dodge': findAnswerableInterrupt(
      pendingInterrupts,
      'uncanny-dodge',
      input.suppressed['uncanny-dodge'],
      input.answerContext,
    ),
    'deflect-missiles': findAnswerableInterrupt(
      pendingInterrupts,
      'deflect-missiles',
      input.suppressed['deflect-missiles'],
      input.answerContext,
    ),
    'saving-throw-reroll': findAnswerableInterrupt(
      pendingInterrupts,
      'saving-throw-reroll',
      input.suppressed['saving-throw-reroll'],
      input.answerContext,
    ),
    'bardic-inspiration': findAnswerableInterrupt(
      pendingInterrupts,
      'bardic-inspiration',
      input.suppressed['bardic-inspiration'],
      input.answerContext,
    ),
    'cutting-words': findAnswerableInterrupt(
      pendingInterrupts,
      'cutting-words',
      input.suppressed['cutting-words'],
      input.answerContext,
    ),
    'dark-ones-own-luck': findAnswerableInterrupt(
      pendingInterrupts,
      'dark-ones-own-luck',
      input.suppressed['dark-ones-own-luck'],
      input.answerContext,
    ),
    'stroke-of-luck': findAnswerableInterrupt(
      pendingInterrupts,
      'stroke-of-luck',
      input.suppressed['stroke-of-luck'],
      input.answerContext,
    ),
    'empowered-spell': findAnswerableInterrupt(
      pendingInterrupts,
      'empowered-spell',
      input.suppressed['empowered-spell'],
      input.answerContext,
    ),
    'stand-against-tide': findAnswerableInterrupt(
      pendingInterrupts,
      'stand-against-tide',
      input.suppressed['stand-against-tide'],
      input.answerContext,
    ),
    'plugin-choice': findAnswerableInterrupt(
      pendingInterrupts,
      'plugin-choice',
      input.suppressed['plugin-choice'],
      input.answerContext,
    ),
  }
}

export function buildCombatInterruptPromptViews(
  selection: CombatInterruptPromptSelection,
): CombatInterruptPromptViews {
  const dodge = selection.dodge
  const stableMind = selection['stable-mind']
  const galeCombo = selection['gale-combo']
  const agileLeap = selection['agile-leap']
  const opportunityAttack = selection['opportunity-attack']
  const protection = selection.protection
  const shieldSpell = selection['shield-spell']
  const counterspell = selection.counterspell
  const uncannyDodge = selection['uncanny-dodge']
  const deflectMissiles = selection['deflect-missiles']
  const savingThrowReroll = selection['saving-throw-reroll']
  const bardicInspiration = selection['bardic-inspiration']
  const cuttingWords = selection['cutting-words']
  const darkOnesOwnLuck = selection['dark-ones-own-luck']
  const strokeOfLuck = selection['stroke-of-luck']
  const empoweredSpell = selection['empowered-spell']
  const standAgainstTide = selection['stand-against-tide']
  const pluginChoice = selection['plugin-choice']

  return {
    dodge: dodge
      ? {
          id: dodge.interrupt.id,
          result: dodge.interrupt.payload.result,
          targetChar: dodge.character,
          expiresAt: dodge.interrupt.expiresAt,
        }
      : undefined,
    stableMind: stableMind
      ? {
          id: stableMind.interrupt.id,
          targetChar: stableMind.character,
          fullDamage: stableMind.interrupt.payload.fullDamage,
          damageAfterSave: stableMind.interrupt.payload.damageAfterSave,
          saveD20: stableMind.interrupt.payload.saveD20,
          saveMod: stableMind.interrupt.payload.saveMod,
          saveTotal: stableMind.interrupt.payload.saveTotal,
          dc: stableMind.interrupt.payload.dc,
          expiresAt: stableMind.interrupt.expiresAt,
        }
      : undefined,
    galeCombo: galeCombo
      ? {
          id: galeCombo.interrupt.id,
          casterChar: galeCombo.character,
          triggerLabel: galeCombo.interrupt.payload.triggerLabel,
          expiresAt: galeCombo.interrupt.expiresAt,
        }
      : undefined,
    agileLeap: agileLeap
      ? {
          id: agileLeap.interrupt.id,
          targetChar: agileLeap.character,
          feet: agileLeap.interrupt.payload.feet,
          uses: agileLeap.interrupt.payload.uses,
          maxUses: agileLeap.interrupt.payload.maxUses,
          expiresAt: agileLeap.interrupt.expiresAt,
        }
      : undefined,
    opportunityAttack: opportunityAttack
      ? {
          id: opportunityAttack.interrupt.id,
          attackerChar: opportunityAttack.character,
          targetName: opportunityAttack.interrupt.payload.targetName,
          trigger: opportunityAttack.interrupt.payload.trigger,
          expiresAt: opportunityAttack.interrupt.expiresAt,
        }
      : undefined,
    protection: protection
      ? {
          id: protection.interrupt.id,
          protectorChar: protection.character,
          attackerName: protection.interrupt.payload.attackerName,
          targetName: protection.interrupt.payload.targetName,
          attackName: protection.interrupt.payload.attackName,
          expiresAt: protection.interrupt.expiresAt,
        }
      : undefined,
    shieldSpell: shieldSpell
      ? {
          id: shieldSpell.interrupt.id,
          targetChar: shieldSpell.character,
          attackerName: shieldSpell.interrupt.payload.attackerName,
          attackName: shieldSpell.interrupt.payload.attackName,
          attackTotal: shieldSpell.interrupt.payload.attackTotal,
          armorClass: shieldSpell.interrupt.payload.armorClass,
          magicMissile: shieldSpell.interrupt.payload.magicMissile,
          expiresAt: shieldSpell.interrupt.expiresAt,
        }
      : undefined,
    counterspell: counterspell
      ? {
          id: counterspell.interrupt.id,
          reactorChar: counterspell.character,
          casterName: counterspell.interrupt.payload.casterName,
          spellName: counterspell.interrupt.payload.spellName,
          spellLevel: counterspell.interrupt.payload.spellLevel,
          counterspellSlotLevel: counterspell.interrupt.payload.counterspellSlotLevel,
          abilityCheckDc: counterspell.interrupt.payload.abilityCheckDc,
          expiresAt: counterspell.interrupt.expiresAt,
        }
      : undefined,
    uncannyDodge: uncannyDodge
      ? {
          id: uncannyDodge.interrupt.id,
          targetChar: uncannyDodge.character,
          attackerName: uncannyDodge.interrupt.payload.attackerName,
          attackName: uncannyDodge.interrupt.payload.attackName,
          expiresAt: uncannyDodge.interrupt.expiresAt,
        }
      : undefined,
    deflectMissiles: deflectMissiles
      ? {
          id: deflectMissiles.interrupt.id,
          targetChar: deflectMissiles.character,
          phase: deflectMissiles.interrupt.payload.phase,
          attackerName: deflectMissiles.interrupt.payload.attackerName,
          attackName: deflectMissiles.interrupt.payload.attackName,
          kiCurrent: deflectMissiles.interrupt.payload.kiCurrent,
          expiresAt: deflectMissiles.interrupt.expiresAt,
        }
      : undefined,
    savingThrowReroll: savingThrowReroll
      ? {
          id: savingThrowReroll.interrupt.id,
          targetChar: savingThrowReroll.character,
          featureName: savingThrowReroll.interrupt.payload.featureName,
          total: savingThrowReroll.interrupt.payload.total,
          dc: savingThrowReroll.interrupt.payload.dc,
          expiresAt: savingThrowReroll.interrupt.expiresAt,
        }
      : undefined,
    bardicInspiration: bardicInspiration
      ? {
          id: bardicInspiration.interrupt.id,
          targetChar: bardicInspiration.character,
          dieSides: bardicInspiration.interrupt.payload.dieSides,
          rollType: bardicInspiration.interrupt.payload.rollType,
          total: bardicInspiration.interrupt.payload.total,
          targetNumber: bardicInspiration.interrupt.payload.targetNumber,
          source: bardicInspiration.interrupt.payload.source,
          expiresAt: bardicInspiration.interrupt.expiresAt,
        }
      : undefined,
    cuttingWords: cuttingWords
      ? {
          id: cuttingWords.interrupt.id,
          bardChar: cuttingWords.character,
          attackerName: cuttingWords.interrupt.payload.attackerName,
          targetName: cuttingWords.interrupt.payload.targetName,
          attackName: cuttingWords.interrupt.payload.attackName,
          phase: cuttingWords.interrupt.payload.phase,
          dieSides: cuttingWords.interrupt.payload.dieSides,
          total: cuttingWords.interrupt.payload.total,
          targetNumber: cuttingWords.interrupt.payload.targetNumber,
          expiresAt: cuttingWords.interrupt.expiresAt,
        }
      : undefined,
    darkOnesOwnLuck: darkOnesOwnLuck
      ? {
          id: darkOnesOwnLuck.interrupt.id,
          targetChar: darkOnesOwnLuck.character,
          rollType: darkOnesOwnLuck.interrupt.payload.rollType,
          total: darkOnesOwnLuck.interrupt.payload.total,
          targetNumber: darkOnesOwnLuck.interrupt.payload.targetNumber,
          expiresAt: darkOnesOwnLuck.interrupt.expiresAt,
        }
      : undefined,
    strokeOfLuck: strokeOfLuck
      ? {
          id: strokeOfLuck.interrupt.id,
          actorChar: strokeOfLuck.character,
          targetName: strokeOfLuck.interrupt.payload.targetName,
          attackName: strokeOfLuck.interrupt.payload.attackName,
          total: strokeOfLuck.interrupt.payload.total,
          armorClass: strokeOfLuck.interrupt.payload.armorClass,
          rollType: strokeOfLuck.interrupt.payload.rollType,
          expiresAt: strokeOfLuck.interrupt.expiresAt,
        }
      : undefined,
    empoweredSpell: empoweredSpell
      ? {
          id: empoweredSpell.interrupt.id,
          casterChar: empoweredSpell.character,
          spellName: empoweredSpell.interrupt.payload.spellName,
          maximumDice: empoweredSpell.interrupt.payload.maximumDice,
          groups: empoweredSpell.interrupt.payload.groups,
          expiresAt: empoweredSpell.interrupt.expiresAt,
        }
      : undefined,
    standAgainstTide: standAgainstTide
      ? {
          id: standAgainstTide.interrupt.id,
          hunterChar: standAgainstTide.character,
          attackerName: standAgainstTide.interrupt.payload.attackerName,
          attackName: standAgainstTide.interrupt.payload.attackName,
          candidates: standAgainstTide.interrupt.payload.candidates,
          expiresAt: standAgainstTide.interrupt.expiresAt,
        }
      : undefined,
    pluginChoice: pluginChoice
      ? {
          id: pluginChoice.interrupt.id,
          character: pluginChoice.character,
          payload: pluginChoice.interrupt.payload,
          expiresAt: pluginChoice.interrupt.expiresAt,
        }
      : undefined,
  }
}
