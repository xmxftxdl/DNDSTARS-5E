import type { Character } from '../../types/character'
import type { CharacterEquipment, EquipmentItem, EquipmentSlot } from '../../types/equipment'
import type {
  Dnd5eInventory,
  Dnd5eAmmunitionKind,
  Dnd5eCurrencyWallet,
  Dnd5eInventoryEntry,
  Dnd5eInventoryGrant,
  Dnd5eInventoryItemTemplate,
  Dnd5eInventoryMutation,
  Dnd5eInventoryMutationResult,
  Dnd5eInventoryResourceDefinition,
  Dnd5eInventoryResourceState,
} from '../../types/inventory'
import { DND5E_INVENTORY_SCHEMA_VERSION } from '../../types/inventory'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { equipmentSlotAcceptsItemSlot, isEquipmentSlot } from '../../lib/equipmentDefaults'
import { dnd5eActiveCarryingCapacityMultiplier } from './activeEffects'
import {
  appendRollLedgerEntry,
  commitCombatTransaction,
  rollbackCombatTransaction,
  type CombatTransaction,
} from '../../lib/combatTransaction'
import { DND5E_SRD_EQUIPMENT_CATALOG } from './equipment'
import {
  DND5E_MAGIC_ITEM_RARITY_LABELS,
  DND5E_SRD_MAGIC_ITEM_TEMPLATES,
} from './magicItems'
import { dnd5ePluginItemDefinition, registeredDnd5ePluginItems } from './pluginApi'
import { DND5E_SRD_CLASS_DEFINITIONS, dnd5eClassDefinition, dnd5eIgnoresMagicItemRequirements } from './classes'
import { dnd5eCharacterClassLevel, normalizeDnd5eClassLevels } from './multiclass'
import { projectDnd5eActiveEffectState } from './activeEffects'
import { dnd5eRageFeatureCarryingCapacityMultiplier } from './rageFeature'
import { DND5E_SRD_SPELL_MATERIAL_ITEM_TEMPLATES } from './spellMaterials'
import type { Dnd5eActivityCapabilityProposal } from './activities/dnd5eActivityExecutor'
import { dnd5eLinkedPlanarObjectAuthorityRecordId } from './spellAuthorityState'

const SRD_SOURCE = { book: 'SRD 5.1' as const, license: 'CC BY 4.0' as const }
const EMPTY_CURRENCY: Dnd5eCurrencyWallet = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }

const CONTAINER_CAPACITY_WEIGHT_LB: Readonly<Record<string, number>> = {
  backpack: 30,
  chest: 300,
  'map-scroll-case': 1,
  'alms-box': 5,
  'component-pouch': 6,
  'coin-pouch-15gp': 6,
}

const AMMUNITION_KIND_BY_ITEM_ID: Readonly<Record<string, Dnd5eAmmunitionKind>> = {
  arrows: 'arrow',
  'crossbow-bolts': 'crossbow-bolt',
  'sling-bullets': 'sling-bullet',
  'blowgun-needles': 'blowgun-needle',
}

const AMMUNITION_KIND_BY_WEAPON_ID: Readonly<Record<string, Dnd5eAmmunitionKind>> = {
  'dnd5e-longbow': 'arrow',
  'dnd5e-shortbow': 'arrow',
  'dnd5e-light-crossbow': 'crossbow-bolt',
  'dnd5e-hand-crossbow': 'crossbow-bolt',
  'dnd5e-heavy-crossbow': 'crossbow-bolt',
  'dnd5e-sling': 'sling-bullet',
  'dnd5e-blowgun': 'blowgun-needle',
}

function equipmentRulesText(item: EquipmentItem): string {
  const rules = item.dnd5e
  const focusText = equipmentSpellcastingFocusText(item)
  if (!rules) {
    const effects = equipmentEffectsText(item)
    return effects
      ? `该装备不会替换基础武器伤害或护甲公式。${effects}${focusText}`
      : `该装备占用${equipmentSlotLabel(item.slot)}栏位，但没有声明攻击、护甲或数值加成。${focusText || '装备后仅作为所穿戴或持用的物件记录。'}`
  }
  if (item.id === 'dnd5e-net') {
    return [
      '军用远程武器，射程 5/15 尺。投掷：5 尺以内属于普通射程，5–15 尺属于远射程，超过 15 尺无法攻击。特殊：使用捕网进行攻击时，无论你通常能进行多少次攻击，该动作、附赠动作或反应中都只能进行一次捕网攻击。',
      '命中大型或更小且并非无定形的生物时，目标陷入束缚；捕网不会造成伤害。被束缚的生物或其触及范围内的另一生物可以使用一个动作进行 DC 10 力量检定，成功便挣脱。',
      '捕网的 AC 为 10；对其造成 5 点挥砍伤害也会摧毁捕网并释放目标，超出的伤害不会传递给目标。由于通常在 5 尺内进行远程攻击会具有劣势，而超过 5 尺又属于远射程，捕网攻击通常会具有劣势。',
    ].join('\n\n')
  }
  if (rules.kind === 'shield') return `盾牌。持用时护甲等级 +${rules.armorClassBonus}。同一时间只能从一面盾牌获得该加值。${equipmentEffectsText(item)}${focusText}`
  if (rules.kind === 'armor') {
    const category = rules.category === 'light' ? '轻甲' : rules.category === 'medium' ? '中甲' : '重甲'
    const dexterity = rules.dexterityBonus === 'full'
      ? '加上完整敏捷调整值'
      : rules.dexterityBonus === 'max-2'
        ? '加上至多 +2 的敏捷调整值'
        : '不加敏捷调整值'
    return `${category}。穿戴并生效时，你的护甲等级为 ${rules.baseArmorClass}，${dexterity}${rules.strengthRequirement ? `；力量需求 ${rules.strengthRequirement}` : ''}${rules.stealthDisadvantage ? '；进行隐匿检定时具有劣势' : ''}。${equipmentEffectsText(item)}${focusText}`
  }
  const category = rules.category === 'simple' ? '简易武器' : '军用武器'
  const range = rules.mode === 'ranged' && rules.rangeFeet
    ? `，射程 ${rules.rangeFeet.normal}/${rules.rangeFeet.long} 尺`
    : `，触及 ${rules.reachFeet ?? 5} 尺`
  const properties = rules.properties?.length
    ? `\n\n武器属性：\n${rules.properties.map((property) =>
        `• ${weaponPropertyExplanation(item, property)}`,
      ).join('\n')}`
    : ''
  return `${category}。命中造成 ${rules.damage.count}d${rules.damage.sides} ${damageTypeLabel(rules.damage.type)}伤害${range}。${equipmentEffectsText(item)}${focusText}${properties}`
}

function weaponPropertyExplanation(item: EquipmentItem, property: string): string {
  const rules = item.dnd5e
  if (!rules || rules.kind !== 'weapon') return property
  if (property.includes('多才多艺')) {
    const versatileDie = property.match(/1d\d+/i)?.[0] ?? `${rules.damage.count}d${rules.damage.sides}`
    return `多才多艺：单手攻击使用 ${rules.damage.count}d${rules.damage.sides} 伤害骰；双手攻击改用 ${versatileDie}。系统会根据副手占用、强制单手和擒抱状态自动选择。`
  }
  if (property.startsWith('投掷')) {
    const range = property.match(/(\d+)\/(\d+)/)
    const rangeText = range ? `${range[1]} 尺以内为普通射程，${range[1]}–${range[2]} 尺为远射程` : '使用装备列出的普通与远射程'
    return `投掷：可以把该武器投出进行远程武器攻击，并继续使用近战攻击所用的属性调整值计算命中和伤害；${rangeText}，在远射程攻击具有劣势，超过远射程无法攻击。`
  }
  if (property === '灵巧') return '灵巧：每次攻击时可选择力量或敏捷调整值计算命中与伤害，但同一次攻击的两项掷骰必须使用同一属性。'
  if (property === '轻型') return '轻型：适合双武器战斗；当另一只手也持有轻型近战武器时，可按双武器战斗规则用附赠动作进行副手攻击。'
  if (property === '重型') return '重型：小型或微型生物使用该武器攻击时具有劣势，因为其尺寸和重量难以有效操控。'
  if (property === '双手') return '双手：进行攻击时必须用双手持用；仅仅拿着或携带该武器时不要求两只手持续占用。'
  if (property === '触及') return '触及：使用该武器攻击时，触及范围增加 5 尺；使用它发动借机攻击时也采用增加后的触及范围。'
  if (property === '弹药') return '弹药：每次攻击必须消耗一枚与武器匹配的弹药；弹药从箭袋、弩矢盒等容器中取出属于攻击的一部分。战斗结束后花费 1 分钟搜索战场，可以回收已用弹药的一半。'
  if (property === '装填') return '装填：由于装填所需时间，无论角色通常能进行多少次攻击，每次使用一个动作、附赠动作或反应射击该武器时都只能发射一枚弹药。'
  if (property === '特殊' && item.id === 'dnd5e-lance') return '特殊：当目标位于 5 尺内时，骑枪攻击具有劣势；未骑乘时使用骑枪需要双手，骑乘时可以单手使用。'
  if (property === '特殊') return '特殊：该武器具有独立规则；具体限制已在本物品的规则正文中完整列出。'
  return `${property}：该属性的数值和使用条件已由当前装备定义记录。`
}

function equipmentSlotLabel(slot: EquipmentSlot): string {
  if (slot === 'mainWeapon') return '主手'
  if (slot === 'offHand') return '副手'
  if (slot === 'armor') return '护甲'
  if (slot === 'helmet') return '头盔'
  if (slot === 'shoes') return '鞋靴'
  if (slot === 'ring' || slot === 'ring2') return '戒指'
  if (slot === 'belt') return '腰带'
  return '项链'
}

function equipmentSpellcastingFocusText(item: EquipmentItem): string {
  const classIds = item.spellcastingFocusClassIds
  if (!classIds?.length) return ''
  const classLabels: Readonly<Record<string, string>> = {
    bard: '吟游诗人', cleric: '牧师', druid: '德鲁伊', paladin: '圣武士', ranger: '游侠',
    sorcerer: '术士', warlock: '邪术师', wizard: '法师',
  }
  return ` 持用时可作为${classIds.map((classId) => classLabels[classId] ?? classId).join('、')}的施法法器。`
}

function equipmentEffectsText(item: EquipmentItem): string {
  const effects = item.effects
  if (!effects) return ''
  const signed = (value: number) => value >= 0 ? `+${value}` : String(value)
  const labels = [
    effects.weaponAttackBonus ? `武器命中 ${signed(effects.weaponAttackBonus)}` : '',
    effects.weaponDamageBonus ? `武器伤害 ${signed(effects.weaponDamageBonus)}` : '',
    effects.armorClassBonus ? `AC ${signed(effects.armorClassBonus)}` : '',
    effects.savingThrowBonus ? `全部豁免 ${signed(effects.savingThrowBonus)}` : '',
    effects.speedBonusFeet ? `步行速度 ${signed(effects.speedBonusFeet)} 尺` : '',
  ].filter(Boolean)
  return labels.length > 0 ? ` 装备效果：${labels.join('、')}。` : ''
}

function equipmentIcon(item: EquipmentItem): Dnd5eInventoryItemTemplate['icon'] {
  if (item.dnd5e?.kind === 'shield') return 'shield'
  if (item.dnd5e?.kind === 'armor') return 'armor'
  return 'weapon'
}

const EQUIPMENT_DETAILS: Readonly<Record<string, { englishName: string; weightLb: number; amount: number; currency: 'cp' | 'sp' | 'gp' }>> = {
  'dnd5e-longsword': { englishName: 'Longsword', weightLb: 3, amount: 15, currency: 'gp' },
  'dnd5e-greataxe': { englishName: 'Greataxe', weightLb: 7, amount: 30, currency: 'gp' },
  'dnd5e-rapier': { englishName: 'Rapier', weightLb: 2, amount: 25, currency: 'gp' },
  'dnd5e-mace': { englishName: 'Mace', weightLb: 4, amount: 5, currency: 'gp' },
  'dnd5e-scimitar': { englishName: 'Scimitar', weightLb: 3, amount: 25, currency: 'gp' },
  'dnd5e-scimitar-offhand': { englishName: 'Scimitar', weightLb: 3, amount: 25, currency: 'gp' },
  'dnd5e-shortsword': { englishName: 'Shortsword', weightLb: 2, amount: 10, currency: 'gp' },
  'dnd5e-shortsword-offhand': { englishName: 'Shortsword', weightLb: 2, amount: 10, currency: 'gp' },
  'dnd5e-quarterstaff': { englishName: 'Quarterstaff', weightLb: 4, amount: 2, currency: 'sp' },
  'dnd5e-light-crossbow': { englishName: 'Crossbow, light', weightLb: 5, amount: 25, currency: 'gp' },
  'dnd5e-longbow': { englishName: 'Longbow', weightLb: 2, amount: 50, currency: 'gp' },
  'dnd5e-dagger': { englishName: 'Dagger', weightLb: 1, amount: 2, currency: 'gp' },
  'dnd5e-dagger-offhand': { englishName: 'Dagger', weightLb: 1, amount: 2, currency: 'gp' },
  'dnd5e-club': { englishName: 'Club', weightLb: 2, amount: 1, currency: 'sp' },
  'dnd5e-greatclub': { englishName: 'Greatclub', weightLb: 10, amount: 2, currency: 'sp' },
  'dnd5e-handaxe': { englishName: 'Handaxe', weightLb: 2, amount: 5, currency: 'gp' },
  'dnd5e-handaxe-offhand': { englishName: 'Handaxe', weightLb: 2, amount: 5, currency: 'gp' },
  'dnd5e-javelin': { englishName: 'Javelin', weightLb: 2, amount: 5, currency: 'sp' },
  'dnd5e-light-hammer': { englishName: 'Light hammer', weightLb: 2, amount: 2, currency: 'gp' },
  'dnd5e-sickle': { englishName: 'Sickle', weightLb: 2, amount: 1, currency: 'gp' },
  'dnd5e-spear': { englishName: 'Spear', weightLb: 3, amount: 1, currency: 'gp' },
  'dnd5e-dart': { englishName: 'Dart', weightLb: 0.25, amount: 5, currency: 'cp' },
  'dnd5e-shortbow': { englishName: 'Shortbow', weightLb: 2, amount: 25, currency: 'gp' },
  'dnd5e-sling': { englishName: 'Sling', weightLb: 0, amount: 1, currency: 'sp' },
  'dnd5e-warhammer': { englishName: 'Warhammer', weightLb: 2, amount: 15, currency: 'gp' },
  'dnd5e-greatsword': { englishName: 'Greatsword', weightLb: 6, amount: 50, currency: 'gp' },
  'dnd5e-battleaxe': { englishName: 'Battleaxe', weightLb: 4, amount: 10, currency: 'gp' },
  'dnd5e-flail': { englishName: 'Flail', weightLb: 2, amount: 10, currency: 'gp' },
  'dnd5e-glaive': { englishName: 'Glaive', weightLb: 6, amount: 20, currency: 'gp' },
  'dnd5e-halberd': { englishName: 'Halberd', weightLb: 6, amount: 20, currency: 'gp' },
  'dnd5e-lance': { englishName: 'Lance', weightLb: 6, amount: 10, currency: 'gp' },
  'dnd5e-maul': { englishName: 'Maul', weightLb: 10, amount: 10, currency: 'gp' },
  'dnd5e-morningstar': { englishName: 'Morningstar', weightLb: 4, amount: 15, currency: 'gp' },
  'dnd5e-pike': { englishName: 'Pike', weightLb: 18, amount: 5, currency: 'gp' },
  'dnd5e-trident': { englishName: 'Trident', weightLb: 4, amount: 5, currency: 'gp' },
  'dnd5e-war-pick': { englishName: 'War pick', weightLb: 2, amount: 5, currency: 'gp' },
  'dnd5e-whip': { englishName: 'Whip', weightLb: 3, amount: 2, currency: 'gp' },
  'dnd5e-blowgun': { englishName: 'Blowgun', weightLb: 1, amount: 10, currency: 'gp' },
  'dnd5e-hand-crossbow': { englishName: 'Crossbow, hand', weightLb: 3, amount: 75, currency: 'gp' },
  'dnd5e-heavy-crossbow': { englishName: 'Crossbow, heavy', weightLb: 18, amount: 50, currency: 'gp' },
  'dnd5e-net': { englishName: 'Net', weightLb: 3, amount: 1, currency: 'gp' },
  'dnd5e-shield': { englishName: 'Shield', weightLb: 6, amount: 10, currency: 'gp' },
  'dnd5e-chain-mail': { englishName: 'Chain mail', weightLb: 55, amount: 75, currency: 'gp' },
  'dnd5e-scale-mail': { englishName: 'Scale mail', weightLb: 45, amount: 50, currency: 'gp' },
  'dnd5e-leather-armor': { englishName: 'Leather armor', weightLb: 10, amount: 10, currency: 'gp' },
}

