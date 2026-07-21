import type { EquipmentItem } from '../../types/equipment'
import type {
  Dnd5eInventoryIconId,
  Dnd5eInventoryItemTemplate,
  Dnd5eMagicItemKind,
  Dnd5eMagicItemRarity,
} from '../../types/inventory'
import { DND5E_SRD_EQUIPMENT_CATALOG } from './equipment'
import { DND5E_SRD_MAGIC_ITEM_RULES_ZH } from './magicItemRulesZh.generated'

const SRD_SOURCE = { book: 'SRD 5.1' as const, license: 'CC BY 4.0' as const }

type CatalogRuleOverride = Pick<Dnd5eInventoryItemTemplate, 'description' | 'rulesText' | 'use'>

/**
 * 需要声明式 Headless 行为或人工润色的目录条目覆盖。
 * 其余物品正文来自已校验的 SRD 5.1 中文规则数据集。
 */
const CATALOG_RULE_OVERRIDES: Readonly<Record<string, CatalogRuleOverride>> = {
  'amulet-of-the-planes': {
    description: '一枚用于跨位面旅行的极珍稀奇物。只有完成同调并佩戴它的生物才能激活；检定失败时，它可能把佩戴者与周围所有生物和物件送往随机目的地。',
    rulesText: [
      '激活：完成同调并佩戴护符时，你可以使用一个动作，说出另一个存在位面上你熟悉的一处地点。',
      '',
      '检定：进行一次 DC 15 智力检定。',
      '',
      '成功：你通过护符施展“异界传送术”。',
      '',
      '失败：你、距你 15 尺内的每个生物和每件物件一同前往随机目的地。掷 1d100：',
      '• 01–60：抵达你所指定位面上的一个随机地点。',
      '• 61–100：抵达随机决定的一个存在位面。',
    ].join('\n'),
    use: {
      economy: 'action',
      consumeQuantity: 0,
      effect: {
        kind: 'dm-adjudication',
        adjudication: '位面护符：先处理 DC 15 智力检定。成功时按“异界传送术”裁定；失败时掷 1d100，并处理佩戴者周围 15 尺内所有生物、物件及随机目的地。',
      },
    },
  },
}

export interface Dnd5eSrdMagicItemCatalogEntry {
  id: string
  name: string
  englishName: string
  kind: Dnd5eMagicItemKind
  rarity: Dnd5eMagicItemRarity
}

type CatalogRow = readonly [
  id: string,
  name: string,
  englishName: string,
  kind: Dnd5eMagicItemKind,
  rarity: Dnd5eMagicItemRarity,
]

/**
 * SRD 5.1 魔法物品章节的基础条目。带有多个变体的条目在目录层保留为系列，
 * 可直接结算的具体武器、护甲、盾牌和治疗药水由本文件下方生成。
 */
