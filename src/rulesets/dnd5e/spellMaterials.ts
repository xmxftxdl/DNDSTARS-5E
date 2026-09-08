import type { Character } from '../../types/character'
import type {
  Dnd5eInventoryEntry,
  Dnd5eInventoryItemTemplate,
} from '../../types/inventory'
import { DND5E_INVENTORY_SCHEMA_VERSION } from '../../types/inventory'
import type { EquipmentSlot } from '../../types/equipment'

export interface Dnd5eSpellMaterialComponent {
  /** Exact ingredient identity; never inferred from item name or shop price. */
  tag: string
  label: string
  /** Number of distinct inventory units required. Defaults to one. */
  quantity?: number
  /** Each selected unit must meet this value (for example, one 500 gp diamond). */
  minimumUnitValueGp?: number
  /** Selected units may be combined to meet this total (for example, 300 gp of diamonds). */
  minimumTotalValueGp?: number
  /** Some spell bodies require the component to be worn before casting. */
  mustBeEquipped?: boolean
  consumed: boolean
}

export interface Dnd5eSpellMaterialOption {
  label: string
  components: readonly Dnd5eSpellMaterialComponent[]
}

export interface Dnd5eSpellMaterialRequirement {
  label: string
  options: readonly Dnd5eSpellMaterialOption[]
}

export interface Dnd5eSpellMaterialAllocation {
  instanceId: string
  tag: string
  quantity: number
  unitValueGp: number
  consumed: boolean
  mustBeEquipped?: boolean
}

export interface Dnd5eSpellMaterialConsumptionPlan {
  expectedInventoryRevision: number
  requirementLabel: string
  optionLabel: string
  allocations: readonly Dnd5eSpellMaterialAllocation[]
}

/** Human-readable audit details for the exact material allocation bound at cast preparation. */
export function dnd5eSpellMaterialPlanLogDetails(
  actor: Pick<Character, 'dnd5eInventory'>,
  plan: Dnd5eSpellMaterialConsumptionPlan | undefined,
): string[] {
  if (!plan) return []
  const entries = actor.dnd5eInventory?.entries ?? []
  return [
    `施法材料方案：${plan.requirementLabel}｜采用 ${plan.optionLabel}`,
    ...plan.allocations.map((allocation) => {
      const entry = entries.find((candidate) => candidate.instanceId === allocation.instanceId)
      const label = entry?.item.name ?? allocation.tag
      const disposition = allocation.consumed ? '结算时已消耗' : '施法后保留'
      const equipped = allocation.mustBeEquipped ? '｜施法前已穿戴' : ''
      return `施法材料：${label} ×${allocation.quantity}｜每单位 ${allocation.unitValueGp.toLocaleString('en-US')} gp${equipped}｜${disposition}`
    }),
  ]
}

export type Dnd5eSpellMaterialSettlement =
  | { ok: true; character: Character; consumed: boolean }
  | { ok: false; character: Character; reason: 'inventory-untracked' | 'stale-inventory-revision' | 'material-unavailable' }

const SRD_SOURCE = { book: 'SRD 5.1' as const, license: 'CC BY 4.0' as const }

function materialItem(input: {
  id: string
  name: string
  englishName: string
  tag: string
  unitValueGp: number
  consumedByDefault?: boolean
  icon?: Dnd5eInventoryItemTemplate['icon']
  wearableSlot?: EquipmentSlot
}): Dnd5eInventoryItemTemplate {
  const handling = input.consumedByDefault
    ? '施法成功结算时，若所用法术声明会消耗该材料，权威库存会扣除实际分配的数量。'
    : '仅在法术明确声明会消耗该材料时扣除；其他情况下施法后仍保留。'
  const rulesText = `具有明确的法术材料标签“${input.tag}”，每单位规则价值 ${input.unitValueGp} gp。${handling}`
  return {
    id: `srd-5.1:item:${input.id}`,
    name: input.name,
    englishName: input.englishName,
    category: input.consumedByDefault ? 'consumable' : 'adventuring-gear',
    icon: input.icon ?? 'generic',
    description: rulesText,
    rulesText,
    weightLb: 0,
    cost: { amount: input.unitValueGp, currency: 'gp' },
    stackable: true,
    spellcastingMaterial: { tags: [input.tag], unitValueGp: input.unitValueGp },
    ...(input.wearableSlot ? {
      equipment: {
        id: `srd-5.1:equipment:${input.id}`,
        name: input.name,
        slot: input.wearableSlot,
      },
    } : {}),
    source: SRD_SOURCE,
  }
}