/** SRD equipment whose ordinary physical form is longer than six feet. */
const EQUIPMENT_LONGEST_DIMENSION_FEET: Readonly<Record<string, number>> = {
  'dnd5e-glaive': 8,
  'dnd5e-halberd': 8,
  'dnd5e-lance': 10,
  'dnd5e-pike': 10,
}

export const DND5E_SRD_EQUIPMENT_ITEM_TEMPLATES: readonly Dnd5eInventoryItemTemplate[] =
  DND5E_SRD_EQUIPMENT_CATALOG.map((equipment) => {
    const detail = EQUIPMENT_DETAILS[equipment.id]
    const rulesText = equipmentRulesText(equipment)
    return {
      id: `srd-5.1:equipment:${equipment.id}`,
      name: equipment.name,
      englishName: detail?.englishName,
      category: 'equipment',
      icon: equipmentIcon(equipment),
      description: rulesText,
      rulesText,
      weightLb: detail?.weightLb,
      longestDimensionFeet: EQUIPMENT_LONGEST_DIMENSION_FEET[equipment.id],
      cost: detail ? { amount: detail.amount, currency: detail.currency } : undefined,
      stackable: false,
      equipment: { ...equipment },
      source: SRD_SOURCE,
    }
  })

export const DND5E_SRD_GEAR_ITEM_TEMPLATES: readonly Dnd5eInventoryItemTemplate[] = [
  gear('backpack', '背包', 'Backpack', 'container', 'backpack', 5, 2, 'gp', '可容纳至多 1 立方尺或 30 磅装备；绑在背包外侧的物品不计入该容量。'),
  gear('bedroll', '铺盖', 'Bedroll', 'adventuring-gear', 'bedroll', 7, 1, 'gp', '旅行休息使用的铺盖。具体环境与休息条件由 DM 裁定。'),
  gear('rope-hempen-50-feet', '麻绳（50 尺）', 'Rope, hempen (50 feet)', 'adventuring-gear', 'rope', 10, 1, 'gp', '50 尺长；拥有 2 点生命值，可用 DC 17 力量检定扯断。'),
  gear('torch', '火把', 'Torch', 'adventuring-gear', 'torch', 1, 1, 'cp', '燃烧 1 小时，发出 20 尺明亮光照及其外 20 尺微光。用火把近战命中时造成 1 点火焰伤害。', {
    economy: 'action', consumeQuantity: 1, effect: { kind: 'dm-adjudication', adjudication: '在地图上放置光照，或按临时武器攻击进行裁定。' },
  }),
  gear('tinderbox', '火绒盒', 'Tinderbox', 'tool', 'tinderbox', 1, 5, 'sp', '点燃火把、灯或其他裸露燃料需要一个动作；点燃其他火源通常需要 1 分钟。', {
    economy: 'action', consumeQuantity: 0, effect: { kind: 'dm-adjudication', adjudication: '确认目标是否可以点燃，并创建相应的光照或环境效果。' },
  }),
  gear('waterskin', '水袋', 'Waterskin', 'container', 'waterskin', 5, 2, 'sp', '装满时可容纳 4 品脱液体；标示重量按装满计算。'),
  gear('rations-one-day', '口粮（1 日）', 'Rations (1 day)', 'consumable', 'rations', 2, 5, 'sp', '一日份的干粮。食物、水与旅行消耗由 DM 或旅行规则处理。', {
    economy: 'none', consumeQuantity: 1, effect: { kind: 'dm-adjudication', adjudication: '记录一日口粮消耗；若启用旅行或饥饿规则，再处理相关后果。' },
  }),
  gear('mess-kit', '餐具组', 'Mess kit', 'adventuring-gear', 'generic', 1, 2, 'sp', '包含杯、餐具和可作锅使用的盒体。'),
  gear('crowbar', '撬棍', 'Crowbar', 'adventuring-gear', 'generic', 5, 2, 'gp', '在适合使用撬棍的力量检定中具有优势。'),
  gear('hammer', '锤子', 'Hammer', 'adventuring-gear', 'generic', 3, 1, 'gp', '用于钉入岩钉或处理一般营地工作。'),
  gear('piton', '岩钉', 'Piton', 'adventuring-gear', 'generic', 0.25, 5, 'cp', '攀爬和固定绳索使用的金属钉。'),
  gear('candle', '蜡烛', 'Candle', 'adventuring-gear', 'generic', 0, 1, 'cp', '燃烧 1 小时，发出 5 尺明亮光照和其外 5 尺微光。'),
  gear('string-10-feet', '细绳（10 尺）', 'String (10 feet)', 'adventuring-gear', 'string', 0, 1, 'sp', '十尺长的普通细绳。'),
  gear('bell', '铃铛', 'Bell', 'adventuring-gear', 'generic', 0, 1, 'gp', '可配合细绳制作简易警报。'),
  gear('hooded-lantern', '附盖提灯', 'Lantern, hooded', 'adventuring-gear', 'generic', 2, 5, 'gp', '燃烧油料时提供可调节的光照。'),
  gear('lamp', '油灯', 'Lamp', 'adventuring-gear', 'generic', 1, 5, 'sp', '燃烧油料时提供光照。'),
  gear('oil-flask', '油（瓶）', 'Oil (flask)', 'consumable', 'oil-flask', 1, 1, 'sp', '可作为灯具燃料，泼洒或点燃时由 DM 裁定。'),
  gear('chest', '箱子', 'Chest', 'container', 'generic', 25, 5, 'gp', '可容纳 12 立方尺或 300 磅物品。'),
  gear('map-scroll-case', '地图或卷轴匣', 'Case, map or scroll', 'container', 'generic', 1, 1, 'gp', '用于保护地图和卷轴。'),
  gear('fine-clothes', '优质服装', 'Clothes, fine', 'adventuring-gear', 'clothing', 6, 15, 'gp', '适合正式场合的优质服装。'),
  gear('common-clothes', '普通服装', 'Clothes, common', 'adventuring-gear', 'clothing', 3, 5, 'sp', '一套普通服装。'),
  gear('ink-bottle', '墨水（1 盎司瓶）', 'Ink (1 ounce bottle)', 'adventuring-gear', 'generic', 0, 10, 'gp', '书写用墨水。'),
  gear('ink-pen', '墨水笔', 'Ink pen', 'adventuring-gear', 'generic', 0, 2, 'cp', '蘸取墨水书写。'),
  gear('paper-sheet', '纸张', 'Paper (one sheet)', 'adventuring-gear', 'generic', 0, 2, 'sp', '一张书写用纸。'),
  gear('parchment-sheet', '羊皮纸', 'Parchment (one sheet)', 'adventuring-gear', 'generic', 0, 1, 'sp', '一张书写用羊皮纸。'),
  gear('perfume-vial', '香水（小瓶）', 'Perfume (vial)', 'adventuring-gear', 'perfume', 0, 5, 'gp', '一小瓶香水。'),
  gear('sealing-wax', '封蜡', 'Sealing wax', 'adventuring-gear', 'generic', 0, 5, 'sp', '用于封缄信件。'),
  gear('soap', '肥皂', 'Soap', 'adventuring-gear', 'generic', 0, 2, 'cp', '清洁用品。'),
  gear('costume', '戏服', 'Costume clothes', 'adventuring-gear', 'clothing', 4, 5, 'gp', '表演使用的服装。'),
  gear('disguise-kit', '易容工具', 'Disguise kit', 'tool', 'generic', 3, 25, 'gp', '用于改变外貌的化妆品、染料和小道具。'),
  gear('blanket', '毛毯', 'Blanket', 'adventuring-gear', 'generic', 3, 5, 'sp', '旅行休息使用的毛毯。'),
  gear('alms-box', '布施盒', 'Alms box', 'container', 'generic', 0, 0, 'cp', '祭司套组中的布施盒。'),
  gear('incense-block', '熏香块', 'Block of incense', 'adventuring-gear', 'generic', 0, 0, 'cp', '宗教仪式使用的熏香。'),
  gear('censer', '香炉', 'Censer', 'adventuring-gear', 'generic', 0, 0, 'cp', '燃烧熏香的仪式器具。'),
  gear('vestments', '祭服', 'Vestments', 'adventuring-gear', 'clothing', 0, 0, 'cp', '宗教仪式使用的服装。'),
  gear('lore-book', '学识书籍', 'Book of lore', 'adventuring-gear', 'generic', 5, 25, 'gp', '有关特定学识的书籍。'),
  gear('sand-bag', '小袋沙', 'Little bag of sand', 'adventuring-gear', 'generic', 0, 0, 'cp', '学者套组中的吸墨沙。'),
  gear('small-knife', '小刀', 'Small knife', 'adventuring-gear', 'small-knife', 0, 0, 'cp', '学者套组中的小刀；不作为战斗武器。'),
  gear('arrows', '箭', 'Arrows', 'adventuring-gear', 'generic', 0.05, 5, 'cp', '短弓和长弓使用的弹药。'),
  gear('crossbow-bolts', '弩矢', 'Crossbow bolts', 'adventuring-gear', 'generic', 0.075, 5, 'cp', '轻弩等弩类武器使用的弹药。'),
  gear('sling-bullets', '投石索弹丸', 'Sling bullets', 'adventuring-gear', 'sling-bullets', 0.075, 4, 'cp', '投石索使用的铅制弹丸。'),
  gear('blowgun-needles', '吹箭针', 'Blowgun needles', 'adventuring-gear', 'generic', 0.02, 2, 'cp', '吹箭筒使用的细针。'),
  gear('component-pouch', '材料包', 'Component pouch', 'container', 'generic', 2, 25, 'gp', '存放施展法术所需、未标明价格且不会被消耗的材料成分。'),
  gear('arcane-focus', '奥术法器', 'Arcane focus', 'adventuring-gear', 'spellcasting-focus', 1, 10, 'gp', '奥术施法职业可用作法术材料成分替代物；使用时必须持在手中。它是施法法器，不是魔法物品，也不是武器。', undefined, handheldFocus('arcane-focus', '奥术法器')),
  gear('druidic-focus', '德鲁伊法器', 'Druidic focus', 'adventuring-gear', 'generic', 1, 1, 'gp', '德鲁伊可用作法术材料成分替代物；使用时必须持在手中。', undefined, handheldFocus('druidic-focus', '德鲁伊法器')),
  gear('holy-symbol', '圣徽', 'Holy symbol', 'adventuring-gear', 'generic', 1, 5, 'gp', '牧师和圣武士可用作法术材料成分替代物。'),
  gear('spellbook', '法术书', 'Spellbook', 'adventuring-gear', 'generic', 3, 50, 'gp', '法师记录已知法术的书册。'),
  gear('thieves-tools', '盗贼工具', "Thieves' tools", 'tool', 'generic', 1, 25, 'gp', '开锁与拆除陷阱使用的专用工具。'),
  gear('bagpipes', '风笛', 'Bagpipes', 'tool', 'generic', 6, 30, 'gp', '一种乐器；吟游诗人用其作为施法法器时必须持用。', undefined, handheldFocus('bagpipes', '风笛')),
  gear('drum', '鼓', 'Drum', 'tool', 'generic', 3, 6, 'gp', '一种乐器；吟游诗人用其作为施法法器时必须持用。', undefined, handheldFocus('drum', '鼓')),
  gear('dulcimer', '扬琴', 'Dulcimer', 'tool', 'dulcimer', 10, 25, 'gp', '一种乐器；吟游诗人用其作为施法法器时必须持用。', undefined, handheldFocus('dulcimer', '扬琴')),
  gear('lute', '鲁特琴', 'Lute', 'tool', 'generic', 2, 35, 'gp', '吟游诗人常用的乐器；作为施法法器时必须持用。', undefined, handheldFocus('lute', '鲁特琴')),
  gear('flute', '长笛', 'Flute', 'tool', 'generic', 1, 2, 'gp', '一种便携乐器；吟游诗人用其作为施法法器时必须持用。', undefined, handheldFocus('flute', '长笛')),
  gear('horn', '号角', 'Horn', 'tool', 'generic', 2, 3, 'gp', '一种乐器；吟游诗人用其作为施法法器时必须持用。', undefined, handheldFocus('horn', '号角')),
  gear('lyre', '里拉琴', 'Lyre', 'tool', 'generic', 2, 30, 'gp', '一种乐器；吟游诗人用其作为施法法器时必须持用。', undefined, handheldFocus('lyre', '里拉琴')),
  gear('pan-flute', '排箫', 'Pan flute', 'tool', 'generic', 2, 12, 'gp', '一种乐器；吟游诗人用其作为施法法器时必须持用。', undefined, handheldFocus('pan-flute', '排箫')),
  gear('shawm', '肖姆管', 'Shawm', 'tool', 'generic', 1, 2, 'gp', '一种乐器；吟游诗人用其作为施法法器时必须持用。', undefined, handheldFocus('shawm', '肖姆管')),
  gear('viol', '维奥尔琴', 'Viol', 'tool', 'generic', 1, 30, 'gp', '一种乐器；吟游诗人用其作为施法法器时必须持用。', undefined, handheldFocus('viol', '维奥尔琴')),
  gear('prayer-book', '祈祷书', 'Prayer book', 'adventuring-gear', 'generic', 0, 0, 'cp', '侍僧背景的祈祷文本。'),
  gear('prayer-wheel', '经轮', 'Prayer wheel', 'adventuring-gear', 'generic', 0, 0, 'cp', '侍僧背景使用的宗教器物。'),
  gear('coin-pouch-15gp', '钱袋（15 gp）', 'Pouch containing 15 gp', 'container', 'generic', 1, 15, 'gp', '侍僧背景携带的钱袋；其中金币由角色与 DM 共同记账。'),
  gear('healers-kit', '医疗包', "Healer's kit", 'tool', 'healers-kit', 3, 5, 'gp', '共有 10 次使用次数。可用一个动作消耗 1 次，在无需进行感知（医药）检定的情况下稳定一名 0 生命值生物。', {
    economy: 'action', consumeQuantity: 0, chargesPerItem: 10, effect: { kind: 'dm-adjudication', adjudication: '选择 0 生命值生物并将其稳定；权威库存自动扣除医疗包的一次使用次数。' },
  }),
  gear('ball-bearings-bag', '滚珠（袋装）', 'Ball bearings (bag of 1,000)', 'consumable', 'ball-bearings', 2, 1, 'gp', '用一个动作洒满相邻 10 尺见方区域。穿过区域的生物通常需通过 DC 10 敏捷豁免，否则倒地；以半速移动可免除该豁免。', {
    economy: 'action', consumeQuantity: 1,
    targeting: { kind: 'map-area', areaKind: 'ball-bearings', rangeFeet: 5, widthFeet: 10, heightFeet: 10 },
    effect: { kind: 'dm-adjudication', adjudication: '在相邻 10 尺方形区域建立滚珠地形，并在移动进入时处理 DC 10 敏捷豁免。' },
  }),
  gear('caltrops-bag', '铁蒺藜（袋装）', 'Caltrops (bag of 20)', 'consumable', 'caltrops', 2, 1, 'gp', '用一个动作洒满相邻 5 尺见方区域。进入者通常需通过 DC 15 敏捷豁免，否则停止移动、受到 1 点穿刺伤害，且速度降低 10 尺直至恢复至少 1 点生命值。', {
    economy: 'action', consumeQuantity: 1,
    targeting: { kind: 'map-area', areaKind: 'caltrops', rangeFeet: 5, widthFeet: 5, heightFeet: 5 },
    effect: { kind: 'dm-adjudication', adjudication: '在相邻 5 尺方格建立铁蒺藜地形，并在进入时处理 DC 15 敏捷豁免、伤害与速度降低。' },
  }),
  gear('hunting-trap', '捕猎陷阱', 'Hunting trap', 'adventuring-gear', 'hunting-trap', 25, 5, 'gp', '用一个动作设置。踩中者需通过 DC 13 敏捷豁免，否则受到 1d4 穿刺伤害并停止移动；逃脱与破坏按陷阱规则裁定。', {
    economy: 'action', consumeQuantity: 1,
    targeting: { kind: 'map-area', areaKind: 'hunting-trap', rangeFeet: 5, widthFeet: 5, heightFeet: 5 },
    effect: { kind: 'dm-adjudication', adjudication: '在相邻位置建立捕猎陷阱，记录 DC 13 敏捷豁免、束缚链长度和逃脱检定。' },
  }),
  gear('acid-vial', '强酸（瓶）', 'Acid (vial)', 'consumable', 'acid', 1, 25, 'gp', '用一个动作泼洒至 5 尺内生物，或投掷至 20 尺；以临时武器进行远程攻击，命中造成 2d6 强酸伤害。', {
    economy: 'action', consumeQuantity: 1, targeting: { kind: 'creature', rangeFeet: 20 }, effect: { kind: 'dm-adjudication', adjudication: '选择 5 尺泼洒或 20 尺投掷目标，进行临时武器远程攻击并结算 2d6 强酸伤害。' },
  }),
  gear('alchemists-fire-flask', '炼金火焰（瓶）', "Alchemist's fire (flask)", 'consumable', 'alchemists-fire', 1, 50, 'gp', '投掷至 20 尺并进行临时武器远程攻击。命中后目标在其每个回合开始受到 1d4 火焰伤害，直至有人用动作通过 DC 10 敏捷检定扑灭。', {
    economy: 'action', consumeQuantity: 1, targeting: { kind: 'creature', rangeFeet: 20 }, effect: { kind: 'dm-adjudication', adjudication: '进行 20 尺临时武器远程攻击；命中后添加回合开始 1d4 火焰伤害与 DC 10 扑灭事务。' },
  }),
  gear('holy-water-flask', '圣水（瓶）', 'Holy water (flask)', 'consumable', 'holy-water', 1, 25, 'gp', '泼洒至 5 尺内或投掷至 20 尺。以临时武器远程攻击命中邪魔或亡灵时，造成 2d6 光耀伤害。', {
    economy: 'action', consumeQuantity: 1, targeting: { kind: 'creature', rangeFeet: 20 }, effect: { kind: 'dm-adjudication', adjudication: '选择泼洒或投掷目标；仅对邪魔或亡灵结算 2d6 光耀伤害。' },
  }, undefined, { tags: ['holy-water'], unitValueGp: 25 }),
  gear('antitoxin-vial', '抗毒剂（瓶）', 'Antitoxin (vial)', 'consumable', 'antitoxin', 0, 50, 'gp', '饮用后 1 小时内，对抗毒素的豁免检定具有优势；构装生物与亡灵无法获得该增益。', {
    economy: 'action', consumeQuantity: 1, effect: { kind: 'dm-adjudication', adjudication: '为饮用者添加持续 1 小时的抗毒优势；构装生物与亡灵不生效。' },
  }),
  gear('basic-poison-vial', '基础毒药（瓶）', 'Poison, basic (vial)', 'consumable', 'poison', 0, 100, 'gp', '用一个动作涂在一件挥砍或穿刺武器、或至多三枚弹药上。1 分钟内首次命中时，目标进行 DC 10 体质豁免，失败额外受到 1d4 毒素伤害。', {
    economy: 'action', consumeQuantity: 1, effect: { kind: 'dm-adjudication', adjudication: '选择武器或至多三枚弹药，建立 1 分钟毒药效果，并在首次命中时处理 DC 10 体质豁免与 1d4 毒素伤害。' },
  }),
  {
    id: 'srd-5.1:item:potion-of-healing',
    name: '治疗药水',
    englishName: 'Potion of healing',
    category: 'consumable',
    icon: 'healing-potion',
    description: '饮用或给另一名生物服用需要一个动作并消耗此药水；饮用者恢复 2d4 + 2 点生命值。该恢复不能使当前生命值超过生命值上限。',
    rulesText: '饮用或给另一名生物服用需要一个动作并消耗此药水；饮用者恢复 2d4 + 2 点生命值。该恢复不能使当前生命值超过生命值上限。',
    weightLb: 0.5,
    cost: { amount: 50, currency: 'gp' },
    stackable: true,
    use: { economy: 'action', consumeQuantity: 1, effect: { kind: 'healing', dice: { count: 2, sides: 4, bonus: 2 } } },
    magicItem: { kind: 'potion', rarity: 'common', attunement: 'none', automation: 'headless' },
    source: SRD_SOURCE,
  },
  {
    id: 'srd-5.1:item:goodberry',
    name: '神莓', englishName: 'Goodberry', category: 'consumable', icon: 'rations',
    description: '由神莓术生成。使用一个动作食用并恢复 1 点生命值；生成后 24 小时失效。',
    rulesText: '使用一个动作食用一枚神莓，恢复 1 点生命值。库存按战役时间自动移除过期神莓。',
    weightLb: 0, stackable: true,
    use: {
      economy: 'action', consumeQuantity: 1,
      effect: { kind: 'healing', dice: { count: 0, sides: 1, bonus: 1 } },
    },
    source: SRD_SOURCE,
  },
  {
    id: 'srd-5.1:item:conjured-food-portion',
    name: '魔法生成的食物（1 人日份）', englishName: 'Conjured food portion',
    category: 'consumable', icon: 'rations',
    description: '由造粮术生成的一人日份食物；生成后 24 小时变质。',
    rulesText: '提供一名类人生物一天所需食物；战役时间达到过期时刻后由 Host 自动移除。',
    weightLb: 3, stackable: true,
    use: { economy: 'none', consumeQuantity: 1, effect: { kind: 'dm-adjudication', adjudication: '记录一名生物当天获得充足食物。' } },
    source: SRD_SOURCE,
  },
  {
    id: 'srd-5.1:item:conjured-water-gallon',
    name: '魔法生成的清水（1 加仑）', englishName: 'Conjured water (1 gallon)',
    category: 'consumable', icon: 'waterskin',
    description: '由造粮术生成的一加仑清洁饮水；不会随法术生成的食物一起变质。',
    rulesText: '一加仑清水；可转移或消耗，旅行饮水需求由启用的旅行规则结算。',
    weightLb: 8.34, stackable: true,
    use: { economy: 'none', consumeQuantity: 1, effect: { kind: 'dm-adjudication', adjudication: '记录一加仑饮水的分配或消耗。' } },
    source: SRD_SOURCE,
  },
  ...DND5E_SRD_SPELL_MATERIAL_ITEM_TEMPLATES,
] as const