const MAGIC_ITEM_ROWS: readonly CatalogRow[] = [
  ['adamantine-armor', '精金护甲', 'Adamantine Armor', 'armor', 'uncommon'],
  ['ammunition', '+1、+2 或 +3 弹药', 'Ammunition, +1, +2, or +3', 'ammunition', 'varies'],
  ['amulet-of-health', '健康护符', 'Amulet of Health', 'wondrous-item', 'rare'],
  ['amulet-of-proof-against-detection-and-location', '防侦测与定位护符', 'Amulet of Proof against Detection and Location', 'wondrous-item', 'uncommon'],
  ['amulet-of-the-planes', '位面护符', 'Amulet of the Planes', 'wondrous-item', 'very-rare'],
  ['animated-shield', '活化盾', 'Animated Shield', 'armor', 'very-rare'],
  ['apparatus-of-the-crab', '巨蟹装置', 'Apparatus of the Crab', 'wondrous-item', 'legendary'],
  ['armor', '+1、+2 或 +3 护甲', 'Armor, +1, +2, or +3', 'armor', 'varies'],
  ['armor-of-invulnerability', '无敌护甲', 'Armor of Invulnerability', 'armor', 'legendary'],
  ['armor-of-resistance', '抗性护甲', 'Armor of Resistance', 'armor', 'rare'],
  ['armor-of-vulnerability', '易伤护甲', 'Armor of Vulnerability', 'armor', 'rare'],
  ['arrow-catching-shield', '吸箭盾', 'Arrow-Catching Shield', 'armor', 'rare'],
  ['arrow-of-slaying', '屠戮之箭', 'Arrow of Slaying', 'ammunition', 'very-rare'],
  ['bag-of-beans', '魔豆袋', 'Bag of Beans', 'wondrous-item', 'rare'],
  ['bag-of-devouring', '吞噬袋', 'Bag of Devouring', 'wondrous-item', 'very-rare'],
  ['bag-of-holding', '次元袋', 'Bag of Holding', 'wondrous-item', 'uncommon'],
  ['bag-of-tricks', '戏法袋', 'Bag of Tricks', 'wondrous-item', 'uncommon'],
  ['bead-of-force', '力场珠', 'Bead of Force', 'wondrous-item', 'rare'],
  ['belt-of-dwarvenkind', '矮人腰带', 'Belt of Dwarvenkind', 'wondrous-item', 'rare'],
  ['belt-of-giant-strength', '巨人力量腰带', 'Belt of Giant Strength', 'wondrous-item', 'varies'],
  ['berserker-axe', '狂战斧', 'Berserker Axe', 'weapon', 'rare'],
  ['boots-of-elvenkind', '精灵靴', 'Boots of Elvenkind', 'wondrous-item', 'uncommon'],
  ['boots-of-levitation', '浮空靴', 'Boots of Levitation', 'wondrous-item', 'rare'],
  ['boots-of-speed', '速度之靴', 'Boots of Speed', 'wondrous-item', 'rare'],
  ['boots-of-striding-and-springing', '大步奔跃之靴', 'Boots of Striding and Springing', 'wondrous-item', 'uncommon'],
  ['boots-of-the-winterlands', '冬境之靴', 'Boots of the Winterlands', 'wondrous-item', 'uncommon'],
  ['bowl-of-commanding-water-elementals', '控水元素之碗', 'Bowl of Commanding Water Elementals', 'wondrous-item', 'rare'],
  ['bracers-of-archery', '箭术护腕', 'Bracers of Archery', 'wondrous-item', 'uncommon'],
  ['bracers-of-defense', '防御护腕', 'Bracers of Defense', 'wondrous-item', 'rare'],
  ['brazier-of-commanding-fire-elementals', '控火元素火盆', 'Brazier of Commanding Fire Elementals', 'wondrous-item', 'rare'],
  ['brooch-of-shielding', '屏障胸针', 'Brooch of Shielding', 'wondrous-item', 'uncommon'],
  ['broom-of-flying', '飞行扫帚', 'Broom of Flying', 'wondrous-item', 'uncommon'],
  ['candle-of-invocation', '祈神蜡烛', 'Candle of Invocation', 'wondrous-item', 'very-rare'],
  ['cape-of-the-mountebank', '江湖骗子斗篷', 'Cape of the Mountebank', 'wondrous-item', 'rare'],
  ['carpet-of-flying', '飞毯', 'Carpet of Flying', 'wondrous-item', 'very-rare'],
  ['censer-of-controlling-air-elementals', '控气元素香炉', 'Censer of Controlling Air Elementals', 'wondrous-item', 'rare'],
  ['chime-of-opening', '开门钟琴', 'Chime of Opening', 'wondrous-item', 'rare'],
  ['circlet-of-blasting', '爆破头环', 'Circlet of Blasting', 'wondrous-item', 'uncommon'],
  ['cloak-of-arachnida', '蛛行斗篷', 'Cloak of Arachnida', 'wondrous-item', 'very-rare'],
  ['cloak-of-displacement', '移位斗篷', 'Cloak of Displacement', 'wondrous-item', 'rare'],
  ['cloak-of-elvenkind', '精灵斗篷', 'Cloak of Elvenkind', 'wondrous-item', 'uncommon'],
  ['cloak-of-protection', '防护斗篷', 'Cloak of Protection', 'wondrous-item', 'uncommon'],
  ['cloak-of-the-bat', '蝙蝠斗篷', 'Cloak of the Bat', 'wondrous-item', 'rare'],
  ['cloak-of-the-manta-ray', '蝠鲼斗篷', 'Cloak of the Manta Ray', 'wondrous-item', 'uncommon'],
  ['crystal-ball', '水晶球', 'Crystal Ball', 'wondrous-item', 'very-rare'],
  ['cube-of-force', '力场魔方', 'Cube of Force', 'wondrous-item', 'rare'],
  ['cubic-gate', '位面门方块', 'Cubic Gate', 'wondrous-item', 'legendary'],
  ['dagger-of-venom', '剧毒匕首', 'Dagger of Venom', 'weapon', 'rare'],
  ['dancing-sword', '舞空剑', 'Dancing Sword', 'weapon', 'very-rare'],
  ['decanter-of-endless-water', '无尽水瓶', 'Decanter of Endless Water', 'wondrous-item', 'uncommon'],
  ['deck-of-illusions', '幻象牌组', 'Deck of Illusions', 'wondrous-item', 'uncommon'],
  ['deck-of-many-things', '万象无常牌', 'Deck of Many Things', 'wondrous-item', 'legendary'],
  ['defender', '卫士之剑', 'Defender', 'weapon', 'legendary'],
  ['demon-armor', '恶魔护甲', 'Demon Armor', 'armor', 'very-rare'],
  ['dimensional-shackles', '次元镣铐', 'Dimensional Shackles', 'wondrous-item', 'rare'],
  ['dragon-scale-mail', '龙鳞甲', 'Dragon Scale Mail', 'armor', 'very-rare'],
  ['dragon-slayer', '屠龙武器', 'Dragon Slayer', 'weapon', 'rare'],
  ['dust-of-disappearance', '隐形粉', 'Dust of Disappearance', 'wondrous-item', 'uncommon'],
  ['dust-of-dryness', '干燥粉', 'Dust of Dryness', 'wondrous-item', 'uncommon'],
  ['dust-of-sneezing-and-choking', '喷嚏窒息粉', 'Dust of Sneezing and Choking', 'wondrous-item', 'uncommon'],
  ['dwarven-plate', '矮人板甲', 'Dwarven Plate', 'armor', 'very-rare'],
  ['dwarven-thrower', '矮人投锤', 'Dwarven Thrower', 'weapon', 'very-rare'],
  ['efficient-quiver', '高效箭袋', 'Efficient Quiver', 'wondrous-item', 'uncommon'],
  ['efreeti-bottle', '火巨灵之瓶', 'Efreeti Bottle', 'wondrous-item', 'very-rare'],
  ['elemental-gem', '元素宝石', 'Elemental Gem', 'wondrous-item', 'uncommon'],
  ['elven-chain', '精灵链甲', 'Elven Chain', 'armor', 'rare'],
  ['eversmoking-bottle', '永烟瓶', 'Eversmoking Bottle', 'wondrous-item', 'uncommon'],
  ['eyes-of-charming', '魅惑之眼', 'Eyes of Charming', 'wondrous-item', 'uncommon'],
  ['eyes-of-minute-seeing', '微观之眼', 'Eyes of Minute Seeing', 'wondrous-item', 'uncommon'],
  ['eyes-of-the-eagle', '鹰眼镜', 'Eyes of the Eagle', 'wondrous-item', 'uncommon'],
  ['feather-token', '羽毛徽记', 'Feather Token', 'wondrous-item', 'rare'],
  ['figurine-of-wondrous-power', '奇物塑像', 'Figurine of Wondrous Power', 'wondrous-item', 'varies'],
  ['flame-tongue', '焰舌武器', 'Flame Tongue', 'weapon', 'rare'],
  ['folding-boat', '折叠船', 'Folding Boat', 'wondrous-item', 'rare'],
  ['frost-brand', '霜铭武器', 'Frost Brand', 'weapon', 'very-rare'],
  ['gauntlets-of-ogre-power', '食人魔力量护手', 'Gauntlets of Ogre Power', 'wondrous-item', 'uncommon'],
  ['gem-of-brightness', '光明宝石', 'Gem of Brightness', 'wondrous-item', 'uncommon'],
  ['gem-of-seeing', '真视宝石', 'Gem of Seeing', 'wondrous-item', 'rare'],
  ['giant-slayer', '巨人杀手', 'Giant Slayer', 'weapon', 'rare'],
  ['glamoured-studded-leather-armor', '魅影镶钉皮甲', 'Glamoured Studded Leather Armor', 'armor', 'rare'],
  ['gloves-of-missile-snaring', '飞弹诱捕手套', 'Gloves of Missile Snaring', 'wondrous-item', 'uncommon'],
  ['gloves-of-swimming-and-climbing', '游泳攀爬手套', 'Gloves of Swimming and Climbing', 'wondrous-item', 'uncommon'],
  ['goggles-of-night', '夜视镜', 'Goggles of Night', 'wondrous-item', 'uncommon'],
  ['hammer-of-thunderbolts', '雷霆之锤', 'Hammer of Thunderbolts', 'weapon', 'legendary'],
  ['handy-haversack', '便利背包', 'Handy Haversack', 'wondrous-item', 'rare'],
  ['hat-of-disguise', '易容帽', 'Hat of Disguise', 'wondrous-item', 'uncommon'],
  ['headband-of-intellect', '智力头带', 'Headband of Intellect', 'wondrous-item', 'uncommon'],
  ['helm-of-brilliance', '辉煌头盔', 'Helm of Brilliance', 'wondrous-item', 'very-rare'],
  ['helm-of-comprehending-languages', '通晓语言头盔', 'Helm of Comprehending Languages', 'wondrous-item', 'uncommon'],
  ['helm-of-telepathy', '心灵感应头盔', 'Helm of Telepathy', 'wondrous-item', 'uncommon'],
  ['helm-of-teleportation', '传送头盔', 'Helm of Teleportation', 'wondrous-item', 'rare'],
  ['holy-avenger', '神圣复仇者', 'Holy Avenger', 'weapon', 'legendary'],
  ['horn-of-blasting', '爆破号角', 'Horn of Blasting', 'wondrous-item', 'rare'],
  ['horn-of-valhalla', '英灵殿号角', 'Horn of Valhalla', 'wondrous-item', 'varies'],
  ['horseshoes-of-a-zephyr', '轻风马蹄铁', 'Horseshoes of a Zephyr', 'wondrous-item', 'very-rare'],
  ['horseshoes-of-speed', '速度马蹄铁', 'Horseshoes of Speed', 'wondrous-item', 'rare'],
  ['immovable-rod', '不动权杖', 'Immovable Rod', 'rod', 'uncommon'],
  ['instant-fortress', '即时堡垒', 'Instant Fortress', 'wondrous-item', 'rare'],
  ['ioun-stone', '艾恩石', 'Ioun Stone', 'wondrous-item', 'varies'],
  ['iron-bands-of-binding', '束缚铁带', 'Iron Bands of Binding', 'wondrous-item', 'rare'],
  ['iron-flask', '铁烧瓶', 'Iron Flask', 'wondrous-item', 'legendary'],
  ['javelin-of-lightning', '闪电标枪', 'Javelin of Lightning', 'weapon', 'uncommon'],
  ['lantern-of-revealing', '显形提灯', 'Lantern of Revealing', 'wondrous-item', 'uncommon'],
  ['luck-blade', '幸运之刃', 'Luck Blade', 'weapon', 'legendary'],
  ['mace-of-disruption', '破坏硬头锤', 'Mace of Disruption', 'weapon', 'rare'],
  ['mace-of-smiting', '重击硬头锤', 'Mace of Smiting', 'weapon', 'rare'],
  ['mace-of-terror', '恐惧硬头锤', 'Mace of Terror', 'weapon', 'rare'],
  ['mantle-of-spell-resistance', '法术抗力斗篷', 'Mantle of Spell Resistance', 'wondrous-item', 'rare'],
  ['manual-of-bodily-health', '强身手册', 'Manual of Bodily Health', 'wondrous-item', 'very-rare'],
  ['manual-of-gainful-exercise', '健体手册', 'Manual of Gainful Exercise', 'wondrous-item', 'very-rare'],
  ['manual-of-golems', '魔像手册', 'Manual of Golems', 'wondrous-item', 'very-rare'],
  ['manual-of-quickness-of-action', '敏捷动作手册', 'Manual of Quickness of Action', 'wondrous-item', 'very-rare'],
  ['marvelous-pigments', '神奇颜料', 'Marvelous Pigments', 'wondrous-item', 'very-rare'],
  ['medallion-of-thoughts', '读心徽章', 'Medallion of Thoughts', 'wondrous-item', 'uncommon'],
  ['mirror-of-life-trapping', '囚命镜', 'Mirror of Life Trapping', 'wondrous-item', 'very-rare'],
  ['mithral-armor', '秘银护甲', 'Mithral Armor', 'armor', 'uncommon'],
  ['necklace-of-adaptation', '适应项链', 'Necklace of Adaptation', 'wondrous-item', 'uncommon'],
  ['necklace-of-fireballs', '火球项链', 'Necklace of Fireballs', 'wondrous-item', 'rare'],
  ['necklace-of-prayer-beads', '祈祷珠项链', 'Necklace of Prayer Beads', 'wondrous-item', 'rare'],
  ['nine-lives-stealer', '九命夺魂剑', 'Nine Lives Stealer', 'weapon', 'very-rare'],
  ['oathbow', '誓言弓', 'Oathbow', 'weapon', 'very-rare'],
  ['oil-of-etherealness', '以太化油', 'Oil of Etherealness', 'potion', 'rare'],
  ['oil-of-sharpness', '锐锋油', 'Oil of Sharpness', 'potion', 'very-rare'],
  ['oil-of-slipperiness', '滑溜油', 'Oil of Slipperiness', 'potion', 'uncommon'],
  ['pearl-of-power', '法力珍珠', 'Pearl of Power', 'wondrous-item', 'uncommon'],
  ['periapt-of-health', '健康护符', 'Periapt of Health', 'wondrous-item', 'uncommon'],
  ['periapt-of-proof-against-poison', '防毒护符', 'Periapt of Proof against Poison', 'wondrous-item', 'rare'],
  ['periapt-of-wound-closure', '创伤闭合护符', 'Periapt of Wound Closure', 'wondrous-item', 'uncommon'],
  ['philter-of-love', '爱情灵药', 'Philter of Love', 'potion', 'uncommon'],
  ['pipes-of-haunting', '恐惧排箫', 'Pipes of Haunting', 'wondrous-item', 'uncommon'],
  ['pipes-of-the-sewers', '下水道排箫', 'Pipes of the Sewers', 'wondrous-item', 'uncommon'],
  ['plate-armor-of-etherealness', '以太化板甲', 'Plate Armor of Etherealness', 'armor', 'legendary'],
  ['portable-hole', '便携洞穴', 'Portable Hole', 'wondrous-item', 'rare'],
  ['potion-of-animal-friendship', '动物交谈药水', 'Potion of Animal Friendship', 'potion', 'uncommon'],
  ['potion-of-clairvoyance', '鹰眼术药水', 'Potion of Clairvoyance', 'potion', 'rare'],
  ['potion-of-climbing', '攀爬药水', 'Potion of Climbing', 'potion', 'common'],
  ['potion-of-diminution', '缩小药水', 'Potion of Diminution', 'potion', 'rare'],
  ['potion-of-flying', '飞行药水', 'Potion of Flying', 'potion', 'very-rare'],
  ['potion-of-gaseous-form', '气化形体药水', 'Potion of Gaseous Form', 'potion', 'rare'],
  ['potion-of-giant-strength', '巨人力量药水', 'Potion of Giant Strength', 'potion', 'varies'],
  ['potion-of-growth', '变巨药水', 'Potion of Growth', 'potion', 'uncommon'],
  ['potion-of-healing', '治疗药水系列', 'Potion of Healing', 'potion', 'varies'],
  ['potion-of-heroism', '英雄气概药水', 'Potion of Heroism', 'potion', 'rare'],
  ['potion-of-invisibility', '隐形药水', 'Potion of Invisibility', 'potion', 'very-rare'],
  ['potion-of-mind-reading', '读心药水', 'Potion of Mind Reading', 'potion', 'rare'],
  ['potion-of-poison', '毒药水', 'Potion of Poison', 'potion', 'uncommon'],
  ['potion-of-resistance', '抗性药水', 'Potion of Resistance', 'potion', 'uncommon'],
  ['potion-of-speed', '加速药水', 'Potion of Speed', 'potion', 'very-rare'],
  ['potion-of-water-breathing', '水下呼吸药水', 'Potion of Water Breathing', 'potion', 'uncommon'],
  ['restorative-ointment', '复原软膏', 'Restorative Ointment', 'wondrous-item', 'uncommon'],
  ['ring-of-animal-influence', '动物影响戒指', 'Ring of Animal Influence', 'ring', 'rare'],
  ['ring-of-djinni-summoning', '巨灵召唤戒指', 'Ring of Djinni Summoning', 'ring', 'legendary'],
  ['ring-of-elemental-command', '元素统御戒指', 'Ring of Elemental Command', 'ring', 'legendary'],
  ['ring-of-evasion', '闪避戒指', 'Ring of Evasion', 'ring', 'rare'],
  ['ring-of-feather-falling', '羽落戒指', 'Ring of Feather Falling', 'ring', 'rare'],
  ['ring-of-free-action', '行动自如戒指', 'Ring of Free Action', 'ring', 'rare'],
  ['ring-of-invisibility', '隐形戒指', 'Ring of Invisibility', 'ring', 'legendary'],
  ['ring-of-jumping', '跳跃戒指', 'Ring of Jumping', 'ring', 'uncommon'],
  ['ring-of-mind-shielding', '心灵屏障戒指', 'Ring of Mind Shielding', 'ring', 'uncommon'],
  ['ring-of-protection', '防护戒指', 'Ring of Protection', 'ring', 'rare'],
  ['ring-of-regeneration', '再生戒指', 'Ring of Regeneration', 'ring', 'very-rare'],
  ['ring-of-resistance', '抗性戒指', 'Ring of Resistance', 'ring', 'rare'],
  ['ring-of-shooting-stars', '流星戒指', 'Ring of Shooting Stars', 'ring', 'very-rare'],
  ['ring-of-spell-storing', '法术储存戒指', 'Ring of Spell Storing', 'ring', 'rare'],
  ['ring-of-spell-turning', '法术反转戒指', 'Ring of Spell Turning', 'ring', 'legendary'],
  ['ring-of-swimming', '游泳戒指', 'Ring of Swimming', 'ring', 'uncommon'],
  ['ring-of-telekinesis', '心灵遥控戒指', 'Ring of Telekinesis', 'ring', 'very-rare'],
  ['ring-of-the-ram', '公羊戒指', 'Ring of the Ram', 'ring', 'rare'],
  ['ring-of-three-wishes', '三愿戒指', 'Ring of Three Wishes', 'ring', 'legendary'],
  ['ring-of-warmth', '温暖戒指', 'Ring of Warmth', 'ring', 'uncommon'],
  ['ring-of-water-walking', '水上行走戒指', 'Ring of Water Walking', 'ring', 'uncommon'],
  ['ring-of-x-ray-vision', '透视戒指', 'Ring of X-ray Vision', 'ring', 'rare'],
  ['robe-of-eyes', '多眼法袍', 'Robe of Eyes', 'wondrous-item', 'rare'],
  ['robe-of-scintillating-colors', '闪光法袍', 'Robe of Scintillating Colors', 'wondrous-item', 'very-rare'],
  ['robe-of-stars', '星辰法袍', 'Robe of Stars', 'wondrous-item', 'very-rare'],
  ['robe-of-the-archmagi', '大法师之袍', 'Robe of the Archmagi', 'wondrous-item', 'legendary'],
  ['robe-of-useful-items', '实用物品法袍', 'Robe of Useful Items', 'wondrous-item', 'uncommon'],
  ['rod-of-absorption', '吸收权杖', 'Rod of Absorption', 'rod', 'very-rare'],
  ['rod-of-alertness', '警戒权杖', 'Rod of Alertness', 'rod', 'very-rare'],
  ['rod-of-lordly-might', '君王伟力权杖', 'Rod of Lordly Might', 'rod', 'legendary'],
  ['rod-of-rulership', '统治权杖', 'Rod of Rulership', 'rod', 'rare'],
  ['rod-of-security', '安全权杖', 'Rod of Security', 'rod', 'very-rare'],
  ['rope-of-climbing', '攀爬绳', 'Rope of Climbing', 'wondrous-item', 'uncommon'],
  ['rope-of-entanglement', '纠缠绳', 'Rope of Entanglement', 'wondrous-item', 'rare'],
  ['scarab-of-protection', '防护圣甲虫', 'Scarab of Protection', 'wondrous-item', 'legendary'],
  ['scimitar-of-speed', '迅捷弯刀', 'Scimitar of Speed', 'weapon', 'very-rare'],
  ['shield', '+1、+2 或 +3 盾牌', 'Shield, +1, +2, or +3', 'armor', 'varies'],
  ['shield-of-missile-attraction', '飞弹吸引盾', 'Shield of Missile Attraction', 'armor', 'rare'],
  ['slippers-of-spider-climbing', '蛛行便鞋', 'Slippers of Spider Climbing', 'wondrous-item', 'uncommon'],
  ['sovereign-glue', '至高胶', 'Sovereign Glue', 'wondrous-item', 'legendary'],
  ['spell-scroll', '法术卷轴', 'Spell Scroll', 'scroll', 'varies'],
  ['spellguard-shield', '法术防卫盾', 'Spellguard Shield', 'armor', 'very-rare'],
  ['sphere-of-annihilation', '湮灭法球', 'Sphere of Annihilation', 'wondrous-item', 'legendary'],
  ['staff-of-charming', '魅惑法杖', 'Staff of Charming', 'staff', 'rare'],
  ['staff-of-fire', '火焰法杖', 'Staff of Fire', 'staff', 'very-rare'],
  ['staff-of-frost', '寒霜法杖', 'Staff of Frost', 'staff', 'very-rare'],
  ['staff-of-healing', '医疗法杖', 'Staff of Healing', 'staff', 'rare'],
  ['staff-of-power', '强能法杖', 'Staff of Power', 'staff', 'very-rare'],
  ['staff-of-striking', '打击法杖', 'Staff of Striking', 'staff', 'very-rare'],
  ['staff-of-swarming-insects', '虫群法杖', 'Staff of Swarming Insects', 'staff', 'very-rare'],
  ['staff-of-the-magi', '大法师之杖', 'Staff of the Magi', 'staff', 'legendary'],
  ['staff-of-the-python', '巨蟒法杖', 'Staff of the Python', 'staff', 'very-rare'],
  ['staff-of-the-woodlands', '林地法杖', 'Staff of the Woodlands', 'staff', 'rare'],
  ['staff-of-thunder-and-lightning', '雷电法杖', 'Staff of Thunder and Lightning', 'staff', 'very-rare'],
  ['staff-of-withering', '枯萎法杖', 'Staff of Withering', 'staff', 'rare'],
  ['stone-of-controlling-earth-elementals', '控土元素石', 'Stone of Controlling Earth Elementals', 'wondrous-item', 'rare'],
  ['stone-of-good-luck-luckstone', '幸运石', 'Stone of Good Luck (Luckstone)', 'wondrous-item', 'uncommon'],
  ['sun-blade', '阳炎剑', 'Sun Blade', 'weapon', 'rare'],
  ['sword-of-life-stealing', '夺命剑', 'Sword of Life Stealing', 'weapon', 'rare'],
  ['sword-of-sharpness', '锐锋剑', 'Sword of Sharpness', 'weapon', 'very-rare'],
  ['sword-of-wounding', '创伤剑', 'Sword of Wounding', 'weapon', 'rare'],
  ['talisman-of-pure-good', '纯善护符', 'Talisman of Pure Good', 'wondrous-item', 'legendary'],
  ['talisman-of-the-sphere', '法球护符', 'Talisman of the Sphere', 'wondrous-item', 'legendary'],
  ['talisman-of-ultimate-evil', '极恶护符', 'Talisman of Ultimate Evil', 'wondrous-item', 'legendary'],
  ['tome-of-clear-thought', '清晰思维宝典', 'Tome of Clear Thought', 'wondrous-item', 'very-rare'],
  ['tome-of-leadership-and-influence', '领导与影响宝典', 'Tome of Leadership and Influence', 'wondrous-item', 'very-rare'],
  ['tome-of-understanding', '通达宝典', 'Tome of Understanding', 'wondrous-item', 'very-rare'],
  ['trident-of-fish-command', '控鱼三叉戟', 'Trident of Fish Command', 'weapon', 'uncommon'],
  ['universal-solvent', '万能溶剂', 'Universal Solvent', 'wondrous-item', 'legendary'],
  ['vicious-weapon', '凶暴武器', 'Vicious Weapon', 'weapon', 'rare'],
  ['vorpal-sword', '斩首剑', 'Vorpal Sword', 'weapon', 'legendary'],
  ['wand-of-binding', '束缚魔杖', 'Wand of Binding', 'wand', 'rare'],
  ['wand-of-enemy-detection', '侦敌魔杖', 'Wand of Enemy Detection', 'wand', 'rare'],
  ['wand-of-fear', '恐惧魔杖', 'Wand of Fear', 'wand', 'rare'],
  ['wand-of-fireballs', '火球魔杖', 'Wand of Fireballs', 'wand', 'rare'],
  ['wand-of-lightning-bolts', '闪电束魔杖', 'Wand of Lightning Bolts', 'wand', 'rare'],
  ['wand-of-magic-detection', '魔法侦测魔杖', 'Wand of Magic Detection', 'wand', 'uncommon'],
  ['wand-of-magic-missiles', '魔法飞弹魔杖', 'Wand of Magic Missiles', 'wand', 'uncommon'],
  ['wand-of-paralysis', '麻痹魔杖', 'Wand of Paralysis', 'wand', 'rare'],
  ['wand-of-polymorph', '变形魔杖', 'Wand of Polymorph', 'wand', 'very-rare'],
  ['wand-of-secrets', '秘密探测魔杖', 'Wand of Secrets', 'wand', 'uncommon'],
  ['wand-of-the-war-mage', '+1、+2 或 +3 战法师魔杖', 'Wand of the War Mage, +1, +2, or +3', 'wand', 'varies'],
  ['wand-of-web', '蛛网魔杖', 'Wand of Web', 'wand', 'uncommon'],
  ['wand-of-wonder', '奇迹魔杖', 'Wand of Wonder', 'wand', 'rare'],
  ['weapon', '+1、+2 或 +3 武器', 'Weapon, +1, +2, or +3', 'weapon', 'varies'],
  ['well-of-many-worlds', '万界之井', 'Well of Many Worlds', 'wondrous-item', 'legendary'],
  ['wind-fan', '风扇', 'Wind Fan', 'wondrous-item', 'uncommon'],
  ['winged-boots', '飞翼靴', 'Winged Boots', 'wondrous-item', 'uncommon'],
  ['wings-of-flying', '飞行之翼', 'Wings of Flying', 'wondrous-item', 'rare'],
  ['orb-of-dragonkind', '龙珠', 'Orb of Dragonkind', 'wondrous-item', 'artifact'],
] as const

