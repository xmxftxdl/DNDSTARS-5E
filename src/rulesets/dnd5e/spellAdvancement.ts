import type {
  Character,
  Dnd5eAdvancementSpellSelectionsV1,
} from '../../types/character'
import {
  dnd5eClassProgression,
  dnd5ePactSlotLevel,
  type Dnd5eClassId,
} from './classes'
import { registeredDnd5ePluginSpells } from './pluginApi'
import {
  dnd5eSpellbookEntriesWithPlugins,
  type Dnd5eSpellbookEntry,
} from './spellbook'
import {
  dnd5eEffectiveSpellcastingSourceForClassSnapshot,
  dnd5ePatchEffectiveSpellSelections,
} from './subclassSpellcasting'

const WIZARD_SPELLBOOK_KEY = 'wizard-spellbook'

export interface Dnd5eSpellAdvancementPlan {
  classId: Dnd5eClassId
  className: string
  fromClassLevel: number
  toClassLevel: number
  cantripSelectionKey: string
  spellSelectionKey: string
  previousCantrips: readonly string[]
  previousKnownSpells: readonly string[]
  previousWizardSpellbook: readonly string[]
  targetCantripCount: number
  targetKnownSpellCount?: number
  targetWizardSpellbookCount?: number
  canReplaceCantrip: boolean
  canReplaceKnownSpell: boolean
  highestSpellLevel: number
  newlyUnlockedSpellLevels: readonly number[]
  cantripOptions: readonly Dnd5eSpellbookEntry[]
  spellOptions: readonly Dnd5eSpellbookEntry[]
  defaultSelections: Dnd5eAdvancementSpellSelectionsV1
  selectionRequired: boolean
}

export type Dnd5eSpellAdvancementFailure =
  | 'missing-spell-choice'
  | 'invalid-spell-choice'

interface BuildSpellAdvancementPlanInput {
  classId: Dnd5eClassId
  fromClassLevel: number
  toClassLevel: number
  subclassId?: string
  selections?: Readonly<Record<string, readonly string[]>>
}

function unique(ids: readonly string[] | undefined): string[] {
  return [...new Set(ids ?? [])]
}

function highestSpellLevel(
  classId: Dnd5eClassId,
  classLevel: number,
  subclassId?: string,
): number {
  if (classLevel < 1) return 0
  const source = dnd5eEffectiveSpellcastingSourceForClassSnapshot(
    classId,
    classLevel,
    subclassId,
  )
  if (!source?.definition.spellcasting) return 0
  if (source.definition.spellcasting.kind === 'pact') return dnd5ePactSlotLevel(classLevel)
  const progression = dnd5eClassProgression(source.definition)[classLevel - 1]
  return progression?.spellSlots.length ?? 0
}

function bardOrdinarySpellLimit(classLevel: number, spellsKnown: number): number {
  const magicalSecrets = classLevel >= 18 ? 6 : classLevel >= 14 ? 4 : classLevel >= 10 ? 2 : 0
  return Math.max(0, spellsKnown - magicalSecrets)
}

