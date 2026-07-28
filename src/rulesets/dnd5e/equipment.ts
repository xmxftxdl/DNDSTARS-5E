import type { AbilityKey } from '../../lib/dnd'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import type { Character } from '../../types/character'
import type { CharacterEquipment, EquipmentItem } from '../../types/equipment'
import { fighterCriticalThreshold, fighterSelectedFightingStyles } from './fighter'
import {
  dnd5eBarbarianRageDamage,
  dnd5eClassDefinitionForCharacter,
  dnd5eMonkMartialArtsDie,
  type Dnd5eClassId,
} from './classes'
import { dnd5eEquippedEffectTotal, dnd5eWeaponEffectTotal } from './equipmentEffects'
import { dnd5eCharacterClassLevel, normalizeDnd5eClassLevels } from './multiclass'
import { normalizeDnd5eActiveEffects } from './activeEffects'

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
    material: 'metal',
    strengthRequirement: 13,
    stealthDisadvantage: true,
  },
}

export const DND5E_FIGHTER_STARTING_EQUIPMENT: CharacterEquipment = {
  mainWeapon: DND5E_LONGSWORD,
  offHand: DND5E_SHIELD,
  armor: DND5E_CHAIN_MAIL,
}

export const DND5E_GREATAXE: EquipmentItem = weapon('dnd5e-greataxe', '巨斧', 'martial', 'melee', 1, 12, 'slashing', 'str', { reachFeet: 5, properties: ['双手', '重型'] })
export const DND5E_RAPIER: EquipmentItem = weapon('dnd5e-rapier', '刺剑', 'martial', 'melee', 1, 8, 'piercing', 'finesse', { reachFeet: 5, properties: ['灵巧'] })
export const DND5E_MACE: EquipmentItem = weapon('dnd5e-mace', '硬头锤', 'simple', 'melee', 1, 6, 'bludgeoning', 'str', { reachFeet: 5 })
export const DND5E_SCIMITAR: EquipmentItem = weapon('dnd5e-scimitar', '弯刀', 'martial', 'melee', 1, 6, 'slashing', 'finesse', { reachFeet: 5, properties: ['灵巧', '轻型'] })
export const DND5E_SHORTSWORD: EquipmentItem = weapon('dnd5e-shortsword', '短剑', 'martial', 'melee', 1, 6, 'piercing', 'finesse', { reachFeet: 5, properties: ['灵巧', '轻型'] })
export const DND5E_QUARTERSTAFF: EquipmentItem = weapon('dnd5e-quarterstaff', '长棍', 'simple', 'melee', 1, 6, 'bludgeoning', 'str', { reachFeet: 5, properties: ['多才多艺（1d8）'] })
export const DND5E_LIGHT_CROSSBOW: EquipmentItem = weapon('dnd5e-light-crossbow', '轻弩', 'simple', 'ranged', 1, 8, 'piercing', 'dex', { rangeFeet: { normal: 80, long: 320 }, properties: ['弹药', '装填', '双手'] })
export const DND5E_LONGBOW: EquipmentItem = weapon('dnd5e-longbow', '长弓', 'martial', 'ranged', 1, 8, 'piercing', 'dex', { rangeFeet: { normal: 150, long: 600 }, properties: ['弹药', '重型', '双手'] })
export const DND5E_DAGGER: EquipmentItem = weapon('dnd5e-dagger', '匕首', 'simple', 'melee', 1, 4, 'piercing', 'finesse', { reachFeet: 5, rangeFeet: { normal: 20, long: 60 }, properties: ['灵巧', '轻型', '投掷（20/60）'] })
export const DND5E_CLUB: EquipmentItem = weapon('dnd5e-club', '短棒', 'simple', 'melee', 1, 4, 'bludgeoning', 'str', { reachFeet: 5, properties: ['轻型'] })
export const DND5E_GREATCLUB: EquipmentItem = weapon('dnd5e-greatclub', '大棒', 'simple', 'melee', 1, 8, 'bludgeoning', 'str', { reachFeet: 5, properties: ['双手'] })
export const DND5E_HANDAXE: EquipmentItem = weapon('dnd5e-handaxe', '手斧', 'simple', 'melee', 1, 6, 'slashing', 'str', { reachFeet: 5, rangeFeet: { normal: 20, long: 60 }, properties: ['轻型', '投掷（20/60）'] })
export const DND5E_JAVELIN: EquipmentItem = weapon('dnd5e-javelin', '标枪', 'simple', 'melee', 1, 6, 'piercing', 'str', { reachFeet: 5, rangeFeet: { normal: 30, long: 120 }, properties: ['投掷（30/120）'] })
export const DND5E_LIGHT_HAMMER: EquipmentItem = weapon('dnd5e-light-hammer', '轻锤', 'simple', 'melee', 1, 4, 'bludgeoning', 'str', { reachFeet: 5, rangeFeet: { normal: 20, long: 60 }, properties: ['轻型', '投掷（20/60）'] })
export const DND5E_SICKLE: EquipmentItem = weapon('dnd5e-sickle', '镰刀', 'simple', 'melee', 1, 4, 'slashing', 'str', { reachFeet: 5, properties: ['轻型'] })
export const DND5E_SPEAR: EquipmentItem = weapon('dnd5e-spear', '矛', 'simple', 'melee', 1, 6, 'piercing', 'str', { reachFeet: 5, rangeFeet: { normal: 20, long: 60 }, properties: ['投掷（20/60）', '多才多艺（1d8）'] })
export const DND5E_DART: EquipmentItem = weapon('dnd5e-dart', '飞镖', 'simple', 'ranged', 1, 4, 'piercing', 'dex', { rangeFeet: { normal: 20, long: 60 }, properties: ['灵巧', '投掷'] })
export const DND5E_SHORTBOW: EquipmentItem = weapon('dnd5e-shortbow', '短弓', 'simple', 'ranged', 1, 6, 'piercing', 'dex', { rangeFeet: { normal: 80, long: 320 }, properties: ['弹药', '双手'] })
export const DND5E_SLING: EquipmentItem = weapon('dnd5e-sling', '投石索', 'simple', 'ranged', 1, 4, 'bludgeoning', 'dex', { rangeFeet: { normal: 30, long: 120 }, properties: ['弹药'] })
export const DND5E_WARHAMMER: EquipmentItem = weapon('dnd5e-warhammer', '战锤', 'martial', 'melee', 1, 8, 'bludgeoning', 'str', { reachFeet: 5, properties: ['多才多艺（1d10）'] })
export const DND5E_GREATSWORD: EquipmentItem = weapon('dnd5e-greatsword', '巨剑', 'martial', 'melee', 2, 6, 'slashing', 'str', { reachFeet: 5, properties: ['双手', '重型'] })
export const DND5E_BATTLEAXE: EquipmentItem = weapon('dnd5e-battleaxe', '战斧', 'martial', 'melee', 1, 8, 'slashing', 'str', { reachFeet: 5, properties: ['多才多艺（1d10）'] })
export const DND5E_FLAIL: EquipmentItem = weapon('dnd5e-flail', '连枷', 'martial', 'melee', 1, 8, 'bludgeoning', 'str', { reachFeet: 5 })
export const DND5E_GLAIVE: EquipmentItem = weapon('dnd5e-glaive', '长柄刀', 'martial', 'melee', 1, 10, 'slashing', 'str', { reachFeet: 10, properties: ['重型', '触及', '双手'] })
export const DND5E_HALBERD: EquipmentItem = weapon('dnd5e-halberd', '戟', 'martial', 'melee', 1, 10, 'slashing', 'str', { reachFeet: 10, properties: ['重型', '触及', '双手'] })
export const DND5E_LANCE: EquipmentItem = weapon('dnd5e-lance', '骑枪', 'martial', 'melee', 1, 12, 'piercing', 'str', { reachFeet: 10, properties: ['触及', '特殊'] })
export const DND5E_MAUL: EquipmentItem = weapon('dnd5e-maul', '巨锤', 'martial', 'melee', 2, 6, 'bludgeoning', 'str', { reachFeet: 5, properties: ['重型', '双手'] })
export const DND5E_MORNINGSTAR: EquipmentItem = weapon('dnd5e-morningstar', '钉头锤', 'martial', 'melee', 1, 8, 'piercing', 'str', { reachFeet: 5 })
export const DND5E_PIKE: EquipmentItem = weapon('dnd5e-pike', '长枪', 'martial', 'melee', 1, 10, 'piercing', 'str', { reachFeet: 10, properties: ['重型', '触及', '双手'] })
export const DND5E_TRIDENT: EquipmentItem = weapon('dnd5e-trident', '三叉戟', 'martial', 'melee', 1, 6, 'piercing', 'str', { reachFeet: 5, rangeFeet: { normal: 20, long: 60 }, properties: ['投掷（20/60）', '多才多艺（1d8）'] })
export const DND5E_WAR_PICK: EquipmentItem = weapon('dnd5e-war-pick', '战镐', 'martial', 'melee', 1, 8, 'piercing', 'str', { reachFeet: 5 })
export const DND5E_WHIP: EquipmentItem = weapon('dnd5e-whip', '长鞭', 'martial', 'melee', 1, 4, 'slashing', 'finesse', { reachFeet: 10, properties: ['灵巧', '触及'] })
export const DND5E_BLOWGUN: EquipmentItem = weapon('dnd5e-blowgun', '吹箭筒', 'martial', 'ranged', 1, 1, 'piercing', 'dex', { rangeFeet: { normal: 25, long: 100 }, properties: ['弹药', '装填'] })
export const DND5E_HAND_CROSSBOW: EquipmentItem = weapon('dnd5e-hand-crossbow', '手弩', 'martial', 'ranged', 1, 6, 'piercing', 'dex', { rangeFeet: { normal: 30, long: 120 }, properties: ['弹药', '轻型', '装填'] })
export const DND5E_HEAVY_CROSSBOW: EquipmentItem = weapon('dnd5e-heavy-crossbow', '重弩', 'martial', 'ranged', 1, 10, 'piercing', 'dex', { rangeFeet: { normal: 100, long: 400 }, properties: ['弹药', '重型', '装填', '双手'] })
export const DND5E_NET: EquipmentItem = weapon('dnd5e-net', '捕网', 'martial', 'ranged', 0, 1, 'bludgeoning', 'dex', { rangeFeet: { normal: 5, long: 15 }, properties: ['特殊', '投掷'] })
export const DND5E_OFFHAND_SCIMITAR: EquipmentItem = { ...DND5E_SCIMITAR, id: 'dnd5e-scimitar-offhand', slot: 'offHand' }
export const DND5E_OFFHAND_SHORTSWORD: EquipmentItem = { ...DND5E_SHORTSWORD, id: 'dnd5e-shortsword-offhand', slot: 'offHand' }
export const DND5E_OFFHAND_DAGGER: EquipmentItem = { ...DND5E_DAGGER, id: 'dnd5e-dagger-offhand', slot: 'offHand' }
export const DND5E_OFFHAND_HANDAXE: EquipmentItem = { ...DND5E_HANDAXE, id: 'dnd5e-handaxe-offhand', slot: 'offHand' }