/** Catalog entries for the fixed-value SRD materials currently resolved headlessly. */
export const DND5E_SRD_SPELL_MATERIAL_ITEM_TEMPLATES: readonly Dnd5eInventoryItemTemplate[] = [
  materialItem({ id: 'gold-dust-25gp', name: '金粉（25 gp）', englishName: 'Gold dust (25 gp)', tag: 'gold-dust', unitValueGp: 25, consumedByDefault: true }),
  materialItem({ id: 'platinum-miniature-sword-250gp', name: '铂金微型剑（250 gp）', englishName: 'Platinum miniature sword (250 gp)', tag: 'platinum-miniature-sword', unitValueGp: 250 }),
  materialItem({ id: 'marked-divination-tokens-25gp', name: '特制占卜信物（25 gp）', englishName: 'Marked divination tokens (25 gp)', tag: 'marked-divination-tokens', unitValueGp: 25 }),
  materialItem({ id: 'agate-1000gp', name: '玛瑙（1,000 gp）', englishName: 'Agate (1,000 gp)', tag: 'agate', unitValueGp: 1_000, consumedByDefault: true }),
  materialItem({ id: 'black-onyx-150gp', name: '黑玛瑙（150 gp）', englishName: 'Black onyx (150 gp)', tag: 'black-onyx', unitValueGp: 150 }),
  materialItem({ id: 'grave-dirt-clay-pot', name: '墓土陶罐', englishName: 'Clay pot of grave dirt', tag: 'grave-dirt-clay-pot', unitValueGp: 0 }),
  materialItem({ id: 'brackish-water-clay-pot', name: '微咸水陶罐', englishName: 'Clay pot of brackish water', tag: 'brackish-water-clay-pot', unitValueGp: 0 }),
  materialItem({ id: 'black-pearl-powder-500gp', name: '黑珍珠粉末（500 gp）', englishName: 'Black pearl powder (500 gp)', tag: 'black-pearl-powder', unitValueGp: 500 }),
  materialItem({ id: 'clairvoyance-focus-100gp', name: '锐眼/锐耳术法器（100 gp）', englishName: 'Clairvoyance focus (100 gp)', tag: 'clairvoyance-focus', unitValueGp: 100 }),
  materialItem({ id: 'contingency-statuette-1500gp', name: '应急术自塑像（1,500 gp）', englishName: 'Contingency statuette (1,500 gp)', tag: 'contingency-statuette', unitValueGp: 1_500 }),
  materialItem({ id: 'diamond-100gp', name: '钻石（100 gp）', englishName: 'Diamond (100 gp)', tag: 'diamond', unitValueGp: 100 }),
  materialItem({ id: 'diamond-300gp', name: '钻石（300 gp）', englishName: 'Diamond (300 gp)', tag: 'diamond', unitValueGp: 300, consumedByDefault: true }),
  materialItem({ id: 'diamond-500gp', name: '钻石（500 gp）', englishName: 'Diamond (500 gp)', tag: 'diamond', unitValueGp: 500, consumedByDefault: true }),
  materialItem({ id: 'diamond-1000gp', name: '钻石（1,000 gp）', englishName: 'Diamond (1,000 gp)', tag: 'diamond', unitValueGp: 1_000, consumedByDefault: true }),
  materialItem({ id: 'diamond-5000gp', name: '钻石（5,000 gp）', englishName: 'Diamond (5,000 gp)', tag: 'diamond', unitValueGp: 5_000 }),
  materialItem({ id: 'diamond-25000gp', name: '钻石（25,000 gp）', englishName: 'Diamond (25,000 gp)', tag: 'diamond', unitValueGp: 25_000, consumedByDefault: true }),
  materialItem({ id: 'diamond-dust-25gp', name: '钻石粉末（25 gp）', englishName: 'Diamond dust (25 gp)', tag: 'diamond-dust', unitValueGp: 25, consumedByDefault: true }),
  materialItem({ id: 'diamond-dust-100gp', name: '钻石粉末（100 gp）', englishName: 'Diamond dust (100 gp)', tag: 'diamond-dust', unitValueGp: 100, consumedByDefault: true }),
  materialItem({ id: 'diamond-dust-200gp', name: '钻石粉末（200 gp）', englishName: 'Diamond dust (200 gp)', tag: 'diamond-dust', unitValueGp: 200, consumedByDefault: true }),
  materialItem({ id: 'religious-offering-25gp', name: '信仰祭品与熏香（25 gp）', englishName: 'Religious offering and incense (25 gp)', tag: 'religious-offering', unitValueGp: 25, consumedByDefault: true }),
  materialItem({ id: 'familiar-incense-mixture-10gp', name: '魔宠仪式熏香混合物（10 gp）', englishName: 'Familiar incense mixture (10 gp)', tag: 'familiar-incense-mixture', unitValueGp: 10, consumedByDefault: true }),
  materialItem({ id: 'ruby-dust-50gp', name: '红宝石粉末（50 gp）', englishName: 'Ruby dust (50 gp)', tag: 'ruby-dust', unitValueGp: 50, consumedByDefault: true }),
  materialItem({ id: 'ruby-dust-1000gp', name: '红宝石粉末（1,000 gp）', englishName: 'Ruby dust (1,000 gp)', tag: 'ruby-dust', unitValueGp: 1_000 }),
  materialItem({ id: 'ruby-dust-1500gp', name: '红宝石粉末（1,500 gp）', englishName: 'Ruby dust (1,500 gp)', tag: 'ruby-dust', unitValueGp: 1_500 }),
  materialItem({ id: 'sacred-incense-oils-1000gp', name: '圣化草药、油膏与熏香（1,000 gp）', englishName: 'Sacred herbs, oils, and incense (1,000 gp)', tag: 'sacred-incense-oils', unitValueGp: 1_000, consumedByDefault: true }),
  materialItem({ id: 'jeweled-bowl-1000gp', name: '镶宝石的碗（1,000 gp）', englishName: 'Gem-encrusted bowl (1,000 gp)', tag: 'jeweled-bowl', unitValueGp: 1_000, consumedByDefault: true }),
  materialItem({ id: 'holy-reliquary-1000gp', name: '装有圣物的微型圣物匣（1,000 gp）', englishName: 'Reliquary containing a sacred relic (1,000 gp)', tag: 'holy-reliquary', unitValueGp: 1_000 }),
  materialItem({ id: 'silver-rod-10gp', name: '小银棒（10 gp）', englishName: 'Small silver rod (10 gp)', tag: 'small-silver-rod', unitValueGp: 10 }),
  materialItem({ id: 'pearl-100gp', name: '珍珠（100 gp）', englishName: 'Pearl (100 gp)', tag: 'pearl', unitValueGp: 100 }),
  materialItem({ id: 'leaded-ink-10gp', name: '含铅墨水（10 gp）', englishName: 'Lead-based ink (10 gp)', tag: 'leaded-ink', unitValueGp: 10, consumedByDefault: true }),
  materialItem({ id: 'sapphire-1000gp', name: '蓝宝石（1,000 gp）', englishName: 'Sapphire (1,000 gp)', tag: 'sapphire', unitValueGp: 1_000 }),
  materialItem({ id: 'legend-lore-incense-250gp', name: '通晓传奇熏香（250 gp）', englishName: 'Legend lore incense (250 gp)', tag: 'legend-lore-incense', unitValueGp: 250, consumedByDefault: true }),
  materialItem({ id: 'ivory-strip-50gp', name: '象牙片（50 gp）', englishName: 'Ivory strip (50 gp)', tag: 'ivory-strip', unitValueGp: 50 }),
  materialItem({ id: 'silver-iron-powder-dose', name: '银粉与铁粉（一份）', englishName: 'Silver and iron powder (one dose)', tag: 'silver-iron-powder', unitValueGp: 1, consumedByDefault: true }),
  materialItem({ id: 'silver-iron-powder-100gp', name: '银粉与铁粉（100 gp）', englishName: 'Silver and iron powder (100 gp)', tag: 'silver-iron-powder', unitValueGp: 100, consumedByDefault: true }),
  materialItem({ id: 'ornamental-container-500gp', name: '装饰性灵魂容器（500 gp）', englishName: 'Ornamental soul container (500 gp)', tag: 'ornamental-soul-container', unitValueGp: 500 }),
  materialItem({ id: 'jade-dust-10gp', name: '翡翠粉末（10 gp）', englishName: 'Jade dust (10 gp)', tag: 'jade-dust', unitValueGp: 10, consumedByDefault: true }),
  materialItem({ id: 'ivory-portal-5gp', name: '象牙微型门户（5 gp）', englishName: 'Miniature ivory portal (5 gp)', tag: 'ivory-miniature-portal', unitValueGp: 5 }),
  materialItem({ id: 'polished-marble-5gp', name: '抛光大理石（5 gp）', englishName: 'Polished marble (5 gp)', tag: 'polished-marble', unitValueGp: 5 }),
  materialItem({ id: 'silver-spoon-5gp', name: '微型银匙（5 gp）', englishName: 'Miniature silver spoon (5 gp)', tag: 'miniature-silver-spoon', unitValueGp: 5 }),
  materialItem({ id: 'jewel-1000gp', name: '珠宝（1,000 gp）', englishName: 'Jewel (1,000 gp)', tag: 'jewel', unitValueGp: 1_000, consumedByDefault: true }),
  materialItem({ id: 'tuned-forked-rod-250gp', name: '位面调谐叉状金属棒（250 gp）', englishName: 'Planar-tuned forked metal rod (250 gp)', tag: 'tuned-forked-rod', unitValueGp: 250 }),
  materialItem({ id: 'jade-powder-25gp', name: '玉粉（25 gp）', englishName: 'Jade powder (25 gp)', tag: 'jade-powder', unitValueGp: 25 }),
  materialItem({ id: 'caster-replica-5gp', name: '施法者小型复制品（5 gp）', englishName: 'Small replica of the caster (5 gp)', tag: 'caster-replica', unitValueGp: 5 }),
  materialItem({ id: 'rare-oils-1000gp', name: '稀有油膏（1,000 gp）', englishName: 'Rare oils and unguents (1,000 gp)', tag: 'rare-oils', unitValueGp: 1_000, consumedByDefault: true }),
  materialItem({ id: 'scrying-focus-1000gp', name: '探知术法器（1,000 gp）', englishName: 'Scrying focus (1,000 gp)', tag: 'scrying-focus', unitValueGp: 1_000 }),
  materialItem({ id: 'secret-chest-5000gp', name: '秘法箱（5,000 gp）', englishName: 'Secret chest (5,000 gp)', tag: 'secret-chest', unitValueGp: 5_000 }),
  materialItem({ id: 'secret-chest-replica-50gp', name: '秘法箱微型复制品（50 gp）', englishName: 'Secret chest replica (50 gp)', tag: 'secret-chest-replica', unitValueGp: 50 }),
  materialItem({ id: 'mixed-gem-dust-5000gp', name: '四色宝石粉末（5,000 gp）', englishName: 'Mixed gem dust (5,000 gp)', tag: 'mixed-gem-dust', unitValueGp: 5_000, consumedByDefault: true }),
  materialItem({ id: 'jade-circlet-1500gp', name: '玉石头环（1,500 gp）', englishName: 'Jade circlet (1,500 gp)', tag: 'jade-circlet', unitValueGp: 1_500, wearableSlot: 'helmet' }),
  materialItem({ id: 'symbol-powders-1000gp', name: '徽记术宝石粉末（1,000 gp）', englishName: 'Symbol spell powders (1,000 gp)', tag: 'symbol-powders', unitValueGp: 1_000, consumedByDefault: true }),
  materialItem({ id: 'teleportation-chalk-ink-50gp', name: '传送法阵粉笔与墨水（50 gp）', englishName: 'Teleportation circle chalk and ink (50 gp)', tag: 'teleportation-chalk-ink', unitValueGp: 50, consumedByDefault: true }),
  materialItem({ id: 'truesight-ointment-25gp', name: '真知术眼膏（25 gp）', englishName: 'Truesight ointment (25 gp)', tag: 'truesight-ointment', unitValueGp: 25, consumedByDefault: true }),
  materialItem({ id: 'platinum-ring-50gp', name: '铂金戒指（50 gp）', englishName: 'Platinum ring (50 gp)', tag: 'platinum-ring', unitValueGp: 50, icon: 'magic-ring', wearableSlot: 'ring' }),
  materialItem({ id: 'imprisonment-mithral-orb-500gp', name: '禁锢术秘银球价值份额（500 gp）', englishName: 'Imprisonment mithral orb value share (500 gp)', tag: 'imprisonment-mithral-orb', unitValueGp: 500 }),
  materialItem({ id: 'imprisonment-precious-chain-500gp', name: '禁锢术贵金属锁链价值份额（500 gp）', englishName: 'Imprisonment precious chain value share (500 gp)', tag: 'imprisonment-precious-chain', unitValueGp: 500 }),
  materialItem({ id: 'imprisonment-jade-prison-500gp', name: '禁锢术玉石监牢价值份额（500 gp）', englishName: 'Imprisonment jade prison value share (500 gp)', tag: 'imprisonment-jade-prison', unitValueGp: 500 }),
  materialItem({ id: 'imprisonment-transparent-gem-500gp', name: '禁锢术透明宝石价值份额（500 gp）', englishName: 'Imprisonment transparent gem value share (500 gp)', tag: 'imprisonment-transparent-gem', unitValueGp: 500 }),
  materialItem({ id: 'imprisonment-soporific-herbs-500gp', name: '禁锢术催眠草药价值份额（500 gp）', englishName: 'Imprisonment soporific herbs value share (500 gp)', tag: 'imprisonment-soporific-herbs', unitValueGp: 500 }),
]

