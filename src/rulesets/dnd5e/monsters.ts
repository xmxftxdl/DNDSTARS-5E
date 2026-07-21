import type { AbilityKey } from '../../lib/dnd'
import generatedSrdMonsterCatalog from './generated/srdMonsters.generated.json'
import { getDnd5eRoomMonster } from './roomMonsterCatalog'
import type { Dnd5eDamageType } from './damageTypes'

export { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'
export { setDnd5eRoomMonsterCatalog } from './roomMonsterCatalog'
export type Dnd5eMonsterSize = '微型' | '小型' | '中型' | '大型' | '超大型' | '巨型'
export type Dnd5eMonsterAutomation = 'headless' | 'dm-adjudication'

export interface Dnd5eMonsterDamage {
  average: number
  count: number
  sides: number
  bonus: number
  type: Dnd5eDamageType
}

export interface Dnd5eMonsterWeaponAttack {
  mode: 'melee' | 'ranged' | 'melee-or-ranged'
  toHit: number
  reachFeet?: number
  rangeFeet?: { normal: number; long: number }
  target: string
  damage: readonly Dnd5eMonsterDamage[]
  /** 群集在生命值不高于一半时使用的替代伤害。 */
  damageAtHalfHp?: readonly Dnd5eMonsterDamage[]
  onHit?: string
  onHitRule?: {
    kind: 'saving-throw-condition'
    ability: AbilityKey
    dc: number
    condition: 'prone'
  }
}

export interface Dnd5eMonsterTrait {
  name: string
  description: string
  automation?: Dnd5eMonsterAutomation
  rule?: {
    kind: 'undead-fortitude'
    dcBase: number
    excludedDamageTypes: readonly Dnd5eDamageType[]
    excludedOnCritical: boolean
  } | {
    kind: 'regeneration'
    amount: number
    requiresPositiveHp: boolean
    suppressedByDamageTypes: readonly Dnd5eDamageType[]
    diesAtZeroWhenSuppressed: boolean
  } | {
    kind: 'swarm'
    cannotRegainHitPoints: true
    cannotGainTemporaryHitPoints: true
  }
}

export interface Dnd5eMonsterActionUsage {
  kind: 'recharge'
  dieSides: number
  minimum: number
}

export interface Dnd5eMonsterAction {
  id: string
  name: string
  description: string
  kind: 'weapon-attack' | 'multiattack' | 'other'
  automation?: Dnd5eMonsterAutomation
  attack?: Dnd5eMonsterWeaponAttack
  sequence?: readonly string[]
  usage?: Dnd5eMonsterActionUsage
  legendaryCost?: number
  /** 传奇动作直接调用普通武器动作时指向其 ID。 */
  referencedActionId?: string
}

export interface Dnd5eMonsterSpellcasting {
  description: string
  casterLevel?: number
  ability?: AbilityKey
  saveDc?: number
  attackBonus?: number
  school?: string
  componentsRequired?: readonly ('V' | 'S' | 'M')[]
  slots?: Readonly<Record<string, number>>
  spells?: readonly {
    id: string
    name: string
    level: number
    usage?: { kind: 'at-will' } | { kind: 'per-day'; max: number }
  }[]
  automation: Dnd5eMonsterAutomation
}

export interface Dnd5eMonsterCapabilities {
  swarm: boolean
  shapechanger: boolean
  regeneration: boolean
  spellcaster: boolean
  legendary: boolean
  hasFlySpeed: boolean
  hasSwimSpeed: boolean
}

export interface Dnd5eMonsterStatBlock {
  id: string
  slug: string
  name: string
  englishName: string
  source: 'SRD 5.1' | 'DM 自定义'
  sourcePage?: number
  size: Dnd5eMonsterSize
  creatureType: string
  subtypes?: readonly string[]
  alignment: string
  armorClass: { value: number; note?: string }
  hitPoints: { average: number; dice: string }
  speed: { walk: number; fly?: number; swim?: number; climb?: number; burrow?: number; hover?: boolean }
  abilities: Record<AbilityKey, number>
  savingThrows?: Partial<Record<AbilityKey, number>>
  skills?: readonly { key: string; name: string; bonus: number }[]
  damageVulnerabilities?: readonly Dnd5eDamageType[]
  damageResistances?: readonly Dnd5eDamageType[]
  damageImmunities?: readonly Dnd5eDamageType[]
  conditionImmunities?: readonly string[]
  senses: readonly { name: string; distanceFeet?: number }[]
  passivePerception: number
  languages: readonly string[]
  challenge: { rating: string; xp: number }
  legendaryResistanceUses?: number
  traits: readonly Dnd5eMonsterTrait[]
  actions: readonly Dnd5eMonsterAction[]
  reactions?: readonly Dnd5eMonsterAction[]
  legendaryActions?: readonly Dnd5eMonsterAction[]
  lairActions?: readonly Dnd5eMonsterAction[]
  spellcasting?: Dnd5eMonsterSpellcasting
  capabilities?: Dnd5eMonsterCapabilities
  description: string
}

const weaponAction = (
  id: string,
  name: string,
  description: string,
  attack: Dnd5eMonsterWeaponAttack,
): Dnd5eMonsterAction => ({ id, name, description, kind: 'weapon-attack', attack })

const damage = (
  average: number,
  count: number,
  sides: number,
  bonus: number,
  type: Dnd5eDamageType,
): Dnd5eMonsterDamage => ({ average, count, sides, bonus, type })

const DND5E_CURATED_SRD_MONSTERS: readonly Dnd5eMonsterStatBlock[] = [
  {
    id: 'srd-5.1:ape', slug: 'ape', name: '猿', englishName: 'Ape', source: 'SRD 5.1', sourcePage: 366,
    size: '中型', creatureType: '野兽', alignment: '无阵营', armorClass: { value: 12 },
    hitPoints: { average: 19, dice: '3d8 + 6' }, speed: { walk: 30, climb: 30 },
    abilities: { str: 16, dex: 14, con: 14, int: 6, wis: 12, cha: 7 },
    skills: [{ key: 'athletics', name: '运动', bonus: 5 }, { key: 'perception', name: '察觉', bonus: 3 }],
    senses: [], passivePerception: 13, languages: [], challenge: { rating: '1/2', xp: 100 }, traits: [],
    actions: [
      { id: 'multiattack', name: '多重攻击', description: '猿进行两次拳击攻击。', kind: 'multiattack', sequence: ['fist', 'fist'] },
      weaponAction('fist', '拳击', '近战武器攻击：命中 +5，触及 5 尺，单一目标。命中：6（1d6 + 3）点钝击伤害。', {
        mode: 'melee', toHit: 5, reachFeet: 5, target: '单一目标', damage: [damage(6, 1, 6, 3, 'bludgeoning')],
      }),
      weaponAction('rock', '投石', '远程武器攻击：命中 +5，射程 25/50 尺，单一目标。命中：6（1d6 + 3）点钝击伤害。', {
        mode: 'ranged', toHit: 5, rangeFeet: { normal: 25, long: 50 }, target: '单一目标', damage: [damage(6, 1, 6, 3, 'bludgeoning')],
      }),
    ],
    description: '强壮而灵活的中型野兽，能以拳击或投石攻击。',
  },
  {
    id: 'srd-5.1:badger', slug: 'badger', name: '獾', englishName: 'Badger', source: 'SRD 5.1', sourcePage: 367,
    size: '微型', creatureType: '野兽', alignment: '无阵营', armorClass: { value: 10 },
    hitPoints: { average: 3, dice: '1d4 + 1' }, speed: { walk: 20, burrow: 5 },
    abilities: { str: 4, dex: 11, con: 12, int: 2, wis: 12, cha: 5 },
    senses: [{ name: '黑暗视觉', distanceFeet: 30 }], passivePerception: 11, languages: [], challenge: { rating: '0', xp: 10 },
    traits: [{ name: '敏锐嗅觉', description: '獾依赖嗅觉进行的感知（察觉）检定具有优势。' }],
    actions: [weaponAction('bite', '啃咬', '近战武器攻击：命中 +2，触及 5 尺，单一目标。命中：1 点穿刺伤害。', {
      mode: 'melee', toHit: 2, reachFeet: 5, target: '单一目标', damage: [damage(1, 0, 4, 1, 'piercing')],
    })],
    description: '擅长掘穴、依赖敏锐嗅觉活动的微型野兽。',
  },
  {
    id: 'srd-5.1:bat', slug: 'bat', name: '蝙蝠', englishName: 'Bat', source: 'SRD 5.1', sourcePage: 367,
    size: '微型', creatureType: '野兽', alignment: '无阵营', armorClass: { value: 12 },
    hitPoints: { average: 1, dice: '1d4 − 1' }, speed: { walk: 5, fly: 30 },
    abilities: { str: 2, dex: 15, con: 8, int: 2, wis: 12, cha: 4 },
    senses: [{ name: '盲视', distanceFeet: 60 }], passivePerception: 11, languages: [], challenge: { rating: '0', xp: 10 },
    traits: [
      { name: '回声定位', description: '蝙蝠耳聋时无法使用其盲视。' },
      { name: '敏锐听觉', description: '蝙蝠依赖听觉进行的感知（察觉）检定具有优势。' },
    ],
    actions: [weaponAction('bite', '啃咬', '近战武器攻击：命中 +0，触及 5 尺，单一生物。命中：1 点穿刺伤害。', {
      mode: 'melee', toHit: 0, reachFeet: 5, target: '单一生物', damage: [damage(1, 0, 4, 1, 'piercing')],
    })],
    description: '通过回声定位感知周围环境的飞行野兽。',
  },
  {
    id: 'srd-5.1:black-bear', slug: 'black-bear', name: '黑熊', englishName: 'Black Bear', source: 'SRD 5.1', sourcePage: 368,
    size: '中型', creatureType: '野兽', alignment: '无阵营', armorClass: { value: 11, note: '天生护甲' },
    hitPoints: { average: 19, dice: '3d8 + 6' }, speed: { walk: 40, climb: 30 },
    abilities: { str: 15, dex: 10, con: 14, int: 2, wis: 12, cha: 7 },
    skills: [{ key: 'perception', name: '察觉', bonus: 3 }], senses: [], passivePerception: 13, languages: [],
    challenge: { rating: '1/2', xp: 100 },
    traits: [{ name: '敏锐嗅觉', description: '黑熊依赖嗅觉进行的感知（察觉）检定具有优势。' }],
    actions: [
      { id: 'multiattack', name: '多重攻击', description: '黑熊进行两次攻击：一次啃咬与一次爪击。', kind: 'multiattack', sequence: ['bite', 'claws'] },
      weaponAction('bite', '啃咬', '近战武器攻击：命中 +3，触及 5 尺，单一目标。命中：5（1d6 + 2）点穿刺伤害。', {
        mode: 'melee', toHit: 3, reachFeet: 5, target: '单一目标', damage: [damage(5, 1, 6, 2, 'piercing')],
      }),
      weaponAction('claws', '爪击', '近战武器攻击：命中 +3，触及 5 尺，单一目标。命中：7（2d4 + 2）点挥砍伤害。', {
        mode: 'melee', toHit: 3, reachFeet: 5, target: '单一目标', damage: [damage(7, 2, 4, 2, 'slashing')],
      }),
    ],
    description: '依靠敏锐嗅觉觅食与追踪的中型熊类。',
  },
  {
    id: 'srd-5.1:brown-bear', slug: 'brown-bear', name: '棕熊', englishName: 'Brown Bear', source: 'SRD 5.1', sourcePage: 369,
    size: '大型', creatureType: '野兽', alignment: '无阵营', armorClass: { value: 11, note: '天生护甲' },
    hitPoints: { average: 34, dice: '4d10 + 12' }, speed: { walk: 40, climb: 30 },
    abilities: { str: 19, dex: 10, con: 16, int: 2, wis: 13, cha: 7 },
    skills: [{ key: 'perception', name: '察觉', bonus: 3 }], senses: [], passivePerception: 13, languages: [],
    challenge: { rating: '1', xp: 200 },
    traits: [{ name: '敏锐嗅觉', description: '棕熊依赖嗅觉进行的感知（察觉）检定具有优势。' }],
    actions: [
      { id: 'multiattack', name: '多重攻击', description: '棕熊进行两次攻击：一次啃咬与一次爪击。', kind: 'multiattack', sequence: ['bite', 'claws'] },
      weaponAction('bite', '啃咬', '近战武器攻击：命中 +5，触及 5 尺，单一目标。命中：8（1d8 + 4）点穿刺伤害。', {
        mode: 'melee', toHit: 5, reachFeet: 5, target: '单一目标', damage: [damage(8, 1, 8, 4, 'piercing')],
      }),
      weaponAction('claws', '爪击', '近战武器攻击：命中 +5，触及 5 尺，单一目标。命中：11（2d6 + 4）点挥砍伤害。', {
        mode: 'melee', toHit: 5, reachFeet: 5, target: '单一目标', damage: [damage(11, 2, 6, 4, 'slashing')],
      }),
    ],
    description: '体型庞大、力量惊人的熊类野兽。',
  },
  {
    id: 'srd-5.1:cat', slug: 'cat', name: '猫', englishName: 'Cat', source: 'SRD 5.1', sourcePage: 369,
    size: '微型', creatureType: '野兽', alignment: '无阵营', armorClass: { value: 12 },
    hitPoints: { average: 2, dice: '1d4' }, speed: { walk: 40, climb: 30 },
    abilities: { str: 3, dex: 15, con: 10, int: 3, wis: 12, cha: 7 },
    skills: [{ key: 'perception', name: '察觉', bonus: 3 }, { key: 'stealth', name: '隐匿', bonus: 4 }],
    senses: [], passivePerception: 13, languages: [], challenge: { rating: '0', xp: 10 },
    traits: [{ name: '敏锐嗅觉', description: '猫依赖嗅觉进行的感知（察觉）检定具有优势。' }],
    actions: [weaponAction('claws', '爪击', '近战武器攻击：命中 +0，触及 5 尺，单一目标。命中：1 点挥砍伤害。', {
      mode: 'melee', toHit: 0, reachFeet: 5, target: '单一目标', damage: [damage(1, 0, 4, 1, 'slashing')],
    })],
    description: '敏捷、善于攀爬和潜行的微型野兽。',
  },
  {
    id: 'srd-5.1:frog', slug: 'frog', name: '青蛙', englishName: 'Frog', source: 'SRD 5.1', sourcePage: 373,
    size: '微型', creatureType: '野兽', alignment: '无阵营', armorClass: { value: 11 },
    hitPoints: { average: 1, dice: '1d4 − 1' }, speed: { walk: 20, swim: 20 },
    abilities: { str: 1, dex: 13, con: 8, int: 1, wis: 8, cha: 3 },
    skills: [{ key: 'perception', name: '察觉', bonus: 1 }, { key: 'stealth', name: '隐匿', bonus: 3 }],
    senses: [{ name: '黑暗视觉', distanceFeet: 30 }], passivePerception: 11, languages: [], challenge: { rating: '0', xp: 0 },
    traits: [
      { name: '两栖', description: '青蛙可以呼吸空气和水。' },
      { name: '立定跳远', description: '青蛙无论是否助跑，跳远距离至多10尺，跳高距离至多5尺。' },
    ],
    actions: [], description: '没有有效攻击能力的两栖微型野兽，其数据也可代表蟾蜍。',
  },
  {
    id: 'srd-5.1:giant-rat', slug: 'giant-rat', name: '巨鼠', englishName: 'Giant Rat', source: 'SRD 5.1', sourcePage: 378,
    size: '小型', creatureType: '野兽', alignment: '无阵营', armorClass: { value: 12 },
    hitPoints: { average: 7, dice: '2d6' }, speed: { walk: 30 },
    abilities: { str: 7, dex: 15, con: 11, int: 2, wis: 10, cha: 4 },
    senses: [{ name: '黑暗视觉', distanceFeet: 60 }], passivePerception: 10, languages: [], challenge: { rating: '1/8', xp: 25 },
    traits: [
      { name: '敏锐嗅觉', description: '巨鼠依赖嗅觉进行的感知（察觉）检定具有优势。' },
      { name: '集群战术', description: '若目标5尺内至少有一个未失能的巨鼠盟友，巨鼠对该目标的攻击检定具有优势。' },
    ],
    actions: [weaponAction('bite', '啃咬', '近战武器攻击：命中 +4，触及 5 尺，单一目标。命中：4（1d4 + 2）点穿刺伤害。', {
      mode: 'melee', toHit: 4, reachFeet: 5, target: '单一目标', damage: [damage(4, 1, 4, 2, 'piercing')],
    })],
    description: '在阴暗环境中成群活动的大型啮齿野兽。',
  },
  {
    id: 'srd-5.1:panther', slug: 'panther', name: '黑豹', englishName: 'Panther', source: 'SRD 5.1', sourcePage: 385,
    size: '中型', creatureType: '野兽', alignment: '无阵营', armorClass: { value: 12 },
    hitPoints: { average: 13, dice: '3d8' }, speed: { walk: 50, climb: 40 },
    abilities: { str: 14, dex: 15, con: 10, int: 3, wis: 14, cha: 7 },
    skills: [{ key: 'perception', name: '察觉', bonus: 4 }, { key: 'stealth', name: '隐匿', bonus: 6 }],
    senses: [], passivePerception: 14, languages: [], challenge: { rating: '1/4', xp: 50 },
    traits: [
      { name: '敏锐嗅觉', description: '黑豹依赖嗅觉进行的感知（察觉）检定具有优势。' },
      { name: '猛扑', description: '黑豹直线移动至少20尺后以爪击命中生物时，目标须通过DC 12力量豁免，否则倒地；若目标倒地，黑豹可用附赠动作对其进行一次啃咬。' },
    ],
    actions: [
      weaponAction('bite', '啃咬', '近战武器攻击：命中 +4，触及 5 尺，单一目标。命中：5（1d6 + 2）点穿刺伤害。', {
        mode: 'melee', toHit: 4, reachFeet: 5, target: '单一目标', damage: [damage(5, 1, 6, 2, 'piercing')],
      }),
      weaponAction('claw', '爪击', '近战武器攻击：命中 +4，触及 5 尺，单一目标。命中：4（1d4 + 2）点挥砍伤害。', {
        mode: 'melee', toHit: 4, reachFeet: 5, target: '单一目标', damage: [damage(4, 1, 4, 2, 'slashing')],
      }),
    ],
    description: '善于潜行、攀爬和猛扑的中型猫科野兽。',
  },
  {
    id: 'srd-5.1:bandit',
    slug: 'bandit',
    name: '强盗',
    englishName: 'Bandit',
    source: 'SRD 5.1',
    sourcePage: 396,
    size: '中型',
    creatureType: '类人生物',
    subtypes: ['任意种族'],
    alignment: '任意非守序阵营',
    armorClass: { value: 12, note: '皮甲' },
    hitPoints: { average: 11, dice: '2d8 + 2' },
    speed: { walk: 30 },
    abilities: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
    senses: [],
    passivePerception: 10,
    languages: ['任意一种语言（通常为通用语）'],
    challenge: { rating: '1/8', xp: 25 },
    traits: [],
    actions: [
      weaponAction('scimitar', '弯刀', '近战武器攻击：命中 +3，触及 5 尺，单一目标。命中：4（1d6 + 1）点挥砍伤害。', {
        mode: 'melee', toHit: 3, reachFeet: 5, target: '单一目标', damage: [damage(4, 1, 6, 1, 'slashing')],
      }),
      weaponAction('light-crossbow', '轻弩', '远程武器攻击：命中 +3，射程 80/320 尺，单一目标。命中：5（1d8 + 1）点穿刺伤害。', {
        mode: 'ranged', toHit: 3, rangeFeet: { normal: 80, long: 320 }, target: '单一目标', damage: [damage(5, 1, 8, 1, 'piercing')],
      }),
    ],
    description: '结伙行动的武装劫掠者；并非所有强盗都是邪恶阵营。',
  },
  {
    id: 'srd-5.1:kobold',
    slug: 'kobold',
    name: '狗头人',
    englishName: 'Kobold',
    source: 'SRD 5.1',
    sourcePage: 324,
    size: '小型',
    creatureType: '类人生物',
    subtypes: ['狗头人'],
    alignment: '守序邪恶',
    armorClass: { value: 12 },
    hitPoints: { average: 5, dice: '2d6 − 2' },
    speed: { walk: 30 },
    abilities: { str: 7, dex: 15, con: 9, int: 8, wis: 7, cha: 8 },
    senses: [{ name: '黑暗视觉', distanceFeet: 60 }],
    passivePerception: 8,
    languages: ['通用语', '龙语'],
    challenge: { rating: '1/8', xp: 25 },
    traits: [
      { name: '阳光敏感', description: '处于阳光下时，狗头人的攻击检定以及依赖视觉的感知（察觉）检定具有劣势。' },
      { name: '集群战术', description: '若目标生物 5 尺内至少有一个未失能的狗头人盟友，狗头人对该目标的攻击检定具有优势。' },
    ],
    actions: [
      weaponAction('dagger', '匕首', '近战武器攻击：命中 +4，触及 5 尺，单一目标。命中：4（1d4 + 2）点穿刺伤害。', {
        mode: 'melee', toHit: 4, reachFeet: 5, target: '单一目标', damage: [damage(4, 1, 4, 2, 'piercing')],
      }),
      weaponAction('sling', '投石索', '远程武器攻击：命中 +4，射程 30/120 尺，单一目标。命中：4（1d4 + 2）点钝击伤害。', {
        mode: 'ranged', toHit: 4, rangeFeet: { normal: 30, long: 120 }, target: '单一目标', damage: [damage(4, 1, 4, 2, 'bludgeoning')],
      }),
    ],
    description: '依靠数量、伏击和集群战术作战的小型类人生物。',
  },
  {
    id: 'srd-5.1:goblin',
    slug: 'goblin',
    name: '哥布林',
    englishName: 'Goblin',
    source: 'SRD 5.1',
    sourcePage: 315,
    size: '小型',
    creatureType: '类人生物',
    subtypes: ['类地精'],
    alignment: '中立邪恶',
    armorClass: { value: 15, note: '皮甲、盾牌' },
    hitPoints: { average: 7, dice: '2d6' },
    speed: { walk: 30 },
    abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    skills: [{ key: 'stealth', name: '隐匿', bonus: 6 }],
    senses: [{ name: '黑暗视觉', distanceFeet: 60 }],
    passivePerception: 9,
    languages: ['通用语', '地精语'],
    challenge: { rating: '1/4', xp: 50 },
    traits: [
      { name: '灵巧逃脱', description: '哥布林可在自己的每个回合以附赠动作执行撤离或躲藏动作。' },
    ],
    actions: [
      weaponAction('scimitar', '弯刀', '近战武器攻击：命中 +4，触及 5 尺，单一目标。命中：5（1d6 + 2）点挥砍伤害。', {
        mode: 'melee', toHit: 4, reachFeet: 5, target: '单一目标', damage: [damage(5, 1, 6, 2, 'slashing')],
      }),
      weaponAction('shortbow', '短弓', '远程武器攻击：命中 +4，射程 80/320 尺，单一目标。命中：5（1d6 + 2）点穿刺伤害。', {
        mode: 'ranged', toHit: 4, rangeFeet: { normal: 80, long: 320 }, target: '单一目标', damage: [damage(5, 1, 6, 2, 'piercing')],
      }),
    ],
    description: '敏捷的小型类人生物，善于突袭后撤离或躲藏。',
  },
  {
    id: 'srd-5.1:skeleton',
    slug: 'skeleton',
    name: '骷髅',
    englishName: 'Skeleton',
    source: 'SRD 5.1',
    sourcePage: 346,
    size: '中型',
    creatureType: '亡灵',
    alignment: '守序邪恶',
    armorClass: { value: 13, note: '护甲残片' },
    hitPoints: { average: 13, dice: '2d8 + 4' },
    speed: { walk: 30 },
    abilities: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
    damageVulnerabilities: ['bludgeoning'],
    damageImmunities: ['poison'],
    conditionImmunities: ['力竭', '中毒'],
    senses: [{ name: '黑暗视觉', distanceFeet: 60 }],
    passivePerception: 9,
    languages: ['理解生前掌握的所有语言，但无法说话'],
    challenge: { rating: '1/4', xp: 50 },
    traits: [],
    actions: [
      weaponAction('shortsword', '短剑', '近战武器攻击：命中 +4，触及 5 尺，单一目标。命中：5（1d6 + 2）点穿刺伤害。', {
        mode: 'melee', toHit: 4, reachFeet: 5, target: '单一目标', damage: [damage(5, 1, 6, 2, 'piercing')],
      }),
      weaponAction('shortbow', '短弓', '远程武器攻击：命中 +4，射程 80/320 尺，单一目标。命中：5（1d6 + 2）点穿刺伤害。', {
        mode: 'ranged', toHit: 4, rangeFeet: { normal: 80, long: 320 }, target: '单一目标', damage: [damage(5, 1, 6, 2, 'piercing')],
      }),
    ],
    description: '由亡灵力量驱动的骸骨，免疫毒素，但惧怕钝击。',
  },
  {
    id: 'srd-5.1:zombie',
    slug: 'zombie',
    name: '僵尸',
    englishName: 'Zombie',
    source: 'SRD 5.1',
    sourcePage: 356,
    size: '中型',
    creatureType: '亡灵',
    alignment: '中立邪恶',
    armorClass: { value: 8 },
    hitPoints: { average: 22, dice: '3d8 + 9' },
    speed: { walk: 20 },
    abilities: { str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5 },
    savingThrows: { wis: 0 },
    damageImmunities: ['poison'],
    conditionImmunities: ['中毒'],
    senses: [{ name: '黑暗视觉', distanceFeet: 60 }],
    passivePerception: 8,
    languages: ['理解生前掌握的语言，但无法说话'],
    challenge: { rating: '1/4', xp: 50 },
    traits: [
      {
        name: '亡灵坚韧',
        description: '伤害令僵尸降至 0 HP 时，它进行一次体质豁免，DC 为 5 + 所受伤害；若伤害为光耀伤害或来自重击则不能触发。成功时改为降至 1 HP。',
        rule: { kind: 'undead-fortitude', dcBase: 5, excludedDamageTypes: ['radiant'], excludedOnCritical: true },
      },
    ],
    actions: [
      weaponAction('slam', '猛击', '近战武器攻击：命中 +3，触及 5 尺，单一目标。命中：4（1d6 + 1）点钝击伤害。', {
        mode: 'melee', toHit: 3, reachFeet: 5, target: '单一目标', damage: [damage(4, 1, 6, 1, 'bludgeoning')],
      }),
    ],
    description: '行动迟缓却难以彻底击倒的亡灵。',
  },
  {
    id: 'srd-5.1:wolf',
    slug: 'wolf',
    name: '狼',
    englishName: 'Wolf',
    source: 'SRD 5.1',
    sourcePage: 393,
    size: '中型',
    creatureType: '野兽',
    alignment: '无阵营',
    armorClass: { value: 13, note: '天生护甲' },
    hitPoints: { average: 11, dice: '2d8 + 2' },
    speed: { walk: 40 },
    abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    skills: [
      { key: 'perception', name: '察觉', bonus: 3 },
      { key: 'stealth', name: '隐匿', bonus: 4 },
    ],
    senses: [],
    passivePerception: 13,
    languages: [],
    challenge: { rating: '1/4', xp: 50 },
    traits: [
      { name: '敏锐听觉与嗅觉', description: '狼依赖听觉或嗅觉进行的感知（察觉）检定具有优势。' },
      { name: '集群战术', description: '若目标生物 5 尺内至少有一个未失能的狼之盟友，狼对该目标的攻击检定具有优势。' },
    ],
    actions: [
      weaponAction('bite', '啃咬', '近战武器攻击：命中 +4，触及 5 尺，单一目标。命中：7（2d4 + 2）点穿刺伤害。若目标是生物，则必须通过 DC 11 力量豁免，否则倒地。', {
        mode: 'melee', toHit: 4, reachFeet: 5, target: '单一目标', damage: [damage(7, 2, 4, 2, 'piercing')],
        onHit: '目标进行 DC 11 力量豁免，失败则倒地。',
        onHitRule: { kind: 'saving-throw-condition', ability: 'str', dc: 11, condition: 'prone' },
      }),
    ],
    description: '依靠敏锐感官和集群战术狩猎的野兽。',
  },
  {
    id: 'srd-5.1:orc',
    slug: 'orc',
    name: '兽人',
    englishName: 'Orc',
    source: 'SRD 5.1',
    sourcePage: 339,
    size: '中型',
    creatureType: '类人生物',
    subtypes: ['兽人'],
    alignment: '混乱邪恶',
    armorClass: { value: 13, note: '兽皮甲' },
    hitPoints: { average: 15, dice: '2d8 + 6' },
    speed: { walk: 30 },
    abilities: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
    skills: [{ key: 'intimidation', name: '威吓', bonus: 2 }],
    senses: [{ name: '黑暗视觉', distanceFeet: 60 }],
    passivePerception: 10,
    languages: ['通用语', '兽人语'],
    challenge: { rating: '1/2', xp: 100 },
    traits: [
      { name: '凶猛', description: '兽人可以用附赠动作向一个它能看见的敌对生物移动至多等同其速度的距离。' },
    ],
    actions: [
      weaponAction('greataxe', '巨斧', '近战武器攻击：命中 +5，触及 5 尺，单一目标。命中：9（1d12 + 3）点挥砍伤害。', {
        mode: 'melee', toHit: 5, reachFeet: 5, target: '单一目标', damage: [damage(9, 1, 12, 3, 'slashing')],
      }),
      weaponAction('javelin', '标枪', '近战或远程武器攻击：命中 +5，触及 5 尺或射程 30/120 尺，单一目标。命中：6（1d6 + 3）点穿刺伤害。', {
        mode: 'melee-or-ranged', toHit: 5, reachFeet: 5, rangeFeet: { normal: 30, long: 120 }, target: '单一目标', damage: [damage(6, 1, 6, 3, 'piercing')],
      }),
    ],
    description: '强壮而好战的类人生物，能迅速逼近敌人。',
  },
  {
    id: 'srd-5.1:dire-wolf',
    slug: 'dire-wolf',
    name: '恐狼',
    englishName: 'Dire Wolf',
    source: 'SRD 5.1',
    sourcePage: 371,
    size: '大型',
    creatureType: '野兽',
    alignment: '无阵营',
    armorClass: { value: 14, note: '天生护甲' },
    hitPoints: { average: 37, dice: '5d10 + 10' },
    speed: { walk: 50 },
    abilities: { str: 17, dex: 15, con: 15, int: 3, wis: 12, cha: 7 },
    skills: [
      { key: 'perception', name: '察觉', bonus: 3 },
      { key: 'stealth', name: '隐匿', bonus: 4 },
    ],
    senses: [],
    passivePerception: 13,
    languages: [],
    challenge: { rating: '1', xp: 200 },
    traits: [
      { name: '敏锐听觉与嗅觉', description: '恐狼依赖听觉或嗅觉进行的感知（察觉）检定具有优势。' },
      { name: '集群战术', description: '若目标生物 5 尺内至少有一个未失能的恐狼之盟友，恐狼对该目标的攻击检定具有优势。' },
    ],
    actions: [
      weaponAction('bite', '啃咬', '近战武器攻击：命中 +5，触及 5 尺，单一目标。命中：10（2d6 + 3）点穿刺伤害。若目标是生物，则必须通过 DC 13 力量豁免，否则倒地。', {
        mode: 'melee', toHit: 5, reachFeet: 5, target: '单一目标', damage: [damage(10, 2, 6, 3, 'piercing')],
        onHit: '目标进行 DC 13 力量豁免，失败则倒地。',
        onHitRule: { kind: 'saving-throw-condition', ability: 'str', dc: 13, condition: 'prone' },
      }),
    ],
    description: '体型巨大的群居掠食者，擅长将猎物扑倒。',
  },
  {
    id: 'srd-5.1:ogre',
    slug: 'ogre',
    name: '食人魔',
    englishName: 'Ogre',
    source: 'SRD 5.1',
    sourcePage: 336,
    size: '大型',
    creatureType: '巨人',
    alignment: '混乱邪恶',
    armorClass: { value: 11, note: '兽皮甲' },
    hitPoints: { average: 59, dice: '7d10 + 21' },
    speed: { walk: 40 },
    abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
    senses: [{ name: '黑暗视觉', distanceFeet: 60 }],
    passivePerception: 8,
    languages: ['通用语', '巨人语'],
    challenge: { rating: '2', xp: 450 },
    traits: [],
    actions: [
      weaponAction('greatclub', '巨棒', '近战武器攻击：命中 +6，触及 5 尺，单一目标。命中：13（2d8 + 4）点钝击伤害。', {
        mode: 'melee', toHit: 6, reachFeet: 5, target: '单一目标', damage: [damage(13, 2, 8, 4, 'bludgeoning')],
      }),
      weaponAction('javelin', '标枪', '近战或远程武器攻击：命中 +6，触及 5 尺或射程 30/120 尺，单一目标。命中：11（2d6 + 4）点穿刺伤害。', {
        mode: 'melee-or-ranged', toHit: 6, reachFeet: 5, rangeFeet: { normal: 30, long: 120 }, target: '单一目标', damage: [damage(11, 2, 6, 4, 'piercing')],
      }),
    ],
    description: '体型庞大、力量惊人的巨人。',
  },
  {
    id: 'srd-5.1:owlbear',
    slug: 'owlbear',
    name: '枭熊',
    englishName: 'Owlbear',
    source: 'SRD 5.1',
    sourcePage: 339,
    size: '大型',
    creatureType: '怪兽',
    alignment: '无阵营',
    armorClass: { value: 13, note: '天生护甲' },
    hitPoints: { average: 59, dice: '7d10 + 21' },
    speed: { walk: 40 },
    abilities: { str: 20, dex: 12, con: 17, int: 3, wis: 12, cha: 7 },
    skills: [{ key: 'perception', name: '察觉', bonus: 3 }],
    senses: [{ name: '黑暗视觉', distanceFeet: 60 }],
    passivePerception: 13,
    languages: [],
    challenge: { rating: '3', xp: 700 },
    traits: [
      { name: '敏锐视觉与嗅觉', description: '枭熊依赖视觉或嗅觉进行的感知（察觉）检定具有优势。' },
    ],
    actions: [
      { id: 'multiattack', name: '多重攻击', description: '枭熊发动两次攻击：一次喙击和一次爪击。', kind: 'multiattack', sequence: ['beak', 'claws'] },
      weaponAction('beak', '喙击', '近战武器攻击：命中 +7，触及 5 尺，单一生物。命中：10（1d10 + 5）点穿刺伤害。', {
        mode: 'melee', toHit: 7, reachFeet: 5, target: '单一生物', damage: [damage(10, 1, 10, 5, 'piercing')],
      }),
      weaponAction('claws', '爪击', '近战武器攻击：命中 +7，触及 5 尺，单一目标。命中：14（2d8 + 5）点挥砍伤害。', {
        mode: 'melee', toHit: 7, reachFeet: 5, target: '单一目标', damage: [damage(14, 2, 8, 5, 'slashing')],
      }),
    ],
    description: '兼具猛禽与巨熊特征的凶猛怪兽。',
  },
] as const

interface GeneratedDnd5eMonsterCatalog {
  schemaVersion: 1
  count: number
  source: {
    rules: string
    rulesUrl: string
    license: string
    transcription: string
    transcriptionCommit: string
    transcriptionUrl: string
  }
  monsters: readonly Dnd5eMonsterStatBlock[]
}

export const DND5E_SRD_MONSTER_CATALOG_METADATA = generatedSrdMonsterCatalog as unknown as GeneratedDnd5eMonsterCatalog
const CURATED_MONSTERS_BY_SLUG = new Map(DND5E_CURATED_SRD_MONSTERS.map((monster) => [monster.slug, monster]))

/**
 * Complete SRD 5.1 catalog. The hand-reviewed Chinese entries override the
 * generated transcription by slug; the remaining entries retain the exact
 * English SRD prose and explicit automation boundaries.
 */
export const DND5E_SRD_MONSTERS: readonly Dnd5eMonsterStatBlock[] =
  DND5E_SRD_MONSTER_CATALOG_METADATA.monsters.map((monster) => CURATED_MONSTERS_BY_SLUG.get(monster.slug) ?? monster)

const MONSTERS_BY_ID = new Map(DND5E_SRD_MONSTERS.map((monster) => [monster.id, monster]))
const MONSTERS_BY_SLUG = new Map(DND5E_SRD_MONSTERS.map((monster) => [monster.slug, monster]))

export function getDnd5eSrdMonster(id: string): Dnd5eMonsterStatBlock | undefined {
  return getDnd5eRoomMonster(id) ?? MONSTERS_BY_ID.get(id)
}

export function getDnd5eSrdMonsterBySlug(slug: string): Dnd5eMonsterStatBlock | undefined {
  return MONSTERS_BY_SLUG.get(slug)
}

export function searchDnd5eSrdMonsters(query: string): readonly Dnd5eMonsterStatBlock[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return DND5E_SRD_MONSTERS
  return DND5E_SRD_MONSTERS.filter((monster) => [
    monster.name,
    monster.englishName,
    monster.creatureType,
    monster.alignment,
    monster.challenge.rating,
    ...monster.subtypes ?? [],
  ].some((value) => value.toLowerCase().includes(normalized)))
}

export function dnd5eMonsterProficiencyBonus(challengeRating: string): number {
  const rating = challengeRating.includes('/')
    ? Number(challengeRating.split('/')[0]) / Number(challengeRating.split('/')[1])
    : Number(challengeRating)
  if (!Number.isFinite(rating) || rating <= 4) return 2
  if (rating <= 8) return 3
  if (rating <= 12) return 4
  if (rating <= 16) return 5
  if (rating <= 20) return 6
  if (rating <= 24) return 7
  if (rating <= 28) return 8
  return 9
}

/** The map pathfinder distinguishes ground, climb, and swim terrain. */
export function dnd5eMonsterMapSpeed(monster: Dnd5eMonsterStatBlock): number {
  return Math.max(monster.speed.walk, monster.speed.fly ?? 0, monster.speed.swim ?? 0, monster.speed.climb ?? 0)
}

export function dnd5eMonsterSpeedText(monster: Dnd5eMonsterStatBlock): string {
  const values = [`${monster.speed.walk} 尺`]
  if (monster.speed.fly != null) values.push(`飞行 ${monster.speed.fly} 尺${monster.speed.hover ? '（悬浮）' : ''}`)
  if (monster.speed.swim != null) values.push(`游泳 ${monster.speed.swim} 尺`)
  if (monster.speed.climb != null) values.push(`攀爬 ${monster.speed.climb} 尺`)
  if (monster.speed.burrow != null) values.push(`掘穴 ${monster.speed.burrow} 尺`)
  return values.join('，')
}

export function dnd5eMonsterDamageDice(value: Dnd5eMonsterDamage): string {
  if (value.bonus === 0) return `${value.count}d${value.sides}`
  return `${value.count}d${value.sides}${value.bonus > 0 ? '+' : ''}${value.bonus}`
}
