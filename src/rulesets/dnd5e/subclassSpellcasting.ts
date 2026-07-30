import type { Character } from '../../types/character'
import {
  dnd5eClassDefinition,
  type Dnd5eClassDefinition,
  type Dnd5eClassId,
} from './classes'
import type {
  DeclarativeSubclassSpellcastingV1,
} from './declarativeSubclassAbility'
import { dnd5eCharacterClassLevel } from './classLevels'
import type { RegisteredDnd5ePluginSubclass } from './pluginApi'
import { dnd5ePluginSubclassRegistryEntry } from './pluginSubclassRegistry'
import type {
  Dnd5eSpellbookEntry,
  Dnd5eSpellbookSchoolId,
  Dnd5eSpellcastingClassId,
} from './spellbook'

export interface Dnd5eEffectiveSpellcastingSource {
  /** Class that owns the spell slots, selections, ability, and cast. */
  classId: Dnd5eClassId
  classLevel: number
  definition: Dnd5eClassDefinition
  /** Catalog list used to decide which spells may be learned. */
  spellListClassId: Dnd5eSpellcastingClassId
  subclass?: RegisteredDnd5ePluginSubclass
  declarative?: DeclarativeSubclassSpellcastingV1
  cantripSelectionKey: string
  spellSelectionKey: string
}

export function dnd5eEffectiveSpellcastingSourceForClassSnapshot(
  classId: Dnd5eClassId,
  classLevel: number,
  subclassId?: string,
): Dnd5eEffectiveSpellcastingSource | undefined {
  if (classLevel < 1) return undefined
  const classDefinition = dnd5eClassDefinition(classId)
  if (!classDefinition) return undefined
  if (classDefinition.spellcasting) {
    return {
      classId,
      classLevel,
      definition: classDefinition,
      spellListClassId: classId as Dnd5eSpellcastingClassId,
      cantripSelectionKey: 'spell-cantrips',
      spellSelectionKey:
        classDefinition.spellcasting.kind === 'full-known' ||
        classDefinition.spellcasting.kind === 'half-known' ||
        classDefinition.spellcasting.kind === 'pact'
          ? 'spell-known'
          : 'spell-prepared',
    }
  }
  const subclass = subclassId ? dnd5ePluginSubclassRegistryEntry(subclassId) : undefined
  const spellcasting = subclass?.classId === classId ? subclass.declarativeSpellcasting : undefined
  if (!subclass || !spellcasting || classLevel < classDefinition.subclassLevel) return undefined
  return {
    classId,
    classLevel,
    definition: subclassSpellcastingDefinition(classDefinition, subclass, spellcasting),
    spellListClassId: spellcasting.spellListClassId,
    subclass,
    declarative: spellcasting,
    cantripSelectionKey: subclassChoiceKey(subclass, spellcasting.cantripChoiceGroupId),
    spellSelectionKey: subclassChoiceKey(subclass, spellcasting.spellChoiceGroupId),
  }
}

function selectedSubclassId(character: Character, classId: Dnd5eClassId): string | undefined {
  return classId === 'fighter'
    ? character.dnd5eClassChoices?.fighter?.subclass
    : character.dnd5eClassChoices?.classes?.[classId]?.subclass
}

function subclassChoiceKey(
  subclass: RegisteredDnd5ePluginSubclass,
  localChoiceGroupId: string,
): string {
  return `${subclass.id}/${localChoiceGroupId}`
}

function subclassSpellcastingDefinition(
  classDefinition: Dnd5eClassDefinition,
  subclass: RegisteredDnd5ePluginSubclass,
  spellcasting: DeclarativeSubclassSpellcastingV1,
): Dnd5eClassDefinition {
  return {
    ...classDefinition,
    name: `${classDefinition.name}（${subclass.name}）`,
    subclass: {
      id: subclass.id,
      name: subclass.name,
      summary: subclass.summary,
      features: subclass.features.map((feature) => ({
        id: feature.featureId,
        level: feature.level,
        name: feature.name,
        description: feature.description,
        source: 'subclass' as const,
      })),
    },
    spellcasting: {
      kind: 'one-third-known',
      ability: spellcasting.ability,
      ritualCasting: spellcasting.ritualCasting,
      focus: spellcasting.focus,
      cantripsKnown: spellcasting.cantripsKnownByClassLevel,
      spellsKnown: spellcasting.spellsKnownByClassLevel,
    },
  }
}