export const DND5E_LEATHER_ARMOR: EquipmentItem = {
  id: 'dnd5e-leather-armor', name: '皮甲', slot: 'armor', ac: 11,
  dnd5e: { kind: 'armor', category: 'light', baseArmorClass: 11, dexterityBonus: 'full', material: 'nonmetal' },
}

export const DND5E_SCALE_MAIL: EquipmentItem = {
  id: 'dnd5e-scale-mail', name: '鳞甲', slot: 'armor', ac: 14,
  dnd5e: { kind: 'armor', category: 'medium', baseArmorClass: 14, dexterityBonus: 'max-2', material: 'metal', stealthDisadvantage: true },
}

/** SRD 核心客户端当前能够进行 5e 自动战斗结算的装备目录。 */
export const DND5E_SRD_EQUIPMENT_CATALOG: readonly EquipmentItem[] = [
  DND5E_LONGSWORD,
  DND5E_GREATAXE,
  DND5E_RAPIER,
  DND5E_MACE,
  DND5E_SCIMITAR,
  DND5E_SHORTSWORD,
  DND5E_QUARTERSTAFF,
  DND5E_LIGHT_CROSSBOW,
  DND5E_LONGBOW,
  DND5E_DAGGER,
  DND5E_CLUB,
  DND5E_GREATCLUB,
  DND5E_HANDAXE,
  DND5E_JAVELIN,
  DND5E_LIGHT_HAMMER,
  DND5E_SICKLE,
  DND5E_SPEAR,
  DND5E_DART,
  DND5E_SHORTBOW,
  DND5E_SLING,
  DND5E_WARHAMMER,
  DND5E_GREATSWORD,
  DND5E_BATTLEAXE,
  DND5E_FLAIL,
  DND5E_GLAIVE,
  DND5E_HALBERD,
  DND5E_LANCE,
  DND5E_MAUL,
  DND5E_MORNINGSTAR,
  DND5E_PIKE,
  DND5E_TRIDENT,
  DND5E_WAR_PICK,
  DND5E_WHIP,
  DND5E_BLOWGUN,
  DND5E_HAND_CROSSBOW,
  DND5E_HEAVY_CROSSBOW,
  DND5E_NET,
  DND5E_OFFHAND_SCIMITAR,
  DND5E_OFFHAND_SHORTSWORD,
  DND5E_OFFHAND_DAGGER,
  DND5E_OFFHAND_HANDAXE,
  DND5E_SHIELD,
  DND5E_CHAIN_MAIL,
  DND5E_SCALE_MAIL,
  DND5E_LEATHER_ARMOR,
]