export const DND5E_SRD_MAGIC_ITEM_CATALOG: readonly Dnd5eSrdMagicItemCatalogEntry[] =
  MAGIC_ITEM_ROWS.map(([id, name, englishName, kind, rarity]) => ({ id, name, englishName, kind, rarity }))

const ATTUNEMENT_IDS = new Set([
  'amulet-of-health', 'amulet-of-proof-against-detection-and-location', 'amulet-of-the-planes', 'animated-shield',
  'armor-of-invulnerability', 'armor-of-resistance', 'armor-of-vulnerability', 'arrow-catching-shield',
  'belt-of-dwarvenkind', 'belt-of-giant-strength', 'berserker-axe', 'boots-of-levitation', 'boots-of-speed',
  'boots-of-striding-and-springing', 'boots-of-the-winterlands', 'bracers-of-archery', 'bracers-of-defense',
  'brooch-of-shielding', 'candle-of-invocation', 'cloak-of-arachnida', 'cloak-of-displacement', 'cloak-of-elvenkind',
  'cloak-of-protection', 'cloak-of-the-bat', 'crystal-ball', 'cube-of-force', 'dancing-sword', 'defender',
  'demon-armor', 'dragon-scale-mail', 'dwarven-thrower', 'eyes-of-charming', 'eyes-of-the-eagle', 'flame-tongue',
  'frost-brand', 'gauntlets-of-ogre-power', 'gem-of-seeing', 'gloves-of-missile-snaring',
  'gloves-of-swimming-and-climbing', 'hat-of-disguise', 'headband-of-intellect', 'helm-of-brilliance',
  'helm-of-telepathy', 'helm-of-teleportation', 'holy-avenger', 'ioun-stone', 'luck-blade', 'mace-of-disruption',
  'mace-of-terror', 'mantle-of-spell-resistance', 'medallion-of-thoughts', 'necklace-of-adaptation',
  'necklace-of-prayer-beads', 'nine-lives-stealer', 'oathbow', 'pearl-of-power', 'periapt-of-wound-closure',
  'pipes-of-the-sewers', 'plate-armor-of-etherealness', 'ring-of-djinni-summoning', 'ring-of-elemental-command',
  'ring-of-evasion', 'ring-of-feather-falling', 'ring-of-free-action', 'ring-of-invisibility', 'ring-of-jumping',
  'ring-of-mind-shielding', 'ring-of-protection', 'ring-of-regeneration', 'ring-of-resistance',
  'ring-of-shooting-stars', 'ring-of-spell-storing', 'ring-of-spell-turning', 'ring-of-telekinesis',
  'ring-of-the-ram', 'ring-of-warmth', 'ring-of-x-ray-vision', 'robe-of-eyes', 'robe-of-scintillating-colors',
  'robe-of-stars', 'robe-of-the-archmagi', 'rod-of-absorption', 'rod-of-alertness', 'rod-of-lordly-might',
  'rod-of-rulership', 'scarab-of-protection', 'scimitar-of-speed', 'shield-of-missile-attraction',
  'slippers-of-spider-climbing', 'spellguard-shield', 'staff-of-charming', 'staff-of-fire', 'staff-of-frost',
  'staff-of-healing', 'staff-of-power', 'staff-of-striking', 'staff-of-swarming-insects', 'staff-of-the-magi',
  'staff-of-the-python', 'staff-of-the-woodlands', 'staff-of-thunder-and-lightning', 'staff-of-withering',
  'stone-of-good-luck-luckstone', 'sun-blade', 'sword-of-life-stealing', 'sword-of-sharpness', 'sword-of-wounding',
  'talisman-of-pure-good', 'talisman-of-the-sphere', 'talisman-of-ultimate-evil', 'trident-of-fish-command',
  'vorpal-sword', 'wand-of-binding', 'wand-of-enemy-detection', 'wand-of-fear', 'wand-of-fireballs',
  'wand-of-lightning-bolts', 'wand-of-paralysis', 'wand-of-polymorph', 'wand-of-the-war-mage', 'wand-of-web',
  'wand-of-wonder', 'winged-boots', 'wings-of-flying', 'orb-of-dragonkind',
])