export const DND5E_SRD_ITEM_TEMPLATES: readonly Dnd5eInventoryItemTemplate[] = [
  ...DND5E_SRD_EQUIPMENT_ITEM_TEMPLATES,
  ...DND5E_SRD_GEAR_ITEM_TEMPLATES,
  ...DND5E_SRD_MAGIC_ITEM_TEMPLATES,
]

const ITEM_TEMPLATE_BY_ID = new Map(DND5E_SRD_ITEM_TEMPLATES.map((item) => [item.id, item]))
const CANONICAL_ARCANE_FOCUS_TEMPLATE_ID = 'srd-5.1:item:arcane-focus'
const LEGACY_ARCANE_FOCUS_IDS = new Set([
  'arcane-focus',
  'dnd5e-arcane-focus',
  'srd-5.1:magic-item:arcane-focus',
  CANONICAL_ARCANE_FOCUS_TEMPLATE_ID,
])

export function dnd5eInventoryItemTemplate(templateId: string): Dnd5eInventoryItemTemplate | undefined {
  return ITEM_TEMPLATE_BY_ID.get(templateId) ?? dnd5ePluginItemDefinition(templateId)
}

/**
 * 当前规则运行时可用的完整物品目录。商店、奖励和 DM 工具通过这个入口同时
 * 看见 SRD 核心物品与已激活工坊插件贡献的物品，不需要为插件另建一套库存池。
 */
export function listDnd5eInventoryItemTemplates(): readonly Dnd5eInventoryItemTemplate[] {
  const byId = new Map<string, Dnd5eInventoryItemTemplate>()
  for (const item of DND5E_SRD_ITEM_TEMPLATES) byId.set(item.id, item)
  for (const item of registeredDnd5ePluginItems()) byId.set(item.id, item)
  return [...byId.values()]
}

export function dnd5eInventoryItemTemplateForEquipment(equipmentId: string): Dnd5eInventoryItemTemplate | undefined {
  return DND5E_SRD_EQUIPMENT_ITEM_TEMPLATES.find((item) => item.equipment?.id === equipmentId) ??
    registeredDnd5ePluginItems().find((item) => item.equipment?.id === equipmentId)
}

function inventoryTemplateForStoredEntry(entry: Dnd5eInventoryEntry): Dnd5eInventoryItemTemplate {
  if (LEGACY_ARCANE_FOCUS_IDS.has(entry.templateId) || LEGACY_ARCANE_FOCUS_IDS.has(entry.item.id)) {
    return ITEM_TEMPLATE_BY_ID.get(CANONICAL_ARCANE_FOCUS_TEMPLATE_ID) ?? entry.item
  }
  return dnd5eInventoryItemTemplate(entry.templateId) ?? entry.item
}

function isProjectedUnidentifiedMagicItem(entry: Dnd5eInventoryEntry): boolean {
  return entry.identified === false &&
    entry.item.category === 'magic-item' &&
    entry.templateId.startsWith('unidentified:')
}

export function createDnd5eInventoryForCharacter(character: Pick<Character, 'id' | 'equipment'>): Dnd5eInventory {
  const entries = Object.entries(character.equipment ?? {}).flatMap(([slot, equipment]) => {
    if (!equipment) return []
    const template = dnd5eInventoryItemTemplateForEquipment(equipment.id) ?? fallbackEquipmentTemplate(equipment)
    return [{
      instanceId: `equipped:${character.id}:${slot}:${equipment.id}`,
      templateId: template.id,
      item: cloneItemTemplate(template),
      quantity: 1,
      resources: createInventoryResources(template, 1),
      identified: true,
      equippedSlot: slot as EquipmentSlot,
      acquiredAt: 0,
    } satisfies Dnd5eInventoryEntry]
  })
  return {
    schemaVersion: DND5E_INVENTORY_SCHEMA_VERSION,
    revision: 0,
    entries,
    currency: { ...EMPTY_CURRENCY },
    authorityGrantReceipts: [],
    authorityUseReceipts: [],
  }
}

export function normalizeDnd5eInventory(character: Character): Dnd5eInventory {
  const raw = character.dnd5eInventory
  const currency = normalizeCurrency(raw?.currency)
  const authorityGrantReceipts = [...new Set((raw?.authorityGrantReceipts ?? [])
    .filter((receipt): receipt is string =>
      typeof receipt === 'string' && receipt.length > 0 && receipt.length <= 300,
    ))].slice(-512)
  const authorityUseReceipts = [...new Set((raw?.authorityUseReceipts ?? [])
    .filter((receipt): receipt is string =>
      typeof receipt === 'string' && receipt.length > 0 && receipt.length <= 300,
    ))].slice(-512)
  const revision = Number.isSafeInteger(raw?.revision) && Number(raw?.revision) >= 0
    ? Number(raw?.revision)
    : 0
  const entries: Dnd5eInventoryEntry[] = (raw?.entries ?? [])
    .filter((entry) => entry && typeof entry.instanceId === 'string' && typeof entry.templateId === 'string')
    .map((entry) => {
      const item = cloneItemTemplate(inventoryTemplateForStoredEntry(entry))
      const quantity = Math.max(1, Math.floor(Number(entry.quantity) || 1))
      const resources = normalizeInventoryResources(item, quantity, entry.resources, entry.remainingCharges)
      return {
        ...entry,
        item,
        quantity,
        resources,
        equippedSlot: isEquipmentSlot(entry.equippedSlot) ? entry.equippedSlot : undefined,
        identified: item.magicItem
          ? (raw?.schemaVersion === 3 ? entry.identified !== false : true)
          : isProjectedUnidentifiedMagicItem(entry) ? false : true,
        remainingCharges: undefined,
        acquiredAt: Number.isFinite(entry.acquiredAt) ? entry.acquiredAt : 0,
        expiresAtWorldMinute: Number.isSafeInteger(entry.expiresAtWorldMinute) &&
          Number(entry.expiresAtWorldMinute) >= 0
          ? Number(entry.expiresAtWorldMinute)
          : undefined,
        generatedByRulesId: typeof entry.generatedByRulesId === 'string' &&
          /^[a-z0-9][a-z0-9._:-]{0,199}$/.test(entry.generatedByRulesId)
          ? entry.generatedByRulesId
          : undefined,
        contaminants: [...new Set((entry.contaminants ?? []).filter(
          (value): value is 'poison' | 'disease' => value === 'poison' || value === 'disease',
        ))],
        planarState: entry.planarState === 'ethereal' ? 'ethereal' :
          entry.planarState === 'material' ? 'material' : undefined,
        linkedSpellAuthorityRecordId: typeof entry.linkedSpellAuthorityRecordId === 'string' &&
          /^[a-z0-9][a-z0-9._:-]{0,255}$/.test(entry.linkedSpellAuthorityRecordId)
          ? entry.linkedSpellAuthorityRecordId
          : undefined,
        linkedSpellFocusAuthorityRecordId: typeof entry.linkedSpellFocusAuthorityRecordId === 'string' &&
          /^[a-z0-9][a-z0-9._:-]{0,255}$/.test(entry.linkedSpellFocusAuthorityRecordId)
          ? entry.linkedSpellFocusAuthorityRecordId
          : undefined,
      }
    })

  const byEquippedSlot = new Map(entries.flatMap((entry) => entry.equippedSlot ? [[entry.equippedSlot, entry]] : []))
  for (const [slot, equipment] of Object.entries(character.equipment ?? {}) as Array<[EquipmentSlot, EquipmentItem | undefined]>) {
    if (!equipment) continue
    const slotted = byEquippedSlot.get(slot)
    if (slotted?.item.equipment?.id === equipment.id) continue
    if (slotted) slotted.equippedSlot = undefined
    const existing = entries.find((entry) => !entry.equippedSlot && entry.item.equipment?.id === equipment.id)
    if (existing) {
      existing.equippedSlot = slot
      byEquippedSlot.set(slot, existing)
      continue
    }
    const template = dnd5eInventoryItemTemplateForEquipment(equipment.id) ?? fallbackEquipmentTemplate(equipment)
    const entry: Dnd5eInventoryEntry = {
      instanceId: `equipped:${character.id}:${slot}:${equipment.id}`,
      templateId: template.id,
      item: cloneItemTemplate(template),
      quantity: 1,
      resources: createInventoryResources(template, 1),
      identified: true,
      equippedSlot: slot,
      acquiredAt: 0,
    }
    entries.push(entry)
    byEquippedSlot.set(slot, entry)
  }
  for (const entry of entries) {
    if (!entry.equippedSlot) continue
    const equipped = character.equipment?.[entry.equippedSlot]
    if (!equipped || equipped.id !== entry.item.equipment?.id) entry.equippedSlot = undefined
  }
  normalizeContainerLinks(entries)
  return {
    schemaVersion: DND5E_INVENTORY_SCHEMA_VERSION,
    revision,
    entries,
    currency,
    authorityGrantReceipts,
    authorityUseReceipts,
  }
}

export function dnd5eExpendedSpellSlotLevels(
  character: Character,
  maximumSlotLevel = 9,
): number[] {
  const maximum = Math.min(9, Math.max(1, Math.floor(maximumSlotLevel)))
  return Array.from({ length: maximum }, (_, index) => index + 1).filter((level) => {
    const resource = character.classResources?.[`dnd5e-spell-slot-${level}`]
    return !!resource && resource.max > 0 && resource.current < resource.max
  })
}

export interface Dnd5eInventoryLoad {
  itemWeightLb: number
  currencyWeightLb: number
  totalWeightLb: number
  carryingCapacityLb: number
  encumberedThresholdLb: number
  heavilyEncumberedThresholdLb: number
  status: 'normal' | 'encumbered' | 'heavily-encumbered' | 'over-capacity'
  speedPenaltyFeet: 0 | 10 | 20
}

/** SRD 携带重量，以及可选负重规则的两档阈值。货币按每 50 枚 1 磅计算。 */
export function dnd5eInventoryLoad(character: Character): Dnd5eInventoryLoad {
  const inventory = normalizeDnd5eInventory(character)
  const itemWeightLb = inventory.entries.reduce((sum, entry) => sum + entryWeight(entry), 0)
  const currencyWeightLb = Object.values(inventory.currency ?? EMPTY_CURRENCY).reduce((sum, amount) => sum + amount, 0) / 50
  const strength = Math.max(1, Math.floor(character.abilities?.str ?? 10))
  const totalWeightLb = itemWeightLb + currencyWeightLb
  const carryingCapacityLb = strength * 15 * dnd5eActiveCarryingCapacityMultiplier(
    character.dnd5eCombatState?.activeEffects,
  ) * dnd5eRageFeatureCarryingCapacityMultiplier(character)
  const encumberedThresholdLb = strength * 5
  const heavilyEncumberedThresholdLb = strength * 10
  const status = totalWeightLb > carryingCapacityLb
    ? 'over-capacity'
    : totalWeightLb > heavilyEncumberedThresholdLb
      ? 'heavily-encumbered'
      : totalWeightLb > encumberedThresholdLb
        ? 'encumbered'
        : 'normal'
  return {
    itemWeightLb,
    currencyWeightLb,
    totalWeightLb,
    carryingCapacityLb,
    encumberedThresholdLb,
    heavilyEncumberedThresholdLb,
    status,
    speedPenaltyFeet: status === 'encumbered' ? 10 : status === 'heavily-encumbered' || status === 'over-capacity' ? 20 : 0,
  }
}