function weapon(
  id: string,
  name: string,
  category: 'simple' | 'martial',
  mode: 'melee' | 'ranged',
  count: number,
  sides: number,
  type: 'slashing' | 'piercing' | 'bludgeoning',
  attackAbility: 'str' | 'dex' | 'finesse',
  extra: {
    magical?: boolean
    specialMaterial?: 'silvered' | 'adamantine'
    reachFeet?: number
    rangeFeet?: { normal: number; long: number }
    properties?: readonly string[]
  },
): EquipmentItem {
  return { id, name, slot: 'mainWeapon', dnd5e: { kind: 'weapon', category, mode, damage: { count, sides, type }, attackAbility, ...extra } }
}

const DND5E_STARTING_EQUIPMENT: Readonly<Record<string, CharacterEquipment>> = {
  野蛮人: { mainWeapon: DND5E_GREATAXE },
  吟游诗人: { mainWeapon: DND5E_RAPIER, armor: DND5E_LEATHER_ARMOR },
  牧师: { mainWeapon: DND5E_MACE, offHand: DND5E_SHIELD, armor: DND5E_SCALE_MAIL },
  德鲁伊: { mainWeapon: DND5E_SCIMITAR, offHand: DND5E_SHIELD, armor: DND5E_LEATHER_ARMOR },
  战士: DND5E_FIGHTER_STARTING_EQUIPMENT,
  武僧: { mainWeapon: DND5E_SHORTSWORD },
  圣武士: { mainWeapon: DND5E_LONGSWORD, offHand: DND5E_SHIELD, armor: DND5E_CHAIN_MAIL },
  游侠: { mainWeapon: DND5E_LONGBOW, armor: DND5E_SCALE_MAIL },
  游荡者: { mainWeapon: DND5E_RAPIER, armor: DND5E_LEATHER_ARMOR },
  术士: { mainWeapon: DND5E_LIGHT_CROSSBOW },
  邪术师: { mainWeapon: DND5E_LIGHT_CROSSBOW, armor: DND5E_LEATHER_ARMOR },
  法师: { mainWeapon: DND5E_QUARTERSTAFF },
}