const component = (
  tag: string,
  label: string,
  consumed: boolean,
  value: { quantity?: number; minimumUnitValueGp?: number; minimumTotalValueGp?: number; mustBeEquipped?: boolean } = {},
): Dnd5eSpellMaterialComponent => ({ tag, label, consumed, ...value })

const singleOption = (
  label: string,
  ...components: readonly Dnd5eSpellMaterialComponent[]
): Dnd5eSpellMaterialRequirement => ({ label, options: [{ label, components }] })

type ImprisonmentMode = 'burial' | 'chaining' | 'hedged-prison' | 'minimus-containment' | 'slumber'

const IMPRISONMENT_MATERIAL_OPTIONS: Readonly<Record<ImprisonmentMode, Dnd5eSpellMaterialOption>> = {
  burial: { label: '埋葬·秘银球', components: [component('imprisonment-mithral-orb', '小型秘银球', false)] },
  chaining: { label: '锁链·贵金属锁链', components: [component('imprisonment-precious-chain', '贵金属精细锁链', false)] },
  'hedged-prison': { label: '封闭监牢·玉石微缩模型', components: [component('imprisonment-jade-prison', '玉石监牢微缩模型', false)] },
  'minimus-containment': { label: '微缩收容·透明宝石', components: [component('imprisonment-transparent-gem', '大型透明宝石', false)] },
  slumber: { label: '沉眠·催眠草药', components: [component('imprisonment-soporific-herbs', '稀有催眠草药', false)] },
}