export function dnd5eWeaponAmmunitionKind(equipmentId: string | undefined): Dnd5eAmmunitionKind | undefined {
  return equipmentId ? AMMUNITION_KIND_BY_WEAPON_ID[equipmentId] : undefined
}

/** 权威攻击事务使用：只在攻击成功进入结算后扣除一枚对应弹药。 */
export function consumeDnd5eWeaponAmmunition(
  character: Character,
  equipmentId: string | undefined,
): { ok: true; character: Character; instanceId?: string } | { ok: false; character: Character; reason: 'ammunition-unavailable' } {
  const kind = dnd5eWeaponAmmunitionKind(equipmentId)
  if (!kind) return { ok: true, character }
  const inventory = normalizeDnd5eInventory(character)
  const ammunition = inventory.entries.find((entry) => entry.item.ammunitionKind === kind && entry.quantity > 0)
  if (!ammunition) return { ok: false, character, reason: 'ammunition-unavailable' }
  return { ok: true, character: removeItem(character, ammunition, 1), instanceId: ammunition.instanceId }
}

export function dnd5eInventoryEntryResource(
  entry: Pick<Dnd5eInventoryEntry, 'resources'>,
  resourceId: string,
): Dnd5eInventoryResourceState | undefined {
  return entry.resources?.[resourceId]
}

/** Resolves a declared item action from the authoritative template snapshot. */
export function dnd5eInventoryEntryUseAction(
  entry: Dnd5eInventoryEntry,
  actionId?: string,
) {
  if (actionId != null) return entry.item.useActions?.find((action) => action.id === actionId)
  return entry.item.useActions?.length ? undefined : entry.item.use
}

/** 权威事务使用的实例资源扣除函数。资源归零后仍保留物品实例。 */
export type Dnd5eInventoryActivityCost =
  | { kind: 'resource'; resourceId: string; amount: number }
  | { kind: 'quantity'; amount: number }

export type Dnd5eInventoryActivityCostFailure =
  | 'invalid-receipt'
  | 'stale-inventory-revision'
  | 'item-not-found'
  | 'item-unidentified'
  | 'item-inactive'
  | 'invalid-cost'
  | 'resource-not-found'
  | 'insufficient-resource'
  | 'insufficient-quantity'

export interface Dnd5eInventoryLastChargeCheck {
  resourceId: string
  roll: number
  dieSides: number
  destroyed: boolean
}

/** Preflights every cost before producing one authoritative inventory snapshot. */
export function applyDnd5eInventoryActivityCosts(
  character: Character,
  input: {
    instanceId: string
    costs: readonly Dnd5eInventoryActivityCost[]
    receiptId: string
    expectedInventoryRevision: number
    /** Optional deterministic rolls used by tests/replays; the Host rolls when omitted. */
    lastChargeDestructionRolls?: Readonly<Record<string, number>>
  },
):
  | { ok: true; character: Character; deduplicated: boolean; lastChargeChecks?: readonly Dnd5eInventoryLastChargeCheck[] }
  | { ok: false; character: Character; reason: Dnd5eInventoryActivityCostFailure } {
  const inventory = normalizeDnd5eInventory(character)
  if (!validAuthorityReceiptId(input.receiptId)) {
    return { ok: false, character, reason: 'invalid-receipt' }
  }
  if (inventory.authorityUseReceipts?.includes(input.receiptId)) {
    return { ok: true, character: { ...character, dnd5eInventory: inventory }, deduplicated: true }
  }
  if (inventory.revision !== input.expectedInventoryRevision) {
    return { ok: false, character, reason: 'stale-inventory-revision' }
  }
  const entry = inventory.entries.find((candidate) => candidate.instanceId === input.instanceId)
  if (!entry) return { ok: false, character, reason: 'item-not-found' }
  if (entry.item.magicItem && entry.identified === false) {
    return { ok: false, character, reason: 'item-unidentified' }
  }
  if (!dnd5eInventoryEntryIsActive(entry)) {
    return { ok: false, character, reason: 'item-inactive' }
  }
  if (
    input.costs.length > 32 ||
    input.costs.some((cost) => !Number.isSafeInteger(cost.amount) || cost.amount < 0 || cost.amount > 1_000_000)
  ) return { ok: false, character, reason: 'invalid-cost' }

  const quantityCost = input.costs
    .filter((cost): cost is Extract<Dnd5eInventoryActivityCost, { kind: 'quantity' }> => cost.kind === 'quantity')
    .reduce((sum, cost) => sum + cost.amount, 0)
  if (quantityCost > entry.quantity) {
    return { ok: false, character, reason: 'insufficient-quantity' }
  }
  const resourceCosts = new Map<string, number>()
  for (const cost of input.costs) {
    if (cost.kind !== 'resource') continue
    resourceCosts.set(cost.resourceId, (resourceCosts.get(cost.resourceId) ?? 0) + cost.amount)
  }
  for (const [resourceId, amount] of resourceCosts) {
    const resource = entry.resources?.[resourceId]
    if (!resource) return { ok: false, character, reason: 'resource-not-found' }
    if (resource.current < amount) return { ok: false, character, reason: 'insufficient-resource' }
  }

  let next: Character = { ...character, dnd5eInventory: inventory }
  const lastChargeChecks: Dnd5eInventoryLastChargeCheck[] = []
  for (const [resourceId, amount] of resourceCosts) {
    if (amount === 0) continue
    const resource = entry.resources?.[resourceId]
    if (!resource) return { ok: false, character, reason: 'resource-not-found' }
    const spent = spendDnd5eInventoryResource(next, input.instanceId, resourceId, amount)
    if (!spent.ok) return { ok: false, character, reason: spent.reason }
    next = spent.character
    const destruction = resourceCosts.get(resourceId) === resource.current
      ? resource.lastChargeDestruction
      : undefined
    if (destruction) {
      const supplied = input.lastChargeDestructionRolls?.[resourceId]
      const roll = Number.isInteger(supplied) && supplied! >= 1 && supplied! <= destruction.dieSides
        ? supplied!
        : secureDie(destruction.dieSides)
      lastChargeChecks.push({
        resourceId,
        roll,
        dieSides: destruction.dieSides,
        destroyed: roll === destruction.destroyOn,
      })
    }
  }
  if (quantityCost > 0) {
    const currentEntry = normalizeDnd5eInventory(next).entries.find((candidate) => candidate.instanceId === input.instanceId)
    if (!currentEntry) return { ok: false, character, reason: 'item-not-found' }
    next = removeItem(next, currentEntry, quantityCost)
  }
  if (lastChargeChecks.some((check) => check.destroyed)) {
    const currentEntry = normalizeDnd5eInventory(next).entries.find((candidate) => candidate.instanceId === input.instanceId)
    if (currentEntry) next = removeItem(next, currentEntry, currentEntry.quantity)
  }
  next = recordDnd5eInventoryUseReceipt(next, input.receiptId)
  return {
    ok: true,
    character: next,
    deduplicated: false,
    ...(lastChargeChecks.length ? { lastChargeChecks } : {}),
  }
}

export function spendDnd5eInventoryResource(
  character: Character,
  instanceId: string,
  resourceId: string,
  amount = 1,
): { ok: true; character: Character; resource: Dnd5eInventoryResourceState } | { ok: false; reason: 'item-not-found' | 'resource-not-found' | 'insufficient-resource'; character: Character } {
  const inventory = normalizeDnd5eInventory(character)
  const entry = inventory.entries.find((candidate) => candidate.instanceId === instanceId)
  if (!entry) return { ok: false, reason: 'item-not-found', character }
  const resource = entry.resources?.[resourceId]
  if (!resource) return { ok: false, reason: 'resource-not-found', character }
  const spend = Math.max(1, Math.floor(Number(amount) || 1))
  if (resource.current < spend) return { ok: false, reason: 'insufficient-resource', character }
  const nextResource = { ...resource, current: resource.current - spend }
  const entries = inventory.entries.map((candidate) => candidate.instanceId === instanceId
    ? { ...candidate, resources: { ...candidate.resources, [resourceId]: nextResource } }
    : candidate)
  return {
    ok: true,
    character: { ...character, dnd5eInventory: inventoryWithEntries(inventory, entries) },
    resource: nextResource,
  }
}

/** 恢复绑定到短休、长休或黎明的实例资源；随机恢复骰由 Host 权威投掷。 */
export function restoreDnd5eInventoryResources(
  character: Character,
  rest: 'short-rest' | 'long-rest' | 'dawn',
  recoveryRolls: Readonly<Record<string, readonly number[]>> = {},
): Character {
  const inventory = normalizeDnd5eInventory(character)
  let changed = false
  const entries = inventory.entries.map((entry) => {
    if (!entry.resources) return entry
    let entryChanged = false
    const resources = Object.fromEntries(Object.entries(entry.resources).map(([id, resource]) => {
      const resets = resource.resetOn === rest || (rest === 'long-rest' && resource.resetOn === 'short-rest')
      if (!resets || resource.current === resource.maximum) return [id, resource]
      if (resource.recovery?.trigger === rest && resource.recovery.kind === 'dice') {
        const key = `${entry.instanceId}:${id}`
        const supplied = recoveryRolls[key]
        const { count, sides, bonus } = resource.recovery.dice
        const rolls = supplied?.length === count && supplied.every((roll) => Number.isInteger(roll) && roll >= 1 && roll <= sides)
          ? supplied
          : Array.from({ length: count }, () => secureDie(sides))
        const recovered = rolls.reduce((sum, roll) => sum + roll, 0) + bonus
        const current = Math.min(resource.maximum, resource.current + Math.max(0, recovered))
        if (current === resource.current) return [id, resource]
        changed = true
        entryChanged = true
        return [id, { ...resource, current }]
      }
      changed = true
      entryChanged = true
      return [id, { ...resource, current: resource.maximum }]
    }))
    return entryChanged ? { ...entry, resources } : entry
  })
  return changed
    ? { ...character, dnd5eInventory: inventoryWithEntries(inventory, entries) }
    : character
}

export function dnd5eAttunedItemCount(character: Character): number {
  return normalizeDnd5eInventory(character).entries.filter((entry) => entry.attuned).length
}

export function dnd5eInventoryEntryIsActive(entry: Dnd5eInventoryEntry): boolean {
  if (entry.planarState === 'ethereal') return false
  if (entry.item.magicItem && entry.identified === false) return false
  return entry.item.magicItem?.attunement !== 'required' || entry.attuned === true
}

/** 完成短休时只完成一件预先选择的同调，并再次核验三件上限。 */
export function resolveDnd5eAttunementAfterShortRest(character: Character, now = Date.now()): Character {
  const inventory = normalizeDnd5eInventory(character)
  const pending = inventory.entries.find((entry) => entry.attunementPending)
  if (!pending) return character
  const currentCount = inventory.entries.filter((entry) => entry.attuned).length
  const entries = inventory.entries.map((entry) => {
    if (entry.instanceId !== pending.instanceId) return entry.attunementPending ? { ...entry, attunementPending: undefined } : entry
    return currentCount >= 3
      ? { ...entry, attunementPending: undefined }
      : { ...entry, attuned: true, attunementPending: undefined, attunedAt: now }
  })
  return { ...character, dnd5eInventory: inventoryWithEntries(inventory, entries) }
}

export function rollDnd5eInventoryHealing(item: Dnd5eInventoryItemTemplate, useActionId?: string): number[] {
  const use = useActionId == null
    ? item.use
    : item.useActions?.find((action) => action.id === useActionId)
  if (use?.effect.kind !== 'healing') return []
  const { count, sides } = use.effect.dice
  return Array.from({ length: count }, () => secureDie(sides))
}

export function applyDnd5eInventoryMutation(
  characters: readonly Character[],
  mutation: Dnd5eInventoryMutation,
  options: { turnEconomy?: Dnd5eTurnEconomyCounts; transaction?: CombatTransaction } = {},
): Dnd5eInventoryMutationResult & { transaction?: CombatTransaction } {
  const mutationResult = applyDnd5eInventoryMutationInternal(characters, mutation, { turnEconomy: options.turnEconomy })
  const result = mutationResult.ok
    ? {
        ...mutationResult,
        characters: reconcileDnd5eContingencyInventory(
          reconcileDnd5eWardingBondInventory(mutationResult.characters),
        ),
      }
    : mutationResult
  let transaction = options.transaction
  if (!transaction) return result

  if (mutation.type === 'use' && mutation.healingRolls?.length) {
    const character = characters.find((candidate) => candidate.id === mutation.characterId)
    const entry = character
      ? normalizeDnd5eInventory(character).entries.find((candidate) => candidate.instanceId === mutation.instanceId)
      : undefined
    const use = entry
      ? dnd5eInventoryEntryUseAction(entry, mutation.useActionId)
      : undefined
    const dice = use?.effect.kind === 'healing' ? use.effect.dice : undefined
    if (
      dice && mutation.healingRolls.every((roll) => Number.isInteger(roll) && roll >= 1 && roll <= dice.sides) &&
      !transaction.rollLedger.entries.some((candidate) => candidate.id === `${transaction!.id}:item-healing`)
    ) {
      transaction = appendRollLedgerEntry(transaction, {
        id: `${transaction.id}:item-healing`,
        kind: 'healing',
        label: entry?.item.name ?? 'item healing',
        dice: { sides: dice.sides, values: [...mutation.healingRolls] },
        modifier: dice.bonus,
        visibility: 'public',
        sourceId: mutation.characterId,
      })
    }
  }
  return {
    ...result,
    transaction: result.ok
      ? commitCombatTransaction(transaction)
      : rollbackCombatTransaction(transaction, result.reason ?? 'inventory-mutation-rejected'),
  }
}

export function dnd5eInventoryHasAuthorityGrantReceipt(
  characters: readonly Character[],
  receiptId: string,
): boolean {
  return characters.some((character) =>
    normalizeDnd5eInventory(character).authorityGrantReceipts?.includes(receiptId),
  )
}

/**
 * 将一组 DM 权威奖励与确定性收据一次写入角色库存。
 * 所有模板与数量先完整校验；任意一项无效时不会发生部分发放。
 */
export function applyDnd5eInventoryGrantBundle(
  characters: readonly Character[],
  input: {
    characterId: string
    grants: readonly Dnd5eInventoryGrant[]
    currencyGrants?: readonly import('../../types/inventory').Dnd5eInventoryCurrencyGrant[]
    receiptId: string
  },
): Dnd5eInventoryMutationResult {
  const receiptId = input.receiptId.trim()
  if (!receiptId || receiptId.length > 300) return failed(characters, 'invalid-receipt')
  if (dnd5eInventoryHasAuthorityGrantReceipt(characters, receiptId)) {
    return {
      ...succeeded(characters, '该奖励已经结算，不会重复发放。'),
      deduplicated: true,
    }
  }
  const sourceIndex = characters.findIndex((character) => character.id === input.characterId)
  if (sourceIndex < 0) return failed(characters, 'character-not-found')
  if (input.grants.length > 12) return failed(characters, 'invalid-quantity')
  if ((input.currencyGrants?.length ?? 0) > 24) return failed(characters, 'invalid-currency')

  const validated = input.grants.map((grant) => ({
    grant,
    quantity: validQuantity(grant.quantity),
    template: dnd5eInventoryItemTemplate(grant.templateId),
  }))
  if (validated.some((entry) => !entry.quantity)) return failed(characters, 'invalid-quantity')
  if (validated.some((entry) => !entry.template)) return failed(characters, 'template-not-found')
  if (validated.some(({ grant }) =>
    (grant.expiresAtWorldMinute != null && (
      !Number.isSafeInteger(grant.expiresAtWorldMinute) || grant.expiresAtWorldMinute < 0
    )) ||
    (grant.generatedByRulesId != null &&
      !/^[a-z0-9][a-z0-9._:-]{0,199}$/.test(grant.generatedByRulesId)),
  )) return failed(characters, 'invalid-quantity')
  const currencyGrants = (input.currencyGrants ?? []).map((grant) => ({
    currency: grant.currency,
    amount: Number(grant.amount),
  }))
  if (currencyGrants.some((grant) =>
    !isCurrency(grant.currency) ||
    !Number.isSafeInteger(grant.amount) ||
    grant.amount < 1 ||
    grant.amount > 1_000_000,
  )) return failed(characters, 'invalid-currency')

  let next = withNormalizedInventory(characters[sourceIndex])
  for (const entry of validated) {
    next = addItem(next, entry.template!, entry.quantity!, {
      identified: entry.grant.identified ?? true,
      expiresAtWorldMinute: entry.grant.expiresAtWorldMinute,
      generatedByRulesId: entry.grant.generatedByRulesId,
    })
  }
  const inventory = normalizeDnd5eInventory(next)
  const currency = { ...EMPTY_CURRENCY, ...inventory.currency }
  for (const grant of currencyGrants) {
    const nextAmount = currency[grant.currency] + grant.amount
    if (!Number.isSafeInteger(nextAmount) || nextAmount > 1_000_000_000) {
      return failed(characters, 'invalid-currency')
    }
    currency[grant.currency] = nextAmount
  }
  next = {
    ...next,
    dnd5eInventory: {
      ...inventory,
      revision: (inventory.revision ?? 0) + 1,
      currency,
      authorityGrantReceipts: [
        ...(inventory.authorityGrantReceipts ?? []),
        receiptId,
      ].slice(-512),
    },
  }
  const rewardText = validated.length > 0
    ? validated.map((entry) => `${entry.template!.name} ×${entry.quantity}`).join('、')
    : '无物品奖励'
  const currencyText = currencyGrants.length > 0
    ? currencyGrants.map((grant) => `${currencyLabel(grant.currency)} ×${grant.amount}`).join('、')
    : ''
  return succeeded(
    replaceAt(characters, sourceIndex, next),
    `${next.name} 获得：${[rewardText, currencyText].filter(Boolean).join('；')}。`,
  )
}