export function dnd5eEffectiveSpellcastingSource(
  character: Character,
  classId: Dnd5eClassId,
): Dnd5eEffectiveSpellcastingSource | undefined {
  const classLevel = dnd5eCharacterClassLevel(character, classId)
  const subclassId = selectedSubclassId(character, classId)
  return dnd5eEffectiveSpellcastingSourceForClassSnapshot(classId, classLevel, subclassId)
}

export function dnd5eEffectiveSpellcastingSources(
  character: Character,
): readonly Dnd5eEffectiveSpellcastingSource[] {
  const classIds = Object.keys(character.dnd5eClassLevels ?? {}) as Dnd5eClassId[]
  const primary = dnd5eClassDefinition(character.charClass)?.id
  const candidates = classIds.length > 0 ? classIds : primary ? [primary] : []
  return [...new Set(candidates)].flatMap((classId) => {
    const source = dnd5eEffectiveSpellcastingSource(character, classId)
    return source ? [source] : []
  })
}

export function dnd5eEffectiveSpellSelections(
  character: Character,
  source: Dnd5eEffectiveSpellcastingSource,
): Readonly<Record<string, readonly string[]>> {
  if (source.subclass && source.classId === 'fighter') {
    return character.dnd5eClassChoices?.fighter?.extensionChoices ?? {}
  }
  return character.dnd5eClassChoices?.classes?.[source.classId]?.selections ?? {}
}

export function dnd5ePatchEffectiveSpellSelections(
  character: Character,
  source: Dnd5eEffectiveSpellcastingSource,
  selections: Readonly<Record<string, readonly string[]>>,
): Pick<Character, 'dnd5eClassChoices'> {
  const mutableSelections = Object.fromEntries(
    Object.entries(selections).map(([key, values]) => [key, [...values]]),
  )
  if (source.subclass && source.classId === 'fighter') {
    return {
      dnd5eClassChoices: {
        ...character.dnd5eClassChoices,
        fighter: {
          ...character.dnd5eClassChoices?.fighter,
          subclass: source.subclass.id,
          extensionChoices: mutableSelections,
        },
      },
    }
  }
  const stored = character.dnd5eClassChoices?.classes?.[source.classId]
  return {
    dnd5eClassChoices: {
      ...character.dnd5eClassChoices,
      classes: {
        ...character.dnd5eClassChoices?.classes,
        [source.classId]: {
          ...stored,
          subclass: stored?.subclass ?? source.definition.subclass.id,
          selections: mutableSelections,
        },
      },
    },
  }
}

const SCHOOL_BY_LABEL: Readonly<Record<string, Dnd5eSpellbookSchoolId>> = {
  防护: 'abjuration',
  咒法: 'conjuration',
  预言: 'divination',
  附魔: 'enchantment',
  塑能: 'evocation',
  幻术: 'illusion',
  死灵: 'necromancy',
  变化: 'transmutation',
}

export function dnd5eSpellSchoolIdFromLabel(
  school: string,
): Dnd5eSpellbookSchoolId | undefined {
  return SCHOOL_BY_LABEL[school]
}

export function dnd5eSpellbookEntrySchoolId(
  entry: Dnd5eSpellbookEntry,
): Dnd5eSpellbookSchoolId | undefined {
  return entry.imported?.school ??
    (entry.combat ? dnd5eSpellSchoolIdFromLabel(entry.combat.school) : undefined) ??
    (entry.reference ? dnd5eSpellSchoolIdFromLabel(entry.reference.school) : undefined)
}

export function dnd5eSubclassUnrestrictedSpellLimit(
  source: Dnd5eEffectiveSpellcastingSource,
): number {
  const table = source.declarative?.unrestrictedSpellsKnownByClassLevel
  if (!table) return 0
  return table[Math.max(0, Math.min(19, source.classLevel - 1))] ?? 0
}

export function dnd5eSubclassSpellSchoolAllowed(
  source: Dnd5eEffectiveSpellcastingSource,
  entry: Dnd5eSpellbookEntry,
): boolean {
  if (entry.level === 0 || !source.declarative?.allowedSchools?.length) return true
  const school = dnd5eSpellbookEntrySchoolId(entry)
  return school != null && source.declarative.allowedSchools.includes(school)
}
