import type { AbilityKey } from '../../lib/dnd'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import type { Character } from '../../types/character'
import type { CharacterEquipment, EquipmentItem } from '../../types/equipment'

export const DND5E_LONGSWORD: EquipmentItem = {
  id: 'dnd5e-longsword',
  name: '长剑',
  slot: 'mainWeapon',
  dnd5e: {
    kind: 'weapon',
    category: 'martial',
    mode: 'melee',
    damage: { count: 1, sides: 8, type: 'slashing' },
    attackAbility: 'str',
    reachFeet: 5,
    properties: ['多才多艺（1d10）'],
  },
}

export const DND5E_SHIELD: EquipmentItem = {
  id: 'dnd5e-shield',
  name: '盾牌',
  slot: 'offHand',
  ac: 2,
  dnd5e: { kind: 'shield', armorClassBonus: 2 },
}

export const DND5E_CHAIN_MAIL: EquipmentItem = {
  id: 'dnd5e-chain-mail',
  name: '链甲',
  slot: 'armor',
  ac: 16,
  dnd5e: {
    kind: 'armor',
    category: 'heavy',
    baseArmorClass: 16,
    dexterityBonus: 'none',
    strengthRequirement: 13,
    stealthDisadvantage: true,
  },
}

export const DND5E_FIGHTER_STARTING_EQUIPMENT: CharacterEquipment = {
  mainWeapon: DND5E_LONGSWORD,
  offHand: DND5E_SHIELD,
  armor: DND5E_CHAIN_MAIL,
}

export interface Dnd5eWeaponAttackProfile {
  weaponId: string
  weaponName: string
  mode: 'melee' | 'ranged'
  attackAbility: AbilityKey
  attackModifier: number
  damage: { count: number; sides: number; bonus: number; type: 'slashing' | 'piercing' | 'bludgeoning' }
  reachFeet?: number
  rangeFeet?: { normal: number; long: number }
}

export function defaultEquipmentForDnd5eCharacter(character: Pick<Character, 'charClass'>): CharacterEquipment | undefined {
  return character.charClass === '战士'
    ? {
        mainWeapon: { ...DND5E_LONGSWORD },
        offHand: { ...DND5E_SHIELD },
        armor: { ...DND5E_CHAIN_MAIL },
      }
    : undefined
}

export function dnd5eArmorClass(character: Pick<Character, 'abilities' | 'equipment' | 'ac'>): number {
  const dexterityModifier = rules.abilityModifier(Math.min(30, Math.max(1, character.abilities.dex)))
  const armor = character.equipment?.armor?.dnd5e
  let armorClass = 10 + dexterityModifier
  if (armor?.kind === 'armor') {
    const dexterityBonus = armor.dexterityBonus === 'full'
      ? dexterityModifier
      : armor.dexterityBonus === 'max-2'
        ? Math.min(2, dexterityModifier)
        : 0
    armorClass = armor.baseArmorClass + dexterityBonus
  } else if (character.equipment?.armor?.ac != null) {
    armorClass = character.equipment.armor.ac
  } else if (character.ac > 0) {
    armorClass = character.ac
  }
  const shield = character.equipment?.offHand?.dnd5e
  if (shield?.kind === 'shield') armorClass += shield.armorClassBonus
  return Math.max(0, Math.floor(armorClass))
}

export function dnd5eWeaponAttackProfile(character: Character): Dnd5eWeaponAttackProfile | undefined {
  const weapon = character.equipment?.mainWeapon
  const data = weapon?.dnd5e
  if (!weapon || !data || data.kind !== 'weapon') return undefined
  const strengthModifier = rules.abilityModifier(Math.min(30, Math.max(1, character.abilities.str)))
  const dexterityModifier = rules.abilityModifier(Math.min(30, Math.max(1, character.abilities.dex)))
  const ability: AbilityKey = data.attackAbility === 'finesse'
    ? (dexterityModifier > strengthModifier ? 'dex' : 'str')
    : data.attackAbility
  const abilityModifier = ability === 'dex' ? dexterityModifier : strengthModifier
  const proficiency = rules.proficiencyBonus(Math.min(20, Math.max(1, character.level)))
  const styles = character.dnd5eClassChoices?.fighter?.fightingStyles ?? []
  const attackStyleBonus = data.mode === 'ranged' && styles.includes('archery') ? 2 : 0
  const duelingBonus = data.mode === 'melee' && styles.includes('dueling') && character.equipment?.offHand?.dnd5e?.kind !== 'weapon' ? 2 : 0
  return {
    weaponId: weapon.id,
    weaponName: weapon.name,
    mode: data.mode,
    attackAbility: ability,
    attackModifier: abilityModifier + proficiency + attackStyleBonus,
    damage: { ...data.damage, bonus: abilityModifier + duelingBonus },
    reachFeet: data.reachFeet,
    rangeFeet: data.rangeFeet,
  }
}

export function dnd5eWeaponRangeFeet(profile: Dnd5eWeaponAttackProfile): number {
  return profile.mode === 'melee' ? (profile.reachFeet ?? 5) : (profile.rangeFeet?.normal ?? 0)
}
