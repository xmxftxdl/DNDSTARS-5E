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
import { dnd5eActiveCarryingCapacityMultiplier } from './activeEffects'
import {
  appendRollLedgerEntry,
  commitCombatTransaction,
  rollbackCombatTransaction,
  type CombatTransaction,
} from '../../lib/combatTransaction'
import { DND5E_SRD_EQUIPMENT_CATALOG } from './equipment'
import { DND5E_SRD_MAGIC_ITEM_TEMPLATES } from './magicItems'
import { dnd5ePluginItemDefinition, registeredDnd5ePluginItems } from './pluginApi'
import { DND5E_SRD_CLASS_DEFINITIONS, dnd5eClassDefinition, dnd5eIgnoresMagicItemRequirements } from './classes'
import { dnd5eCharacterClassLevel, normalizeDnd5eClassLevels } from './multiclass'
import { projectDnd5eActiveEffectState } from './activeEffects'
import { dnd5eTotemWarriorCarryingCapacityMultiplier } from './totemWarrior'

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
  if (!rules) return `该装备不替换基础武器或护甲公式。${equipmentEffectsText(item) || '具体规则由当前规则包或 DM 裁定。'}`
  if (item.id === 'dnd5e-net') return '射程 5/15 尺；命中大型或更小生物时使其受束缚。挣脱、破坏捕网以及每次只能进行一次捕网攻击由 Headless/DM 按 SRD 5.1 裁定。'
  if (rules.kind === 'shield') return `盾牌。持用时护甲等级 +${rules.armorClassBonus}。同一时间只能从一面盾牌获得该加值。${equipmentEffectsText(item)}`
  if (rules.kind === 'armor') {
    const category = rules.category === 'light' ? '轻甲' : rules.category === 'medium' ? '中甲' : '重甲'
    const dexterity = rules.dexterityBonus === 'full'
      ? '加上完整敏捷调整值'
      : rules.dexterityBonus === 'max-2'
        ? '加上至多 +2 的敏捷调整值'
        : '不加敏捷调整值'
    return `${category}。护甲等级 ${rules.baseArmorClass}，${dexterity}${rules.strengthRequirement ? `；力量需求 ${rules.strengthRequirement}` : ''}${rules.stealthDisadvantage ? '；进行隐匿检定时具有劣势' : ''}。${equipmentEffectsText(item)}`
  }
  const category = rules.category === 'simple' ? '简易武器' : '军用武器'
  const range = rules.mode === 'ranged' && rules.rangeFeet
    ? `，射程 ${rules.rangeFeet.normal}/${rules.rangeFeet.long} 尺`
    : `，触及 ${rules.reachFeet ?? 5} 尺`
  const properties = rules.properties?.length ? `；属性：${rules.properties.join('、')}` : ''
  return `${category}。命中造成 ${rules.damage.count}d${rules.damage.sides} ${damageTypeLabel(rules.damage.type)}伤害${range}${properties}。${equipmentEffectsText(item)}`
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