const ATTUNEMENT_REQUIREMENTS: Readonly<Record<string, string>> = {
  'dwarven-thrower': '仅限矮人',
  'holy-avenger': '仅限圣武士',
  'necklace-of-prayer-beads': '仅限牧师、德鲁伊或圣武士',
  'pearl-of-power': '仅限施法者',
  'ring-of-shooting-stars': '须在户外夜间完成同调',
  'robe-of-the-archmagi': '仅限术士、邪术师或法师',
  'staff-of-charming': '仅限吟游诗人、牧师、德鲁伊、术士、邪术师或法师',
  'staff-of-fire': '仅限德鲁伊、术士、邪术师或法师',
  'staff-of-frost': '仅限德鲁伊、术士、邪术师或法师',
  'staff-of-healing': '仅限吟游诗人、牧师或德鲁伊',
  'staff-of-power': '仅限术士、邪术师或法师',
  'staff-of-swarming-insects': '仅限吟游诗人、牧师、德鲁伊、术士、邪术师或法师',
  'staff-of-the-magi': '仅限术士、邪术师或法师',
  'staff-of-the-python': '仅限牧师、德鲁伊或邪术师',
  'staff-of-the-woodlands': '仅限德鲁伊',
  'staff-of-withering': '仅限牧师、德鲁伊或邪术师',
  'talisman-of-pure-good': '仅限善良阵营生物',
  'talisman-of-ultimate-evil': '仅限邪恶阵营生物',
  'wand-of-binding': '仅限施法者',
  'wand-of-fireballs': '仅限施法者',
  'wand-of-lightning-bolts': '仅限施法者',
  'wand-of-paralysis': '仅限施法者',
  'wand-of-polymorph': '仅限施法者',
  'wand-of-the-war-mage': '仅限施法者',
  'wand-of-web': '仅限施法者',
  'wand-of-wonder': '仅限施法者',
}