export function buildDnd5eSpellAdvancementPlanFromSelections(
  input: BuildSpellAdvancementPlanInput,
): Dnd5eSpellAdvancementPlan | undefined {
  const fromClassLevel = Math.max(0, Math.floor(input.fromClassLevel))
  const toClassLevel = Math.max(0, Math.floor(input.toClassLevel))
  if (toClassLevel !== fromClassLevel + 1 || toClassLevel > 20) return undefined
  const source = dnd5eEffectiveSpellcastingSourceForClassSnapshot(
    input.classId,
    toClassLevel,
    input.subclassId,
  )
  const spellcasting = source?.definition.spellcasting
  if (!source || !spellcasting) return undefined

  const progression = dnd5eClassProgression(source.definition)[toClassLevel - 1]
  if (!progression) return undefined
  const selections = input.selections ?? {}
  const previousCantrips = unique(selections[source.cantripSelectionKey])
  const previousKnownSpells = unique(selections[source.spellSelectionKey])
  const previousWizardSpellbook = input.classId === 'wizard'
    ? unique(selections[WIZARD_SPELLBOOK_KEY])
    : []
  const targetCantripCount = progression.cantripsKnown ?? 0
  const knownCaster =
    spellcasting.kind === 'full-known' ||
    spellcasting.kind === 'half-known' ||
    spellcasting.kind === 'one-third-known' ||
    spellcasting.kind === 'pact'
  const rawKnownCount = knownCaster ? progression.spellsKnown ?? 0 : undefined
  const targetKnownSpellCount = rawKnownCount == null
    ? undefined
    : input.classId === 'bard'
      ? bardOrdinarySpellLimit(toClassLevel, rawKnownCount)
      : rawKnownCount
  const targetWizardSpellbookCount = input.classId === 'wizard'
    ? Math.max(
        previousWizardSpellbook.length + (fromClassLevel === 0 ? 6 : 2),
        6 + Math.max(0, toClassLevel - 1) * 2,
      )
    : undefined
  const targetHighestSpellLevel = highestSpellLevel(
    input.classId,
    toClassLevel,
    input.subclassId,
  )
  const previousHighestSpellLevel = highestSpellLevel(
    input.classId,
    fromClassLevel,
    input.subclassId,
  )
  const catalog = dnd5eSpellbookEntriesWithPlugins([], registeredDnd5ePluginSpells())
  const classOptions = catalog.filter((spell) =>
    (spell.classes as readonly string[]).includes(source.spellListClassId))
  const cantripOptions = classOptions.filter((spell) => spell.level === 0)
  const spellOptions = classOptions.filter((spell) =>
    spell.level > 0 && spell.level <= targetHighestSpellLevel)
  const defaultSelections: Dnd5eAdvancementSpellSelectionsV1 = {
    cantrips: previousCantrips.slice(0, targetCantripCount),
    ...(targetKnownSpellCount == null
      ? {}
      : { knownSpells: previousKnownSpells.slice(0, targetKnownSpellCount) }),
    ...(targetWizardSpellbookCount == null
      ? {}
      : { wizardSpellbook: previousWizardSpellbook.slice(0, targetWizardSpellbookCount) }),
  }

  return {
    classId: input.classId,
    className: source.definition.name,
    fromClassLevel,
    toClassLevel,
    cantripSelectionKey: source.cantripSelectionKey,
    spellSelectionKey: source.spellSelectionKey,
    previousCantrips,
    previousKnownSpells,
    previousWizardSpellbook,
    targetCantripCount,
    targetKnownSpellCount,
    targetWizardSpellbookCount,
    canReplaceCantrip: fromClassLevel > 0 && previousCantrips.length > 0,
    canReplaceKnownSpell:
      fromClassLevel > 0 &&
      targetKnownSpellCount != null &&
      previousKnownSpells.length > 0,
    highestSpellLevel: targetHighestSpellLevel,
    newlyUnlockedSpellLevels: Array.from(
      { length: Math.max(0, targetHighestSpellLevel - previousHighestSpellLevel) },
      (_, index) => previousHighestSpellLevel + index + 1,
    ),
    cantripOptions,
    spellOptions,
    defaultSelections,
    selectionRequired:
      targetCantripCount > 0 ||
      (
        targetKnownSpellCount != null &&
        (targetKnownSpellCount > 0 || previousKnownSpells.length > 0)
      ) ||
      (
        targetWizardSpellbookCount != null &&
        (targetWizardSpellbookCount > 0 || previousWizardSpellbook.length > 0)
      ),
  }
}

export function buildDnd5eSpellAdvancementPlan(
  character: Character,
  classId: Dnd5eClassId,
  fromClassLevel: number,
  toClassLevel: number,
  subclassId?: string,
): Dnd5eSpellAdvancementPlan | undefined {
  const source = dnd5eEffectiveSpellcastingSourceForClassSnapshot(
    classId,
    Math.max(1, toClassLevel),
    subclassId,
  )
  const selections = source?.subclass && source.classId === 'fighter'
    ? character.dnd5eClassChoices?.fighter?.extensionChoices
    : character.dnd5eClassChoices?.classes?.[classId]?.selections
  return buildDnd5eSpellAdvancementPlanFromSelections({
    classId,
    fromClassLevel,
    toClassLevel,
    subclassId,
    selections,
  })
}