/** Identify only offers magic-item instances whose properties are still hidden. */
export function dnd5eInventoryEntryIsUnidentifiedMagicItem(
  entry: Dnd5eInventoryEntry,
): boolean {
  return entry.quantity > 0 && entry.identified === false && (
    entry.item.magicItem != null || isProjectedUnidentifiedMagicItem(entry)
  )
}

/** Stable player-facing label for selecting one concrete unidentified instance. */
export function dnd5eInventoryIdentificationOptionLabel(
  entry: Dnd5eInventoryEntry,
): string {
  const rarity = entry.item.magicItem?.rarity ?? entry.unidentifiedMagicItemRarity
  return rarity
    ? `${entry.item.name}（${DND5E_MAGIC_ITEM_RARITY_LABELS[rarity]}）`
    : `${entry.item.name}（稀有度未知）`
}

export interface Dnd5eInventoryIdentificationCandidate {
  characterId: string
  characterName: string
  inventoryRevision: number
  entry: Dnd5eInventoryEntry
  label: string
}

/**
 * Room-wide Identify candidates. Other players' inventories may be a
 * server-redacted projection containing only unidentified placeholders; this
 * helper deliberately depends only on those safe fields.
 */
export function dnd5eInventoryIdentificationCandidates(
  characters: readonly Character[],
): Dnd5eInventoryIdentificationCandidate[] {
  return characters.flatMap((character) => {
    if (character.visibleToPlayers === false) return []
    const inventory = normalizeDnd5eInventory(character)
    return inventory.entries
      .filter(dnd5eInventoryEntryIsUnidentifiedMagicItem)
      .map((entry) => {
        const rarity = entry.item.magicItem?.rarity ?? entry.unidentifiedMagicItemRarity
        const rarityLabel = rarity ? DND5E_MAGIC_ITEM_RARITY_LABELS[rarity] : '稀有度未知'
        return {
          characterId: character.id,
          characterName: character.name,
          inventoryRevision: inventory.revision ?? 0,
          entry,
          label: `${character.name} - ${entry.item.name} - ${rarityLabel}`,
        }
      })
  })
}

export function dnd5eInventoryEntryIsNonmagicalFoodOrDrink(
  entry: Dnd5eInventoryEntry,
): boolean {
  if (entry.item.magicItem || entry.generatedByRulesId === 'goodberry') return false
  return entry.item.icon === 'rations' || entry.item.icon === 'waterskin'
}

type Dnd5eLinkedSpellAuthorityEstablishment = Extract<
  Dnd5eActivityCapabilityProposal,
  { kind: 'establish-spell-authority' }
>

type Dnd5eLinkedSpellAuthorityTransition = Extract<
  Dnd5eActivityCapabilityProposal,
  { kind: 'transition-spell-authority' }
>

export type Dnd5eLinkedSpellAuthorityInventoryFailure =
  | 'inventory-context-required'
  | 'stale-inventory-revision'
  | 'material-component-unavailable'
  | 'invalid-receipt'

export type Dnd5eLinkedSpellAuthorityInventoryResult =
  | {
      ok: true
      characters: Character[]
      message: string
      holderCharacterId?: string
      holderName?: string
      linkedItemName?: string
      recalled?: boolean
      deduplicated?: boolean
    }
  | {
      ok: false
      characters: Character[]
      reason: Dnd5eLinkedSpellAuthorityInventoryFailure
    }

/**
 * Commits the inventory half of a long-lived spell authority transaction.
 * Combat records live in Headless state, while concrete item ownership,
 * planar location and trigger materials live in character inventory.
 */
export function applyDnd5eLinkedSpellAuthorityInventoryHandoff(
  characters: readonly Character[],
  input: {
    sourceCharacterId: string
    sourceActorAuthorityId: string
    receiptId: string
    establishments?: readonly Dnd5eLinkedSpellAuthorityEstablishment[]
    transitions?: readonly Dnd5eLinkedSpellAuthorityTransition[]
    expectedInventoryRevision?: number
  },
): Dnd5eLinkedSpellAuthorityInventoryResult {
  const receiptId = input.receiptId.trim()
  if (!validAuthorityReceiptId(receiptId)) {
    return { ok: false, characters: [...characters], reason: 'invalid-receipt' }
  }
  if (characters.some((character) =>
    normalizeDnd5eInventory(character).authorityUseReceipts?.includes(receiptId))) {
    return {
      ok: true,
      characters: [...characters],
      message: '该长期法术物品事务已经结算，不会重复应用。',
      deduplicated: true,
    }
  }
  const sourceIndex = characters.findIndex((character) => character.id === input.sourceCharacterId)
  if (sourceIndex < 0) {
    return { ok: false, characters: [...characters], reason: 'inventory-context-required' }
  }
  const establishments = (input.establishments ?? []).filter((proposal) =>
    proposal.recordKind === 'linked-planar-object')
  const transitions = (input.transitions ?? []).filter((proposal) =>
    proposal.recordKind === 'linked-planar-object')
  if (establishments.length + transitions.length !== 1) {
    return { ok: false, characters: [...characters], reason: 'inventory-context-required' }
  }

  const establishment = establishments[0]
  if (establishment) {
    const profile = establishment.linkedObjectProfile
    const source = withNormalizedInventory(characters[sourceIndex])
    const inventory = normalizeDnd5eInventory(source)
    if (
      establishment.sourceActorId !== input.sourceActorAuthorityId ||
      !profile || !establishment.inventoryInstanceId ||
      input.expectedInventoryRevision == null
    ) {
      return { ok: false, characters: [...characters], reason: 'inventory-context-required' }
    }
    if (inventory.revision !== input.expectedInventoryRevision) {
      return { ok: false, characters: [...characters], reason: 'stale-inventory-revision' }
    }
    const linked = inventory.entries.find((entry) =>
      entry.instanceId === establishment.inventoryInstanceId)
    if (!linked) {
      return { ok: false, characters: [...characters], reason: 'inventory-context-required' }
    }
    if (profile === 'instant-summons' && (
      (linked.item.weightLb ?? 0) > 10 ||
      (linked.item.longestDimensionFeet ?? 0) > 6 ||
      linked.linkedSpellAuthorityRecordId != null
    )) {
      return { ok: false, characters: [...characters], reason: 'inventory-context-required' }
    }
    const recordId = dnd5eLinkedPlanarObjectAuthorityRecordId(
      profile,
      input.sourceActorAuthorityId,
      linked.instanceId,
    )
    const planarState = profile === 'secret-chest' ? 'ethereal' as const : 'material' as const
    let nextEntries = inventory.entries.map((entry) => ({
      ...entry,
      linkedSpellAuthorityRecordId: entry.linkedSpellAuthorityRecordId === recordId
        ? undefined
        : entry.linkedSpellAuthorityRecordId,
      linkedSpellFocusAuthorityRecordId: entry.linkedSpellFocusAuthorityRecordId === recordId
        ? undefined
        : entry.linkedSpellFocusAuthorityRecordId,
    }))
    if (profile === 'instant-summons') {
      const sapphire = nextEntries.find((entry) =>
        entry.instanceId !== linked.instanceId && entry.quantity > 0 &&
        entry.linkedSpellFocusAuthorityRecordId == null &&
        entry.item.spellcastingMaterial?.tags.includes('sapphire') === true &&
        (entry.item.spellcastingMaterial.unitValueGp ?? 0) >= 1_000)
      if (!sapphire) {
        return { ok: false, characters: [...characters], reason: 'material-component-unavailable' }
      }
      if (sapphire.quantity === 1) {
        nextEntries = nextEntries.map((entry) => entry.instanceId === sapphire.instanceId
          ? { ...entry, linkedSpellFocusAuthorityRecordId: recordId }
          : entry)
      } else {
        const remainingQuantity = sapphire.quantity - 1
        nextEntries = [
          ...nextEntries.map((entry) => entry.instanceId === sapphire.instanceId
            ? {
                ...entry,
                quantity: remainingQuantity,
                resources: resizeInventoryResources(
                  entry.resources,
                  inventoryResourceDefinitions(entry.item),
                  remainingQuantity,
                ),
              }
            : entry),
          {
            ...sapphire,
            instanceId: inventoryId(),
            quantity: 1,
            resources: resizeInventoryResources(
              sapphire.resources,
              inventoryResourceDefinitions(sapphire.item),
              1,
            ),
            equippedSlot: undefined,
            containerInstanceId: undefined,
            linkedSpellFocusAuthorityRecordId: recordId,
          },
        ]
      }
    }
    const nextInventory = inventoryWithEntries(inventory, nextEntries.map((entry) =>
      entry.instanceId === linked.instanceId
        ? {
            ...entry,
            planarState,
            linkedSpellAuthorityRecordId: recordId,
            equippedSlot: planarState === 'ethereal' ? undefined : entry.equippedSlot,
          }
        : entry))
    const nextSource: Character = {
      ...source,
      dnd5eInventory: {
        ...nextInventory,
        authorityUseReceipts: [...(nextInventory.authorityUseReceipts ?? []), receiptId].slice(-512),
      },
    }
    return {
      ok: true,
      characters: replaceAt(characters, sourceIndex, nextSource),
      message: `${linked.item.name} 已建立${profile === 'instant-summons' ? '瞬间召唤' : '秘法箱'}的长期法术连结。`,
      holderCharacterId: source.id,
      holderName: source.name,
      linkedItemName: linked.item.name,
      recalled: false,
    }
  }

  const transition = transitions[0]!
  const profile = transition.linkedObjectProfile
  if (transition.sourceActorId !== input.sourceActorAuthorityId || !profile) {
    return { ok: false, characters: [...characters], reason: 'inventory-context-required' }
  }
  const requestedRecordId = transition.authorityRecordId
  const sourceRecords = characters[sourceIndex].dnd5eCombatState?.spellAuthorityRecords ?? {}
  const recordId = requestedRecordId ?? Object.values(sourceRecords).find((record) =>
    record.kind === 'linked-planar-object' && record.profile === profile &&
    record.sourceActorId === input.sourceActorAuthorityId)?.id ??
    `linked-planar-object:${profile}:${input.sourceActorAuthorityId}`
  const holderIndex = characters.findIndex((character) =>
    normalizeDnd5eInventory(character).entries.some((entry) =>
      entry.linkedSpellAuthorityRecordId === recordId))
  if (holderIndex < 0) {
    return { ok: false, characters: [...characters], reason: 'inventory-context-required' }
  }
  const holder = withNormalizedInventory(characters[holderIndex])
  const linked = normalizeDnd5eInventory(holder).entries.find((entry) =>
    entry.linkedSpellAuthorityRecordId === recordId)!
  const nextCharacters = [...characters]

  if (profile === 'instant-summons') {
    if (transition.transition !== 'recall-to-source') {
      return { ok: false, characters: [...characters], reason: 'inventory-context-required' }
    }
    let source = withNormalizedInventory(nextCharacters[sourceIndex])
    const sourceInventory = normalizeDnd5eInventory(source)
    const sapphire = sourceInventory.entries.find((entry) =>
      entry.instanceId !== linked.instanceId && entry.quantity > 0 &&
      entry.linkedSpellFocusAuthorityRecordId === recordId &&
      entry.item.spellcastingMaterial?.tags.includes('sapphire') === true &&
      (entry.item.spellcastingMaterial.unitValueGp ?? 0) >= 1_000)
    if (!sapphire) {
      return { ok: false, characters: [...characters], reason: 'material-component-unavailable' }
    }
    source = removeItem(source, sapphire, 1)
    nextCharacters[sourceIndex] = source
  } else if (
    transition.transition !== 'recall-to-source' &&
    transition.transition !== 'send-to-ethereal'
  ) {
    return { ok: false, characters: [...characters], reason: 'inventory-context-required' }
  }

  const currentHolder = withNormalizedInventory(nextCharacters[holderIndex])
  const holderInventory = normalizeDnd5eInventory(currentHolder)
  const nextPlanarState = transition.transition === 'send-to-ethereal'
    ? 'ethereal' as const
    : 'material' as const
  const clearLink = profile === 'instant-summons' && transition.transition === 'recall-to-source'
  const nextHolderInventory = inventoryWithEntries(holderInventory, holderInventory.entries.map((entry) =>
    entry.instanceId === linked.instanceId
      ? {
          ...entry,
          planarState: nextPlanarState,
          linkedSpellAuthorityRecordId: clearLink ? undefined : recordId,
          equippedSlot: nextPlanarState === 'ethereal' ? undefined : entry.equippedSlot,
        }
      : entry))
  nextCharacters[holderIndex] = {
    ...currentHolder,
    dnd5eInventory: {
      ...nextHolderInventory,
      authorityUseReceipts: [
        ...(nextHolderInventory.authorityUseReceipts ?? []),
        receiptId,
      ].slice(-512),
    },
  }
  if (profile === 'instant-summons') {
    const nextSource = nextCharacters[sourceIndex]
    const hasRemainingLink = Object.values(
      nextSource.dnd5eCombatState?.spellAuthorityRecords ?? {},
    ).some((record) =>
      record.kind === 'linked-planar-object' && record.profile === 'instant-summons')
    if (!hasRemainingLink) {
      const activeEffects = (nextSource.dnd5eCombatState?.activeEffects ?? []).filter((effect) => !(
        effect.source.actorId === input.sourceActorAuthorityId &&
        effect.source.rulesId === 'instant-summons' &&
        effect.grantedActivities?.includes('spell:instant-summons:recall')
      ))
      nextCharacters[sourceIndex] = {
        ...nextSource,
        dnd5eCombatState: {
          ...(nextSource.dnd5eCombatState ?? { schemaVersion: 2 as const }),
          activeEffects: activeEffects.length > 0 ? activeEffects : undefined,
        },
      }
    }
  }
  const holderIsSource = holder.id === input.sourceCharacterId
  return {
    ok: true,
    characters: nextCharacters,
    message: profile === 'instant-summons'
      ? holderIsSource
        ? `${characters[sourceIndex].name} 捏碎并消耗一枚价值至少 1,000 gp 的蓝宝石；${linked.item.name} 出现在施法者手中，长期连结结束。`
        : `${characters[sourceIndex].name} 捏碎并消耗一枚价值至少 1,000 gp 的蓝宝石；${linked.item.name} 正由 ${holder.name} 持有，因此没有转移，只揭示持有者与大致位置。`
      : `${linked.item.name} 已${nextPlanarState === 'ethereal' ? '送往以太位面' : '召回物质位面'}。`,
    holderCharacterId: holder.id,
    holderName: holder.name,
    linkedItemName: linked.item.name,
    recalled: profile === 'instant-summons' ? holderIsSource : nextPlanarState === 'material',
  }
}

export interface Dnd5eInstantSummonsSapphireDispelTarget {
  recordId: string
  sapphireInstanceId: string
  sapphireName: string
  holderCharacterId: string
  sourceCharacterId: string
  sourceActorAuthorityId: string
  linkedItemName?: string
  controllerEffectIds: readonly string[]
  controllerSpellLevel: number
}

/**
 * Resolves an inventory instance to the exact sapphire anchoring an active
 * Instant Summons link. The marker is Host-owned and instance-bound, so a
 * player cannot turn an arbitrary sapphire into a Dispel Magic target.
 */