function imprisonmentRequirement(targetHitDiceCount = 1, requestedMode?: string): Dnd5eSpellMaterialRequirement {
  const hitDice = Math.max(1, Math.floor(targetHitDiceCount))
  const minimumTotalValueGp = hitDice * 500
  const modes = requestedMode && requestedMode in IMPRISONMENT_MATERIAL_OPTIONS
    ? [requestedMode as ImprisonmentMode]
    : Object.keys(IMPRISONMENT_MATERIAL_OPTIONS) as ImprisonmentMode[]
  return {
    label: `与禁锢形态相符、价值至少 ${minimumTotalValueGp.toLocaleString('en-US')} gp（500 gp × 目标 ${hitDice} 生命骰）的特殊材料`,
    options: modes.map((mode) => ({
      ...IMPRISONMENT_MATERIAL_OPTIONS[mode],
      components: IMPRISONMENT_MATERIAL_OPTIONS[mode].components.map((entry) => ({
        ...entry,
        minimumTotalValueGp,
      })),
    })),
  }
}

function createUndeadRequirement(corpseCount = 1): Dnd5eSpellMaterialRequirement {
  const count = Number.isInteger(corpseCount) ? Math.max(0, Math.min(6, corpseCount)) : 1
  return singleOption(
    count > 0
      ? `一罐墓土、一罐微咸水，以及每具尸体一颗价值至少 150 gp 的黑玛瑙（${count} 具尸体）`
      : '一罐墓土与一罐微咸水（重新确立控制，不涉及尸体）',
    component('grave-dirt-clay-pot', '装满墓土的陶罐', false),
    component('brackish-water-clay-pot', '装满微咸水的陶罐', false),
    ...(count > 0
      ? [component('black-onyx', '黑玛瑙', false, { quantity: count, minimumUnitValueGp: 150 })]
      : []),
  )
}