export const DND5E_SRD_EQUIPMENT_ITEM_TEMPLATES: readonly Dnd5eInventoryItemTemplate[] =
  DND5E_SRD_EQUIPMENT_CATALOG.map((equipment) => {
    const detail = EQUIPMENT_DETAILS[equipment.id]
    return {
      id: `srd-5.1:equipment:${equipment.id}`,
      name: equipment.name,
      englishName: detail?.englishName,
      category: 'equipment',
      icon: equipmentIcon(equipment),
      description: equipment.dnd5e?.kind === 'weapon'
        ? '可装备的 SRD 5.1 武器。'
        : equipment.dnd5e?.kind === 'shield'
          ? '持用后提高护甲等级的防具。'
          : '决定基础护甲等级的防具。',
      rulesText: equipmentRulesText(equipment),
      weightLb: detail?.weightLb,
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
  gear('string-10-feet', '细绳（10 尺）', 'String (10 feet)', 'adventuring-gear', 'generic', 0, 1, 'sp', '十尺长的普通细绳。'),
  gear('bell', '铃铛', 'Bell', 'adventuring-gear', 'generic', 0, 1, 'gp', '可配合细绳制作简易警报。'),
  gear('hooded-lantern', '附盖提灯', 'Lantern, hooded', 'adventuring-gear', 'generic', 2, 5, 'gp', '燃烧油料时提供可调节的光照。'),
  gear('lamp', '油灯', 'Lamp', 'adventuring-gear', 'generic', 1, 5, 'sp', '燃烧油料时提供光照。'),
  gear('oil-flask', '油（瓶）', 'Oil (flask)', 'consumable', 'generic', 1, 1, 'sp', '可作为灯具燃料，泼洒或点燃时由 DM 裁定。'),
  gear('chest', '箱子', 'Chest', 'container', 'generic', 25, 5, 'gp', '可容纳 12 立方尺或 300 磅物品。'),
  gear('map-scroll-case', '地图或卷轴匣', 'Case, map or scroll', 'container', 'generic', 1, 1, 'gp', '用于保护地图和卷轴。'),
  gear('fine-clothes', '优质服装', 'Clothes, fine', 'adventuring-gear', 'generic', 6, 15, 'gp', '适合正式场合的优质服装。'),
  gear('common-clothes', '普通服装', 'Clothes, common', 'adventuring-gear', 'generic', 3, 5, 'sp', '一套普通服装。'),
  gear('ink-bottle', '墨水（1 盎司瓶）', 'Ink (1 ounce bottle)', 'adventuring-gear', 'generic', 0, 10, 'gp', '书写用墨水。'),
  gear('ink-pen', '墨水笔', 'Ink pen', 'adventuring-gear', 'generic', 0, 2, 'cp', '蘸取墨水书写。'),
  gear('paper-sheet', '纸张', 'Paper (one sheet)', 'adventuring-gear', 'generic', 0, 2, 'sp', '一张书写用纸。'),
  gear('parchment-sheet', '羊皮纸', 'Parchment (one sheet)', 'adventuring-gear', 'generic', 0, 1, 'sp', '一张书写用羊皮纸。'),
  gear('perfume-vial', '香水（小瓶）', 'Perfume (vial)', 'adventuring-gear', 'generic', 0, 5, 'gp', '一小瓶香水。'),
  gear('sealing-wax', '封蜡', 'Sealing wax', 'adventuring-gear', 'generic', 0, 5, 'sp', '用于封缄信件。'),
  gear('soap', '肥皂', 'Soap', 'adventuring-gear', 'generic', 0, 2, 'cp', '清洁用品。'),
  gear('costume', '戏服', 'Costume clothes', 'adventuring-gear', 'generic', 4, 5, 'gp', '表演使用的服装。'),
  gear('disguise-kit', '易容工具', 'Disguise kit', 'tool', 'generic', 3, 25, 'gp', '用于改变外貌的化妆品、染料和小道具。'),
  gear('blanket', '毛毯', 'Blanket', 'adventuring-gear', 'generic', 3, 5, 'sp', '旅行休息使用的毛毯。'),
  gear('alms-box', '布施盒', 'Alms box', 'container', 'generic', 0, 0, 'cp', '祭司套组中的布施盒。'),
  gear('incense-block', '熏香块', 'Block of incense', 'adventuring-gear', 'generic', 0, 0, 'cp', '宗教仪式使用的熏香。'),
  gear('censer', '香炉', 'Censer', 'adventuring-gear', 'generic', 0, 0, 'cp', '燃烧熏香的仪式器具。'),
  gear('vestments', '祭服', 'Vestments', 'adventuring-gear', 'generic', 0, 0, 'cp', '宗教仪式使用的服装。'),
  gear('lore-book', '学识书籍', 'Book of lore', 'adventuring-gear', 'generic', 5, 25, 'gp', '有关特定学识的书籍。'),
  gear('sand-bag', '小袋沙', 'Little bag of sand', 'adventuring-gear', 'generic', 0, 0, 'cp', '学者套组中的吸墨沙。'),
  gear('small-knife', '小刀', 'Small knife', 'adventuring-gear', 'generic', 0, 0, 'cp', '学者套组中的小刀；不作为战斗武器。'),
  gear('arrows', '箭', 'Arrows', 'adventuring-gear', 'generic', 0.05, 5, 'cp', '短弓和长弓使用的弹药。'),
  gear('crossbow-bolts', '弩矢', 'Crossbow bolts', 'adventuring-gear', 'generic', 0.075, 5, 'cp', '轻弩等弩类武器使用的弹药。'),
  gear('sling-bullets', '投石索弹丸', 'Sling bullets', 'adventuring-gear', 'generic', 0.075, 4, 'cp', '投石索使用的铅制弹丸。'),
  gear('blowgun-needles', '吹箭针', 'Blowgun needles', 'adventuring-gear', 'generic', 0.02, 2, 'cp', '吹箭筒使用的细针。'),
  gear('component-pouch', '材料包', 'Component pouch', 'container', 'generic', 2, 25, 'gp', '存放施展法术所需、未标明价格且不会被消耗的材料成分。'),
  gear('arcane-focus', '奥术法器', 'Arcane focus', 'adventuring-gear', 'generic', 1, 10, 'gp', '奥术施法职业可用作法术材料成分替代物。'),
  gear('druidic-focus', '德鲁伊法器', 'Druidic focus', 'adventuring-gear', 'generic', 1, 1, 'gp', '德鲁伊可用作法术材料成分替代物。'),
  gear('holy-symbol', '圣徽', 'Holy symbol', 'adventuring-gear', 'generic', 1, 5, 'gp', '牧师和圣武士可用作法术材料成分替代物。'),
  gear('spellbook', '法术书', 'Spellbook', 'adventuring-gear', 'generic', 3, 50, 'gp', '法师记录已知法术的书册。'),
  gear('thieves-tools', '盗贼工具', "Thieves' tools", 'tool', 'generic', 1, 25, 'gp', '开锁与拆除陷阱使用的专用工具。'),
  gear('bagpipes', '风笛', 'Bagpipes', 'tool', 'generic', 6, 30, 'gp', '一种乐器。'),
  gear('drum', '鼓', 'Drum', 'tool', 'generic', 3, 6, 'gp', '一种乐器。'),
  gear('dulcimer', '扬琴', 'Dulcimer', 'tool', 'generic', 10, 25, 'gp', '一种乐器。'),
  gear('lute', '鲁特琴', 'Lute', 'tool', 'generic', 2, 35, 'gp', '吟游诗人常用的乐器。'),
  gear('flute', '长笛', 'Flute', 'tool', 'generic', 1, 2, 'gp', '一种便携乐器。'),
  gear('horn', '号角', 'Horn', 'tool', 'generic', 2, 3, 'gp', '一种乐器。'),
  gear('lyre', '里拉琴', 'Lyre', 'tool', 'generic', 2, 30, 'gp', '一种乐器。'),
  gear('pan-flute', '排箫', 'Pan flute', 'tool', 'generic', 2, 12, 'gp', '一种乐器。'),
  gear('shawm', '肖姆管', 'Shawm', 'tool', 'generic', 1, 2, 'gp', '一种乐器。'),
  gear('viol', '维奥尔琴', 'Viol', 'tool', 'generic', 1, 30, 'gp', '一种乐器。'),
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
  }),
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
    description: '装有红色液体的常见魔法药水。摇晃时液体会闪烁微光。',
    rulesText: '饮用者恢复 2d4 + 2 点生命值。饮用或给另一名生物服用药水需要一个动作。',
    weightLb: 0.5,
    cost: { amount: 50, currency: 'gp' },
    stackable: true,
    use: { economy: 'action', consumeQuantity: 1, effect: { kind: 'healing', dice: { count: 2, sides: 4, bonus: 2 } } },
    magicItem: { kind: 'potion', rarity: 'common', attunement: 'none', automation: 'headless' },
    source: SRD_SOURCE,
  },
] as const