export interface Dnd5eWeaponAttackProfile {
  weaponId: string
  weaponName: string
  mode: 'melee' | 'ranged'
  attackAbility: AbilityKey
  finesse: boolean
  proficient: boolean
  attackModifier: number
  criticalThreshold: number
  greatWeaponFighting: boolean
  properties: readonly string[]
  damage: { count: number; sides: number; bonus: number; type: 'slashing' | 'piercing' | 'bludgeoning' }
  reachFeet?: number
  rangeFeet?: { normal: number; long: number }
}

export interface Dnd5eWeaponDamageSource {
  /** 装备定义的稳定 ID，而不是 UI 临时生成的攻击请求 ID。 */
  weaponId: string
  magical: boolean
  specialMaterial?: 'silvered' | 'adamantine'
}

function dnd5eLegacyWeaponIsMagical(weapon: EquipmentItem): boolean {
  if (weapon.id.startsWith('srd-5.1:magic-item:weapon-')) return true
  if (!weapon.baseEquipmentId) return false
  return (weapon.effects?.weaponAttackBonus ?? 0) !== 0 ||
    (weapon.effects?.weaponDamageBonus ?? 0) !== 0
}

/**
 * Derives weapon provenance from the authoritative equipped item.
 * The legacy inference keeps existing +N magic-weapon saves working; new content
 * should persist `dnd5e.magical` explicitly.
 */
export function dnd5eWeaponDamageSource(
  weapon: EquipmentItem | undefined,
): Dnd5eWeaponDamageSource | undefined {
  const data = weapon?.dnd5e
  if (!weapon || !weapon.id.trim() || !data || data.kind !== 'weapon') return undefined
  const explicitMagical = typeof data.magical === 'boolean' ? data.magical : undefined
  const specialMaterial = data.specialMaterial === 'silvered' || data.specialMaterial === 'adamantine'
    ? data.specialMaterial
    : undefined
  return {
    weaponId: weapon.id,
    magical: explicitMagical ?? dnd5eLegacyWeaponIsMagical(weapon),
    ...(specialMaterial ? { specialMaterial } : {}),
  }
}

export interface Dnd5eUnarmedStrikeProfile {
  attackAbility: 'str' | 'dex'
  attackModifier: number
  damage: { count: number; sides: number; bonus: number; type: 'bludgeoning' }
  martialArts: boolean
}

export function dnd5eMonkMartialArtsEligible(character: Character): boolean {
  if (dnd5eCharacterClassLevel(character, 'monk') < 1) return false
  if (character.equipment?.armor || character.equipment?.offHand?.dnd5e?.kind === 'shield') return false
  const weapon = character.equipment?.mainWeapon
  const data = weapon?.dnd5e
  if (!weapon || !data || data.kind !== 'weapon') return true
  const disallowed = data.properties?.some((property) => property.includes('双手') || property.includes('重型')) ?? false
  return data.mode === 'melee' && !disallowed && (weapon.id === DND5E_SHORTSWORD.id || data.category === 'simple')
}

export function dnd5eMonkUnarmedStrikeProfile(character: Character): Dnd5eUnarmedStrikeProfile | undefined {
  const monkLevel = dnd5eCharacterClassLevel(character, 'monk')
  if (monkLevel < 1) return undefined
  const strengthModifier = rules.abilityModifier(Math.min(30, Math.max(1, character.abilities.str)))
  const dexterityModifier = rules.abilityModifier(Math.min(30, Math.max(1, character.abilities.dex)))
  const martialArts = dnd5eMonkMartialArtsEligible(character)
  const attackAbility: 'str' | 'dex' = martialArts && dexterityModifier > strengthModifier ? 'dex' : 'str'
  const abilityModifier = attackAbility === 'dex' ? dexterityModifier : strengthModifier
  return {
    attackAbility,
    attackModifier: abilityModifier + rules.proficiencyBonus(Math.min(20, Math.max(1, character.level))),
    damage: martialArts
      ? { count: 1, sides: dnd5eMonkMartialArtsDie(monkLevel), bonus: abilityModifier, type: 'bludgeoning' }
      : { count: 0, sides: 2, bonus: 1 + strengthModifier, type: 'bludgeoning' },
    martialArts,
  }
}