const CORE_REQUIREMENTS: Readonly<Record<string, Dnd5eSpellMaterialRequirement>> = {
  'arcane-lock': singleOption('价值至少 25 gp 的金粉', component('gold-dust', '金粉', true, { minimumTotalValueGp: 25 })),
  'arcane-sword': singleOption('价值 250 gp 的铂金微型剑', component('platinum-miniature-sword', '铂金微型剑', false, { minimumUnitValueGp: 250 })),
  augury: singleOption('价值至少 25 gp 的特制占卜信物', component('marked-divination-tokens', '特制占卜信物', false, { minimumUnitValueGp: 25 })),
  awaken: singleOption('价值至少 1,000 gp 的玛瑙', component('agate', '玛瑙', true, { minimumUnitValueGp: 1_000 })),
  'circle-of-death': singleOption('价值至少 500 gp 的黑珍珠粉末', component('black-pearl-powder', '黑珍珠粉末', false, { minimumTotalValueGp: 500 })),
  clairvoyance: singleOption('价值至少 100 gp 的锐眼/锐耳术法器', component('clairvoyance-focus', '锐眼/锐耳术法器', false, { minimumUnitValueGp: 100 })),
  contingency: singleOption('价值至少 1,500 gp 的应急术自塑像', component('contingency-statuette', '应急术自塑像', false, { minimumUnitValueGp: 1_500 })),
  'continual-flame': singleOption('价值 50 gp 的红宝石粉末', component('ruby-dust', '红宝石粉末', true, { minimumTotalValueGp: 50 })),
  divination: singleOption('合计价值至少 25 gp 的祭品与熏香', component('religious-offering', '祭品与熏香', true, { minimumTotalValueGp: 25 })),
  'find-familiar': singleOption('价值 10 gp 的木炭、熏香和草药', component('familiar-incense-mixture', '魔宠仪式熏香混合物', true, { minimumTotalValueGp: 10 })),
  forbiddance: singleOption('价值至少 1,000 gp 的红宝石粉末', component('ruby-dust', '红宝石粉末', false, { minimumTotalValueGp: 1_000 })),
  forcecage: singleOption('价值 1,500 gp 的红宝石粉末', component('ruby-dust', '红宝石粉末', false, { minimumTotalValueGp: 1_500 })),
  gate: singleOption('价值至少 5,000 gp 的钻石', component('diamond', '钻石', false, { minimumUnitValueGp: 5_000 })),
  'glyph-of-warding': singleOption('价值至少 200 gp 的钻石粉末', component('diamond-dust', '钻石粉末', true, { minimumTotalValueGp: 200 })),
  'greater-restoration': singleOption('价值至少 100 gp 的钻石粉末', component('diamond-dust', '钻石粉末', true, { minimumTotalValueGp: 100 })),
  'guards-and-wards': singleOption('价值至少 10 gp 的小银棒', component('small-silver-rod', '小银棒', false, { minimumUnitValueGp: 10 })),
  hallow: singleOption('价值至少 1,000 gp 的草药、油膏和熏香', component('sacred-incense-oils', '圣化草药、油膏和熏香', true, { minimumTotalValueGp: 1_000 })),
  'heroes-feast': singleOption('价值至少 1,000 gp 的镶宝石碗', component('jeweled-bowl', '镶宝石的碗', true, { minimumUnitValueGp: 1_000 })),
  'holy-aura': singleOption('价值至少 1,000 gp 的圣物匣', component('holy-reliquary', '圣物匣', false, { minimumUnitValueGp: 1_000 })),
  identify: singleOption('价值至少 100 gp 的珍珠', component('pearl', '珍珠', false, { minimumUnitValueGp: 100 })),
  'illusory-script': singleOption('价值至少 10 gp 的含铅墨水', component('leaded-ink', '含铅墨水', true, { minimumTotalValueGp: 10 })),
  'instant-summons': singleOption('价值 1,000 gp 的蓝宝石', component('sapphire', '蓝宝石', false, { minimumUnitValueGp: 1_000 })),
  'legend-lore': singleOption(
    '价值 250 gp 的熏香和四片各值 50 gp 的象牙',
    component('legend-lore-incense', '熏香', true, { minimumTotalValueGp: 250 }),
    component('ivory-strip', '象牙片', false, { quantity: 4, minimumUnitValueGp: 50 }),
  ),
  'magic-circle': {
    label: '价值至少 100 gp 的圣水，或银粉和铁粉',
    options: [
      { label: '圣水（100 gp）', components: [component('holy-water', '圣水', true, { minimumTotalValueGp: 100 })] },
      { label: '银粉和铁粉（100 gp）', components: [component('silver-iron-powder', '银粉和铁粉', true, { minimumTotalValueGp: 100 })] },
    ],
  },
  'magic-jar': singleOption('价值至少 500 gp 的装饰性灵魂容器', component('ornamental-soul-container', '装饰性灵魂容器', false, { minimumUnitValueGp: 500 })),
  'magic-mouth': singleOption('价值至少 10 gp 的翡翠粉末', component('jade-dust', '翡翠粉末', true, { minimumTotalValueGp: 10 })),
  'magnificent-mansion': singleOption(
    '各价值至少 5 gp 的象牙微型门户、抛光大理石和微型银匙',
    component('ivory-miniature-portal', '象牙微型门户', false, { minimumUnitValueGp: 5 }),
    component('polished-marble', '抛光大理石', false, { minimumUnitValueGp: 5 }),
    component('miniature-silver-spoon', '微型银匙', false, { minimumUnitValueGp: 5 }),
  ),
  nondetection: singleOption('价值 25 gp 的钻石粉末', component('diamond-dust', '钻石粉末', true, { minimumTotalValueGp: 25 })),
  'planar-binding': singleOption('价值至少 1,000 gp 的珠宝', component('jewel', '珠宝', true, { minimumUnitValueGp: 1_000 })),
  'plane-shift': singleOption('价值至少 250 gp 的位面调谐叉状金属棒', component('tuned-forked-rod', '位面调谐叉状金属棒', false, { minimumUnitValueGp: 250 })),
  'programmed-illusion': singleOption('价值至少 25 gp 的玉粉', component('jade-powder', '玉粉', false, { minimumTotalValueGp: 25 })),
  'project-image': singleOption('价值至少 5 gp 的施法者复制品', component('caster-replica', '施法者复制品', false, { minimumUnitValueGp: 5 })),
  'protection-from-evil-and-good': {
    label: '一份圣水，或一份银粉和铁粉',
    options: [
      { label: '一份圣水', components: [component('holy-water', '圣水', true)] },
      { label: '一份银粉和铁粉', components: [component('silver-iron-powder', '银粉和铁粉', true)] },
    ],
  },
  'raise-dead': singleOption('一颗价值至少 500 gp 的钻石', component('diamond', '钻石', true, { minimumUnitValueGp: 500 })),
  reincarnate: singleOption('总价值至少 1,000 gp 的稀有油膏', component('rare-oils', '稀有油膏', true, { minimumTotalValueGp: 1_000 })),
  resurrection: singleOption('一颗价值至少 1,000 gp 的钻石', component('diamond', '钻石', true, { minimumUnitValueGp: 1_000 })),
  revivify: singleOption('总价值 300 gp 的钻石', component('diamond', '钻石', true, { minimumTotalValueGp: 300 })),
  scrying: singleOption('价值至少 1,000 gp 的探知术法器', component('scrying-focus', '探知术法器', false, { minimumUnitValueGp: 1_000 })),
  'secret-chest': singleOption(
    '价值至少 5,000 gp 的精美箱子和价值至少 50 gp 的微型复制品',
    component('secret-chest', '精美箱子', false, { minimumUnitValueGp: 5_000 }),
    component('secret-chest-replica', '微型复制品', false, { minimumUnitValueGp: 50 }),
  ),
  sequester: singleOption('总价值至少 5,000 gp 的四色宝石粉末', component('mixed-gem-dust', '四色宝石粉末', true, { minimumTotalValueGp: 5_000 })),
  shapechange: singleOption('价值至少 1,500 gp 且施法前已戴上的玉石头环', component('jade-circlet', '玉石头环', false, { minimumUnitValueGp: 1_500, mustBeEquipped: true })),
  simulacrum: singleOption('价值 1,500 gp 的红宝石粉末', component('ruby-dust', '红宝石粉末', true, { minimumTotalValueGp: 1_500 })),
  stoneskin: singleOption('价值 100 gp 的钻石粉末', component('diamond-dust', '钻石粉末', true, { minimumTotalValueGp: 100 })),
  symbol: singleOption('总价值至少 1,000 gp 的徽记术宝石粉末', component('symbol-powders', '徽记术宝石粉末', true, { minimumTotalValueGp: 1_000 })),
  'teleportation-circle': singleOption('价值 50 gp 的稀有粉笔与墨水', component('teleportation-chalk-ink', '传送法阵粉笔与墨水', true, { minimumTotalValueGp: 50 })),
  'true-resurrection': singleOption(
    '少量圣水和总价值至少 25,000 gp 的钻石',
    component('holy-water', '圣水', true),
    component('diamond', '钻石', true, { minimumTotalValueGp: 25_000 }),
  ),
  'true-seeing': singleOption('价值 25 gp 的真知术眼膏', component('truesight-ointment', '真知术眼膏', true, { minimumTotalValueGp: 25 })),
  'warding-bond': singleOption(
    '施法者与目标各佩戴一枚价值至少 50 gp 的铂金戒指',
    component('platinum-ring', '施法者佩戴的铂金戒指', false, {
      quantity: 1,
      minimumUnitValueGp: 50,
      mustBeEquipped: true,
    }),
  ),
}