export function dnd5eInstantSummonsSapphireDispelTarget(
  characters: readonly Character[],
  sapphireInstanceId: string | undefined,
): Dnd5eInstantSummonsSapphireDispelTarget | undefined {
  if (!sapphireInstanceId) return undefined
  for (const holder of characters) {
    const sapphire = normalizeDnd5eInventory(holder).entries.find((entry) =>
      entry.instanceId === sapphireInstanceId && entry.quantity === 1 &&
      entry.item.spellcastingMaterial?.tags.includes('sapphire') === true &&
      (entry.item.spellcastingMaterial.unitValueGp ?? 0) >= 1_000 &&
      entry.linkedSpellFocusAuthorityRecordId != null)
    const recordId = sapphire?.linkedSpellFocusAuthorityRecordId
    if (!sapphire || !recordId) continue
    const source = characters.find((character) => {
      const record = character.dnd5eCombatState?.spellAuthorityRecords?.[recordId]
      return record?.kind === 'linked-planar-object' && record.profile === 'instant-summons'
    })
    const record = source?.dnd5eCombatState?.spellAuthorityRecords?.[recordId]
    if (!source || !record || record.kind !== 'linked-planar-object' || record.profile !== 'instant-summons') {
      continue
    }
    const linkedItem = characters.flatMap((character) =>
      normalizeDnd5eInventory(character).entries,
    ).find((entry) => entry.linkedSpellAuthorityRecordId === recordId)
    const controllerEffects = (source.dnd5eCombatState?.activeEffects ?? [])
      .filter((effect) =>
        effect.source.actorId === record.sourceActorId &&
        effect.source.rulesId === 'instant-summons' &&
        effect.grantedActivities?.includes('spell:instant-summons:recall'))
    if (controllerEffects.length < 1) continue
    return {
      recordId,
      sapphireInstanceId: sapphire.instanceId,
      sapphireName: sapphire.item.name,
      holderCharacterId: holder.id,
      sourceCharacterId: source.id,
      sourceActorAuthorityId: record.sourceActorId,
      linkedItemName: linkedItem?.item.name,
      controllerEffectIds: controllerEffects.map((effect) => effect.id),
      controllerSpellLevel: record.spellLevel ??
        Math.max(...controllerEffects.map((effect) => effect.source.spellLevel ?? 6)),
    }
  }
  return undefined
}

/** Ends the long-lived link without consuming the sapphire. */
export function applyDnd5eInstantSummonsSapphireDispel(
  characters: readonly Character[],
  target: Dnd5eInstantSummonsSapphireDispelTarget,
): { ok: true; characters: Character[]; message: string } | {
  ok: false
  characters: Character[]
  reason: 'inventory-context-required'
} {
  const authoritative = dnd5eInstantSummonsSapphireDispelTarget(
    characters,
    target.sapphireInstanceId,
  )
  if (!authoritative || authoritative.recordId !== target.recordId) {
    return { ok: false, characters: [...characters], reason: 'inventory-context-required' }
  }
  const controllerIds = new Set(authoritative.controllerEffectIds)
  const nextCharacters = characters.map((character) => {
    const inventory = normalizeDnd5eInventory(character)
    const inventoryChanged = inventory.entries.some((entry) =>
      entry.linkedSpellAuthorityRecordId === authoritative.recordId ||
      entry.linkedSpellFocusAuthorityRecordId === authoritative.recordId)
    const nextInventory = inventoryChanged
      ? inventoryWithEntries(inventory, inventory.entries.map((entry) => ({
          ...entry,
          linkedSpellAuthorityRecordId: entry.linkedSpellAuthorityRecordId === authoritative.recordId
            ? undefined
            : entry.linkedSpellAuthorityRecordId,
          linkedSpellFocusAuthorityRecordId: entry.linkedSpellFocusAuthorityRecordId === authoritative.recordId
            ? undefined
            : entry.linkedSpellFocusAuthorityRecordId,
          planarState: entry.linkedSpellAuthorityRecordId === authoritative.recordId
            ? 'material'
            : entry.planarState,
        })))
      : inventory
    if (character.id !== authoritative.sourceCharacterId) {
      return inventoryChanged ? { ...character, dnd5eInventory: nextInventory } : character
    }
    const records = Object.fromEntries(Object.entries(
      character.dnd5eCombatState?.spellAuthorityRecords ?? {},
    ).filter(([recordId]) => recordId !== authoritative.recordId))
    const hasRemainingLink = Object.values(records).some((record) =>
      record.kind === 'linked-planar-object' && record.profile === 'instant-summons')
    const activeEffects = hasRemainingLink
      ? (character.dnd5eCombatState?.activeEffects ?? [])
      : (character.dnd5eCombatState?.activeEffects ?? [])
          .filter((effect) => !controllerIds.has(effect.id))
    return {
      ...character,
      dnd5eInventory: nextInventory,
      dnd5eCombatState: {
        ...(character.dnd5eCombatState ?? { schemaVersion: 2 as const }),
        spellAuthorityRecords: Object.keys(records).length > 0 ? records : undefined,
        activeEffects: activeEffects.length > 0 ? activeEffects : undefined,
      },
    }
  })
  return {
    ok: true,
    characters: nextCharacters,
    message: `解除魔法以 ${authoritative.sapphireName} 为目标；${authoritative.linkedItemName ?? '连结物品'} 的瞬间召唤长期连结结束，蓝宝石未被消耗。`,
  }
}

function applyDnd5eInventoryMutationInternal(
  characters: readonly Character[],
  mutation: Dnd5eInventoryMutation,
  options: { turnEconomy?: Dnd5eTurnEconomyCounts } = {},
): Dnd5eInventoryMutationResult {
  const sourceIndex = characters.findIndex((character) => character.id === mutation.characterId)
  if (sourceIndex < 0) return failed(characters, 'character-not-found')
  const source = withNormalizedInventory(characters[sourceIndex])

  if (
    mutation.type === 'use' || mutation.type === 'identify' ||
    mutation.type === 'break-cursed-attunement' || mutation.type === 'purify-consumable'
  ) {
    const inventory = normalizeDnd5eInventory(source)
    if (mutation.receiptId != null && !validAuthorityReceiptId(mutation.receiptId)) {
      return failed(characters, 'invalid-receipt')
    }
    if (mutation.receiptId && inventory.authorityUseReceipts?.includes(mutation.receiptId)) {
      return {
        ...succeeded(characters, '该道具事务已经结算，不会重复消耗或应用效果。'),
        deduplicated: true,
      }
    }
    if (
      mutation.expectedInventoryRevision != null &&
      mutation.expectedInventoryRevision !== inventory.revision
    ) return failed(characters, 'stale-inventory-revision')
  }

  if (mutation.type === 'grant') {
    const quantity = validQuantity(mutation.quantity)
    if (!quantity) return failed(characters, 'invalid-quantity')
    const template = dnd5eInventoryItemTemplate(mutation.templateId)
    if (!template) return failed(characters, 'template-not-found')
    const next = addItem(source, template, quantity, { identified: mutation.identified ?? true })
    return succeeded(replaceAt(characters, sourceIndex, next), `${source.name} 获得 ${template.name} ×${quantity}。`)
  }

  if (mutation.type === 'adjust-currency') {
    const delta = Math.trunc(Number(mutation.delta))
    if (!Number.isFinite(delta) || delta === 0 || !isCurrency(mutation.currency)) return failed(characters, 'invalid-currency')
    const inventory = normalizeDnd5eInventory(source)
    const currency = { ...EMPTY_CURRENCY, ...inventory.currency }
    const nextAmount = currency[mutation.currency] + delta
    if (nextAmount < 0) return failed(characters, 'insufficient-currency')
    currency[mutation.currency] = nextAmount
    const next = {
      ...source,
      dnd5eInventory: { ...inventory, revision: (inventory.revision ?? 0) + 1, currency },
    }
    return succeeded(replaceAt(characters, sourceIndex, next), `${source.name} 的${currencyLabel(mutation.currency)}变更 ${delta > 0 ? '+' : ''}${delta}。`)
  }

  const entry = source.dnd5eInventory!.entries.find((candidate) => candidate.instanceId === mutation.instanceId)
  if (!entry) return failed(characters, 'item-not-found')

  if (mutation.type === 'discard') {
    const quantity = validQuantity(mutation.quantity)
    if (!quantity) return failed(characters, 'invalid-quantity')
    if (quantity > entry.quantity) return failed(characters, 'insufficient-quantity')
    const next = removeItem(source, entry, quantity)
    return succeeded(replaceAt(characters, sourceIndex, next), `${source.name} 丢弃 ${entry.item.name} ×${quantity}。`)
  }

  if (mutation.type === 'transfer') {
    if (mutation.targetCharacterId === source.id) return failed(characters, 'same-character')
    const targetIndex = characters.findIndex((character) => character.id === mutation.targetCharacterId)
    if (targetIndex < 0) return failed(characters, 'target-not-found')
    const quantity = validQuantity(mutation.quantity)
    if (!quantity) return failed(characters, 'invalid-quantity')
    if (quantity > entry.quantity) return failed(characters, 'insufficient-quantity')
    const target = withNormalizedInventory(characters[targetIndex])
    if (entry.linkedSpellAuthorityRecordId || entry.linkedSpellFocusAuthorityRecordId) {
      // A spell link belongs to one physical object, never to a duplicated or
      // merged template stack. Preserve its stable instance and Host markers.
      if (quantity !== entry.quantity) return failed(characters, 'invalid-quantity')
      const targetInventory = normalizeDnd5eInventory(target)
      if (targetInventory.entries.some((candidate) => candidate.instanceId === entry.instanceId)) {
        return failed(characters, 'invalid-target')
      }
      const nextSource = removeItem(source, entry, quantity)
      const nextTarget = {
        ...target,
        dnd5eInventory: inventoryWithEntries(targetInventory, [
          ...targetInventory.entries,
          {
            ...entry,
            equippedSlot: undefined,
            containerInstanceId: undefined,
          },
        ]),
      }
      const afterSource = replaceAt(characters, sourceIndex, nextSource)
      return succeeded(
        replaceAt(afterSource, targetIndex, nextTarget),
        `${source.name} 将 ${entry.item.name} ×${quantity} 转交给 ${target.name}；长期法术${entry.linkedSpellAuthorityRecordId ? '连结' : '锚点'}随同一物品实例保留。`,
      )
    }
    const nextSource = removeItem(source, entry, quantity)
    const nextTarget = addItem(target, entry.item, quantity, {
      identified: entry.identified !== false,
      expiresAtWorldMinute: entry.expiresAtWorldMinute,
      generatedByRulesId: entry.generatedByRulesId,
    })
    const afterSource = replaceAt(characters, sourceIndex, nextSource)
    return succeeded(replaceAt(afterSource, targetIndex, nextTarget), `${source.name} 将 ${entry.item.name} ×${quantity} 转交给 ${target.name}。`)
  }

  if (mutation.type === 'equip') {
    if (!entry.item.equipment) return failed(characters, 'not-equipment')
    if (entry.item.magicItem && entry.identified === false) return failed(characters, 'item-unidentified')
    // Replayed room commands must be idempotent. If the same equip request is
    // delivered again after the first acknowledgement, keep the instance in
    // its current slot instead of treating both hands as occupied and moving
    // the same physical item into a second projection slot.
    const requestedSlot = mutation.slot ?? entry.equippedSlot ??
      defaultEquipmentDestination(source, entry.item.equipment)
    if (!isEquipmentSlot(requestedSlot) || !equipmentSlotAcceptsItemSlot(
      requestedSlot,
      entry.item.equipment.slot,
      entry.item.equipment.allowedSlots,
    )) {
      return failed(characters, 'invalid-equipment-slot')
    }
    const next = equipEntry(source, entry, requestedSlot)
    return succeeded(replaceAt(characters, sourceIndex, next), `${source.name} 装备了 ${entry.item.name}。`)
  }

  if (mutation.type === 'unequip') {
    if (!entry.equippedSlot) return failed(characters, 'not-equipment')
    const next = unequipEntry(source, entry)
    return succeeded(replaceAt(characters, sourceIndex, next), `${source.name} 卸下了 ${entry.item.name}。`)
  }

  if (mutation.type === 'prepare-attunement') {
    if (entry.item.magicItem && entry.identified === false) return failed(characters, 'item-unidentified')
    if (entry.item.magicItem?.attunement !== 'required') return failed(characters, 'attunement-not-required')
    if (entry.attuned) return succeeded(characters, `${source.name} 已与 ${entry.item.name} 同调。`)
    if (source.dnd5eInventory!.entries.filter((candidate) => candidate.attuned).length >= 3) {
      return failed(characters, 'attunement-limit')
    }
    if (!dnd5eAttunementRequirementMet(source, entry, mutation.dmPrerequisiteConfirmed === true)) {
      return failed(characters, 'attunement-prerequisite')
    }
    const entries = source.dnd5eInventory!.entries.map((candidate) => ({
      ...candidate,
      attunementPending: candidate.instanceId === entry.instanceId ? true : undefined,
    }))
    return succeeded(replaceAt(characters, sourceIndex, {
      ...source,
      dnd5eInventory: inventoryWithEntries(source.dnd5eInventory!, entries),
    }), `${source.name} 将在下一次短休中与 ${entry.item.name} 同调。`)
  }

  if (mutation.type === 'cancel-attunement') {
    const entries = source.dnd5eInventory!.entries.map((candidate) => candidate.instanceId === entry.instanceId
      ? { ...candidate, attunementPending: undefined }
      : candidate)
    return succeeded(replaceAt(characters, sourceIndex, {
      ...source,
      dnd5eInventory: inventoryWithEntries(source.dnd5eInventory!, entries),
    }), `${source.name} 取消了同调准备。`)
  }

  if (mutation.type === 'end-attunement') {
    const entries = source.dnd5eInventory!.entries.map((candidate) => candidate.instanceId === entry.instanceId
      ? { ...candidate, attuned: undefined, attunementPending: undefined, attunedAt: undefined }
      : candidate)
    return succeeded(replaceAt(characters, sourceIndex, {
      ...source,
      dnd5eInventory: inventoryWithEntries(source.dnd5eInventory!, entries),
    }), `${source.name} 结束了与 ${entry.item.name} 的同调。`)
  }

  if (mutation.type === 'identify') {
    if (!dnd5eInventoryEntryIsUnidentifiedMagicItem(entry)) {
      return failed(characters, 'invalid-target')
    }
    const inventory = normalizeDnd5eInventory(source)
    const identified = {
      ...source,
      dnd5eInventory: inventoryWithEntries(inventory, inventory.entries.map((candidate) =>
        candidate.instanceId === entry.instanceId ? { ...candidate, identified: true } : candidate)),
    }
    const next = recordDnd5eInventoryUseReceipt(identified, mutation.receiptId)
    return succeeded(
      replaceAt(characters, sourceIndex, next),
      `${source.name} 鉴定了 ${entry.item.name}。`,
    )
  }

  if (mutation.type === 'break-cursed-attunement') {
    if (!entry.item.magicItem?.cursed) return failed(characters, 'invalid-target')
    const inventory = normalizeDnd5eInventory(source)
    const released = {
      ...source,
      dnd5eInventory: inventoryWithEntries(inventory, inventory.entries.map((candidate) =>
        candidate.instanceId === entry.instanceId
          ? {
              ...candidate,
              attuned: undefined,
              attunementPending: undefined,
              attunedAt: undefined,
            }
          : candidate)),
    }
    const next = recordDnd5eInventoryUseReceipt(released, mutation.receiptId)
    return succeeded(
      replaceAt(characters, sourceIndex, next),
      entry.attuned || entry.attunementPending
        ? `${source.name} 与 ${entry.item.name} 的同调已被解除；物品诅咒仍然存在。`
        : `${entry.item.name} 未与 ${source.name} 同调；物品诅咒仍然存在。`,
    )
  }

  if (mutation.type === 'purify-consumable') {
    const inventory = normalizeDnd5eInventory(source)
    const purified = {
      ...source,
      dnd5eInventory: inventoryWithEntries(inventory, inventory.entries.map((candidate) =>
        candidate.instanceId === entry.instanceId
          ? { ...candidate, contaminants: undefined }
          : candidate)),
    }
    const next = recordDnd5eInventoryUseReceipt(purified, mutation.receiptId)
    return succeeded(
      replaceAt(characters, sourceIndex, next),
      entry.contaminants?.length
        ? `${entry.item.name} 的毒素与疾病污染已被清除。`
        : `${entry.item.name} 没有可清除的毒素或疾病污染。`,
    )
  }

  if (mutation.type === 'set-consumable-contaminants') {
    if (!dnd5eInventoryEntryIsNonmagicalFoodOrDrink(entry)) return failed(characters, 'invalid-target')
    const contaminants = [...new Set(mutation.contaminants)]
    if (
      contaminants.length > 2 ||
      contaminants.some((contaminant) => contaminant !== 'poison' && contaminant !== 'disease')
    ) return failed(characters, 'invalid-target')
    const inventory = normalizeDnd5eInventory(source)
    const next = {
      ...source,
      dnd5eInventory: inventoryWithEntries(inventory, inventory.entries.map((candidate) =>
        candidate.instanceId === entry.instanceId
          ? { ...candidate, contaminants: contaminants.length > 0 ? contaminants : undefined }
          : candidate)),
    }
    const label = contaminants.length > 0
      ? contaminants.map((contaminant) => contaminant === 'poison' ? '毒素' : '疾病').join('、')
      : '无'
    return succeeded(
      replaceAt(characters, sourceIndex, next),
      `${source.name} 的 ${entry.item.name} 场景污染已更新：${label}。`,
    )
  }

  if (mutation.type === 'set-container') {
    const inventory = normalizeDnd5eInventory(source)
    const target = mutation.containerInstanceId
      ? inventory.entries.find((candidate) => candidate.instanceId === mutation.containerInstanceId)
      : undefined
    if (mutation.containerInstanceId && (!target || target.item.containerCapacityWeightLb == null)) return failed(characters, 'not-container')
    if (target && (target.instanceId === entry.instanceId || containerIsDescendant(inventory.entries, target.instanceId, entry.instanceId))) {
      return failed(characters, 'container-cycle')
    }
    const moved = inventory.entries.map((candidate) => candidate.instanceId === entry.instanceId
      ? { ...candidate, containerInstanceId: target?.instanceId, equippedSlot: target ? undefined : candidate.equippedSlot }
      : candidate)
    if (target && directContainerContentsWeight(moved, target.instanceId) > (target.item.containerCapacityWeightLb ?? 0)) {
      return failed(characters, 'container-capacity')
    }
    const next = entry.equippedSlot ? unequipEntry(source, entry) : source
    return succeeded(replaceAt(characters, sourceIndex, {
      ...next,
      dnd5eInventory: inventoryWithEntries(normalizeDnd5eInventory(next), moved),
    }), target ? `${entry.item.name} 已放入 ${target.item.name}。` : `${entry.item.name} 已从容器取出。`)
  }

  const use = dnd5eInventoryEntryUseAction(entry, mutation.type === 'use' ? mutation.useActionId : undefined)
  if (entry.item.magicItem && entry.identified === false) return failed(characters, 'item-unidentified')
  if (!dnd5eInventoryEntryIsActive(entry)) return failed(characters, 'item-inactive')
  if (!use) return failed(characters, 'not-usable')
  if (
    entry.quantity < use.consumeQuantity ||
    (use.chargesPerItem && (entry.resources?.uses?.current ?? 0) < 1) ||
    (use.resourceCost && (entry.resources?.[use.resourceCost.resourceId]?.current ?? 0) < use.resourceCost.amount)
  ) {
    return failed(characters, 'insufficient-quantity')
  }
  if (options.turnEconomy && use.economy === 'action' && options.turnEconomy.action.current < 1) {
    return failed(characters, 'action-unavailable')
  }
  if (options.turnEconomy && use.economy === 'bonusAction' && options.turnEconomy.bonusAction.current < 1) {
    return failed(characters, 'bonus-action-unavailable')
  }

  const targetIndex = mutation.targetCharacterId == null || mutation.targetCharacterId === source.id
    ? sourceIndex
    : characters.findIndex((character) => character.id === mutation.targetCharacterId)
  if (targetIndex < 0) return failed(characters, 'target-not-found')
  const target = targetIndex === sourceIndex
    ? source
    : withNormalizedInventory(characters[targetIndex])
  let nextSource = source
  let nextTarget = target
  let healingRolled: number | undefined
  let healingApplied: number | undefined
  let spellSlotLevel: number | undefined
  let spellSlotsRecovered: number | undefined
  let requiresDmAdjudication: string | undefined
  if (use.effect.kind === 'healing') {
    const rolls = mutation.healingRolls
    const { count, sides, bonus } = use.effect.dice
    if (!rolls || rolls.length !== count || rolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > sides)) {
      return failed(characters, 'invalid-rolls')
    }
    healingRolled = rolls.reduce((sum, roll) => sum + roll, bonus)
    healingApplied = Math.min(healingRolled, Math.max(0, target.maxHp - target.currentHp))
    nextTarget = {
      ...target,
      currentHp: Math.min(target.maxHp, target.currentHp + healingRolled),
      dnd5eCombatState: healingApplied > 0 && (target.dnd5eCombatState?.caltropsSpeedPenaltyFeet ?? 0) > 0
        ? { ...target.dnd5eCombatState, caltropsSpeedPenaltyFeet: undefined }
        : target.dnd5eCombatState,
    }
    if (targetIndex === sourceIndex) nextSource = nextTarget
  } else if (use.effect.kind === 'spell-slot-recovery') {
    if (targetIndex !== sourceIndex) return failed(characters, 'invalid-target')
    const selectedLevel = mutation.spellSlotLevel
    if (
      !Number.isInteger(selectedLevel) || selectedLevel == null || selectedLevel < 1 ||
      selectedLevel > use.effect.maximumSlotLevel
    ) return failed(characters, 'invalid-spell-slot')
    const resourceKey = `dnd5e-spell-slot-${selectedLevel}`
    const resource = source.classResources?.[resourceKey]
    if (!resource || resource.max < 1 || resource.current >= resource.max) {
      return failed(characters, 'spell-slot-unavailable')
    }
    spellSlotLevel = selectedLevel
    spellSlotsRecovered = Math.min(use.effect.amount, resource.max - resource.current)
    nextSource = {
      ...source,
      classResources: {
        ...(source.classResources ?? {}),
        [resourceKey]: { ...resource, current: resource.current + spellSlotsRecovered },
      },
    }
    nextTarget = nextSource
  } else if (use.effect.kind === 'spell-cast') {
    // Item spells must use dnd5e-spell-cast so targeting, range, visibility,
    // saves, damage, concentration and resource spending remain one Host
    // transaction. Direct inventory-use requests fail closed.
    return failed(characters, 'not-usable')
  } else {
    requiresDmAdjudication = use.effect.adjudication
  }
  if (use.resourceCost) {
    const spent = spendDnd5eInventoryResource(
      nextSource,
      entry.instanceId,
      use.resourceCost.resourceId,
      use.resourceCost.amount,
    )
    if (!spent.ok) return failed(characters, 'insufficient-quantity')
    nextSource = spent.character
  }
  if (use.chargesPerItem) nextSource = consumeItemCharge(nextSource, entry)
  else if (use.consumeQuantity > 0) nextSource = removeItem(nextSource, entry, use.consumeQuantity)
  nextSource = recordDnd5eInventoryUseReceipt(nextSource, mutation.receiptId)
  let nextCharacters = replaceAt(characters, sourceIndex, nextSource)
  if (targetIndex !== sourceIndex) nextCharacters = replaceAt(nextCharacters, targetIndex, nextTarget)
  const result = succeeded(nextCharacters, `${source.name} 使用了 ${entry.item.name}。`)
  return {
    ...result,
    healingRolled,
    healingApplied,
    spellSlotLevel,
    spellSlotsRecovered,
    requiresDmAdjudication,
    spentEconomy: use.economy === 'none' ? undefined : use.economy,
  }
}

