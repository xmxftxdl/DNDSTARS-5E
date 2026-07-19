import type { ClassDefinition, ClassResourceDefinition } from '../../lib/classDefinitionTypes'
import { dnd5e2014Adapter as rules } from '../../rulesets/dnd5e/dnd5e2014Adapter'
import {
  DND5E_SRD_CLASS_DEFINITIONS,
  dnd5eBarbarianRageUses,
  dnd5eClassSpellSlots,
  dnd5ePactSlotLevel,
  type Dnd5eClassDefinition,
} from '../../rulesets/dnd5e/classes'
import type { Character } from '../../types/character'
import { defaultEquipmentForDnd5eCharacter, dnd5eKnownEquipmentForClass } from '../../rulesets/dnd5e/equipment'

const UNLIMITED_RESOURCE_MAX = Number.MAX_SAFE_INTEGER

function abilityModifier(character: Character, ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'): number {
  return rules.abilityModifier(character.abilities[ability])
}

function resource(
  key: string,
  label: string,
  level: number,
  max: (character: Character) => number,
  resetOn: 'combat' | 'short-rest' | 'long-rest',
  unlimited?: (character: Character) => boolean,
): ClassResourceDefinition {
  return {
    key,
    label,
    shortLabel: label,
    isAvailable: (character) => character.level >= level,
    max: (character) => unlimited?.(character) ? UNLIMITED_RESOURCE_MAX : Math.max(0, Math.floor(max(character))),
    unlimited,
    resetOn,
  }
}

function spellSlotResources(definition: Dnd5eClassDefinition): ClassResourceDefinition[] {
  if (!definition.spellcasting) return []
  if (definition.spellcasting.kind === 'pact') {
    return [resource(
      'dnd5e-pact-slot',
      '契约法术位',
      1,
      (character) => dnd5eClassSpellSlots(definition, character.level)[0] ?? 0,
      'short-rest',
    )]
  }
  return Array.from({ length: 9 }, (_, index) => {
    const spellLevel = index + 1
    return resource(
      `dnd5e-spell-slot-${spellLevel}`,
      `${spellLevel}环法术位`,
      definition.spellcasting?.kind.startsWith('half-') ? 2 : 1,
      (character) => dnd5eClassSpellSlots(definition, character.level)[index] ?? 0,
      'long-rest',
    )
  })
}

function classResources(definition: Dnd5eClassDefinition, character: Character): ClassResourceDefinition[] {
  const classSpecific: Partial<Record<Dnd5eClassDefinition['id'], ClassResourceDefinition[]>> = {
    barbarian: [
      resource('dnd5e-rage', '狂暴', 1, (candidate) => dnd5eBarbarianRageUses(candidate.level), 'long-rest', (candidate) => candidate.level >= 20),
    ],
    bard: [
      resource('dnd5e-bardic-inspiration', '诗人激励', 1, (candidate) => Math.max(1, abilityModifier(candidate, 'cha')), character.level >= 5 ? 'short-rest' : 'long-rest'),
    ],
    cleric: [
      resource('dnd5e-channel-divinity', '引导神力', 2, (candidate) => candidate.level >= 18 ? 3 : candidate.level >= 6 ? 2 : 1, 'short-rest'),
      resource('dnd5e-divine-intervention', '神圣干预', 10, () => 1, 'long-rest'),
    ],
    druid: [
      resource('dnd5e-wild-shape', '荒野形态', 2, () => 2, 'short-rest', (candidate) => candidate.level >= 20),
      resource('dnd5e-natural-recovery', '自然恢复', 2, () => 1, 'long-rest'),
    ],
    monk: [
      resource('dnd5e-ki', '气', 2, (candidate) => candidate.level, 'short-rest'),
      resource('dnd5e-wholeness-of-body', '身心合一', 6, () => 1, 'long-rest'),
    ],
    paladin: [
      resource('dnd5e-divine-sense', '神圣感知', 1, (candidate) => Math.max(1, 1 + abilityModifier(candidate, 'cha')), 'long-rest'),
      resource('dnd5e-lay-on-hands', '圣疗池', 1, (candidate) => candidate.level * 5, 'long-rest'),
      resource('dnd5e-channel-divinity', '引导神力', 3, () => 1, 'short-rest'),
      resource('dnd5e-cleansing-touch', '净化之触', 14, (candidate) => Math.max(1, abilityModifier(candidate, 'cha')), 'long-rest'),
      resource('dnd5e-holy-nimbus', '神圣光轮', 20, () => 1, 'long-rest'),
    ],
    rogue: [
      resource('dnd5e-stroke-of-luck', '幸运一击', 20, () => 1, 'short-rest'),
    ],
    sorcerer: [
      resource('dnd5e-sorcery-points', '术法点', 2, (candidate) => candidate.level, 'long-rest'),
    ],
    warlock: [
      resource('dnd5e-dark-ones-own-luck', '黑暗赐福', 6, () => 1, 'short-rest'),
      resource('dnd5e-hurl-through-hell', '坠入地狱', 14, () => 1, 'long-rest'),
      resource('dnd5e-mystic-arcanum-6', '秘法奥秘（6环）', 11, () => 1, 'long-rest'),
      resource('dnd5e-mystic-arcanum-7', '秘法奥秘（7环）', 13, () => 1, 'long-rest'),
      resource('dnd5e-mystic-arcanum-8', '秘法奥秘（8环）', 15, () => 1, 'long-rest'),
      resource('dnd5e-mystic-arcanum-9', '秘法奥秘（9环）', 17, () => 1, 'long-rest'),
      resource('dnd5e-eldritch-master', '魔能宗师', 20, () => 1, 'long-rest'),
    ],
    wizard: [
      resource('dnd5e-arcane-recovery', '奥术回想', 1, () => 1, 'long-rest'),
      resource('dnd5e-signature-spell-1', '招牌法术一', 20, () => 1, 'short-rest'),
      resource('dnd5e-signature-spell-2', '招牌法术二', 20, () => 1, 'short-rest'),
    ],
  }
  return [...(classSpecific[definition.id] ?? []), ...spellSlotResources(definition)]
}

export const DND5E_GENERIC_CLASS_DEFINITIONS: readonly ClassDefinition[] = DND5E_SRD_CLASS_DEFINITIONS
  .filter((definition) => definition.id !== 'fighter')
  .map((definition) => ({
    id: `dnd5e-${definition.id}`,
    classNames: [definition.name],
    matchesClassName: (className) => className === definition.name,
    defaultEquipment: defaultEquipmentForDnd5eCharacter({ charClass: definition.name }),
    knownEquipment: dnd5eKnownEquipmentForClass({ charClass: definition.name }),
    resources: (character) => classResources(definition, character),
  }))

export function dnd5eClassResourceDefinitions(character: Character): readonly ClassResourceDefinition[] {
  const definition = DND5E_SRD_CLASS_DEFINITIONS.find((candidate) => candidate.name === character.charClass)
  return definition && definition.id !== 'fighter' ? classResources(definition, character) : []
}

export function dnd5ePactSlotLabel(level: number): string {
  return `${dnd5ePactSlotLevel(level)}环契约法术位`
}