export function dnd5eCoreSpellMaterialRequirement(
  spellId: string,
  context?: { targetHitDiceCount?: number; imprisonmentMode?: string; createUndeadCorpseCount?: number },
): Dnd5eSpellMaterialRequirement | undefined {
  const normalizedSpellId = spellId.trim().toLowerCase()
  if (normalizedSpellId === 'imprisonment') {
    return imprisonmentRequirement(context?.targetHitDiceCount, context?.imprisonmentMode)
  }
  if (normalizedSpellId === 'create-undead') {
    return createUndeadRequirement(context?.createUndeadCorpseCount)
  }
  return CORE_REQUIREMENTS[normalizedSpellId]
}

function entryUnitValueGp(entry: Dnd5eInventoryEntry): number {
  const value = entry.item.spellcastingMaterial?.unitValueGp
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function entryHasTag(entry: Dnd5eInventoryEntry, tag: string): boolean {
  return entry.item.spellcastingMaterial?.tags.some((candidate) => candidate === tag) === true
}

function minimumValueAllocation(
  candidates: readonly Dnd5eInventoryEntry[],
  remaining: ReadonlyMap<string, number>,
  requirement: Dnd5eSpellMaterialComponent,
): ReadonlyMap<string, number> | undefined {
  const minimumTotalValueGp = Math.max(0, requirement.minimumTotalValueGp ?? 0)
  if (minimumTotalValueGp <= 0) return undefined
  const minimumUnits = requirement.quantity == null
    ? 0
    : Math.max(1, Math.floor(requirement.quantity))
  const maximumUnitValueGp = Math.max(0, ...candidates.map(entryUnitValueGp))
  const maximumUsefulValueGp = minimumTotalValueGp +
    maximumUnitValueGp * Math.max(1, minimumUnits) - 1
  type AllocationState = {
    totalValueGp: number
    totalUnits: number
    quantities: ReadonlyMap<string, number>
  }
  let states = new Map<string, AllocationState>([[
    '0:0',
    { totalValueGp: 0, totalUnits: 0, quantities: new Map() },
  ]])

  for (const entry of candidates) {
    const available = remaining.get(entry.instanceId) ?? 0
    const unitValueGp = entryUnitValueGp(entry)
    if (available < 1 || unitValueGp <= 0) continue
    const maximumUsefulQuantity = Math.min(
      available,
      Math.max(minimumUnits, Math.ceil(maximumUsefulValueGp / unitValueGp)),
    )
    const next = new Map(states)
    for (const state of states.values()) {
      for (let quantity = 1; quantity <= maximumUsefulQuantity; quantity += 1) {
        const totalValueGp = state.totalValueGp + quantity * unitValueGp
        if (totalValueGp > maximumUsefulValueGp) break
        const totalUnits = state.totalUnits + quantity
        const key = `${totalValueGp}:${totalUnits}`
        if (next.has(key)) continue
        next.set(key, {
          totalValueGp,
          totalUnits,
          quantities: new Map(state.quantities).set(entry.instanceId, quantity),
        })
      }
    }
    states = next
  }

  return [...states.values()]
    .filter((state) =>
      state.totalValueGp >= minimumTotalValueGp && state.totalUnits >= minimumUnits,
    )
    .sort((left, right) =>
      left.totalValueGp - right.totalValueGp || left.totalUnits - right.totalUnits,
    )[0]?.quantities
}

function planOption(
  entries: readonly Dnd5eInventoryEntry[],
  option: Dnd5eSpellMaterialOption,
): Dnd5eSpellMaterialAllocation[] | undefined {
  const remaining = new Map(entries.map((entry) => [entry.instanceId, Math.max(0, Math.floor(entry.quantity))]))
  const allocations: Dnd5eSpellMaterialAllocation[] = []
  for (const requirement of option.components) {
    const candidates = entries
      .filter((entry) =>
        entry.quantity > 0 && entry.identified !== false && entryHasTag(entry, requirement.tag) &&
        entryUnitValueGp(entry) >= (requirement.minimumUnitValueGp ?? 0) &&
        (!requirement.mustBeEquipped || entry.equippedSlot != null),
      )
      .sort((left, right) =>
        entryUnitValueGp(left) - entryUnitValueGp(right) ||
        left.acquiredAt - right.acquiredAt ||
        left.instanceId.localeCompare(right.instanceId),
      )
    const minimumValueQuantities = minimumValueAllocation(candidates, remaining, requirement)
    if (requirement.minimumTotalValueGp != null && !minimumValueQuantities) return undefined
    let unitsNeeded = Math.max(1, Math.floor(requirement.quantity ?? 1))
    let valueNeeded = Math.max(0, requirement.minimumTotalValueGp ?? 0)
    for (const entry of candidates) {
      const available = remaining.get(entry.instanceId) ?? 0
      if (available < 1 || (unitsNeeded <= 0 && valueNeeded <= 0)) continue
      const unitValueGp = entryUnitValueGp(entry)
      const plannedQuantity = minimumValueQuantities?.get(entry.instanceId)
      if (minimumValueQuantities && plannedQuantity == null) continue
      const forUnits = minimumValueQuantities ? 0 : (unitsNeeded > 0 ? unitsNeeded : 0)
      const forValue = minimumValueQuantities
        ? 0
        : (valueNeeded > 0 && unitValueGp > 0 ? Math.ceil(valueNeeded / unitValueGp) : 0)
      const quantity = minimumValueQuantities
        ? plannedQuantity!
        : Math.min(available, Math.max(forUnits, forValue, 1))
      if (quantity < 1) continue
      remaining.set(entry.instanceId, available - quantity)
      allocations.push({
        instanceId: entry.instanceId,
        tag: requirement.tag,
        quantity,
        unitValueGp,
        consumed: requirement.consumed,
        mustBeEquipped: requirement.mustBeEquipped || undefined,
      })
      unitsNeeded = Math.max(0, unitsNeeded - quantity)
      valueNeeded = Math.max(0, valueNeeded - quantity * unitValueGp)
    }
    if (unitsNeeded > 0 || valueNeeded > 0) return undefined
  }
  return allocations
}

export function dnd5eSpellMaterialConsumptionPlan(
  actor: Pick<Character, 'dnd5eInventory'>,
  requirement: Dnd5eSpellMaterialRequirement,
): Dnd5eSpellMaterialConsumptionPlan | undefined {
  const inventory = actor.dnd5eInventory
  if (!inventory) return undefined
  for (const option of requirement.options) {
    const allocations = planOption(inventory.entries, option)
    if (allocations) {
      return {
        expectedInventoryRevision: inventory.revision ?? 0,
        requirementLabel: requirement.label,
        optionLabel: option.label,
        allocations,
      }
    }
  }
  return undefined
}

export function applyDnd5eSpellMaterialConsumption(
  character: Character,
  plan: Dnd5eSpellMaterialConsumptionPlan,
  expectedInventoryRevision = plan.expectedInventoryRevision,
): Dnd5eSpellMaterialSettlement {
  const inventory = character.dnd5eInventory
  if (!inventory) return { ok: false, character, reason: 'inventory-untracked' }
  if ((inventory.revision ?? 0) !== expectedInventoryRevision) {
    return { ok: false, character, reason: 'stale-inventory-revision' }
  }
  const requiredByInstance = new Map<string, number>()
  for (const allocation of plan.allocations) {
    requiredByInstance.set(
      allocation.instanceId,
      (requiredByInstance.get(allocation.instanceId) ?? 0) + allocation.quantity,
    )
    const entry = inventory.entries.find((candidate) => candidate.instanceId === allocation.instanceId)
    if (
      !entry || entry.identified === false || !entryHasTag(entry, allocation.tag) ||
      entryUnitValueGp(entry) < allocation.unitValueGp ||
      (allocation.mustBeEquipped && entry.equippedSlot == null)
    ) return { ok: false, character, reason: 'material-unavailable' }
  }
  for (const [instanceId, quantity] of requiredByInstance) {
    const entry = inventory.entries.find((candidate) => candidate.instanceId === instanceId)
    if (!entry || entry.quantity < quantity) return { ok: false, character, reason: 'material-unavailable' }
  }
  const consumedByInstance = new Map<string, number>()
  for (const allocation of plan.allocations) {
    if (!allocation.consumed) continue
    consumedByInstance.set(
      allocation.instanceId,
      (consumedByInstance.get(allocation.instanceId) ?? 0) + allocation.quantity,
    )
  }
  if (consumedByInstance.size === 0) return { ok: true, character, consumed: false }
  const removedEquipmentIds = new Set<string>()
  const entries = inventory.entries.flatMap((entry) => {
    const amount = consumedByInstance.get(entry.instanceId) ?? 0
    if (amount < 1) return [entry]
    const quantity = entry.quantity - amount
    if (quantity > 0) return [{ ...entry, quantity }]
    if (entry.equippedSlot && entry.item.equipment?.id) removedEquipmentIds.add(entry.item.equipment.id)
    return []
  })
  const equipment = removedEquipmentIds.size > 0
    ? Object.fromEntries(Object.entries(character.equipment ?? {}).filter(([, item]) =>
        !item || !removedEquipmentIds.has(item.id),
      ))
    : character.equipment
  return {
    ok: true,
    consumed: true,
    character: {
      ...character,
      ...(equipment !== character.equipment ? { equipment } : {}),
      dnd5eInventory: {
        ...inventory,
        schemaVersion: DND5E_INVENTORY_SCHEMA_VERSION,
        revision: (inventory.revision ?? 0) + 1,
        entries,
      },
    },
  }
}

export function settleDnd5eSpellMaterialConsumption(
  characters: readonly Character[],
  actorId: string,
  plan: Dnd5eSpellMaterialConsumptionPlan | undefined,
  expectedInventoryRevision?: number,
): { ok: true; characters: readonly Character[] } | { ok: false } {
  if (!plan) return { ok: true, characters }
  const actorIndex = characters.findIndex((character) => character.id === actorId)
  if (actorIndex < 0) return { ok: false }
  const settled = applyDnd5eSpellMaterialConsumption(
    characters[actorIndex],
    plan,
    expectedInventoryRevision,
  )
  if (!settled.ok) return { ok: false }
  return {
    ok: true,
    characters: characters.map((character, index) =>
      index === actorIndex ? settled.character : character,
    ),
  }
}