function gear(
  id: string,
  name: string,
  englishName: string,
  category: Dnd5eInventoryItemTemplate['category'],
  icon: Dnd5eInventoryItemTemplate['icon'],
  weightLb: number,
  amount: number,
  currency: 'cp' | 'sp' | 'gp',
  rulesText: string,
  use?: Dnd5eInventoryItemTemplate['use'],
  equipment?: EquipmentItem,
  spellcastingMaterial?: Dnd5eInventoryItemTemplate['spellcastingMaterial'],
): Dnd5eInventoryItemTemplate {
  const detailedRulesText = rulesText.trim().length >= 24
    ? rulesText
    : `${rulesText} 这是普通非魔法物品，不会自动提供攻击、伤害、AC、豁免或技能检定加值；只有角色实际使用它且场景满足用途时，才作为相应行动的工具、材料或凭据。`
  return {
    id: `srd-5.1:item:${id}`,
    name,
    englishName,
    category,
    icon,
    description: detailedRulesText,
    rulesText: detailedRulesText,
    weightLb,
    cost: { amount, currency },
    stackable: equipment ? false : category !== 'container',
    containerCapacityWeightLb: CONTAINER_CAPACITY_WEIGHT_LB[id],
    ammunitionKind: AMMUNITION_KIND_BY_ITEM_ID[id],
    use,
    equipment,
    spellcastingMaterial,
    source: SRD_SOURCE,
  }
}

function handheldFocus(id: string, name: string): EquipmentItem {
  const classIds = id === 'arcane-focus'
    ? ['wizard', 'sorcerer', 'warlock']
    : id === 'druidic-focus'
      ? ['druid']
      : ['bard']
  return {
    id: `dnd5e-${id}`,
    name,
    slot: 'mainWeapon',
    allowedSlots: ['mainWeapon', 'offHand'],
    spellcastingFocusClassIds: classIds,
  }
}

function damageTypeLabel(type: string): string {
  if (type === 'slashing') return '挥砍'
  if (type === 'piercing') return '穿刺'
  return '钝击'
}

function fallbackEquipmentTemplate(equipment: EquipmentItem): Dnd5eInventoryItemTemplate {
  const rulesText = equipmentRulesText(equipment)
  return {
    id: `character-equipment:${equipment.id}`,
    name: equipment.name,
    category: 'equipment',
    icon: equipmentIcon(equipment),
    description: rulesText,
    rulesText,
    stackable: false,
    equipment: { ...equipment },
    source: { book: '角色存档', license: '由提供者声明' },
  }
}

function cloneItemTemplate(item: Dnd5eInventoryItemTemplate): Dnd5eInventoryItemTemplate {
  return {
    ...item,
    cost: item.cost ? { ...item.cost } : undefined,
    spellcastingMaterial: item.spellcastingMaterial ? {
      ...item.spellcastingMaterial,
      tags: [...item.spellcastingMaterial.tags],
    } : undefined,
    equipment: item.equipment ? {
      ...item.equipment,
      allowedSlots: item.equipment.allowedSlots ? [...item.equipment.allowedSlots] : undefined,
      spellcastingFocusClassIds: item.equipment.spellcastingFocusClassIds
        ? [...item.equipment.spellcastingFocusClassIds]
        : undefined,
      effects: item.equipment.effects ? { ...item.equipment.effects } : undefined,
      dnd5e: item.equipment.dnd5e ? structuredClone(item.equipment.dnd5e) : undefined,
    } : undefined,
    magicItem: item.magicItem ? { ...item.magicItem } : undefined,
    resources: item.resources?.map((resource) => ({ ...resource })),
    headlessEffects: item.headlessEffects?.map((effect) => ({ ...effect })),
    use: item.use ? {
      ...item.use,
      effect: item.use.effect.kind === 'healing'
        ? { ...item.use.effect, dice: { ...item.use.effect.dice } }
        : { ...item.use.effect },
    } : undefined,
    source: { ...item.source },
  }
}

function withNormalizedInventory(character: Character): Character {
  return { ...character, dnd5eInventory: normalizeDnd5eInventory(character) }
}

function addItem(
  character: Character,
  item: Dnd5eInventoryItemTemplate,
  quantity: number,
  options: { identified?: boolean; expiresAtWorldMinute?: number; generatedByRulesId?: string } = {},
): Character {
  const inventory = normalizeDnd5eInventory(character)
  const entries = [...inventory.entries]
  if (item.stackable) {
    const identified = item.magicItem ? options.identified !== false : true
    const existingIndex = entries.findIndex((entry) =>
      entry.templateId === item.id && !entry.equippedSlot && !entry.containerInstanceId &&
      (entry.identified !== false) === identified &&
      entry.expiresAtWorldMinute === options.expiresAtWorldMinute &&
      entry.generatedByRulesId === options.generatedByRulesId)
    if (existingIndex >= 0) {
      const existing = entries[existingIndex]
      entries[existingIndex] = {
        ...existing,
        quantity: existing.quantity + quantity,
        resources: addInventoryResourceCapacity(existing.resources, inventoryResourceDefinitions(item), quantity),
      }
    } else {
      entries.push(newEntry(item, quantity, identified, options))
    }
  } else {
    for (let index = 0; index < quantity; index += 1) {
      entries.push(newEntry(item, 1, item.magicItem ? options.identified !== false : true, options))
    }
  }
  return { ...character, dnd5eInventory: inventoryWithEntries(inventory, entries) }
}

function removeItem(character: Character, entry: Dnd5eInventoryEntry, quantity: number): Character {
  const next = entry.equippedSlot ? unequipEntry(character, entry) : character
  const inventory = normalizeDnd5eInventory(next)
  const entries = inventory.entries.flatMap((candidate) => {
    if (candidate.instanceId !== entry.instanceId) {
      return candidate.containerInstanceId === entry.instanceId && entry.quantity <= quantity
        ? [{ ...candidate, containerInstanceId: undefined }]
        : [candidate]
    }
    if (candidate.quantity <= quantity) return []
    const nextQuantity = candidate.quantity - quantity
    return [{
      ...candidate,
      quantity: nextQuantity,
      resources: resizeInventoryResources(candidate.resources, inventoryResourceDefinitions(candidate.item), nextQuantity),
    }]
  })
  return { ...next, dnd5eInventory: inventoryWithEntries(inventory, entries) }
}

export type Dnd5eAttunementRequirementDecision = 'met' | 'unmet' | 'dm-confirmation-required'

export function dnd5eAttunementRequirementDecision(
  character: Character,
  entry: Dnd5eInventoryEntry,
): Dnd5eAttunementRequirementDecision {
  const requirement = entry.item.magicItem?.attunementRequirement
  if (!requirement || dnd5eIgnoresMagicItemRequirements(character)) return 'met'
  if (requirement.includes('仅限矮人')) return character.race.includes('矮人') ? 'met' : 'unmet'
  if (requirement.includes('善良阵营')) return character.alignment?.includes('善良') === true ? 'met' : 'unmet'
  if (requirement.includes('邪恶阵营')) return character.alignment?.includes('邪恶') === true ? 'met' : 'unmet'
  const levels = normalizeDnd5eClassLevels(character)
  if (requirement.includes('仅限施法者')) {
    return Object.entries(levels).some(([classId, level]) => {
      const definition = dnd5eClassDefinition(classId)
      if (!definition?.spellcasting) return false
      return !['half-known', 'half-prepared'].includes(definition.spellcasting.kind) || (level ?? 0) >= 2
    }) ? 'met' : 'unmet'
  }
  const requiredClassIds = DND5E_SRD_CLASS_DEFINITIONS
    .filter((definition) => requirement.includes(definition.name))
    .map((definition) => definition.id)
  if (requiredClassIds.length > 0) {
    return requiredClassIds.some((classId) => dnd5eCharacterClassLevel(character, classId) > 0) ? 'met' : 'unmet'
  }
  return 'dm-confirmation-required'
}

function dnd5eAttunementRequirementMet(
  character: Character,
  entry: Dnd5eInventoryEntry,
  dmPrerequisiteConfirmed: boolean,
): boolean {
  const decision = dnd5eAttunementRequirementDecision(character, entry)
  return decision === 'met' || (decision === 'dm-confirmation-required' && dmPrerequisiteConfirmed)
}

function defaultEquipmentDestination(character: Character, item: EquipmentItem): EquipmentSlot {
  const allowedSlots = item.allowedSlots ?? []
  if (allowedSlots.length > 0) {
    const preferred = [item.slot, ...allowedSlots.filter((slot) => slot !== item.slot)]
    return preferred.find((slot) => !character.equipment?.[slot]) ?? item.slot
  }
  if (item.slot !== 'ring') return item.slot
  if (!character.equipment?.ring) return 'ring'
  if (!character.equipment?.ring2) return 'ring2'
  return 'ring'
}

function equipEntry(character: Character, entry: Dnd5eInventoryEntry, slot: EquipmentSlot): Character {
  const equipment = entry.item.equipment!
  const inventory = normalizeDnd5eInventory(character)
  const previousSlot = inventory.entries.find((candidate) =>
    candidate.instanceId === entry.instanceId,
  )?.equippedSlot
  const entries = inventory.entries.map((candidate) => ({
    ...candidate,
    equippedSlot: candidate.instanceId === entry.instanceId
      ? slot
      : candidate.equippedSlot === slot
        ? undefined
        : candidate.equippedSlot,
  }))
  const projectedEquipment: CharacterEquipment = { ...(character.equipment ?? {}) }
  if (
    previousSlot && previousSlot !== slot &&
    projectedEquipment[previousSlot]?.id === equipment.id
  ) delete projectedEquipment[previousSlot]
  projectedEquipment[slot] = { ...equipment }
  let nextCharacter: Character = {
    ...character,
    equipment: projectedEquipment,
    dnd5eInventory: inventoryWithEntries(inventory, entries),
  }
  // Shillelagh is bound to the physical club or quarterstaff held when the
  // spell is cast. Moving that item out of the main hand, or replacing it
  // with another inventory instance (even one with the same equipment id),
  // ends the spell immediately.
  if (
    (previousSlot === 'mainWeapon' && slot !== 'mainWeapon') ||
    (slot === 'mainWeapon' && previousSlot !== 'mainWeapon')
  ) {
    nextCharacter = withoutDnd5eShillelaghEffect(nextCharacter)
  }
  if (equipment.dnd5e?.kind !== 'armor' || !character.dnd5eCombatState?.activeEffects) {
    return nextCharacter
  }
  const effectsWithoutMageArmor = character.dnd5eCombatState.activeEffects.filter((effect) =>
    effect.definitionId !== 'srd-5.1:spell:mage-armor',
  )
  if (effectsWithoutMageArmor.length === character.dnd5eCombatState.activeEffects.length) {
    return nextCharacter
  }
  const projected = projectDnd5eActiveEffectState(effectsWithoutMageArmor)
  return {
    ...nextCharacter,
    dnd5eCombatState: {
      ...character.dnd5eCombatState,
      activeEffects: projected.activeEffects,
    },
  }
}