export const DND5E_MAGIC_ITEM_RARITY_LABELS: Readonly<Record<Dnd5eMagicItemRarity, string>> = {
  common: '普通',
  uncommon: '非普通',
  rare: '稀有',
  'very-rare': '极珍稀',
  legendary: '传奇',
  artifact: '神器',
  varies: '依变体而定',
}

export const DND5E_MAGIC_ITEM_KIND_LABELS: Readonly<Record<Dnd5eMagicItemKind, string>> = {
  armor: '护甲',
  weapon: '武器',
  ammunition: '弹药',
  'wondrous-item': '奇物',
  potion: '药水或魔法油',
  ring: '戒指',
  rod: '权杖',
  scroll: '卷轴',
  staff: '法杖',
  wand: '魔杖',
}

function iconForKind(kind: Dnd5eMagicItemKind): Dnd5eInventoryIconId {
  if (kind === 'weapon' || kind === 'ammunition') return 'weapon'
  if (kind === 'armor') return 'armor'
  if (kind === 'potion') return 'healing-potion'
  if (kind === 'ring') return 'magic-ring'
  if (kind === 'wand') return 'magic-wand'
  if (kind === 'staff' || kind === 'rod') return 'magic-staff'
  if (kind === 'scroll') return 'magic-scroll'
  return 'magic-wondrous'
}