export function defaultEquipmentForDnd5eCharacter(character: Pick<Character, 'charClass'>): CharacterEquipment | undefined {
  const equipment = DND5E_STARTING_EQUIPMENT[character.charClass]
  return equipment ? Object.fromEntries(Object.entries(equipment).map(([slot, item]) => [slot, item ? { ...item } : item])) : undefined
}

/** 丢弃旧项目的攻防数值装备，只保留带有 D&D 5e 规则数据的物品。 */
export function normalizeDnd5eCharacterEquipment(
  character: Pick<Character, 'charClass' | 'equipment'>,
): CharacterEquipment | undefined {
  const defaults = defaultEquipmentForDnd5eCharacter(character)
  const useLegacyDefaults = character.equipment == null
  const result: CharacterEquipment = {}
  const slots: Array<keyof CharacterEquipment> = [
    'mainWeapon', 'offHand', 'armor', 'helmet', 'shoes', 'ring', 'necklace',
  ]
  for (const slot of slots) {
    const item = character.equipment?.[slot]
    const selected = item?.dnd5e || item?.effects ? item : useLegacyDefaults ? defaults?.[slot] : undefined
    if (!selected) continue
    const dnd5e = structuredClone(selected.dnd5e)
    if (dnd5e?.kind === 'weapon') {
      const source = dnd5eWeaponDamageSource(selected)
      if (typeof dnd5e.magical !== 'boolean') {
        if (source?.magical) dnd5e.magical = true
        else delete dnd5e.magical
      }
      if (dnd5e.specialMaterial !== 'silvered' && dnd5e.specialMaterial !== 'adamantine') {
        delete dnd5e.specialMaterial
      }
    }
    result[slot] = {
      id: selected.id,
      baseEquipmentId: selected.baseEquipmentId,
      name: selected.name,
      slot: selected.slot,
      ac: selected.ac,
      effects: selected.effects ? { ...selected.effects } : undefined,
      dnd5e,
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

export function dnd5eKnownEquipmentForClass(character: Pick<Character, 'charClass'>): EquipmentItem[] {
  const starting = Object.values(DND5E_STARTING_EQUIPMENT[character.charClass] ?? {}).filter((item): item is EquipmentItem => !!item)
  const martialChoices = character.charClass === '战士'
    ? [
        DND5E_LONGSWORD, DND5E_GREATAXE, DND5E_RAPIER, DND5E_SCIMITAR, DND5E_SHORTSWORD,
        DND5E_LIGHT_CROSSBOW, DND5E_LONGBOW, DND5E_OFFHAND_SCIMITAR, DND5E_OFFHAND_SHORTSWORD,
        DND5E_SHIELD, DND5E_CHAIN_MAIL, DND5E_SCALE_MAIL, DND5E_LEATHER_ARMOR,
      ]
    : character.charClass === '游侠'
      ? [DND5E_LONGBOW, DND5E_SCIMITAR, DND5E_SHORTSWORD, DND5E_OFFHAND_SCIMITAR, DND5E_OFFHAND_SHORTSWORD, DND5E_SCALE_MAIL]
      : []
  return [...new Map([...starting, ...martialChoices].map((item) => [item.id, item])).values()]
}

export type Dnd5eArmorProficiency = 'light' | 'medium' | 'heavy' | 'shield'

const DND5E_STARTING_ARMOR_PROFICIENCIES: Readonly<Record<Dnd5eClassId, readonly Dnd5eArmorProficiency[]>> = {
  barbarian: ['light', 'medium', 'shield'],
  bard: ['light'],
  cleric: ['light', 'medium', 'shield'],
  druid: ['light', 'medium', 'shield'],
  fighter: ['light', 'medium', 'heavy', 'shield'],
  monk: [],
  paladin: ['light', 'medium', 'heavy', 'shield'],
  ranger: ['light', 'medium', 'shield'],
  rogue: ['light'],
  sorcerer: [],
  warlock: ['light'],
  wizard: [],
}

const DND5E_MULTICLASS_ARMOR_PROFICIENCIES: Readonly<Record<Dnd5eClassId, readonly Dnd5eArmorProficiency[]>> = {
  barbarian: ['shield'],
  bard: ['light'],
  cleric: ['light', 'medium', 'shield'],
  druid: ['light', 'medium', 'shield'],
  fighter: ['light', 'medium', 'shield'],
  monk: [],
  paladin: ['light', 'medium', 'shield'],
  ranger: ['light', 'medium', 'shield'],
  rogue: ['light'],
  sorcerer: [],
  warlock: ['light'],
  wizard: [],
}

/**
 * Returns the character's effective armor proficiencies.
 *
 * Armor proficiency is deliberately independent from whether the character may
 * equip an item. D&D 5e permits wearing unproficient armor and applies the
 * resulting penalties during authoritative resolution.
 */
export function dnd5eArmorProficiencies(character: Character): ReadonlySet<Dnd5eArmorProficiency> {
  const classLevels = normalizeDnd5eClassLevels(character)
  const primaryClassId = dnd5eClassDefinitionForCharacter(character)?.id
  const proficiencies = new Set<Dnd5eArmorProficiency>()
  for (const classId of Object.keys(classLevels) as Dnd5eClassId[]) {
    const granted = classId === primaryClassId
      ? DND5E_STARTING_ARMOR_PROFICIENCIES[classId]
      : DND5E_MULTICLASS_ARMOR_PROFICIENCIES[classId]
    for (const proficiency of granted) proficiencies.add(proficiency)
  }
  if (
    dnd5eCharacterClassLevel(character, 'cleric') >= 1 &&
    character.dnd5eClassChoices?.classes?.cleric?.subclass === 'life'
  ) {
    proficiencies.add('heavy')
  }
  return proficiencies
}

export function dnd5eArmorProficient(character: Character, item: EquipmentItem | undefined): boolean {
  const data = item?.dnd5e
  if (!data) return false
  const proficiencies = dnd5eArmorProficiencies(character)
  if (data.kind === 'shield') return proficiencies.has('shield')
  return data.kind === 'armor' && proficiencies.has(data.category)
}

export function dnd5eUnproficientEquippedArmor(character: Character): EquipmentItem[] {
  const equipped = [character.equipment?.armor, character.equipment?.offHand]
  return equipped.filter((item): item is EquipmentItem =>
    (item?.dnd5e?.kind === 'armor' || item?.dnd5e?.kind === 'shield') &&
    !dnd5eArmorProficient(character, item),
  )
}

export function dnd5eWearingUnproficientArmor(character: Character): boolean {
  return dnd5eUnproficientEquippedArmor(character).length > 0
}

export function dnd5eArmorImposesStealthDisadvantage(character: Character): boolean {
  const armor = character.equipment?.armor?.dnd5e
  return armor?.kind === 'armor' && armor.stealthDisadvantage === true
}

export function dnd5eArmorClass(character: Character): number {
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
  } else {
    // `character.ac` is a persisted derived value, not an additional AC source.
    // Reading it back here makes stale armor, Shield, or cover bonuses permanent:
    // finalizeCharacter() stores this result in `ac`, then the next calculation
    // can never fall below that old value. Custom AC must come from an equipped
    // armor item/effect so that changing class or equipment can recompute safely.
    const constitutionModifier = rules.abilityModifier(Math.min(30, Math.max(1, character.abilities.con)))
    const wisdomModifier = rules.abilityModifier(Math.min(30, Math.max(1, character.abilities.wis)))
    const hasShield = character.equipment?.offHand?.dnd5e?.kind === 'shield'
    if (dnd5eCharacterClassLevel(character, 'barbarian') >= 1) armorClass = Math.max(armorClass, 10 + dexterityModifier + constitutionModifier)
    if (dnd5eCharacterClassLevel(character, 'monk') >= 1 && !hasShield) armorClass = Math.max(armorClass, 10 + dexterityModifier + wisdomModifier)
    if (
      dnd5eCharacterClassLevel(character, 'sorcerer') >= 1 &&
      character.dnd5eClassChoices?.classes?.sorcerer?.subclass === 'draconic'
    ) armorClass = Math.max(armorClass, 13 + dexterityModifier)
  }
  const shield = character.equipment?.offHand?.dnd5e
  if (shield?.kind === 'shield') armorClass += shield.armorClassBonus
  const styles = dnd5eSelectedFightingStyles(character)
  if (armor?.kind === 'armor' && styles.includes('defense')) armorClass += 1
  armorClass += dnd5eEquippedEffectTotal(character, 'armorClassBonus')
  return Math.max(0, Math.floor(armorClass))
}

export interface Dnd5eShillelaghAttackChoice {
  weaponId: string
  spellcastingAbility: AbilityKey
  spellcastingModifier: number
  strengthModifier: number
}

export function dnd5eShillelaghAttackChoice(character: Character): Dnd5eShillelaghAttackChoice | undefined {
  const weaponId = character.equipment?.mainWeapon?.id
  if (weaponId !== 'dnd5e-club' && weaponId !== 'dnd5e-quarterstaff') return undefined
  const effect = normalizeDnd5eActiveEffects(character.dnd5eCombatState?.activeEffects).find((candidate) =>
    candidate.definitionId === 'srd-5.1:spell:shillelagh' &&
    candidate.source.rulesId === 'shillelagh' &&
    candidate.modifiers?.shillelagh?.weaponId === weaponId,
  )
  const shillelagh = effect?.modifiers?.shillelagh
  if (!shillelagh) return undefined
  return {
    ...shillelagh,
    strengthModifier: rules.abilityModifier(Math.min(30, Math.max(1, character.abilities.str))),
  }
}

export function dnd5eWeaponAttackProfile(
  character: Character,
  options?: { shillelaghAbility?: 'str' | 'spellcasting' },
): Dnd5eWeaponAttackProfile | undefined {
  const weapon = character.equipment?.mainWeapon
  const data = weapon?.dnd5e
  if (!weapon || !data || data.kind !== 'weapon') return undefined
  const properties = data.properties ?? []
  if (properties.some((property) => property.includes('双手')) && character.equipment?.offHand) return undefined
  const strengthModifier = rules.abilityModifier(Math.min(30, Math.max(1, character.abilities.str)))
  const dexterityModifier = rules.abilityModifier(Math.min(30, Math.max(1, character.abilities.dex)))
  const shillelagh = dnd5eShillelaghAttackChoice(character)
  const useSpellcastingAbility = shillelagh && options?.shillelaghAbility === 'spellcasting'
  const ability: AbilityKey = useSpellcastingAbility
    ? shillelagh.spellcastingAbility
    : shillelagh
      ? 'str'
      : data.attackAbility === 'finesse'
        ? (dexterityModifier > strengthModifier ? 'dex' : 'str')
        : data.attackAbility
  const abilityModifier = useSpellcastingAbility
    ? shillelagh.spellcastingModifier
    : ability === 'dex'
      ? dexterityModifier
      : strengthModifier
  const proficient = dnd5eWeaponProficient(character, weapon)
  const proficiency = proficient ? rules.proficiencyBonus(Math.min(20, Math.max(1, character.level))) : 0
  const styles = dnd5eSelectedFightingStyles(character)
  const versatileProperty = properties.find((property) => property.includes('多才多艺'))
  const versatileSides = Number(versatileProperty?.match(/1d(\d+)/i)?.[1] ?? 0)
  const usesTwoHands = properties.some((property) => property.includes('双手')) ||
    (!!versatileProperty && !character.equipment?.offHand)
  const attackStyleBonus = data.mode === 'ranged' && styles.includes('archery') ? 2 : 0
  const duelingBonus = data.mode === 'melee' && !usesTwoHands && styles.includes('dueling') && character.equipment?.offHand?.dnd5e?.kind !== 'weapon' ? 2 : 0
  const armor = character.equipment?.armor?.dnd5e
  const wearingHeavyArmor = armor?.kind === 'armor' && armor.category === 'heavy'
  const barbarianLevel = dnd5eCharacterClassLevel(character, 'barbarian')
  const rageBonus = barbarianLevel >= 1 &&
    character.dnd5eCombatState?.raging === true &&
    !wearingHeavyArmor &&
    data.mode === 'melee' &&
    ability === 'str'
    ? dnd5eBarbarianRageDamage(barbarianLevel)
    : 0
  const sacredWeaponBonus = dnd5eCharacterClassLevel(character, 'paladin') >= 3 &&
    (character.dnd5eCombatState?.sacredWeaponTurnsRemaining ?? 0) > 0
    ? Math.max(1, rules.abilityModifier(Math.min(30, Math.max(1, character.abilities.cha))))
    : 0
  const equipmentAttackBonus = dnd5eWeaponEffectTotal(character, 'mainWeapon', 'weaponAttackBonus')
  const equipmentDamageBonus = dnd5eWeaponEffectTotal(character, 'mainWeapon', 'weaponDamageBonus')
  return {
    weaponId: weapon.id,
    weaponName: weapon.name,
    mode: data.mode,
    attackAbility: ability,
    finesse: data.attackAbility === 'finesse',
    proficient,
    attackModifier: abilityModifier + proficiency + attackStyleBonus + sacredWeaponBonus + equipmentAttackBonus,
    criticalThreshold: fighterCriticalThreshold({
      ...character,
      level: dnd5eCharacterClassLevel(character, 'fighter'),
    }),
    greatWeaponFighting: data.mode === 'melee' && usesTwoHands && styles.includes('great-weapon-fighting'),
    properties,
    damage: {
      ...data.damage,
      sides: shillelagh ? 8 : versatileSides > 0 && usesTwoHands ? versatileSides : data.damage.sides,
      bonus: abilityModifier + duelingBonus + rageBonus + equipmentDamageBonus,
    },
    reachFeet: data.reachFeet,
    rangeFeet: data.rangeFeet,
  }
}

export function dnd5eOffHandWeaponAttackProfile(character: Character): Dnd5eWeaponAttackProfile | undefined {
  const mainData = character.equipment?.mainWeapon?.dnd5e
  const weapon = character.equipment?.offHand
  const data = weapon?.dnd5e
  if (
    !weapon || !data || data.kind !== 'weapon' || data.mode !== 'melee' ||
    !mainData || mainData.kind !== 'weapon' || mainData.mode !== 'melee' ||
    !mainData.properties?.some((property) => property.includes('轻型')) ||
    !data.properties?.some((property) => property.includes('轻型'))
  ) return undefined
  const strengthModifier = rules.abilityModifier(Math.min(30, Math.max(1, character.abilities.str)))
  const dexterityModifier = rules.abilityModifier(Math.min(30, Math.max(1, character.abilities.dex)))
  const ability: AbilityKey = data.attackAbility === 'finesse'
    ? (dexterityModifier > strengthModifier ? 'dex' : 'str')
    : data.attackAbility
  const abilityModifier = ability === 'dex' ? dexterityModifier : strengthModifier
  const proficient = dnd5eWeaponProficient(character, weapon)
  const proficiency = proficient ? rules.proficiencyBonus(Math.min(20, Math.max(1, character.level))) : 0
  const styles = dnd5eSelectedFightingStyles(character)
  const armor = character.equipment?.armor?.dnd5e
  const wearingHeavyArmor = armor?.kind === 'armor' && armor.category === 'heavy'
  const barbarianLevel = dnd5eCharacterClassLevel(character, 'barbarian')
  const rageBonus = barbarianLevel >= 1 && character.dnd5eCombatState?.raging === true &&
    !wearingHeavyArmor && ability === 'str'
    ? dnd5eBarbarianRageDamage(barbarianLevel)
    : 0
  const equipmentAttackBonus = dnd5eWeaponEffectTotal(character, 'offHand', 'weaponAttackBonus')
  const equipmentDamageBonus = dnd5eWeaponEffectTotal(character, 'offHand', 'weaponDamageBonus')
  return {
    weaponId: weapon.id,
    weaponName: weapon.name,
    mode: 'melee',
    attackAbility: ability,
    finesse: data.attackAbility === 'finesse',
    proficient,
    attackModifier: abilityModifier + proficiency + equipmentAttackBonus,
    criticalThreshold: fighterCriticalThreshold({
      ...character,
      level: dnd5eCharacterClassLevel(character, 'fighter'),
    }),
    greatWeaponFighting: false,
    properties: data.properties ?? [],
    damage: {
      ...data.damage,
      bonus: (styles.includes('two-weapon-fighting') ? abilityModifier : 0) + rageBonus + equipmentDamageBonus,
    },
    reachFeet: data.reachFeet ?? 5,
  }
}

export function dnd5eSelectedFightingStyles(character: Character): readonly string[] {
  const fighterLevel = dnd5eCharacterClassLevel(character, 'fighter')
  const styles: string[] = fighterLevel > 0 ? [...fighterSelectedFightingStyles({ ...character, level: fighterLevel })] : []
  for (const classId of ['paladin', 'ranger'] as const) {
    if (dnd5eCharacterClassLevel(character, classId) < 2) continue
    const definition = dnd5eClassDefinitionForCharacter({ charClass: classId === 'paladin' ? '圣武士' : '游侠' })
    const allowed = new Set(definition?.choiceGroups?.find((group) => group.id === 'fighting-style')?.options.map((option) => option.id) ?? [])
    styles.push(...(character.dnd5eClassChoices?.classes?.[classId]?.selections?.['fighting-style'] ?? []).filter((style) => allowed.has(style)))
  }
  return [...new Set(styles)]
}

export function dnd5eWeaponRangeFeet(profile: Dnd5eWeaponAttackProfile): number {
  return profile.mode === 'melee' ? (profile.reachFeet ?? 5) : (profile.rangeFeet?.long ?? profile.rangeFeet?.normal ?? 0)
}

export function dnd5eWeaponProficient(character: Character, weapon: EquipmentItem): boolean {
  const data = weapon.dnd5e
  if (!data || data.kind !== 'weapon') return false
  const classIds = Object.keys(normalizeDnd5eClassLevels(character))
  if (classIds.length === 0) return false
  const primaryClassId = dnd5eClassDefinitionForCharacter(character)?.id
  const multiclassIds = classIds.filter((classId) => classId !== primaryClassId)
  if (primaryClassId && new Set(['barbarian', 'fighter', 'paladin', 'ranger']).has(primaryClassId)) return true
  if (multiclassIds.some((classId) => new Set(['barbarian', 'fighter', 'paladin', 'ranger']).has(classId))) return true
  if (data.category === 'simple' && (
    !!primaryClassId && new Set(['bard', 'cleric', 'monk', 'rogue', 'warlock']).has(primaryClassId) ||
    multiclassIds.some((classId) => new Set(['barbarian', 'fighter', 'monk', 'paladin', 'ranger', 'warlock']).has(classId))
  )) return true
  const weaponId = (weapon.baseEquipmentId ?? weapon.id).replace(/-offhand$/, '')
  const special: Partial<Record<string, ReadonlySet<string>>> = {
    bard: new Set(['dnd5e-hand-crossbow', 'dnd5e-longsword', 'dnd5e-rapier', 'dnd5e-shortsword']),
    rogue: new Set(['dnd5e-hand-crossbow', 'dnd5e-longsword', 'dnd5e-rapier', 'dnd5e-shortsword']),
    monk: new Set(['dnd5e-shortsword']),
    druid: new Set(['dnd5e-club', 'dnd5e-dagger', 'dnd5e-dart', 'dnd5e-javelin', 'dnd5e-mace', 'dnd5e-quarterstaff', 'dnd5e-scimitar', 'dnd5e-sickle', 'dnd5e-sling', 'dnd5e-spear']),
    sorcerer: new Set(['dnd5e-dagger', 'dnd5e-dart', 'dnd5e-sling', 'dnd5e-quarterstaff', 'dnd5e-light-crossbow']),
    wizard: new Set(['dnd5e-dagger', 'dnd5e-dart', 'dnd5e-sling', 'dnd5e-quarterstaff', 'dnd5e-light-crossbow']),
  }
  if (primaryClassId && special[primaryClassId]?.has(weaponId)) return true
  return multiclassIds.includes('monk') && weaponId === 'dnd5e-shortsword'
}