function unequipEntry(character: Character, entry: Dnd5eInventoryEntry): Character {
  const slot = entry.equippedSlot
  if (!slot) return character
  const inventory = normalizeDnd5eInventory(character)
  const entries = inventory.entries.map((candidate) => candidate.instanceId === entry.instanceId
    ? { ...candidate, equippedSlot: undefined }
    : candidate)
  const equipment: CharacterEquipment = { ...(character.equipment ?? {}) }
  if (equipment[slot]?.id === entry.item.equipment?.id) delete equipment[slot]
  const nextCharacter = { ...character, equipment, dnd5eInventory: inventoryWithEntries(inventory, entries) }
  return slot === 'mainWeapon' ? withoutDnd5eShillelaghEffect(nextCharacter) : nextCharacter
}

function withoutDnd5eShillelaghEffect(character: Character): Character {
  const effects = character.dnd5eCombatState?.activeEffects
  if (!effects?.some((effect) =>
    effect.definitionId === 'srd-5.1:spell:shillelagh' &&
    effect.source.rulesId === 'shillelagh'
  )) return character
  const projected = projectDnd5eActiveEffectState(effects.filter((effect) => !(
    effect.definitionId === 'srd-5.1:spell:shillelagh' &&
    effect.source.rulesId === 'shillelagh'
  )))
  return {
    ...character,
    conditions: projected.conditions,
    dnd5eCombatState: {
      ...character.dnd5eCombatState,
      activeEffects: projected.activeEffects,
    },
  }
}

const DND5E_WARDING_BOND_DEFINITION_ID = 'srd-5.1:spell:warding-bond'
const DND5E_CONTINGENCY_EFFECT_TAG = 'contingency'

function dnd5eCharacterCarriesContingencyStatuette(character: Character): boolean {
  return normalizeDnd5eInventory(character).entries.some((entry) =>
    entry.quantity > 0 &&
    entry.identified !== false &&
    entry.planarState !== 'ethereal' &&
    entry.item.spellcastingMaterial?.tags.includes('contingency-statuette') === true &&
    (entry.item.spellcastingMaterial.unitValueGp ?? 0) >= 1_500,
  )
}

function reconcileDnd5eContingencyInventory(characters: readonly Character[]): Character[] {
  return characters.map((character) => {
    const effects = character.dnd5eCombatState?.activeEffects
    if (
      !effects?.some((effect) => effect.tags?.includes(DND5E_CONTINGENCY_EFFECT_TAG)) ||
      dnd5eCharacterCarriesContingencyStatuette(character)
    ) return character
    const projected = projectDnd5eActiveEffectState(effects.filter((effect) =>
      !effect.tags?.includes(DND5E_CONTINGENCY_EFFECT_TAG)))
    return {
      ...character,
      dnd5eCombatState: {
        ...character.dnd5eCombatState,
        activeEffects: projected.activeEffects,
        conditions: projected.conditions,
      },
    }
  })
}

function dnd5eCharacterWearsWardingBondRing(character: Character): boolean {
  return normalizeDnd5eInventory(character).entries.some((entry) =>
    entry.quantity > 0 &&
    entry.identified !== false &&
    entry.equippedSlot != null &&
    entry.item.spellcastingMaterial?.tags.includes('platinum-ring') === true &&
    (entry.item.spellcastingMaterial.unitValueGp ?? 0) >= 50,
  )
}

function reconcileDnd5eWardingBondInventory(characters: readonly Character[]): Character[] {
  if (!characters.some((character) => character.dnd5eCombatState?.activeEffects?.some((effect) =>
    effect.definitionId === DND5E_WARDING_BOND_DEFINITION_ID,
  ))) return [...characters]

  const characterById = new Map(characters.map((character) => [character.id, character]))
  return characters.map((character) => {
    const effects = character.dnd5eCombatState?.activeEffects
    if (!effects?.some((effect) => effect.definitionId === DND5E_WARDING_BOND_DEFINITION_ID)) {
      return character
    }
    const targetWearsRing = dnd5eCharacterWearsWardingBondRing(character)
    const retained = effects.filter((effect) => {
      if (effect.definitionId !== DND5E_WARDING_BOND_DEFINITION_ID) return true
      if (!targetWearsRing) return false
      const source = (effect.source.characterId && characterById.get(effect.source.characterId)) ||
        (effect.source.actorId && characterById.get(effect.source.actorId)) ||
        characters.find((candidate) => candidate.name === effect.source.actorName)
      return source == null || dnd5eCharacterWearsWardingBondRing(source)
    })
    if (retained.length === effects.length) return character
    const projected = projectDnd5eActiveEffectState(retained)
    return {
      ...character,
      dnd5eCombatState: {
        ...character.dnd5eCombatState,
        activeEffects: projected.activeEffects,
      },
    }
  })
}

function newEntry(
  item: Dnd5eInventoryItemTemplate,
  quantity: number,
  identified = true,
  options: { expiresAtWorldMinute?: number; generatedByRulesId?: string } = {},
): Dnd5eInventoryEntry {
  return {
    instanceId: inventoryId(),
    templateId: item.id,
    item: cloneItemTemplate(item),
    quantity,
    resources: createInventoryResources(item, quantity),
    identified,
    acquiredAt: Date.now(),
    expiresAtWorldMinute: options.expiresAtWorldMinute,
    generatedByRulesId: options.generatedByRulesId,
  }
}

/** Removes Host-generated inventory entries at their exact campaign-clock boundary. */
export function expireDnd5eInventoryItemsAtWorldMinute(
  character: Character,
  worldMinute: number,
): Character {
  if (!Number.isSafeInteger(worldMinute) || worldMinute < 0) return character
  const inventory = normalizeDnd5eInventory(character)
  const entries = inventory.entries.filter((entry) =>
    entry.expiresAtWorldMinute == null || entry.expiresAtWorldMinute > worldMinute)
  if (entries.length === inventory.entries.length) return character
  const liveIds = new Set(entries.map((entry) => entry.instanceId))
  return {
    ...character,
    dnd5eInventory: inventoryWithEntries(inventory, entries.map((entry) =>
      entry.containerInstanceId && !liveIds.has(entry.containerInstanceId)
        ? { ...entry, containerInstanceId: undefined }
        : entry)),
  }
}

function consumeItemCharge(character: Character, entry: Dnd5eInventoryEntry): Character {
  const result = spendDnd5eInventoryResource(character, entry.instanceId, 'uses', 1)
  return result.ok ? result.character : character
}

function inventoryResourceDefinitions(item: Dnd5eInventoryItemTemplate): Dnd5eInventoryResourceDefinition[] {
  const definitions = (item.resources ?? []).map((resource) => ({ ...resource }))
  if (item.use?.chargesPerItem && !definitions.some((resource) => resource.id === 'uses')) {
    definitions.push({ id: 'uses', label: '使用次数', maximum: item.use.chargesPerItem, initial: item.use.chargesPerItem, resetOn: 'none' })
  }
  const actionCharges = item.useActions?.find((action) => action.chargesPerItem)?.chargesPerItem
  if (actionCharges && !definitions.some((resource) => resource.id === 'uses')) {
    definitions.push({ id: 'uses', label: '使用次数', maximum: actionCharges, initial: actionCharges, resetOn: 'none' })
  }
  return definitions
}

function createInventoryResources(item: Dnd5eInventoryItemTemplate, quantity: number): Record<string, Dnd5eInventoryResourceState> | undefined {
  const definitions = inventoryResourceDefinitions(item)
  if (definitions.length === 0) return undefined
  return Object.fromEntries(definitions.map((definition) => {
    const maximum = Math.max(0, Math.floor(definition.maximum)) * quantity
    const initialPerItem = definition.initial == null ? definition.maximum : definition.initial
    return [definition.id, {
      id: definition.id,
      label: definition.label,
      current: Math.min(maximum, Math.max(0, Math.floor(initialPerItem)) * quantity),
      maximum,
      resetOn: definition.resetOn,
      ...(definition.recovery ? { recovery: structuredClone(definition.recovery) } : {}),
      ...(definition.lastChargeDestruction ? { lastChargeDestruction: { ...definition.lastChargeDestruction } } : {}),
    }]
  }))
}

function normalizeInventoryResources(
  item: Dnd5eInventoryItemTemplate,
  quantity: number,
  stored: Record<string, Dnd5eInventoryResourceState> | undefined,
  legacyRemainingCharges: number | undefined,
): Record<string, Dnd5eInventoryResourceState> | undefined {
  const created = createInventoryResources(item, quantity)
  if (!created) return undefined
  return Object.fromEntries(Object.entries(created).map(([id, fallback]) => {
    const candidate = stored?.[id]
    const legacy = id === 'uses' ? Number(legacyRemainingCharges) : Number.NaN
    const current = Number.isFinite(Number(candidate?.current))
      ? Number(candidate?.current)
      : Number.isFinite(legacy) ? legacy : fallback.current
    return [id, { ...fallback, current: Math.min(fallback.maximum, Math.max(0, Math.floor(current))) }]
  }))
}

function addInventoryResourceCapacity(
  current: Record<string, Dnd5eInventoryResourceState> | undefined,
  definitions: readonly Dnd5eInventoryResourceDefinition[],
  addedQuantity: number,
): Record<string, Dnd5eInventoryResourceState> | undefined {
  if (definitions.length === 0) return current
  return Object.fromEntries(definitions.map((definition) => {
    const existing = current?.[definition.id]
    const maximumAdded = Math.max(0, Math.floor(definition.maximum)) * addedQuantity
    const initialAdded = Math.min(maximumAdded, Math.max(0, Math.floor(definition.initial ?? definition.maximum)) * addedQuantity)
    return [definition.id, {
      id: definition.id,
      label: definition.label,
      current: (existing?.current ?? 0) + initialAdded,
      maximum: (existing?.maximum ?? 0) + maximumAdded,
      resetOn: definition.resetOn,
      ...(definition.recovery ? { recovery: structuredClone(definition.recovery) } : {}),
      ...(definition.lastChargeDestruction ? { lastChargeDestruction: { ...definition.lastChargeDestruction } } : {}),
    }]
  }))
}

function resizeInventoryResources(
  current: Record<string, Dnd5eInventoryResourceState> | undefined,
  definitions: readonly Dnd5eInventoryResourceDefinition[],
  quantity: number,
): Record<string, Dnd5eInventoryResourceState> | undefined {
  if (!current || definitions.length === 0) return current
  return Object.fromEntries(definitions.map((definition) => {
    const existing = current[definition.id]
    const maximum = Math.max(0, Math.floor(definition.maximum)) * quantity
    return [definition.id, {
      id: definition.id,
      label: definition.label,
      current: Math.min(maximum, Math.max(0, existing?.current ?? 0)),
      maximum,
      resetOn: definition.resetOn,
      ...(definition.recovery ? { recovery: structuredClone(definition.recovery) } : {}),
      ...(definition.lastChargeDestruction ? { lastChargeDestruction: { ...definition.lastChargeDestruction } } : {}),
    }]
  }))
}

function inventoryId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function secureDie(sides: number): number {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1)
    globalThis.crypto.getRandomValues(value)
    return value[0] % sides + 1
  }
  return Math.floor(Math.random() * sides) + 1
}

function validQuantity(quantity: number): number | null {
  const next = Math.floor(Number(quantity))
  return Number.isInteger(next) && next > 0 ? next : null
}

function normalizeCurrency(value: Partial<Dnd5eCurrencyWallet> | undefined): Dnd5eCurrencyWallet {
  return Object.fromEntries(Object.keys(EMPTY_CURRENCY).map((currency) => {
    const amount = Number(value?.[currency as keyof Dnd5eCurrencyWallet])
    return [currency, Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0]
  })) as unknown as Dnd5eCurrencyWallet
}

function inventoryWithEntries(inventory: Dnd5eInventory, entries: Dnd5eInventoryEntry[]): Dnd5eInventory {
  return {
    schemaVersion: DND5E_INVENTORY_SCHEMA_VERSION,
    revision: (inventory.revision ?? 0) + 1,
    entries,
    currency: normalizeCurrency(inventory.currency),
    authorityGrantReceipts: [...(inventory.authorityGrantReceipts ?? [])],
    authorityUseReceipts: [...(inventory.authorityUseReceipts ?? [])],
  }
}

function validAuthorityReceiptId(receiptId: string): boolean {
  return receiptId.length > 0 && receiptId.length <= 300
}

function recordDnd5eInventoryUseReceipt(
  character: Character,
  receiptId: string | undefined,
): Character {
  if (!receiptId) return character
  const inventory = normalizeDnd5eInventory(character)
  if (inventory.authorityUseReceipts?.includes(receiptId)) return character
  return {
    ...character,
    dnd5eInventory: {
      ...inventory,
      revision: (inventory.revision ?? 0) + 1,
      authorityUseReceipts: [...(inventory.authorityUseReceipts ?? []), receiptId].slice(-512),
    },
  }
}

function normalizeContainerLinks(entries: Dnd5eInventoryEntry[]): void {
  const byId = new Map(entries.map((entry) => [entry.instanceId, entry]))
  for (const entry of entries) {
    const container = entry.containerInstanceId ? byId.get(entry.containerInstanceId) : undefined
    if (!container || container.item.containerCapacityWeightLb == null || container.instanceId === entry.instanceId) {
      entry.containerInstanceId = undefined
      continue
    }
    const visited = new Set([entry.instanceId])
    let cursor: Dnd5eInventoryEntry | undefined = container
    while (cursor) {
      if (visited.has(cursor.instanceId)) {
        entry.containerInstanceId = undefined
        break
      }
      visited.add(cursor.instanceId)
      cursor = cursor.containerInstanceId ? byId.get(cursor.containerInstanceId) : undefined
    }
  }
}

function containerIsDescendant(entries: readonly Dnd5eInventoryEntry[], possibleDescendantId: string, ancestorId: string): boolean {
  const byId = new Map(entries.map((entry) => [entry.instanceId, entry]))
  let cursor = byId.get(possibleDescendantId)
  const visited = new Set<string>()
  while (cursor?.containerInstanceId && !visited.has(cursor.instanceId)) {
    if (cursor.containerInstanceId === ancestorId) return true
    visited.add(cursor.instanceId)
    cursor = byId.get(cursor.containerInstanceId)
  }
  return false
}

function directContainerContentsWeight(entries: readonly Dnd5eInventoryEntry[], containerId: string): number {
  return entries
    .filter((entry) => entry.containerInstanceId === containerId)
    .reduce((sum, entry) => sum + entryTreeWeight(entries, entry.instanceId, new Set()), 0)
}

function entryTreeWeight(entries: readonly Dnd5eInventoryEntry[], instanceId: string, visited: Set<string>): number {
  if (visited.has(instanceId)) return 0
  visited.add(instanceId)
  const entry = entries.find((candidate) => candidate.instanceId === instanceId)
  if (!entry) return 0
  return entryWeight(entry) + entries
    .filter((candidate) => candidate.containerInstanceId === instanceId)
    .reduce((sum, child) => sum + entryTreeWeight(entries, child.instanceId, visited), 0)
}

function entryWeight(entry: Dnd5eInventoryEntry): number {
  return Math.max(0, Number(entry.item.weightLb) || 0) * Math.max(1, entry.quantity)
}

function isCurrency(value: string): value is keyof Dnd5eCurrencyWallet {
  return Object.prototype.hasOwnProperty.call(EMPTY_CURRENCY, value)
}

function currencyLabel(currency: keyof Dnd5eCurrencyWallet): string {
  return ({ cp: '铜币', sp: '银币', ep: '银金币', gp: '金币', pp: '铂金币' } as const)[currency]
}

function replaceAt(characters: readonly Character[], index: number, character: Character): Character[] {
  return characters.map((candidate, candidateIndex) => candidateIndex === index ? character : candidate)
}

function failed(characters: readonly Character[], reason: NonNullable<Dnd5eInventoryMutationResult['reason']>): Dnd5eInventoryMutationResult {
  return { ok: false, reason, characters: [...characters] }
}

function succeeded(characters: readonly Character[], message: string): Dnd5eInventoryMutationResult {
  return { ok: true, characters: [...characters], message }
}