function catalogTemplate(entry: Dnd5eSrdMagicItemCatalogEntry): Dnd5eInventoryItemTemplate {
  const attunement = ATTUNEMENT_IDS.has(entry.id) ? 'required' as const : 'none' as const
  const requirement = ATTUNEMENT_REQUIREMENTS[entry.id]
  const rarity = DND5E_MAGIC_ITEM_RARITY_LABELS[entry.rarity]
  const kind = DND5E_MAGIC_ITEM_KIND_LABELS[entry.kind]
  const rules = CATALOG_RULE_OVERRIDES[entry.id]
  const srdRules = DND5E_SRD_MAGIC_ITEM_RULES_ZH[entry.id]
  if (!srdRules) {
    throw new Error(`SRD 5.1 magic item rule text is missing: ${entry.id}`)
  }
  return {
    id: `srd-5.1:magic-item:${entry.id}`,
    name: entry.name,
    englishName: entry.englishName,
    category: entry.kind === 'potion' ? 'consumable' : 'magic-item',
    icon: iconForKind(entry.kind),
    description: rules?.description ?? `${rarity}${kind}${attunement === 'required' ? '，需要同调' : ''}。`,
    rulesText: rules?.rulesText ?? srdRules.rulesText,
    stackable: entry.kind === 'ammunition' || entry.kind === 'potion' || entry.kind === 'scroll',
    ...(rules?.use ? { use: rules.use } : {}),
    magicItem: {
      kind: entry.kind,
      rarity: entry.rarity,
      attunement,
      ...(requirement ? { attunementRequirement: requirement } : {}),
      automation: 'dm-adjudication',
    },
    source: SRD_SOURCE,
  }
}