function removedCount(previous: readonly string[], next: readonly string[]): number {
  const nextSet = new Set(next)
  return previous.filter((id) => !nextSet.has(id)).length
}

function validSelection(
  ids: readonly string[],
  expectedCount: number,
  allowed: ReadonlySet<string>,
): boolean {
  return ids.length === expectedCount &&
    new Set(ids).size === ids.length &&
    ids.every((id) => allowed.has(id))
}

export function dnd5eSpellAdvancementSelectionsComplete(
  plan: Dnd5eSpellAdvancementPlan,
  value: Dnd5eAdvancementSpellSelectionsV1 | undefined,
): boolean {
  if (!plan.selectionRequired) return value == null
  if (!value) return false
  const cantrips = unique(value.cantrips)
  const knownSpells = unique(value.knownSpells)
  const wizardSpellbook = unique(value.wizardSpellbook)
  if (!validSelection(
    cantrips,
    plan.targetCantripCount,
    new Set(plan.cantripOptions.map((spell) => spell.id)),
  )) return false
  if (
    removedCount(plan.previousCantrips, cantrips) >
    (plan.canReplaceCantrip ? 1 : 0)
  ) return false
  if (plan.targetKnownSpellCount != null) {
    if (!validSelection(
      knownSpells,
      plan.targetKnownSpellCount,
      new Set(plan.spellOptions.map((spell) => spell.id)),
    )) return false
    if (
      removedCount(plan.previousKnownSpells, knownSpells) >
      (plan.canReplaceKnownSpell ? 1 : 0)
    ) return false
  } else if (value.knownSpells != null) {
    return false
  }
  if (plan.targetWizardSpellbookCount != null) {
    if (!validSelection(
      wizardSpellbook,
      plan.targetWizardSpellbookCount,
      new Set(plan.spellOptions.map((spell) => spell.id)),
    )) return false
    const nextBook = new Set(wizardSpellbook)
    if (plan.previousWizardSpellbook.some((id) => !nextBook.has(id))) return false
  } else if (value.wizardSpellbook != null) {
    return false
  }
  return true
}

export function applyDnd5eSpellAdvancement(
  character: Character,
  plan: Dnd5eSpellAdvancementPlan | undefined,
  value: Dnd5eAdvancementSpellSelectionsV1 | undefined,
  subclassId?: string,
): { ok: true; character: Character } | {
  ok: false
  reason: Dnd5eSpellAdvancementFailure
} {
  if (!plan) {
    return value == null
      ? { ok: true, character }
      : { ok: false, reason: 'invalid-spell-choice' }
  }
  if (!plan.selectionRequired) {
    return value == null
      ? { ok: true, character }
      : { ok: false, reason: 'invalid-spell-choice' }
  }
  if (!value) return { ok: false, reason: 'missing-spell-choice' }
  if (!dnd5eSpellAdvancementSelectionsComplete(plan, value)) {
    return { ok: false, reason: 'invalid-spell-choice' }
  }
  const source = dnd5eEffectiveSpellcastingSourceForClassSnapshot(
    plan.classId,
    plan.toClassLevel,
    subclassId,
  )
  if (!source) return { ok: false, reason: 'invalid-spell-choice' }
  const stored = source.subclass && source.classId === 'fighter'
    ? character.dnd5eClassChoices?.fighter?.extensionChoices ?? {}
    : character.dnd5eClassChoices?.classes?.[plan.classId]?.selections ?? {}
  const selections: Record<string, readonly string[]> = {
    ...stored,
    [plan.cantripSelectionKey]: unique(value.cantrips),
    ...(plan.targetKnownSpellCount == null
      ? {}
      : { [plan.spellSelectionKey]: unique(value.knownSpells) }),
    ...(plan.targetWizardSpellbookCount == null
      ? {}
      : { [WIZARD_SPELLBOOK_KEY]: unique(value.wizardSpellbook) }),
  }
  return {
    ok: true,
    character: {
      ...character,
      ...dnd5ePatchEffectiveSpellSelections(character, source, selections),
    },
  }
}