export const DND5E_SRD_ITEM_TEMPLATES: readonly Dnd5eInventoryItemTemplate[] = [
  ...DND5E_SRD_EQUIPMENT_ITEM_TEMPLATES,
  ...DND5E_SRD_GEAR_ITEM_TEMPLATES,
  ...DND5E_SRD_MAGIC_ITEM_TEMPLATES,
]

const ITEM_TEMPLATE_BY_ID = new Map(DND5E_SRD_ITEM_TEMPLATES.map((item) => [item.id, item]))

export function dnd5eInventoryItemTemplate(templateId: string): Dnd5eInventoryItemTemplate | undefined {
  return ITEM_TEMPLATE_BY_ID.get(templateId) ?? dnd5ePluginItemDefinition(templateId)
}

export function dnd5eInventoryItemTemplateForEquipment(equipmentId: string): Dnd5eInventoryItemTemplate | undefined {
  return DND5E_SRD_EQUIPMENT_ITEM_TEMPLATES.find((item) => item.equipment?.id === equipmentId) ??
    registeredDnd5ePluginItems().find((item) => item.equipment?.id === equipmentId)
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
    entries,
    currency: { ...EMPTY_CURRENCY },
    authorityGrantReceipts: [],
  }
}

export function normalizeDnd5eInventory(character: Character): Dnd5eInventory {
  const raw = character.dnd5eInventory
  const currency = normalizeCurrency(raw?.currency)
  const authorityGrantReceipts = [...new Set((raw?.authorityGrantReceipts ?? [])
    .filter((receipt): receipt is string =>
      typeof receipt === 'string' && receipt.length > 0 && receipt.length <= 300,
    ))].slice(-512)
  const entries: Dnd5eInventoryEntry[] = (raw?.entries ?? [])
    .filter((entry) => entry && typeof entry.instanceId === 'string' && typeof entry.templateId === 'string')
    .map((entry) => {
      const item = cloneItemTemplate(dnd5eInventoryItemTemplate(entry.templateId) ?? entry.item)
      const quantity = Math.max(1, Math.floor(Number(entry.quantity) || 1))
      const resources = normalizeInventoryResources(item, quantity, entry.resources, entry.remainingCharges)
      return {
        ...entry,
        item,
        quantity,
        resources,
        identified: item.magicItem ? (raw?.schemaVersion === 3 ? entry.identified !== false : true) : true,
        remainingCharges: undefined,
        acquiredAt: Number.isFinite(entry.acquiredAt) ? entry.acquiredAt : 0,
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
    entries,
    currency,
    authorityGrantReceipts,
  }
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
  ) * dnd5eTotemWarriorCarryingCapacityMultiplier(character)
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

/** 权威事务使用的实例资源扣除函数。资源归零后仍保留物品实例。 */
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

/** 恢复明确绑定到短休／长休的实例资源；黎明资源由未来的战役日历事务处理。 */
export function restoreDnd5eInventoryResources(
  character: Character,
  rest: 'short-rest' | 'long-rest' | 'dawn',
): Character {
  const inventory = normalizeDnd5eInventory(character)
  let changed = false
  const entries = inventory.entries.map((entry) => {
    if (!entry.resources) return entry
    let entryChanged = false
    const resources = Object.fromEntries(Object.entries(entry.resources).map(([id, resource]) => {
      const resets = resource.resetOn === rest || (rest === 'long-rest' && resource.resetOn === 'short-rest')
      if (!resets || resource.current === resource.maximum) return [id, resource]
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

export function rollDnd5eInventoryHealing(item: Dnd5eInventoryItemTemplate): number[] {
  if (item.use?.effect.kind !== 'healing') return []
  const { count, sides } = item.use.effect.dice
  return Array.from({ length: count }, () => secureDie(sides))
}

export function applyDnd5eInventoryMutation(
  characters: readonly Character[],
  mutation: Dnd5eInventoryMutation,
  options: { turnEconomy?: Dnd5eTurnEconomyCounts; transaction?: CombatTransaction } = {},
): Dnd5eInventoryMutationResult & { transaction?: CombatTransaction } {
  const result = applyDnd5eInventoryMutationInternal(characters, mutation, { turnEconomy: options.turnEconomy })
  let transaction = options.transaction
  if (!transaction) return result

  if (mutation.type === 'use' && mutation.healingRolls?.length) {
    const character = characters.find((candidate) => candidate.id === mutation.characterId)
    const entry = character?.dnd5eInventory?.entries.find((candidate) => candidate.instanceId === mutation.instanceId)
    const dice = entry?.item.use?.effect.kind === 'healing' ? entry.item.use.effect.dice : undefined
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

function applyDnd5eInventoryMutationInternal(
  characters: readonly Character[],
  mutation: Dnd5eInventoryMutation,
  options: { turnEconomy?: Dnd5eTurnEconomyCounts } = {},
): Dnd5eInventoryMutationResult {
  const sourceIndex = characters.findIndex((character) => character.id === mutation.characterId)
  if (sourceIndex < 0) return failed(characters, 'character-not-found')
  const source = withNormalizedInventory(characters[sourceIndex])

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
    const next = { ...source, dnd5eInventory: { ...inventory, currency } }
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
    const nextSource = removeItem(source, entry, quantity)
    const nextTarget = addItem(target, entry.item, quantity, { identified: entry.identified !== false })
    const afterSource = replaceAt(characters, sourceIndex, nextSource)
    return succeeded(replaceAt(afterSource, targetIndex, nextTarget), `${source.name} 将 ${entry.item.name} ×${quantity} 转交给 ${target.name}。`)
  }

  if (mutation.type === 'equip') {
    if (!entry.item.equipment) return failed(characters, 'not-equipment')
    if (entry.item.magicItem && entry.identified === false) return failed(characters, 'item-unidentified')
    const next = equipEntry(source, entry)
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
    if (!entry.item.magicItem) return failed(characters, 'not-magic-item')
    if (entry.identified !== false) return succeeded(characters, `${entry.item.name} 已经完成鉴定。`)
    const inventory = normalizeDnd5eInventory(source)
    const entries = inventory.entries.map((candidate) => candidate.instanceId === entry.instanceId
      ? { ...candidate, identified: true }
      : candidate)
    return succeeded(replaceAt(characters, sourceIndex, {
      ...source,
      dnd5eInventory: inventoryWithEntries(inventory, entries),
    }), `${source.name} 鉴定了 ${entry.item.name}。`)
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

  const use = entry.item.use
  if (entry.item.magicItem && entry.identified === false) return failed(characters, 'item-unidentified')
  if (!use) return failed(characters, 'not-usable')
  if (entry.quantity < use.consumeQuantity || (use.chargesPerItem && (entry.resources?.uses?.current ?? 0) < 1)) {
    return failed(characters, 'insufficient-quantity')
  }
  if (options.turnEconomy && use.economy === 'action' && options.turnEconomy.action.current < 1) {
    return failed(characters, 'action-unavailable')
  }
  if (options.turnEconomy && use.economy === 'bonusAction' && options.turnEconomy.bonusAction.current < 1) {
    return failed(characters, 'bonus-action-unavailable')
  }

  let next = source
  let healingRolled: number | undefined
  let healingApplied: number | undefined
  let requiresDmAdjudication: string | undefined
  if (use.effect.kind === 'healing') {
    const rolls = mutation.healingRolls
    const { count, sides, bonus } = use.effect.dice
    if (!rolls || rolls.length !== count || rolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > sides)) {
      return failed(characters, 'invalid-rolls')
    }
    healingRolled = rolls.reduce((sum, roll) => sum + roll, bonus)
    healingApplied = Math.min(healingRolled, Math.max(0, source.maxHp - source.currentHp))
    next = {
      ...next,
      currentHp: Math.min(next.maxHp, next.currentHp + healingRolled),
      dnd5eCombatState: healingApplied > 0 && (next.dnd5eCombatState?.caltropsSpeedPenaltyFeet ?? 0) > 0
        ? { ...next.dnd5eCombatState, caltropsSpeedPenaltyFeet: undefined }
        : next.dnd5eCombatState,
    }
  } else {
    requiresDmAdjudication = use.effect.adjudication
  }
  if (use.chargesPerItem) next = consumeItemCharge(next, entry)
  else if (use.consumeQuantity > 0) next = removeItem(next, entry, use.consumeQuantity)
  const result = succeeded(replaceAt(characters, sourceIndex, next), `${source.name} 使用了 ${entry.item.name}。`)
  return {
    ...result,
    healingRolled,
    healingApplied,
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
): Dnd5eInventoryItemTemplate {
  return {
    id: `srd-5.1:item:${id}`,
    name,
    englishName,
    category,
    icon,
    description: 'SRD 5.1 冒险装备。',
    rulesText,
    weightLb,
    cost: { amount, currency },
    stackable: category !== 'container',
    containerCapacityWeightLb: CONTAINER_CAPACITY_WEIGHT_LB[id],
    ammunitionKind: AMMUNITION_KIND_BY_ITEM_ID[id],
    use,
    source: SRD_SOURCE,
  }
}

function damageTypeLabel(type: string): string {
  if (type === 'slashing') return '挥砍'
  if (type === 'piercing') return '穿刺'
  return '钝击'
}

function fallbackEquipmentTemplate(equipment: EquipmentItem): Dnd5eInventoryItemTemplate {
  return {
    id: `character-equipment:${equipment.id}`,
    name: equipment.name,
    category: 'equipment',
    icon: equipmentIcon(equipment),
    description: '由角色存档或扩展规则提供的装备。',
    rulesText: equipmentRulesText(equipment),
    stackable: false,
    equipment: { ...equipment },
    source: { book: '角色存档', license: '由提供者声明' },
  }
}

function cloneItemTemplate(item: Dnd5eInventoryItemTemplate): Dnd5eInventoryItemTemplate {
  return {
    ...item,
    cost: item.cost ? { ...item.cost } : undefined,
    equipment: item.equipment ? {
      ...item.equipment,
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
  options: { identified?: boolean } = {},
): Character {
  const inventory = normalizeDnd5eInventory(character)
  const entries = [...inventory.entries]
  if (item.stackable) {
    const identified = item.magicItem ? options.identified !== false : true
    const existingIndex = entries.findIndex((entry) => entry.templateId === item.id && !entry.equippedSlot && !entry.containerInstanceId && (entry.identified !== false) === identified)
    if (existingIndex >= 0) {
      const existing = entries[existingIndex]
      entries[existingIndex] = {
        ...existing,
        quantity: existing.quantity + quantity,
        resources: addInventoryResourceCapacity(existing.resources, inventoryResourceDefinitions(item), quantity),
      }
    } else {
      entries.push(newEntry(item, quantity, identified))
    }
  } else {
    for (let index = 0; index < quantity; index += 1) entries.push(newEntry(item, 1, item.magicItem ? options.identified !== false : true))
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

function equipEntry(character: Character, entry: Dnd5eInventoryEntry): Character {
  const equipment = entry.item.equipment!
  const slot = equipment.slot
  const inventory = normalizeDnd5eInventory(character)
  const entries = inventory.entries.map((candidate) => ({
    ...candidate,
    equippedSlot: candidate.instanceId === entry.instanceId
      ? slot
      : candidate.equippedSlot === slot
        ? undefined
        : candidate.equippedSlot,
  }))
  const nextCharacter: Character = {
    ...character,
    equipment: { ...(character.equipment ?? {}), [slot]: { ...equipment } },
    dnd5eInventory: inventoryWithEntries(inventory, entries),
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
  return { ...character, equipment, dnd5eInventory: inventoryWithEntries(inventory, entries) }
}

function newEntry(item: Dnd5eInventoryItemTemplate, quantity: number, identified = true): Dnd5eInventoryEntry {
  return {
    instanceId: inventoryId(),
    templateId: item.id,
    item: cloneItemTemplate(item),
    quantity,
    resources: createInventoryResources(item, quantity),
    identified,
    acquiredAt: Date.now(),
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
    entries,
    currency: normalizeCurrency(inventory.currency),
    authorityGrantReceipts: [...(inventory.authorityGrantReceipts ?? [])],
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