export const DND5E_SRD_MAGIC_ITEM_CATALOG_TEMPLATES: readonly Dnd5eInventoryItemTemplate[] =
  DND5E_SRD_MAGIC_ITEM_CATALOG.map(catalogTemplate)

function magicEquipmentTemplate(
  base: EquipmentItem,
  bonus: 1 | 2 | 3,
  kind: 'weapon' | 'armor',
): Dnd5eInventoryItemTemplate {
  const rarity: Dnd5eMagicItemRarity = kind === 'weapon'
    ? (bonus === 1 ? 'uncommon' : bonus === 2 ? 'rare' : 'very-rare')
    : (bonus === 1 ? 'rare' : bonus === 2 ? 'very-rare' : 'legendary')
  const magicName = `+${bonus} ${base.name}`
  const baseEnglishName = base.id
    .replace(/^dnd5e-/, '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  const id = `srd-5.1:magic-item:${kind}-${base.id.replace(/^dnd5e-/, '')}-plus-${bonus}`
  const effects = kind === 'weapon'
    ? { ...base.effects, weaponAttackBonus: bonus, weaponDamageBonus: bonus }
    : { ...base.effects, armorClassBonus: bonus }
  return {
    id,
    name: magicName,
    englishName: `${baseEnglishName}, +${bonus}`,
    category: 'equipment',
    icon: kind,
    description: `${DND5E_MAGIC_ITEM_RARITY_LABELS[rarity]}魔法${kind === 'weapon' ? '武器' : '护甲'}，无需同调。`,
    rulesText: kind === 'weapon'
      ? `使用该魔法武器进行攻击检定和伤害掷骰时获得 +${bonus} 加值；其余武器数据沿用基础武器。`
      : `穿戴该魔法护甲时，护甲等级在基础护甲公式之外再获得 +${bonus} 加值。`,
    stackable: false,
    equipment: { ...base, id, name: magicName, effects },
    magicItem: { kind, rarity, attunement: 'none', automation: 'headless' },
    source: SRD_SOURCE,
  }
}

const BASE_WEAPONS = DND5E_SRD_EQUIPMENT_CATALOG.filter((item) =>
  item.dnd5e?.kind === 'weapon' && !item.id.endsWith('-offhand'),
)
const BASE_ARMOR = DND5E_SRD_EQUIPMENT_CATALOG.filter((item) => item.dnd5e?.kind === 'armor')

export const DND5E_SRD_MAGIC_WEAPON_TEMPLATES: readonly Dnd5eInventoryItemTemplate[] =
  BASE_WEAPONS.flatMap((weapon) => ([1, 2, 3] as const).map((bonus) => magicEquipmentTemplate(weapon, bonus, 'weapon')))

export const DND5E_SRD_MAGIC_ARMOR_TEMPLATES: readonly Dnd5eInventoryItemTemplate[] =
  BASE_ARMOR.flatMap((armor) => ([1, 2, 3] as const).map((bonus) => magicEquipmentTemplate(armor, bonus, 'armor')))

export const DND5E_SRD_MAGIC_SHIELD_TEMPLATES: readonly Dnd5eInventoryItemTemplate[] = ([1, 2, 3] as const).map((bonus) => {
  const base = DND5E_SRD_EQUIPMENT_CATALOG.find((item) => item.dnd5e?.kind === 'shield')!
  const rarity: Dnd5eMagicItemRarity = bonus === 1 ? 'uncommon' : bonus === 2 ? 'rare' : 'very-rare'
  const id = `srd-5.1:magic-item:shield-plus-${bonus}`
  const name = `+${bonus} 盾牌`
  return {
    id,
    name,
    englishName: `Shield, +${bonus}`,
    category: 'equipment',
    icon: 'shield',
    description: `${DND5E_MAGIC_ITEM_RARITY_LABELS[rarity]}魔法盾牌，无需同调。`,
    rulesText: `持用该盾牌时，除盾牌通常提供的 +2 AC 外，再获得 +${bonus} AC。`,
    stackable: false,
    equipment: {
      ...base,
      id,
      name,
      effects: { ...base.effects, armorClassBonus: bonus },
    },
    magicItem: { kind: 'armor', rarity, attunement: 'none', automation: 'headless' },
    source: SRD_SOURCE,
  }
})

const HEALING_POTION_VARIANTS: ReadonlyArray<{
  id: string
  name: string
  englishName: string
  rarity: Dnd5eMagicItemRarity
  dice: { count: number; sides: number; bonus: number }
}> = [
  { id: 'greater', name: '强效治疗药水', englishName: 'Potion of Greater Healing', rarity: 'uncommon', dice: { count: 4, sides: 4, bonus: 4 } },
  { id: 'superior', name: '高效治疗药水', englishName: 'Potion of Superior Healing', rarity: 'rare', dice: { count: 8, sides: 4, bonus: 8 } },
  { id: 'supreme', name: '极效治疗药水', englishName: 'Potion of Supreme Healing', rarity: 'very-rare', dice: { count: 10, sides: 4, bonus: 20 } },
]

export const DND5E_SRD_MAGIC_CONSUMABLE_TEMPLATES: readonly Dnd5eInventoryItemTemplate[] =
  HEALING_POTION_VARIANTS.map(({ id, name, englishName, rarity, dice }) => ({
    id: `srd-5.1:magic-item:potion-of-healing-${id}`,
    name,
    englishName,
    category: 'consumable',
    icon: 'healing-potion',
    description: `${DND5E_MAGIC_ITEM_RARITY_LABELS[rarity]}魔法药水。`,
    rulesText: `饮用或给其他生物服用后恢复 ${dice.count}d${dice.sides}+${dice.bonus} 点生命值。`,
    weightLb: 0.5,
    stackable: true,
    use: { economy: 'action', consumeQuantity: 1, effect: { kind: 'healing', dice } },
    magicItem: { kind: 'potion', rarity, attunement: 'none', automation: 'headless' },
    source: SRD_SOURCE,
  }))

export const DND5E_SRD_MAGIC_ITEM_TEMPLATES: readonly Dnd5eInventoryItemTemplate[] = [
  ...DND5E_SRD_MAGIC_ITEM_CATALOG_TEMPLATES,
  ...DND5E_SRD_MAGIC_WEAPON_TEMPLATES,
  ...DND5E_SRD_MAGIC_ARMOR_TEMPLATES,
  ...DND5E_SRD_MAGIC_SHIELD_TEMPLATES,
  ...DND5E_SRD_MAGIC_CONSUMABLE_TEMPLATES,
]
